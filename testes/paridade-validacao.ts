// Confere que assets/apresentacao.js (navegador) e supabase/functions/_shared/apresentacao.ts (servidor)
// limpam as apresentações do mesmo jeito.
//
//   deno run --allow-read testes/paridade-validacao.ts

import { validar as validarServidor } from "../supabase/functions/_shared/apresentacao.ts";

// deno-lint-ignore no-explicit-any
(globalThis as any).window = globalThis;
await import("../assets/apresentacao.js");
// deno-lint-ignore no-explicit-any
const validarNavegador = (globalThis as any).NoirApresentacao.validar as (x: unknown) => unknown;

const fixos: unknown[] = [
  null, 5, "x", {}, { slides: [] }, { slides: [null, 3] },
  { titulo: "  Negociação   e influência ", slides: [{ layout: "capa", titulo: "Oi", subtitulo: "Sub" }] },
  { slides: [{ layout: "numero", titulo: "Sem número" }, { layout: "numero", numero: { valor: 42, legenda: "x" } }] },
  { slides: [{ layout: "grafico", grafico: { dados: [{ rotulo: "a", valor: "3" }, { rotulo: "", valor: 1 }, { rotulo: "b", valor: "abc" }] } }] },
  { slides: [{ layout: "duas-colunas", colunas: [{ titulo: "A", itens: ["1"] }] }, { layout: "duas-colunas", colunas: [{ titulo: "A" }, { itens: ["x", 2, null] }] }] },
  { slides: [{ layout: "citacao", citacao: { texto: "" } }, { layout: "inventado", id: "<b>", titulo: "<img src=x>" }] },
  { slides: [{}] },
  { slides: Array.from({ length: 40 }, (_, i) => ({ id: "x" + i, titulo: "t".repeat(300), itens: Array(20).fill("i".repeat(400)) })) },
];

// Entradas aleatórias, com tipos errados de propósito.
let semente = 7;
const rnd = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const escolha = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const valorQualquer = (): unknown => escolha<() => unknown>([
  () => "texto " + "abc ".repeat(Math.floor(rnd() * 60)), () => Math.floor(rnd() * 1000) - 100, () => null, () => undefined,
  () => [], () => ["a", 1, null, "  b  "], () => ({}), () => true, () => "", () => NaN,
])();
for (let n = 0; n < 400; n++) {
  const slides = Array.from({ length: Math.floor(rnd() * 6) }, () => ({
    id: escolha([undefined, "ok", "s1", "a b", "muito-longo-".repeat(4), 5]),
    layout: escolha(["capa", "topicos", "duas-colunas", "numero", "citacao", "grafico", "passos", "encerramento", "outro", 3]),
    titulo: valorQualquer(), subtitulo: valorQualquer(), itens: escolha([valorQualquer(), Array.from({ length: 10 }, valorQualquer)]),
    colunas: escolha([undefined, [{ titulo: valorQualquer(), itens: [valorQualquer()] }, { titulo: valorQualquer(), itens: valorQualquer() }], valorQualquer()]),
    numero: escolha([undefined, { valor: valorQualquer(), legenda: valorQualquer() }]),
    citacao: escolha([undefined, { texto: valorQualquer(), autor: valorQualquer() }]),
    grafico: escolha([undefined, { unidade: valorQualquer(), dados: Array.from({ length: 10 }, () => ({ rotulo: valorQualquer(), valor: valorQualquer() })) }]),
    notas: valorQualquer(),
  }));
  fixos.push({ titulo: valorQualquer(), slides });
}

const resultado = (f: (x: unknown) => unknown, x: unknown) => {
  try { return JSON.stringify(f(structuredClone(x))).replace(/"id":"[^"]*-[a-z0-9]{3}"/g, '"id":"(repetido)"'); }
  catch (e) { return "ERRO: " + (e as Error).message; }
};
let falhas = 0;
fixos.forEach((x, i) => {
  const a = resultado(validarNavegador, x), b = resultado(validarServidor, x);
  if (a !== b) { falhas++; if (falhas <= 3) console.error(`Diferença no caso ${i}:\n navegador: ${a.slice(0, 300)}\n servidor:  ${b.slice(0, 300)}`); }
});
console.log(`${fixos.length} casos, ${falhas} diferenças.`);
if (falhas) Deno.exit(1);
