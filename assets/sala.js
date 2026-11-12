/* Noir Hub · sala ao vivo com LiveKit
 *
 * Uso: NoirSala.abrir({ sala, titulo, quando, nome, papel: "mentor" | "aluno",
 *                       gravarAoEntrar, onGravacao(info), onSair() })
 *
 * Com livekitUrl e tokenUrl preenchidos em config.js, conecta numa sala LiveKit real.
 * Sem eles, abre em modo demonstração: câmera, microfone e tela reais, demais participantes simulados.
 */
(function () {
  "use strict";

  const CFG = Object.assign({ livekitUrl: "", tokenUrl: "", adminUrl: "", supabaseAnonKey: "" }, window.NOIR_CONFIG || {});
  const modoReal = () => !!(CFG.livekitUrl && CFG.tokenUrl);
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "assets/sala.js";
  const SDK_SRC = SCRIPT_SRC.replace(/sala\.js(\?.*)?$/, "vendor/livekit-client.umd.js");
  const enc = new TextEncoder(), dec = new TextDecoder();
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
    sair: svg('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>')
  };
  const LOGO = '<span class="noir" aria-label="Projeto N.O.I.R."><span class="noir-mark"><span class="noir-no"><b>NO</b><i></i></span><span class="noir-ir"><i></i><b>IR</b></span></span></span>';
  const ini = n => (n || "?").trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mmss = ms => { const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0"); };

  function carregarSDK() {
    if (window.LivekitClient) return Promise.resolve(LK = window.LivekitClient);
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = SDK_SRC; s.onload = () => ok(LK = window.LivekitClient); s.onerror = () => falha(new Error("Não foi possível carregar o LiveKit."));
      document.head.appendChild(s);
    });
  }

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
    <div class="meta"><span class="selo-demo" id="sSeloDemo">Demonstração</span><span class="selo-rec" id="sRec"><i></i><span>Gravando</span></span><span class="dur" id="sDur">00:00</span><span id="sQtd"></span></div>
  </header>
  <button class="btn-sala aviso-audio" id="sAudio" type="button">Ativar o áudio</button>
  <div class="sala-corpo">
    <main class="palco" id="sPalco"><div class="grade" id="sGrade"></div></main>
    <aside class="lateral" id="sLateral" aria-label="Chat e participantes">
      <div class="abas" role="tablist"><button type="button" data-aba="chat" class="sel" role="tab">Chat</button><button type="button" data-aba="pessoas" role="tab">Participantes</button><button type="button" class="fechar" id="sFecharLat" aria-label="Fechar painel">×</button></div>
      <div class="painel-l ativo" id="painelChat"><div class="msgs" id="sMsgs" aria-live="polite"><p class="vazio">As mensagens do encontro aparecem aqui.</p></div>
        <form class="enviar" id="sEnviar"><input id="sTexto" placeholder="Escreva uma mensagem" maxlength="500" autocomplete="off" aria-label="Mensagem"><button type="submit">Enviar</button></form></div>
      <div class="painel-l" id="painelPessoas"></div>
    </aside>
  </div>
  <nav class="controles-sala" aria-label="Controles do encontro">
    ${ctl("sMic", "Microfone", I.mic)}${ctl("sCam", "Câmera", I.cam)}${ctl("sTela", "Tela", I.tela)}${ctl("sMao", "Mão", I.mao)}
    <span class="sep-ctl"></span>
    ${ctl("sChat", "Chat", I.chat)}${ctl("sPessoas", "Pessoas", I.pessoas)}
    <span class="sep-ctl so-mentor"></span>
    ${ctl("sGravar", "Gravar", I.rec, "so-mentor")}${ctl("sEncerrar", "Encerrar", I.encerrar, "so-mentor sair")}
    ${ctl("sSair", "Sair", I.sair)}
  </nav>
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
    $("sFecharLat").onclick = () => el.classList.remove("lateral-on");
    el.querySelectorAll(".abas [data-aba]").forEach(b => b.onclick = () => abrirLateral(b.dataset.aba, true));
    $("sEnviar").onsubmit = e => { e.preventDefault(); const t = $("sTexto").value.trim(); if (!t) return; enviar({ t: "chat", texto: t }); $("sTexto").value = ""; };
    $("sGravar").onclick = alternarGravacao;
    $("sEncerrar").onclick = encerrarParaTodos;
    $("sSair").onclick = () => sair();
    $("sFimOk").onclick = () => fechar();
    $("sAudio").onclick = () => S.room && S.room.startAudio().then(() => $("sAudio").classList.remove("on"));
    $("painelPessoas").onclick = acaoPessoa;
    document.addEventListener("keydown", e => { if (e.key === "Escape" && el.classList.contains("lateral-on")) el.classList.remove("lateral-on"); });
    window.addEventListener("beforeunload", () => { if (S && S.room) S.room.disconnect(); });
    new ResizeObserver(() => S && layout()).observe($("sPalco"));
  }

  function novoEstado(op) {
    return {
      op, papel: op.papel === "mentor" ? "mentor" : "aluno", sala: op.sala || "noir-encontro", nome: op.nome || "",
      micOn: true, camOn: true, camId: "", micId: "", preStream: null, telaStream: null,
      room: null, token: "", demo: !modoReal(), tiles: new Map(), maos: new Map(), maoMinha: false,
      gravando: false, egressId: "", inicioRec: 0, inicio: 0, timers: [], naoLidas: 0, aba: "chat",
      demoPessoas: [], demoFalando: "", nivelLocal: 0, encerrado: false
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

  function aplicarPreview(msg) {
    const v = S.preStream && S.preStream.getVideoTracks()[0], a = S.preStream && S.preStream.getAudioTracks()[0];
    if (!v) S.camOn = false; if (!a) S.micOn = false;
    if (v) v.enabled = S.camOn; if (a) a.enabled = S.micOn;
    const video = $("sPreVideo");
    video.srcObject = v ? new MediaStream([v]) : null;
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
      if (S.audioCtx !== ctx) return;
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
    if (S.preStream) S.preStream.getTracks().forEach(t => t.stop());
    S.preStream = null;
    $("sPreVideo").srcObject = null;
  }

  /* ---------------- entrar ---------------- */
  async function entrar() {
    S.nome = $("sNome").value.trim();
    if (!S.nome) { $("sErro").textContent = "Informe seu nome para entrar."; $("sNome").focus(); return; }
    const btn = $("sEntrar"); btn.disabled = true; btn.textContent = "Entrando…"; $("sErro").textContent = "";
    try {
      if (S.demo) iniciarDemo(); else await conectar();
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = "Entrar no encontro";
      $("sErro").textContent = e.message || "Não foi possível entrar no encontro.";
      if (S.room) { S.room.removeAllListeners(); S.room.disconnect(); S.room = null; }
      return;
    }
    S.inicio = Date.now();
    S.timers.push(setInterval(tique, 1000)); tique();
    el.classList.add("no-ar");
    $("sTitulo").textContent = S.op.titulo || "Encontro ao vivo";
    $("sSeloDemo").style.display = S.demo ? "" : "none";
    sistema("Você entrou no encontro.");
    render();
    if (S.papel === "mentor" && $("sGravarAo").checked) alternarGravacao();
  }

  async function conectar() {
    await carregarSDK();
    const cab = { "Content-Type": "application/json" };
    if (CFG.supabaseAnonKey) { cab.apikey = CFG.supabaseAnonKey; cab.Authorization = "Bearer " + (S.op.accessToken || CFG.supabaseAnonKey); }
    let resp, dados = {};
    try {
      resp = await fetch(CFG.tokenUrl, { method: "POST", headers: cab, body: JSON.stringify({ sala: S.sala, nome: S.nome, papel: S.papel, codigoMentor: $("sCodigo").value }) });
      dados = await resp.json().catch(() => ({}));
    } catch (e) { throw new Error("Sem conexão com o servidor de acesso. Verifique sua internet."); }
    if (!resp.ok || !dados.token) throw new Error(dados.erro || "Não foi possível liberar seu acesso à sala.");
    S.token = dados.token;

    const room = new LK.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: LK.VideoPresets.h720.resolution } });
    S.room = room;
    ligarEventos(room);
    try { await room.connect(dados.url || CFG.livekitUrl, S.token); }
    catch (e) { console.error(e); throw new Error("Não foi possível conectar à sala do LiveKit. Confira sua internet e o endereço em config.js."); }
    const camOn = S.camOn, micOn = S.micOn;
    pararPreview();
    try { await room.localParticipant.setMicrophoneEnabled(micOn, S.micId ? { deviceId: S.micId } : undefined); } catch (e) { S.micOn = false; toast("Não foi possível ligar o microfone."); }
    try { await room.localParticipant.setCameraEnabled(camOn, S.camId ? { deviceId: S.camId } : undefined); } catch (e) { S.camOn = false; toast("Não foi possível ligar a câmera."); }
    if (!room.canPlaybackAudio) $("sAudio").classList.add("on");
  }

  function ligarEventos(room) {
    const E = LK.RoomEvent;
    room
      .on(E.ParticipantConnected, p => { render(); sistema(`${nomeDe(p)} entrou.`); })
      .on(E.ParticipantDisconnected, p => { S.maos.delete(p.identity); render(); sistema(`${nomeDe(p)} saiu.`); })
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
      .on(E.RecordingStatusChanged, gravando => { if (S.papel === "mentor") marcarGravando(gravando); })
      .on(E.Disconnected, motivo => finalizar(motivo));
  }

  const nomeDe = p => (p && (p.name || p.identity)) || "Participante";
  function papelDe(p) {
    if (p.attributes && p.attributes.papel) return p.attributes.papel;
    try { return JSON.parse(p.metadata || "{}").papel || ""; } catch (e) { return ""; }
  }
  const meuId = () => S.demo ? "voce" : S.room.localParticipant.identity;

  /* ---------------- participantes ---------------- */
  function pessoas() {
    if (S.demo) {
      return S.demoPessoas.map(d => {
        if (d.local) {
          const v = S.preStream && S.preStream.getVideoTracks()[0];
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
    S._raf = requestAnimationFrame(() => { S._raf = 0; if (S.inicio && !S.encerrado) desenhar(); });
  }

  function desenhar() {
    const ps = pessoas();
    const ordem = [...ps].sort((a, b) => (b.papel === "mentor") - (a.papel === "mentor"));
    const tiles = [];
    ordem.forEach(p => { if (p.tela) tiles.push({ chave: p.id + ":tela", p, tela: true, video: p.tela }); });
    ordem.forEach(p => tiles.push({ chave: p.id, p, tela: false, video: p.cam }));
    const grade = $("sGrade"), vistos = new Set();
    tiles.forEach((t, i) => {
      let d = S.tiles.get(t.chave);
      if (!d) { d = criarTile(); S.tiles.set(t.chave, d); }
      vistos.add(t.chave);
      atualizarTile(d, t);
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
    if (d._lk) { d._lk.detach(v); d._lk = null; }
    if (v.srcObject) v.srcObject = null;
  }

  function layout() {
    const g = $("sGrade"), pal = $("sPalco");
    if (!g || !S || !S.inicio) return;
    const tiles = [...g.children];
    if (pal.classList.contains("com-tela")) { g.style.gridTemplateColumns = ""; g.style.gridAutoRows = ""; g.style.justifyContent = ""; return; }
    const cs = getComputedStyle(pal), gap = parseFloat(getComputedStyle(g).gap) || 10;
    const W = pal.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = pal.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
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
      S.micOn = !S.micOn; a.enabled = S.micOn; return render();
    }
    const lp = S.room.localParticipant;
    try { await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled); } catch (e) { toast("Não foi possível acessar o microfone."); }
    render();
  }
  async function alternarCam() {
    if (S.demo) {
      const v = S.preStream && S.preStream.getVideoTracks()[0];
      if (!v) return toast("Nenhuma câmera disponível.");
      S.camOn = !S.camOn; v.enabled = S.camOn; return render();
    }
    const lp = S.room.localParticipant;
    try { await lp.setCameraEnabled(!lp.isCameraEnabled, S.camId ? { deviceId: S.camId } : undefined); } catch (e) { toast("Não foi possível acessar a câmera."); }
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
    if (aba === "chat") { S.naoLidas = 0; marcarNaoLidas(); setTimeout(() => $("sTexto").focus(), 50); }
    layout();
  }
  function marcarNaoLidas() { const b = $("sChat").querySelector(".badge"); b.textContent = S.naoLidas; b.classList.toggle("on", S.naoLidas > 0); }

  /* ---------------- mensagens ---------------- */
  function enviar(m) {
    if (S.demo) return receber(m, "voce", S.nome);
    S.room.localParticipant.publishData(enc.encode(JSON.stringify(m)), { reliable: true, topic: "noir" }).catch(() => toast("Mensagem não enviada."));
    receber(m, meuId(), S.nome);
  }
  function receber(m, id, nome) {
    if (!m || !m.t) return;
    const deMim = id === meuId();
    if (m.t === "chat") {
      adicionarMsg(nome + (deMim ? " (você)" : ""), String(m.texto || "").slice(0, 500));
      const vendo = el.classList.contains("lateral-on") && S.aba === "chat";
      if (!deMim && !vendo) { S.naoLidas++; marcarNaoLidas(); toast(`${nome}: ${String(m.texto).slice(0, 60)}`); }
    } else if (m.t === "mao") {
      if (!deMim) { if (m.ativa) { S.maos.set(id, Date.now()); if (S.papel === "mentor") toast(`${nome} levantou a mão.`); } else S.maos.delete(id); }
      render();
    } else if (m.t === "abaixar") {
      if (m.id === meuId()) { S.maoMinha = false; toast("O mentor abaixou sua mão."); }
      S.maos.delete(m.id); render();
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
        if (!S.demo) { const j = await admin({ acao: "iniciar_gravacao" }); S.egressId = j.egressId || ""; }
        marcarGravando(true); toast("Gravação iniciada.");
      } else {
        const dur = Date.now() - S.inicioRec;
        if (!S.demo) await admin({ acao: "parar_gravacao", egressId: S.egressId });
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
    if (S.demo) return finalizar("encerrado");
    try { await admin({ acao: "encerrar" }); } catch (e) { toast(e.message); }
  }
  function sair() {
    if (S.papel === "mentor" && S.gravando && !confirm("A gravação continua ativa sem você. Sair mesmo assim?")) return;
    if (S.room) S.room.disconnect(); else finalizar("saiu");
  }

  /* ---------------- demonstração ---------------- */
  function iniciarDemo() {
    const nomes = S.papel === "mentor"
      ? [["Ana Souza", "aluno", true], ["Carlos Lima", "aluno", true], ["Marina Alves", "aluno", false]]
      : [["Léo Figueiredo", "mentor", true], ["Carlos Lima", "aluno", true], ["Marina Alves", "aluno", false]];
    S.demoPessoas = [{ id: "voce", local: true }].concat(nomes.map((n, i) => ({ id: "sim" + i, nome: n[0], papel: n[1], mic: n[2] })));
    S.timers.push(setInterval(() => {
      const comMic = S.demoPessoas.filter(d => !d.local && d.mic);
      S.demoFalando = Math.random() < .25 || !comMic.length ? "" : comMic[Math.floor(Math.random() * comMic.length)].id;
      render();
    }, 2200));
    const outro = S.demoPessoas[2];
    S.timers.push(setTimeout(() => outro && receber({ t: "chat", texto: "Boa noite! Áudio e vídeo ok por aqui." }, outro.id, outro.nome), 3500));
    S.timers.push(setTimeout(() => { const m = S.demoPessoas[3]; if (m) receber({ t: "mao", ativa: true }, m.id, m.nome); }, 7000));
  }

  /* ---------------- fim ---------------- */
  function finalizar(motivo) {
    if (!S || S.encerrado) return;
    S.encerrado = true;
    S.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    if (S.telaStream) S.telaStream.getTracks().forEach(t => t.stop());
    pararPreview();
    for (const d of S.tiles.values()) soltarVideo(d);
    $("sGrade").innerHTML = ""; S.tiles.clear();
    $("sAudios").innerHTML = "";
    if (S.room) { S.room.removeAllListeners(); S.room = null; }
    const R = LK && LK.DisconnectReason;
    let tit = "Você saiu do encontro", txt = "Obrigado pela participação.";
    if (motivo === "encerrado" || (R && motivo === R.ROOM_DELETED)) { tit = "Encontro encerrado"; txt = S.papel === "mentor" ? "Você encerrou o encontro para todos." : "O mentor encerrou o encontro."; }
    else if (R && motivo === R.PARTICIPANT_REMOVED) { tit = "Você foi removido"; txt = "O mentor removeu você deste encontro."; }
    else if (R && motivo !== undefined && motivo !== R.CLIENT_INITIATED && motivo !== "saiu") { tit = "Conexão perdida"; txt = "A conexão com a sala caiu. Volte e entre de novo."; }
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
    if (!S || !S.inicio) return;
    $("sDur").textContent = mmss(Date.now() - S.inicio);
    if (S.gravando) $("sRec").querySelector("span").textContent = "Gravando " + mmss(Date.now() - S.inicioRec);
  }
  let toastT;
  function toast(t) { const d = $("sToast"); d.textContent = t; d.classList.add("ver"); clearTimeout(toastT); toastT = setTimeout(() => d.classList.remove("ver"), 2800); }

  window.NoirSala = { abrir, modoReal, config: CFG };
})();
