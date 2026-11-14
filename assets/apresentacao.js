/* Noir Hub · apresentações do assistente de IA
 *
 * window.NoirApresentacao = {
 *   validar(obj)                    -> apresentação limpa (formato noir.apresentacao v1) ou erro
 *   renderizar(slide, {numero,total}) -> elemento .slide (16:9, escala sozinho)
 *   motorDemonstracao()             -> motor offline, sem rede
 *   motorServidor({url, token, chaveAnon, sala}) -> motor que chama a função assistente-ia
 * }
 *
 * Todo motor tem a mesma forma:
 *   gerar({ instrucao, apresentacao, slideAtual, contexto }) -> { apresentacao, mensagem, foco?, motor }
 *
 * IMPORTANTE: as regras de validar() existem também em supabase/functions/_shared/apresentacao.ts.
 * Mude as duas juntas. O teste testes/paridade-validacao.ts compara as duas.
 */
(function () {
  "use strict";

  const FORMATO = "noir.apresentacao", VERSAO = 1;
  const LAYOUTS = ["capa", "topicos", "duas-colunas", "numero", "citacao", "grafico", "passos", "encerramento"];
  const LIMITES = { slides: 30, titulo: 120, subtitulo: 200, itens: 8, item: 160, colItens: 6, colItem: 120, colTitulo: 60, valor: 16, legenda: 140, citacao: 280, autor: 80, dados: 8, rotulo: 40, unidade: 12, notas: 600 };

  /* ---------------- validação ---------------- */
  const txt = (v, max) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : (typeof v === "number" && isFinite(v) ? String(v).slice(0, max) : "");
  const lista = (v, n, max) => Array.isArray(v) ? v.map(x => txt(x, max)).filter(Boolean).slice(0, n) : [];

  function validar(e) {
    if (!e || typeof e !== "object") throw new Error("Apresentação inválida.");
    const brutos = Array.isArray(e.slides) ? e.slides.slice(0, LIMITES.slides) : [];
    const usados = new Set();
    const slides = brutos.filter(s => s && typeof s === "object").map((s, i) => {
      let id = typeof s.id === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(s.id) ? s.id : "s" + (i + 1);
      while (usados.has(id)) id = id.slice(0, 20) + "-" + Math.random().toString(36).slice(2, 5);
      usados.add(id);
      const o = { id, layout: LAYOUTS.includes(s.layout) ? s.layout : "topicos" };
      const t = txt(s.titulo, LIMITES.titulo); if (t) o.titulo = t;
      const st = txt(s.subtitulo, LIMITES.subtitulo); if (st) o.subtitulo = st;
      const it = lista(s.itens, LIMITES.itens, LIMITES.item); if (it.length) o.itens = it;
      if (Array.isArray(s.colunas)) {
        const cols = s.colunas.slice(0, 2).map(c => ({ titulo: txt(c && c.titulo, LIMITES.colTitulo), itens: lista(c && c.itens, LIMITES.colItens, LIMITES.colItem) })).filter(c => c.titulo || c.itens.length);
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
          .map(d => ({ rotulo: txt(d && d.rotulo, LIMITES.rotulo), valor: Number(d && d.valor) }))
          .filter(d => d.rotulo && isFinite(d.valor));
        if (dados.length) o.grafico = { tipo: "barras", unidade: txt(s.grafico.unidade, LIMITES.unidade), dados };
      }
      const n = txt(s.notas, LIMITES.notas); if (n) o.notas = n;
      // um layout sem o conteúdo que ele precisa vira tópicos
      const falta = { "duas-colunas": !o.colunas, numero: !o.numero, citacao: !o.citacao, grafico: !o.grafico }[o.layout];
      if (falta) o.layout = "topicos";
      if (!o.titulo && !o.itens && !o.numero && !o.citacao && !o.grafico && !o.colunas && !o.subtitulo) o.titulo = "Slide " + (i + 1);
      return o;
    });
    if (!slides.length) throw new Error("A apresentação precisa de pelo menos um slide.");
    return { formato: FORMATO, versao: VERSAO, titulo: txt(e.titulo, LIMITES.titulo) || "Apresentação", slides };
  }

  /** Cópia sem as anotações do mentor, para enviar aos alunos. */
  const semNotas = ap => ({ ...ap, slides: ap.slides.map(({ notas, ...s }) => s) });

  /* ---------------- renderização ---------------- */
  const MARCA = '<span class="sl-marca" aria-hidden="true"><span class="noir-mark"><span class="noir-no"><b>NO</b><i></i></span><span class="noir-ir"><i></i><b>IR</b></span></span></span>';
  const REDE = '<svg class="sl-rede" viewBox="0 0 400 300" aria-hidden="true"><g stroke="currentColor" stroke-width="1.2"><line x1="40" y1="60" x2="130" y2="40"/><line x1="130" y1="40" x2="210" y2="110"/><line x1="40" y1="60" x2="90" y2="160"/><line x1="90" y1="160" x2="210" y2="110"/><line x1="210" y1="110" x2="320" y2="70"/><line x1="210" y1="110" x2="260" y2="210"/><line x1="90" y1="160" x2="170" y2="250"/><line x1="170" y1="250" x2="260" y2="210"/><line x1="260" y1="210" x2="360" y2="190"/><line x1="320" y1="70" x2="360" y2="190"/></g><g fill="currentColor"><circle cx="40" cy="60" r="5"/><circle cx="130" cy="40" r="4"/><circle cx="210" cy="110" r="7"/><circle cx="90" cy="160" r="4"/><circle cx="320" cy="70" r="5"/><circle cx="260" cy="210" r="6"/><circle cx="170" cy="250" r="4"/><circle cx="360" cy="190" r="4"/></g></svg>';

  function h(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null && texto !== "") e.textContent = texto;
    return e;
  }
  const fmt = v => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  function renderizar(slide, op = {}) {
    const numero = op.numero || 1, total = op.total || 1;
    const s = h("div", "slide lay-" + slide.layout);
    s.setAttribute("role", "group");
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", `Slide ${numero} de ${total}${slide.titulo ? ": " + slide.titulo : ""}`);
    const d = h("div", "slide-in");
    s.appendChild(d);
    const titulo = cls => slide.titulo && d.appendChild(h("h2", cls || "sl-titulo", slide.titulo));
    const sub = () => slide.subtitulo && d.appendChild(h("p", "sl-sub", slide.subtitulo));
    const regua = () => d.appendChild(h("i", "sl-regua"));
    const itens = (arr, cls) => { const ul = h("ul", cls || "sl-itens"); arr.forEach(t => ul.appendChild(h("li", "", t))); return ul; };

    switch (slide.layout) {
      case "capa":
      case "encerramento":
        d.insertAdjacentHTML("beforeend", REDE);
        if (slide.layout === "encerramento") d.insertAdjacentHTML("beforeend", MARCA.replace("sl-marca", "sl-marca grande"));
        titulo("sl-titulo grande"); regua(); sub();
        if (slide.itens) d.appendChild(itens(slide.itens, "sl-itens compacto"));
        break;
      case "numero":
        titulo("sl-kicker");
        d.appendChild(h("p", "sl-numero", slide.numero.valor));
        if (slide.numero.legenda) d.appendChild(h("p", "sl-legenda", slide.numero.legenda));
        sub();
        break;
      case "citacao": {
        d.appendChild(h("span", "sl-aspas", "“"));
        d.appendChild(h("blockquote", "sl-citacao", slide.citacao.texto));
        if (slide.citacao.autor) d.appendChild(h("p", "sl-autor", slide.citacao.autor));
        if (slide.titulo) d.insertBefore(h("p", "sl-kicker", slide.titulo), d.firstChild);
        break;
      }
      case "duas-colunas": {
        titulo(); sub(); regua();
        const g = h("div", "sl-colunas");
        slide.colunas.forEach(c => { const col = h("div", "sl-coluna"); if (c.titulo) col.appendChild(h("h3", "", c.titulo)); if (c.itens.length) col.appendChild(itens(c.itens)); g.appendChild(col); });
        d.appendChild(g);
        break;
      }
      case "grafico": {
        titulo(); sub();
        const g = slide.grafico, max = Math.max(...g.dados.map(x => Math.abs(x.valor)), 1e-9);
        const tab = h("div", "sl-grafico");
        tab.setAttribute("role", "list");
        g.dados.forEach(x => {
          const linha = h("div", "sl-barra"); linha.setAttribute("role", "listitem");
          linha.appendChild(h("span", "sl-rot", x.rotulo));
          const trilho = h("span", "sl-trilho"), b = h("b"); b.style.width = Math.max(0, x.valor) / max * 100 + "%"; trilho.appendChild(b);
          linha.appendChild(trilho);
          linha.appendChild(h("span", "sl-val", fmt(x.valor) + (g.unidade ? " " + g.unidade : "")));
          tab.appendChild(linha);
        });
        d.appendChild(tab);
        break;
      }
      case "passos": {
        titulo(); sub();
        const ol = h("ol", "sl-passos");
        (slide.itens || []).slice(0, 6).forEach((t, i) => { const li = h("li"); li.appendChild(h("span", "sl-n", String(i + 1))); li.appendChild(h("span", "", t)); ol.appendChild(li); });
        d.appendChild(ol);
        break;
      }
      default:
        titulo(); sub(); regua();
        if (slide.itens) d.appendChild(itens(slide.itens));
    }
    const rodape = h("div", "sl-rodape");
    rodape.innerHTML = (slide.layout === "encerramento" ? "" : MARCA) + `<span class="sl-pag">${Number(numero)} / ${Number(total)}</span>`;
    s.appendChild(rodape);
    return s;
  }

  /* ---------------- motor de demonstração ---------------- */
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
  let seq = 0;
  const novoIdSlide = () => "d" + Date.now().toString(36).slice(-4) + (++seq);
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const capitalizar = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function temaDe(instrucao, contexto) {
    const m = instrucao.match(/sobre\s+(.+?)(?:\s+com\s+\S+\s+slides?|\s+em\s+\S+\s+slides?|[.!?]|$)/i);
    if (m && m[1].trim().length > 2) return capitalizar(m[1].trim().replace(/^(o|a|os|as)\s+tema\s+do\s+encontro$/i, "").trim()) || temaEncontro(contexto);
    return temaEncontro(contexto);
  }
  const temaEncontro = c => (c && c.encontro ? c.encontro.replace(/^encontro\s*\d+\s*:\s*/i, "") : "") || "Comunicação e network";
  function quantos(n) {
    const m = n.match(/(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+slides?/);
    if (!m) return 5;
    return Math.min(10, Math.max(3, Number(m[1]) || NUMEROS[m[1]] || 5));
  }
  function qualSlide(n, atual, total) {
    if (/(este|esse|deste|desse|neste|nesse)\s+slide|slide\s+atual/.test(n)) return atual;
    if (/(ultimo)\s+slide|slide\s+final/.test(n)) return total - 1;
    if (/(primeiro)\s+slide/.test(n)) return 0;
    const m = n.match(/slide\s+(\d+)/); if (m) return Math.min(total - 1, Math.max(0, Number(m[1]) - 1));
    return atual;
  }
  function depoisDe(original, palavra) {
    const i = norm(original).lastIndexOf(palavra);
    return i < 0 ? "" : original.slice(i + palavra.length).trim().replace(/^[:"“'\s]+|["”'.\s]+$/g, "");
  }
  function slideEnquete(contexto) {
    const q = (contexto.enquetes || []).filter(x => x.resultados && x.resultados.some(r => r.votos > 0)).slice(-1)[0];
    if (!q) return null;
    return { id: novoIdSlide(), layout: "grafico", titulo: q.pergunta, subtitulo: "Resultado da enquete da turma", grafico: { unidade: "votos", dados: q.resultados.map(r => ({ rotulo: r.opcao, valor: r.votos })) } };
  }
  function deckSobre(tema, n, contexto) {
    const falas = (contexto.transcricao || []).filter(l => String(l.texto).split(" ").length >= 6);
    const pool = [
      { layout: "topicos", titulo: `${tema} na prática`, itens: ["Clareza sobre o objetivo antes de começar", "Escuta ativa para entender o outro lado", "Argumentos ligados ao que o outro valoriza", "Um próximo passo combinado no final"] },
      { layout: "passos", titulo: "Como aplicar esta semana", itens: ["Escolha uma situação real", "Prepare três perguntas", "Pratique com um colega da turma", "Registre o resultado"] },
      { layout: "duas-colunas", titulo: "Antes e depois", colunas: [{ titulo: "Antes", itens: ["Fala sem roteiro", "Foco no próprio produto", "Termina sem combinado"] }, { titulo: "Depois", itens: ["Estrutura clara", "Foco no valor para o outro", "Próximo passo definido"] }] },
      falas[0] ? { layout: "citacao", titulo: "Dito no encontro", citacao: { texto: falas[falas.length - 1].texto, autor: falas[falas.length - 1].nome } } : null,
      slideEnquete(contexto),
      { layout: "topicos", titulo: "Erros comuns", itens: ["Falar mais do que ouvir", "Responder antes de entender a pergunta", "Deixar o próximo passo no ar"] },
      { layout: "topicos", titulo: "Perguntas para a turma", itens: ["Onde isso apareceu na sua semana?", "O que você faria diferente?", "Qual conexão pode ajudar você agora?"] },
      { layout: "passos", titulo: "Roteiro de uma boa conversa", itens: ["Abertura", "Perguntas", "Proposta", "Combinado"] }
    ].filter(Boolean);
    const meio = pool.slice(0, Math.max(1, n - 2));
    return [
      { layout: "capa", titulo: tema, subtitulo: "Projeto N.O.I.R. · " + (contexto.encontro || "Encontro ao vivo") },
      ...meio,
      { layout: "encerramento", titulo: "Próximos passos", subtitulo: "Leve uma ação prática para a sua semana." }
    ].slice(0, n).map(s => ({ id: novoIdSlide(), ...s }));
  }

  const AJUDA = "No modo demonstração eu entendo pedidos como: “crie 5 slides sobre negociação”, “transforme o que foi falado em slides”, “adicione um slide sobre objeções”, “mude o título do slide 2 para …”, “remova o slide 3”, “mova o slide 4 para a posição 2”, “deixe este slide mais curto”, “mostre o resultado da enquete”.";

  function motorDemonstracao() {
    return {
      nome: "demonstracao",
      async gerar({ instrucao, apresentacao, slideAtual = 0, contexto = {} }) {
        await espera(500);
        const n = norm(instrucao);
        const ap = apresentacao ? JSON.parse(JSON.stringify(apresentacao)) : null;
        const total = ap ? ap.slides.length : 0;
        const pronto = (doc, mensagem, foco) => ({ apresentacao: validar(doc), mensagem, foco, motor: "demonstracao" });

        if (/(o que foi falado|o que falamos|o que a gente falou|da conversa|da transcricao|das falas)/.test(n)) {
          const falas = (contexto.transcricao || []).filter(l => String(l.texto).split(" ").length >= 5).slice(-6);
          if (!falas.length) return { apresentacao: ap, mensagem: "Ainda não há falas transcritas. Ligue as legendas no menu Mais e tente de novo.", motor: "demonstracao" };
          const novo = { id: novoIdSlide(), layout: "topicos", titulo: "O que a turma trouxe", itens: falas.map(l => `${l.nome}: ${l.texto}`) };
          if (!ap) return pronto({ titulo: temaEncontro(contexto), slides: [{ id: novoIdSlide(), layout: "capa", titulo: temaEncontro(contexto), subtitulo: "Resumo ao vivo" }, novo] }, "Criei uma apresentação com as falas mais recentes.", 1);
          ap.slides.splice(slideAtual + 1, 0, novo);
          return pronto(ap, "Adicionei um slide com as falas mais recentes.", slideAtual + 1);
        }
        if (/enquete/.test(n)) {
          const s = slideEnquete(contexto);
          if (!s) return { apresentacao: ap, mensagem: "Ainda não há enquete com votos neste encontro.", motor: "demonstracao" };
          if (!ap) return pronto({ titulo: s.titulo, slides: [s] }, "Montei um slide com o resultado da última enquete.", 0);
          ap.slides.splice(slideAtual + 1, 0, s);
          return pronto(ap, "Adicionei o resultado da última enquete.", slideAtual + 1);
        }
        if (!ap || /(cri[ae]|ger[ae]|mont[ae]|fa[cz]a|nova)\b.*(apresentacao|slides|deck)/.test(n)) {
          const tema = temaDe(instrucao, contexto), qtd = quantos(n);
          return pronto({ titulo: tema, slides: deckSobre(tema, qtd, contexto) }, `Criei ${qtd} slides sobre ${tema}. É conteúdo de exemplo do modo demonstração; com o motor de IA ligado, o texto é escrito sob medida.`, 0);
        }
        const i = qualSlide(n, slideAtual, total);
        if (/(remov|apag|exclu|tir[ae])/.test(n) && /slide/.test(n)) {
          if (total === 1) return { apresentacao: ap, mensagem: "A apresentação precisa ter pelo menos um slide.", motor: "demonstracao" };
          ap.slides.splice(i, 1);
          return pronto(ap, `Removi o slide ${i + 1}.`, Math.min(i, ap.slides.length - 1));
        }
        const mv = n.match(/mov\w*\s+(?:o\s+)?slide\s+(\d+)\s+para\s+(?:a\s+)?(?:posicao\s+)?(\d+)/);
        if (mv) {
          const de = Math.min(total - 1, Number(mv[1]) - 1), para = Math.min(total - 1, Math.max(0, Number(mv[2]) - 1));
          const [s] = ap.slides.splice(de, 1); ap.slides.splice(para, 0, s);
          return pronto(ap, `Movi o slide ${de + 1} para a posição ${para + 1}.`, para);
        }
        if (/titulo/.test(n) && /\bpara\b/.test(n)) {
          const novo = depoisDe(instrucao, " para ");
          if (!novo) return { apresentacao: ap, mensagem: "Diga o novo título depois de “para”.", motor: "demonstracao" };
          ap.slides[i].titulo = novo;
          if (i === 0) ap.titulo = novo;
          return pronto(ap, `Troquei o título do slide ${i + 1}.`, i);
        }
        if (/(mais curto|enxug|resum|menos texto|simplifi)/.test(n)) {
          const s = ap.slides[i];
          if (s.itens) s.itens = s.itens.slice(0, 3).map(t => t.split(" ").slice(0, 7).join(" "));
          if (s.subtitulo) delete s.subtitulo;
          if (s.colunas) s.colunas.forEach(c => c.itens = c.itens.slice(0, 2));
          return pronto(ap, `Deixei o slide ${i + 1} mais curto.`, i);
        }
        if (/(adicion|inclu|acrescent|cri[ae]|coloque|insira)/.test(n) && /slide/.test(n)) {
          const tema = depoisDe(instrucao, "sobre ") || "Próximos passos";
          const novo = { id: novoIdSlide(), layout: /passo|etapa|roteiro/.test(norm(tema)) ? "passos" : "topicos", titulo: capitalizar(tema), itens: ["Ponto principal", "Exemplo prático", "Ação para a semana"] };
          ap.slides.splice(i + 1, 0, novo);
          return pronto(ap, `Adicionei um slide sobre ${tema} depois do slide ${i + 1}. Edite os tópicos pedindo ao assistente.`, i + 1);
        }
        return { apresentacao: ap, mensagem: AJUDA, motor: "demonstracao" };
      }
    };
  }

  /* ---------------- motor do servidor (Claude hoje, Endeavor no futuro) ---------------- */
  function motorServidor({ url, token, chaveAnon, sala }) {
    async function chamar(corpo) {
      const cab = { "Content-Type": "application/json", Authorization: "Bearer " + (typeof token === "function" ? token() : token) };
      if (chaveAnon) cab.apikey = chaveAnon;
      let r;
      try { r = await fetch(url, { method: "POST", headers: cab, body: JSON.stringify({ sala, ...corpo }) }); }
      catch (e) { throw new Error("Sem conexão com o assistente. Verifique sua internet."); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "O assistente não respondeu agora. Tente de novo.");
      return j;
    }
    return {
      nome: "servidor",
      async gerar(pedido) {
        const j = await chamar({ acao: "gerar", ...pedido });
        return { apresentacao: validar(j.apresentacao), mensagem: String(j.mensagem || "Pronto."), foco: j.foco, motor: j.motor || "servidor" };
      },
      async ultima() {
        const j = await chamar({ acao: "ultima" });
        return j.apresentacao ? validar(j.apresentacao) : null;
      }
    };
  }

  window.NoirApresentacao = { FORMATO, VERSAO, LAYOUTS, validar, semNotas, renderizar, motorDemonstracao, motorServidor };
})();
