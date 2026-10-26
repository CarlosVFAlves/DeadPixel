// Laço principal, estados de tela (menu / jogo / pausa / fim), entrada por toque e teclado.
(function () {
  'use strict';
  const DP = window.DP;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const text = DP.font.text;

  let W = 320, H = 180, scale = 4;
  let state = 'menu';          // menu | lobby | chars | shop | play | pause | over
  let role = 'survivor';       // quem o jogador controla: 'survivor' | 'killer'
  let game = null;
  let training = false;
  let lobbyMode = 0;           // modo na sala: 0 = partida (acampamento), 1 = treino (acampamento), 2 = treino na arena pequena
  let curMap = 'camp';         // mapa da partida em andamento
  let difficulty = 'normal';   // easy | normal | hard (para quem joga)
  let toast = null;            // { text, t }
  let showMap = false;         // mapa de campo (tecla M)
  let coins = 0, hist = { survivor: [], killer: [] }, log = [];
  let lastReward = 0;
  try {
    coins = parseInt(localStorage.getItem('dp_coins') || '0', 10) || 0;
    hist = Object.assign({ survivor: [], killer: [] }, JSON.parse(localStorage.getItem('dp_hist') || '{}'));
    log = JSON.parse(localStorage.getItem('dp_log') || '[]');
    const dd = localStorage.getItem('dp_diff'); if (['easy', 'normal', 'hard'].includes(dd)) difficulty = dd;
  } catch (e) {}
  const MENU_STATES = ['menu', 'lobby', 'chars', 'shop', 'help'];
  let helpPage = 0, helpFrom = 'menu';
  // dicas de teclado nos botões: só para quem usa teclado (ou tela sem toque)
  let touchDevice = false, usedKeys = false;
  try { touchDevice = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window; } catch (e) {}
  DP.ui = { keys: !touchDevice };
  let best = 0, fastest = 0, hunt = 0, newBest = false;
  try { best = parseFloat(localStorage.getItem('dp_best') || '0') || 0; fastest = parseFloat(localStorage.getItem('dp_esc') || '0') || 0; hunt = parseFloat(localStorage.getItem('dp_hunt') || '0') || 0; } catch (e) {}
  const fmt = (v) => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
  function bestText() {
    const a = [];
    if (role === 'killer') { if (hunt) a.push('CAÇADA MAIS RÁPIDA ' + fmt(hunt)); }
    else { if (best) a.push('SOBREVIVEU ' + fmt(best)); if (fastest) a.push('FUGA ' + fmt(fastest)); }
    return a.join('  ');
  }

  // ---------- entrada ----------
  const keys = {};
  const joy = { id: null, active: false, bx: 0, by: 0, dx: 0, dy: 0 };
  const held = new Map();        // pointerId -> botão pressionado
  let dropQueued = false, actQueued = false, pressQueued = false, radioQueued = false;

  function resize() {
    const host = canvas.parentElement.getBoundingClientRect();
    const cw = Math.max(200, Math.round(host.width)), ch = Math.max(200, Math.round(host.height));
    scale = Math.max(2, Math.round(Math.min(cw, ch) / 170));
    W = Math.ceil(cw / scale); H = Math.ceil(ch / scale);
    canvas.width = W; canvas.height = H;
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 80));
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }

  // ---------- botões (coordenadas internas) ----------
  function buttons() {
    const list = [];
    const cx = Math.round(W / 2);
    if (MENU_STATES.includes(state)) {
      for (const b of DP.lobby.layout(state, W, H).buttons) list.push(Object.assign({}, b, { label: DP.lobby.labelFor(b, lobbyUI()) }));
    } else if (state === 'play') {
      const r = Math.max(22, Math.min(30, Math.round(Math.min(W, H) * 0.16))), r2 = Math.round(r * 0.8);
      const kk = DP.ui.keys;
      if (role === 'killer') {
        const close = !!(game && !game.over && game.dist < 2.4 && game.k.state === 'chase');
        const kit = game && game.kInteract;
        list.push({ id: 'drop', label: 'ATACAR', key: 'ESPAÇO', round: true, x: W - 2 * r - 8, y: H - 2 * r - 10, w: 2 * r, h: 2 * r, active: close, hot: '#ff5c5c' });
        list.push({ id: 'act', label: 'AGIR', key: 'E', cap: kit ? ({ break: 'QUEBRAR PALLET', smash: 'QUEBRAR JANELA', kick: 'CHUTAR GERADOR', sabotage: 'SABOTAR', locker: 'ABRIR ARMÁRIO' }[kit.type] || '') : '', round: true, x: W - 2 * r - 8 - 2 * r2 - 6, y: H - 2 * r2 - 10, w: 2 * r2, h: 2 * r2, active: !!kit, hot: '#ff9d5c' });
        list.push({ id: 'stealth', label: 'ESPR.', key: 'SHIFT', round: true, x: W - 2 * r - 8 - 4 * r2 - 12, y: H - 2 * r2 - 10, w: 2 * r2, h: 2 * r2, active: !!(game && game.k.stealth), hot: '#9bd3f0' });
      } else {
        const sit = game && game.interact, hid = !!(game && game.s.hidden);
        const capTxt = hid ? 'SAIR DO ARMÁRIO' : sit ? ({ gen: 'CONSERTAR', item: 'PEGAR', door: 'ABRIR PORTA', window: 'ABRIR JANELA', phone: 'LIGAR PARA A POLÍCIA', install: 'INSTALAR PEÇA', start: sit.obj.kind === 'boat' ? 'EMPURRAR BARCO' : 'LIGAR O MOTOR', board: 'ENTRAR', hide: 'ESCONDER-SE' }[sit.type] || '') : (game && game.s.item ? 'SOLTAR PEÇA' : '');
        list.push({ id: 'act', label: 'AGIR', key: 'E', cap: capTxt, round: true, x: W - 2 * r - 8, y: H - 2 * r - 10, w: 2 * r, h: 2 * r, active: !!sit || hid || !!(game && game.s.item) });
        list.push({ id: 'drop', label: 'PALLET', key: 'ESPAÇO', cap: game && game.near ? 'DERRUBAR PALLET' : '', round: true, x: W - 2 * r - 8 - 2 * r2 - 6, y: H - 2 * r2 - 10, w: 2 * r2, h: 2 * r2, active: !!(game && game.near) });
        if (game && game.s.tool) { const r3 = Math.round(r * 0.62); list.push({ id: 'radio', label: 'RÁDIO', key: 'Q', round: true, x: W - 2 * r - 8 - 2 * r2 - 6 - 2 * r3 - 5, y: H - 2 * r3 - 10, w: 2 * r3, h: 2 * r3, active: !!game.s.tool.on, hot: '#9bd3f0' }); }
        if (game && game.s.skill && !game.s.hidden) list.push({ id: 'skill', ghost: true, x: Math.round(W / 2) - 30, y: Math.round(H / 2) - 46 - 30, w: 60, h: 60 });     // toque no círculo do skill check
      }
      list.push({ id: 'pause', label: 'II', x: W - 22, y: 24, w: 18, h: 13, color: '#cfcfd8' });
      const mr = game && DP.render.miniRect(game, W, H);
      if (mr && !showMap) list.push({ id: 'map', ghost: true, x: mr.x, y: mr.y, w: mr.w, h: mr.h });
      const mw = kk ? 38 : 30, vw = kk ? 62 : 52;
      list.push({ id: 'map', label: kk ? 'MAPA M' : 'MAPA', x: W - 22 - 4 - mw, y: 24, w: mw, h: 13, color: '#ffd23f', sel: showMap });
      if (game && game.training) list.push({ id: 'vision', label: kk ? 'VER TUDO V' : 'VER TUDO', x: W - 22 - 4 - mw - 4 - vw, y: 24, w: vw, h: 13, color: game.fullVision ? '#7dffa0' : '#7ad0ff', sel: !!game.fullVision });
    } else if (state === 'pause') {
      const bw = Math.min(150, W - 24), by = Math.round(H * 0.4);
      list.push({ id: 'resume', label: 'CONTINUAR', x: cx - bw / 2, y: by, w: bw, h: 17, color: '#ffd23f' });
      list.push({ id: 'restart', label: 'REINICIAR', x: cx - bw / 2, y: by + 22, w: bw, h: 17 });
      list.push({ id: 'help', label: 'COMO JOGAR', x: cx - bw / 2, y: by + 44, w: bw, h: 17, color: '#ffffff' });
      list.push({ id: 'menu', label: 'MENU', x: cx - bw / 2, y: by + 66, w: bw, h: 17, color: '#8a8a99' });
    } else if (state === 'over') {
      const bw = Math.min(150, W - 24), by = Math.round(H * 0.74);
      list.push({ id: 'restart', label: 'TENTAR DE NOVO', x: cx - bw / 2, y: by, w: bw, h: 17, color: '#ffd23f' });
      list.push({ id: 'menu', label: 'MENU', x: cx - bw / 2, y: by + 22, w: bw, h: 17, color: '#8a8a99' });
    }
    return list;
  }
  function hit(list, p) {
    for (const b of list) {
      if (b.round) { const r = b.w / 2; if (Math.hypot(p.x - (b.x + r), p.y - (b.y + r)) <= r + 4) return b; }
      else if (p.x >= b.x - 2 && p.x <= b.x + b.w + 2 && p.y >= b.y - 2 && p.y <= b.y + b.h + 2) return b;
    }
    return null;
  }

  function act(id) {
    DP.audio.init();
    switch (id) {
      case 'go_lobby': state = 'lobby'; break;
      case 'go_chars': state = 'chars'; break;
      case 'go_shop': state = 'shop'; break;
      case 'go_help': helpFrom = 'menu'; state = 'help'; break;
      case 'help': helpFrom = 'pause'; state = 'help'; break;
      case 'help_next': helpPage = (helpPage + 1) % (DP.lobby.helpCount || 3); break;
      case 'skill': pressQueued = true; break;
      case 'back': state = state === 'help' ? helpFrom : 'menu'; break;
      case 'kslot': role = role === 'killer' ? 'survivor' : 'killer'; break;
      case 'train_toggle': lobbyMode = (lobbyMode + 1) % 3; break;
      case 'diff_toggle': difficulty = { easy: 'normal', normal: 'hard', hard: 'easy' }[difficulty]; try { localStorage.setItem('dp_diff', difficulty); } catch (e) {} break;
      case 'map': showMap = !showMap; break;
      case 'vision': if (game && game.training) game.fullVision = !game.fullVision; break;
      case 'start': curMap = lobbyMode === 2 ? 'arena' : 'camp'; start(lobbyMode > 0); break;
      case 'drop': dropQueued = true; break;
      case 'act': actQueued = true; break;
      case 'radio': radioQueued = true; break;
      case 'pause': if (state === 'play') state = 'pause'; break;
      case 'resume': if (state === 'pause') state = 'play'; break;
      case 'restart': start(training); break;
      case 'menu': state = 'menu'; game = null; break;
      default:
        if (id.indexOf('card') === 0) toast = { text: DP.lobby.SHOP[+id.slice(4)].name + ': COMPRAS EM BREVE', t: 2.2 };
    }
  }

  function start(tr) {
    training = tr; newBest = false; showMap = false;
    DP.render.reset();
    game = DP.createGame({ training: tr, map: curMap, role, difficulty, sfx: (n, p) => { const f = DP.audio.sfx[n]; if (f) f(p); } });
    state = 'play';
    joy.id = null; joy.active = false; joy.dx = joy.dy = 0;
    beatT = 0;
    window.__dp.game = game;
  }

  // garante que o teclado chegue ao jogo (importante dentro de iframe/artefato)
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  function focusGame() { try { window.focus(); canvas.focus({ preventScroll: true }); } catch (x) {} }
  window.addEventListener('pointerdown', focusGame);

  canvas.addEventListener('pointerdown', (e) => {
    focusGame();
    if (e.pointerType === 'touch') DP.ui.keys = false;
    DP.audio.init();
    const p = toLocal(e);
    if (state === 'play' && game && game.role === 'survivor' && game.s.skill) pressQueued = true;
    const b = hit(buttons(), p);
    if (b) { held.set(e.pointerId, b.id); act(b.id); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} return; }
    if (state === 'play' && joy.id === null) {
      joy.id = e.pointerId; joy.active = true; joy.bx = p.x; joy.by = p.y; joy.dx = joy.dy = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    const p = toLocal(e);
    let dx = (p.x - joy.bx) / 20, dy = (p.y - joy.by) / 20;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    // a base acompanha o dedo (joystick flutuante)
    if (l > 1.6) { joy.bx += (p.x - joy.bx) * 0.15; joy.by += (p.y - joy.by) * 0.15; }
    joy.dx = dx; joy.dy = dy;
  });
  function release(e) {
    held.delete(e.pointerId);
    if (e.pointerId === joy.id) { joy.id = null; joy.active = false; joy.dx = joy.dy = 0; }
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // aceita e.code (posição física) e cai para e.key quando o navegador não informa
  const FALLBACK = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', p: 'KeyP', r: 'KeyR', m: 'KeyM', n: 'KeyN', Tab: 'Tab', t: 'KeyT', ' ': 'Space', Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  const codeOf = (e) => (e.code && e.code !== 'Unidentified') ? e.code : (FALLBACK[e.key] || FALLBACK[(e.key || '').toLowerCase()] || '');
  const BLOCK = ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  window.addEventListener('keydown', (e) => {
    const code = codeOf(e);
    if (!code) return;
    DP.ui.keys = true;
    if (BLOCK.includes(code)) e.preventDefault();
    if (e.repeat) return;
    keys[code] = true;
    DP.audio.init();
    if (state === 'play') {
      if (code === 'KeyE') { actQueued = true; pressQueued = true; }
      if (code === 'Space' || code === 'Enter') { dropQueued = true; pressQueued = true; }
      if (code === 'KeyP' || code === 'Escape') state = 'pause';
      if (code === 'KeyV' && game && game.training) game.fullVision = !game.fullVision;
      if (code === 'KeyQ') radioQueued = true;
    } else if (state === 'pause') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Enter') state = 'play';
    } else if (state === 'menu') {
      if (code === 'Enter' || code === 'Space') state = 'lobby';
      if (code === 'KeyP') state = 'chars';
      if (code === 'KeyL') state = 'shop';
      if (code === 'KeyH') { helpFrom = 'menu'; state = 'help'; }
    } else if (state === 'lobby') {
      if (code === 'Enter' || code === 'Space') { curMap = lobbyMode === 2 ? 'arena' : 'camp'; start(lobbyMode > 0); }
      if (code === 'KeyT') lobbyMode = (lobbyMode + 1) % 3;
      if (code === 'Digit1') role = 'survivor';
      if (code === 'Digit2') role = 'killer';
      if (code === 'Escape') state = 'menu';
    } else if (state === 'help') {
      if (code === 'Escape' || code === 'Enter') state = helpFrom;
      if (code === 'ArrowRight' || code === 'Space' || code === 'KeyD') helpPage = (helpPage + 1) % (DP.lobby.helpCount || 3);
      if (code === 'ArrowLeft' || code === 'KeyA') helpPage = (helpPage + (DP.lobby.helpCount || 3) - 1) % (DP.lobby.helpCount || 3);
    } else if (state === 'chars' || state === 'shop') {
      if (code === 'Escape' || code === 'Enter') state = 'menu';
    } else if (state === 'over') {
      if (code === 'KeyR' || code === 'Enter') start(training);
      if (code === 'Escape') { state = 'menu'; game = null; }
    }
    if (code === 'KeyR' && state === 'play') start(training);
    if (code === 'KeyM' || code === 'Tab') { if (state === 'play') showMap = !showMap; }
    if (code === 'KeyN') DP.audio.toggleMute();
  });
  window.addEventListener('keyup', (e) => { const c = codeOf(e); if (c) keys[c] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') state = 'pause'; });

  function readInput() {
    let ax = 0, ay = 0;
    if (keys.KeyA || keys.ArrowLeft) ax -= 1;
    if (keys.KeyD || keys.ArrowRight) ax += 1;
    if (keys.KeyW || keys.ArrowUp) ay -= 1;
    if (keys.KeyS || keys.ArrowDown) ay += 1;
    if (joy.active) {
      const l = Math.hypot(joy.dx, joy.dy);
      if (l > 0.18) {
        // pequena ajuda de eixo: um dedo quase reto vira reto
        let jx = joy.dx, jy = joy.dy;
        if (Math.abs(jx) < 0.22 * Math.abs(jy)) jx = 0;
        else if (Math.abs(jy) < 0.22 * Math.abs(jx)) jy = 0;
        ax += jx; ay += jy;
      }
    }
    const act = !!keys.KeyE || [...held.values()].includes('act');
    // andar (devagar e quieto): Shift, ou arrastar o joystick só um pouquinho
    let walk = !!(keys.ShiftLeft || keys.ShiftRight);
    if (joy.active) { const l = Math.hypot(joy.dx, joy.dy); if (l > 0.18 && l < 0.55 && !keys.KeyW && !keys.KeyA && !keys.KeyS && !keys.KeyD) walk = true; }
    const stealth = role === 'killer' && !!(keys.ShiftLeft || keys.ShiftRight || [...held.values()].includes('stealth'));
    const out = { ax, ay, drop: dropQueued, act, actPress: actQueued, press: pressQueued, walk, radio: radioQueued, stealth };
    dropQueued = actQueued = pressQueued = radioQueued = false;
    return out;
  }

  // ---------- fim de partida: recordes, fichas, histórico e registro ----------
  function finishMatch() {
    const g = game, ka = g.role === 'killer';
    const win = ka ? g.result === 'dead' : g.result === 'escaped';
    newBest = false; lastReward = 0;
    if (!training) {
      if (ka) {
        if (win && (!hunt || g.time < hunt)) { hunt = g.time; newBest = true; try { localStorage.setItem('dp_hunt', String(hunt)); } catch (e) {} }
      } else if (g.result === 'escaped' && (!fastest || g.time < fastest)) { fastest = g.time; newBest = true; try { localStorage.setItem('dp_esc', String(fastest)); } catch (e) {} }
      else if (g.result === 'dead' && g.time > best) { best = g.time; newBest = true; try { localStorage.setItem('dp_best', String(best)); } catch (e) {} }
      // fichas: pelo que a equipe/assassino fez, mais bônus por vencer
      lastReward = ka
        ? 10 + g.stats.hits * 5 + g.deadCount * 20 + (win ? 30 : 0)
        : 10 + g.gensDone * 5 + g.stats.stuns * 5 + (win ? 40 : 0);
      coins += lastReward;
      const h = hist[ka ? 'killer' : 'survivor']; h.push(win ? 'W' : 'L'); while (h.length > 12) h.shift();
      try { localStorage.setItem('dp_coins', String(coins)); localStorage.setItem('dp_hist', JSON.stringify(hist)); } catch (e) {}
    }
    // registro das últimas partidas (inclui treino) para analisar equilíbrio com números
    const st = g.stats;
    log.push({ d: Date.now(), role: g.role, map: curMap, diff: g.diff.level, training, win, result: g.result, t: Math.round(g.time), gens: g.gensDone, esc: g.escapedCount, dead: g.deadCount,
      hits: st.hits, lunges: st.lunges, stuns: st.stuns, vaults: st.vaults, cuts: st.cuts, breaks: st.breaks, smashes: st.smashes, kicks: st.kicks, drops: st.drops, skillOk: st.skillOk, skillFail: st.skillFail,
      calls: g.phone ? g.phone.calls : 0, car: g.vehicles[0] ? g.vehicles[0].pax.length : 0, boat: g.vehicles[1] ? g.vehicles[1].pax.length : 0, sab: st.sabotages || 0 });
    while (log.length > 60) log.shift();
    try { localStorage.setItem('dp_log', JSON.stringify(log)); } catch (e) {}
  }
  // resumo para colar numa conversa: window.__dp.report()
  function report() {
    const out = {};
    for (const r of ['survivor', 'killer']) {
      const m = log.filter((x) => x.role === r && !x.training && x.map !== 'arena');
      if (!m.length) continue;
      const w = m.filter((x) => x.win).length, avg = (k) => (m.reduce((a, x) => a + (x[k] || 0), 0) / m.length).toFixed(1);
      out[r] = { partidas: m.length, vitorias: w, tempoMedio: avg('t') + 's', geradores: avg('gens'), escaparam: avg('esc'), abatidos: avg('dead'), acertos: avg('hits'), botes: avg('lunges'), aproveitamento: r === 'killer' ? Math.round(100 * m.reduce((a, x) => a + x.hits, 0) / Math.max(1, m.reduce((a, x) => a + x.lunges, 0))) + '%' : undefined };
    }
    return out;
  }

  function lobbyUI() { return { helpPage, touch: !DP.ui.keys, role, difficulty, training: lobbyMode > 0, mode: lobbyMode, coins, hist, best: bestText(), toast: toast ? toast.text : null }; }

  // ---------- laço ----------
  let last = performance.now(), beatT = 0, radioT = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const tm = now / 1000;

    if (state === 'play' && game) {
      const inp = readInput();
      const steps = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < steps; i++) { game.update(dt / steps, i === 0 ? inp : { ax: inp.ax, ay: inp.ay, act: inp.act }); }

      // bipe do rádio: mais rápido quanto mais perto
      if (!game.over && game.role === 'survivor' && game.s.det > 0) {
        radioT -= dt;
        if (radioT <= 0) { DP.audio.sfx.beep(game.s.det); radioT = [0, 1.3, 0.65, 0.28][game.s.det]; }
      } else radioT = 0;
      // batimento do coração (raio de terror)
      if (!game.over && game.k.state !== 'intro') {
        const near = 1 - Math.min(1, game.dist / 14);
        if (near > 0.05) {
          beatT -= dt;
          if (beatT <= 0) { DP.audio.sfx.heart(0.15 + near * 0.55); beatT = 1.2 - near * 0.75; }
        }
      }
      if (game.over && state === 'play' && game.overT > 1.6) { state = 'over'; finishMatch(); }
    }

    // ---- desenho ----
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    if (MENU_STATES.includes(state)) {
      const L = DP.lobby.layout(state, W, H), ui = lobbyUI();
      if (state === 'menu') DP.lobby.drawMenu(ctx, W, H, tm, ui);
      else if (state === 'lobby') DP.lobby.drawLobby(ctx, W, H, tm, ui, L);
      else if (state === 'chars') DP.lobby.drawChars(ctx, W, H, tm, ui, L);
      else if (state === 'help') DP.lobby.drawHelp(ctx, W, H, tm, ui, L);
      else DP.lobby.drawShop(ctx, W, H, tm, ui, L);
    } else if (game) {
      DP.render.drawWorld(ctx, game, W, H, tm);
      DP.render.drawHUD(ctx, game, W, H, tm);
      if (showMap && state === 'play') DP.render.drawMap(ctx, game, W, H, tm);
      else if (state === 'play' || state === 'pause') DP.render.drawMini(ctx, game, W, H, tm);
      DP.render.drawSkill(ctx, game, W, H, tm);
      if (state === 'over') DP.render.drawOver(ctx, game, W, H, tm, best, newBest, lastReward);
      else if (game.over) DP.render.overlay(ctx, W, H, Math.min(0.6, game.overT * 0.5));
      if (state === 'pause') {
        DP.render.overlay(ctx, W, H, 0.7);
        text(ctx, 'PAUSADO', Math.round(W / 2), Math.round(H * 0.2), '#fff', { align: 'c' });
        text(ctx, 'M: MAPA   N: SOM   P: PAUSA', Math.round(W / 2), Math.round(H * 0.2) + 14, '#8a8a99', { align: 'c' });
      }
    }
    // botões e joystick
    const bl = buttons();
    const pressed = new Set(held.values());
    for (const b of bl) if (!b.ghost) DP.render.drawButton(ctx, b, tm, pressed.has(b.id));
    if (state === 'play') DP.render.drawJoystick(ctx, joy);

    requestAnimationFrame(frame);
  }

  window.__dp = { get showMap() { return showMap; }, buttons, report, get log() { return log; }, get coins() { return coins; }, get role() { return role; }, set role(v) { role = v; }, get game() { return game; }, set game(v) { game = v; }, start, get state() { return state; }, set state(v) { state = v; }, keys };
  resize();
  requestAnimationFrame(frame);
})();
