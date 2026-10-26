// Desenho: mapa pré-renderizado, sprites em pixel art gerados por código, HUD.
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};
  const TS = 16;
  const text = (...a) => DP.font.text(...a);

  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function px(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  // ---------- mapa estático ----------
  function buildStatic(game) {
    const { W, H, t, indoor, ground } = game.map;
    const cv = document.createElement('canvas');
    cv.width = W * TS; cv.height = H * TS;
    const c = cv.getContext('2d');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS, r = hash(x, y);
        const fl = t[i] === 0 || t[i] === 3 || t[i] === 6 || t[i] === 7;
        const gk = ground ? ground[i] : 0;
        if (indoor[i] && fl) {
          // piso de tábuas
          px(c, (x + y) & 1 ? '#3a2f29' : '#40342c', X, Y, TS, TS);
          for (let l = 0; l < TS; l += 4) px(c, 'rgba(0,0,0,.28)', X, Y + l, TS, 1);
          if (r < 0.5) px(c, 'rgba(255,255,255,.04)', X + ((r * 40) | 0) % 12, Y + 1, 3, 3);
          px(c, 'rgba(0,0,0,.25)', X + ((hash(x, y, 3) * 14) | 0), Y + ((hash(x, y, 4) * 3) | 0) * 4, 1, 4);
        } else if (fl && gk === 3) {
          // varanda / cais: tábuas na horizontal
          px(c, (x + y) & 1 ? '#4a3a2a' : '#524030', X, Y, TS, TS);
          for (let l = 0; l < TS; l += 5) px(c, 'rgba(0,0,0,.35)', X, Y + l, TS, 1);
          px(c, 'rgba(0,0,0,.3)', X + ((hash(x, y, 5) * 12) | 0) + 2, Y + ((hash(x, y, 6) * 3) | 0) * 5 + 1, 1, 4);
          px(c, 'rgba(255,255,255,.05)', X, Y, TS, 1);
        } else if (fl) {
          const base = gk === 1 ? ['#3a2f25', '#3e3329', '#2a2219', '#4a3d30']
            : gk === 2 ? ['#59523a', '#5e573d', '#4a4430', '#6d6548']
            : gk === 4 ? ['#3b3d42', '#3f4146', '#2c2e33', '#4e5057']
            : ['#1f2a22', '#222e25', '#18211b', '#2b3a2d'];
          px(c, r < 0.5 ? base[0] : base[1], X, Y, TS, TS);
          for (let n = 0; n < 5; n++) {
            const rx = (hash(x, y, n + 10) * 15) | 0, ry = (hash(x, y, n + 20) * 15) | 0;
            px(c, hash(x, y, n + 30) < 0.5 ? base[3] : base[2], X + rx, Y + ry, hash(x, y, n) < 0.3 ? 2 : 1, 1);
          }
          if (gk === 0 && r > 0.93) { px(c, '#3d5a3a', X + 5, Y + 9, 1, 3); px(c, '#3d5a3a', X + 7, Y + 8, 1, 4); px(c, '#3d5a3a', X + 9, Y + 10, 1, 2); }
        }
      }
    }
    // água
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS;
        if (t[i] !== 7) continue;
        const r = hash(x, y, 40);
        px(c, r < 0.5 ? '#142c42' : '#163248', X, Y, TS, TS);
        for (let n = 0; n < 3; n++) px(c, '#21506c', X + ((hash(x, y, n + 41) * 12) | 0), Y + ((hash(x, y, n + 45) * 14) | 0), 3 + n, 1);
        if (r > 0.85) px(c, '#3a7390', X + 4, Y + 6, 2, 1);
        // margem: faixa clara do lado de terra
        if (y > 0 && t[i - W] !== 7) px(c, '#2c6b88', X, Y, TS, 1);
        if (x > 0 && t[i - 1] !== 7) px(c, '#2c6b88', X, Y, 1, TS);
        if (x + 1 < W && t[i + 1] !== 7) px(c, '#10222f', X + TS - 1, Y, 1, TS);
        if (y + 1 < H && t[i + W] !== 7) px(c, '#10222f', X, Y + TS - 1, TS, 1);
      }
    }
    // árvores: copa redonda sobre o tronco; vizinhas se fundem numa mata fechada
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS;
        if (t[i] !== 6) continue;
        const r = hash(x, y, 60), sh = r < 0.33 ? ['#102a1a', '#17381f', '#21502c'] : r < 0.66 ? ['#12301d', '#1b4125', '#265a33'] : ['#0e2617', '#153320', '#1e4a2a'];
        px(c, 'rgba(0,0,0,.4)', X + 1, Y + 10, TS - 1, 5);
        px(c, '#3a2718', X + 6, Y + 9, 4, 6);
        px(c, '#2a1b10', X + 6, Y + 9, 1, 6);
        px(c, sh[0], X, Y + 1, TS, 11);
        px(c, sh[0], X + 2, Y, TS - 4, 13);
        px(c, sh[1], X + 2, Y + 1, TS - 5, 8);
        px(c, sh[1], X + 1, Y + 3, TS - 3, 6);
        px(c, sh[2], X + 4 + ((hash(x, y, 61) * 4) | 0), Y + 2, 5, 3);
        px(c, sh[2], X + 3, Y + 5 + ((hash(x, y, 62) * 3) | 0), 3, 2);
        px(c, 'rgba(0,0,0,.25)', X + 8, Y + 8, 6, 3);
      }
    }
    // paredes
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS;
        if (t[i] === 1 || t[i] === 4 || t[i] === 5) {
          px(c, '#4b4559', X, Y, TS, TS);
          for (let l = 0; l < TS; l += 4) px(c, '#3b3647', X, Y + l + 3, TS, 1);
          for (let l = 0; l < TS; l += 4) {
            const off = ((y * 4 + l / 4) & 1) ? 0 : 8;
            px(c, '#3b3647', X + off + 4, Y + l, 1, 3);
          }
          px(c, '#6a6282', X, Y, TS, 1);
          if (y + 1 < H && t[i + W] !== 1) { px(c, '#2a2633', X, Y + TS - 3, TS, 3); }
        } else if (t[i] === 2) {
          // caixote
          px(c, 'rgba(0,0,0,.35)', X + 1, Y + 2, TS - 1, TS - 1);
          px(c, '#6e4b2a', X + 1, Y + 1, TS - 2, TS - 2);
          px(c, '#8a6238', X + 1, Y + 1, TS - 2, 2);
          px(c, '#4d3320', X + 1, Y + TS - 3, TS - 2, 2);
          px(c, '#4d3320', X + 1, Y + 1, 1, TS - 2); px(c, '#4d3320', X + TS - 2, Y + 1, 1, TS - 2);
          for (let d = 2; d < TS - 3; d++) { px(c, '#5a3d22', X + d, Y + d, 1, 1); px(c, '#5a3d22', X + TS - 1 - d, Y + d, 1, 1); }
        }
      }
    }
    // sombra das paredes no chão
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (t[i] === 0 && (t[i - W] === 1 || t[i - W] === 5)) { px(c, 'rgba(0,0,0,.35)', x * TS, y * TS, TS, 3); px(c, 'rgba(0,0,0,.2)', x * TS, y * TS + 3, TS, 2); }
    }
    return cv;
  }

  // ---------- pallet ----------
  const WOOD = '#9a6b3a', WOOD_D = '#6b4524', WOOD_L = '#c08c50';

  function drawPalletFlat(ctx, p, prog) {
    // caído: tábua inclinada que ocupa o vão e se projeta para o lado da queda
    const X = p.tx * TS, Y = p.ty * TS;
    const cx = X + 8, cy = Y + 8;
    const len = 4 + 12 * prog;                  // quanto a tábua se projeta
    const w = 14;
    ctx.save();
    if (p.orient === 'h') {
      const y0 = p.dir.y > 0 ? cy - 3 : cy + 3 - len;
      px(ctx, 'rgba(0,0,0,.4)', cx - w / 2 + 1, y0 + 2, w, len);
      px(ctx, WOOD_D, cx - w / 2, y0, w, len);
      px(ctx, WOOD, cx - w / 2 + 1, y0 + 1, w - 2, len - 2);
      for (let i = 2; i < w - 1; i += 4) px(ctx, WOOD_D, cx - w / 2 + i, y0 + 1, 1, len - 2);
      px(ctx, WOOD_L, cx - w / 2 + 1, p.dir.y > 0 ? y0 + len - 2 : y0 + 1, w - 2, 1);
    } else {
      const x0 = p.dir.x > 0 ? cx - 3 : cx + 3 - len;
      px(ctx, 'rgba(0,0,0,.4)', x0 + 2, cy - w / 2 + 1, len, w);
      px(ctx, WOOD_D, x0, cy - w / 2, len, w);
      px(ctx, WOOD, x0 + 1, cy - w / 2 + 1, len - 2, w - 2);
      for (let i = 2; i < w - 1; i += 4) px(ctx, WOOD_D, x0 + 1, cy - w / 2 + i, len - 2, 1);
      px(ctx, WOOD_L, p.dir.x > 0 ? x0 + len - 2 : x0 + 1, cy - w / 2 + 1, 1, w - 2);
    }
    ctx.restore();
  }

  function drawPalletUp(ctx, p, pulse) {
    // de pé: moldura de madeira atravessada no vão
    const X = p.tx * TS, Y = p.ty * TS;
    if (p.orient === 'h') {
      px(ctx, 'rgba(0,0,0,.35)', X + 1, Y + 9, 15, 4);
      px(ctx, WOOD_D, X, Y + 1, TS, 9);
      px(ctx, WOOD, X + 1, Y + 2, TS - 2, 7);
      px(ctx, WOOD_D, X + 1, Y + 5, TS - 2, 1);
      for (let i = 1; i < 9; i++) { px(ctx, WOOD_L, X + 2 + i, Y + 8 - i, 1, 1); }
      px(ctx, WOOD_L, X + 1, Y + 2, TS - 2, 1);
    } else {
      px(ctx, 'rgba(0,0,0,.35)', X + 9, Y + 1, 4, 15);
      px(ctx, WOOD_D, X + 3, Y, 8, TS);
      px(ctx, WOOD, X + 4, Y + 1, 6, TS - 2);
      px(ctx, WOOD_D, X + 6, Y + 1, 1, TS - 2);
      px(ctx, WOOD_L, X + 4, Y + 1, 1, TS - 2);
      for (let i = 1; i < 11; i += 3) { px(ctx, WOOD_L, X + 7, Y + 2 + i, 2, 1); }
    }
    if (pulse) {
      ctx.strokeStyle = 'rgba(255,210,63,' + (0.35 + 0.35 * Math.sin(pulse * 8)) + ')';
      ctx.lineWidth = 1;
      ctx.strokeRect(X - 0.5, Y - 0.5, TS + 1, TS + 1);
    }
  }

  function drawBroken(ctx, p) {
    const X = p.tx * TS, Y = p.ty * TS;
    for (let n = 0; n < 7; n++) {
      const rx = (hash(p.tx, p.ty, n) * 13) | 0, ry = (hash(p.tx, p.ty, n + 9) * 13) | 0;
      px(ctx, n % 2 ? WOOD : WOOD_D, X + 1 + rx, Y + 1 + ry, hash(p.tx, p.ty, n + 3) < 0.5 ? 3 : 2, 1);
    }
  }

  // ---------- personagens ----------
  function dir4(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return Math.abs(c) > Math.abs(s) ? (c > 0 ? 'R' : 'L') : (s > 0 ? 'D' : 'U');
  }

  const JK = ['#3d6fb5', '#b5503d', '#3db56f', '#c9a43d'], JL = ['#5b8ad0', '#d0705b', '#5bd08d', '#e0c05b'];
  const JD = ['#2f548a', '#8a3b2b', '#2b8a52', '#9c7e2b'], HAIR = ['#3a2418', '#1c1c1c', '#6b4a22', '#c9b27a'];

  function drawSurvivor(ctx, s, game, tm) {
    const d = dir4(s.face);
    const x0 = Math.round(s.x * TS), y0 = Math.round(s.y * TS) + 5;
    // pose do pulo: arco, corpo inclinado para o lado em que passa, pernas encolhidas
    let lift = 0, tuck = false, lean = 0, armsUp = false, vx = 0, vy = 0, kind = '', p = 0;
    if (s.vault) {
      const v = s.vault; kind = v.kind; p = Math.min(1, v.t / v.dur);
      const dl = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) || 1; vx = (v.x1 - v.x0) / dl; vy = (v.y1 - v.y0) / dl;
      const arc = Math.sin(p * Math.PI);
      if (kind === 'walk') { lift = arc * 2.5; lean = arc * 2.5; tuck = p > 0.3 && p < 0.7; }
      else if (kind === 'crash') { lift = arc * 6.5; lean = arc * 3; tuck = true; armsUp = true; }
      else if (kind === 'run') { lift = arc * 6; lean = arc * 1.5; tuck = p > 0.25 && p < 0.75; }
      else { lift = arc * 5; tuck = p > 0.3 && p < 0.7; }
    }
    if (s.invuln > 0 && !s.vault && Math.floor(tm * 20) % 2) return;
    const id = s.id % 4, hurt = s.hp < 2;
    const step = Math.floor(s.walk) % 2;
    const bob = s.moving && step && !s.vault ? 1 : 0;
    const lx = Math.round(vx * lean), ly = Math.round(vy * lean * 0.6);
    const x = x0 + lx;

    px(ctx, 'rgba(0,0,0,.4)', x0 - 4, y0 - 1, 8, 2);
    const yb = y0 - Math.round(lift);            // pés
    const yy = yb + ly;                           // tronco e cabeça
    // linhas de velocidade atrás de quem corre/atravessa
    if (kind === 'run' || kind === 'crash') for (let i = 0; i < 3; i++) px(ctx, 'rgba(255,255,255,.35)', x0 - Math.round(vx * (6 + i * 3)) - 1, yb - 6 - i * 2 - Math.round(vy * (4 + i * 3)), 2, 1);
    // pernas
    const legC = '#26334d', lh = tuck ? 2 : 4;
    if (d === 'L' || d === 'R') {
      const a = s.moving && !tuck ? (step ? 1 : -1) : 0;
      px(ctx, legC, x0 - 1 + a, yb - lh, 2, lh); px(ctx, '#1b2438', x0 - 1 - a, yb - lh, 2, lh);
    } else {
      const a = s.moving && !tuck ? (step ? 1 : 0) : 0;
      px(ctx, legC, x0 - 3, yb - lh - (a ? 1 : 0), 2, lh); px(ctx, legC, x0 + 1, yb - lh - (a ? 0 : (s.moving && !tuck ? 1 : 0)), 2, lh);
    }
    // tronco
    px(ctx, JK[id], x - 4, yy - 10 - bob, 8, 6);
    px(ctx, JL[id], x - 4, yy - 10 - bob, 8, 1);
    if (hurt) { px(ctx, '#b02a2a', x - 2, yy - 8 - bob, 2, 1); px(ctx, '#b02a2a', x + 1, yy - 6 - bob, 1, 2); px(ctx, '#7a1a1a', x - 3, yy - 6 - bob, 1, 1); }
    // braços
    const armSwing = s.moving && !s.vault ? (step ? 1 : -1) : 0;
    if (armsUp) { px(ctx, JD[id], x - 5, yy - 17, 2, 6); px(ctx, JD[id], x + 3, yy - 17, 2, 6); px(ctx, '#e0b48a', x - 5, yy - 18, 2, 1); px(ctx, '#e0b48a', x + 3, yy - 18, 2, 1); }
    else if (d === 'L' || d === 'R') px(ctx, JD[id], x - 1, yy - 9 - bob + armSwing, 2, 4);
    else { px(ctx, JD[id], x - 5, yy - 9 - bob + armSwing, 1, 4); px(ctx, JD[id], x + 4, yy - 9 - bob - armSwing, 1, 4); }
    if (kind === 'walk' && p < 0.55) { px(ctx, '#e0b48a', x0 + Math.round(vx * 6) - 1, yb - 5 + Math.round(vy * 3), 2, 2); }   // mãos no parapeito
    // cabeça
    const hy = yy - 15 - bob;
    px(ctx, '#e0b48a', x - 3, hy, 6, 5);
    if (d === 'U') px(ctx, HAIR[id], x - 3, hy, 6, 5);
    else {
      px(ctx, HAIR[id], x - 3, hy, 6, 2);
      if (d === 'L') { px(ctx, HAIR[id], x + 1, hy, 2, 4); px(ctx, '#1a1a1a', x - 2, hy + 2, 1, 1); }
      else if (d === 'R') { px(ctx, HAIR[id], x - 3, hy, 2, 4); px(ctx, '#1a1a1a', x + 1, hy + 2, 1, 1); }
      else { px(ctx, '#1a1a1a', x - 2, hy + 2, 1, 1); px(ctx, '#1a1a1a', x + 1, hy + 2, 1, 1); }
    }
    // marcador de "este é você"
    if (s.human && game.role === 'survivor') {
      const mb = Math.round(Math.sin(tm * 5));
      px(ctx, '#ffffff', x - 2, hy - 6 + mb, 5, 1); px(ctx, '#ffffff', x - 1, hy - 5 + mb, 3, 1); px(ctx, '#ffffff', x, hy - 4 + mb, 1, 1);
    }
  }

  const CFGT = 0.4;   // = CFG.TRIP_T
  function drawKiller(ctx, k, game, tm) {
    const d = dir4(k.face);
    const x = Math.round(k.x * TS), y = Math.round(k.y * TS) + 6;
    const step = Math.floor(k.walk) % 2;
    const dormant = k.state === 'intro';
    const stun = k.state === 'stun';
    const stumble = k.state === 'stumble';
    const trip = stumble && k.trip > 0;
    // cambaleia de um lado para o outro; no tombo se joga para a frente
    const wob = stun ? Math.round(Math.sin(tm * 18) * 1.5) : stumble ? Math.round(Math.sin(tm * 13 + k.ph) * 2.2) : 0;
    const dip = trip ? Math.round(3 * Math.sin(Math.min(1, (CFGT - k.trip) / CFGT * 1.6) * Math.PI / 2)) : 0;
    const bob = (k.moving && step ? 1 : 0) - (trip ? dip : 0);
    const brk = k.state === 'break' ? Math.round(Math.sin(k.t * 20) * 1.5) : 0;

    px(ctx, 'rgba(0,0,0,.45)', x - 6, y - 1, 12, 3);
    // pernas
    const a = k.moving ? (step ? 1 : -1) : 0;
    if (d === 'L' || d === 'R') { px(ctx, '#17171d', x - 2 + a, y - 5, 3, 5); px(ctx, '#0f0f14', x - 2 - a, y - 5, 3, 5); }
    else { px(ctx, '#17171d', x - 4, y - 5 - (a > 0 ? 1 : 0), 3, 5); px(ctx, '#17171d', x + 1, y - 5 - (a < 0 ? 1 : 0), 3, 5); }
    // casaco
    const coat = stun ? '#3d3b4a' : '#2b2a38';
    px(ctx, coat, x - 6 + wob, y - 14 - bob, 12, 9);
    px(ctx, '#3a3950', x - 6 + wob, y - 14 - bob, 12, 1);
    px(ctx, '#8a1c1c', x - 6 + wob, y - 7 - bob, 12, 1);                          // barra do casaco suja de sangue
    if (d === 'D') px(ctx, '#8a1c1c', x - 1 + wob, y - 13 - bob, 2, 6);
    // capuz + máscara
    const hy = y - 22 - bob;
    px(ctx, '#1b1b24', x - 4 + wob, hy, 8, 8);
    if (d === 'U') { px(ctx, '#111118', x - 3 + wob, hy + 1, 6, 6); }
    else {
      const mx = d === 'L' ? -1 : d === 'R' ? 1 : 0;
      px(ctx, '#d9d4c4', x - 3 + wob + mx, hy + 2, 6, 6);
      const eye = (k.state === 'chase' || k.state === 'windup' || k.state === 'lunge') ? '#ff2a2a' : stun ? '#999' : '#222';
      if (d === 'D') { px(ctx, eye, x - 2 + wob, hy + 4, 1, 2); px(ctx, eye, x + 1 + wob, hy + 4, 1, 2); px(ctx, '#222', x - 1 + wob, hy + 7, 2, 1); }
      else { px(ctx, eye, x + (mx > 0 ? 1 : -2) + wob + mx, hy + 4, 1, 2); }
    }

    // arma (facão): ângulo depende do estado
    let wa = k.face + 1.1;
    let wl = 8;
    if (k.state === 'windup') { wa = k.face - 2.2 + (k.t / game.cfg.WINDUP) * 0.6; wl = 9; }
    else if (k.state === 'lunge') { wa = k.face + 0.1 - k.t * 3; wl = 11; }
    else if (k.state === 'break') { wa = -1.2 + (Math.abs(Math.sin(k.t * 6)) * 2.2); wl = 9; }
    else if (k.state === 'recover') { wa = k.face + 1.7; }
    const hx = x + (d === 'L' ? -5 : d === 'R' ? 5 : 6), hy2 = y - 10 - bob;
    const ex = hx + Math.cos(wa) * wl, ey = hy2 + Math.sin(wa) * wl;
    line(ctx, hx, hy2, ex, ey, '#c9ced6');
    line(ctx, hx, hy2, hx + Math.cos(wa) * 3, hy2 + Math.sin(wa) * 3, '#4a3320');
    px(ctx, '#3b2a2a', hx - 1, hy2 - 1, 2, 2);
    if (k.state === 'lunge') {
      for (let i = 1; i <= 3; i++) line(ctx, hx + Math.cos(wa - i * 0.35) * wl, hy2 + Math.sin(wa - i * 0.35) * wl,
        hx + Math.cos(wa - i * 0.35 - 0.3) * wl, hy2 + Math.sin(wa - i * 0.35 - 0.3) * wl, 'rgba(255,255,255,' + (0.5 - i * 0.12) + ')');
    }

    if (stumble) {
      // poeira e "tontura" suave durante o tropeço
      px(ctx, 'rgba(255,157,92,.9)', x + Math.round(Math.sin(tm * 9) * 6) - 1, hy - 4, 2, 2);
      if (trip) { px(ctx, 'rgba(139,115,85,.7)', x - 7, y - 1, 3, 1); px(ctx, 'rgba(139,115,85,.7)', x + 5, y - 2, 3, 1); }
    }
    if (stun) {
      for (let i = 0; i < 3; i++) {
        const an = tm * 7 + i * 2.09;
        px(ctx, '#ffd23f', x + Math.cos(an) * 7 - 1, hy - 4 + Math.sin(an) * 2, 2, 2);
      }
    }
    if (k.state === 'windup') px(ctx, '#ff2a2a', x - 1, hy - 5, 2, 3), px(ctx, '#ff2a2a', x - 1, hy - 1, 2, 1);
    if (dormant) { ctx.fillStyle = 'rgba(11,11,16,.55)'; ctx.fillRect(x - 8, hy - 2, 16, 30); }
  }

  function line(ctx, x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = col;
    for (let n = 0; n < 40; n++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ---------- gerador e portão ----------
  function drawGenGlow(ctx, o, tm) {
    if (!o.done) return;
    const g = ctx.createRadialGradient(o.cx * TS, o.cy * TS, 2, o.cx * TS, o.cy * TS, 30);
    g.addColorStop(0, 'rgba(125,255,160,' + (0.22 + 0.04 * Math.sin(tm * 3)) + ')'); g.addColorStop(1, 'rgba(125,255,160,0)');
    ctx.fillStyle = g; ctx.fillRect(o.cx * TS - 30, o.cy * TS - 30, 60, 60);
  }
  function drawGen(ctx, o, game, tm) {
    const X = o.tx * TS, Y = o.ty * TS;
    const working = game.survivors.some((v) => v.acting && v.acting.obj === o);
    const sh = working ? (Math.floor(tm * 30) % 2) : 0;
    px(ctx, 'rgba(0,0,0,.4)', X + 1, Y + 12, 15, 4);
    px(ctx, '#23262d', X + 1 + sh, Y + 3, 14, 11);
    px(ctx, '#3d424d', X + 2 + sh, Y + 4, 12, 9);
    px(ctx, '#5f6573', X + 2 + sh, Y + 3, 12, 2);
    px(ctx, '#d9822b', X + 2 + sh, Y + 12, 12, 1);
    px(ctx, '#0b0c10', X + 3 + sh, Y + 6, 10, 4);
    const w = Math.round(o.progress * 8);
    px(ctx, o.done ? '#7dffa0' : '#ffb347', X + 4 + sh, Y + 7, w, 2);
    px(ctx, o.done ? '#7dffa0' : (Math.floor(tm * 2) % 2 ? '#ff4d4d' : '#6a2020'), X + 12 + sh, Y + 4, 2, 1);
    // ventoinha
    px(ctx, '#15171b', X + 5 + sh, Y + 10, 6, 2);
    if (working) for (let i = 0; i < 3; i++) px(ctx, '#ffe27a', X + 2 + ((Math.random() * 13) | 0), Y + 2 + ((Math.random() * 6) | 0) - 2, 1, 1);
    if (!o.done && o.progress > 0) {
      px(ctx, '#000', X + 1, Y - 4, 14, 3);
      px(ctx, '#ffb347', X + 2, Y - 3, Math.round(o.progress * 12), 1);
    }
  }
  // janela: 'h' = em parede horizontal (vidro atravessa x); 'v' = em parede vertical
  const FR = '#7a5530', FRD = '#4d3420', GL = '#a9dcf2', GLD = '#6fb4dc', DARK = '#0d0d13';
  function drawWindow(ctx, w, game, tm) {
    const X = w.tx * TS, Y = w.ty * TS, hz = w.orient === 'h';
    const R = (col, a, b, c, d) => (hz ? px(ctx, col, X + a, Y + b, c, d) : px(ctx, col, X + b, Y + a, d, c));
    R(FRD, 0, 2, 16, 12); R(FR, 1, 3, 14, 10);                  // moldura
    if (w.state === 'closed') {
      const sh = w.prog > 0 ? Math.round(Math.sin(tm * 55) * 0.8) : 0;   // treme enquanto abrem
      R(GLD, 2 + sh, 4, 12, 8); R(GL, 2 + sh, 4, 12, 4);
      R(FRD, 7, 3, 2, 10);                                      // montante
      R('#ffffff', 3 + sh, 5, 3, 1); R('#ffffff', 10 + sh, 6, 2, 1); R('#e8f8ff', 4 + sh, 6, 1, 2);   // brilho
      if (w.prog > 0) {                                         // barra de abrir
        const bx = hz ? X + 2 : X - 2, by = hz ? Y - 3 : Y + 2;
        px(ctx, '#000', bx, by, 12, 3); px(ctx, '#7dffa0', bx + 1, by + 1, Math.round(10 * w.prog), 1);
      }
    } else if (w.state === 'open') {
      const p = Math.min(1, w.t / 0.4);
      const len = Math.round(12 - 9 * p);
      R(DARK, 2, 4, 12, 8);                                     // vão
      R('#d9b57a', 2, 11, 12, 1);                               // parapeito
      R(GL, 2, 4, len, 4); R(GLD, 2, 8, len, 1); R('#ffffff', 2, 4, len, 1);   // a folha desliza para o canto
      if (p < 1) R('rgba(255,255,255,.7)', 2 + len, 4, 2, 7);
    } else {                                                    // quebrada
      const p = Math.min(1, w.t / 0.5);
      R(DARK, 2, 4, 12, 8);
      for (let i = 0; i < 6; i++) {                             // dentes de vidro nas bordas
        const o = 2 + i * 2 + ((hash(w.tx, w.ty, i) * 2) | 0);
        R(GL, o, 4, 1, 2 + (i % 2)); R(GLD, o + 1, 11 - (i % 2) * 2, 1, 1 + (i % 2) * 2);
      }
      for (let i = 0; i < 10; i++) {                            // cacos no chão dos dois lados
        const side = i < 5 ? -1 : 1, along = 1 + ((hash(w.tx, w.ty, i + 9) * 14) | 0), off = 1 + ((hash(w.tx, w.ty, i + 20) * 6) | 0);
        const ax = hz ? X + along : (side < 0 ? X - off : X + TS + off - 1), ay = hz ? (side < 0 ? Y - off : Y + TS + off - 1) : Y + along;
        px(ctx, i % 2 ? 'rgba(190,230,250,.95)' : 'rgba(120,180,215,.95)', ax, ay, i % 3 ? 1 : 2, 1);
      }
      if (p < 1) { ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * (1 - p)) + ')'; ctx.fillRect(X - 3, Y - 3, TS + 6, TS + 6); }
    }
  }

  // porta principal (2 tiles): trancada → energizada → folhas abrindo
  function drawDoor(ctx, d, game, tm) {
    const X = d.tx * TS, Y = d.ty * TS, Wd = d.w * TS;
    const open = d.opened, p = open ? Math.min(1, d.t / 0.9) : 0;
    px(ctx, '#17151c', X, Y, Wd, TS);
    if (open) px(ctx, 'rgba(210,255,225,' + (0.45 + 0.35 * p) + ')', X + 1, Y, Wd - 2, TS);
    const leaf = Math.round((Wd / 2 - 1) * (1 - p));
    const col = d.powered ? '#56655d' : '#3d3944', colL = d.powered ? '#7a8f84' : '#59525f';
    for (const side of [0, 1]) {
      const lx = side ? X + Wd - 1 - leaf : X + 1;
      if (leaf <= 0) continue;
      px(ctx, col, lx, Y + 1, leaf, TS - 2); px(ctx, colL, lx, Y + 1, leaf, 1);
      for (let i = 3; i < leaf - 1; i += 5) px(ctx, 'rgba(0,0,0,.35)', lx + i, Y + 3, 1, TS - 6);
      px(ctx, '#c9a46a', side ? lx + 1 : lx + leaf - 3, Y + 7, 2, 2);                 // maçaneta
    }
    const blink = Math.floor(tm * 3) % 2;
    px(ctx, open ? '#7dffa0' : d.powered ? (blink ? '#ffd23f' : '#7a6420') : '#8a3030', X + Wd / 2 - 1, Y + 2, 2, 2);
    if (open) {                                                                          // luz que vaza para o chão
      const g = ctx.createLinearGradient(0, Y + TS, 0, Y + TS + 52);
      g.addColorStop(0, 'rgba(210,255,225,' + (0.34 * p) + ')'); g.addColorStop(1, 'rgba(210,255,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(X, Y + TS); ctx.lineTo(X + Wd, Y + TS); ctx.lineTo(X + Wd + 16, Y + TS + 52); ctx.lineTo(X - 16, Y + TS + 52); ctx.closePath(); ctx.fill();
    }
    text(ctx, 'SAÍDA', X + Wd / 2, Y + TS + 3, d.powered ? '#7dffa0' : '#8a8a99', { align: 'c' });
    if (d.progress > 0 && !open) { px(ctx, '#000', X + 2, Y + TS + 13, Wd - 4, 3); px(ctx, '#7dffa0', X + 3, Y + TS + 14, Math.round((Wd - 6) * d.progress), 1); }
  }

  // ---------- itens ----------
  function drawItem(ctx, it, tm) {
    const x = Math.round(it.x * TS), y = Math.round(it.y * TS);
    const pulse = 0.5 + 0.5 * Math.sin(tm * 4 + it.id);
    px(ctx, 'rgba(0,0,0,.4)', x - 5, y + 2, 10, 3);
    ctx.fillStyle = 'rgba(155,211,240,' + (0.10 + 0.10 * pulse) + ')';
    ctx.beginPath(); ctx.arc(x, y - 1, 8, 0, Math.PI * 2); ctx.fill();
    if (it.kind === 'radio') {
      px(ctx, '#2a2e36', x - 4, y - 5, 8, 7); px(ctx, '#4a505c', x - 4, y - 5, 8, 1);
      px(ctx, '#0d0d13', x - 3, y - 4, 4, 3); px(ctx, '#c9a46a', x + 2, y - 4, 1, 1); px(ctx, '#c9a46a', x + 2, y - 2, 1, 1);
      px(ctx, '#9aa0ac', x + 2, y - 9, 1, 4);                                    // antena
      px(ctx, pulse > 0.5 ? '#7dffa0' : '#2a6a40', x - 2, y - 3, 1, 1);          // LED
    } else {
      px(ctx, '#7a5530', x - 3, y - 4, 6, 6); px(ctx, '#c9a46a', x - 3, y - 4, 6, 1); px(ctx, '#e9c07a', x - 1, y - 2, 2, 2);
    }
  }

  // ---------- zona de impacto (ajuda visual) ----------
  function drawZone(ctx, game, tm, vis) {
    for (const nz of game.nearList) if (!vis || vis(nz.sv.x, nz.sv.y)) drawOneZone(ctx, game, tm, nz.pal, nz.sv);
  }
  function drawOneZone(ctx, game, tm, p, sv) {
    const C = game.cfg;
    const dir = game.dropDirFor(sv, p);
    const fake = { cx: p.cx, cy: p.cy, dir };
    const inside = game.k.state !== 'intro' && game.inZone(fake, game.k);
    let rx, ry, rw, rh;
    if (dir.x) { rw = C.ZONE_LEN + 0.6; rh = C.ZONE_W * 2; rx = dir.x > 0 ? p.cx - 0.6 : p.cx - C.ZONE_LEN; ry = p.cy - C.ZONE_W; }
    else { rh = C.ZONE_LEN + 0.6; rw = C.ZONE_W * 2; ry = dir.y > 0 ? p.cy - 0.6 : p.cy - C.ZONE_LEN; rx = p.cx - C.ZONE_W; }
    const a = inside ? 0.38 : 0.16 + 0.05 * Math.sin(tm * 6);
    ctx.fillStyle = inside ? 'rgba(255,70,50,' + a + ')' : 'rgba(255,210,63,' + a + ')';
    ctx.fillRect(Math.round(rx * TS), Math.round(ry * TS), Math.round(rw * TS), Math.round(rh * TS));
    ctx.strokeStyle = inside ? 'rgba(255,90,60,.9)' : 'rgba(255,210,63,.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(rx * TS) + 0.5, Math.round(ry * TS) + 0.5, Math.round(rw * TS) - 1, Math.round(rh * TS) - 1);
  }

  // ---------- cena ----------
  const R = { staticCv: null, vig: null, vigKey: '' };

  function vignette(ctx, W, H, danger, tm) {
    const key = W + 'x' + H;
    if (R.vigKey !== key) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.78)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const rd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
      rd.addColorStop(0, 'rgba(120,0,0,0)'); rd.addColorStop(1, 'rgba(160,0,0,1)');
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
      const g2 = c2.getContext('2d'); g2.fillStyle = rd; g2.fillRect(0, 0, W, H);
      R.vig = c; R.red = c2; R.vigKey = key;
    }
    ctx.drawImage(R.vig, 0, 0);
    if (danger > 0.02) {
      ctx.globalAlpha = Math.min(0.5, danger * (0.35 + 0.15 * Math.sin(tm * 9)));
      ctx.drawImage(R.red, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  // setas na borda da tela para barulhos fora de vista (gerador sendo consertado, explosões, gerador pronto)
  function drawNoiseArrows(ctx, game, W, H, cx, cy, tm) {
    const spots = [];
    for (const o of game.gens) if (!o.done && o.noisyT !== undefined && game.time - o.noisyT < 1.3) spots.push({ x: o.cx, y: o.cy, c: '#ffb347' });
    for (const q of game.pings) spots.push({ x: q.x, y: q.y, c: '#ff5c5c' });
    for (const p of spots) {
      const sx = p.x * TS - cx, sy = p.y * TS - cy;
      const m = 14;
      if (sx > m && sx < W - m && sy > m && sy < H - m) continue;       // já está na tela
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      const ex = Math.max(m, Math.min(W - m, W / 2 + Math.cos(ang) * 4000)), ey = Math.max(m, Math.min(H - m, H / 2 + Math.sin(ang) * 4000));
      // reduz ao retângulo da tela mantendo a direção
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      const ax = W / 2 + Math.cos(ang) * k, ay = H / 2 + Math.sin(ang) * k;
      void ex; void ey;
      const pulse = 0.65 + 0.35 * Math.sin(tm * 8);
      ctx.save(); ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(ang);
      ctx.globalAlpha = pulse; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- névoa de guerra: raio ambiente + cone da lanterna, com linha de vista; o que já foi visto fica "na memória" ----------
  function drawFog(ctx, game, W, H, cx, cy) {
    const mw = game.map.W, mh = game.map.H;
    if (!R.seen || R.seen.length !== mw * mh) R.seen = new Uint8Array(mw * mh);
    if (!R.fog || R.fog.width !== W || R.fog.height !== H) { R.fog = document.createElement('canvas'); R.fog.width = W; R.fog.height = H; R.fogCtx = R.fog.getContext('2d'); }
    const f = R.fogCtx, pl = game.pl, V = pl === game.k ? game.cfg.VIS_K : game.cfg.VIS_S;
    const ox = pl.x * TS - cx, oy = pl.y * TS - cy;
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = 'rgba(3,4,8,0.97)'; f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    // memória: tiles já vistos ficam mais claros
    f.fillStyle = 'rgba(0,0,0,0.5)';
    const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(mw - 1, Math.ceil((cx + W) / TS)), y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(mh - 1, Math.ceil((cy + H) / TS));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (R.seen[ty * mw + tx]) f.fillRect(tx * TS - cx, ty * TS - cy, TS, TS);
    const mark = (ang, len) => {
      for (let l = 0; l <= len; l += 0.5) {
        const tx = Math.floor(pl.x + Math.cos(ang) * l), ty = Math.floor(pl.y + Math.sin(ang) * l);
        if (tx >= 0 && ty >= 0 && tx < mw && ty < mh) R.seen[ty * mw + tx] = 1;
      }
    };
    const reach = (ang, maxLen) => {                       // o raio vai um pouco além da parede para ela aparecer
      const len = game.castRay(pl.x, pl.y, ang, maxLen);
      const out = len < maxLen ? len + 0.7 : len;
      mark(ang, out);
      return out;
    };
    // círculo ambiente
    const N = 140;
    f.beginPath();
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, l = reach(a, V.r) * TS;
      const px_ = ox + Math.cos(a) * l, py_ = oy + Math.sin(a) * l;
      if (i) f.lineTo(px_, py_); else f.moveTo(px_, py_);
    }
    f.closePath();
    const rg = f.createRadialGradient(ox, oy, V.r * TS * 0.5, ox, oy, V.r * TS);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = rg; f.fill();
    // cone da lanterna
    const M = 40, face = pl.face;
    f.beginPath(); f.moveTo(ox, oy);
    for (let i = 0; i <= M; i++) {
      const a = face - V.half + (i / M) * 2 * V.half, l = reach(a, V.cone) * TS;
      f.lineTo(ox + Math.cos(a) * l, oy + Math.sin(a) * l);
    }
    f.closePath();
    const lg = f.createLinearGradient(ox, oy, ox + Math.cos(face) * V.cone * TS, oy + Math.sin(face) * V.cone * TS);
    lg.addColorStop(0, 'rgba(0,0,0,0.9)'); lg.addColorStop(0.55, 'rgba(0,0,0,0.75)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = lg; f.fill();
    f.globalCompositeOperation = 'source-over';
    ctx.drawImage(R.fog, 0, 0);
  }

  function drawWorld(ctx, game, W, H, tm) {
    if (!R.staticCv) R.staticCv = buildStatic(game);
    const mw = game.map.W * TS, mh = game.map.H * TS;
    const s = game.s, pl = game.pl;
    const full = game.fullVision;                                   // só no treino: interruptor "ver tudo"
    const vis = (x, y) => full || game.canSee(pl, x, y);           // o que o jogador consegue ver agora
    let cx = pl.x * TS - W / 2, cy = pl.y * TS - H / 2;
    cx = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, cx));
    cy = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, cy));
    let sh = game.shake;
    const ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
    cx = Math.round(cx + ox); cy = Math.round(cy + oy);

    ctx.fillStyle = '#07070a'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-cx, -cy);
    ctx.drawImage(R.staticCv, 0, 0);

    // pallets caídos/quebrados no chão
    for (const p of game.pallets) {
      if (p.state === 'broken') drawBroken(ctx, p);
      else if (p.state === 'down') drawPalletFlat(ctx, p, 1);
      else if (p.state === 'falling') {
        const q = Math.min(1, p.t / game.cfg.FALL_T);
        drawPalletFlat(ctx, p, q * q);
      }
    }
    for (const o of game.gens) drawGenGlow(ctx, o, tm);
    for (const w of game.windows) drawWindow(ctx, w, game, tm);
    drawDoor(ctx, game.door, game, tm);
    drawZone(ctx, game, tm, vis);

    // pallets de pé + personagens, ordenados por y
    const list = [];
    for (const p of game.pallets) if (p.state === 'up') list.push({ y: p.cy, f: () => drawPalletUp(ctx, p, game.nearList.some((n) => n.pal === p) ? tm : 0) });
    for (const o of game.gens) list.push({ y: o.cy, f: () => drawGen(ctx, o, game, tm) });
    for (const it of game.items) if (!it.holder && vis(it.x, it.y)) list.push({ y: it.y, f: () => drawItem(ctx, it, tm) });
    for (const v of game.survivors) if (!v.dead && !v.escaped && (v === pl || vis(v.x, v.y))) list.push({ y: v.y, f: () => drawSurvivor(ctx, v, game, tm) });
    if (game.k === pl || full || game.canSeeKiller(pl)) list.push({ y: game.k.y, f: () => { ctx.globalAlpha = game.k.stealth ? 0.55 : 1; drawKiller(ctx, game.k, game, tm); ctx.globalAlpha = 1; } });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();

    // partículas
    for (const f of game.fx) {
      if (!vis(f.x, f.y)) continue;
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      px(ctx, f.c, f.x * TS, f.y * TS - f.t * 6, 2, 2);
    }
    ctx.globalAlpha = 1;

    // dicas sobre o que dá para fazer perto
    if (!game.over) {
      const bob = Math.round(Math.sin(tm * 6));
      if (game.near && game.role === 'survivor') text(ctx, 'ESPAÇO', game.near.cx * TS, game.near.cy * TS - 16 + bob, '#ffd23f', { align: 'c' });
      const it = game.pInteract;
      if (it && !(game.role === 'survivor' && game.s.acting)) {
        const label = { gen: 'SEGURE E', item: 'SEGURE E: PEGAR', door: 'SEGURE E: ABRIR PORTA', window: 'SEGURE E: ABRIR', break: 'E: QUEBRAR', smash: 'E: QUEBRAR JANELA', kick: 'E: CHUTAR' }[it.type];
        const bad = it.type === 'break' || it.type === 'kick' || it.type === 'smash';
        text(ctx, label, it.obj.cx * TS, it.obj.cy * TS - (it.type === 'gen' ? 14 : 18) + bob, bad ? '#ff9d5c' : '#7dffa0', { align: 'c' });
      }
    }
    // textos flutuantes
    for (const pu of game.popups) {
      if (!vis(pu.x, pu.y)) continue;
      const y = pu.y * TS - pu.t * 14;
      ctx.globalAlpha = Math.min(1, (1.1 - pu.t) * 2);
      text(ctx, pu.text, pu.x * TS, y, pu.color, { align: 'c' });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (!full) drawFog(ctx, game, W, H, cx, cy);

    // perigo = proximidade do assassino (raio de terror) — só para quem joga de sobrevivente
    const danger = game.role === 'killer' || game.k.state === 'intro' ? 0 : Math.max(0, 1 - game.dist / 11);
    vignette(ctx, W, H, danger, tm);
    if (game.role === 'killer' && !game.over) drawNoiseArrows(ctx, game, W, H, cx, cy, tm);
    if (game.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, game.flash * 1.5) + ')'; ctx.fillRect(0, 0, W, H); }
    return danger;
  }

  // ---------- HUD ----------
  // ícones da equipe: cor da jaqueta; vermelho = ferido; cinza = abatido; verde = escapou
  function drawTeam(ctx, game, W) {
    const n = game.survivors.length, x0 = W - 4 - 23 - 6 - n * 10;
    game.survivors.forEach((v, i) => {
      const x = x0 + i * 10, y = 3;
      if (v.escaped) { px(ctx, '#7dffa0', x + 1, y + 3, 5, 5); px(ctx, '#0b0b10', x + 3, y + 5, 1, 1); px(ctx, '#e0b48a', x + 2, y, 3, 3); }
      else if (v.dead) { px(ctx, '#4a4a55', x + 1, y + 3, 5, 5); px(ctx, '#6a6a75', x + 2, y, 3, 3); px(ctx, '#e23a3a', x + 1, y + 3, 1, 1); px(ctx, '#e23a3a', x + 5, y + 7, 1, 1); px(ctx, '#e23a3a', x + 5, y + 3, 1, 1); px(ctx, '#e23a3a', x + 1, y + 7, 1, 1); }
      else { px(ctx, '#e0b48a', x + 2, y, 3, 3); px(ctx, JK[i % 4], x + 1, y + 3, 5, 5); if (v.hp < 2) px(ctx, '#c0302a', x + 3, y + 4, 1, 3); }
      if (v.human && game.role === 'survivor') px(ctx, '#ffffff', x + 1, y + 9, 5, 1);
    });
  }

  function drawHUD(ctx, game, W, H, tm) {
    const s = game.s, ka = game.role === 'killer';
    if (ka) {
      const left = game.survivors.filter((v) => game.alive(v)).length;
      text(ctx, 'RESTAM ' + left + '/' + game.survivors.length, 4, 4, '#cfcfd8');
    } else {
      text(ctx, 'VIDA', 4, 4, '#cfcfd8');
      for (let i = 0; i < 2; i++) text(ctx, '♥', 32 + i * 7, 4, game.training || i < s.hp ? '#e23a3a' : '#3a3a44', { shadow: 'rgba(0,0,0,.9)' });
    }
    drawTeam(ctx, game, W);
    if (!ka && s.tool) {                                                       // rádio: 3 faixas de proximidade + pilha
      const on = s.tool.on, col = ['#4d4d59', '#7dffa0', '#ffd23f', '#ff4d4d'][on ? s.det : 0];
      text(ctx, 'RÁDIO', 4, 44, on ? '#cfe8ff' : '#6f6f7c');
      for (let i = 0; i < 3; i++) px(ctx, on && s.det > i ? col : '#2a2a33', 36 + i * 7, 44, 5, 6);
      px(ctx, '#2a2a33', 60, 45, 24, 4); px(ctx, s.tool.batt > 20 ? '#7ad0ff' : '#ff9d5c', 61, 46, Math.round(22 * s.tool.batt / game.cfg.RADIO_BATT), 2);
      if (on && s.det === 3 && Math.floor(tm * 6) % 2) { ctx.fillStyle = 'rgba(255,60,60,.16)'; ctx.fillRect(0, 0, W, H); }
    }
    if (ka) {                                                                  // energia da espreita
      const k = game.k;
      text(ctx, 'ESPREITA', 4, 44, k.stealth ? '#9bd3f0' : '#8a8a99');
      px(ctx, '#2a2a33', 52, 45, 30, 4); px(ctx, k.stealth ? '#9bd3f0' : (k.energy < 0.15 ? '#ff9d5c' : '#5d7a8a'), 53, 46, Math.round(28 * k.energy), 2);
    }
    const gd = game.door.powered;
    text(ctx, 'GERADORES ' + game.gensDone + '/' + game.need, 4, 14, gd ? '#7dffa0' : '#ffb347');
    text(ctx, 'PALLETS ' + game.standing() + '/' + game.pallets.length, 4, 24, '#e9c07a');
    text(ctx, (ka ? 'TROPEÇOU ' : 'ATORDOADO ') + game.stats.stuns + 'X', 4, 34, ka ? '#ff9d5c' : '#ffd23f');
    const tt = Math.floor(game.time);
    text(ctx, Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0'), W - 4, 4, '#fff', { align: 'r' });
    if (game.training) text(ctx, game.fullVision ? 'TREINO: VÊ TUDO' : 'TREINO', W - 4, 14, '#7ad0ff', { align: 'r' });

    if (ka) {
      const y0 = Math.max(46, Math.round(H * 0.2));
      if (game.k.state === 'stumble' || game.k.state === 'stun') {
        const lines = game.k.state === 'stun' ? 'ATORDOADO!' : 'TROPEÇANDO!';
        text(ctx, lines, W / 2, y0, '#ff9d5c', { align: 'c' });
        const f = game.k.state === 'stun' ? 1 : 1 - game.k.t / game.cfg.STUMBLE_T;
        px(ctx, 'rgba(0,0,0,.6)', W / 2 - 25, y0 + 10, 50, 4);
        px(ctx, '#ff9d5c', W / 2 - 24, y0 + 11, Math.round(48 * f), 2);
      } else if (game.time < 7) {
        DP.font.wrap('CACE OS 4 SOBREVIVENTES. SETAS NA BORDA = BARULHO', Math.floor((W - 8) / 6)).forEach((l, i) =>
          text(ctx, l, W / 2, y0 + i * 9, '#ffb347', { align: 'c' }));
      }
    } else if (game.k.state === 'intro') {
      const left = Math.ceil(game.cfg.INTRO - game.k.t);
      text(ctx, 'O ASSASSINO CHEGA EM ' + left, W / 2, Math.max(46, Math.round(H * 0.2)), '#ff5c5c', { align: 'c' });
      DP.font.wrap(game.explore.length ? 'EXPLORE: ACHE E CONSERTE ' + game.need + ' DE 8 GERADORES E ESCAPE PELO PORTÃO. M ABRE O MAPA' : 'CONSERTE ' + game.need + ' DE 8 GERADORES E ESCAPE PELA PORTA PRINCIPAL', Math.floor((W - 8) / 6)).forEach((l, i) =>
        text(ctx, l, W / 2, Math.max(46, Math.round(H * 0.2)) + 10 + i * 9, '#ffb347', { align: 'c' }));
    }
    if (!ka && gd && !game.over && game.explore.length) {                      // seta para o portão liberado
      const dx = game.door.cx - s.x, dy = game.door.cy - s.y, d = Math.hypot(dx, dy);
      if (d > 7) {
        const ax = W / 2 + dx / d * Math.min(W, H) * 0.36, ay = H / 2 + dy / d * Math.min(W, H) * 0.36, an = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(an);
        ctx.fillStyle = Math.floor(tm * 3) % 2 ? '#7dffa0' : '#3fbf6a'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
        text(ctx, 'SAÍDA ' + Math.round(d), Math.round(ax), Math.round(ay) + 8, '#7dffa0', { align: 'c', shadow: 'rgba(0,0,0,.9)' });
      }
    }
    if (!(ka && (game.k.state === 'stumble' || game.k.state === 'stun' || game.time < 7)) && gd && game.time % 6 < 3 && !game.over) {
      DP.font.wrap(ka ? 'PORTA LIBERADA! IMPEÇA A FUGA' : 'PORTA LIBERADA! CORRA PARA A SAÍDA', Math.floor((W - 8) / 6)).forEach((l, i) =>
        text(ctx, l, W / 2, Math.max(46, Math.round(H * 0.2)) + i * 9, '#7dffa0', { align: 'c' }));
    } else if (!ka && game.k.hesitate) {
      text(ctx, 'ELE HESITA...', W / 2, Math.max(46, Math.round(H * 0.2)), '#ff9d5c', { align: 'c' });
    }
  }

  // ---------- mapa de campo (tecla M): o que a equipe já sabe ----------
  function buildMapCv(game) {
    const { W, H, t, indoor, ground } = game.map;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), im = c.createImageData(W, H), d = im.data;
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const col = { tree: hex('#1b3524'), grass: hex('#34523b'), dirt: hex('#7a6648'), sand: hex('#9a9068'), gravel: hex('#73757c'), plank: hex('#8a6a46'), water: hex('#2a6290'), wall: hex('#b1abc4'), crate: hex('#9a6c3a'), win: hex('#7cc4e8'), gate: hex('#ffd23f'), floor: hex('#54443a') };
    for (let i = 0; i < W * H; i++) {
      const v = t[i], g = ground ? ground[i] : 0;
      const c0 = v === 6 ? col.tree : v === 7 ? col.water : v === 1 ? col.wall : v === 2 ? col.crate : v === 5 ? col.win : v === 4 ? col.gate
        : indoor[i] ? col.floor : g === 1 ? col.dirt : g === 2 ? col.sand : g === 3 ? col.plank : g === 4 ? col.gravel : col.grass;
      d[i * 4] = c0[0]; d[i * 4 + 1] = c0[1]; d[i * 4 + 2] = c0[2]; d[i * 4 + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    return cv;
  }

  function drawMap(ctx, game, W, H, tm) {
    if (!R.mapCv) R.mapCv = buildMapCv(game);
    const mw = game.map.W, mh = game.map.H;
    overlay(ctx, W, H, 0.78);
    const known = game.gens.filter((o) => o.known).length;
    const legend = DP.font.wrap('GERADORES ACHADOS ' + known + '/' + game.gens.length + ' · PRONTOS ' + game.gensDone + '/' + game.need, Math.floor((W - 8) / 6))
      .concat(DP.font.wrap('VERDE: JÁ VISTO. CINZA: A EXPLORAR. VOCÊ: QUADRADO VERMELHO. M FECHA', Math.floor((W - 8) / 6)));
    const topPad = 16, botPad = 8 + legend.length * 9;
    const sc = Math.max(1, Math.min((W - 12) / mw, (H - topPad - botPad) / mh));
    const ox = Math.round((W - mw * sc) / 2), oy = topPad;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.mapCv, ox, oy, Math.round(mw * sc), Math.round(mh * sc));
    const X = (x) => Math.round(ox + x * sc), Y = (y) => Math.round(oy + y * sc);
    text(ctx, 'MAPA DO ACAMPAMENTO', Math.round(W / 2), 4, '#fff', { align: 'c' });
    // pallets
    for (const p of game.pallets) px(ctx, p.state === 'up' ? '#ffd9a0' : p.state === 'broken' ? '#5a4a3a' : '#c06a3a', X(p.cx) - 1, Y(p.cy) - 1, 2, 2);
    // pontos de exploração já visitados pela equipe
    for (const e of game.explore) {
      if (e.seen) px(ctx, 'rgba(125,255,160,.8)', X(e.x) - 1, Y(e.y) - 1, 2, 2);
      else px(ctx, 'rgba(255,255,255,.4)', X(e.x) - 1, Y(e.y) - 1, 3, 3);
    }
    // geradores encontrados
    for (const o of game.gens) {
      if (!o.known) continue;
      const c0 = o.done ? '#7dffa0' : '#ffb347';
      px(ctx, '#000', X(o.cx) - 3, Y(o.cy) - 3, 6, 6); px(ctx, c0, X(o.cx) - 2, Y(o.cy) - 2, 4, 4);
      if (!o.done && o.progress > 0) px(ctx, '#fff', X(o.cx) - 2, Y(o.cy) + 3, Math.max(1, Math.round(4 * o.progress)), 1);
    }
    // portão e lugares conhecidos
    const dr = game.door;
    px(ctx, dr.opened ? '#7dffa0' : '#ffd23f', X(dr.cx) - 4, Y(0) - 1, 8, 3);
    for (const p of game.map.pois || []) {
      const lab = { parking: sc < 3 ? 'ESTAC.' : 'ESTACIONAMENTO', plaza: 'FOGUEIRA', dock: 'CAIS', lake: 'LAGO' }[p.kind];
      if (lab) text(ctx, lab, X(p.x), Y(p.y) + (p.kind === 'dock' ? 5 : p.kind === 'plaza' ? 12 : -3), '#fff', { align: 'c', shadow: 'rgba(0,0,0,.95)' });
    }
    // você
    const me = game.pl;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    const pulse = 3 + Math.floor(tm * 3) % 2;
    ctx.strokeRect(X(me.x) - pulse, Y(me.y) - pulse, pulse * 2, pulse * 2);
    px(ctx, '#ff4d4d', X(me.x) - 1, Y(me.y) - 1, 3, 3);
    // legenda
    const ly = oy + Math.round(mh * sc) + 5;
    legend.forEach((l, n) => text(ctx, l, Math.round(W / 2), ly + n * 9, n === 0 ? '#ffb347' : '#a9a9b5', { align: 'c' }));
  }

  // skill check no centro da tela
  function drawSkill(ctx, game, W, H, tm) {
    const sk = game.s.skill;
    if (!sk || game.role === 'killer') return;
    const C = game.cfg;
    const cx = Math.round(W / 2), cy = Math.round(H / 2) - 46, r = 15;
    ctx.fillStyle = 'rgba(8,8,12,.72)'; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.fill();
    const A = (a) => a - Math.PI / 2;
    ctx.lineWidth = 4; ctx.strokeStyle = '#4a4a55';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e8e6ef';
    ctx.beginPath(); ctx.arc(cx, cy, r, A(sk.tz - C.SKILL_ZONE), A(sk.tz + C.SKILL_ZONE)); ctx.stroke();
    ctx.strokeStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(cx, cy, r, A(sk.tz - C.SKILL_GREAT), A(sk.tz + C.SKILL_GREAT)); ctx.stroke();
    const a = Math.max(0, sk.t - C.SKILL_DELAY) * C.SKILL_SPEED;
    const wait = sk.t < C.SKILL_DELAY;
    ctx.lineWidth = 2; ctx.strokeStyle = wait ? '#8a8a99' : '#ffd23f';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(A(a)) * (r + 2), cy + Math.sin(A(a)) * (r + 2)); ctx.stroke();
    text(ctx, 'AGORA!', cx, cy + r + 9, '#ffd23f', { align: 'c' });
  }

  function drawButton(ctx, b, tm, pressed) {
    const col = b.color || '#e9c07a';
    if (b.round) {
      const r = b.w / 2, cx = b.x + r, cy = b.y + r;
      const hot = b.hot || '#ffd23f';
      const glow = b.active ? 0.5 + 0.3 * Math.sin(tm * 8) : 0.0;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pressed ? hot + '8c' : 'rgba(20,18,24,' + (b.active ? 0.8 : 0.5) + ')';
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = b.active ? hot : 'rgba(255,255,255,.25)';
      ctx.globalAlpha = b.active ? 0.6 + glow * 0.4 : 1; ctx.stroke(); ctx.globalAlpha = 1;
      text(ctx, b.label, cx, cy - 3, b.active ? hot : '#9a9aa5', { align: 'c' });
    } else {
      ctx.fillStyle = pressed ? 'rgba(255,210,63,.4)' : b.sel ? 'rgba(255,255,255,.14)' : 'rgba(20,18,24,.85)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = col; ctx.lineWidth = b.sel ? 2 : 1;
      ctx.strokeRect(b.x + 0.5 + (b.sel ? 0.5 : 0), b.y + 0.5 + (b.sel ? 0.5 : 0), b.w - 1 - (b.sel ? 1 : 0), b.h - 1 - (b.sel ? 1 : 0));
      text(ctx, b.label, b.x + b.w / 2, b.y + (b.h - 7) / 2, col, { align: 'c' });
    }
  }

  function drawJoystick(ctx, joy) {
    if (!joy.active) return;
    ctx.beginPath(); ctx.arc(joy.bx, joy.by, 20, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 20, joy.by + joy.dy * 20, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill();
  }

  // ---------- telas ----------
  function overlay(ctx, W, H, a) { ctx.fillStyle = 'rgba(5,5,8,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  function drawOver(ctx, game, W, H, tm, best, newBest, reward) {
    const a = Math.min(0.82, game.overT * 0.9);
    overlay(ctx, W, H, a);
    if (game.overT < 0.8) return;
    const cx = Math.round(W / 2);
    const y0 = Math.round(H * 0.16);
    const esc = game.result === 'escaped', ka = game.role === 'killer';
    const win = ka ? !esc : esc;
    text(ctx, ka ? (esc ? 'ELES ESCAPARAM...' : 'VITÓRIA!') : (esc ? 'VOCÊ ESCAPOU!' : 'VOCÊ MORREU'), cx, y0, win ? '#7dffa0' : '#e23a3a', { align: 'c' });
    const tt = Math.floor(game.time);
    const rows = [
      [ka ? 'DURAÇÃO' : esc ? 'TEMPO DE FUGA' : 'SOBREVIVEU', Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0')],
      ['GERADORES', game.gensDone + '/' + game.need],
      ['ESCAPARAM/ABATIDOS', game.escapedCount + '/' + game.deadCount],
      ka ? ['ACERTOS/BOTES', game.stats.hits + '/' + game.stats.lunges] : ['ATORDOAMENTOS', String(game.stats.stuns)],
      ka ? ['QUEBRAS PALLET/JAN.', game.stats.breaks + '/' + game.stats.smashes] : ['PALLETS DERRUBADOS', String(game.stats.drops)],
      ka ? ['TROPEÇOS', String(game.stats.stuns)] : ['JANELAS PULOS/CORTES', game.stats.vaults + '/' + game.stats.cuts]
    ];
    const tl = Math.max(8, cx - 84), tr = Math.min(W - 8, cx + 84);
    rows.forEach((r, i) => {
      const y = y0 + 14 + i * 9;
      text(ctx, r[0], tl, y, '#a9a9b5');
      text(ctx, r[1], tr, y, '#fff', { align: 'r' });
    });
    const by = y0 + 14 + rows.length * 9 + 3;
    if (reward) text(ctx, '+' + reward + ' FICHAS', cx, by, '#ffd23f', { align: 'c' });
    if (newBest) text(ctx, 'NOVO RECORDE!', cx, by + 9, '#7dffa0', { align: 'c' });
  }

  // ---------- sprites para as telas de menu (mesmo pixel art do jogo, ampliado) ----------
  const UI_GAME = { role: 'survivor', cfg: { VAULT_T: 0.5, WINDUP: 0.16 } };
  // cx,cy = pés; sc = ampliação inteira; o = { id, face, moving, tm, alpha, hp, human }
  function uiSurvivor(ctx, cx, cy, sc, o) {
    o = o || {};
    const fake = { x: 0, y: -5 / TS, face: o.face === undefined ? Math.PI / 2 : o.face, hp: o.hp || 2, invuln: 0, vault: null, id: o.id || 0, walk: o.walk || 0, moving: !!o.moving, human: !!o.human };
    ctx.save(); ctx.translate(Math.round(cx), Math.round(cy)); ctx.scale(sc, sc);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    drawSurvivor(ctx, fake, UI_GAME, o.tm || 0);
    ctx.restore();
  }
  function uiKiller(ctx, cx, cy, sc, o) {
    o = o || {};
    const fake = { x: 0, y: -6 / TS, face: o.face === undefined ? Math.PI / 2 : o.face, state: o.state || 'recover', t: 0, trip: 0, ph: 0, walk: o.walk || 0, moving: !!o.moving };
    ctx.save(); ctx.translate(Math.round(cx), Math.round(cy)); ctx.scale(sc, sc);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    drawKiller(ctx, fake, UI_GAME, o.tm || 0);
    ctx.restore();
  }

  function reset() { R.staticCv = null; R.seen = null; R.mapCv = null; }

  DP.render = { uiSurvivor, uiKiller, drawWorld, drawHUD, drawMap, drawSkill, drawButton, drawJoystick, drawOver, overlay, reset, text };
})(typeof window !== 'undefined' ? window : globalThis);
