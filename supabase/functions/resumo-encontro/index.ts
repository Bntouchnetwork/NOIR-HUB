// resumo-encontro: gera o resumo do encontro com o Claude a partir da transcrição das legendas,
// das enquetes e dos pitches cronometrados. Só o mentor da sala pode pedir.
//
// POST { sala, titulo, duracaoMin, participantes[], transcricao[{nome,texto,hora}],
//        enquetes[{pergunta, resultados[{opcao,votos}]}], pitches[{nome,segundos}] }
//   Authorization: Bearer <token LiveKit do mentor>
//   -> { resumo }
//
// Variáveis: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ANTHROPIC_API_KEY,
//            RESUMO_MODELO (opcional, padrão claude-sonnet-5-5).
// Se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY existirem, o resumo é salvo em meeting_summaries.

import { TokenVerifier } from "npm:livekit-server-sdk@2.19.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cabecalhos, ErroConfig, resposta, salaValida, variavel } from "../_shared/comum.ts";

type Linha = { nome?: string; texto?: string; hora?: string };
type Enquete = { pergunta?: string; resultados?: { opcao?: string; votos?: number }[] };
type Pitch = { nome?: string; segundos?: number };

const INSTRUCOES = `Você organiza o resumo de um encontro do Projeto N.O.I.R., mentoria de comunicação, network e negócios conduzida por Léo Figueiredo.
Escreva em português do Brasil, em texto simples (sem markdown, sem asteriscos), para ser enviado aos alunos.
Use exatamente estas seções, cada uma com um título em maiúsculas seguido de itens começando com "• ":
PRINCIPAIS PONTOS — de 3 a 6 ideias centrais do encontro.
EXEMPLOS E CASOS — situações reais que os participantes trouxeram, com o nome de quem falou.
ENQUETES E PITCHES — resultados das enquetes e quem apresentou pitch (omita a seção se não houver).
PRÓXIMOS PASSOS — tarefas práticas para a próxima semana.
Seja fiel à transcrição: não invente falas, números ou nomes. A transcrição vem de legendas automáticas e pode ter erros; corrija apenas o óbvio.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhos(req) });
  if (req.method !== "POST") return resposta(req, { erro: "Use POST." }, 405);

  try {
    const d = await req.json().catch(() => ({})) as Record<string, unknown>;
    const sala = d.sala;
    if (!salaValida(sala)) return resposta(req, { erro: "Sala inválida." }, 400);

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let claims;
    try { claims = await new TokenVerifier(variavel("LIVEKIT_API_KEY"), variavel("LIVEKIT_API_SECRET")).verify(jwt); }
    catch (e) { if (e instanceof ErroConfig) throw e; return resposta(req, { erro: "Acesso expirado. Entre de novo na sala." }, 401); }
    const salaDoToken = claims.video?.room ?? "";
    if (!claims.video?.roomAdmin || !(salaDoToken === sala || salaDoToken.startsWith(sala + "-g"))) {
      return resposta(req, { erro: "Só o mentor pode gerar o resumo." }, 403);
    }

    const transcricao = (Array.isArray(d.transcricao) ? d.transcricao : []) as Linha[];
    const enquetes = (Array.isArray(d.enquetes) ? d.enquetes : []) as Enquete[];
    const pitches = (Array.isArray(d.pitches) ? d.pitches : []) as Pitch[];
    if (!transcricao.length && !enquetes.length && !pitches.length) {
      return resposta(req, { erro: "Ainda não há falas, enquetes ou pitches para resumir." }, 400);
    }

    // Mantém o fim da conversa se a transcrição for muito longa.
    const falas = transcricao.map((l) => `[${String(l.hora ?? "")}] ${String(l.nome ?? "?")}: ${String(l.texto ?? "")}`).join("\n").slice(-150_000);
    const txtEnquetes = enquetes.map((q) => `- ${q.pergunta}: ${(q.resultados ?? []).map((r) => `${r.opcao} (${r.votos ?? 0})`).join(", ")}`).join("\n");
    const txtPitches = pitches.map((p) => `- ${p.nome}: ${Math.round(Number(p.segundos) || 0)} segundos`).join("\n");
    const conteudo = [
      `Encontro: ${String(d.titulo ?? "Encontro ao vivo")}`,
      `Duração: ${Number(d.duracaoMin) || 0} minutos`,
      `Participantes: ${(Array.isArray(d.participantes) ? d.participantes : []).map(String).join(", ")}`,
      "", "<transcricao>", falas || "(sem falas transcritas)", "</transcricao>",
      "", "<enquetes>", txtEnquetes || "(nenhuma)", "</enquetes>",
      "", "<pitches>", txtPitches || "(nenhum)", "</pitches>",
    ].join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": variavel("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("RESUMO_MODELO") ?? "claude-sonnet-5-5",
        max_tokens: 2000,
        system: INSTRUCOES,
        messages: [{ role: "user", content: conteudo }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Claude", r.status, JSON.stringify(j).slice(0, 500));
      return resposta(req, { erro: "A IA não conseguiu gerar o resumo agora. Tente de novo em instantes." }, 502);
    }
    const resumo = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();

    const url = Deno.env.get("SUPABASE_URL"), chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && chave) {
      const supa = createClient(url, chave, { auth: { persistSession: false } });
      const { error } = await supa.from("meeting_summaries").insert({ room_name: sala, title: String(d.titulo ?? ""), summary: resumo, transcript: transcricao, polls: enquetes, pitches });
      if (error) console.error(error);
    }
    return resposta(req, { resumo });
  } catch (e) {
    console.error(e);
    if (e instanceof ErroConfig) return resposta(req, { erro: e.message }, 500);
    return resposta(req, { erro: "Não foi possível gerar o resumo." }, 500);
  }
});
