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
    const { W, H, t, indoor } = game.map;
    const cv = document.createElement('canvas');
    cv.width = W * TS; cv.height = H * TS;
    const c = cv.getContext('2d');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS, r = hash(x, y);
        if (indoor[i] && t[i] === 0) {
          // piso de tábuas
          px(c, (x + y) & 1 ? '#3a2f29' : '#40342c', X, Y, TS, TS);
          for (let l = 0; l < TS; l += 4) px(c, 'rgba(0,0,0,.28)', X, Y + l, TS, 1);
          if (r < 0.5) px(c, 'rgba(255,255,255,.04)', X + ((r * 40) | 0) % 12, Y + 1, 3, 3);
          px(c, 'rgba(0,0,0,.25)', X + ((hash(x, y, 3) * 14) | 0), Y + ((hash(x, y, 4) * 3) | 0) * 4, 1, 4);
        } else if (t[i] === 0) {
          // chão de terra/grama escura
          px(c, r < 0.5 ? '#1f2a22' : '#222e25', X, Y, TS, TS);
          for (let n = 0; n < 5; n++) {
            const rx = (hash(x, y, n + 10) * 15) | 0, ry = (hash(x, y, n + 20) * 15) | 0;
            px(c, hash(x, y, n + 30) < 0.5 ? '#2b3a2d' : '#18211b', X + rx, Y + ry, hash(x, y, n) < 0.3 ? 2 : 1, 1);
          }
        }
      }
    }
    // paredes
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, X = x * TS, Y = y * TS;
        if (t[i] === 1) {
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
      if (t[i] === 0 && t[i - W] === 1) { px(c, 'rgba(0,0,0,.35)', x * TS, y * TS, TS, 3); px(c, 'rgba(0,0,0,.2)', x * TS, y * TS + 3, TS, 2); }
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

  function drawSurvivor(ctx, s, game, tm) {
    const d = dir4(s.face);
    const x = Math.round(s.x * TS), y = Math.round(s.y * TS) + 5;
    let lift = 0;
    if (s.vault) { const p = Math.min(1, s.vault.t / game.cfg.VAULT_T); lift = Math.sin(p * Math.PI) * 5; }
    if (s.invuln > 0 && Math.floor(tm * 20) % 2) return;
    const hurt = s.hp < 2;
    const step = Math.floor(s.walk) % 2;
    const bob = s.moving && step ? 1 : 0;

    px(ctx, 'rgba(0,0,0,.4)', x - 4, y - 1, 8, 2);
    const yy = y - lift;
    // pernas
    const legC = '#26334d';
    if (d === 'L' || d === 'R') {
      const a = s.moving ? (step ? 1 : -1) : 0;
      px(ctx, legC, x - 1 + a, yy - 4, 2, 4); px(ctx, '#1b2438', x - 1 - a, yy - 4, 2, 4);
    } else {
      const a = s.moving ? (step ? 1 : 0) : 0;
      px(ctx, legC, x - 3, yy - 4 - (a ? 1 : 0), 2, 4); px(ctx, legC, x + 1, yy - 4 - (a ? 0 : (s.moving ? 1 : 0)), 2, 4);
    }
    // tronco
    const jacket = hurt ? '#7e3a42' : '#3d6fb5';
    px(ctx, jacket, x - 4, yy - 10 - bob, 8, 6);
    px(ctx, hurt ? '#a04a52' : '#5b8ad0', x - 4, yy - 10 - bob, 8, 1);
    if (hurt) { px(ctx, '#b02a2a', x - 2, yy - 8 - bob, 2, 1); px(ctx, '#b02a2a', x + 1, yy - 6 - bob, 1, 2); }
    // braços
    const armSwing = s.moving ? (step ? 1 : -1) : 0;
    if (d === 'L' || d === 'R') px(ctx, '#2f548a', x - 1, yy - 9 - bob + armSwing, 2, 4);
    else { px(ctx, '#2f548a', x - 5, yy - 9 - bob + armSwing, 1, 4); px(ctx, '#2f548a', x + 4, yy - 9 - bob - armSwing, 1, 4); }
    // cabeça
    const hy = yy - 15 - bob;
    px(ctx, '#e0b48a', x - 3, hy, 6, 5);
    if (d === 'U') px(ctx, '#3a2418', x - 3, hy, 6, 5);
    else {
      px(ctx, '#3a2418', x - 3, hy, 6, 2);
      if (d === 'L') { px(ctx, '#3a2418', x + 1, hy, 2, 4); px(ctx, '#1a1a1a', x - 2, hy + 2, 1, 1); }
      else if (d === 'R') { px(ctx, '#3a2418', x - 3, hy, 2, 4); px(ctx, '#1a1a1a', x + 1, hy + 2, 1, 1); }
      else { px(ctx, '#1a1a1a', x - 2, hy + 2, 1, 1); px(ctx, '#1a1a1a', x + 1, hy + 2, 1, 1); }
    }
  }

  function drawKiller(ctx, k, game, tm) {
    const d = dir4(k.face);
    const x = Math.round(k.x * TS), y = Math.round(k.y * TS) + 6;
    const step = Math.floor(k.walk) % 2;
    const dormant = k.state === 'intro';
    const stun = k.state === 'stun';
    const wob = stun ? Math.round(Math.sin(tm * 18) * 1.5) : 0;
    const bob = k.moving && step ? 1 : 0;
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

  // ---------- zona de impacto (ajuda visual) ----------
  function drawZone(ctx, game, tm) {
    const p = game.near;
    if (!p) return;
    const C = game.cfg;
    const dir = (function () {
      const s = game.s;
      let side = (s.x - p.cx) * p.nx + (s.y - p.cy) * p.ny;
      if (Math.abs(side) < 0.1) side = -(Math.cos(s.face) * p.nx + Math.sin(s.face) * p.ny) || 1;
      const sg = side > 0 ? -1 : 1;
      return { x: p.nx * sg, y: p.ny * sg };
    })();
    const fake = { cx: p.cx, cy: p.cy, dir };
    const inside = game.k.state !== 'intro' && game.inZone(fake, game.k);
    // retângulo em px
    const x0 = Math.min(dir.x ? p.cx - 0.5 * 0 : p.cx - C.ZONE_W, dir.x ? p.cx + dir.x * C.ZONE_LEN : p.cx + C.ZONE_W);
    let rx, ry, rw, rh;
    if (dir.x) { rw = C.ZONE_LEN + 0.6; rh = C.ZONE_W * 2; rx = dir.x > 0 ? p.cx - 0.6 : p.cx - C.ZONE_LEN; ry = p.cy - C.ZONE_W; }
    else { rh = C.ZONE_LEN + 0.6; rw = C.ZONE_W * 2; ry = dir.y > 0 ? p.cy - 0.6 : p.cy - C.ZONE_LEN; rx = p.cx - C.ZONE_W; }
    const a = inside ? 0.38 : 0.16 + 0.05 * Math.sin(tm * 6);
    ctx.fillStyle = inside ? 'rgba(255,70,50,' + a + ')' : 'rgba(255,210,63,' + a + ')';
    ctx.fillRect(Math.round(rx * TS), Math.round(ry * TS), Math.round(rw * TS), Math.round(rh * TS));
    ctx.strokeStyle = inside ? 'rgba(255,90,60,.9)' : 'rgba(255,210,63,.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(rx * TS) + 0.5, Math.round(ry * TS) + 0.5, Math.round(rw * TS) - 1, Math.round(rh * TS) - 1);
    void x0;
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

  function drawWorld(ctx, game, W, H, tm) {
    if (!R.staticCv) R.staticCv = buildStatic(game);
    const mw = game.map.W * TS, mh = game.map.H * TS;
    const s = game.s;
    let cx = s.x * TS - W / 2, cy = s.y * TS - H / 2;
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
    drawZone(ctx, game, tm);

    // pallets de pé + personagens, ordenados por y
    const list = [];
    for (const p of game.pallets) if (p.state === 'up') list.push({ y: p.cy, f: () => drawPalletUp(ctx, p, game.near === p ? tm : 0) });
    list.push({ y: s.y, f: () => drawSurvivor(ctx, s, game, tm) });
    list.push({ y: game.k.y, f: () => drawKiller(ctx, game.k, game, tm) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();

    // partículas
    for (const f of game.fx) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      px(ctx, f.c, f.x * TS, f.y * TS - f.t * 6, 2, 2);
    }
    ctx.globalAlpha = 1;

    // dica "E" sobre o pallet ao alcance
    if (game.near && !game.over) {
      const p = game.near;
      const bob = Math.round(Math.sin(tm * 6));
      text(ctx, 'E', p.cx * TS, p.cy * TS - 16 + bob, '#ffd23f', { align: 'c' });
    }
    // textos flutuantes
    for (const pu of game.popups) {
      const y = pu.y * TS - pu.t * 14;
      ctx.globalAlpha = Math.min(1, (1.1 - pu.t) * 2);
      text(ctx, pu.text, pu.x * TS, y, pu.color, { align: 'c' });
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // perigo = proximidade do assassino (raio de terror)
    const danger = game.k.state === 'intro' ? 0 : Math.max(0, 1 - game.dist / 11);
    vignette(ctx, W, H, danger, tm);
    if (game.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, game.flash * 1.5) + ')'; ctx.fillRect(0, 0, W, H); }
    return danger;
  }

  // ---------- HUD ----------
  function drawHUD(ctx, game, W, H, tm) {
    const s = game.s;
    text(ctx, 'VIDA', 4, 4, '#cfcfd8');
    for (let i = 0; i < 2; i++) text(ctx, '♥', 32 + i * 7, 4, game.training || i < s.hp ? '#e23a3a' : '#3a3a44', { shadow: 'rgba(0,0,0,.9)' });
    text(ctx, 'PALLETS ' + game.standing() + '/' + game.pallets.length, 4, 14, '#e9c07a');
    text(ctx, 'ATORDOADO ' + game.stats.stuns + 'X', 4, 24, '#ffd23f');
    const tt = Math.floor(game.time);
    text(ctx, Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0'), W - 4, 4, '#fff', { align: 'r' });
    if (game.training) text(ctx, 'TREINO', W - 4, 14, '#7ad0ff', { align: 'r' });

    if (game.k.state === 'intro') {
      const left = Math.ceil(game.cfg.INTRO - game.k.t);
      text(ctx, 'O ASSASSINO CHEGA EM ' + left, W / 2, Math.round(H * 0.2), '#ff5c5c', { align: 'c' });
      text(ctx, 'ACHE UM PALLET', W / 2, Math.round(H * 0.2) + 10, '#e9c07a', { align: 'c' });
    } else if (game.k.hesitate) {
      text(ctx, 'ELE HESITA...', W / 2, Math.round(H * 0.2), '#ff9d5c', { align: 'c' });
    }
  }

  function drawButton(ctx, b, tm, pressed) {
    const col = b.color || '#e9c07a';
    if (b.round) {
      const r = b.w / 2, cx = b.x + r, cy = b.y + r;
      const glow = b.active ? 0.5 + 0.3 * Math.sin(tm * 8) : 0.0;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pressed ? 'rgba(255,210,63,.55)' : 'rgba(20,18,24,' + (b.active ? 0.8 : 0.5) + ')';
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = b.active ? 'rgba(255,210,63,' + (0.6 + glow * 0.4) + ')' : 'rgba(255,255,255,.25)';
      ctx.stroke();
      text(ctx, b.label, cx, cy - 3, b.active ? '#ffd23f' : '#9a9aa5', { align: 'c' });
    } else {
      ctx.fillStyle = pressed ? 'rgba(255,210,63,.4)' : 'rgba(20,18,24,.85)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
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

  function drawMenu(ctx, W, H, tm, best) {
    ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, W, H);
    const cx = Math.round(W / 2);
    const title = 'DEAD PIXEL';
    const sc = W >= 300 ? 3 : 2;
    ctx.save();
    ctx.translate(cx, Math.round(H * 0.16)); ctx.scale(sc, sc);
    text(ctx, title, 0, 0, '#e23a3a', { align: 'c' });
    ctx.restore();
    text(ctx, 'PROTÓTIPO 1: O PALLET', cx, Math.round(H * 0.16) + 7 * sc + 6, '#e9c07a', { align: 'c' });
    if (best) text(ctx, 'RECORDE ' + Math.floor(best / 60) + ':' + String(Math.floor(best % 60)).padStart(2, '0'), cx, Math.round(H * 0.36), '#8a8a99', { align: 'c' });
    const lines = DP.font.wrap('FUJA DO ASSASSINO. DERRUBE O PALLET QUANDO ELE ESTIVER NA ZONA AMARELA PARA ATORDOÁ-LO.', Math.floor((W - 16) / 6));
    lines.forEach((l, i) => text(ctx, l, cx, Math.round(H * 0.82) + i * 9, '#a9a9b5', { align: 'c' }));
  }

  function drawOver(ctx, game, W, H, tm, best, newBest) {
    const a = Math.min(0.82, game.overT * 0.9);
    overlay(ctx, W, H, a);
    if (game.overT < 0.8) return;
    const cx = Math.round(W / 2);
    const y0 = Math.round(H * 0.16);
    text(ctx, 'VOCÊ MORREU', cx, y0, '#e23a3a', { align: 'c' });
    const tt = Math.floor(game.time);
    const rows = [
      ['SOBREVIVEU', Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0')],
      ['ATORDOAMENTOS', String(game.stats.stuns)],
      ['PALLETS DERRUBADOS', String(game.stats.drops)],
      ['QUASE ACERTOS', String(game.stats.misses)],
      ['PALLETS QUEBRADOS', String(game.stats.breaks)]
    ];
    rows.forEach((r, i) => {
      const y = y0 + 16 + i * 10;
      text(ctx, r[0], Math.max(8, cx - 62), y, '#a9a9b5');
      text(ctx, r[1], Math.min(W - 8, cx + 62), y, '#fff', { align: 'r' });
    });
    if (newBest) text(ctx, 'NOVO RECORDE!', cx, y0 + 16 + rows.length * 10 + 4, '#ffd23f', { align: 'c' });
  }

  function reset() { R.staticCv = null; }

  DP.render = { drawWorld, drawHUD, drawButton, drawJoystick, drawMenu, drawOver, overlay, reset, text };
})(typeof window !== 'undefined' ? window : globalThis);
