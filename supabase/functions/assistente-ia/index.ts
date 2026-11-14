// assistente-ia: o mentor pede, a IA cria ou altera a apresentação mostrada na sala.
//
// POST { sala, acao: "gerar", instrucao, apresentacao?, slideAtual?, contexto? }
//   -> { apresentacao, mensagem, foco, motor }
// POST { sala, acao: "ultima" } -> { apresentacao | null }   (última versão salva desta sala)
//
// Autorização: o token LiveKit do mentor (Authorization: Bearer <token>), de administrador
// desta sala ou de uma sala de networking dela.
//
// O navegador fala sempre com esta função, com este contrato. Qual IA responde é decidido aqui
// (motores/index.ts): hoje o Claude; no futuro o motor da Endeavor, sem mudar o assistente.
//
// Variáveis: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, IA_MOTOR, IA_MOTOR_RESERVA,
//            e as de cada motor (motores/claude.ts, motores/endeavor.ts).

import { TokenVerifier } from "npm:livekit-server-sdk@2.19.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cabecalhos, ErroConfig, resposta, salaValida, variavel } from "../_shared/comum.ts";
import { ApresentacaoInvalida, montarPedido, validar } from "../_shared/apresentacao.ts";
import { ErroMotor, motoresConfigurados } from "./motores/index.ts";

function banco() {
  const url = Deno.env.get("SUPABASE_URL"), chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhos(req) });
  if (req.method !== "POST") return resposta(req, { erro: "Use POST." }, 405);

  try {
    // deno-lint-ignore no-explicit-any
    const d = await req.json().catch(() => ({})) as any;
    const sala = d.sala;
    if (!salaValida(sala)) return resposta(req, { erro: "Sala inválida." }, 400);

    // 1. Só o mentor da sala usa o assistente.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let claims;
    try { claims = await new TokenVerifier(variavel("LIVEKIT_API_KEY"), variavel("LIVEKIT_API_SECRET")).verify(jwt); }
    catch (e) { if (e instanceof ErroConfig) throw e; return resposta(req, { erro: "Acesso expirado. Entre de novo na sala." }, 401); }
    const salaDoToken = claims.video?.room ?? "";
    if (!claims.video?.roomAdmin || !(salaDoToken === sala || salaDoToken.startsWith(sala + "-g"))) {
      return resposta(req, { erro: "Só o mentor pode usar o assistente de apresentação." }, 403);
    }
    const db = banco();

    if (d.acao === "ultima") {
      if (!db) return resposta(req, { apresentacao: null });
      const { data } = await db.from("presentation_versions").select("content").eq("room_name", sala)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return resposta(req, { apresentacao: data?.content ?? null });
    }
    if (d.acao !== "gerar") return resposta(req, { erro: "Ação desconhecida." }, 400);

    // 2. Pedido limpo e limitado.
    const pedido = montarPedido(d);
    if (!pedido.instrucao) return resposta(req, { erro: "Escreva o que você quer na apresentação." }, 400);

    // 3. Motor principal; se falhar e houver reserva, tenta a reserva.
    const motores = motoresConfigurados();
    let ultimoErro: ErroMotor | null = null;
    for (const motor of motores) {
      try {
        const r = await motor.gerar(pedido, AbortSignal.timeout(120_000));
        let apresentacao;
        try { apresentacao = validar(r.apresentacao); }
        catch (e) { throw new ErroMotor("A IA devolveu uma apresentação inválida. Tente de novo.", e instanceof ApresentacaoInvalida ? e.message : String(e)); }
        const foco = Math.min(Math.max(Math.trunc(Number(r.foco ?? pedido.slideAtual) || 0), 0), apresentacao.slides.length - 1);
        const mensagem = String(r.mensagem || "Pronto.").slice(0, 400);

        if (db) {
          const { error } = await db.from("presentation_versions").insert({
            room_name: sala, instruction: pedido.instrucao, content: apresentacao, engine: motor.nome, message: mensagem,
          });
          if (error) console.error("histórico", error);
        }
        return resposta(req, { apresentacao, mensagem, foco, motor: motor.nome });
      } catch (e) {
        ultimoErro = e instanceof ErroMotor ? e : new ErroMotor("O assistente não conseguiu responder.", String(e));
        console.error(`motor ${motor.nome}:`, ultimoErro.message, ultimoErro.detalhe);
      }
    }
    return resposta(req, { erro: ultimoErro?.message ?? "O assistente não conseguiu responder." }, ultimoErro?.status ?? 502);
  } catch (e) {
    console.error(e);
    if (e instanceof ErroConfig) return resposta(req, { erro: e.message }, 500);
    return resposta(req, { erro: "O assistente não conseguiu responder." }, 500);
  }
});
