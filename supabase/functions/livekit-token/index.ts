// livekit-token: libera o acesso a uma sala do LiveKit.
//
// POST { sala, nome, papel: "mentor" | "aluno", codigoMentor? }
//   -> { token, url, identidade, papel }
//
// Regras:
// - Mentor: usuário logado com profiles.role = 'admin', ou o código MENTOR_CODIGO (fase de protótipo).
// - Aluno: usuário logado com matrícula ativa no curso da sala (live_sessions.room_name),
//   ou qualquer pessoa se PERMITIR_ALUNO_SEM_LOGIN = "true" (só para testes).
//
// Variáveis: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, MENTOR_CODIGO,
//            PERMITIR_ALUNO_SEM_LOGIN (opcional), ORIGENS_PERMITIDAS (opcional).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem nas funções do Supabase.

import { AccessToken } from "npm:livekit-server-sdk@2.19.3";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { cabecalhos, ErroConfig, iguais, resposta, salaValida, variavel } from "../_shared/comum.ts";

type Usuario = { id: string } | null;

async function usuarioLogado(req: Request): Promise<{ usuario: Usuario; supa: SupabaseClient | null }> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL"), chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!jwt || !url || !chave) return { usuario: null, supa: null };
  const supa = createClient(url, chave, { auth: { persistSession: false } });
  const { data } = await supa.auth.getUser(jwt); // a chave anon não é um usuário: volta null
  return { usuario: data.user ? { id: data.user.id } : null, supa };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhos(req) });
  if (req.method !== "POST") return resposta(req, { erro: "Use POST." }, 405);

  try {
    const corpo = await req.json().catch(() => ({}));
    const { sala, papel, codigoMentor } = corpo as Record<string, string>;
    let nome = String(corpo.nome ?? "").trim().slice(0, 60) || "Participante";
    if (!salaValida(sala)) return resposta(req, { erro: "Sala inválida." }, 400);

    const { usuario, supa } = await usuarioLogado(req);
    let ehMentor = false;

    if (papel === "mentor") {
      if (usuario && supa) {
        const { data: perfil } = await supa.from("profiles").select("role, full_name").eq("id", usuario.id).maybeSingle();
        ehMentor = perfil?.role === "admin";
        if (perfil?.full_name) nome = perfil.full_name;
      }
      const codigo = Deno.env.get("MENTOR_CODIGO");
      if (!ehMentor && codigo && typeof codigoMentor === "string" && iguais(codigoMentor, codigo)) ehMentor = true;
      if (!ehMentor) return resposta(req, { erro: "Código do mentor inválido." }, 403);
    } else if (usuario && supa) {
      const { data: perfil } = await supa.from("profiles").select("full_name").eq("id", usuario.id).maybeSingle();
      if (perfil?.full_name) nome = perfil.full_name;
      const { data: sessao } = await supa.from("live_sessions").select("course_id").eq("room_name", sala).maybeSingle();
      if (sessao) {
        const { data: mat } = await supa.from("enrollments").select("id")
          .eq("user_id", usuario.id).eq("course_id", sessao.course_id).eq("status", "active").maybeSingle();
        if (!mat) return resposta(req, { erro: "Sua inscrição neste curso não está ativa." }, 403);
      }
    } else if (Deno.env.get("PERMITIR_ALUNO_SEM_LOGIN") !== "true") {
      return resposta(req, { erro: "Faça login para entrar no encontro." }, 401);
    }

    const papelFinal = ehMentor ? "mentor" : "aluno";
    const identidade = usuario?.id ?? `${papelFinal}-${crypto.randomUUID().slice(0, 8)}`;
    const at = new AccessToken(variavel("LIVEKIT_API_KEY"), variavel("LIVEKIT_API_SECRET"), {
      identity: identidade,
      name: nome,
      ttl: "4h",
      attributes: { papel: papelFinal },
    });
    at.addGrant({
      room: sala,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: ehMentor,
      roomRecord: ehMentor,
    });

    return resposta(req, { token: await at.toJwt(), url: variavel("LIVEKIT_URL"), identidade, papel: papelFinal });
  } catch (e) {
    console.error(e);
    if (e instanceof ErroConfig) return resposta(req, { erro: e.message }, 500);
    return resposta(req, { erro: "Não foi possível liberar o acesso à sala." }, 500);
  }
});
