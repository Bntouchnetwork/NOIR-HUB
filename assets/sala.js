/* Noir Hub · sala ao vivo com LiveKit
 *
 * Uso: NoirSala.abrir({ sala, titulo, quando, nome, papel: "mentor" | "aluno",
 *                       gravarAoEntrar, onGravacao(info), onSair() })
 *
 * Com livekitUrl e tokenUrl preenchidos em config.js, conecta numa sala LiveKit real.
 * Sem eles, abre em modo demonstração: câmera, microfone e tela reais, demais participantes simulados.
 *
 * Ferramentas: enquetes, cronômetro de pitch, salas de networking, legendas ao vivo com
 * resumo do encontro, transmissão no YouTube/Instagram e fundo desfocado ou com a marca NOIR.
 */
(function () {
  "use strict";

  const CFG = Object.assign({ livekitUrl: "", tokenUrl: "", adminUrl: "", resumoUrl: "", supabaseAnonKey: "" }, window.NOIR_CONFIG || {});
  const modoReal = () => !!(CFG.livekitUrl && CFG.tokenUrl);
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL("assets/sala.js", location.href).href;
  const BASE = SCRIPT_SRC.replace(/sala\.js(\?.*)?$/, "");
  const SDK_SRC = BASE + "vendor/livekit-client.umd.js";
  const FUNDOS_SRC = BASE + "vendor/livekit-fundos.js";
  const MEDIAPIPE = BASE + "vendor/mediapipe";
  const IMG_NOIR = BASE + "img/fundo-noir.jpg";
  const enc = new TextEncoder(), dec = new TextDecoder();
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  let LK = null, el = null, S = null;

  /* ---------------- ícones ---------------- */
  const svg = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
  const I = {
    mic: svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>'),
    micOff: svg('<path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M19 10a7 7 0 0 1-1.1 3.8M5 10a7 7 0 0 0 11.4 5.4M12 17v5M3 3l18 18"/>'),
    cam: svg('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>'),
    camOff: svg('<path d="M16 16H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M10 6h4a2 2 0 0 1 2 2v4l6-3v10M3 3l18 18"/>'),
    tela: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4M9 10l3-3 3 3M12 7v7"/>'),
    mao: svg('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 8 8h1a7 7 0 0 0 7-7v-3a2 2 0 0 0-4 0"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
    pessoas: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3"/>'),
    rec: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'),
    encerrar: svg('<path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3.5-1.5V13c-2-1-4-1-6 0v3l-3.5 1.5z" fill="currentColor"/>'),
    sair: svg('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>'),
    mais: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
    cc: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/>'),
    enquete: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    relogio: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/>'),
    grupos: svg('<rect x="2" y="3" width="8" height="8" rx="2"/><rect x="14" y="3" width="8" height="8" rx="2"/><rect x="2" y="13" width="8" height="8" rx="2"/><rect x="14" y="13" width="8" height="8" rx="2"/>'),
    transmitir: svg('<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/>'),
    resumo: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
    fechar: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    slides: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="M14.5 6.8l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none"/>'),
    ant: svg('<path d="M15 18l-6-6 6-6"/>'),
    prox: svg('<path d="M9 18l6-6-6-6"/>'),
    desfazer: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    refazer: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    pdf: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
    enviarIc: svg('<path d="M4 12l16-8-6 16-2-7z"/>')
  };
  const LOGO = '<span class="noir" aria-label="Projeto N.O.I.R."><span class="noir-mark"><span class="noir-no"><b>NO</b><i></i></span><span class="noir-ir"><i></i><b>IR</b></span></span></span>';
  const ini = n => (n || "?").trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mmss = ms => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0"); };
  const novoId = () => Math.random().toString(36).slice(2, 10);
  const embaralhar = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function carregarScript(src, pronto) {
    if (pronto()) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src; s.onload = () => ok(); s.onerror = () => falha(new Error("Não foi possível carregar " + src.split("/").pop()));
      document.head.appendChild(s);
    });
  }
  const carregarSDK = () => carregarScript(SDK_SRC, () => !!window.LivekitClient).then(() => (LK = window.LivekitClient));
  const carregarFundos = () => carregarSDK().then(() => carregarScript(FUNDOS_SRC, () => !!window.NoirFundos));

  /* ---------------- estrutura ---------------- */
  function ctl(id, rotulo, icone, extra = "") {
    return `<button class="ctl ${extra}" id="${id}" type="button" aria-label="${rotulo}"><span class="bola">${icone}</span><span class="rt">${rotulo}</span><span class="badge" aria-hidden="true"></span></button>`;
  }
  function montar() {
    if (el) return;
    el = document.createElement("div");
    el.className = "sala"; el.id = "noirSala";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Sala ao vivo");
    el.innerHTML = `
<section class="sala-pre">
  <div>
    <div class="pre-video">
      <video id="sPreVideo" autoplay playsinline muted></video>
      <div class="sem-cam" id="sSemCam"><div class="avatar" id="sPreAvatar"></div><span id="sSemCamTxt">Câmera desligada</span></div>
      <div class="nivel" id="sNivel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="pre-toggles">${ctl("sPreMic", "Microfone", I.mic)}${ctl("sPreCam", "Câmera", I.cam)}</div>
    </div>
    <div class="pre-fundos" role="radiogroup" aria-label="Fundo da câmera">
      <span>Fundo</span>
      <button type="button" data-fundo="nenhum" class="sel">Nenhum</button>
      <button type="button" data-fundo="desfoque">Desfocado</button>
      <button type="button" data-fundo="noir"><img src="${IMG_NOIR.replace("fundo-noir.jpg", "fundo-noir-mini.jpg")}" alt="">NOIR</button>
    </div>
  </div>
  <div class="pre-form">
    <h2 id="sPreTitulo"></h2>
    <p class="quando" id="sPreQuando"></p>
    <label for="sNome">Seu nome na sala</label><input id="sNome" autocomplete="name" maxlength="60">
    <label for="sCamSel">Câmera</label><select id="sCamSel"></select>
    <label for="sMicSel">Microfone</label><select id="sMicSel"></select>
    <div id="sCodigoBox"><label for="sCodigo">Código do mentor</label><input id="sCodigo" type="password" autocomplete="off"></div>
    <label class="check" id="sGravarBox"><input type="checkbox" id="sGravarAo"> Iniciar a gravação ao entrar</label>
    <div class="pre-acoes"><button class="btn-sala" id="sEntrar" type="button">Entrar no encontro</button><button class="btn-sala vazado" id="sVoltar" type="button">Voltar</button></div>
    <div class="erro-sala" id="sErro" role="alert"></div>
    <div class="aviso-demo" id="sAvisoDemo"></div>
  </div>
</section>
<section class="sala-vivo">
  <header class="sala-topo">${LOGO}<div class="titulo-enc" id="sTitulo"></div>
    <div class="meta"><span class="selo-demo" id="sSeloDemo">Demonstração</span><span class="selo-tx" id="sTx">${I.transmitir}<span>Ao vivo nas redes</span></span><span class="selo-rec" id="sRec"><i></i><span>Gravando</span></span><span class="dur" id="sDur">00:00</span><span id="sQtd"></span></div>
  </header>
  <button class="btn-sala aviso-audio" id="sAudio" type="button">Ativar o áudio</button>
  <div class="sala-corpo">
    <main class="palco" id="sPalco">
      <div class="faixa-grupo" id="sGrupo" hidden></div>
      <div class="grade" id="sGrade"></div>
      <div class="crono" id="sCrono" hidden></div>
      <div class="cartao-enquete" id="sEnquete" hidden></div>
      <div class="legendas" id="sLegendas" aria-live="polite" hidden></div>
    </main>
    <aside class="lateral" id="sLateral" aria-label="Chat e participantes">
      <div class="abas" role="tablist"><button type="button" data-aba="chat" class="sel" role="tab">Chat</button><button type="button" data-aba="pessoas" role="tab">Participantes</button><button type="button" data-aba="slides" role="tab" class="aba-mentor">Slides</button><button type="button" class="fechar" id="sFecharLat" aria-label="Fechar painel">×</button></div>
      <div class="painel-l ativo" id="painelChat"><div class="msgs" id="sMsgs" aria-live="polite"><p class="vazio">As mensagens do encontro aparecem aqui.</p></div>
        <form class="enviar" id="sEnviar"><input id="sTexto" placeholder="Escreva uma mensagem" maxlength="500" autocomplete="off" aria-label="Mensagem"><button type="submit">Enviar</button></form></div>
      <div class="painel-l" id="painelPessoas"></div>
      <div class="painel-l" id="painelSlides">
        <div class="ap-rolagem" id="apRolagem">
          <div class="ap-topo"><span class="ap-estado" id="apEstado">Rascunho</span><span class="ap-motor" id="apMotor"></span></div>
          <div class="ap-previa" id="apPrevia"></div>
          <div class="ap-barra">
            <button type="button" class="ap-ic" id="apAnt" aria-label="Slide anterior">${I.ant}</button><span id="apPos" aria-live="polite">0 / 0</span><button type="button" class="ap-ic" id="apProx" aria-label="Próximo slide">${I.prox}</button>
            <span class="ap-sep"></span>
            <button type="button" class="ap-ic" id="apDesfazer" aria-label="Desfazer">${I.desfazer}</button><button type="button" class="ap-ic" id="apRefazer" aria-label="Refazer">${I.refazer}</button><button type="button" class="ap-ic" id="apPdf" aria-label="Baixar PDF">${I.pdf}</button>
          </div>
          <button type="button" class="btn-sala ap-vivo" id="apVivo">Apresentar para todos</button>
          <p class="ap-notas" id="apNotas" hidden></p>
          <div class="ap-minis" id="apMinis" role="listbox" aria-label="Slides"></div>
          <div class="ap-conversa" id="apConversa" aria-live="polite"></div>
        </div>
        <div class="ap-sugestoes" id="apSugestoes"></div>
        <form class="ap-form" id="apForm">
          <textarea id="apTexto" rows="2" maxlength="2000" placeholder="Peça uma apresentação ou uma mudança" aria-label="Pedido ao assistente"></textarea>
          <button type="button" class="ap-ic" id="apDitar" aria-label="Ditar o pedido">${I.mic}</button>
          <button type="submit" class="ap-ic ap-enviar" id="apEnviar" aria-label="Enviar pedido">${I.enviarIc}</button>
        </form>
      </div>
    </aside>
  </div>
  <div class="menu-sala" id="sMenu" role="menu" hidden>
    <p class="sub-l">Para você</p>
    <button type="button" role="menuitemcheckbox" data-f="legendas">${I.cc}<span>Legendas ao vivo</span><em id="sEstLeg"></em></button>
    <div class="menu-fundos" role="radiogroup" aria-label="Fundo da câmera">
      <span class="menu-rot">Fundo da câmera</span>
      <div><button type="button" data-fundo="nenhum" class="sel">Nenhum</button><button type="button" data-fundo="desfoque">Desfocado</button><button type="button" data-fundo="noir">NOIR</button></div>
    </div>
    <div class="menu-mentor">
      <p class="sub-l">Ferramentas do mentor</p>
      <button type="button" role="menuitem" data-f="assistente">${I.slides}<span>Assistente de apresentação</span><em id="sEstAp"></em></button>
      <button type="button" role="menuitem" data-f="enquete">${I.enquete}<span>Nova enquete</span></button>
      <button type="button" role="menuitem" data-f="cronometro">${I.relogio}<span>Cronômetro de pitch</span></button>
      <button type="button" role="menuitem" data-f="grupos">${I.grupos}<span>Salas de networking</span></button>
      <button type="button" role="menuitem" data-f="transmitir">${I.transmitir}<span>Transmitir ao vivo</span><em id="sEstTx"></em></button>
      <button type="button" role="menuitem" data-f="resumo">${I.resumo}<span>Resumo do encontro</span></button>
    </div>
  </div>
  <nav class="controles-sala" aria-label="Controles do encontro">
    ${ctl("sMic", "Microfone", I.mic)}${ctl("sCam", "Câmera", I.cam)}${ctl("sTela", "Tela", I.tela)}${ctl("sMao", "Mão", I.mao)}
    <span class="sep-ctl"></span>
    ${ctl("sChat", "Chat", I.chat)}${ctl("sPessoas", "Pessoas", I.pessoas)}${ctl("sMais", "Mais", I.mais)}
    <span class="sep-ctl so-mentor"></span>
    ${ctl("sGravar", "Gravar", I.rec, "so-mentor")}${ctl("sEncerrar", "Encerrar", I.encerrar, "so-mentor sair")}
    ${ctl("sSair", "Sair", I.sair)}
  </nav>
  <div class="modal-sala" id="sModal" hidden><div class="caixa-sala" role="dialog" aria-modal="true" aria-labelledby="sModalTit">
    <div class="cab-modal"><h3 id="sModalTit"></h3><button type="button" class="x" id="sModalX" aria-label="Fechar">${I.fechar}</button></div>
    <div class="corpo-modal" id="sModalCorpo"></div><div class="acoes-modal" id="sModalAcoes"></div></div></div>
  <div class="sala-fim" id="sFim"><div><h2 id="sFimTit">Encontro encerrado</h2><p id="sFimTxt"></p><button class="btn-sala" id="sFimOk" type="button">Voltar à plataforma</button></div></div>
  <div class="toast-sala" id="sToast" role="status"></div>
</section>
<div id="sAudios" hidden></div>`;
    document.body.appendChild(el);

    $("sPreMic").onclick = () => { S.micOn = !S.micOn; aplicarPreview(); };
    $("sPreCam").onclick = () => { S.camOn = !S.camOn; aplicarPreview(); };
    $("sCamSel").onchange = e => { S.camId = e.target.value; trocarDispositivoPreview("video"); };
    $("sMicSel").onchange = e => { S.micId = e.target.value; trocarDispositivoPreview("audio"); };
    $("sNome").oninput = e => { $("sPreAvatar").textContent = ini(e.target.value); };
    $("sEntrar").onclick = entrar;
    $("sVoltar").onclick = () => fechar();
    $("sMic").onclick = alternarMic;
    $("sCam").onclick = alternarCam;
    $("sTela").onclick = alternarTela;
    $("sMao").onclick = alternarMao;
    $("sChat").onclick = () => abrirLateral("chat");
    $("sPessoas").onclick = () => abrirLateral("pessoas");
    $("sMais").onclick = e => { e.stopPropagation(); alternarMenu(); };
    $("sFecharLat").onclick = () => el.classList.remove("lateral-on");
    el.querySelectorAll(".abas [data-aba]").forEach(b => b.onclick = () => abrirLateral(b.dataset.aba, true));
    $("sEnviar").onsubmit = e => { e.preventDefault(); const t = $("sTexto").value.trim(); if (!t) return; enviar({ t: "chat", texto: t }); $("sTexto").value = ""; };
    $("sGravar").onclick = alternarGravacao;
    $("sEncerrar").onclick = encerrarParaTodos;
    $("sSair").onclick = () => sair();
    $("sFimOk").onclick = () => fechar();
    $("sAudio").onclick = () => S.room && S.room.startAudio().then(() => $("sAudio").classList.remove("on"));
    $("painelPessoas").onclick = acaoPessoa;
    $("sMenu").onclick = acaoMenu;
    el.querySelectorAll("[data-fundo]").forEach(b => b.onclick = e => { e.stopPropagation(); escolherFundo(b.dataset.fundo); });
    $("sModalX").onclick = fecharModal;
    $("sModal").onclick = e => { if (e.target.id === "sModal") fecharModal(); };
    $("sEnquete").onclick = acaoEnquete;
    $("sCrono").onclick = acaoCrono;
    $("sGrupo").onclick = acaoGrupo;
    $("apForm").onsubmit = e => { e.preventDefault(); pedirAssistente($("apTexto").value); };
    $("apTexto").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); pedirAssistente($("apTexto").value); } };
    $("apAnt").onclick = () => irParaSlide(S.apres.atual - 1);
    $("apProx").onclick = () => irParaSlide(S.apres.atual + 1);
    $("apDesfazer").onclick = () => voltarVersao(-1);
    $("apRefazer").onclick = () => voltarVersao(1);
    $("apPdf").onclick = baixarPdf;
    $("apVivo").onclick = alternarApresentar;
    $("apDitar").onclick = ditarPedido;
    $("apMinis").onclick = e => { const b = e.target.closest("[data-slide]"); if (b) irParaSlide(+b.dataset.slide); };
    $("apSugestoes").onclick = e => { const b = e.target.closest("[data-sug]"); if (!b) return; if (b.dataset.completar) { $("apTexto").value = b.dataset.sug; $("apTexto").focus(); } else pedirAssistente(b.dataset.sug); };
    document.addEventListener("keydown", e => {
      if (!S || !S.inicio || S.encerrado || S.papel !== "mentor" || !S.apres.aoVivo) return;
      if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); irParaSlide(S.apres.atual + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); irParaSlide(S.apres.atual - 1); }
    });
    document.addEventListener("click", e => { if (el && !$("sMenu").hidden && !e.target.closest("#sMenu")) $("sMenu").hidden = true; });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape" || !el.classList.contains("aberta")) return;
      if (!$("sModal").hidden) fecharModal(); else if (!$("sMenu").hidden) $("sMenu").hidden = true; else el.classList.remove("lateral-on");
    });
    window.addEventListener("beforeunload", () => { if (S && S.room) S.room.disconnect(); });
    new ResizeObserver(() => S && layout()).observe($("sPalco"));
  }

  function novoEstado(op) {
    return {
      op, papel: op.papel === "mentor" ? "mentor" : "aluno", salaBase: op.sala || "noir-encontro", sala: op.sala || "noir-encontro", nome: op.nome || "",
      micOn: true, camOn: true, camId: "", micId: "", preStream: null, telaStream: null, codigoMentor: "",
      room: null, token: "", demo: !modoReal(), tiles: new Map(), maos: new Map(), maoMinha: false,
      gravando: false, egressId: "", inicioRec: 0, inicio: 0, timers: [], naoLidas: 0, aba: "chat",
      demoPessoas: [], demoFiltro: null, demoFalando: "", nivelLocal: 0, encerrado: false, trocando: false,
      // ferramentas
      fundo: "nenhum", lkCam: null, fundoTrack: null,
      enquetes: new Map(), enqueteAtual: null, pitches: [], crono: null,
      grupos: null, meuGrupo: 0,
      salaLegendas: false, verLegendas: true, rec: null, legendas: new Map(), transcricao: [], seqLeg: 0,
      tx: null, txAtiva: false,
      apres: { doc: null, atual: 0, aoVivo: false, rev: 0, versao: 0, hist: [], fut: [], conversa: [], ocupado: false, motor: "" },
      ditando: false
    };
  }

  /* ---------------- pré-sala ---------------- */
  async function abrir(op = {}) {
    montar();
    if (S && (S.room || S.inicio)) return;
    S = novoEstado(op);
    el.classList.remove("no-ar", "lateral-on", "papel-mentor");
    if (S.papel === "mentor") el.classList.add("papel-mentor");
    el.classList.add("aberta");
    document.body.style.overflow = "hidden";
    $("sPreTitulo").textContent = op.titulo || "Encontro ao vivo";
    $("sPreQuando").textContent = op.quando || "";
    $("sNome").value = S.nome; $("sPreAvatar").textContent = ini(S.nome);
    $("sCodigoBox").style.display = S.papel === "mentor" && !S.demo ? "" : "none";
    $("sGravarBox").style.display = S.papel === "mentor" ? "" : "none";
    $("sGravarAo").checked = !!op.gravarAoEntrar;
    $("sErro").textContent = "";
    $("sAvisoDemo").style.display = S.demo ? "" : "none";
    $("sAvisoDemo").textContent = "Modo demonstração: sua câmera, microfone e tela funcionam de verdade, e os outros participantes são simulados. Para encontros reais, preencha o endereço do LiveKit e a função de acesso em config.js.";
    $("sEntrar").disabled = false; $("sEntrar").textContent = "Entrar no encontro";
    $("sFim").classList.remove("on");
    ["sGrupo", "sCrono", "sEnquete", "sLegendas", "sMenu", "sModal"].forEach(id => $(id).hidden = true);
    $("sTx").classList.remove("on");
    marcarFundo("nenhum");
    $("sMsgs").innerHTML = '<p class="vazio">As mensagens do encontro aparecem aqui.</p>';
    await iniciarPreview();
  }

  async function iniciarPreview() {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { S.micOn = S.camOn = false; aplicarPreview("Este navegador não permite acessar câmera e microfone."); return; }
    try {
      S.preStream = await md.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      try { S.preStream = await md.getUserMedia({ audio: true }); } catch (e2) { S.preStream = null; }
    }
    const temV = !!(S.preStream && S.preStream.getVideoTracks()[0]), temA = !!(S.preStream && S.preStream.getAudioTracks()[0]);
    S.camOn = temV; S.micOn = temA;
    aplicarPreview(temV || temA ? "" : "Não conseguimos acessar a câmera nem o microfone. Libere o acesso no navegador ou entre sem eles.");
    await listarDispositivos();
    medirNivel();
  }

  /** Vídeo da câmera local antes de entrar (e no modo demonstração): com o fundo aplicado, se houver. */
  function trilhaLocal() {
    if (S.fundoTrack && S.fundoTrack.readyState === "live") return S.fundoTrack;
    return S.preStream && S.preStream.getVideoTracks()[0];
  }

  function aplicarPreview(msg) {
    const v = S.preStream && S.preStream.getVideoTracks()[0], a = S.preStream && S.preStream.getAudioTracks()[0];
    if (!v) S.camOn = false; if (!a) S.micOn = false;
    if (v) v.enabled = S.camOn; if (a) a.enabled = S.micOn;
    const video = $("sPreVideo"), mostrar = trilhaLocal();
    video.classList.toggle("sem-espelho", S.fundo === "noir");
    if (!mostrar) video.srcObject = null;
    else if (!video.srcObject || video.srcObject.getVideoTracks()[0] !== mostrar) video.srcObject = new MediaStream([mostrar]);
    video.style.visibility = S.camOn ? "visible" : "hidden";
    $("sSemCam").style.display = S.camOn ? "none" : "flex";
    $("sSemCamTxt").textContent = v ? "Câmera desligada" : "Sem câmera";
    botaoLiga("sPreMic", S.micOn, I.mic, I.micOff, "Microfone");
    botaoLiga("sPreCam", S.camOn, I.cam, I.camOff, "Câmera");
    if (msg !== undefined) $("sErro").textContent = msg;
  }

  async function listarDispositivos() {
    let lista = [];
    try { lista = await navigator.mediaDevices.enumerateDevices(); } catch (e) { }
    const preencher = (sel, tipo, atual) => {
      const ds = lista.filter(d => d.kind === tipo);
      sel.innerHTML = ds.length ? ds.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || (tipo === "videoinput" ? "Câmera " : "Microfone ") + (i + 1))}</option>`).join("") : "<option value=''>Nenhum encontrado</option>";
      if (atual) sel.value = atual;
    };
    const v = S.preStream && S.preStream.getVideoTracks()[0], a = S.preStream && S.preStream.getAudioTracks()[0];
    S.camId = S.camId || (v && v.getSettings().deviceId) || ""; S.micId = S.micId || (a && a.getSettings().deviceId) || "";
    preencher($("sCamSel"), "videoinput", S.camId);
    preencher($("sMicSel"), "audioinput", S.micId);
  }

  async function trocarDispositivoPreview(tipo) {
    if (!S.preStream) return;
    try {
      const novo = await navigator.mediaDevices.getUserMedia(tipo === "video" ? { video: { deviceId: { exact: S.camId } } } : { audio: { deviceId: { exact: S.micId } } });
      const nt = tipo === "video" ? novo.getVideoTracks()[0] : novo.getAudioTracks()[0];
      const velho = tipo === "video" ? S.preStream.getVideoTracks()[0] : S.preStream.getAudioTracks()[0];
      if (velho) { S.preStream.removeTrack(velho); velho.stop(); }
      S.preStream.addTrack(nt);
      S.localVideo = null;
      if (tipo === "video") { await soltarFundoLocal(); if (S.fundo !== "nenhum") await aplicarFundo(S.fundo); }
      if (tipo === "audio") medirNivel();
      aplicarPreview();
      if (S.inicio && S.demo) render();
    } catch (e) { $("sErro").textContent = "Não foi possível usar esse dispositivo."; }
  }

  function medirNivel() {
    if (S.audioCtx) { S.audioCtx.close().catch(() => { }); S.audioCtx = null; }
    const a = S.preStream && S.preStream.getAudioTracks()[0];
    if (!a || !window.AudioContext) return;
    const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([a])).connect(an);
    S.audioCtx = ctx;
    const dados = new Uint8Array(an.frequencyBinCount), barras = $("sNivel").children;
    const loop = () => {
      if (!S || S.audioCtx !== ctx) return;
      an.getByteFrequencyData(dados);
      const nivel = S.micOn ? Math.min(1, dados.reduce((x, y) => x + y, 0) / dados.length / 60) : 0;
      [...barras].forEach((b, i) => { const on = nivel > i / 5; b.style.height = on ? 6 + i * 4 + "px" : "4px"; b.style.opacity = on ? 1 : .35; });
      const falando = nivel > .25;
      if (S.demo && S.inicio && falando !== (S.nivelLocal > .25)) { S.nivelLocal = nivel; render(); } else S.nivelLocal = nivel;
      requestAnimationFrame(loop);
    };
    if (ctx.state === "suspended") ctx.resume().catch(() => { });
    loop();
  }

  function pararPreview() {
    if (S.audioCtx) { S.audioCtx.close().catch(() => { }); S.audioCtx = null; }
    soltarFundoLocal();
    if (S.preStream) S.preStream.getTracks().forEach(t => t.stop());
    S.preStream = null;
    $("sPreVideo").srcObject = null;
  }

  /* ---------------- entrar ---------------- */
  async function entrar() {
    S.nome = $("sNome").value.trim();
    if (!S.nome) { $("sErro").textContent = "Informe seu nome para entrar."; $("sNome").focus(); return; }
    S.codigoMentor = $("sCodigo").value;
    const btn = $("sEntrar"); btn.disabled = true; btn.textContent = "Entrando…"; $("sErro").textContent = "";
    try {
      if (S.demo) iniciarDemo(); else await conectarSala(true);
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = "Entrar no encontro";
      $("sErro").textContent = e.message || "Não foi possível entrar no encontro.";
      if (S.room) { S.room.removeAllListeners(); S.room.disconnect(); S.room = null; }
      return;
    }
    S.inicio = Date.now();
    S.timers.push(setInterval(tique, 1000)); tique();
    S.timers.push(setInterval(tiqueRapido, 250));
    el.classList.add("no-ar");
    $("sTitulo").textContent = S.op.titulo || "Encontro ao vivo";
    $("sSeloDemo").style.display = S.demo ? "" : "none";
    sistema("Você entrou no encontro.");
    atualizarMenu();
    render();
    if (S.papel === "mentor" && $("sGravarAo").checked) alternarGravacao();
    if (S.papel === "mentor") carregarApresentacao();
  }

  async function obterToken() {
    const cab = { "Content-Type": "application/json" };
    if (CFG.supabaseAnonKey) { cab.apikey = CFG.supabaseAnonKey; cab.Authorization = "Bearer " + (S.op.accessToken || CFG.supabaseAnonKey); }
    let resp, dados = {};
    try {
      resp = await fetch(CFG.tokenUrl, { method: "POST", headers: cab, body: JSON.stringify({ sala: S.sala, nome: S.nome, papel: S.papel, codigoMentor: S.codigoMentor }) });
      dados = await resp.json().catch(() => ({}));
    } catch (e) { throw new Error("Sem conexão com o servidor de acesso. Verifique sua internet."); }
    if (!resp.ok || !dados.token) throw new Error(dados.erro || "Não foi possível liberar seu acesso à sala.");
    return dados;
  }

  /** Conecta em S.sala. Usada na entrada e ao trocar de sala (networking). */
  async function conectarSala(primeira) {
    await carregarSDK();
    const dados = await obterToken();
    S.token = dados.token;
    const room = new LK.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: LK.VideoPresets.h720.resolution } });
    S.room = room;
    ligarEventos(room);
    room.registerTextStreamHandler(TOPICO_APRES, async (leitor, info) => {
      try { receberApresentacao(JSON.parse(await leitor.readAll()), info.identity); } catch (e) { console.warn("apresentação recebida inválida", e); }
    });
    try { await room.connect(dados.url || CFG.livekitUrl, S.token); }
    catch (e) { console.error(e); throw new Error("Não foi possível conectar à sala do LiveKit. Confira sua internet e o endereço em config.js."); }
    const camOn = S.camOn, micOn = S.micOn;
    if (primeira) pararPreview();
    try { await room.localParticipant.setMicrophoneEnabled(micOn, S.micId ? { deviceId: S.micId } : undefined); } catch (e) { S.micOn = false; toast("Não foi possível ligar o microfone."); }
    try { await room.localParticipant.setCameraEnabled(camOn, S.camId ? { deviceId: S.camId } : undefined); } catch (e) { S.camOn = false; toast("Não foi possível ligar a câmera."); }
    if (camOn && S.fundo !== "nenhum") aplicarFundo(S.fundo).catch(() => { });
    if (!room.canPlaybackAudio) $("sAudio").classList.add("on");
    if (!primeira && S.papel === "mentor" && S.apres.aoVivo) publicarApresentacao();
  }

  function ligarEventos(room) {
    const E = LK.RoomEvent;
    room
      .on(E.ParticipantConnected, p => { render(); sistema(`${nomeDe(p)} entrou.`); if (S.papel === "mentor" && S.apres.aoVivo) publicarApresentacao(p.identity); })
      .on(E.ParticipantDisconnected, p => { S.maos.delete(p.identity); render(); if (!S.trocando) sistema(`${nomeDe(p)} saiu.`); })
      .on(E.TrackSubscribed, (track) => { if (track.kind === "audio") $("sAudios").appendChild(track.attach()); render(); })
      .on(E.TrackUnsubscribed, (track) => { if (track.kind === "audio") track.detach().forEach(a => a.remove()); render(); })
      .on(E.TrackMuted, render).on(E.TrackUnmuted, render)
      .on(E.LocalTrackPublished, render).on(E.LocalTrackUnpublished, render)
      .on(E.ActiveSpeakersChanged, render).on(E.ParticipantAttributesChanged, render).on(E.ParticipantNameChanged, render)
      .on(E.DataReceived, (payload, p, kind, topic) => {
        if (topic !== "noir") return;
        try { receber(JSON.parse(dec.decode(payload)), p ? p.identity : "", p ? nomeDe(p) : "Sistema"); } catch (e) { }
      })
      .on(E.AudioPlaybackStatusChanged, () => $("sAudio").classList.toggle("on", !room.canPlaybackAudio))
      .on(E.Reconnecting, () => toast("Conexão instável. Reconectando…"))
      .on(E.Reconnected, () => toast("Conexão restabelecida."))
      // Só o mentor vê o estado da gravação; os alunos não recebem aviso na tela.
      .on(E.RecordingStatusChanged, gravando => { if (S.papel === "mentor" && !S.meuGrupo) marcarGravando(gravando); })
      .on(E.Disconnected, motivo => { if (!S.trocando) finalizar(motivo); });
  }

  const nomeDe = p => (p && (p.name || p.identity)) || "Participante";
  function papelDe(p) {
    if (p.attributes && p.attributes.papel) return p.attributes.papel;
    try { return JSON.parse(p.metadata || "{}").papel || ""; } catch (e) { return ""; }
  }
  const meuId = () => S.demo ? "voce" : S.room.localParticipant.identity;
  /** Mensagens de controle (enquete, cronômetro, grupos…) só valem se vierem do mentor. */
  function doMentor(id) {
    if (id === meuId()) return S.papel === "mentor";
    if (S.demo) { const d = S.demoPessoas.find(x => x.id === id); return !!d && d.papel === "mentor"; }
    const p = S.room && S.room.remoteParticipants.get(id);
    return !!p && papelDe(p) === "mentor";
  }

  /* ---------------- participantes ---------------- */
  function pessoas() {
    if (S.demo) {
      const lista = S.demoFiltro ? S.demoPessoas.filter(d => S.demoFiltro.has(d.id)) : S.demoPessoas;
      return lista.map(d => {
        if (d.local) {
          const v = trilhaLocal();
          if (S.localVideo && S.localVideo.getVideoTracks()[0] !== v) S.localVideo = null;
          return {
            id: "voce", nome: S.nome, papel: S.papel, local: true, mic: S.micOn,
            cam: S.camOn && v ? { ms: S.localVideo || (S.localVideo = new MediaStream([v])) } : null,
            tela: S.telaStream ? { ms: S.telaStream } : null, falando: S.micOn && S.nivelLocal > .25, mao: S.maoMinha
          };
        }
        return { id: d.id, nome: d.nome, papel: d.papel, local: false, mic: d.mic, cam: null, tela: null, falando: d.mic && S.demoFalando === d.id, mao: S.maos.has(d.id) };
      });
    }
    const r = S.room, lista = [r.localParticipant, ...r.remoteParticipants.values()];
    const ativos = new Set((r.activeSpeakers || []).map(p => p.identity));
    return lista.map(p => {
      const cam = p.getTrackPublication(LK.Track.Source.Camera), tela = p.getTrackPublication(LK.Track.Source.ScreenShare);
      return {
        id: p.identity, nome: nomeDe(p), papel: papelDe(p), local: p === r.localParticipant, mic: p.isMicrophoneEnabled,
        cam: cam && cam.track && !cam.isMuted ? { lk: cam.track } : null,
        tela: tela && tela.track && !tela.isMuted ? { lk: tela.track } : null,
        falando: ativos.has(p.identity), mao: p === r.localParticipant ? S.maoMinha : S.maos.has(p.identity)
      };
    });
  }

  function render() {
    if (!S || S._raf || !S.inicio) return;
    S._raf = requestAnimationFrame(() => { S._raf = 0; if (S && S.inicio && !S.encerrado && (S.demo || S.room)) desenhar(); });
  }

  function desenhar() {
    const ps = pessoas();
    const ordem = [...ps].sort((a, b) => (b.papel === "mentor") - (a.papel === "mentor"));
    const tiles = [];
    if (S.apres.aoVivo && S.apres.doc) tiles.push({ chave: "apres", apres: true, tela: true, p: { id: "apres", nome: S.apres.doc.titulo, local: false } });
    ordem.forEach(p => { if (p.tela) tiles.push({ chave: p.id + ":tela", p, tela: true, video: p.tela }); });
    ordem.forEach(p => tiles.push({ chave: p.id, p, tela: false, video: p.cam }));
    const grade = $("sGrade"), vistos = new Set();
    tiles.forEach((t, i) => {
      let d = S.tiles.get(t.chave);
      if (!d) { d = t.apres ? criarTileApres() : criarTile(); S.tiles.set(t.chave, d); }
      vistos.add(t.chave);
      if (t.apres) atualizarTileApres(d); else atualizarTile(d, t);
      d.classList.toggle("destaque", i === 0 && t.tela);
      if (grade.children[i] !== d) grade.insertBefore(d, grade.children[i] || null);
    });
    for (const [k, d] of S.tiles) if (!vistos.has(k)) { soltarVideo(d); d.remove(); S.tiles.delete(k); }
    const temTela = tiles.some(t => t.tela);
    $("sPalco").classList.toggle("com-tela", temTela);
    grade.style.setProperty("--linhas", Math.max(1, tiles.length - 1));
    layout();

    const eu = ps.find(p => p.local) || {};
    botaoLiga("sMic", eu.mic, I.mic, I.micOff, "Microfone");
    botaoLiga("sCam", !!eu.cam, I.cam, I.camOff, "Câmera");
    $("sTela").classList.toggle("ativo", !!eu.tela);
    $("sMao").classList.toggle("ativo", S.maoMinha);
    $("sQtd").textContent = ps.length + (ps.length === 1 ? " pessoa" : " pessoas");
    const maos = ps.filter(p => p.mao).length;
    const bp = $("sPessoas").querySelector(".badge"); bp.textContent = maos; bp.classList.toggle("on", maos > 0);
    desenharPessoas(ps);
    if (S.enqueteAtual) desenharEnquete();
  }

  function criarTile() {
    const d = document.createElement("div");
    d.className = "tile";
    d.innerHTML = `<video autoplay playsinline muted></video><div class="avatar"></div><div class="rot"></div><div class="mao" title="Mão levantada">${I.mao}</div>`;
    return d;
  }
  function atualizarTile(d, t) {
    const p = t.p;
    d.classList.toggle("local", p.local);
    d.classList.toggle("sem-espelho", p.local && S.fundo === "noir");
    d.classList.toggle("tela", t.tela);
    d.classList.toggle("falando", !t.tela && p.falando);
    d.classList.toggle("mao-on", !t.tela && p.mao);
    d.classList.toggle("com-video", !!t.video);
    d.querySelector(".avatar").textContent = ini(p.nome);
    const nome = t.tela ? "Tela de " + p.nome : p.nome + (p.local ? " (você)" : "");
    const rot = (!t.tela && !p.mic ? I.micOff : "") + `<span>${esc(nome)}</span>` + (!t.tela && p.papel === "mentor" ? '<b class="papel">Mentor</b>' : "");
    const r = d.querySelector(".rot"); if (r._html !== rot) { r.innerHTML = rot; r._html = rot; }
    const v = d.querySelector("video"), src = t.video;
    if (src && src.lk) { if (d._lk !== src.lk) { soltarVideo(d); src.lk.attach(v); d._lk = src.lk; } }
    else if (src && src.ms) { if (d._lk) soltarVideo(d); if (v.srcObject !== src.ms) { v.srcObject = src.ms; v.play().catch(() => { }); } }
    else soltarVideo(d);
  }
  function soltarVideo(d) {
    const v = d.querySelector("video");
    if (!v) return;
    if (d._lk) { d._lk.detach(v); d._lk = null; }
    if (v.srcObject) v.srcObject = null;
  }
  function limparGrade() {
    for (const d of S.tiles.values()) soltarVideo(d);
    $("sGrade").innerHTML = ""; S.tiles.clear();
    $("sAudios").innerHTML = "";
  }

  function layout() {
    const g = $("sGrade"), pal = $("sPalco");
    if (!g || !S || !S.inicio) return;
    const tiles = [...g.children];
    if (pal.classList.contains("com-tela")) { g.style.gridTemplateColumns = ""; g.style.gridAutoRows = ""; g.style.justifyContent = ""; return; }
    const cs = getComputedStyle(pal), gap = parseFloat(getComputedStyle(g).gap) || 10;
    const faixa = $("sGrupo").hidden ? 0 : $("sGrupo").offsetHeight + 10;
    const W = pal.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = pal.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - faixa;
    const n = Math.max(1, tiles.length);
    let melhor = { w: 0, h: 0, c: 1 };
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      let w = (W - gap * (c - 1)) / c, h = w * 9 / 16;
      if (h * r + gap * (r - 1) > H) { h = (H - gap * (r - 1)) / r; w = h * 16 / 9; }
      if (w > melhor.w) melhor = { w, h, c };
    }
    g.style.gridTemplateColumns = `repeat(${melhor.c}, ${Math.max(80, Math.floor(melhor.w))}px)`;
    g.style.gridAutoRows = `${Math.max(45, Math.floor(melhor.h))}px`;
    g.style.justifyContent = "center";
  }

  function desenharPessoas(ps) {
    const mentor = S.papel === "mentor";
    const maos = ps.filter(p => p.mao);
    const linha = p => `<div class="pessoa-l"><div class="avatar">${esc(ini(p.nome))}</div>
      <div class="nm">${esc(p.nome)}${p.local ? " (você)" : ""}<small>${p.papel === "mentor" ? "Mentor" : "Aluno"}</small></div>
      <div class="ic">${p.mao ? I.mao : ""}${p.mic ? I.mic : I.micOff}${p.cam ? I.cam : I.camOff}
      ${mentor && !p.local ? (p.mao ? `<button class="mini-btn" data-acao="abaixar" data-id="${esc(p.id)}">Abaixar</button>` : "") + (p.mic ? `<button class="mini-btn" data-acao="silenciar" data-id="${esc(p.id)}">Silenciar</button>` : "") + `<button class="mini-btn" data-acao="remover" data-id="${esc(p.id)}" data-nome="${esc(p.nome)}">Remover</button>` : ""}</div></div>`;
    const html = (maos.length ? `<p class="sub-l">Mãos levantadas (${maos.length})</p>${maos.map(linha).join("")}<p class="sub-l" style="margin-top:16px">Todos</p>` : `<p class="sub-l">No encontro (${ps.length})</p>`) + ps.map(linha).join("");
    const box = $("painelPessoas"); if (box._html !== html) { box.innerHTML = html; box._html = html; }
  }

  /* ---------------- controles ---------------- */
  function botaoLiga(id, ligado, iOn, iOff, rotulo) {
    const b = $(id); if (!b) return;
    b.classList.toggle("off", !ligado);
    b.setAttribute("aria-pressed", String(!!ligado));
    b.setAttribute("aria-label", rotulo + (ligado ? " ligado" : " desligado"));
    const bola = b.querySelector(".bola"), icone = ligado ? iOn : iOff;
    if (bola._ic !== icone) { bola.innerHTML = icone; bola._ic = icone; }
  }

  async function alternarMic() {
    if (S.demo) {
      const a = S.preStream && S.preStream.getAudioTracks()[0];
      if (!a) return toast("Nenhum microfone disponível.");
      S.micOn = !S.micOn; a.enabled = S.micOn;
    } else {
      const lp = S.room.localParticipant;
      try { await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled); S.micOn = lp.isMicrophoneEnabled; } catch (e) { toast("Não foi possível acessar o microfone."); }
    }
    sincronizarReconhecimento();
    render();
  }
  async function alternarCam() {
    if (S.demo) {
      const v = S.preStream && S.preStream.getVideoTracks()[0];
      if (!v) return toast("Nenhuma câmera disponível.");
      S.camOn = !S.camOn; v.enabled = S.camOn; return render();
    }
    const lp = S.room.localParticipant;
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled, S.camId ? { deviceId: S.camId } : undefined);
      S.camOn = lp.isCameraEnabled;
      if (S.camOn && S.fundo !== "nenhum") aplicarFundo(S.fundo).catch(() => { });
    } catch (e) { toast("Não foi possível acessar a câmera."); }
    render();
  }
  async function alternarTela() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return toast("Este aparelho não permite compartilhar a tela.");
    if (S.demo) {
      if (S.telaStream) { S.telaStream.getTracks().forEach(t => t.stop()); S.telaStream = null; return render(); }
      try {
        S.telaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        S.telaStream.getVideoTracks()[0].onended = () => { S.telaStream = null; render(); };
      } catch (e) { if (e.name !== "NotAllowedError") toast("Não foi possível compartilhar a tela."); }
      return render();
    }
    const lp = S.room.localParticipant;
    try { await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: true, selfBrowserSurface: "exclude" }); }
    catch (e) { if (e.name !== "NotAllowedError") toast("Não foi possível compartilhar a tela."); }
    render();
  }
  function alternarMao() {
    S.maoMinha = !S.maoMinha;
    enviar({ t: "mao", ativa: S.maoMinha });
    toast(S.maoMinha ? "Você levantou a mão." : "Você abaixou a mão.");
    render();
  }
  function abrirLateral(aba, deAba) {
    const aberta = el.classList.contains("lateral-on");
    if (aberta && S.aba === aba && !deAba) { el.classList.remove("lateral-on"); return; }
    S.aba = aba;
    el.classList.add("lateral-on");
    el.querySelectorAll(".abas [data-aba]").forEach(b => { const on = b.dataset.aba === aba; b.classList.toggle("sel", on); b.setAttribute("aria-selected", on); });
    $("painelChat").classList.toggle("ativo", aba === "chat");
    $("painelPessoas").classList.toggle("ativo", aba === "pessoas");
    $("painelSlides").classList.toggle("ativo", aba === "slides");
    el.classList.toggle("aba-slides", aba === "slides");
    if (aba === "slides") { desenharPainelSlides(); setTimeout(() => $("apTexto").focus(), 50); }
    if (aba === "chat") { S.naoLidas = 0; marcarNaoLidas(); setTimeout(() => $("sTexto").focus(), 50); }
    layout();
  }
  function marcarNaoLidas() { const b = $("sChat").querySelector(".badge"); b.textContent = S.naoLidas; b.classList.toggle("on", S.naoLidas > 0); }

  /* ---------------- menu "Mais" ---------------- */
  function alternarMenu() { $("sMenu").hidden = !$("sMenu").hidden; if (!$("sMenu").hidden) atualizarMenu(); }
  function atualizarMenu() {
    const leg = $("sEstLeg");
    if (S.papel === "mentor") leg.textContent = S.salaLegendas ? "Ligadas para todos" : "Desligadas";
    else leg.textContent = !S.salaLegendas ? "O mentor ainda não ligou" : S.verLegendas ? "Visíveis" : "Ocultas";
    el.querySelector('#sMenu [data-f="legendas"]').setAttribute("aria-checked", String(S.papel === "mentor" ? S.salaLegendas : S.verLegendas && S.salaLegendas));
    $("sEstTx").textContent = S.txAtiva ? "No ar" : "";
    $("sEstAp").textContent = S.apres.aoVivo ? "Apresentando" : S.apres.doc ? S.apres.doc.slides.length + " slides" : "";
  }
  function acaoMenu(e) {
    const b = e.target.closest("[data-f]"); if (!b) return;
    e.stopPropagation();
    $("sMenu").hidden = true;
    ({ legendas: alternarLegendas, enquete: modalEnquete, cronometro: modalCronometro, grupos: modalGrupos, transmitir: modalTransmitir, resumo: modalResumo, assistente: () => abrirLateral("slides", true) })[b.dataset.f]();
  }

  /* ---------------- modal genérico ---------------- */
  function modal(titulo, html, botoes = []) {
    $("sModalTit").textContent = titulo;
    $("sModalCorpo").innerHTML = html;
    const acoes = $("sModalAcoes"); acoes.innerHTML = "";
    botoes.forEach(b => {
      const x = document.createElement("button");
      x.type = "button"; x.className = "btn-sala" + (b.primario ? "" : " vazado"); x.textContent = b.rot;
      x.onclick = async () => { x.disabled = true; try { if ((await b.acao()) !== false) fecharModal(); } finally { x.disabled = false; } };
      acoes.appendChild(x);
    });
    $("sModal").hidden = false;
    const primeiro = $("sModalCorpo").querySelector("input,select,textarea,button"); if (primeiro) setTimeout(() => primeiro.focus(), 30);
  }
  function fecharModal() { $("sModal").hidden = true; }
  const erroModal = t => { let e = $("sModalCorpo").querySelector(".erro-sala"); if (!e) { e = document.createElement("div"); e.className = "erro-sala"; $("sModalCorpo").appendChild(e); } e.textContent = t; return false; };

  /* ---------------- mensagens ---------------- */
  function enviar(m) {
    if (S.demo) return receber(m, "voce", S.nome);
    if (!S.room) return;
    S.room.localParticipant.publishData(enc.encode(JSON.stringify(m)), { reliable: m.t !== "leg" || m.fin, topic: "noir" }).catch(() => { if (m.t === "chat") toast("Mensagem não enviada."); });
    receber(m, meuId(), S.nome);
  }
  function receber(m, id, nome) {
    if (!m || !m.t || !S || S.encerrado) return;
    const deMim = id === meuId();
    switch (m.t) {
      case "chat": {
        adicionarMsg(nome + (deMim ? " (você)" : ""), String(m.texto || "").slice(0, 500));
        const vendo = el.classList.contains("lateral-on") && S.aba === "chat";
        if (!deMim && !vendo) { S.naoLidas++; marcarNaoLidas(); toast(`${nome}: ${String(m.texto).slice(0, 60)}`); }
        break;
      }
      case "mao":
        if (!deMim) { if (m.ativa) { S.maos.set(id, Date.now()); if (S.papel === "mentor") toast(`${nome} levantou a mão.`); } else S.maos.delete(id); }
        render(); break;
      case "abaixar":
        if (!doMentor(id)) return;
        if (m.id === meuId()) { S.maoMinha = false; toast("O mentor abaixou sua mão."); }
        S.maos.delete(m.id); render(); break;
      // enquetes
      case "enquete": if (doMentor(id)) receberEnquete(m); break;
      case "voto": receberVoto(m, id); break;
      case "enquete_resultado": if (doMentor(id)) { const q = S.enquetes.get(m.id); if (q) { q.publico = true; desenharEnquete(); } } break;
      case "enquete_fim": if (doMentor(id)) encerrarEnqueteLocal(m.id); break;
      // cronômetro
      case "crono": if (doMentor(id)) iniciarCrono(m); break;
      case "crono_mais": if (doMentor(id) && S.crono) { S.crono.fim += m.ms; S.crono.total += m.ms; S.crono.esgotado = false; } break;
      case "crono_parar": if (doMentor(id)) pararCrono(true); break;
      // salas de networking
      case "grupos": if (doMentor(id)) receberGrupos(m); break;
      case "voltar": if (id === "" || doMentor(id)) encerrarGrupos("O mentor chamou todos de volta."); break;
      // legendas
      case "legendas": if (doMentor(id)) definirLegendasSala(!!m.ativo, nome); break;
      case "leg": receberLegenda(m, id, nome); break;
      // transmissão
      case "apres_nav":
        if (doMentor(id) && !deMim && S.apres.doc && (m.rev | 0) >= S.apres.rev) { S.apres.atual = Math.min(Math.max(m.atual | 0, 0), S.apres.doc.slides.length - 1); S.apres.versao++; render(); }
        break;
      case "apres_vivo":
        if (doMentor(id) && !deMim) { S.apres.aoVivo = !!m.ativo && !!S.apres.doc; if (!m.ativo) toast("O mentor parou de apresentar."); render(); }
        break;
      case "tx": if (doMentor(id)) { S.txAtiva = !!m.ativo; $("sTx").classList.toggle("on", S.txAtiva); if (!deMim) toast(m.ativo ? "Este encontro está sendo transmitido ao vivo nas redes." : "A transmissão nas redes terminou."); atualizarMenu(); } break;
    }
  }
  function adicionarMsg(autor, texto, sistemaMsg) {
    const box = $("sMsgs"); const vazio = box.querySelector(".vazio"); if (vazio) vazio.remove();
    const d = document.createElement("div"); d.className = "msg" + (sistemaMsg ? " sistema" : "");
    d.innerHTML = sistemaMsg ? `<p>${esc(texto)}</p>` : `<b>${esc(autor)}</b><small>${hora()}</small><p>${esc(texto)}</p>`;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  const sistema = t => adicionarMsg("", t, true);

  async function acaoPessoa(e) {
    const b = e.target.closest("[data-acao]"); if (!b) return;
    const id = b.dataset.id, acao = b.dataset.acao;
    if (acao === "abaixar") { enviar({ t: "abaixar", id }); return; }
    if (acao === "remover" && !confirm(`Remover ${b.dataset.nome} do encontro?`)) return;
    if (S.demo) {
      const d = S.demoPessoas.find(x => x.id === id);
      if (acao === "silenciar" && d) { d.mic = false; toast(`${d.nome} foi silenciado.`); }
      if (acao === "remover" && d) { S.demoPessoas = S.demoPessoas.filter(x => x.id !== id); S.maos.delete(id); sistema(`${d.nome} foi removido do encontro.`); }
      return render();
    }
    try { await admin({ acao, identidade: id }); toast(acao === "silenciar" ? "Participante silenciado." : "Participante removido."); }
    catch (err) { toast(err.message); }
  }

  /* ================= ENQUETES ================= */
  function modalEnquete() {
    modal("Nova enquete", `
      <label for="eqPergunta">Pergunta</label><input id="eqPergunta" maxlength="140" placeholder="Ex.: Qual é o seu maior desafio em negociação?">
      <label>Opções (de 2 a 4)</label>
      <div class="opcoes-form">${[1, 2, 3, 4].map(i => `<input class="eqOp" maxlength="60" placeholder="Opção ${i}${i > 2 ? " (opcional)" : ""}">`).join("")}</div>
      <label class="check"><input type="checkbox" id="eqAoVivo" checked> Mostrar o resultado para todos enquanto votam</label>`,
      [{ rot: "Cancelar", acao: () => { } }, { rot: "Lançar enquete", primario: true, acao: lancarEnquete }]);
  }
  function lancarEnquete() {
    const pergunta = $("eqPergunta").value.trim();
    const opcoes = [...el.querySelectorAll(".eqOp")].map(i => i.value.trim()).filter(Boolean);
    if (!pergunta) return erroModal("Escreva a pergunta.");
    if (opcoes.length < 2) return erroModal("Preencha pelo menos duas opções.");
    const m = { t: "enquete", id: novoId(), pergunta, opcoes, aoVivo: $("eqAoVivo").checked };
    enviar(m);
    if (S.demo) simularVotos(m);
  }
  function receberEnquete(m) {
    const q = { id: m.id, pergunta: String(m.pergunta).slice(0, 140), opcoes: (m.opcoes || []).slice(0, 4).map(o => String(o).slice(0, 60)), aoVivo: !!m.aoVivo, publico: false, votos: new Map(), meuVoto: null, encerrada: false, minimizada: false };
    S.enquetes.set(q.id, q); S.enqueteAtual = q.id;
    if (S.papel !== "mentor") toast("Nova enquete do mentor.");
    desenharEnquete();
  }
  function receberVoto(m, id) {
    const q = S.enquetes.get(m.id); if (!q || q.encerrada) return;
    const op = Number(m.op); if (!(op >= 0 && op < q.opcoes.length)) return;
    q.votos.set(id, op);
    if (id === meuId()) q.meuVoto = op;
    if (S.enqueteAtual === q.id) desenharEnquete();
  }
  function contagem(q) { const c = q.opcoes.map(() => 0); q.votos.forEach(v => c[v]++); return c; }
  function desenharEnquete() {
    const box = $("sEnquete"), q = S.enqueteAtual && S.enquetes.get(S.enqueteAtual);
    $("sPalco").classList.toggle("com-enquete", !!q && !q.minimizada);
    if (!q) { box.hidden = true; return; }
    box.hidden = false;
    box.classList.toggle("min", q.minimizada);
    const mentor = S.papel === "mentor", ver = mentor || q.aoVivo || q.publico || q.encerrada;
    const c = contagem(q), total = q.votos.size, max = Math.max(1, ...c);
    const opcoes = q.opcoes.map((o, i) => {
      const pct = total ? Math.round(c[i] / total * 100) : 0;
      const marcada = q.meuVoto === i ? " marcada" : "", lider = ver && total && c[i] === max ? " lider" : "";
      return `<button type="button" class="op${marcada}${lider}" data-voto="${i}" ${q.encerrada || (q.meuVoto !== null) ? "disabled" : ""}>
        ${ver ? `<i style="width:${pct}%"></i>` : ""}<span>${esc(o)}</span>${ver ? `<b>${pct}%</b>` : ""}</button>`;
    }).join("");
    const estado = q.encerrada ? "Enquete encerrada" : q.meuVoto !== null ? "Seu voto foi registrado" : mentor ? "Aguardando votos" : "Toque para votar";
    const html = `<div class="enq-cab"><span>${I.enquete} Enquete</span><button type="button" class="x" data-enq="min" aria-label="${q.minimizada ? "Abrir" : "Minimizar"} enquete">${q.minimizada ? "+" : "−"}</button></div>
      <p class="enq-perg">${esc(q.pergunta)}</p>
      <div class="enq-ops">${opcoes}</div>
      <p class="enq-rodape">${estado} · ${total} ${total === 1 ? "voto" : "votos"}</p>
      ${mentor && !q.encerrada ? `<div class="enq-acoes">${!q.aoVivo && !q.publico ? '<button type="button" class="mini-btn" data-enq="mostrar">Mostrar resultado</button>' : ""}<button type="button" class="mini-btn" data-enq="fim">Encerrar</button></div>` : ""}
      ${q.encerrada ? '<div class="enq-acoes"><button type="button" class="mini-btn" data-enq="fechar">Fechar</button></div>' : ""}`;
    if (box._html !== html) { box.innerHTML = html; box._html = html; }
  }
  function acaoEnquete(e) {
    const q = S.enquetes.get(S.enqueteAtual); if (!q) return;
    const v = e.target.closest("[data-voto]");
    if (v && !v.disabled) { enviar({ t: "voto", id: q.id, op: +v.dataset.voto }); return; }
    const a = e.target.closest("[data-enq]"); if (!a) return;
    if (a.dataset.enq === "min") { q.minimizada = !q.minimizada; desenharEnquete(); }
    if (a.dataset.enq === "mostrar") enviar({ t: "enquete_resultado", id: q.id });
    if (a.dataset.enq === "fim") enviar({ t: "enquete_fim", id: q.id });
    if (a.dataset.enq === "fechar") { S.enqueteAtual = null; desenharEnquete(); }
  }
  function encerrarEnqueteLocal(id) {
    const q = S.enquetes.get(id); if (!q) return;
    q.encerrada = true; q.minimizada = false;
    const c = contagem(q), max = Math.max(...c);
    if (q.votos.size) sistema(`Enquete “${q.pergunta}”: ${q.opcoes.filter((o, i) => c[i] === max).join(" e ")} (${max} de ${q.votos.size} votos).`);
    if (S.enqueteAtual === id) desenharEnquete();
  }
  function simularVotos(m) {
    S.demoPessoas.filter(d => !d.local).forEach((d, i) => S.timers.push(setTimeout(() => receber({ t: "voto", id: m.id, op: Math.floor(Math.random() * m.opcoes.length) }, d.id, d.nome), 900 + i * 1100)));
  }

  /* ================= CRONÔMETRO DE PITCH ================= */
  function modalCronometro() {
    const ps = pessoas();
    modal("Cronômetro de pitch", `
      <label for="crPessoa">Quem vai apresentar</label>
      <select id="crPessoa">${ps.map(p => `<option value="${esc(p.nome)}">${esc(p.nome)}${p.local ? " (você)" : ""}</option>`).join("")}</select>
      <label>Tempo</label>
      <div class="pilulas" id="crTempo">${[1, 2, 3, 5].map((m, i) => `<button type="button" data-min="${m}" class="${i === 1 ? "sel" : ""}">${m} min</button>`).join("")}</div>
      <p class="nota">Todos veem a contagem. Nos últimos 15 segundos ela fica vermelha, e um sinal toca no fim.</p>`,
      [{ rot: "Cancelar", acao: () => { } }, { rot: "Começar", primario: true, acao: () => {
        const min = +($("crTempo").querySelector(".sel") || {}).dataset.min || 2;
        enviar({ t: "crono", id: novoId(), nome: $("crPessoa").value, ms: min * 60000 });
      } }]);
    $("crTempo").onclick = e => { const b = e.target.closest("[data-min]"); if (!b) return; $("crTempo").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b)); };
  }
  function iniciarCrono(m) {
    const ms = Math.min(Math.max(+m.ms || 60000, 10000), 3600000);
    S.crono = { id: m.id, nome: String(m.nome || "").slice(0, 60), fim: Date.now() + ms, total: ms, inicio: Date.now(), esgotado: false };
    $("sCrono").hidden = false; desenharCrono();
  }
  function desenharCrono() {
    const c = S.crono, box = $("sCrono"); if (!c) { box.hidden = true; return; }
    const resta = c.fim - Date.now(), alerta = resta <= 15000;
    if (resta <= 0 && !c.esgotado) { c.esgotado = true; bip(); S.pitches.push({ nome: c.nome, segundos: Math.round(c.total / 1000) }); S.timers.push(setTimeout(() => { if (S && S.crono === c) pararCrono(false); }, 5000)); }
    box.classList.toggle("alerta", alerta && !c.esgotado);
    box.classList.toggle("fim", c.esgotado);
    const chave = c.id + (c.esgotado ? ":fim" : "");
    if (box._chave !== chave) {
      box._chave = chave;
      box.innerHTML = `<span class="cr-nome">Pitch de ${esc(c.nome)}</span><span class="cr-tempo"></span>
        <i class="cr-barra"><b></b></i>
        ${S.papel === "mentor" && !c.esgotado ? '<span class="cr-acoes"><button type="button" class="mini-btn" data-cr="mais">+30s</button><button type="button" class="mini-btn" data-cr="parar">Parar</button></span>' : ""}`;
    }
    box.querySelector(".cr-tempo").textContent = c.esgotado ? "Tempo esgotado" : mmss(resta + 999);
    box.querySelector(".cr-barra b").style.width = Math.max(0, Math.min(100, resta / c.total * 100)) + "%";
  }
  function acaoCrono(e) {
    const b = e.target.closest("[data-cr]"); if (!b) return;
    if (b.dataset.cr === "mais") enviar({ t: "crono_mais", ms: 30000 });
    if (b.dataset.cr === "parar") enviar({ t: "crono_parar" });
  }
  function pararCrono(manual) {
    if (!S.crono) return;
    if (manual && !S.crono.esgotado) S.pitches.push({ nome: S.crono.nome, segundos: Math.round((Date.now() - S.crono.inicio) / 1000) });
    S.crono = null; $("sCrono").hidden = true;
  }
  function bip() {
    try {
      const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.25, ctx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .6);
      o.start(); o.stop(ctx.currentTime + .65); o.onended = () => ctx.close();
    } catch (e) { }
  }

  /* ================= SALAS DE NETWORKING ================= */
  function montarGrupos(tamanho) {
    const alunos = embaralhar(pessoas().filter(p => !p.local && p.papel !== "mentor"));
    const n = Math.max(1, Math.round(alunos.length / tamanho));
    const grupos = Array.from({ length: n }, (_, i) => ({ n: i + 1, ids: [], nomes: [] }));
    alunos.forEach((p, i) => { grupos[i % n].ids.push(p.id); grupos[i % n].nomes.push(p.nome); });
    return grupos;
  }
  function modalGrupos() {
    if (S.grupos) return toast("As salas de networking já estão abertas.");
    const alunos = pessoas().filter(p => !p.local && p.papel !== "mentor").length;
    if (alunos < 2) return toast("São precisos pelo menos 2 alunos na sala.");
    let grupos = montarGrupos(2);
    const desenhar = () => { $("grLista").innerHTML = grupos.map(g => `<li><b>Sala ${g.n}</b><span>${g.nomes.map(esc).join(", ")}</span></li>`).join(""); };
    modal("Salas de networking", `
      <p class="nota">A turma é dividida em salas menores. No fim do tempo, todos voltam sozinhos para a sala principal.</p>
      <div class="grade2-sala">
        <div><label for="grTam">Pessoas por sala</label><select id="grTam">${[2, 3, 4, 5, 6].map(t => `<option value="${t}">${t}</option>`).join("")}</select></div>
        <div><label for="grMin">Duração</label><select id="grMin">${[3, 5, 10, 15, 20].map(m => `<option value="${m}" ${m === 5 ? "selected" : ""}>${m} minutos</option>`).join("")}</select></div>
      </div>
      <ul class="lista-grupos" id="grLista"></ul>
      <button type="button" class="mini-btn" id="grSortear">Sortear de novo</button>`,
      [{ rot: "Cancelar", acao: () => { } }, { rot: "Abrir as salas", primario: true, acao: () => {
        enviar({ t: "grupos", id: novoId(), ms: +$("grMin").value * 60000, base: S.salaBase, grupos });
      } }]);
    desenhar();
    $("grTam").onchange = () => { grupos = montarGrupos(+$("grTam").value); desenhar(); };
    $("grSortear").onclick = () => { grupos = montarGrupos(+$("grTam").value); desenhar(); };
  }
  function receberGrupos(m) {
    const ms = Math.min(Math.max(+m.ms || 300000, 60000), 3600000);
    S.grupos = { id: m.id, fim: Date.now() + ms, base: S.salaBase, lista: (m.grupos || []).slice(0, 50) };
    const meu = S.grupos.lista.find(g => g.ids.includes(meuId()));
    sistema(`Salas de networking abertas por ${Math.round(ms / 60000)} minutos.`);
    if (S.demo) S.demoFiltro = new Set(["voce"]);
    if (meu) moverPara(meu.n); else { desenharFaixaGrupo(); render(); }
  }
  async function moverPara(n) {
    const destino = n ? `${S.salaBase}-g${n}` : S.salaBase;
    S.meuGrupo = n;
    if (S.demo) {
      const g = n && S.grupos && S.grupos.lista.find(x => x.n === n);
      S.demoFiltro = g ? new Set(["voce", ...g.ids]) : (S.grupos ? new Set(["voce"]) : null);
      S.maos.clear(); S.sala = destino; limparGrade();
      sistema(n ? `Você entrou na sala de networking ${n}.` : "Você voltou para a sala principal.");
      desenharFaixaGrupo(); render(); return;
    }
    if (S.sala === destino && S.room) { desenharFaixaGrupo(); return; }
    const lp = S.room && S.room.localParticipant;
    if (lp) { S.micOn = lp.isMicrophoneEnabled; S.camOn = lp.isCameraEnabled; }
    S.trocando = true;
    try {
      if (S.room) { S.room.removeAllListeners(); await S.room.disconnect(); S.room = null; }
      limparGrade(); S.maos.clear(); S.legendas.clear();
      S.sala = destino;
      await conectarSala(false);
      sistema(n ? `Você entrou na sala de networking ${n}.` : "Você voltou para a sala principal.");
    } catch (e) {
      toast(e.message);
      if (destino !== S.salaBase) { S.sala = S.salaBase; S.meuGrupo = 0; try { await conectarSala(false); } catch (e2) { S.trocando = false; return finalizar("conexao"); } }
    }
    S.trocando = false;
    desenharFaixaGrupo(); render();
  }
  function desenharFaixaGrupo() {
    const box = $("sGrupo"), g = S.grupos;
    if (!g) { box.hidden = true; layout(); return; }
    box.hidden = false;
    const resta = mmss(g.fim - Date.now());
    let html;
    if (S.papel === "mentor") {
      html = `<span class="fg-tit">${I.grupos}${S.meuGrupo ? `Visitando a sala ${S.meuGrupo}` : `${g.lista.length} salas de networking abertas`}</span><span class="fg-tempo" data-tempo>${resta}</span>
        <span class="fg-acoes">${S.meuGrupo ? '<button type="button" class="mini-btn" data-gr="0">Sala principal</button>' : ""}${g.lista.map(x => x.n === S.meuGrupo ? "" : `<button type="button" class="mini-btn" data-gr="${x.n}">Visitar sala ${x.n}</button>`).join("")}<button type="button" class="mini-btn forte" data-gr="voltar">Chamar todos de volta</button></span>`;
    } else if (S.meuGrupo) {
      const meu = g.lista.find(x => x.n === S.meuGrupo);
      html = `<span class="fg-tit">${I.grupos}Sala de networking ${S.meuGrupo}</span><span class="fg-nomes">${meu ? meu.nomes.map(esc).join(", ") : ""}</span><span class="fg-tempo" data-tempo>${resta}</span>
        <span class="fg-acoes"><button type="button" class="mini-btn" data-gr="0">Voltar agora</button></span>`;
    } else {
      html = `<span class="fg-tit">${I.grupos}As salas de networking estão abertas</span><span class="fg-tempo" data-tempo>${resta}</span>`;
    }
    if (box._html !== html) { box.innerHTML = html; box._html = html; layout(); }
  }
  async function acaoGrupo(e) {
    const b = e.target.closest("[data-gr]"); if (!b) return;
    const v = b.dataset.gr;
    if (v === "voltar") {
      if (!S.demo) { try { await admin({ acao: "voltar_grupos", grupos: S.grupos ? S.grupos.lista.length : 0, sala: S.salaBase }); } catch (err) { toast(err.message); } }
      return encerrarGrupos("Você chamou todos de volta.");
    }
    if (S.papel !== "mentor" && v === "0") { const g = S.grupos; await moverPara(0); S.grupos = g; desenharFaixaGrupo(); return; }
    moverPara(+v);
  }
  async function encerrarGrupos(msg) {
    if (!S.grupos) return;
    S.grupos = null;
    if (S.demo) S.demoFiltro = null;
    if (S.meuGrupo || S.sala !== S.salaBase) await moverPara(0);
    else { if (S.demo) { limparGrade(); render(); } desenharFaixaGrupo(); }
    if (msg) toast(msg);
    sistema("Todos voltaram para a sala principal.");
  }

  /* ================= LEGENDAS E RESUMO ================= */
  function alternarLegendas() {
    if (S.papel === "mentor") {
      enviar({ t: "legendas", ativo: !S.salaLegendas });
    } else {
      if (!S.salaLegendas) return toast("As legendas aparecem quando o mentor ligar.");
      S.verLegendas = !S.verLegendas; desenharLegendas(); atualizarMenu();
    }
  }
  function definirLegendasSala(ativo, quem) {
    S.salaLegendas = ativo;
    if (ativo) { S.verLegendas = true; toast(S.papel === "mentor" ? "Legendas ligadas para todos." : "O mentor ligou as legendas."); if (!Reconhecimento) toast("Seu navegador não gera legendas da sua fala. Use Chrome ou Edge."); }
    else toast("Legendas desligadas.");
    sincronizarReconhecimento(); desenharLegendas(); atualizarMenu();
  }
  /** Cada participante transcreve a própria fala (no navegador) e envia para a sala. */
  function sincronizarReconhecimento() {
    const deve = S.salaLegendas && S.micOn && !!Reconhecimento && !S.encerrado && !S.ditando;
    if (deve && !S.rec) {
      const r = new Reconhecimento();
      r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
      let ultimo = 0;
      r.onresult = ev => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i], txt = res[0].transcript.trim(); if (!txt) continue;
          const agora = Date.now();
          if (res.isFinal) { enviar({ t: "leg", k: ++S.seqLeg, txt: txt.slice(0, 300), fin: true }); }
          else if (agora - ultimo > 350) { ultimo = agora; enviar({ t: "leg", k: S.seqLeg + 1, txt: txt.slice(-160), fin: false }); }
        }
      };
      r.onend = () => { if (S && S.rec === r) { try { r.start(); } catch (e) { S.rec = null; } } };
      r.onerror = ev => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { S.rec = null; toast("O navegador bloqueou a transcrição da sua fala."); } };
      S.rec = r;
      try { r.start(); } catch (e) { S.rec = null; }
    } else if (!deve && S.rec) { const r = S.rec; S.rec = null; try { r.stop(); } catch (e) { } }
  }
  function receberLegenda(m, id, nome) {
    const txt = String(m.txt || "").slice(0, 300); if (!txt) return;
    S.legendas.set(id, { nome, txt, at: Date.now(), fin: !!m.fin });
    if (m.fin) S.transcricao.push({ nome, texto: txt, hora: hora(), papel: doMentor(id) ? "mentor" : "aluno" });
    desenharLegendas();
  }
  function desenharLegendas() {
    const box = $("sLegendas");
    const visivel = S.salaLegendas && S.verLegendas;
    if (!visivel) { box.hidden = true; return; }
    const agora = Date.now();
    const linhas = [...S.legendas.values()].filter(l => agora - l.at < 6000).sort((a, b) => a.at - b.at).slice(-2);
    box.hidden = !linhas.length;
    const html = linhas.map(l => `<p><b>${esc(l.nome)}</b>${esc(l.txt)}</p>`).join("");
    if (box._html !== html) { box.innerHTML = html; box._html = html; }
  }

  function modalResumo() {
    const falas = S.transcricao.length;
    const encs = [...S.enquetes.values()].filter(q => q.votos.size).length;
    modal("Resumo do encontro", `
      <p class="nota">${falas ? `${falas} falas transcritas` : "Nenhuma fala transcrita ainda"}, ${encs} ${encs === 1 ? "enquete" : "enquetes"} e ${S.pitches.length} ${S.pitches.length === 1 ? "pitch" : "pitches"} até agora.
      ${!S.salaLegendas && !falas ? "Ligue as legendas no menu Mais para registrar a transcrição." : ""}</p>
      <div class="resumo-texto" id="rsTexto"></div>`,
      [{ rot: "Fechar", acao: () => { } }, { rot: "Gerar resumo", primario: true, acao: gerarResumo }]);
  }
  function dadosResumo() {
    return {
      sala: S.salaBase, titulo: S.op.titulo || "Encontro ao vivo", duracaoMin: Math.round((Date.now() - S.inicio) / 60000),
      participantes: pessoas().map(p => p.nome),
      transcricao: S.transcricao.slice(-4000),
      enquetes: [...S.enquetes.values()].map(q => { const c = contagem(q); return { pergunta: q.pergunta, resultados: q.opcoes.map((o, i) => ({ opcao: o, votos: c[i] })) }; }),
      pitches: S.pitches
    };
  }
  async function gerarResumo() {
    const box = $("rsTexto"), d = dadosResumo();
    if (!d.transcricao.length && !d.enquetes.length && !d.pitches.length) return erroModal("Ainda não há falas, enquetes ou pitches para resumir.");
    box.textContent = "Gerando o resumo…";
    let texto;
    if (S.demo || !CFG.resumoUrl) {
      texto = resumoLocal(d);
    } else {
      try {
        const cab = { "Content-Type": "application/json", Authorization: "Bearer " + S.token };
        if (CFG.supabaseAnonKey) cab.apikey = CFG.supabaseAnonKey;
        const r = await fetch(CFG.resumoUrl, { method: "POST", headers: cab, body: JSON.stringify(d) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || "O resumo não foi gerado.");
        texto = j.resumo;
      } catch (e) { box.textContent = ""; return erroModal(e.message); }
    }
    box.textContent = texto;
    const acoes = $("sModalAcoes"); acoes.innerHTML = "";
    const copiar = document.createElement("button"); copiar.className = "btn-sala vazado"; copiar.type = "button"; copiar.textContent = "Copiar";
    copiar.onclick = () => navigator.clipboard && navigator.clipboard.writeText(texto).then(() => toast("Resumo copiado."));
    const chat = document.createElement("button"); chat.className = "btn-sala"; chat.type = "button"; chat.textContent = "Enviar no chat";
    chat.onclick = () => { enviar({ t: "chat", texto: texto.slice(0, 500) }); toast("Resumo enviado no chat."); fecharModal(); };
    acoes.append(copiar, chat);
    return false;
  }
  function resumoLocal(d) {
    const linhas = [`${d.titulo}`, `Duração: ${d.duracaoMin} min · ${d.participantes.length} participantes`, ""];
    const destaques = [...new Map(d.transcricao.filter(l => l.texto.split(" ").length >= 6).map(l => [l.texto, l])).values()].slice(0, 6);
    if (destaques.length) { linhas.push("Falas em destaque:"); destaques.forEach(l => linhas.push(`• ${l.nome}: ${l.texto}`)); linhas.push(""); }
    if (d.enquetes.length) { linhas.push("Enquetes:"); d.enquetes.forEach(q => { const top = [...q.resultados].sort((a, b) => b.votos - a.votos)[0]; linhas.push(`• ${q.pergunta} → ${top.opcao} (${top.votos} votos)`); }); linhas.push(""); }
    if (d.pitches.length) { linhas.push("Pitches:"); d.pitches.forEach(p => linhas.push(`• ${p.nome} (${mmss(p.segundos * 1000)})`)); linhas.push(""); }
    linhas.push(S.demo ? "Resumo de demonstração. Com o LiveKit e a função resumo-encontro configurados, a IA organiza os pontos principais, as ideias citadas e os próximos passos." : "Resumo simples: configure resumoUrl em config.js para o resumo com IA.");
    return linhas.join("\n");
  }

  /* ================= TRANSMISSÃO ================= */
  function modalTransmitir() {
    if (S.txAtiva) {
      return modal("Transmissão ao vivo", `<p class="nota">O encontro está sendo transmitido agora${S.tx && S.tx.nomes ? " no " + S.tx.nomes.join(" e no ") : ""}.</p>`,
        [{ rot: "Continuar", acao: () => { } }, { rot: "Encerrar a transmissão", primario: true, acao: pararTransmissao }]);
    }
    modal("Transmitir ao vivo", `
      <p class="nota">O encontro vai ao ar com a câmera de quem estiver falando em destaque. Todos na sala veem o aviso “Ao vivo nas redes”. As chaves são usadas só agora e não ficam salvas.</p>
      <label class="check"><input type="checkbox" id="txYt"> YouTube</label>
      <div class="sub-campos"><label for="txYtChave">Chave da transmissão (YouTube Studio › Transmitir ao vivo)</label><input id="txYtChave" type="password" autocomplete="off" placeholder="xxxx-xxxx-xxxx-xxxx"></div>
      <label class="check"><input type="checkbox" id="txIg"> Instagram</label>
      <div class="sub-campos"><label for="txIgUrl">URL do servidor (Instagram › Transmissão ao vivo › Software)</label><input id="txIgUrl" placeholder="rtmps://edgetee-upload-….facebook.com:443/rtmp/">
      <label for="txIgChave">Chave da transmissão</label><input id="txIgChave" type="password" autocomplete="off"></div>`,
      [{ rot: "Cancelar", acao: () => { } }, { rot: "Começar a transmitir", primario: true, acao: iniciarTransmissao }]);
  }
  async function iniciarTransmissao() {
    const destinos = [], nomes = [];
    if ($("txYt").checked) {
      const k = $("txYtChave").value.trim(); if (!k) return erroModal("Informe a chave do YouTube.");
      destinos.push("rtmp://a.rtmp.youtube.com/live2/" + k); nomes.push("YouTube");
    }
    if ($("txIg").checked) {
      const u = $("txIgUrl").value.trim(), k = $("txIgChave").value.trim();
      if (!/^rtmps?:\/\//.test(u) || !k) return erroModal("Informe a URL do servidor e a chave do Instagram.");
      destinos.push(u.replace(/\/?$/, "/") + k); nomes.push("Instagram");
    }
    if (!destinos.length) return erroModal("Escolha onde transmitir.");
    try {
      let egressId = "";
      if (!S.demo) egressId = (await admin({ acao: "iniciar_transmissao", destinos })).egressId || "";
      S.tx = { egressId, nomes };
      enviar({ t: "tx", ativo: true, nomes });
      toast("Transmissão iniciada no " + nomes.join(" e no ") + ".");
    } catch (e) { return erroModal(e.message); }
  }
  async function pararTransmissao() {
    try { if (!S.demo && S.tx) await admin({ acao: "parar_transmissao", egressId: S.tx.egressId }); }
    catch (e) { return erroModal(e.message); }
    S.tx = null; enviar({ t: "tx", ativo: false });
  }

  /* ================= FUNDO DA CÂMERA ================= */
  function marcarFundo(tipo) { el.querySelectorAll("[data-fundo]").forEach(b => { const on = b.dataset.fundo === tipo; b.classList.toggle("sel", on); b.setAttribute("aria-checked", String(on)); b.setAttribute("role", "radio"); }); }
  async function escolherFundo(tipo) {
    if (tipo === S.fundo) return;
    const anterior = S.fundo;
    marcarFundo(tipo);
    try { await aplicarFundo(tipo); }
    catch (e) { console.error(e); marcarFundo(anterior); S.fundo = anterior; toast(e.message || "Não foi possível aplicar o fundo."); }
  }
  function criarProcessador(tipo) {
    const opcoes = { assetPaths: { tasksVisionFileSet: MEDIAPIPE, modelAssetPath: MEDIAPIPE + "/selfie_segmenter.tflite" } };
    return tipo === "desfoque" ? NoirFundos.BackgroundBlur(14, undefined, undefined, opcoes) : NoirFundos.VirtualBackground(IMG_NOIR, undefined, undefined, opcoes);
  }
  /** Aplica o fundo na câmera: na sala real, na trilha publicada; antes de entrar e no demo, numa cópia local. */
  async function aplicarFundo(tipo) {
    S.fundo = tipo;
    if (tipo !== "nenhum") {
      if (!S._avisoFundo) { S._avisoFundo = true; toast("Preparando o fundo…"); }
      await carregarFundos();
      if (!NoirFundos.supportsBackgroundProcessors()) throw new Error("Este navegador não suporta fundo virtual.");
    }
    if (S.room) {
      const pub = S.room.localParticipant.getTrackPublication(LK.Track.Source.Camera), t = pub && pub.track;
      if (!t) return;
      if (tipo === "nenhum") await t.stopProcessor(); else await t.setProcessor(criarProcessador(tipo));
      S.tiles.forEach(d => { if (d.classList.contains("local")) d.classList.toggle("sem-espelho", tipo === "noir"); });
      return render();
    }
    const v = S.preStream && S.preStream.getVideoTracks()[0];
    if (!v) { if (tipo !== "nenhum") toast("Ligue a câmera para usar o fundo."); return; }
    if (tipo === "nenhum") { await soltarFundoLocal(); }
    else {
      if (!S.lkCam) S.lkCam = new LK.LocalVideoTrack(v, undefined, true);
      await S.lkCam.setProcessor(criarProcessador(tipo));
      S.fundoTrack = S.lkCam.processor && S.lkCam.processor.processedTrack || null;
    }
    S.localVideo = null; aplicarPreview(); render();
  }
  async function soltarFundoLocal() {
    const t = S.lkCam; S.lkCam = null; S.fundoTrack = null; S.localVideo = null;
    if (t) { try { await t.stopProcessor(); } catch (e) { } }
  }


  /* ================= ASSISTENTE DE APRESENTAÇÃO ================= */
  const TOPICO_APRES = "noir-apres";
  const chaveLocal = () => "noir-apres:" + S.salaBase;
  const motorIA = () => (S.demo || !CFG.assistenteUrl)
    ? NoirApresentacao.motorDemonstracao()
    : NoirApresentacao.motorServidor({ url: CFG.assistenteUrl, token: () => S.token, chaveAnon: CFG.supabaseAnonKey, sala: S.salaBase });
  const NOME_MOTOR = { demonstracao: "Modo demonstração", claude: "IA: Claude", endeavor: "IA: Endeavor", servidor: "IA" };

  async function carregarApresentacao() {
    let salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(chaveLocal()) || "null"); } catch (e) { }
    try {
      if (salvo && salvo.doc) {
        S.apres.doc = NoirApresentacao.validar(salvo.doc);
        S.apres.atual = Math.min(salvo.atual | 0, S.apres.doc.slides.length - 1);
        S.apres.conversa = Array.isArray(salvo.conversa) ? salvo.conversa.slice(-20) : [];
      } else if (!S.demo && CFG.assistenteUrl) {
        const doc = await motorIA().ultima();
        if (doc && S && !S.apres.doc) { S.apres.doc = doc; S.apres.conversa = [{ quem: "ia", texto: "Recuperei a última apresentação desta sala." }]; }
      }
    } catch (e) { }
    if (S) { S.apres.versao++; desenharPainelSlides(); atualizarMenu(); }
  }
  function salvarLocal() {
    try { localStorage.setItem(chaveLocal(), JSON.stringify({ doc: S.apres.doc, atual: S.apres.atual, conversa: S.apres.conversa.slice(-20) })); } catch (e) { }
  }

  function contextoEncontro() {
    return {
      encontro: S.op.titulo || "",
      transcricao: S.transcricao.slice(-60).map(l => ({ nome: l.nome, texto: l.texto })),
      enquetes: [...S.enquetes.values()].map(q => { const c = contagem(q); return { pergunta: q.pergunta, resultados: q.opcoes.map((o, i) => ({ opcao: o, votos: c[i] })) }; })
    };
  }

  async function pedirAssistente(texto) {
    texto = String(texto || "").trim();
    const ap = S.apres;
    if (!texto || ap.ocupado) return;
    $("apTexto").value = "";
    ap.conversa.push({ quem: "voce", texto });
    ap.ocupado = true; desenharPainelSlides();
    const estado = S;
    try {
      const r = await motorIA().gerar({ instrucao: texto, apresentacao: ap.doc, slideAtual: ap.atual, contexto: contextoEncontro() });
      if (S !== estado || S.encerrado) return;
      ap.motor = r.motor || "";
      if (r.apresentacao) {
        const doc = NoirApresentacao.validar(r.apresentacao);
        aplicarApresentacao(doc, true, Number.isInteger(r.foco) ? r.foco : null);
      }
      ap.conversa.push({ quem: "ia", texto: r.mensagem || "Pronto.", motor: r.motor });
    } catch (e) {
      if (S !== estado) return;
      ap.conversa.push({ quem: "erro", texto: e.message || "O assistente não conseguiu responder." });
    }
    ap.ocupado = false; salvarLocal(); desenharPainelSlides();
  }

  function aplicarApresentacao(doc, registrar, foco) {
    const ap = S.apres;
    if (registrar && ap.doc) { ap.hist.push(ap.doc); if (ap.hist.length > 30) ap.hist.shift(); ap.fut = []; }
    ap.doc = doc;
    ap.atual = Math.min(Math.max(foco != null ? foco : ap.atual, 0), doc.slides.length - 1);
    ap.versao++;
    if (ap.aoVivo) publicarApresentacao();
    salvarLocal(); desenharPainelSlides(); atualizarMenu(); render();
  }
  function voltarVersao(direcao) {
    const ap = S.apres, de = direcao < 0 ? ap.hist : ap.fut, para = direcao < 0 ? ap.fut : ap.hist;
    if (!de.length) return;
    para.push(ap.doc);
    aplicarApresentacao(de.pop(), false, null);
    toast(direcao < 0 ? "Alteração desfeita." : "Alteração refeita.");
  }
  function irParaSlide(i) {
    const ap = S.apres;
    if (!ap.doc) return;
    const novo = Math.min(Math.max(i, 0), ap.doc.slides.length - 1);
    if (novo === ap.atual) return;
    ap.atual = novo; ap.versao++;
    if (ap.aoVivo) enviar({ t: "apres_nav", rev: ap.rev, atual: novo });
    salvarLocal(); desenharPainelSlides(); render();
  }
  function alternarApresentar() {
    const ap = S.apres;
    if (!ap.doc) return toast("Peça uma apresentação ao assistente primeiro.");
    ap.aoVivo = !ap.aoVivo;
    if (ap.aoVivo) { publicarApresentacao(); toast("Apresentando para todos. Use as setas do teclado para trocar de slide."); }
    else { enviar({ t: "apres_vivo", ativo: false }); toast("Você parou de apresentar."); }
    desenharPainelSlides(); atualizarMenu(); render();
  }
  /** Envia a apresentação inteira (sem as anotações do mentor) para a sala ou para uma pessoa. */
  function publicarApresentacao(destino) {
    const ap = S.apres;
    if (!ap.doc) return;
    ap.rev++;
    if (S.demo || !S.room) return;
    const pacote = JSON.stringify({ t: "apres_doc", rev: ap.rev, atual: ap.atual, aoVivo: ap.aoVivo, doc: NoirApresentacao.semNotas(ap.doc) });
    S.room.localParticipant.sendText(pacote, { topic: TOPICO_APRES, destinationIdentities: destino ? [destino] : undefined })
      .catch(e => { console.error(e); toast("Não foi possível enviar a apresentação à turma."); });
  }
  function receberApresentacao(m, id) {
    if (!S || S.encerrado || !m || m.t !== "apres_doc" || id === meuId() || !doMentor(id)) return;
    if ((m.rev | 0) < S.apres.rev) return;
    let doc;
    try { doc = NoirApresentacao.validar(m.doc); } catch (e) { return; }
    const estava = S.apres.aoVivo;
    Object.assign(S.apres, { doc, rev: m.rev | 0, aoVivo: !!m.aoVivo, atual: Math.min(Math.max(m.atual | 0, 0), doc.slides.length - 1) });
    S.apres.versao++;
    if (!estava && S.apres.aoVivo) toast("O mentor começou a apresentar.");
    render();
  }

  /* tile do palco */
  function criarTileApres() {
    const d = document.createElement("div");
    d.className = "tile tela apres com-video";
    d.innerHTML = `<div class="slide-host"></div><div class="ap-tile-nav so-mentor"><button type="button" data-ap="-1" aria-label="Slide anterior">${I.ant}</button><span></span><button type="button" data-ap="1" aria-label="Próximo slide">${I.prox}</button></div>`;
    d.querySelector(".ap-tile-nav").onclick = e => { const b = e.target.closest("[data-ap]"); if (b) irParaSlide(S.apres.atual + Number(b.dataset.ap)); };
    return d;
  }
  function atualizarTileApres(d) {
    const ap = S.apres;
    if (d._versao === ap.versao || !ap.doc) return;
    d._versao = ap.versao;
    const total = ap.doc.slides.length;
    d.querySelector(".slide-host").replaceChildren(NoirApresentacao.renderizar(ap.doc.slides[ap.atual], { numero: ap.atual + 1, total }));
    d.querySelector(".ap-tile-nav span").textContent = `${ap.atual + 1} / ${total}`;
  }

  /* painel do mentor */
  function desenharPainelSlides() {
    if (!S || S.papel !== "mentor") return;
    const ap = S.apres, doc = ap.doc, total = doc ? doc.slides.length : 0;
    $("apEstado").textContent = ap.aoVivo ? "Ao vivo para todos" : doc ? "Rascunho: só você vê" : "Sem apresentação";
    $("apEstado").classList.toggle("vivo", ap.aoVivo);
    const motor = ap.motor || (S.demo || !CFG.assistenteUrl ? "demonstracao" : "");
    $("apMotor").textContent = NOME_MOTOR[motor] || "";
    const previa = $("apPrevia");
    if (previa._versao !== ap.versao) {
      previa._versao = ap.versao;
      if (doc) previa.replaceChildren(NoirApresentacao.renderizar(doc.slides[ap.atual], { numero: ap.atual + 1, total }));
      else previa.innerHTML = '<p class="vazio">Peça uma apresentação ao assistente. Ela aparece aqui antes de ir para a turma.</p>';
      const minis = $("apMinis");
      minis.replaceChildren(...(doc ? doc.slides.map((s, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ap-mini" + (i === ap.atual ? " sel" : ""); b.dataset.slide = i;
        b.setAttribute("role", "option"); b.setAttribute("aria-selected", String(i === ap.atual));
        b.setAttribute("aria-label", `Slide ${i + 1}${s.titulo ? ": " + s.titulo : ""}`);
        b.appendChild(NoirApresentacao.renderizar(s, { numero: i + 1, total }));
        return b;
      }) : []));
      const sel = minis.querySelector(".sel"); if (sel) sel.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    $("apPos").textContent = doc ? `${ap.atual + 1} / ${total}` : "0 / 0";
    $("apAnt").disabled = !doc || ap.atual === 0;
    $("apProx").disabled = !doc || ap.atual >= total - 1;
    $("apDesfazer").disabled = !ap.hist.length;
    $("apRefazer").disabled = !ap.fut.length;
    $("apPdf").disabled = !doc;
    $("apVivo").disabled = !doc;
    $("apVivo").textContent = ap.aoVivo ? "Parar de apresentar" : "Apresentar para todos";
    $("apVivo").classList.toggle("vazado", ap.aoVivo);
    const notas = doc && doc.slides[ap.atual].notas;
    $("apNotas").hidden = !notas; $("apNotas").textContent = notas ? "Anotação: " + notas : "";

    const conv = $("apConversa");
    const html = ap.conversa.slice(-20).map(c => `<div class="ap-msg ${c.quem}"><p>${esc(c.texto)}</p></div>`).join("") + (ap.ocupado ? '<div class="ap-msg ia carregando"><p>Criando…</p></div>' : "");
    if (conv._html !== html) { conv._html = html; conv.innerHTML = html; const r = $("apRolagem"); r.scrollTop = r.scrollHeight; }
    const sugestoes = doc
      ? [["Deixe este slide mais curto"], ["Adicione um slide de próximos passos depois deste"], ["Transforme o que foi falado agora em um slide"], ["Mude o título deste slide para ", true]]
      : [["Crie 5 slides sobre o tema do encontro"], ["Transforme o que foi falado até agora em slides"], ["Monte um slide com o resultado da última enquete"]];
    const sh = sugestoes.map(([t, c]) => `<button type="button" data-sug="${esc(t)}"${c ? ' data-completar="1"' : ""}>${esc(c ? t + "…" : t)}</button>`).join("");
    if ($("apSugestoes")._html !== sh) { $("apSugestoes")._html = sh; $("apSugestoes").innerHTML = sh; }
    $("apEnviar").disabled = ap.ocupado;
    $("apForm").classList.toggle("ocupado", ap.ocupado);
  }

  function ditarPedido() {
    if (!Reconhecimento) return toast("Seu navegador não permite ditar. Use Chrome, Edge ou Safari.");
    if (S.ditando) { if (S._ditado) S._ditado.stop(); return; }
    if (S.rec) { const r = S.rec; S.rec = null; try { r.stop(); } catch (e) { } }
    const r = new Reconhecimento(), campo = $("apTexto"), antes = campo.value;
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = false;
    S.ditando = true; S._ditado = r; $("apDitar").classList.add("ativo");
    r.onresult = ev => { campo.value = (antes ? antes + " " : "") + [...ev.results].map(x => x[0].transcript).join(""); };
    r.onerror = ev => { if (ev.error === "not-allowed") toast("O navegador bloqueou o microfone para ditado."); };
    r.onend = () => { S.ditando = false; S._ditado = null; $("apDitar").classList.remove("ativo"); sincronizarReconhecimento(); campo.focus(); };
    try { r.start(); } catch (e) { r.onend(); }
  }

  function baixarPdf() {
    const doc = S.apres.doc; if (!doc) return;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1280px;height:720px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);
    const d = iframe.contentDocument;
    d.open();
    d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.titulo)}</title><link rel="stylesheet" href="${BASE}apresentacao.css"><style>@page{size:1280px 720px;margin:0}html,body{margin:0;background:#0a0a0a}.slide{width:1280px;break-after:page}</style></head><body></body></html>`);
    d.close();
    doc.slides.forEach((s, i) => d.body.appendChild(d.importNode(NoirApresentacao.renderizar(s, { numero: i + 1, total: doc.slides.length }), true)));
    const imprimir = () => (d.fonts ? d.fonts.ready : Promise.resolve()).then(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 60000); });
    const css = d.querySelector("link");
    if (css.sheet) imprimir(); else { css.onload = imprimir; css.onerror = imprimir; }
    toast("Escolha “Salvar como PDF” na janela de impressão.");
  }

  /* ---------------- ações do mentor (servidor) ---------------- */
  async function admin(corpo) {
    if (!CFG.adminUrl) throw new Error("Configure adminUrl em config.js para essa ação.");
    const cab = { "Content-Type": "application/json", Authorization: "Bearer " + S.token };
    if (CFG.supabaseAnonKey) cab.apikey = CFG.supabaseAnonKey;
    const r = await fetch(CFG.adminUrl, { method: "POST", headers: cab, body: JSON.stringify(Object.assign({ sala: S.sala }, corpo)) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "A ação não foi concluída.");
    return j;
  }
  function marcarGravando(on) {
    S.gravando = on;
    if (on && !S.inicioRec) S.inicioRec = Date.now();
    if (!on) S.inicioRec = 0;
    $("sRec").classList.toggle("on", on);
    $("sGravar").classList.toggle("rec-on", on);
    $("sGravar").setAttribute("aria-pressed", String(on));
    $("sGravar").querySelector(".rt").textContent = on ? "Parar" : "Gravar";
  }
  async function alternarGravacao() {
    if (S.papel !== "mentor") return;
    const btn = $("sGravar"); btn.disabled = true;
    try {
      if (!S.gravando) {
        if (!S.demo) { const j = await admin({ acao: "iniciar_gravacao", sala: S.salaBase }); S.egressId = j.egressId || ""; }
        marcarGravando(true); toast("Gravação iniciada.");
      } else {
        const dur = Date.now() - S.inicioRec;
        if (!S.demo) await admin({ acao: "parar_gravacao", egressId: S.egressId, sala: S.salaBase });
        marcarGravando(false);
        toast(S.demo ? "Gravação salva em Live para gravado." : "Gravação encerrada. O vídeo chega em Live para gravado em alguns minutos.");
        if (S.op.onGravacao) S.op.onGravacao({ titulo: S.op.titulo || "Encontro ao vivo", duracaoMin: Math.max(1, Math.round(dur / 60000)), demo: S.demo });
      }
    } catch (e) { toast(e.message); }
    btn.disabled = false;
  }
  async function encerrarParaTodos() {
    if (!confirm("Encerrar o encontro para todos os participantes?")) return;
    if (S.gravando) await alternarGravacao();
    if (S.txAtiva) await pararTransmissao();
    if (S.demo) return finalizar("encerrado");
    try {
      if (S.grupos) await admin({ acao: "voltar_grupos", grupos: S.grupos.lista.length, sala: S.salaBase }).catch(() => { });
      await admin({ acao: "encerrar", sala: S.sala });
    } catch (e) { toast(e.message); }
  }
  function sair() {
    if (S.papel === "mentor" && S.gravando && !confirm("A gravação continua ativa sem você. Sair mesmo assim?")) return;
    if (S.room) S.room.disconnect(); else finalizar("saiu");
  }

  /* ---------------- demonstração ---------------- */
  const FALAS = {
    "Léo Figueiredo": ["Hoje a gente vai falar de negociação e influência.", "Antes de pedir qualquer coisa, entenda o que o outro precisa.", "Quem faz a melhor pergunta conduz a negociação."],
    "Ana Souza": ["No meu caso o cliente sempre pede desconto logo no primeiro contato.", "Vou testar fazer mais perguntas antes de apresentar o preço."],
    "Carlos Lima": ["Eu costumo travar quando o investidor pergunta sobre o valuation.", "A ideia de ancorar o valor primeiro faz muito sentido para o meu pitch."],
    "Marina Alves": ["Na minha equipe a resistência vem do medo de perder espaço."]
  };
  function iniciarDemo() {
    const nomes = S.papel === "mentor"
      ? [["Ana Souza", "aluno", true], ["Carlos Lima", "aluno", true], ["Marina Alves", "aluno", false]]
      : [["Léo Figueiredo", "mentor", true], ["Carlos Lima", "aluno", true], ["Marina Alves", "aluno", false]];
    S.demoPessoas = [{ id: "voce", local: true }].concat(nomes.map((n, i) => ({ id: "sim" + i, nome: n[0], papel: n[1], mic: n[2], fala: 0 })));
    S.timers.push(setInterval(() => {
      const visiveis = S.demoFiltro ? S.demoPessoas.filter(d => S.demoFiltro.has(d.id)) : S.demoPessoas;
      const comMic = visiveis.filter(d => !d.local && d.mic);
      S.demoFalando = Math.random() < .25 || !comMic.length ? "" : comMic[Math.floor(Math.random() * comMic.length)].id;
      const d = S.demoPessoas.find(x => x.id === S.demoFalando);
      if (d && S.salaLegendas) simularFala(d);
      render();
    }, 2600));
    const outro = S.demoPessoas[2];
    S.timers.push(setTimeout(() => outro && receber({ t: "chat", texto: "Boa noite! Áudio e vídeo ok por aqui." }, outro.id, outro.nome), 3500));
    S.timers.push(setTimeout(() => { const m = S.demoPessoas[3]; if (m) receber({ t: "mao", ativa: true }, m.id, m.nome); }, 7000));
    // no demo do aluno, o mentor simulado liga as legendas e lança uma enquete
    if (S.papel === "aluno") {
      const leo = S.demoPessoas[1];
      S.timers.push(setTimeout(() => receber({ t: "legendas", ativo: true }, leo.id, leo.nome), 5000));
      S.timers.push(setTimeout(() => receber({ t: "enquete", id: "demo1", pergunta: "Qual é o seu maior desafio em negociação?", opcoes: ["Falar de preço", "Lidar com objeções", "Fechar o acordo"], aoVivo: true }, leo.id, leo.nome), 9000));
      S.timers.push(setTimeout(() => S.demoPessoas.slice(2).forEach((d, i) => receber({ t: "voto", id: "demo1", op: i % 3 }, d.id, d.nome)), 11000));
      S.timers.push(setTimeout(async () => {
        const r = await NoirApresentacao.motorDemonstracao().gerar({ instrucao: "Crie 5 slides sobre negociação e influência", apresentacao: null, contexto: { encontro: S.op.titulo } });
        receberApresentacao({ t: "apres_doc", rev: 1, atual: 0, aoVivo: true, doc: NoirApresentacao.semNotas(r.apresentacao) }, leo.id);
      }, 15000));
      S.timers.push(setTimeout(() => receber({ t: "apres_nav", rev: 1, atual: 1 }, leo.id, leo.nome), 21000));
    }
  }
  function simularFala(d) {
    const lista = FALAS[d.nome]; if (!lista) return;
    const frase = lista[d.fala++ % lista.length], palavras = frase.split(" ");
    palavras.forEach((_, i) => S.timers.push(setTimeout(() => {
      if (!S || S.encerrado) return;
      receber({ t: "leg", txt: palavras.slice(0, i + 1).join(" "), fin: i === palavras.length - 1 }, d.id, d.nome);
    }, 180 * i)));
  }

  /* ---------------- fim ---------------- */
  function finalizar(motivo) {
    if (!S || S.encerrado) return;
    S.encerrado = true;
    S.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    sincronizarReconhecimento();
    if (S.telaStream) S.telaStream.getTracks().forEach(t => t.stop());
    pararPreview();
    limparGrade();
    if (S.room) { S.room.removeAllListeners(); S.room = null; }
    ["sGrupo", "sCrono", "sEnquete", "sLegendas", "sMenu", "sModal"].forEach(id => $(id).hidden = true);
    $("sTx").classList.remove("on");
    const R = LK && LK.DisconnectReason;
    let tit = "Você saiu do encontro", txt = "Obrigado pela participação.";
    if (motivo === "encerrado" || (R && motivo === R.ROOM_DELETED)) { tit = "Encontro encerrado"; txt = S.papel === "mentor" ? "Você encerrou o encontro para todos." : "O mentor encerrou o encontro."; }
    else if (R && motivo === R.PARTICIPANT_REMOVED) { tit = "Você foi removido"; txt = "O mentor removeu você deste encontro."; }
    else if (motivo === "conexao" || (R && motivo !== undefined && motivo !== R.CLIENT_INITIATED && motivo !== "saiu")) { tit = "Conexão perdida"; txt = "A conexão com a sala caiu. Volte e entre de novo."; }
    if (S.demo && S.gravando && S.op.onGravacao) S.op.onGravacao({ titulo: S.op.titulo || "Encontro ao vivo", duracaoMin: Math.max(1, Math.round((Date.now() - S.inicioRec) / 60000)), demo: true });
    $("sFimTit").textContent = tit; $("sFimTxt").textContent = txt;
    $("sFim").classList.add("on");
    marcarGravando(false);
  }
  function fechar() {
    if (S && S.inicio && !S.encerrado) return sair();
    if (S) pararPreview();
    el.classList.remove("aberta", "no-ar", "lateral-on");
    $("sFim").classList.remove("on");
    document.body.style.overflow = "";
    const cb = S && S.op.onSair; S = null;
    if (cb) cb();
  }

  function tique() {
    if (!S || !S.inicio || S.encerrado) return;
    $("sDur").textContent = mmss(Date.now() - S.inicio);
    if (S.gravando) $("sRec").querySelector("span").textContent = "Gravando " + mmss(Date.now() - S.inicioRec);
    if (S.grupos) {
      if (Date.now() >= S.grupos.fim) encerrarGrupos("O tempo das salas de networking acabou.");
      else { const t = $("sGrupo").querySelector("[data-tempo]"); if (t) t.textContent = mmss(S.grupos.fim - Date.now()); }
    }
  }
  function tiqueRapido() {
    if (!S || S.encerrado) return;
    if (S.crono) desenharCrono();
    if (S.salaLegendas) desenharLegendas();
  }
  let toastT;
  function toast(t) { const d = $("sToast"); d.textContent = t; d.classList.add("ver"); clearTimeout(toastT); toastT = setTimeout(() => d.classList.remove("ver"), 2800); }

  window.NoirSala = { abrir, modoReal, config: CFG };
})();
