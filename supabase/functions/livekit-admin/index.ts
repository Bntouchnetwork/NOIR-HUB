// livekit-admin: ações do mentor dentro da sala.
//
// Autorização: o próprio token LiveKit do mentor (Authorization: Bearer <token>),
// que precisa ser válido, ser de administrador da sala e apontar para a mesma sala.
//
// POST { sala, acao, identidade?, egressId? }
//   acao = "iniciar_gravacao" | "parar_gravacao" | "silenciar" | "remover" | "encerrar"
//        | "voltar_grupos" (chama todos das salas de networking <sala>-g1..gN de volta)
//        | "iniciar_transmissao" { destinos: ["rtmp(s)://…/chave"] } | "parar_transmissao" { egressId }
//
// Gravação: grava a sala inteira (layout com quem está falando em destaque) em MP4
// num bucket compatível com S3. No Supabase Storage, gere as chaves em
// Storage > Settings > S3 Connection.
// Variáveis: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
//            GRAVACAO_S3_ENDPOINT, GRAVACAO_S3_REGIAO, GRAVACAO_S3_BUCKET,
//            GRAVACAO_S3_ACCESS_KEY, GRAVACAO_S3_SECRET.

import {
  DataPacket_Kind,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  StreamOutput,
  StreamProtocol,
  TokenVerifier,
  TrackType,
} from "npm:livekit-server-sdk@2.19.3";
import { cabecalhos, ErroConfig, hostLiveKit, resposta, salaValida, variavel } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhos(req) });
  if (req.method !== "POST") return resposta(req, { erro: "Use POST." }, 405);

  try {
    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { sala, acao, identidade, egressId } = corpo as Record<string, string>;
    if (!salaValida(sala)) return resposta(req, { erro: "Sala inválida." }, 400);

    // 1. Quem pede é o mentor desta sala?
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const chave = variavel("LIVEKIT_API_KEY"), segredo = variavel("LIVEKIT_API_SECRET");
    let claims;
    try { claims = await new TokenVerifier(chave, segredo).verify(jwt); }
    catch { return resposta(req, { erro: "Acesso expirado. Entre de novo na sala." }, 401); }
    // O token vale para a sala principal e para as salas de networking dela (<sala>-g1, -g2…).
    const salaDoToken = claims.video?.room ?? "";
    const mesmaSala = salaDoToken === sala || salaDoToken.startsWith(sala + "-g") || sala.startsWith(salaDoToken + "-g");
    if (!claims.video?.roomAdmin || !mesmaSala) {
      return resposta(req, { erro: "Só o mentor pode fazer isso." }, 403);
    }

    const host = hostLiveKit();
    const salas = new RoomServiceClient(host, chave, segredo);
    const egress = new EgressClient(host, chave, segredo);

    switch (acao) {
      case "iniciar_gravacao": {
        const arquivo = new EncodedFileOutput({
          fileType: EncodedFileType.MP4,
          filepath: `gravacoes/${sala}/{time}.mp4`,
          output: {
            case: "s3",
            value: new S3Upload({
              endpoint: variavel("GRAVACAO_S3_ENDPOINT"),
              region: variavel("GRAVACAO_S3_REGIAO"),
              bucket: variavel("GRAVACAO_S3_BUCKET"),
              accessKey: variavel("GRAVACAO_S3_ACCESS_KEY"),
              secret: variavel("GRAVACAO_S3_SECRET"),
              forcePathStyle: true,
            }),
          },
        });
        const info = await egress.startRoomCompositeEgress(sala, arquivo, { layout: "speaker" });
        return resposta(req, { ok: true, egressId: info.egressId });
      }
      case "parar_gravacao": {
        const ids = egressId ? [egressId]
          : (await egress.listEgress({ roomName: sala, active: true })).map((e) => e.egressId);
        await Promise.all(ids.map((id) => egress.stopEgress(id)));
        return resposta(req, { ok: true, paradas: ids.length });
      }
      case "silenciar": {
        if (!identidade) return resposta(req, { erro: "Informe quem silenciar." }, 400);
        const p = await salas.getParticipant(sala, identidade);
        const audios = p.tracks.filter((t) => t.type === TrackType.AUDIO && !t.muted);
        await Promise.all(audios.map((t) => salas.mutePublishedTrack(sala, identidade, t.sid, true)));
        return resposta(req, { ok: true });
      }
      case "remover": {
        if (!identidade) return resposta(req, { erro: "Informe quem remover." }, 400);
        await salas.removeParticipant(sala, identidade);
        return resposta(req, { ok: true });
      }
      case "encerrar": {
        await salas.deleteRoom(sala);
        return resposta(req, { ok: true });
      }
      case "voltar_grupos": {
        const n = Math.min(Math.max(Number(corpo.grupos) || 0, 0), 50);
        const aviso = new TextEncoder().encode(JSON.stringify({ t: "voltar" }));
        // A sala pode já ter esvaziado; nesse caso o LiveKit responde erro e seguimos.
        await Promise.allSettled(Array.from({ length: n }, (_, i) =>
          salas.sendData(`${sala}-g${i + 1}`, aviso, DataPacket_Kind.RELIABLE, { topic: "noir" })));
        return resposta(req, { ok: true });
      }
      case "iniciar_transmissao": {
        const destinos = Array.isArray(corpo.destinos) ? corpo.destinos.map(String) : [];
        if (!destinos.length || destinos.length > 3 || !destinos.every((u) => /^rtmps?:\/\/[^\s]+$/.test(u))) {
          return resposta(req, { erro: "Destinos de transmissão inválidos." }, 400);
        }
        const saida = new StreamOutput({ protocol: StreamProtocol.RTMP, urls: destinos });
        const info = await egress.startRoomCompositeEgress(sala, saida, { layout: "speaker" });
        return resposta(req, { ok: true, egressId: info.egressId });
      }
      case "parar_transmissao": {
        if (!egressId) return resposta(req, { erro: "Informe a transmissão." }, 400);
        await egress.stopEgress(egressId);
        return resposta(req, { ok: true });
      }
      default:
        return resposta(req, { erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error(e);
    if (e instanceof ErroConfig) return resposta(req, { erro: e.message }, 500);
    return resposta(req, { erro: "O LiveKit não concluiu a ação. Tente de novo." }, 502);
  }
});
