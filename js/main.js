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
  let lobbyTraining = false;   // opção "TREINO" na sala
  let toast = null;            // { text, t }
  let coins = 0, hist = { survivor: [], killer: [] }, log = [];
  let lastReward = 0;
  try {
    coins = parseInt(localStorage.getItem('dp_coins') || '0', 10) || 0;
    hist = Object.assign({ survivor: [], killer: [] }, JSON.parse(localStorage.getItem('dp_hist') || '{}'));
    log = JSON.parse(localStorage.getItem('dp_log') || '[]');
  } catch (e) {}
  const MENU_STATES = ['menu', 'lobby', 'chars', 'shop'];
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
  let dropQueued = false, actQueued = false, pressQueued = false;

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
      if (role === 'killer') {
        const close = !!(game && !game.over && game.dist < 2.4 && game.k.state === 'chase');
        list.push({ id: 'drop', label: 'ATACAR', round: true, x: W - 2 * r - 8, y: H - 2 * r - 10, w: 2 * r, h: 2 * r, active: close, hot: '#ff5c5c' });
        list.push({ id: 'act', label: 'AGIR', round: true, x: W - 2 * r - 8 - 2 * r2 - 6, y: H - 2 * r2 - 10, w: 2 * r2, h: 2 * r2, active: !!(game && game.kInteract), hot: '#ff9d5c' });
      } else {
        list.push({ id: 'act', label: 'AGIR', round: true, x: W - 2 * r - 8, y: H - 2 * r - 10, w: 2 * r, h: 2 * r, active: !!(game && game.interact) });
        list.push({ id: 'drop', label: 'PALLET', round: true, x: W - 2 * r - 8 - 2 * r2 - 6, y: H - 2 * r2 - 10, w: 2 * r2, h: 2 * r2, active: !!(game && game.near) });
      }
      list.push({ id: 'pause', label: 'II', x: W - 22, y: 24, w: 18, h: 13, color: '#cfcfd8' });
    } else if (state === 'pause') {
      const bw = Math.min(150, W - 24), by = Math.round(H * 0.4);
      list.push({ id: 'resume', label: 'CONTINUAR', x: cx - bw / 2, y: by, w: bw, h: 17, color: '#ffd23f' });
      list.push({ id: 'restart', label: 'REINICIAR', x: cx - bw / 2, y: by + 23, w: bw, h: 17 });
      list.push({ id: 'menu', label: 'MENU', x: cx - bw / 2, y: by + 46, w: bw, h: 17, color: '#8a8a99' });
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
      case 'back': state = 'menu'; break;
      case 'kslot': role = role === 'killer' ? 'survivor' : 'killer'; break;
      case 'train_toggle': lobbyTraining = !lobbyTraining; break;
      case 'start': start(lobbyTraining); break;
      case 'drop': dropQueued = true; break;
      case 'act': actQueued = true; break;
      case 'pause': if (state === 'play') state = 'pause'; break;
      case 'resume': if (state === 'pause') state = 'play'; break;
      case 'restart': start(training); break;
      case 'menu': state = 'menu'; game = null; break;
      default:
        if (id.indexOf('card') === 0) toast = { text: DP.lobby.SHOP[+id.slice(4)].name + ': COMPRAS EM BREVE', t: 2.2 };
    }
  }

  function start(tr) {
    training = tr; newBest = false;
    DP.render.reset();
    game = DP.createGame({ training: tr, role, sfx: (n, p) => { const f = DP.audio.sfx[n]; if (f) f(p); } });
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
  const FALLBACK = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', p: 'KeyP', r: 'KeyR', m: 'KeyM', t: 'KeyT', ' ': 'Space', Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  const codeOf = (e) => (e.code && e.code !== 'Unidentified') ? e.code : (FALLBACK[e.key] || FALLBACK[(e.key || '').toLowerCase()] || '');
  const BLOCK = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  window.addEventListener('keydown', (e) => {
    const code = codeOf(e);
    if (!code) return;
    if (BLOCK.includes(code)) e.preventDefault();
    if (e.repeat) return;
    keys[code] = true;
    DP.audio.init();
    if (state === 'play') {
      if (code === 'KeyE') { actQueued = true; pressQueued = true; }
      if (code === 'Space' || code === 'Enter') { dropQueued = true; pressQueued = true; }
      if (code === 'KeyP' || code === 'Escape') state = 'pause';
    } else if (state === 'pause') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Enter') state = 'play';
    } else if (state === 'menu') {
      if (code === 'Enter' || code === 'Space') state = 'lobby';
      if (code === 'KeyP') state = 'chars';
      if (code === 'KeyL') state = 'shop';
    } else if (state === 'lobby') {
      if (code === 'Enter' || code === 'Space') start(lobbyTraining);
      if (code === 'KeyT') lobbyTraining = !lobbyTraining;
      if (code === 'Digit1') role = 'survivor';
      if (code === 'Digit2') role = 'killer';
      if (code === 'Escape') state = 'menu';
    } else if (state === 'chars' || state === 'shop') {
      if (code === 'Escape' || code === 'Enter') state = 'menu';
    } else if (state === 'over') {
      if (code === 'KeyR' || code === 'Enter') start(training);
      if (code === 'Escape') { state = 'menu'; game = null; }
    }
    if (code === 'KeyR' && state === 'play') start(training);
    if (code === 'KeyM') DP.audio.toggleMute();
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
    const out = { ax, ay, drop: dropQueued, act, actPress: actQueued, press: pressQueued, walk };
    dropQueued = actQueued = pressQueued = false;
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
    log.push({ d: Date.now(), role: g.role, training, win, result: g.result, t: Math.round(g.time), gens: g.gensDone, esc: g.escapedCount, dead: g.deadCount,
      hits: st.hits, lunges: st.lunges, stuns: st.stuns, vaults: st.vaults, cuts: st.cuts, breaks: st.breaks, smashes: st.smashes, kicks: st.kicks, drops: st.drops, skillOk: st.skillOk, skillFail: st.skillFail });
    while (log.length > 60) log.shift();
    try { localStorage.setItem('dp_log', JSON.stringify(log)); } catch (e) {}
  }
  // resumo para colar numa conversa: window.__dp.report()
  function report() {
    const out = {};
    for (const r of ['survivor', 'killer']) {
      const m = log.filter((x) => x.role === r && !x.training);
      if (!m.length) continue;
      const w = m.filter((x) => x.win).length, avg = (k) => (m.reduce((a, x) => a + (x[k] || 0), 0) / m.length).toFixed(1);
      out[r] = { partidas: m.length, vitorias: w, tempoMedio: avg('t') + 's', geradores: avg('gens'), escaparam: avg('esc'), abatidos: avg('dead'), acertos: avg('hits'), botes: avg('lunges'), aproveitamento: r === 'killer' ? Math.round(100 * m.reduce((a, x) => a + x.hits, 0) / Math.max(1, m.reduce((a, x) => a + x.lunges, 0))) + '%' : undefined };
    }
    return out;
  }

  function lobbyUI() { return { role, training: lobbyTraining, coins, hist, best: bestText(), toast: toast ? toast.text : null }; }

  // ---------- laço ----------
  let last = performance.now(), beatT = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const tm = now / 1000;

    if (state === 'play' && game) {
      const inp = readInput();
      const steps = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < steps; i++) { game.update(dt / steps, i === 0 ? inp : { ax: inp.ax, ay: inp.ay, act: inp.act }); }

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
      else DP.lobby.drawShop(ctx, W, H, tm, ui, L);
    } else if (game) {
      DP.render.drawWorld(ctx, game, W, H, tm);
      DP.render.drawHUD(ctx, game, W, H, tm);
      DP.render.drawSkill(ctx, game, W, H, tm);
      if (state === 'over') DP.render.drawOver(ctx, game, W, H, tm, best, newBest, lastReward);
      else if (game.over) DP.render.overlay(ctx, W, H, Math.min(0.6, game.overT * 0.5));
      if (state === 'pause') {
        DP.render.overlay(ctx, W, H, 0.7);
        text(ctx, 'PAUSADO', Math.round(W / 2), Math.round(H * 0.2), '#fff', { align: 'c' });
        const tips = DP.font.wrap(role === 'killer' ? 'WASD/SETAS: MOVER. ESPAÇO: ATACAR. E: QUEBRAR PALLET OU JANELA, CHUTAR GERADOR (MEXER CANCELA). M: SOM.' : 'WASD/SETAS: MOVER. SHIFT: ANDAR (QUIETO). SEGURE E: CONSERTAR / ABRIR JANELA. ESPAÇO: DERRUBAR PALLET E ACERTAR O SKILL CHECK. M: SOM.', Math.floor((W - 16) / 6));
        tips.forEach((l, i) => text(ctx, l, Math.round(W / 2), Math.round(H * 0.2) + 14 + i * 9, '#a9a9b5', { align: 'c' }));
      }
    }
    // botões e joystick
    const bl = buttons();
    const pressed = new Set(held.values());
    for (const b of bl) if (!b.ghost) DP.render.drawButton(ctx, b, tm, pressed.has(b.id));
    if (state === 'play') DP.render.drawJoystick(ctx, joy);

    requestAnimationFrame(frame);
  }

  window.__dp = { buttons, report, get log() { return log; }, get coins() { return coins; }, get role() { return role; }, set role(v) { role = v; }, get game() { return game; }, set game(v) { game = v; }, start, get state() { return state; }, set state(v) { state = v; }, keys };
  resize();
  requestAnimationFrame(frame);
})();
