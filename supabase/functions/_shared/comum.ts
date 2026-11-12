// Utilidades compartilhadas pelas funções do LiveKit.

const origens = (Deno.env.get("ORIGENS_PERMITIDAS") ?? "*").split(",").map((o) => o.trim());

export function cabecalhos(req: Request): Record<string, string> {
  const origem = req.headers.get("Origin") ?? "";
  const permitida = origens.includes("*") ? "*" : origens.includes(origem) ? origem : origens[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function resposta(req: Request, dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...cabecalhos(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function variavel(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new ErroConfig(`A variável ${nome} não está configurada no Supabase.`);
  return v;
}

export class ErroConfig extends Error {}

/** wss://projeto.livekit.cloud -> https://projeto.livekit.cloud (API de servidor) */
export const hostLiveKit = () => variavel("LIVEKIT_URL").replace(/^ws(s?):\/\//, "http$1://");

/** Nome de sala aceito: minúsculas, números e hífen, de 3 a 64 caracteres. */
export const salaValida = (s: unknown): s is string =>
  typeof s === "string" && /^[a-z0-9][a-z0-9-]{2,63}$/.test(s);

/** Comparação em tempo constante para o código do mentor. */
export function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}
