// Laço principal, estados de tela (menu / jogo / pausa / fim), entrada por toque e teclado.
(function () {
  'use strict';
  const DP = window.DP;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const text = DP.font.text;

  let W = 320, H = 180, scale = 4;
  let state = 'menu';          // menu | play | pause | over
  let game = null;
  let training = false;
  let best = 0, newBest = false;
  try { best = parseFloat(localStorage.getItem('dp_best') || '0') || 0; } catch (e) {}

  // ---------- entrada ----------
  const keys = {};
  const joy = { id: null, active: false, bx: 0, by: 0, dx: 0, dy: 0 };
  const held = new Map();        // pointerId -> botão pressionado
  let dropQueued = false;

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
    if (state === 'menu') {
      const bw = Math.min(150, W - 24), by = Math.round(H * 0.5);
      list.push({ id: 'play', label: 'JOGAR', x: cx - bw / 2, y: by, w: bw, h: 17, color: '#ffd23f' });
      list.push({ id: 'train', label: 'TREINO (NÃO MORRE)', x: cx - bw / 2, y: by + 23, w: bw, h: 17, color: '#7ad0ff' });
    } else if (state === 'play') {
      const r = Math.max(22, Math.min(30, Math.round(Math.min(W, H) * 0.16)));
      list.push({ id: 'drop', label: 'DERRUBAR', round: true, x: W - 2 * r - 10, y: H - 2 * r - 12, w: 2 * r, h: 2 * r, active: !!(game && game.near) });
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
      case 'play': start(false); break;
      case 'train': start(true); break;
      case 'drop': dropQueued = true; break;
      case 'pause': if (state === 'play') state = 'pause'; break;
      case 'resume': if (state === 'pause') state = 'play'; break;
      case 'restart': start(training); break;
      case 'menu': state = 'menu'; game = null; break;
    }
  }

  function start(tr) {
    training = tr; newBest = false;
    DP.render.reset();
    game = DP.createGame({ training: tr, sfx: (n, p) => { const f = DP.audio.sfx[n]; if (f) f(p); } });
    state = 'play';
    joy.id = null; joy.active = false; joy.dx = joy.dy = 0;
    beatT = 0;
    window.__dp.game = game;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    DP.audio.init();
    const p = toLocal(e);
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

  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); return; }
    keys[e.code] = true;
    DP.audio.init();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (state === 'play') {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') dropQueued = true;
      if (e.code === 'KeyP' || e.code === 'Escape') state = 'pause';
    } else if (state === 'pause') {
      if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter') state = 'play';
    } else if (state === 'menu') {
      if (e.code === 'Enter' || e.code === 'Space') start(false);
      if (e.code === 'KeyT') start(true);
    } else if (state === 'over') {
      if (e.code === 'KeyR' || e.code === 'Enter') start(training);
    }
    if (e.code === 'KeyR' && state === 'play') start(training);
    if (e.code === 'KeyM') DP.audio.toggleMute();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
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
    const drop = dropQueued; dropQueued = false;
    return { ax, ay, drop };
  }

  // ---------- laço ----------
  let last = performance.now(), beatT = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const tm = now / 1000;

    if (state === 'play' && game) {
      const inp = readInput();
      const steps = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < steps; i++) { game.update(dt / steps, i === 0 ? inp : { ax: inp.ax, ay: inp.ay }); }

      // batimento do coração (raio de terror)
      if (!game.over && game.k.state !== 'intro') {
        const near = 1 - Math.min(1, game.dist / 14);
        if (near > 0.05) {
          beatT -= dt;
          if (beatT <= 0) { DP.audio.sfx.heart(0.15 + near * 0.55); beatT = 1.2 - near * 0.75; }
        }
      }
      if (game.over && state === 'play' && game.overT > 1.6) {
        state = 'over';
        if (!training && game.time > best) {
          best = game.time; newBest = true;
          try { localStorage.setItem('dp_best', String(best)); } catch (e) {}
        }
      }
    }

    // ---- desenho ----
    if (state === 'menu') {
      DP.render.drawMenu(ctx, W, H, tm, best);
    } else if (game) {
      DP.render.drawWorld(ctx, game, W, H, tm);
      DP.render.drawHUD(ctx, game, W, H, tm);
      if (state === 'over') DP.render.drawOver(ctx, game, W, H, tm, best, newBest);
      else if (game.over) DP.render.overlay(ctx, W, H, Math.min(0.6, game.overT * 0.5));
      if (state === 'pause') {
        DP.render.overlay(ctx, W, H, 0.7);
        text(ctx, 'PAUSADO', Math.round(W / 2), Math.round(H * 0.2), '#fff', { align: 'c' });
        const tips = DP.font.wrap('E / ESPAÇO: DERRUBAR PALLET. WASD OU SETAS: MOVER. M: SOM.', Math.floor((W - 16) / 6));
        tips.forEach((l, i) => text(ctx, l, Math.round(W / 2), Math.round(H * 0.2) + 14 + i * 9, '#a9a9b5', { align: 'c' }));
      }
    }
    // botões e joystick
    const bl = buttons();
    const pressed = new Set(held.values());
    for (const b of bl) DP.render.drawButton(ctx, b, tm, pressed.has(b.id));
    if (state === 'play') DP.render.drawJoystick(ctx, joy);

    requestAnimationFrame(frame);
  }

  window.__dp = { get game() { return game; }, set game(v) { game = v; }, start, get state() { return state; }, set state(v) { state = v; }, keys };
  resize();
  requestAnimationFrame(frame);
})();
