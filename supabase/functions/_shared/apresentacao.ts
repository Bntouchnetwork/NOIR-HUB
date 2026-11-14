// Formato de apresentação do Noir Hub (noir.apresentacao v1) e o contrato com os motores de IA.
//
// IMPORTANTE: as regras de validar() existem também em assets/apresentacao.js (navegador).
// Mude as duas juntas. O teste testes/paridade-validacao.ts compara as duas.

export const FORMATO = "noir.apresentacao";
export const VERSAO = 1;
export const LAYOUTS = ["capa", "topicos", "duas-colunas", "numero", "citacao", "grafico", "passos", "encerramento"] as const;
export type Layout = typeof LAYOUTS[number];

export const LIMITES = {
  slides: 30, titulo: 120, subtitulo: 200, itens: 8, item: 160, colItens: 6, colItem: 120, colTitulo: 60,
  valor: 16, legenda: 140, citacao: 280, autor: 80, dados: 8, rotulo: 40, unidade: 12, notas: 600,
} as const;

export interface Slide {
  id: string;
  layout: Layout;
  titulo?: string;
  subtitulo?: string;
  itens?: string[];
  colunas?: { titulo: string; itens: string[] }[];
  numero?: { valor: string; legenda: string };
  citacao?: { texto: string; autor: string };
  grafico?: { tipo: "barras"; unidade: string; dados: { rotulo: string; valor: number }[] };
  notas?: string;
}
export interface Apresentacao { formato: typeof FORMATO; versao: typeof VERSAO; titulo: string; slides: Slide[] }

// deno-lint-ignore no-explicit-any
type Qualquer = any;
const txt = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max)
    : typeof v === "number" && isFinite(v) ? String(v).slice(0, max) : "";
const lista = (v: unknown, n: number, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => txt(x, max)).filter(Boolean).slice(0, n) : [];

export class ApresentacaoInvalida extends Error {}

/** Limpa e valida. Devolve sempre uma apresentação segura para desenhar, ou lança ApresentacaoInvalida. */
export function validar(e: Qualquer): Apresentacao {
  if (!e || typeof e !== "object") throw new ApresentacaoInvalida("Apresentação inválida.");
  const brutos: Qualquer[] = Array.isArray(e.slides) ? e.slides.slice(0, LIMITES.slides) : [];
  const usados = new Set<string>();
  const slides = brutos.filter((s) => s && typeof s === "object").map((s, i): Slide => {
    let id = typeof s.id === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(s.id) ? s.id : "s" + (i + 1);
    while (usados.has(id)) id = id.slice(0, 20) + "-" + Math.random().toString(36).slice(2, 5);
    usados.add(id);
    const o: Slide = { id, layout: (LAYOUTS as readonly string[]).includes(s.layout) ? s.layout : "topicos" };
    const t = txt(s.titulo, LIMITES.titulo); if (t) o.titulo = t;
    const st = txt(s.subtitulo, LIMITES.subtitulo); if (st) o.subtitulo = st;
    const it = lista(s.itens, LIMITES.itens, LIMITES.item); if (it.length) o.itens = it;
    if (Array.isArray(s.colunas)) {
      const cols = s.colunas.slice(0, 2)
        .map((c: Qualquer) => ({ titulo: txt(c?.titulo, LIMITES.colTitulo), itens: lista(c?.itens, LIMITES.colItens, LIMITES.colItem) }))
        .filter((c: { titulo: string; itens: string[] }) => c.titulo || c.itens.length);
      if (cols.length === 2) o.colunas = cols;
    }
    if (s.numero && typeof s.numero === "object") {
      const v = txt(s.numero.valor, LIMITES.valor);
      if (v) o.numero = { valor: v, legenda: txt(s.numero.legenda, LIMITES.legenda) };
    }
    if (s.citacao && typeof s.citacao === "object") {
      const c = txt(s.citacao.texto, LIMITES.citacao);
      if (c) o.citacao = { texto: c, autor: txt(s.citacao.autor, LIMITES.autor) };
    }
    if (s.grafico && typeof s.grafico === "object" && Array.isArray(s.grafico.dados)) {
      const dados = s.grafico.dados.slice(0, LIMITES.dados)
        .map((d: Qualquer) => ({ rotulo: txt(d?.rotulo, LIMITES.rotulo), valor: Number(d?.valor) }))
        .filter((d: { rotulo: string; valor: number }) => d.rotulo && isFinite(d.valor));
      if (dados.length) o.grafico = { tipo: "barras", unidade: txt(s.grafico.unidade, LIMITES.unidade), dados };
    }
    const n = txt(s.notas, LIMITES.notas); if (n) o.notas = n;
    const falta = ({ "duas-colunas": !o.colunas, numero: !o.numero, citacao: !o.citacao, grafico: !o.grafico } as Record<string, boolean>)[o.layout];
    if (falta) o.layout = "topicos";
    if (!o.titulo && !o.itens && !o.numero && !o.citacao && !o.grafico && !o.colunas && !o.subtitulo) o.titulo = "Slide " + (i + 1);
    return o;
  });
  if (!slides.length) throw new ApresentacaoInvalida("A apresentação precisa de pelo menos um slide.");
  return { formato: FORMATO, versao: VERSAO, titulo: txt(e.titulo, LIMITES.titulo) || "Apresentação", slides };
}

/* ---------------- contrato com os motores de IA ---------------- */

export interface ContextoEncontro {
  idioma: "pt-BR";
  encontro: string;
  transcricao: { nome: string; texto: string }[];
  enquetes: { pergunta: string; resultados: { opcao: string; votos: number }[] }[];
}

/** O que todo motor recebe. É o mesmo corpo enviado à API da Endeavor (docs/CONTRATO-MOTOR-IA.md). */
export interface PedidoAssistente {
  instrucao: string;
  apresentacao: Apresentacao | null;
  slideAtual: number;
  contexto: ContextoEncontro;
}

/** O que todo motor devolve (antes da validação). */
export interface RespostaMotor {
  apresentacao: unknown;
  mensagem: string;
  foco?: number;
}

/** JSON Schema da apresentação, usado como esquema da ferramenta do Claude e publicado no contrato. */
const textoArr = (max: number, item: number) => ({ type: "array", maxItems: max, items: { type: "string", maxLength: item } });
export const ESQUEMA_APRESENTACAO = {
  type: "object",
  required: ["titulo", "slides"],
  properties: {
    titulo: { type: "string", maxLength: LIMITES.titulo },
    slides: {
      type: "array", minItems: 1, maxItems: LIMITES.slides,
      items: {
        type: "object",
        required: ["id", "layout"],
        properties: {
          id: { type: "string", description: "Identificador curto (letras, números, - ou _). Mantenha o id dos slides que não mudaram." },
          layout: { type: "string", enum: [...LAYOUTS] },
          titulo: { type: "string", maxLength: LIMITES.titulo },
          subtitulo: { type: "string", maxLength: LIMITES.subtitulo },
          itens: { ...textoArr(LIMITES.itens, LIMITES.item), description: "Tópicos (layouts topicos, passos; opcional em capa/encerramento)." },
          colunas: {
            type: "array", minItems: 2, maxItems: 2, description: "Só no layout duas-colunas.",
            items: { type: "object", required: ["titulo", "itens"], properties: { titulo: { type: "string", maxLength: LIMITES.colTitulo }, itens: textoArr(LIMITES.colItens, LIMITES.colItem) } },
          },
          numero: { type: "object", required: ["valor"], description: "Só no layout numero.", properties: { valor: { type: "string", maxLength: LIMITES.valor }, legenda: { type: "string", maxLength: LIMITES.legenda } } },
          citacao: { type: "object", required: ["texto"], description: "Só no layout citacao.", properties: { texto: { type: "string", maxLength: LIMITES.citacao }, autor: { type: "string", maxLength: LIMITES.autor } } },
          grafico: {
            type: "object", required: ["dados"], description: "Só no layout grafico (barras horizontais).",
            properties: {
              unidade: { type: "string", maxLength: LIMITES.unidade },
              dados: { type: "array", minItems: 1, maxItems: LIMITES.dados, items: { type: "object", required: ["rotulo", "valor"], properties: { rotulo: { type: "string", maxLength: LIMITES.rotulo }, valor: { type: "number" } } } },
            },
          },
          notas: { type: "string", maxLength: LIMITES.notas, description: "Anotações só para o mentor." },
        },
      },
    },
  },
} as const;

/** Limita o tamanho do que chega do navegador antes de mandar ao motor. */
// deno-lint-ignore no-explicit-any
export function montarPedido(d: any): PedidoAssistente {
  const instrucao = txt(d?.instrucao, 2000);
  let apresentacao: Apresentacao | null = null;
  if (d?.apresentacao) { try { apresentacao = validar(d.apresentacao); } catch { apresentacao = null; } }
  const total = apresentacao?.slides.length ?? 0;
  const slideAtual = Math.min(Math.max(Math.trunc(Number(d?.slideAtual) || 0), 0), Math.max(total - 1, 0));
  const c = d?.contexto ?? {};
  return {
    instrucao,
    apresentacao,
    slideAtual,
    contexto: {
      idioma: "pt-BR",
      encontro: txt(c.encontro, 160),
      transcricao: (Array.isArray(c.transcricao) ? c.transcricao : []).slice(-80)
        .map((l: Qualquer) => ({ nome: txt(l?.nome, 60), texto: txt(l?.texto, 300) })).filter((l: { texto: string }) => l.texto),
      enquetes: (Array.isArray(c.enquetes) ? c.enquetes : []).slice(-10).map((q: Qualquer) => ({
        pergunta: txt(q?.pergunta, 140),
        resultados: (Array.isArray(q?.resultados) ? q.resultados : []).slice(0, 4)
          .map((r: Qualquer) => ({ opcao: txt(r?.opcao, 60), votos: Math.max(0, Math.trunc(Number(r?.votos) || 0)) })),
      })).filter((q: { pergunta: string }) => q.pergunta),
    },
  };
}
