// Lógica do jogo: sobrevivente, assassino (IA) e a mecânica de pallet.
// Sem DOM aqui — o render e a entrada ficam em render.js / main.js (e dá para testar no Node).
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  // Tudo que mexe na "sensação" do pallet está aqui.
  const CFG = {
    RUN: 4.0,            // velocidade do sobrevivente (tiles/s)
    BURST: 1.3,          // multiplicador após ser acertado
    BURST_T: 1.8,
    K_SPEED: 4.55,       // velocidade do assassino
    K_LUNGE: 8.2,        // velocidade do bote
    R_S: 0.27, R_K: 0.33,

    ATTACK_RANGE: 1.5,   // distância para começar o ataque
    WINDUP: 0.16,        // erguer a arma (dá pra reagir)
    LUNGE_T: 0.30,
    HIT_R: 0.78,
    RECOVER_MISS: 0.85,
    RECOVER_HIT: 1.7,

    DROP_RANGE: 1.3,     // distância máxima do pallet para derrubar
    FALL_T: 0.22,        // tempo de queda — o atordoamento só vale no impacto
    ZONE_LEN: 1.7,       // zona de impacto: comprimento (a partir do pallet, no lado da queda)
    ZONE_W: 0.9,         // zona de impacto: meia largura
    STUN: 2.4,           // atordoamento do assassino
    BREAK_T: 2.0,        // tempo para o assassino quebrar um pallet caído
    BREAK_COST: 9,       // "custo em tiles" de quebrar vs. dar a volta (IA)
    VAULT_T: 0.5,        // pular o pallet caído

    RESPECT: 0.55,       // chance do assassino "respeitar" um pallet de pé (hesitar)
    HESITATE: [0.8, 1.5],
    INTRO: 3,
    RESPAWN: 8           // só no TREINO: pallets voltam a ficar de pé
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function createGame(opts) {
    opts = opts || {};
    const rnd = opts.rng || Math.random;
    const sfx = opts.sfx || function () {};
    const training = !!opts.training;
    const map = DP.buildMap();
    const W = map.W, H = map.H, t = map.t;

    const g = {
      cfg: CFG, map, training,
      time: 0, over: false, overT: 0,
      stats: { stuns: 0, drops: 0, misses: 0, hits: 0, breaks: 0, vaults: 0 },
      pallets: [], popups: [], fx: [],
      shake: 0, hitstop: 0, flash: 0,
      near: null, los: false, dist: 99,
      s: {
        x: map.spawnSurvivor.x, y: map.spawnSurvivor.y, face: Math.PI / 2,
        hp: 2, burst: 0, invuln: 0, vault: null, vaultCD: 0, moving: false, walk: 0
      },
      k: {
        x: map.spawnKiller.x, y: map.spawnKiller.y, face: -Math.PI / 2,
        state: 'intro', t: 0, dur: 0, ldx: 0, ldy: 0, hitDone: false, pal: null,
        moving: false, walk: 0, hesitate: false
      }
    };

    const palAt = new Array(W * H).fill(null);
    for (const p of map.pallets) {
      const o = {
        tx: p.tx, ty: p.ty, cx: p.tx + 0.5, cy: p.ty + 0.5, orient: p.orient,
        nx: p.orient === 'h' ? 0 : 1, ny: p.orient === 'h' ? 1 : 0,   // eixo da passagem
        state: 'up', t: 0, dir: { x: 0, y: 0 }, respawn: 0, respect: undefined, hes: 0, hitNote: 0
      };
      g.pallets.push(o);
      palAt[p.ty * W + p.tx] = o;
    }
    g.palAt = palAt;

    const s = g.s, k = g.k;
    const field = new Float32Array(W * H);
    let fieldT = 0, fieldTile = -1;

    // ---------- colisão ----------
    function solid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      const i = ty * W + tx;
      if (t[i]) return true;
      const p = palAt[i];
      return !!(p && p.state === 'down');
    }
    function hitsCircle(x, y, r) {
      for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
        for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
          if (!solid(tx, ty)) continue;
          const dx = x - clamp(x, tx, tx + 1), dy = y - clamp(y, ty, ty + 1);
          if (dx * dx + dy * dy < r * r) return true;
        }
      }
      return false;
    }
    function moveBy(e, dx, dy, r) {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.15));
      const sx = dx / n, sy = dy / n;
      for (let i = 0; i < n; i++) {
        if (sx && !hitsCircle(e.x + sx, e.y, r)) e.x += sx;
        if (sy && !hitsCircle(e.x, e.y + sy, r)) e.y += sy;
      }
    }
    // linha de visão (3 raios para não "cortar quina")
    function hasLOS(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 0.01) return true;
      const ux = dx / d, uy = dy / d;
      for (const off of [0, -0.26, 0.26]) {
        const ox = -uy * off, oy = ux * off;
        for (let l = 0; l < d; l += 0.2) {
          if (solid(Math.floor(a.x + ox + ux * l), Math.floor(a.y + oy + uy * l))) return false;
        }
      }
      return true;
    }

    // ---------- campo de caminho do assassino (Dijkstra a partir do sobrevivente) ----------
    function extra(i) {
      const p = palAt[i];
      if (!p) return 0;
      return p.state === 'down' ? CFG.BREAK_COST : p.state === 'up' ? 0.3 : 0;
    }
    function blocked(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H || t[ty * W + tx] !== 0; }
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    function computeField() {
      field.fill(1e9);
      const sx = clamp(Math.floor(s.x), 0, W - 1), sy = clamp(Math.floor(s.y), 0, H - 1);
      const heapI = [], heapK = [];
      const push = (i, key) => {
        let n = heapI.length; heapI.push(i); heapK.push(key);
        while (n > 0) {
          const p = (n - 1) >> 1;
          if (heapK[p] <= heapK[n]) break;
          [heapK[p], heapK[n]] = [heapK[n], heapK[p]]; [heapI[p], heapI[n]] = [heapI[n], heapI[p]]; n = p;
        }
      };
      const pop = () => {
        const top = heapI[0], lastI = heapI.pop(), lastK = heapK.pop();
        if (heapI.length) {
          heapI[0] = lastI; heapK[0] = lastK;
          let n = 0;
          for (;;) {
            const l = 2 * n + 1, r = l + 1; let m = n;
            if (l < heapI.length && heapK[l] < heapK[m]) m = l;
            if (r < heapI.length && heapK[r] < heapK[m]) m = r;
            if (m === n) break;
            [heapK[m], heapK[n]] = [heapK[n], heapK[m]]; [heapI[m], heapI[n]] = [heapI[n], heapI[m]]; n = m;
          }
        }
        return top;
      };
      field[sy * W + sx] = 0; push(sy * W + sx, 0);
      while (heapI.length) {
        const i = pop(), cd = field[i];
        const ux = i % W, uy = (i / W) | 0;
        for (const d of DIRS) {
          const vx = ux + d[0], vy = uy + d[1];
          if (blocked(vx, vy)) continue;
          const diag = d[0] !== 0 && d[1] !== 0;
          if (diag && (blocked(ux + d[0], uy) || blocked(ux, uy + d[1]))) continue;
          const j = vy * W + vx;
          const nd = cd + (diag ? 1.414 : 1) + extra(i);
          if (nd < field[j]) { field[j] = nd; push(j, nd); }
        }
      }
    }

    function bestNeighbor() {
      const kx = Math.floor(k.x), ky = Math.floor(k.y);
      let best = null, bv = 1e9;
      for (const d of DIRS) {
        const nx = kx + d[0], ny = ky + d[1];
        if (blocked(nx, ny)) continue;
        const diag = d[0] !== 0 && d[1] !== 0;
        if (diag && (solid(kx + d[0], ky) || solid(kx, ky + d[1]))) continue;
        const j = ny * W + nx;
        const v = field[j] + (diag ? 1.414 : 1) + extra(j);
        if (v < bv) { bv = v; best = { x: nx, y: ny, pal: palAt[j] && palAt[j].state === 'down' ? palAt[j] : null }; }
      }
      return best;
    }

    // ---------- eventos visuais ----------
    function popup(text, x, y, color) { g.popups.push({ text, x, y, t: 0, color: color || '#fff' }); }
    function dust(x, y, n, col) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = 0.6 + rnd() * 2;
        g.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.35 + rnd() * 0.3, c: col || '#8b7355' });
      }
    }
    const pan = (x) => clamp((x - s.x) / 10, -0.8, 0.8);

    // ---------- pallet ----------
    function inZone(p, e) {
      const rx = e.x - p.cx, ry = e.y - p.cy;
      const along = rx * p.dir.x + ry * p.dir.y;
      const lat = -rx * p.dir.y + ry * p.dir.x;
      return along > -0.6 && along < CFG.ZONE_LEN && Math.abs(lat) < CFG.ZONE_W;
    }
    function dropDir(p) {
      let side = (s.x - p.cx) * p.nx + (s.y - p.cy) * p.ny;
      if (Math.abs(side) < 0.1) side = -(Math.cos(s.face) * p.nx + Math.sin(s.face) * p.ny) || 1;
      const sg = side > 0 ? -1 : 1;
      return { x: p.nx * sg, y: p.ny * sg };
    }
    // pallet de pé ao alcance, com a direção em que cairia (usado também para mostrar a zona)
    function findDroppable() {
      let best = null, bd = CFG.DROP_RANGE;
      for (const p of g.pallets) {
        if (p.state !== 'up') continue;
        const d = Math.hypot(s.x - p.cx, s.y - p.cy);
        const lat = Math.abs(-(s.x - p.cx) * p.ny + (s.y - p.cy) * p.nx);
        if (d < bd && lat < 1.0) { bd = d; best = p; }
      }
      return best;
    }

    function tryDrop() {
      if (g.over || s.vault) return false;
      const p = findDroppable();
      if (!p) return false;
      p.state = 'falling'; p.t = 0; p.dir = dropDir(p);
      g.stats.drops++;
      sfx('creak', pan(p.cx));
      return true;
    }

    function land(p) {
      p.state = 'down'; p.t = 0; p.respawn = CFG.RESPAWN;
      sfx('slam', pan(p.cx));
      g.shake = Math.max(g.shake, 2.5);
      dust(p.cx + p.dir.x * 0.6, p.cy + p.dir.y * 0.6, 10);

      const kd = Math.hypot(k.x - p.cx, k.y - p.cy);
      const stunned = inZone(p, k) && k.state !== 'intro';
      if (stunned) {
        k.state = 'stun'; k.t = 0; k.pal = null;
        g.stats.stuns++;
        g.hitstop = 0.1; g.shake = 7; g.flash = 0.25;
        sfx('stun', pan(k.x));
        popup('ATORDOADO!', k.x, k.y - 1.3, '#ffd23f');
        dust(k.x, k.y, 14, '#d9d2b6');
      } else if (kd < 3.4 && k.state !== 'intro') {
        g.stats.misses++;
        sfx('miss', pan(k.x));
        popup('ERROU!', p.cx, p.cy - 1.2, '#ff7a59');
      }
      // quem estava em cima do tile é empurrado para fora
      for (const e of [s, k]) {
        if (Math.floor(e.x) === p.tx && Math.floor(e.y) === p.ty) {
          const sg = e === s ? -1 : 1, r = e === s ? CFG.R_S : CFG.R_K;
          e.x = p.cx + p.dir.x * sg * (0.5 + r + 0.03) + (p.dir.x ? 0 : e.x - p.cx);
          e.y = p.cy + p.dir.y * sg * (0.5 + r + 0.03) + (p.dir.y ? 0 : e.y - p.cy);
        }
      }
    }

    function startBreak(p) {
      k.state = 'break'; k.t = 0; k.pal = p; k.brk = 0;
      k.face = Math.atan2(p.cy - k.y, p.cx - k.x);
    }

    // ---------- sobrevivente ----------
    function hurt() {
      g.stats.hits++;
      s.invuln = 0.7; s.burst = CFG.BURST_T;
      g.shake = 6; g.flash = 0.3;
      sfx('hit', pan(s.x));
      popup('-1', s.x, s.y - 1.4, '#ff4d4d');
      if (training) return;
      s.hp--;
      if (s.hp <= 0) {
        g.over = true; g.overT = 0;
        sfx('death');
      }
    }

    function updateSurvivor(dt, inp) {
      s.invuln = Math.max(0, s.invuln - dt);
      s.burst = Math.max(0, s.burst - dt);
      s.vaultCD = Math.max(0, s.vaultCD - dt);
      if (s.vault) {
        const v = s.vault;
        v.t += dt;
        const p = Math.min(1, v.t / CFG.VAULT_T);
        s.x = v.x0 + (v.x1 - v.x0) * p; s.y = v.y0 + (v.y1 - v.y0) * p;
        s.moving = true; s.walk += dt * 14;
        if (p >= 1) { s.vault = null; s.vaultCD = 0.15; }
        return;
      }
      let ax = inp.ax || 0, ay = inp.ay || 0;
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      s.moving = len > 0.12;
      if (s.moving) {
        const sp = CFG.RUN * (s.burst > 0 ? CFG.BURST : 1);
        moveBy(s, ax * sp * dt, ay * sp * dt, CFG.R_S);
        s.face = Math.atan2(ay, ax);
        s.walk += dt * 11;

        // pular pallet caído: empurrar contra ele
        if (!s.vaultCD) {
          for (const p of g.pallets) {
            if (p.state !== 'down') continue;
            const rx = s.x - p.cx, ry = s.y - p.cy;
            const along = rx * p.nx + ry * p.ny;
            const lat = -rx * p.ny + ry * p.nx;
            if (Math.abs(along) > 1.0 || Math.abs(along) < 0.3 || Math.abs(lat) > 0.55) continue;
            const away = along > 0 ? -1 : 1;
            if ((ax * p.nx + ay * p.ny) * away < 0.5 * Math.min(1, len)) continue;
            // atravessa no eixo da passagem; o eixo lateral é mantido
            const x1 = p.nx ? p.cx + p.nx * away * 0.95 : s.x;
            const y1 = p.ny ? p.cy + p.ny * away * 0.95 : s.y;
            if (hitsCircle(x1, y1, CFG.R_S)) continue;
            s.vault = { t: 0, x0: s.x, y0: s.y, x1, y1 };
            g.stats.vaults++;
            sfx('vault', pan(s.x));
            break;
          }
        }
      } else { s.walk = 0; }
    }

    // ---------- assassino ----------
    function updateKiller(dt) {
      const dx = s.x - k.x, dy = s.y - k.y, d = Math.hypot(dx, dy);
      g.dist = d;
      k.moving = false;

      if (k.state === 'intro') { k.t += dt; if (k.t >= CFG.INTRO) { k.state = 'chase'; k.t = 0; } return; }
      if (k.state === 'stun') { k.t += dt; if (k.t >= CFG.STUN) { k.state = 'chase'; k.t = 0; } return; }
      if (k.state === 'recover') { k.t += dt; if (k.t >= k.dur) { k.state = 'chase'; k.t = 0; } return; }
      if (k.state === 'windup') {
        k.t += dt;
        if (k.t >= CFG.WINDUP) { k.state = 'lunge'; k.t = 0; k.hitDone = false; sfx('lunge', pan(k.x)); }
        return;
      }
      if (k.state === 'lunge') {
        k.t += dt;
        moveBy(k, k.ldx * CFG.K_LUNGE * dt, k.ldy * CFG.K_LUNGE * dt, CFG.R_K);
        k.moving = true; k.walk += dt * 16;
        if (!k.hitDone && s.invuln <= 0 && d < CFG.HIT_R) { k.hitDone = true; hurt(); }
        if (k.t >= CFG.LUNGE_T) {
          k.state = 'recover'; k.t = 0; k.dur = k.hitDone ? CFG.RECOVER_HIT : CFG.RECOVER_MISS;
        }
        return;
      }
      if (k.state === 'break') {
        k.t += dt;
        const p = k.pal;
        if (Math.floor(k.t / 0.5) > k.brk) { k.brk++; sfx('breakHit', pan(k.x)); g.shake = Math.max(g.shake, 1.5); }
        if (k.t >= CFG.BREAK_T) {
          p.state = 'broken'; p.respawn = CFG.RESPAWN; k.pal = null;
          g.stats.breaks++;
          sfx('breakDone', pan(p.cx));
          dust(p.cx, p.cy, 16, '#a07a45');
          k.state = 'chase'; k.t = 0;
        }
        return;
      }

      // ---- chase ----
      const los = hasLOS(k, s);
      g.los = los;

      if (los && d < CFG.ATTACK_RANGE && !s.vault) {
        const n = Math.hypot(dx, dy) || 1;
        k.ldx = dx / n; k.ldy = dy / n; k.face = Math.atan2(dy, dx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x));
        return;
      }

      const ti = clamp(Math.floor(s.y), 0, H - 1) * W + clamp(Math.floor(s.x), 0, W - 1);
      fieldT -= dt;
      if (fieldT <= 0 || ti !== fieldTile) { computeField(); fieldT = 0.15; fieldTile = ti; }

      // mind game: às vezes o assassino "respeita" um pallet de pé entre vocês
      let speed = CFG.K_SPEED;
      k.hesitate = false;
      for (const p of g.pallets) {
        if (p.state !== 'up') continue;
        const dk = Math.hypot(k.x - p.cx, k.y - p.cy), ds = Math.hypot(s.x - p.cx, s.y - p.cy);
        if (dk > 4.2) { p.respect = undefined; p.hes = 0; continue; }
        const between = (p.cx - k.x) * (s.x - p.cx) + (p.cy - k.y) * (s.y - p.cy) > 0;
        if (dk < 2.6 && ds < 2.4 && between) {
          if (p.respect === undefined) {
            p.respect = rnd() < CFG.RESPECT;
            p.hes = CFG.HESITATE[0] + rnd() * (CFG.HESITATE[1] - CFG.HESITATE[0]);
          }
          if (p.respect && p.hes > 0) { p.hes -= dt; speed *= 0.18; k.hesitate = true; }
        }
      }

      let tx, ty;
      if (los) { tx = s.x; ty = s.y; }
      else {
        const n = bestNeighbor();
        if (!n) return;
        if (n.pal && Math.hypot(k.x - n.pal.cx, k.y - n.pal.cy) < 1.2) { startBreak(n.pal); return; }
        tx = n.x + 0.5; ty = n.y + 0.5;
      }
      const mx = tx - k.x, my = ty - k.y, ml = Math.hypot(mx, my);
      if (ml > 0.02) {
        const ox = k.x, oy = k.y;
        moveBy(k, mx / ml * speed * dt, my / ml * speed * dt, CFG.R_K);
        if (Math.hypot(k.x - ox, k.y - oy) > 0.0005) {
          k.face = Math.atan2(my, mx); k.moving = true; k.walk += dt * 11 * (speed / CFG.K_SPEED);
        }
      }
    }

    // ---------- loop ----------
    g.tryDrop = tryDrop;

    g.update = function (dt, inp) {
      inp = inp || {};
      if (g.hitstop > 0) { g.hitstop -= dt; return; }
      g.time += dt;
      g.shake = Math.max(0, g.shake - dt * 22);
      g.flash = Math.max(0, g.flash - dt);

      if (g.over) {
        g.overT += dt;
        return;
      }

      if (inp.drop) tryDrop();
      updateSurvivor(dt, inp);

      for (const p of g.pallets) {
        p.t += dt;
        if (p.state === 'falling' && p.t >= CFG.FALL_T) land(p);
        if (training && (p.state === 'down' || p.state === 'broken')) {
          p.respawn -= dt;
          if (p.respawn <= 0 &&
            Math.hypot(s.x - p.cx, s.y - p.cy) > 1.6 && Math.hypot(k.x - p.cx, k.y - p.cy) > 1.6 &&
            !(k.state === 'break' && k.pal === p)) {
            p.state = 'up'; p.t = 0; p.respect = undefined;
            sfx('respawn');
          }
        }
      }

      updateKiller(dt);
      g.near = findDroppable();

      for (const pu of g.popups) pu.t += dt;
      g.popups = g.popups.filter((pu) => pu.t < 1.1);
      for (const f of g.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
      g.fx = g.fx.filter((f) => f.t < f.life);
    };

    g.standing = () => g.pallets.filter((p) => p.state === 'up').length;
    g.inZone = inZone;
    g.solid = solid;
    g.CFG = CFG;
    return g;
  }

  DP.createGame = createGame;
  DP.CFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
