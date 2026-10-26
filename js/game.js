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
    STUN: 0.9,           // atordoamento do assassino (parado, de estrelas)...
    STUMBLE_T: 2.8,      // ...e depois ele TROPEÇA por este tempo
    STUMBLE_SPEED: 0.55, // velocidade enquanto tropeça
    TRIP_T: 0.4,         // cada tombo (para e cambaleia para a frente)
    BREAK_T: 2.0,        // tempo para o assassino quebrar um pallet caído
    BREAK_COST: 9,       // "custo em tiles" de quebrar vs. dar a volta (IA)
    VAULT_T: 0.5,        // pular o pallet caído

    RESPECT: 0.55,       // chance do assassino "respeitar" um pallet de pé (hesitar)
    HESITATE: [0.8, 1.5],
    INTRO: 3,

    // objetivo: geradores + portões
    REPAIR_T: 15,        // segundos segurando AGIR para terminar um gerador
    GATE_T: 4,           // segundos para abrir o portão
    GEN_RANGE: 1.45, GATE_RANGE: 1.6,
    SKILL_EVERY: [3.5, 7],   // intervalo entre skill checks (s)
    SKILL_DELAY: 0.45,       // tempo até o ponteiro começar a girar
    SKILL_SPEED: 5.2,        // rad/s do ponteiro
    SKILL_ZONE: 0.34,        // meia largura da zona de acerto (rad)
    SKILL_GREAT: 0.12,       // meia largura da zona perfeita
    SKILL_FAIL: 0.10,        // progresso perdido ao errar
    // IA do sobrevivente (quando você é o assassino)
    AI_SENSE: 11,        // sente o assassino por perto (batimento), mesmo sem ver
    AI_SEE: 16,          // vê o assassino com linha de visão até aqui
    AI_FLEE: 14,         // começa a fugir dentro desta distância
    AI_SPEED: 1.1,       // o sobrevivente-IA corre um pouco mais (compensa não ter olhos humanos)
    AI_SKILL_ERR: 0.40,  // erro (rad) no skill check: ~85% de acerto
    KICK: 0.15,              // progresso que o assassino destrói ao chutar um gerador

    // percepção do assassino
    SIGHT: 13,           // enxerga com linha de visão até aqui (tiles)
    TRACK: 2.5,          // segue o rastro por mais tempo depois de perder você
    SEARCH_WAIT: 2.5,
    PATROL_SPEED: 0.88,  // multiplicador de velocidade enquanto patrulha/procura
    NOISE_MOVE: 3.5, NOISE_REPAIR: 9, NOISE_GATE: 8, NOISE_VAULT: 5,
    RESPAWN: 8           // só no TREINO: pallets voltam a ficar de pé
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function createGame(opts) {
    opts = opts || {};
    const rnd = opts.rng || Math.random;
    const sfx = opts.sfx || function () {};
    const training = !!opts.training;
    const role = opts.role === 'killer' ? 'killer' : 'survivor';
    const map = DP.buildMap();
    const W = map.W, H = map.H, t = map.t;

    const g = {
      cfg: CFG, map, training, role,
      time: 0, over: false, overT: 0,
      stats: { stuns: 0, drops: 0, misses: 0, hits: 0, breaks: 0, vaults: 0, gens: 0, kicks: 0, skillOk: 0, skillFail: 0 },
      pallets: [], popups: [], fx: [],
      shake: 0, hitstop: 0, flash: 0,
      near: null, los: false, dist: 99, interact: null, kInteract: null, pInteract: null, pings: [], result: null, gensDone: 0, need: 0, gens: [], gates: [],
      s: {
        x: map.spawnSurvivor.x, y: map.spawnSurvivor.y, face: Math.PI / 2,
        hp: 2, burst: 0, invuln: 0, vault: null, vaultCD: 0, moving: false, walk: 0,
        noise: 0, acting: null, skill: null, skillCD: 4, tick: 0
      },
      k: {
        x: map.spawnKiller.x, y: map.spawnKiller.y, face: -Math.PI / 2,
        state: role === 'killer' ? 'chase' : 'intro', t: 0, dur: 0, trip: 0, tripCD: 0, tripDir: 0, ph: 0, vx: 0, vy: 0, ldx: 0, ldy: 0, hitDone: false, pal: null,
        moving: false, walk: 0, hesitate: false,
        aware: 'patrol', lost: 0, last: null, wait: 0, goal: null
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
    g.need = map.NEED;
    g.gens = map.gens.map((o) => ({ tx: o.tx, ty: o.ty, cx: o.tx + 0.5, cy: o.ty + 0.5, progress: 0, done: false, visited: -99 }));
    g.gates = map.gates.map((o) => ({ tx: o.tx, ty: o.ty, cx: o.tx + 0.5, cy: o.ty + 0.5, side: o.side, progress: 0, open: false, visited: -99 }));

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

    // ---------- campo de caminho do assassino (Dijkstra a partir do objetivo dele) ----------
    function extra(i) {
      const p = palAt[i];
      if (!p) return 0;
      return p.state === 'down' ? CFG.BREAK_COST : p.state === 'up' ? 0.3 : 0;
    }
    function blocked(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H || t[ty * W + tx] !== 0; }
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    // custo de pisar no tile i: o assassino quebra pallet caído (caro); o sobrevivente pula (barato)
    function costAt(i, sMode) {
      const p = palAt[i];
      if (!p) return 0;
      if (sMode) return p.state === 'down' ? 1.4 : p.state === 'falling' ? 3 : 0;
      return extra(i);
    }
    function dijkstra(arr, gx, gy, sMode) {
      arr.fill(1e9);
      const sx = clamp(Math.floor(gx), 0, W - 1), sy = clamp(Math.floor(gy), 0, H - 1);
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
      arr[sy * W + sx] = 0; push(sy * W + sx, 0);
      while (heapI.length) {
        const i = pop(), cd = arr[i];
        const ux = i % W, uy = (i / W) | 0;
        for (const d of DIRS) {
          const vx = ux + d[0], vy = uy + d[1];
          if (blocked(vx, vy)) continue;
          const diag = d[0] !== 0 && d[1] !== 0;
          if (diag && (blocked(ux + d[0], uy) || blocked(ux, uy + d[1]))) continue;
          const j = vy * W + vx;
          const nd = cd + (diag ? 1.414 : 1) + costAt(i, sMode);
          if (nd < arr[j]) { arr[j] = nd; push(j, nd); }
        }
      }
    }
    function computeField(gx, gy) { dijkstra(field, gx, gy, false); }

    // melhor tile vizinho de e seguindo o campo arr
    function bestNb(arr, e, sMode) {
      const kx = Math.floor(e.x), ky = Math.floor(e.y);
      let best = null, bv = 1e9;
      for (const d of DIRS) {
        const nx = kx + d[0], ny = ky + d[1];
        if (blocked(nx, ny)) continue;
        const diag = d[0] !== 0 && d[1] !== 0;
        if (diag && (solid(kx + d[0], ky) || solid(kx, ky + d[1]))) continue;
        const j = ny * W + nx;
        const v = arr[j] + (diag ? 1.414 : 1) + costAt(j, sMode);
        if (v < bv) { bv = v; best = { x: nx, y: ny, pal: palAt[j] && palAt[j].state === 'down' ? palAt[j] : null }; }
      }
      return best;
    }
    function bestNeighbor() { return bestNb(field, k, false); }

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
        k.state = 'stun'; k.t = 0; k.pal = null; k.aware = 'hunt'; k.lost = 0;
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
      // quem estava em cima do tile (ou encostando nele) é empurrado para fora, para o lado em que estava
      for (const e of [s, k]) {
        const r = e === s ? CFG.R_S : CFG.R_K;
        const dxr = e.x - clamp(e.x, p.tx, p.tx + 1), dyr = e.y - clamp(e.y, p.ty, p.ty + 1);
        if (dxr * dxr + dyr * dyr >= r * r) continue;
        let side = (e.x - p.cx) * p.nx + (e.y - p.cy) * p.ny;
        if (Math.abs(side) < 0.05) side = (e === s ? -1 : 1) * (p.dir.x * p.nx + p.dir.y * p.ny);
        const sg = side >= 0 ? 1 : -1;
        if (p.nx) e.x = p.cx + sg * (0.5 + r + 0.03); else e.y = p.cy + sg * (0.5 + r + 0.03);
      }
    }

    function startBreak(p) {
      k.state = 'break'; k.t = 0; k.pal = p; k.brk = 0;
      k.face = Math.atan2(p.cy - k.y, p.cx - k.x);
    }

    // rede de segurança: se alguém ficar encostado em algo sólido, solta no ponto livre mais próximo
    function unstick(e, r) {
      if (!hitsCircle(e.x, e.y, r)) return;
      for (let rad = 0.1; rad <= 1.2; rad += 0.1) {
        for (let a = 0; a < 16; a++) {
          const x = e.x + Math.cos(a * Math.PI / 8) * rad, y = e.y + Math.sin(a * Math.PI / 8) * rad;
          if (!hitsCircle(x, y, r)) { e.x = x; e.y = y; return; }
        }
      }
    }

    // ---------- sobrevivente ----------
    function hurt() {
      g.stats.hits++;
      s.invuln = 0.7; s.burst = CFG.BURST_T;
      g.shake = 6; g.flash = 0.3;
      sfx('hit', pan(s.x));
      popup(role === 'killer' ? 'ACERTOU!' : '-1', s.x, s.y - 1.4, role === 'killer' ? '#ffd23f' : '#ff4d4d');
      k.aware = 'hunt'; k.lost = 0;
      if (training) return;
      s.hp--;
      if (s.hp <= 0) {
        g.over = true; g.overT = 0; g.result = 'dead';
        sfx(role === 'killer' ? 'escape' : 'death');
      }
    }

    // ---------- geradores, skill check, portões ----------
    function alert(x, y) {
      g.pings.push({ x, y, t: g.time });
      if (k.state === 'intro' || role === 'killer') return;
      k.last = { x, y };
      if (k.aware !== 'hunt') { k.aware = 'search'; k.wait = 0; }
    }
    function findInteract() {
      let best = null, bd = 1e9;
      for (const o of g.gens) {
        if (o.done) continue;
        const d = Math.hypot(s.x - o.cx, s.y - o.cy);
        if (d < CFG.GEN_RANGE && d < bd) { bd = d; best = { type: 'gen', obj: o }; }
      }
      for (const o of g.gates) {
        if (!o.open) continue;
        const d = Math.hypot(s.x - o.cx, s.y - o.cy);
        if (d < CFG.GATE_RANGE && d < bd) { bd = d; best = { type: 'gate', obj: o }; }
      }
      return best;
    }
    function startSkill() {
      s.skill = { t: 0, tz: 1.5 + rnd() * 3.6 };
      sfx('skill');
    }
    function endSkill(result) {
      const o = s.acting && s.acting.obj;
      if (result === 'fail' || result === 'miss') {
        g.stats.skillFail++;
        if (o) o.progress = Math.max(0, o.progress - CFG.SKILL_FAIL);
        g.shake = 5; g.flash = 0.12;
        sfx('bang', pan(s.x));
        popup(role === 'killer' ? 'ALGO EXPLODIU!' : 'FALHOU!', s.x, s.y - 1.5, '#ff4d4d');
        alert(s.x, s.y);
      } else {
        g.stats.skillOk++;
        const great = result === 'great';
        if (o) o.progress = Math.min(1, o.progress + (great ? 0.05 : 0.025));
        sfx('skillok');
        popup(great ? 'PERFEITO!' : 'BOM', s.x, s.y - 1.5, great ? '#7dffa0' : '#cfe8ff');
      }
      s.skill = null;
      s.skillCD = CFG.SKILL_EVERY[0] + rnd() * (CFG.SKILL_EVERY[1] - CFG.SKILL_EVERY[0]);
    }
    function skillAngle() { return Math.max(0, s.skill.t - CFG.SKILL_DELAY) * CFG.SKILL_SPEED; }
    function pressSkill() {
      if (!s.skill || s.skill.t < CFG.SKILL_DELAY) return;
      const diff = Math.abs(skillAngle() - s.skill.tz);
      endSkill(diff < CFG.SKILL_GREAT ? 'great' : diff < CFG.SKILL_ZONE ? 'good' : 'fail');
    }
    function finishGen(o) {
      o.done = true; o.progress = 1;
      g.gensDone++; g.stats.gens++;
      sfx('genDone', pan(o.cx));
      popup('GERADOR PRONTO!', o.cx, o.cy - 1.4, '#7dffa0');
      alert(o.cx, o.cy);               // a explosão de luz denuncia o gerador
      if (g.gensDone >= g.need) {
        for (const gt of g.gates) gt.open = true;
        popup('PORTÕES ENERGIZADOS!', s.x, s.y - 2.2, '#ffd23f');
        sfx('gates');
      }
    }
    function escape() {
      g.over = true; g.overT = 0; g.result = 'escaped';
      sfx(role === 'killer' ? 'death' : 'escape');
    }
    function act(dt) {
      const tg = s.acting, o = tg.obj;
      if (tg.type === 'gen') {
        s.noise = CFG.NOISE_REPAIR; o.noisyT = g.time;
        o.progress = Math.min(1, o.progress + dt / CFG.REPAIR_T);
        s.tick -= dt; if (s.tick <= 0) { s.tick = 0.55; sfx('repair', pan(o.cx)); }
        if (o.progress >= 1) finishGen(o);
      } else {
        s.noise = CFG.NOISE_GATE;
        o.progress = Math.min(1, o.progress + dt / CFG.GATE_T);
        s.tick -= dt; if (s.tick <= 0) { s.tick = 0.4; sfx('repair', pan(o.cx)); }
        if (o.progress >= 1) escape();
      }
    }

    function updateSurvivor(dt, inp) {
      s.noise = 0; s.acting = null;
      if (!s.vault) unstick(s, CFG.R_S);
      s.invuln = Math.max(0, s.invuln - dt);
      s.burst = Math.max(0, s.burst - dt);
      s.vaultCD = Math.max(0, s.vaultCD - dt);
      if (s.vault) {
        const v = s.vault;
        v.t += dt;
        const p = Math.min(1, v.t / CFG.VAULT_T);
        s.x = v.x0 + (v.x1 - v.x0) * p; s.y = v.y0 + (v.y1 - v.y0) * p;
        s.moving = true; s.walk += dt * 14; s.noise = CFG.NOISE_VAULT;
        if (p >= 1) { s.vault = null; s.vaultCD = 0.15; }
        return;
      }
      let ax = inp.ax || 0, ay = inp.ay || 0;
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      s.moving = len > 0.12;
      if (inp.act && !s.moving && g.interact) {
        s.acting = g.interact; s.walk = 0;
        s.face = Math.atan2(g.interact.obj.cy - s.y, g.interact.obj.cx - s.x);
        act(dt);
        return;
      }
      if (s.moving) {
        s.noise = CFG.NOISE_MOVE;
        const sp = CFG.RUN * (role === 'killer' ? CFG.AI_SPEED : 1) * (s.burst > 0 ? CFG.BURST : 1);
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
    function kickGen(o) {
      o.progress = Math.max(0, o.progress - CFG.KICK); g.stats.kicks++;
      sfx('bang', pan(k.x)); g.shake = Math.max(g.shake, 2);
      popup('REGREDIU', o.cx, o.cy - 1.2, '#ff7a59');
      k.state = 'recover'; k.t = 0; k.dur = 1.0;
    }
    function findKillerInteract() {
      let best = null, bd = 1e9;
      for (const p of g.pallets) {
        if (p.state !== 'down') continue;
        const d = Math.hypot(k.x - p.cx, k.y - p.cy);
        if (d < 1.25 && d < bd) { bd = d; best = { type: 'break', obj: p }; }
      }
      if (best) return best;
      for (const o of g.gens) {
        if (o.done || o.progress <= 0) continue;
        const d = Math.hypot(k.x - o.cx, k.y - o.cy);
        if (d < 1.7 && d < bd) { bd = d; best = { type: 'kick', obj: o }; }
      }
      return best;
    }
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

    // controle do jogador quando ele é o assassino
    function playerKiller(dt, inp, dx, dy, d) {
      let ax = inp.ax || 0, ay = inp.ay || 0;
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      if (len > 0.12) {
        const ox = k.x, oy = k.y;
        moveBy(k, ax * CFG.K_SPEED * dt, ay * CFG.K_SPEED * dt, CFG.R_K);
        k.face = Math.atan2(ay, ax);
        if (Math.hypot(k.x - ox, k.y - oy) > 0.0005) { k.moving = true; k.walk += dt * 11; }
      }
      if (inp.drop) {                                  // ATACAR (com um pouco de mira assistida)
        let lx = Math.cos(k.face), ly = Math.sin(k.face);
        if (d < CFG.ATTACK_RANGE * 1.5 && hasLOS(k, s) && Math.abs(angDiff(Math.atan2(dy, dx), k.face)) < 1.0) { lx = dx / (d || 1); ly = dy / (d || 1); }
        k.ldx = lx; k.ldy = ly; k.face = Math.atan2(ly, lx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x));
        return;
      }
      if (inp.actPress && g.kInteract) {
        const it = g.kInteract;
        if (it.type === 'break') startBreak(it.obj); else kickGen(it.obj);
      }
    }

    // tropeço: depois do atordoamento ele cambaleia, desvia do rumo e cai de vez em quando
    function doStumble(dt, inp) {
      k.t += dt;
      const f = Math.max(0, 1 - k.t / CFG.STUMBLE_T);
      let hx, hy;
      if (role === 'killer') { hx = inp.ax || 0; hy = inp.ay || 0; }
      else { const tg = k.last || s; hx = tg.x - k.x; hy = tg.y - k.y; }
      const hl = Math.hypot(hx, hy);
      if (k.trip > 0) {
        k.trip -= dt;
        const sp = CFG.K_SPEED * 0.4 * (k.trip / CFG.TRIP_T);
        moveBy(k, Math.cos(k.tripDir) * sp * dt, Math.sin(k.tripDir) * sp * dt, CFG.R_K);
      } else {
        k.tripCD -= dt;
        if (k.tripCD <= 0) {
          k.trip = CFG.TRIP_T; k.tripCD = 0.75 + rnd() * 0.7; k.tripDir = k.face;
          sfx('trip', pan(k.x)); dust(k.x, k.y + 0.3, 6, '#8b7355'); g.shake = Math.max(g.shake, 2);
        } else {
          const drift = (Math.sin(k.t * 4.3 + k.ph) * 0.85 + Math.sin(k.t * 11.1 + k.ph * 2) * 0.35) * (0.45 + 0.55 * f);
          const base = hl > 0.12 ? Math.atan2(hy, hx) : k.face;
          const ang = base + drift;
          const mag = hl > 0.12 ? Math.min(1, hl) : 0.25;
          const sp = CFG.K_SPEED * CFG.STUMBLE_SPEED * mag * (0.75 + 0.25 * Math.sin(k.t * 7.3));
          const ox = k.x, oy = k.y;
          moveBy(k, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, CFG.R_K);
          if (Math.hypot(k.x - ox, k.y - oy) > 0.0005) { k.face = ang; k.moving = true; k.walk += dt * 9; }
        }
      }
      if (k.t >= CFG.STUMBLE_T) { k.state = 'chase'; k.t = 0; k.trip = 0; }
    }

    function updateKiller(dt, inp) {
      unstick(k, CFG.R_K);
      const dx = s.x - k.x, dy = s.y - k.y, d = Math.hypot(dx, dy);
      g.dist = d;
      k.moving = false;

      if (k.state === 'intro') { k.t += dt; if (k.t >= CFG.INTRO) { k.state = 'chase'; k.t = 0; k.aware = 'patrol'; } return; }
      if (k.state === 'stun') {
        k.t += dt;
        if (k.t >= CFG.STUN) {
          k.state = 'stumble'; k.t = 0; k.trip = 0; k.tripCD = 0.45; k.ph = rnd() * 6.28;
          sfx('trip', pan(k.x));
        }
        return;
      }
      if (k.state === 'stumble') { doStumble(dt, inp); return; }
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
        if (role === 'killer' && Math.hypot(inp.ax || 0, inp.ay || 0) > 0.6 && k.t > 0.3) { k.state = 'chase'; k.t = 0; k.pal = null; return; }
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

      if (role === 'killer') { playerKiller(dt, inp, dx, dy, d); return; }

      // ---- percepção: vê (linha de visão), ouve (ruído) ou rastreia ----
      const los = hasLOS(k, s);
      g.los = los;
      const sees = los && d < CFG.SIGHT;
      const hears = d < s.noise;
      if (sees || hears) { k.aware = 'hunt'; k.lost = 0; k.last = { x: s.x, y: s.y }; }
      else if (k.aware === 'hunt') {
        k.lost += dt;
        if (k.lost > CFG.TRACK) { k.aware = 'search'; k.wait = 0; }
      }
      const hunting = k.aware === 'hunt';

      if (hunting && los && d < CFG.ATTACK_RANGE && !s.vault) {
        const n = Math.hypot(dx, dy) || 1;
        k.ldx = dx / n; k.ldy = dy / n; k.face = Math.atan2(dy, dx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x));
        return;
      }

      // ---- objetivo de movimento ----
      let gx, gy, speed = CFG.K_SPEED;
      if (hunting) { gx = s.x; gy = s.y; }
      else if (k.aware === 'search') {
        if (!k.last) k.last = { x: s.x, y: s.y };
        gx = k.last.x; gy = k.last.y; speed *= CFG.PATROL_SPEED;
        if (Math.hypot(k.x - gx, k.y - gy) < 1.4) {
          k.wait += dt;
          if (k.wait > CFG.SEARCH_WAIT) { k.aware = 'patrol'; k.goal = null; }
        }
      } else {
        speed *= CFG.PATROL_SPEED;
        if (!k.goal) k.goal = pickGoal();
        if (!k.goal) { k.aware = 'hunt'; k.lost = 0; return; }
        const o = k.goal;
        gx = o.cx; gy = o.cy;
        if (Math.hypot(k.x - gx, k.y - gy) < 1.7) {
          o.visited = g.time; k.goal = null;
          if (o.progress > 0 && !o.done && g.gens.includes(o)) { kickGen(o); return; }
          k.state = 'recover'; k.t = 0; k.dur = 1.2;
          return;
        }
      }

      const ti = clamp(Math.floor(gy), 0, H - 1) * W + clamp(Math.floor(gx), 0, W - 1);
      fieldT -= dt;
      if (fieldT <= 0 || ti !== fieldTile) { computeField(gx, gy); fieldT = 0.15; fieldTile = ti; }

      // mind game: às vezes o assassino "respeita" um pallet de pé entre vocês
      k.hesitate = false;
      if (hunting) for (const p of g.pallets) {
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
      if (hunting && los) { tx = s.x; ty = s.y; }
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

    // próximo gerador (ou portão) a patrulhar: prefere os que já têm progresso e os que não visitou há pouco
    function pickGoal() {
      const list = g.gensDone >= g.need ? g.gates : g.gens.filter((o) => !o.done);
      if (!list.length) return null;
      const w = list.map((o) => {
        const d = Math.hypot(k.x - o.cx, k.y - o.cy);
        return (o.progress > 0 ? 3 : 1) * (g.time - o.visited > 25 ? 1 : 0.1) / (1 + d / 25);
      });
      let r = rnd() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }

    // ---------- IA do sobrevivente (quando o jogador é o assassino) ----------
    const fS = new Float32Array(W * H), fK = new Float32Array(W * H), fT = new Float32Array(W * H);
    const ai = { mode: 'repair', target: null, aware: 0, lk: null, thinkT: 0, plan: null, skill: null, skillAt: 0, wait: 0, noPal: {}, gateGoal: null, fieldT: 0, zoneT: 0 };
    g.ai = ai;
    const tileOf = (e) => clamp(Math.floor(e.y), 0, H - 1) * W + clamp(Math.floor(e.x), 0, W - 1);

    function steer(arr, out, goal) {
      // já no tile do destino: vai direto ao ponto (senão o campo empurra para fora do tile)
      if (goal && Math.floor(goal.x) === Math.floor(s.x) && Math.floor(goal.y) === Math.floor(s.y)) {
        const gx = goal.x - s.x, gy = goal.y - s.y, gl = Math.hypot(gx, gy);
        if (gl > 0.05) { out.ax = gx / gl; out.ay = gy / gl; }
        return;
      }
      const n = bestNb(arr, s, true);
      if (!n) return;
      const mx = n.x + 0.5 - s.x, my = n.y + 0.5 - s.y, l = Math.hypot(mx, my) || 1;
      out.ax = mx / l; out.ay = my / l;
    }

    function planFlee() {
      dijkstra(fS, s.x, s.y, true);
      dijkstra(fK, k.x, k.y, false);
      const myT = CFG.RUN, kT = CFG.K_SPEED;
      let best = null, bs = 1e9, bT = null;
      for (const p of g.pallets) {
        if (p.state !== 'up' || (ai.noPal[p.tx + ',' + p.ty] || 0) > g.time) continue;
        const j = p.ty * W + p.tx;
        const A = j + p.nx + p.ny * W, B = j - p.nx - p.ny * W;       // os dois lados da passagem
        if (fK[A] > 1e8 || fK[B] > 1e8) continue;
        const farI = fK[A] > fK[B] ? A : B, nearI = farI === A ? B : A, sg = farI === A ? 1 : -1;
        // o caminho mais curto do assassino até o lado de lá passa por este pallet?
        if (fK[farI] - fK[j] < 0.8 || fK[j] - fK[nearI] < 0.8) continue;
        const T = { x: p.cx + p.nx * sg * 0.95, y: p.cy + p.ny * sg * 0.95 };
        const ts = fS[farI], tk = fK[farI];
        if (ts > 26 || ts / myT + 0.2 > tk / kT) continue;               // o assassino chegaria antes
        if (ts < bs) { bs = ts; best = p; bT = T; }
      }
      if (best) {
        dijkstra(fT, bT.x, bT.y, true);
        ai.plan = { pal: best, T: bT, err: (rnd() - 0.5) * 0.6, react: rnd() * 0.22 };
        return;
      }
      // sem pallet seguro: o tile mais longe do assassino que ainda dá para alcançar primeiro (portão aberto tem bônus)
      let bt = null, bv = -1e9;
      for (let i = 0; i < W * H; i++) {
        if (t[i] !== 0 || fS[i] > 22 || fS[i] / myT + 0.15 > fK[i] / kT) continue;
        const v = fK[i] - 0.35 * fS[i];
        if (v > bv) { bv = v; bt = i; }
      }
      for (const gt of g.gates) {
        if (!gt.open) continue;
        const gi = gt.ty * W + gt.tx;
        // o portão está na parede: usa o tile livre ao lado
        const ni = gt.side === 'W' ? gi + 1 : gi - 1;
        if (fS[ni] < 1e8 && fS[ni] / myT + 0.15 < fK[ni] / kT && 40 - 0.35 * fS[ni] + fK[ni] > bv) { bv = 40 - 0.35 * fS[ni] + fK[ni]; bt = ni; }
      }
      if (bt !== null) {
        const T = { x: (bt % W) + 0.5, y: ((bt / W) | 0) + 0.5 };
        dijkstra(fT, T.x, T.y, true);
        ai.plan = { pal: null, T, err: 0, react: 0 };
      } else ai.plan = { pal: null, T: null, err: 0, react: 0 };
    }

    function aiSurvivor(dt) {
      const out = { ax: 0, ay: 0, act: false, drop: false, press: false, actPress: false };
      const kdx = k.x - s.x, kdy = k.y - s.y, kd = Math.hypot(kdx, kdy);
      const sensed = kd < CFG.AI_SENSE || (kd < CFG.AI_SEE && hasLOS(s, k));
      if (sensed) { ai.aware = 4; ai.lk = { x: k.x, y: k.y }; } else ai.aware = Math.max(0, ai.aware - dt);
      if (s.burst > 0) ai.aware = Math.max(ai.aware, 3);

      // skill check: o "jogador" aperta com um pequeno erro
      if (s.skill) {
        if (ai.skill !== s.skill) { ai.skill = s.skill; ai.skillAt = s.skill.tz + (rnd() - 0.5) * 2 * CFG.AI_SKILL_ERR; }
        if (s.skill.t > CFG.SKILL_DELAY && skillAngle() >= ai.skillAt) out.press = true;
      }

      // foge de quem se aproxima; um assassino parado e distante não assusta
      const kMoving = Math.hypot(k.vx, k.vy) > 0.6 || k.state === 'lunge' || k.state === 'windup';
      const fleeing = ai.aware > 0 && (kd < 7 || (kMoving && kd < CFG.AI_FLEE) || s.burst > 0);
      ai.mode = fleeing ? 'flee' : (g.gensDone >= g.need ? 'exit' : 'repair');

      if (ai.mode === 'flee') {
        ai.thinkT -= dt;
        if (ai.thinkT <= 0) { ai.thinkT = 0.3; planFlee(); }
        const plan = ai.plan;
        const p = plan && plan.pal;
        let waiting = false;
        if (p && p.state === 'up') {
          const ds = Math.hypot(s.x - p.cx, s.y - p.cy);
          const along = (s.x - p.cx) * p.nx + (s.y - p.cy) * p.ny;
          const kSide = (k.x - p.cx) * p.nx + (k.y - p.cy) * p.ny;
          if (ds < CFG.DROP_RANGE && along * kSide < 0 && !s.vault) {
            const dir = dropDir(p);
            const fake = { cx: p.cx + dir.x * plan.err, cy: p.cy + dir.y * plan.err, dir };
            const inc = k.state === 'stun' || k.state === 'stumble';
            const ahead = { x: k.x + k.vx * (CFG.FALL_T + 0.12), y: k.y + k.vy * (CFG.FALL_T + 0.12) };
            const zone = inZone(fake, ahead);
            // tempo de reação humano: a zona precisa ficar "ocupada" por um instante antes de ele reagir
            ai.zoneT = zone && !inc ? ai.zoneT + dt : 0;
            if (!inc && ((zone && ai.zoneT >= plan.react) || (kd < 1.7 && k.state !== 'recover')) && kd > 0.5) { out.drop = true; ai.noPal[p.tx + ',' + p.ty] = g.time + 5; }
            waiting = true;
            ai.wait += dt;
            if (ai.wait > 2.5 && kd < 9) { out.drop = true; ai.noPal[p.tx + ',' + p.ty] = g.time + 5; }   // trava a passagem
          }
        } else ai.wait = 0;
        if (plan && plan.T && !waiting) {
          if (Math.hypot(plan.T.x - s.x, plan.T.y - s.y) > 0.3) steer(fT, out, plan.T);
        } else if (!plan || (!plan.T && !waiting)) {
          const l = kd || 1; out.ax = -kdx / l; out.ay = -kdy / l;     // sem opção: corre para longe
        }
        return out;
      }
      ai.wait = 0;

      // exit/repair: caminha até o alvo e segura AGIR
      ai.fieldT -= dt;
      if (ai.mode === 'exit') {
        if (!ai.target || !g.gates.includes(ai.target)) {
          let bg = null, bd = 1e9;
          dijkstra(fS, s.x, s.y, true);
          for (const gt of g.gates) { const ni = gt.side === 'W' ? gt.ty * W + gt.tx + 1 : gt.ty * W + gt.tx - 1; if (fS[ni] < bd) { bd = fS[ni]; bg = gt; } }
          ai.target = bg; ai.fieldT = 0;
        }
      } else if (!ai.target || !g.gens.includes(ai.target) || ai.target.done) {
        dijkstra(fS, s.x, s.y, true);
        let bg = null, bv = 1e9;
        for (const o of g.gens) {
          if (o.done) continue;
          let v = Math.min(fS[o.ty * W + o.tx - 1] || 1e9, fS[o.ty * W + o.tx + 1] || 1e9, fS[(o.ty + 1) * W + o.tx] || 1e9, fS[(o.ty - 1) * W + o.tx] || 1e9) - o.progress * 10;
          if (ai.lk && Math.hypot(ai.lk.x - o.cx, ai.lk.y - o.cy) < 9) v += 30;      // evita onde viu o assassino
          if (v < bv) { bv = v; bg = o; }
        }
        ai.target = bg; ai.fieldT = 0;
      }
      const tg = ai.target;
      if (!tg) return out;
      const it = g.interact;
      if (it && it.obj === tg) { out.act = true; return out; }
      if (ai.fieldT <= 0) { dijkstra(fT, tg.cx, tg.cy, true); ai.fieldT = 0.4; }
      steer(fT, out, { x: tg.cx, y: tg.cy });
      return out;
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

      g.interact = findInteract();
      g.kInteract = role === 'killer' ? findKillerInteract() : null;
      g.pInteract = role === 'killer' ? g.kInteract : g.interact;
      const sin = role === 'killer' ? aiSurvivor(dt) : inp;   // quem controla o sobrevivente
      if (s.skill && (sin.press || sin.drop || sin.actPress)) pressSkill();
      else if (sin.drop || (sin.actPress && !g.interact)) tryDrop();
      updateSurvivor(dt, sin);

      // skill checks só acontecem enquanto conserta um gerador
      if (s.acting && s.acting.type === 'gen') {
        if (!s.skill) { s.skillCD -= dt; if (s.skillCD <= 0) startSkill(); }
        else {
          s.skill.t += dt;
          if (skillAngle() > s.skill.tz + CFG.SKILL_ZONE + 0.1) endSkill('miss');
        }
      } else s.skill = null;
      if (g.over) return;

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

      const kox = k.x, koy = k.y;
      updateKiller(dt, inp);
      k.vx = (k.x - kox) / (dt || 1); k.vy = (k.y - koy) / (dt || 1);
      g.near = findDroppable();
      g.pings = g.pings.filter((q) => g.time - q.t < 4);

      for (const pu of g.popups) pu.t += dt;
      g.popups = g.popups.filter((pu) => pu.t < 1.1);
      for (const f of g.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
      g.fx = g.fx.filter((f) => f.t < f.life);
    };

    // vetor unitário de e até (gx,gy) pelo melhor caminho (usado por bots de teste)
    const fTest = new Float32Array(W * H);
    g.pathVec = (e, gx, gy) => {
      dijkstra(fTest, gx, gy, false);
      const n = bestNb(fTest, e, false);
      if (!n) return { x: 0, y: 0 };
      const mx = n.x + 0.5 - e.x, my = n.y + 0.5 - e.y, l = Math.hypot(mx, my) || 1;
      return { x: mx / l, y: my / l };
    };
    g.alert = alert;
    g.pl = role === 'killer' ? k : s;
    g.standing = () => g.pallets.filter((p) => p.state === 'up').length;
    g.inZone = inZone;
    g.solid = solid;
    g.CFG = CFG;
    return g;
  }

  DP.createGame = createGame;
  DP.CFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
