// Telas de menu: início (Dead Pixel), sala de espera (Jogar), Personagens e Loja (protótipo).
// Cada tela tem layout(W,H) -> retângulos/botões e draw(...). Os cliques são tratados em main.js.
(function () {
  'use strict';
  const DP = window.DP;
  const text = DP.font.text;
  const R = () => DP.render;
  const M = 8;     // margem

  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function frame(ctx, c, x, y, w, h, dashed) {
    ctx.fillStyle = c;
    if (!dashed) { ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); return; }
    for (let i = 0; i < w; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + h - 1, 2, 1); }
    for (let i = 0; i < h; i += 4) { ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + w - 1, y + i, 1, 2); }
  }
  function coin(ctx, x, y) {
    rect(ctx, '#7a5a10', x + 1, y, 5, 7); rect(ctx, '#7a5a10', x, y + 1, 7, 5);
    rect(ctx, '#ffd23f', x + 1, y + 1, 5, 5); rect(ctx, '#fff3a8', x + 2, y + 2, 2, 2);
  }
  function title(ctx, W, label, sub) {
    text(ctx, label, Math.round(W / 2), 6, '#e9e6f0', { align: 'c' });
    if (sub) text(ctx, sub, Math.round(W / 2), 15, '#8a8a99', { align: 'c' });
  }

  // ---------- layouts ----------
  function layout(state, W, H, ui) {
    const cx = Math.round(W / 2);
    const L = { buttons: [], box: {} };
    if (state === 'menu') {
      const bw = Math.min(170, W - 24), mpOn = !!DP.MP_ON, y0 = Math.round(H * (mpOn ? 0.42 : 0.5)), st = mpOn ? 19 : 21, bh = mpOn ? 16 : 17;
      let yy = y0;
      L.buttons.push({ id: 'go_lobby', label: 'JOGAR', x: cx - bw / 2, y: yy, w: bw, h: 19, color: '#ffd23f' }); yy += 22;
      if (mpOn) { L.buttons.push({ id: 'go_mp', label: 'MULTIJOGADOR', x: cx - bw / 2, y: yy, w: bw, h: bh, color: '#ff9d5c' }); yy += st; }
      L.buttons.push({ id: 'go_help', label: 'COMO JOGAR', x: cx - bw / 2, y: yy, w: bw, h: bh, color: '#ffffff' }); yy += st;
      L.buttons.push({ id: 'go_chars', label: 'PERSONAGENS', x: cx - bw / 2, y: yy, w: bw, h: bh, color: '#7dffa0' }); yy += st;
      L.buttons.push({ id: 'go_shop', label: 'LOJA', x: cx - bw / 2, y: yy, w: bw, h: bh, color: '#7ad0ff' });
    } else if (state === 'lobby') {
      const wide = W >= 280, gap = 4, top = 22;
      let slotH, sw;
      L.slots = [];
      if (wide) {
        sw = Math.floor((W - 2 * M - 3 * gap) / 4); slotH = 62;
        for (let i = 0; i < 4; i++) L.slots.push({ x: M + i * (sw + gap), y: top, w: sw, h: slotH });
      } else {
        sw = Math.floor((W - 2 * M - gap) / 2); slotH = H < 400 ? 50 : 66;
        for (let i = 0; i < 4; i++) L.slots.push({ x: M + (i % 2) * (sw + gap), y: top + Math.floor(i / 2) * (slotH + gap), w: sw, h: slotH });
      }
      const rows = wide ? 1 : 2;
      const ky = top + rows * (slotH + gap) + 2, kh = wide ? 38 : (H < 400 ? 40 : 64);
      L.box.killer = { x: M, y: ky, w: W - 2 * M, h: kh };
      L.box.legend = { y: ky + kh + 5 };
      L.buttons.push({ id: 'kslot', ghost: true, x: M, y: ky, w: W - 2 * M, h: kh });
      if (wide) {
        const by = H - 24, bh = 18, bw1 = 50, bw2 = 78, bw3 = 82;
        L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: by, w: bw1, h: bh, color: '#8a8a99' });
        L.buttons.push({ id: 'diff_toggle', label: '', x: M + bw1 + 4, y: by, w: bw2, h: bh, color: '#e9c07a' });
        L.buttons.push({ id: 'train_toggle', label: '', x: M + bw1 + bw2 + 8, y: by, w: bw3, h: bh, color: '#7ad0ff', toggle: true });
        L.buttons.push({ id: 'start', label: 'INICIAR', x: M + bw1 + bw2 + bw3 + 12, y: by, w: W - 2 * M - bw1 - bw2 - bw3 - 12, h: bh, color: '#ffd23f' });
      } else {
        const bw = W - 2 * M;
        L.buttons.push({ id: 'start', label: 'INICIAR PARTIDA', x: M, y: H - 89, w: bw, h: 19, color: '#ffd23f' });
        L.buttons.push({ id: 'diff_toggle', label: '', x: M, y: H - 66, w: bw, h: 17, color: '#e9c07a' });
        L.buttons.push({ id: 'train_toggle', label: '', x: M, y: H - 43, w: bw, h: 17, color: '#7ad0ff', toggle: true });
        L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: H - 22, w: bw, h: 17, color: '#8a8a99' });
      }
    } else if (state === 'mp') {
      const bw = Math.min(190, W - 2 * M), bx = cx - bw / 2, games = (ui && ui.mp && ui.mp.games) || [];
      L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: H - 22, w: Math.min(70, W - 2 * M), h: 17, color: '#8a8a99' });
      if (ui && ui.mp && ui.mp.ok) {
        L.buttons.push({ id: 'mp_create', label: 'CRIAR SALA', x: bx, y: 34, w: bw, h: 18, color: '#ffd23f' });
        games.slice(0, Math.max(1, Math.min(4, Math.floor((H - 34 - 18 - 14 - 30 - 22) / 20)))).forEach((gm, i) => L.buttons.push({ id: 'mp_join' + i, label: '', x: bx, y: 70 + i * 20, w: bw, h: 17, color: '#7dffa0' }));
      }
    } else if (state === 'mplobby') {
      const bw = Math.min(210, W - 2 * M), bx = cx - bw / 2, lb = (ui && ui.mp && ui.mp.lobby) || { slots: [] }, rh = H < 200 ? 15 : 17, y0 = 36;
      for (let i = 0; i < 5; i++) L.buttons.push({ id: 'mp_slot' + i, label: '', x: bx, y: y0 + i * (rh + 2), w: bw, h: rh, color: '#7ad0ff', ghost: true });
      const by = H - 22, half = Math.floor((W - 2 * M - 4) / 2);
      L.buttons.push({ id: 'mp_leave', label: 'SAIR', x: M, y: by, w: lb.isHost ? Math.min(60, half) : half, h: 17, color: '#8a8a99' });
      if (lb.isHost) L.buttons.push({ id: 'mp_start', label: 'INICIAR', x: M + Math.min(60, half) + 4, y: by, w: W - 2 * M - Math.min(60, half) - 4, h: 17, color: '#ffd23f' });
    } else if (state === 'help') {
      const bw = Math.min(90, Math.floor((W - 2 * M - 4) / 2));
      L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: H - 22, w: bw, h: 17, color: '#8a8a99' });
      L.buttons.push({ id: 'help_next', label: 'PÁGINA', x: W - M - bw, y: H - 22, w: bw, h: 17, color: '#ffd23f' });
    } else if (state === 'chars') {
      L.wide = W >= 280;
      L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: H - 24, w: L.wide ? 70 : W - 2 * M, h: 18, color: '#8a8a99' });
    } else if (state === 'shop') {
      const wide = W >= 280, gap = 4, top = 26, cols = wide ? 3 : 2, ch = wide ? 58 : 62;
      const cw = Math.floor((W - 2 * M - (cols - 1) * gap) / cols);
      L.cards = [];
      for (let i = 0; i < 6; i++) {
        const c = { x: M + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
        L.cards.push(c);
        L.buttons.push({ id: 'card' + i, ghost: true, x: c.x, y: c.y, w: c.w, h: c.h });
      }
      L.buttons.push({ id: 'back', label: 'VOLTAR', x: M, y: H - 24, w: wide ? 70 : W - 2 * M, h: 18, color: '#8a8a99' });
    }
    return L;
  }

  // ---------- desenho ----------
  function bg(ctx, W, H, tm) {
    rect(ctx, '#0b0b10', 0, 0, W, H);
    // chão quadriculado bem escuro, sobe devagar (dá vida ao fundo sem distrair)
    const off = Math.floor(tm * 4) % 16;
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let y = -16 + off; y < H; y += 16) for (let x = ((y / 16) & 1) * 16; x < W; x += 32) ctx.fillRect(x, y, 16, 16);
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H * 0.45, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function dots(ctx, x, y, arr) {
    // ● vitória  ○ derrota  (últimas 6)
    arr.slice(-6).forEach((r, i) => { rect(ctx, r === 'W' ? '#7dffa0' : '#e23a3a', x + i * 6, y, 4, 4); });
  }

  function drawMenu(ctx, W, H, tm, ui) {
    bg(ctx, W, H, tm);
    const cx = Math.round(W / 2), sc = W >= 300 ? 3 : 2;
    ctx.save(); ctx.translate(cx, Math.round(H * 0.07)); ctx.scale(sc, sc);
    text(ctx, 'DEAD PIXEL', 0, 0, '#e23a3a', { align: 'c' });
    ctx.restore();
    const subY = Math.round(H * 0.07) + 7 * sc + 5;
    text(ctx, DP.style && DP.style.label ? 'ACAMPAMENTO · ' + DP.style.label : 'PROTÓTIPO 10: ACAMPAMENTO', cx, subY, '#e9c07a', { align: 'c' });
    // prévia: o personagem principal e o assassino apagado, à espreita
    const ps = H >= 300 ? 3 : H >= 230 ? 2 : 1;
    const feet = Math.min(Math.round(H * 0.5) - 10, subY + 14 + 22 * ps);
    R().uiKiller(ctx, cx + 34 * ps / 1.4, feet - 2, ps, { state: 'recover', alpha: 0.28, tm, face: Math.PI });
    R().uiSurvivor(ctx, cx - 18 * ps / 1.4, feet, ps, { id: 0, moving: true, walk: tm * 8, face: 0, tm, human: false });
    text(ctx, 'V' + DP.VERSION, W - M, 4, '#6f6f7c', { align: 'r' });                                        // versão do jogo
    // rodapé: fichas e histórico
    coin(ctx, M, H - 14);
    text(ctx, String(ui.coins), M + 10, H - 13, '#ffd23f');
    const hs = ui.hist.survivor, hk = ui.hist.killer;
    const hx = W >= 280 ? W - 118 : cx - 4;
    if (hs.length) { text(ctx, 'SOBREV.', hx, H - 13, '#8a8a99'); dots(ctx, hx + 44, H - 12, hs); }
    if (hk.length) { text(ctx, 'ASSASS.', hx, H - (hs.length ? 22 : 13), '#8a8a99'); dots(ctx, hx + 44, H - (hs.length ? 21 : 12), hk); }
  }

  function slotBox(ctx, b, state, tm, ui, i) {
    // state: 'you' | 'bot' | 'empty'
    const you = state === 'you';
    rect(ctx, you ? 'rgba(125,255,160,.08)' : 'rgba(255,255,255,.03)', b.x, b.y, b.w, b.h);
    frame(ctx, you ? '#7dffa0' : '#3b3b47', b.x, b.y, b.w, b.h, !you);
    text(ctx, 'J' + (i + 1), b.x + 3, b.y + 3, you ? '#7dffa0' : '#4d4d59');
    const sc = b.h >= 62 ? 2 : 1, cxs = b.x + Math.round(b.w / 2), feet = b.y + b.h - 20;
    if (you) R().uiSurvivor(ctx, cxs, feet, sc, { id: 0, moving: false, tm, face: Math.PI / 2 + Math.sin(tm * 1.2) * 0.0, human: false });
    else R().uiSurvivor(ctx, cxs, feet, sc, { id: i, tm, alpha: 0.16 });
    if (!you) text(ctx, state === 'bot' ? 'IA' : '?', cxs, feet - 10 * sc, '#4d4d59', { align: 'c' });
    text(ctx, you ? 'PIXEL' : state === 'bot' ? 'BOT' : 'VAGO', cxs, b.y + b.h - 17, you ? '#fff' : '#5d5d69', { align: 'c' });
    text(ctx, you ? 'PRONTO' : state === 'bot' ? 'IA JOGA' : 'AGUARDANDO', cxs, b.y + b.h - 8, you ? '#7dffa0' : '#4d4d59', { align: 'c' });
  }

  function drawLobby(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    title(ctx, W, 'SALA DE ESPERA', ui.best || null);
    const kill = ui.role === 'killer';
    for (let i = 0; i < 4; i++) slotBox(ctx, L.slots[i], kill ? 'bot' : i === 0 ? 'you' : 'empty', tm, ui, i);
    // assassino: apagado (IA) — toque para jogar com ele
    const k = L.box.killer;
    rect(ctx, kill ? 'rgba(226,58,58,.10)' : 'rgba(255,255,255,.02)', k.x, k.y, k.w, k.h);
    frame(ctx, kill ? '#ff5c5c' : '#2c2c36', k.x, k.y, k.w, k.h, !kill);
    const kcx = k.x + 28;
    R().uiKiller(ctx, kcx, k.y + k.h - 5, k.h >= 56 ? 2 : 1, { state: kill ? 'chase' : 'recover', alpha: kill ? 1 : 0.22, tm, moving: kill, walk: tm * 8, face: Math.PI / 2 });
    text(ctx, 'ASSASSINO', k.x + 56, k.y + 6, kill ? '#ff5c5c' : '#4a4a55');
    text(ctx, kill ? 'VOCÊ' : 'IA (APAGADO)', k.x + 56, k.y + 16, kill ? '#fff' : '#3d3d47');
    const hint = kill ? 'TOQUE P/ VOLTAR' : 'TOQUE P/ JOGAR';
    text(ctx, hint, k.x + 56, k.y + 26, kill ? '#ffb347' : '#5d5d69');
    // legenda: a versão longa só se couber acima dos botões (telas baixas usam a curta)
    const ly = L.box.legend.y;
    const topBtn = L.buttons.filter((b) => !b.ghost && b.y > ly - 2).reduce((m, b) => Math.min(m, b.y), H);
    const cols = Math.floor((W - 16) / 6);
    const variants = kill
      ? ['OS 4 SOBREVIVENTES SÃO BOTS. CACE TODOS ANTES QUE ESCAPEM.', 'SOBREVIVENTES = BOTS.']
      : ['VAGAS LIVRES VIRAM BOTS. VISÃO CURTA: SÓ SE VÊ O QUE ESTÁ PERTO OU NA LANTERNA.', 'VAGAS LIVRES VIRAM BOTS.'];
    const pick = variants.map((v) => DP.font.wrap(v, cols)).find((ls) => ly + ls.length * 9 <= topBtn - 1) || [];
    pick.forEach((l2, i) => text(ctx, l2, Math.round(W / 2), ly + i * 9, '#6f6f7c', { align: 'c' }));
  }

  // tela "Como jogar": 3 páginas (sobrevivente, assassino, rotas de fuga); mostra a tecla E o toque lado a lado
  const HELP = [
    { t: 'SOBREVIVENTE', rows: [
      ['MOVER', 'WASD/SETAS', 'JOYSTICK (ARRASTE)'],
      ['CORRER (SOLTO, SÓ ANDA: MAIS LENTO E QUIETO)', 'SEGURE SHIFT', 'ARRASTE MUITO (POUCO = ANDA)'],
      ['PULAR JANELA ABERTA OU PALLET CAÍDO (CHEGUE PERTO)', 'ESPAÇO', 'BOTÃO PULAR'],
      ['JANELA FECHADA: ANDANDO, SEGURE AGIR PARA ABRIR; CORRENDO (SHIFT) + ESPAÇO CONTRA ELA, VOCÊ A QUEBRA E ATRAVESSA (SE CORTA)', '', ''],
      ['AGIR: CONSERTAR, ABRIR, PEGAR, INSTALAR, ESCONDER, ENTRAR', 'SEGURE E', 'SEGURE O BOTÃO AGIR'],
      ['SOLTAR O QUE CARREGA (SEM ALVO)', 'E', 'AGIR'],
      ['SKILL CHECK (SÓ CONSERTANDO GERADOR: APERTE QUANDO O PONTEIRO CRUZAR A ZONA)', 'ESPAÇO', 'TOQUE NA TELA'],
      ['DERRUBAR O PALLET QUANDO O ASSASSINO ESTÁ DO OUTRO LADO', 'ESPAÇO', 'BOTÃO PALLET'],
      ['LIGAR/DESLIGAR O RÁDIO (BIPES = ASSASSINO PERTO)', 'Q', 'BOTÃO RÁDIO'],
      ['MAPA GRANDE', 'M OU TAB', 'MINIMAPA OU MAPA'],
      ['SAIR DO ARMÁRIO', 'E OU MOVER', 'AGIR OU MOVER'],
      ['MOCHILA: 3 ESPAÇOS (RÁDIO, PEÇA, KIT MÉDICO, ARMADILHA). BAÚS E CABANAS TÊM KITS. SEGURE E NO BAÚ PARA ABRIR.', '', ''],
      ['CURAR 1 VIDA (~6 S PARADO; SE NÃO ESTIVER FERIDO, CURA UM COLEGA PERTO) / PÔR ARMADILHA DE URSO', 'F', 'TOQUE NO ESPAÇO DA MOCHILA'],
      ['ARMADILHA DO ASSASSINO: DESARME (SEGURE E) OU SOLTE UM COLEGA PRESO (SEGURE E). A SUA PRENDE O ASSASSINO.', '', ''],
      ['LIGANDO PARA A POLÍCIA APARECE UM CHAT: RESPONDA COM 1, 2 OU 3 (OU TOQUE).', '1 / 2 / 3', 'TOQUE NA RESPOSTA']] },
    { t: 'ASSASSINO', rows: [
      ['MOVER', 'WASD/SETAS', 'JOYSTICK'],
      ['ATACAR (GOLPE COM BOTE)', 'ESPAÇO', 'BOTÃO ATACAR'],
      ['ESPREITAR: MAIS SILENCIOSO E QUASE INVISÍVEL, MAS MAIS LENTO', 'SEGURE SHIFT', 'SEGURE ESPR.'],
      ['QUEBRAR PALLET/JANELA, CHUTAR GERADOR, SABOTAR VEÍCULO, ABRIR ARMÁRIO', 'E', 'AGIR'],
      ['VOCÊ NASCE NO BARRACÃO COM ARMADILHAS; REPONHA NO ARSENAL (AGIR). PÔR ARMADILHA PRENDE O SOBREVIVENTE ~4 S E DENUNCIA ONDE ELE ESTÁ.', 'F', 'BOTÃO ARMAD.'],
      ['MAPA GRANDE (VÊ OS GERADORES)', 'M OU TAB', 'MINIMAPA OU MAPA'],
      ['SETAS NA BORDA DA TELA = BARULHO FORA DE VISTA', '', ''] ] },
    { t: 'COMO ESCAPAR', rows: [
      ['POLÍCIA: 5 DE 8 GERADORES LIGAM A ENERGIA. DEPOIS SEGURE AGIR NO TELEFONE (~30 S). A POLÍCIA CHEGA EM ~2,5 MIN E ABRE O PORTÃO POR 2 MIN: CORRA PARA ELE.', '', ''],
      ['CARRO (ESTACIONAMENTO): ACHE BATERIA, CHAVE E COMBUSTÍVEL; CARREGUE UMA PEÇA POR VEZ, INSTALE, LIGUE O MOTOR E ENTRE (2 LUGARES).', '', ''],
      ['BARCO (CAIS): HÉLICE, CHAVE E COMBUSTÍVEL; DEPOIS EMPURRE E ENTRE (2 LUGARES).', '', ''],
      ['ARMÁRIOS NAS CABANAS: ESCONDA-SE; O ASSASSINO PODE ABRIR.', '', '']] }
  ];
  // monta blocos de texto e reparte em páginas que cabem na tela (a quantidade de páginas depende do tamanho)
  function helpPages(W, H, touch) {
    const cols = Math.floor((W - 2 * M) / 6), room = H - 26 - 30;
    const blocks = [];
    for (const g of HELP) {
      blocks.push({ head: g.t, lines: [] });
      for (const r of g.rows) {
        const lines = DP.font.wrap(r[0], cols).map((s) => ({ s, c: '#cfd3e0', x: 0 }));
        if (r[1] || r[2]) {
          const kb = touch ? r[2] : (r[1] + (r[2] ? '  /  ' + r[2] : ''));
          if (kb) DP.font.wrap((touch ? 'TOQUE: ' : 'TECLA: ') + kb, cols - 1).forEach((s) => lines.push({ s, c: touch ? '#7dffa0' : '#ffd23f', x: 6 }));
        }
        blocks.push({ head: null, lines });
      }
    }
    const pages = [[]]; let used = 0;
    for (const b of blocks) {
      const h = (b.head ? 10 : b.lines.length * 9 + 4);
      if (used + h > room && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(b); used += h;
    }
    return pages;
  }
  function drawHelp(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    const pages = helpPages(W, H, !!ui.touch);
    DP.lobby.helpCount = pages.length;
    const pg = pages[(ui.helpPage || 0) % pages.length];
    title(ctx, W, 'COMO JOGAR', null);
    let y = 18;
    for (const b of pg) {
      if (b.head) { text(ctx, b.head, M, y, '#ff9d5c'); y += 10; continue; }
      b.lines.forEach((ln, i) => text(ctx, ln.s, M + ln.x, y + i * 9, ln.c));
      y += b.lines.length * 9 + 4;
    }
  }

  // ---------- multijogador ----------
  function drawMp(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    title(ctx, W, 'MULTIJOGADOR', '1 ASSASSINO + ATÉ 4 SOBREVIVENTES');
    const mp = ui.mp || {}, cols = Math.floor((W - 16) / 6);
    if (mp.ok === null || mp.ok === undefined) { text(ctx, 'CONECTANDO...', Math.round(W / 2), 40, '#8a8a99', { align: 'c' }); return; }
    if (!mp.ok) {
      DP.font.wrap('INDISPONÍVEL AQUI. O MULTIJOGADOR USA A SALA DO ARTEFATO: ABRA O JOGO PELO CLAUDE.AI, COM LOGIN, E COMPARTILHE O LINK COM QUEM VAI JOGAR (VISITANTES SEM LOGIN NÃO ENTRAM).', cols).forEach((l, i) => text(ctx, l, 8, 36 + i * 9, '#ff9d5c'));
      return;
    }
    text(ctx, 'SALAS ABERTAS', 8, 58, '#8a8a99');
    const games = mp.games || [];
    if (!games.length) DP.font.wrap('NENHUMA AINDA. CRIE UMA E MANDE A PESSOA ABRIR O JOGO E TOCAR EM MULTIJOGADOR.', cols).forEach((l, i) => text(ctx, l, 8, 70 + i * 9, '#6f6f7c'));
    L.buttons.forEach((b) => { if (b.id.indexOf('mp_join') === 0) { const gm = games[+b.id.slice(7)]; if (gm) text(ctx, gm.code + '  ' + gm.host + '  ' + gm.players + '/5', b.x + b.w / 2, b.y + 5, '#7dffa0', { align: 'c' }); } });
    if (mp.err) text(ctx, mp.err, Math.round(W / 2), H - 34, '#ff9d5c', { align: 'c' });
  }
  function drawMpLobby(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    const lb = (ui.mp && ui.mp.lobby) || { slots: [], names: [] };
    title(ctx, W, 'SALA ' + (lb.code || ''), lb.isHost ? 'VOCÊ É O ANFITRIÃO. A PARTIDA RODA NO SEU APARELHO.' : 'ANFITRIÃO: ' + (lb.hostName || '...'));
    const labels = ['ASSASSINO', 'SOBREV. 1', 'SOBREV. 2', 'SOBREV. 3', 'SOBREV. 4'];
    L.buttons.forEach((b) => {
      if (b.id.indexOf('mp_slot') !== 0) return;
      const i = +b.id.slice(7), who = lb.slots[i], mine = lb.mine === i;
      rect(ctx, mine ? 'rgba(125,255,160,.10)' : 'rgba(255,255,255,.04)', b.x, b.y, b.w, b.h); frame(ctx, mine ? '#7dffa0' : who ? '#7ad0ff' : '#3b3b47', b.x, b.y, b.w, b.h, !who);
      text(ctx, labels[i], b.x + 4, b.y + (b.h - 7) / 2, i === 0 ? '#ff5c5c' : '#cfd3e0');
      text(ctx, who ? (mine ? 'VOCÊ (' + who + ')' : who) : 'BOT', b.x + b.w - 4, b.y + (b.h - 7) / 2, mine ? '#7dffa0' : who ? '#7ad0ff' : '#5d5d69', { align: 'r' });
    });
    const ly = 36 + 5 * (L.buttons[0] ? L.buttons[0].h + 2 : 19) + 3;
    DP.font.wrap(lb.isHost ? 'TOQUE NUMA VAGA PARA MUDAR DE LUGAR. VAGAS SEM PESSOA VIRAM BOTS. QUEM CHEGAR DEPOIS ENTRA PELO MENU > MULTIJOGADOR.' : 'TOQUE NUMA VAGA LIVRE PARA ESCOLHER SEU LUGAR. O ANFITRIÃO INICIA.', Math.floor((W - 16) / 6)).forEach((l, i) => text(ctx, l, 8, ly + i * 9, '#6f6f7c'));
    if (ui.mp && ui.mp.err) text(ctx, ui.mp.err, Math.round(W / 2), H - 34, '#ff9d5c', { align: 'c' });
  }

  function drawChars(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    title(ctx, W, 'PERSONAGENS', null);
    // o personagem principal, grande, andando em todas as direções
    const faces = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
    const face = faces[Math.floor(tm / 2.2) % 4];
    const sc = L.wide ? (H >= 230 ? 6 : 4) : 5;
    const px0 = L.wide ? Math.round(W * 0.24) : Math.round(W / 2);
    const feet = L.wide ? Math.round(H * 0.62) : 22 + 21 * sc;
    rect(ctx, 'rgba(0,0,0,.35)', px0 - 7 * sc, feet - 1, 14 * sc, 2 * sc);
    R().uiSurvivor(ctx, px0, feet, sc, { id: 0, moving: true, walk: tm * 6, face, tm });
    // ficha
    const tx = L.wide ? Math.round(W * 0.46) : M, ty0 = L.wide ? 26 : feet + 12;
    const tw = L.wide ? W - tx - M : W - 2 * M;
    text(ctx, 'PIXEL', tx, ty0, '#ffffff');
    text(ctx, 'SOBREVIVENTE', tx, ty0 + 10, '#7dffa0');
    const bio = DP.font.wrap('VENDEDOR DE LOJA QUE ATENDEU MAL A BRUXA. RÁPIDO O BASTANTE PARA FUGIR, TEIMOSO O BASTANTE PARA TENTAR DE NOVO.', Math.floor(tw / 6));
    bio.forEach((l, i) => text(ctx, l, tx, ty0 + 24 + i * 9, '#a9a9b5'));
    let y = ty0 + 24 + bio.length * 9 + 6;
    const C = DP.CFG;
    const bar = (label, val, max, note) => {
      text(ctx, label, tx, y, '#8a8a99');
      const bx = tx + 72;
      for (let i = 0; i < max; i++) rect(ctx, i < val ? '#ffd23f' : '#33333d', bx + i * 7, y, 5, 6);
      if (tw > 150) text(ctx, note, bx + max * 7 + 4, y, '#6f6f7c');
      y += 10;
    };
    bar('VELOCIDADE', 4, 5, C.RUN.toFixed(1).replace('.', ',') + ' T/S');
    bar('FURTIVIDADE', 3, 5, 'ANDA ' + (C.RUN * C.WALK).toFixed(1).replace('.', ','));
    bar('RESISTÊNCIA', 2, 5, '2 VIDAS');
    bar('AGILIDADE', 3, 5, 'JANELAS');
  }

  const SHOP = [
    { name: 'JAQUETA NEON', price: 150, icon: 'jacket' },
    { name: 'BONÉ PIXEL', price: 80, icon: 'cap' },
    { name: 'EFEITO DE CORTE', price: 120, icon: 'slash' },
    { name: 'MÁSCARA SANGUE', price: 300, icon: 'mask' },
    { name: 'POSE DE VITÓRIA', price: 200, icon: 'pose' },
    { name: 'PACOTE 16 BITS', price: 500, icon: 'bits' }
  ];
  function shopIcon(ctx, kind, cx, cy, tm) {
    // cy = base do ícone
    if (kind === 'jacket') R().uiSurvivor(ctx, cx, cy, 1, { id: 2, tm });
    else if (kind === 'cap') { R().uiSurvivor(ctx, cx, cy, 1, { id: 0, tm }); rect(ctx, '#e23a3a', cx - 3, cy - 17, 6, 2); rect(ctx, '#b02a2a', cx - 4, cy - 15, 8, 1); }
    else if (kind === 'slash') { for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - i * 0.25) + ')'; for (let j = 0; j < 14; j++) ctx.fillRect(cx - 8 + j + i * 2, cy - 4 - Math.round(Math.sin(j / 14 * Math.PI) * 10) + i * 2, 2, 1); } }
    else if (kind === 'mask') { R().uiKiller(ctx, cx, cy, 1, { state: 'chase', tm }); rect(ctx, 'rgba(226,58,58,.8)', cx - 3, cy - 20, 6, 6); }
    else if (kind === 'pose') { R().uiSurvivor(ctx, cx, cy, 1, { id: 1, tm }); rect(ctx, '#d0705b', cx - 6, cy - 19, 2, 6); rect(ctx, '#d0705b', cx + 4, cy - 19, 2, 6); }
    else {                                                     // 16 bits: o mesmo boneco com pixels menores
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) rect(ctx, (x + y) % 2 ? '#7ad0ff' : '#3d6fb5', cx - 8 + x * 2, cy - 18 + y * 2, 2, 2);
    }
  }
  function drawShop(ctx, W, H, tm, ui, L) {
    bg(ctx, W, H, tm);
    title(ctx, W, 'LOJA', 'PROTÓTIPO: COMPRAS EM BREVE');
    coin(ctx, W - 8 - 7 - String(ui.coins).length * 6 - 3, 6); text(ctx, String(ui.coins), W - 8, 6, '#ffd23f', { align: 'r' });
    L.cards.forEach((c, i) => {
      const it = SHOP[i];
      rect(ctx, 'rgba(255,255,255,.04)', c.x, c.y, c.w, c.h);
      frame(ctx, '#33333d', c.x, c.y, c.w, c.h);
      rect(ctx, 'rgba(0,0,0,.25)', c.x + 2, c.y + 2, c.w - 4, c.h - 30);
      ctx.save(); ctx.beginPath(); ctx.rect(c.x + 2, c.y + 2, c.w - 4, c.h - 30); ctx.clip();
      shopIcon(ctx, it.icon, c.x + Math.round(c.w / 2), c.y + c.h - 33, tm);
      ctx.restore();
      const lines = DP.font.wrap(it.name, Math.floor((c.w - 6) / 6));
      lines.forEach((l, j) => text(ctx, l, c.x + 3, c.y + c.h - 26 + j * 8 - (lines.length > 1 ? 2 : 0), '#e9e6f0'));
      coin(ctx, c.x + 3, c.y + c.h - 10); text(ctx, String(it.price), c.x + 13, c.y + c.h - 9, '#ffd23f');
      text(ctx, 'EM BREVE', c.x + c.w - 3, c.y + c.h - 9, '#6f6f7c', { align: 'r' });
    });
    if (ui.toast) text(ctx, ui.toast, Math.round(W / 2), H - 38, '#ffb347', { align: 'c' });
    const gy = L.cards[L.cards.length - 1].y + L.cards[0].h + 6;
    if (gy < H - 50) text(ctx, 'GANHE FICHAS JOGANDO PARTIDAS', Math.round(W / 2), gy, '#6f6f7c', { align: 'c' });
  }

  function labelFor(b, ui) {
    if (b.id === 'train_toggle') {
      const long = ['MODO: PARTIDA (ACAMPAMENTO)', 'MODO: TREINO (ACAMPAMENTO)', 'MODO: TREINO (ARENA PEQUENA)'][ui.mode || 0], mid = ['MODO: PARTIDA', 'MODO: TREINO', 'MODO: ARENA'][ui.mode || 0], short = ['PARTIDA', 'TREINO', 'ARENA'][ui.mode || 0];
      return long.length * 6 + 8 <= b.w ? long : mid.length * 6 + 8 <= b.w ? mid : short;
    }
    if (b.id.indexOf('mp_join') === 0) return '';
    if (b.id === 'help_next') { const n = DP.lobby.helpCount || 3; return 'PÁGINA ' + (((ui.helpPage || 0) % n) + 1) + '/' + n; }
    if (b.id === 'diff_toggle') { const n = { easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' }[ui.difficulty]; return b.w < 100 ? 'DIF: ' + n : 'DIFICULDADE: ' + n; }
    return b.label;
  }

  DP.lobby = { drawMp, drawMpLobby, layout, drawMenu, drawLobby, drawChars, drawShop, drawHelp, helpPages, labelFor, SHOP };
})();
