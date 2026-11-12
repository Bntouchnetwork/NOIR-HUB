// livekit-webhook: recebe os avisos do LiveKit.
// Quando uma gravação termina (egress_ended), salva o vídeo em `recordings`,
// e ele aparece no admin em "Live para gravado".
//
// No painel do LiveKit Cloud: Settings > Webhooks > URL desta função.
// Variáveis: LIVEKIT_API_KEY, LIVEKIT_API_SECRET.

import { WebhookReceiver } from "npm:livekit-server-sdk@2.19.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { variavel } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });

  const receptor = new WebhookReceiver(variavel("LIVEKIT_API_KEY"), variavel("LIVEKIT_API_SECRET"));
  let evento;
  try {
    // Confere a assinatura: só o LiveKit consegue chamar esta função.
    evento = await receptor.receive(await req.text(), req.headers.get("Authorization") ?? undefined);
  } catch {
    return new Response("Assinatura inválida.", { status: 401 });
  }

  if (evento.event !== "egress_ended" || !evento.egressInfo) return new Response("ok");

  const info = evento.egressInfo;
  const arquivo = info.fileResults?.[0];
  if (!arquivo?.filename) return new Response("ok");

  const supa = createClient(variavel("SUPABASE_URL"), variavel("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: sessao } = await supa.from("live_sessions").select("id, title").eq("room_name", info.roomName).maybeSingle();

  // A duração vem em nanossegundos.
  const segundos = arquivo.duration ? Math.round(Number(arquivo.duration) / 1e9) : null;
  const { error } = await supa.from("recordings").upsert({
    egress_id: info.egressId,
    live_session_id: sessao?.id ?? null,
    title: sessao?.title ?? info.roomName,
    video_path: arquivo.filename,
    duration_seconds: segundos,
  }, { onConflict: "egress_id" });

  if (error) {
    console.error(error);
    return new Response("Erro ao salvar a gravação.", { status: 500 });
  }
  return new Response("ok");
});
