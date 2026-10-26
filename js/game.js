// Lógica do jogo: 4 sobreviventes (você + bots, ou 4 bots), assassino, pallets, janelas,
// geradores e porta principal. Sem DOM aqui — render e entrada ficam em render.js / main.js
// (e dá para testar no Node).
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  const CFG = {
    RUN: 4.0,            // velocidade do sobrevivente (tiles/s)
    WALK: 0.5,           // multiplicador ao andar (Shift / joystick leve)
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

    // assassino controlado por pessoa: mais rápido e mais perdoador (playtest 1: "lento" e "errar custa demais")
    K_SPEED_P: 4.75,      // velocidade (a da IA continua K_SPEED)
    K_LUNGE_P: 8.8,
    WINDUP_P: 0.12,
    HIT_R_P: 0.92,       // raio do golpe
    RECOVER_MISS_P: 0.45,
    RECOVER_HIT_P: 1.2,
    AIM_CONE: 1.25,      // mira assistida: ângulo (rad) e alcance
    AIM_RANGE: 2.8,
    HOMING: 5.0,         // o bote corrige a direção até isto (rad/s) em direção ao alvo

    // pallet
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

    // janelas
    WIN_OPEN_T: 0.8,     // segurar AGIR para abrir uma janela fechada (silencioso)
    WIN_BREAK_T: 1.0,    // o assassino quebra a janela (fechada ou aberta)
    VAULT_RUN: 0.45,     // correndo: pula a janela aberta
    VAULT_WALK: 1.0,     // andando: passa "tranquilamente" pela janela aberta
    VAULT_CRASH: 0.5,    // correndo contra a janela fechada: atravessa quebrando (e se corta)
    VAULT_K: 0.85,       // o assassino passa por janela aberta/quebrada (mais devagar)
    NOISE_WALK: 1.4, NOISE_CRASH: 10,

    RESPECT: 0.55,       // chance do assassino "respeitar" um pallet de pé (hesitar)
    HESITATE: [0.8, 1.5],
    INTRO: 3,

    // objetivo: 5 de 8 geradores + porta principal
    TEAM_BONUS: 0.8,     // cada pessoa extra no mesmo gerador rende isto
    GEN_RANGE: 1.45, DOOR_RANGE: 2.0, WIN_RANGE: 1.3,
    SKILL_EVERY: [3.5, 7],   // intervalo entre skill checks (s)
    SKILL_DELAY: 0.45,       // tempo até o ponteiro começar a girar
    SKILL_SPEED: 5.2,        // rad/s do ponteiro
    SKILL_ZONE: 0.34,        // meia largura da zona de acerto (rad)
    SKILL_GREAT: 0.12,       // meia largura da zona perfeita
    SKILL_FAIL: 0.10,        // progresso perdido ao errar
    KICK: 0.15,              // progresso que o assassino destrói ao chutar um gerador

    // tempos base (s) das tarefas de rota; multiplicados pela dificuldade (ver createGame)
    ROUTES: { fuse: 20, door: 3, phone: 30, policeEta: 150, policeWindow: 120, carPart: 35, carStart: 10, boatPart: 40, boatStart: 15, leaveWait: 10 },
    SABOTAGE_T: 2.5,         // assassino: tempo para sabotar um veículo (tira a última peça)

    // visão — a MESMA para pessoas e bots (paridade de informação): raio ambiente + cone de lanterna, com linha de vista
    VIS_S: { r: 6, cone: 11, half: 0.55 },      // sobrevivente
    VIS_K: { r: 7.5, cone: 12, half: 0.65 },    // assassino enxerga um pouco mais
    HEAR_ERR: 2.2,       // erro (tiles) na posição de algo que só se OUVE
    KN_MOVE: 6, KN_ACT: 9,   // alcance em que se ouve o assassino: andando / golpe e quebra

    // itens, rádio detector (sobrevivente) e stealth (assassino)
    ITEM_RANGE: 1.25, PICK_T: 0.5,
    RADIO_BATT: 120,                   // segundos de pilha
    DET_R: 24, DET_NEAR: 15, DET_VERY: 9,   // faixas do detector (tiles): longe / perto / muito perto
    STEALTH_SPEED: 0.6, STEALTH_NOISE: 0.25, STEALTH_SEE: 3.5,   // espreita: devagar, 25% do barulho e do alcance do rádio, só visto a 3,5 tiles
    STEALTH_DRAIN: 0.1, STEALTH_REGEN: 0.05, STEALTH_MIN: 0.15,  // energia: ~10 s ligada, ~20 s para recarregar

    // IA do sobrevivente
    AI_FLEE: 14,         // começa a fugir dentro desta distância
    AI_SKILL_ERR: 0.40,  // erro (rad) no skill check: ~85% de acerto

    // percepção do assassino
    TRACK: 2.5,          // segue o rastro por mais tempo depois de perder você
    SEARCH_WAIT: 2.5,
    PATROL_SPEED: 0.88,  // multiplicador de velocidade enquanto patrulha/procura
    NOISE_MOVE: 3.5, NOISE_REPAIR: 9, NOISE_GATE: 8, NOISE_PHONE: 11, NOISE_ENGINE: 16, NOISE_VAULT: 5,
    RESPAWN: 8           // só no TREINO: pallets/janelas voltam
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  const T_WIN = 5, T_WATER = 7, T_VEH = 8;
  // peças dos veículos: o carro leva bateria, chave e combustível; o barco, hélice, chave e combustível
  const PARTS = {
    battery: { veh: 'car', name: 'BATERIA' }, ckey: { veh: 'car', name: 'CHAVE DO CARRO' }, cfuel: { veh: 'car', name: 'COMBUSTÍVEL' },
    prop: { veh: 'boat', name: 'HÉLICE' }, bkey: { veh: 'boat', name: 'CHAVE DO BARCO' }, bfuel: { veh: 'boat', name: 'COMBUSTÍVEL' }
  };

  function createGame(opts) {
    opts = opts || {};
    const rnd = opts.rng || Math.random;
    const sfx = opts.sfx || function () {};
    const training = !!opts.training;
    const role = opts.role === 'killer' ? 'killer' : 'survivor';
    // dificuldade é sempre "para quem joga": o que ela muda depende do papel
    const level = ['easy', 'normal', 'hard'].includes(opts.difficulty) ? opts.difficulty : 'normal';
    const dl = { easy: -1, normal: 0, hard: 1 }[level];
    const diff = {
      level, dl,
      time: role === 'survivor' ? 1 + 0.3 * dl : 1 - 0.25 * dl,   // tempo das tarefas (sobrevivente-jogador: mais longo no difícil)
      bot: role === 'killer' ? 1 + 0.25 * dl : 1,                  // habilidade dos bots sobreviventes (reação, erro, sentidos)
      kp: role === 'survivor' ? 1 + 0.06 * dl : 1                  // força do assassino-IA (velocidade e visão)
    };
    const routeT = (name) => CFG.ROUTES[name] * diff.time;
    const bots = opts.bots === undefined ? 3 : opts.bots;
    const map = DP.buildMap({ kind: opts.map || 'camp', rng: rnd });
    const W = map.W, H = map.H, t = map.t;

    const g = {
      cfg: CFG, map, training, role, diff, fullVision: false,
      time: 0, over: false, overT: 0,
      stats: { lunges: 0, stuns: 0, drops: 0, misses: 0, hits: 0, breaks: 0, vaults: 0, gens: 0, kicks: 0, skillOk: 0, skillFail: 0, cuts: 0, smashes: 0, crashes: 0 },
      pallets: [], windows: [], popups: [], fx: [], survivors: [],
      shake: 0, hitstop: 0, flash: 0,
      near: null, nearList: [], los: false, dist: 99, interact: null, kInteract: null, pInteract: null,
      pings: [], result: null, gensDone: 0, need: map.NEED, gens: [],
      escapedCount: 0, deadCount: 0
    };

    function makeAI(i) {
      return { route: map.vehicles ? ['police', 'car', 'boat', 'police'][i % 4] : 'police', mode: 'repair', target: null, aware: 0, lk: null, thinkT: rnd() * 0.3, plan: null, skill: null, skillAt: 0, wait: 0, noPal: {}, fieldT: 0, fT: new Float32Array(W * H), zoneT: 0, planAge: 0, dx: 0, dy: 0, K: null, est: null, hearT: 0, fetch: null, wary: 0 };
    }
    const nSurv = 1 + bots;
    for (let i = 0; i < nSurv; i++) {
      const sp = map.spawnSurvivors[i % map.spawnSurvivors.length];
      const human = role === 'survivor' && i === 0;
      g.survivors.push({
        id: i, x: sp.x, y: sp.y, face: Math.PI / 2,
        hp: 2, burst: 0, invuln: 0, vault: null, vaultCD: 0, moving: false, walk: 0,
        noise: 0, acting: null, skill: null, skillCD: 4 + i * 1.7, tick: 0,
        dead: false, escaped: false, near: null, interact: null, human, item: null, tool: null, pickP: 0, pickFor: null, det: 0,
        ai: human ? null : makeAI(i), usedWin: 0
      });
    }

    k_init();
    function k_init() {
      g.k = {
        x: map.spawnKiller.x, y: map.spawnKiller.y, face: -Math.PI / 2,
        state: role === 'killer' ? 'chase' : 'intro', t: 0, dur: 0, trip: 0, tripCD: 0, tripDir: 0, ph: 0, vx: 0, vy: 0, ldx: 0, ldy: 0, hitDone: false, pal: null, brkKind: 'pallet', brk: 0,
        moving: false, walk: 0, hesitate: false, vault: null,
        aware: 'patrol', lost: 0, last: null, lastV: null, wait: 0, goal: null, target: null, seenNow: false, genMem: {}, hearT: 0, stealth: false, sneakPrev: false, energy: 1
      };
    }

    const palAt = new Array(W * H).fill(null);
    for (const p of map.pallets) {
      const o = {
        tx: p.tx, ty: p.ty, cx: p.tx + 0.5, cy: p.ty + 0.5, orient: p.orient,
        nx: p.orient === 'h' ? 0 : 1, ny: p.orient === 'h' ? 1 : 0,   // eixo da passagem
        state: 'up', t: 0, dir: { x: 0, y: 0 }, respawn: 0, respect: undefined, hes: 0
      };
      g.pallets.push(o);
      palAt[p.ty * W + p.tx] = o;
    }
    g.palAt = palAt;
    const winAt = new Array(W * H).fill(null);
    for (const w of map.windows) {
      const o = {
        tx: w.tx, ty: w.ty, cx: w.tx + 0.5, cy: w.ty + 0.5, orient: w.orient,
        nx: w.orient === 'h' ? 0 : 1, ny: w.orient === 'h' ? 1 : 0,
        state: 'closed', t: 99, prog: 0, usedT: 0, respawn: 0, smashChecked: -1
      };
      g.windows.push(o);
      winAt[w.ty * W + w.tx] = o;
    }
    g.winAt = winAt;
    g.gens = map.gens.map((o) => ({ tx: o.tx, ty: o.ty, cx: o.tx + 0.5, cy: o.ty + 0.5, progress: 0, done: false, visited: -99, w: 0, known: !map.explore }));
    // pontos de exploração (só no mapa grande): a equipe descobre geradores vendo-os; na arena tudo é conhecido
    g.explore = (map.explore || []).map((e) => ({ x: e.x, y: e.y, kind: e.kind, id: e.id, seen: false }));
    // itens soltos no mapa (rádios). Cada item: { kind, x, y, cx, cy, holder, batt, on }
    g.items = [];
    let itemSeq = 0;
    function spawnItem(kind, x, y, extra) { const it = Object.assign({ id: itemSeq++, kind, x, y, cx: x, cy: y, holder: null, batt: kind === 'radio' ? CFG.RADIO_BATT : 0, on: false }, extra || {}); g.items.push(it); return it; }
    const spots = (map.itemSpots || []).slice();
    if (spots.length && map.radios) {
      for (let i = 0; i < map.radios && spots.length; i++) { const j = (rnd() * spots.length) | 0; const p0 = spots.splice(j, 1)[0]; spawnItem('radio', p0.x, p0.y); }
    }
    g.spawnItem = spawnItem;
    // veículos (só no mapa grande): carro e barco; as peças ficam espalhadas, longe de onde a equipe começa
    g.vehicles = (map.vehicles || []).map((v) => ({
      kind: v.kind, cx: v.cx, cy: v.cy, w: v.w, h: v.h, tx: v.tx, ty: v.ty, range: v.range, stand: v.stand,
      need: Object.keys(PARTS).filter((n) => PARTS[n].veh === v.kind), parts: {}, wp: {}, order: [],
      state: 'build', startP: 0, seated: 0, seats: 2, leaveT: -1, anim: 0, progress: 0, visited: -99, w0: 0, noisyT: -99, pax: []
    }));
    if (g.vehicles.length) {
      const far = (p) => map.spawnSurvivors.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 14);
      for (const v of g.vehicles) for (const name of v.need) {
        const okSpots = spots.filter(far), inside = okSpots.filter((q) => q.inside);
        const pool = inside.length && rnd() < 0.7 ? inside : okSpots.length ? okSpots : spots;       // a maioria nas cabanas
        if (!pool.length) break;
        const p0 = pool[(rnd() * pool.length) | 0];
        spots.splice(spots.indexOf(p0), 1);
        spawnItem('part', p0.x, p0.y, { part: name, veh: v.kind });
      }
    }
    const vehByKind = (kind) => g.vehicles.find((v) => v.kind === kind);
    g.partName = (it) => PARTS[it.part].name + ' (' + (it.veh === 'car' ? 'CARRO' : 'BARCO') + ')';
    // telefone (só no mapa grande): com energia ligada, segurar AGIR liga para a polícia; ela chega depois de um tempo e abre o portão por uma janela
    g.phone = map.phone ? { tx: map.phone.tx, ty: map.phone.ty, cx: map.phone.tx + 0.5, cy: map.phone.ty + 0.5, progress: 0, state: 'locked', visited: -99, w: 0, eta: 0, win: 0, calls: 0, noisyT: -99 } : null;
    g.door = { tx: map.door.tx, ty: map.door.ty, w: map.door.w, cx: map.door.tx + map.door.w / 2, cy: 0.5, progress: 0, powered: false, opened: false, t: 99, visited: -99 };

    const k = g.k;
    let s = g.survivors[0];      // "contexto": o sobrevivente que as funções abaixo estão tratando
    let ai = s.ai;
    const use = (sv) => { s = sv; ai = sv.ai; };
    const alive = (sv) => !sv.dead && !sv.escaped;
    g.s = g.survivors[0];
    Object.defineProperty(g, 'ai', { get() { return g.survivors[0].ai; } });
    g.pl = role === 'killer' ? k : g.survivors[0];       // quem a câmera segue

    const field = new Float32Array(W * H);
    let fieldT = 0, fieldTile = -1;

    // ---------- colisão ----------
    function solid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      const i = ty * W + tx;
      if (t[i]) return true;                       // paredes, caixas, geradores, porta e janelas
      const p = palAt[i];
      return !!(p && p.state === 'down');
    }
    // visão: janelas são de vidro (dá para ver através)
    function blocksSight(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      const i = ty * W + tx;
      if (t[i]) return t[i] !== T_WIN && t[i] !== T_WATER;
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
          if (blocksSight(Math.floor(a.x + ox + ux * l), Math.floor(a.y + oy + uy * l))) return false;
        }
      }
      return true;
    }
    // visão: dentro do raio ambiente, ou dentro do cone da lanterna; sempre com linha de vista
    function canSee(ox, oy, face, killerEye, tx, ty, mult) {
      const V = killerEye ? CFG.VIS_K : CFG.VIS_S, m = mult || 1;
      const d = Math.hypot(tx - ox, ty - oy);
      if (d > V.cone * m) return false;
      if (d > V.r * m && Math.abs(angDiff(Math.atan2(ty - oy, tx - ox), face)) > V.half) return false;
      return hasLOS({ x: ox, y: oy }, { x: tx, y: ty });
    }
    // até onde um raio de visão chega a partir de (x,y) (usado para desenhar a névoa)
    function castRay(x, y, ang, maxLen) {
      const ux = Math.cos(ang), uy = Math.sin(ang);
      for (let l = 0; l < maxLen; l += 0.2) if (blocksSight(Math.floor(x + ux * l), Math.floor(y + uy * l))) return Math.max(0, l - 0.1);
      return maxLen;
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

    // ---------- caminhos (Dijkstra) ----------
    // sMode=true: sobrevivente (pula pallets e janelas); false: assassino (quebra pallets, vaulta janelas abertas)
    let winPass = 0;     // IA do sobrevivente: 1 = aceita atravessar janela fechada (abrindo ou quebrando)
    function hardBlocked(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H || t[ty * W + tx] !== 0; }
    function blockedFor(tx, ty, sMode) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
      const v = t[ty * W + tx];
      if (v === 0) return false;
      if (v === T_WIN) {
        const w = winAt[ty * W + tx];
        return sMode ? (w.state === 'closed' && !winPass) : w.state === 'closed';
      }
      return true;
    }
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    function costAt(i, sMode) {
      const w = winAt[i];
      if (w) {
        if (sMode) return w.state === 'open' ? 2 : w.state === 'broken' ? 5 : 6;
        return 4;
      }
      const p = palAt[i];
      if (!p) return 0;
      if (sMode) return p.state === 'down' ? 1.4 : p.state === 'falling' ? 3 : 0;
      return p.state === 'down' ? CFG.BREAK_COST : p.state === 'up' ? 0.3 : 0;
    }
    // fila de prioridade em arrays tipados (reaproveitados): o mapa grande chama isto várias vezes por segundo
    const HEAP_N = W * H * 4;
    const heapI = new Int32Array(HEAP_N), heapK = new Float32Array(HEAP_N);
    let heapLen = 0;
    function hpush(i, key) {
      if (heapLen >= HEAP_N) return;
      let n = heapLen++;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heapK[p] <= key) break;
        heapK[n] = heapK[p]; heapI[n] = heapI[p]; n = p;
      }
      heapK[n] = key; heapI[n] = i;
    }
    function hpop() {
      const top = heapI[0], lastI = heapI[--heapLen], lastK = heapK[heapLen];
      if (heapLen) {
        let n = 0;
        for (;;) {
          const l = 2 * n + 1;
          if (l >= heapLen) break;
          const r = l + 1, m = r < heapLen && heapK[r] < heapK[l] ? r : l;
          if (heapK[m] >= lastK) break;
          heapK[n] = heapK[m]; heapI[n] = heapI[m]; n = m;
        }
        heapK[n] = lastK; heapI[n] = lastI;
      }
      return top;
    }
    // opt.until = {x,y}: para quando esse ponto já está resolvido (+ opt.margin); opt.limit: custo máximo
    // (o que ficar fora disso continua 1e9). Quem só precisa do vizinho certo para andar não paga o mapa todo.
    function dijkstra(arr, gx, gy, sMode, opt) {
      arr.fill(1e9);
      const sx = clamp(Math.floor(gx), 0, W - 1), sy = clamp(Math.floor(gy), 0, H - 1);
      const limit = opt && opt.limit !== undefined ? opt.limit : 1e9;
      const uI = opt && opt.until ? clamp(Math.floor(opt.until.y), 0, H - 1) * W + clamp(Math.floor(opt.until.x), 0, W - 1) : -1;
      const margin = opt && opt.margin !== undefined ? opt.margin : 4;
      heapLen = 0;
      arr[sy * W + sx] = 0; hpush(sy * W + sx, 0);
      while (heapLen) {
        const key = heapK[0], i = hpop(), cd = arr[i];
        if (key > cd) continue;                                  // entrada velha da fila
        if (cd > limit) break;
        if (uI >= 0 && arr[uI] < 1e8 && cd > arr[uI] + margin) break;
        const ux = i % W, uy = (i / W) | 0;
        const ci = costAt(i, sMode);
        for (const d of DIRS) {
          const vx = ux + d[0], vy = uy + d[1];
          if (blockedFor(vx, vy, sMode)) continue;
          const diag = d[0] !== 0 && d[1] !== 0;
          if (diag && (hardBlocked(ux + d[0], uy) || hardBlocked(ux, uy + d[1]))) continue;
          const j = vy * W + vx;
          const nd = cd + (diag ? 1.414 : 1) + ci;
          if (nd < arr[j]) { arr[j] = nd; hpush(j, nd); }
        }
      }
    }
    // melhor tile vizinho de e seguindo o campo arr
    function bestNb(arr, e, sMode) {
      const kx = Math.floor(e.x), ky = Math.floor(e.y);
      let best = null, bv = 1e9;
      for (const d of DIRS) {
        const nx = kx + d[0], ny = ky + d[1];
        if (blockedFor(nx, ny, sMode)) continue;
        const diag = d[0] !== 0 && d[1] !== 0;
        if (diag && (solid(kx + d[0], ky) || solid(kx, ky + d[1]))) continue;
        const j = ny * W + nx;
        const v = arr[j] + (diag ? 1.414 : 1) + costAt(j, sMode);
        if (v < bv) {
          bv = v;
          best = { x: nx, y: ny, pal: palAt[j] && palAt[j].state === 'down' ? palAt[j] : null, win: winAt[j] || null };
        }
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
    const GLASS = ['#d6f2ff', '#9bd3f0', '#6fb4dc', '#ffffff'];
    function glass(x, y, n, dirx, diry) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = 1 + rnd() * 3;
        g.fx.push({ x, y, vx: Math.cos(a) * sp + (dirx || 0) * 2, vy: Math.sin(a) * sp + (diry || 0) * 2, t: 0, life: 0.45 + rnd() * 0.5, c: GLASS[(rnd() * GLASS.length) | 0] });
      }
    }
    const pan = (x) => clamp((x - g.pl.x) / 10, -0.8, 0.8);

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
        k.state = 'stun'; k.t = 0; k.pal = null; k.vault = null; k.aware = 'hunt'; k.lost = 0;
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
      const ents = g.survivors.filter((v) => alive(v)).concat([k]);
      for (const e of ents) {
        const isK = e === k, r = isK ? CFG.R_K : CFG.R_S;
        const dxr = e.x - clamp(e.x, p.tx, p.tx + 1), dyr = e.y - clamp(e.y, p.ty, p.ty + 1);
        if (dxr * dxr + dyr * dyr >= r * r) continue;
        let side = (e.x - p.cx) * p.nx + (e.y - p.cy) * p.ny;
        if (Math.abs(side) < 0.05) side = (isK ? 1 : -1) * (p.dir.x * p.nx + p.dir.y * p.ny);
        const sg = side >= 0 ? 1 : -1;
        if (p.nx) e.x = p.cx + sg * (0.5 + r + 0.03); else e.y = p.cy + sg * (0.5 + r + 0.03);
      }
    }

    // ---------- janelas ----------
    function breakWindow(w, byKiller) {
      w.state = 'broken'; w.t = 0; w.respawn = CFG.RESPAWN + 4;
      glass(w.cx, w.cy, 22, w.nx, w.ny);
      sfx('glass', pan(w.cx));
      g.shake = Math.max(g.shake, 3);
      if (byKiller) { g.stats.smashes++; }
    }
    function openWindow(w) {
      w.state = 'open'; w.t = 0; w.prog = 0;
      sfx('winOpen', pan(w.cx));
    }
    // corte de vidro: perde 1 de vida (nunca mata), grita e denuncia onde está
    function cutSurvivor() {
      g.stats.cuts++;
      sfx('cut', pan(s.x));
      g.flash = Math.max(g.flash, 0.12);
      if (!training && s.hp > 1) s.hp--;
      popup('SE CORTOU!', s.x, s.y - 1.5, '#ff4d4d');
      s.invuln = Math.max(s.invuln, 0.3);
      alert(s.x, s.y);
    }

    // ---------- sobrevivente: dano, fim de partida ----------
    function over(result) {
      if (g.over) return;
      g.over = true; g.overT = 0; g.result = result;
      const win = role === 'killer' ? result === 'dead' : result === 'escaped';
      sfx(win ? 'escape' : 'death');
    }
    function checkEnd() {
      if (g.over) return;
      const h = role === 'survivor' ? g.survivors[0] : null;
      if (h && h.dead) return over('dead');
      if (h && h.escaped) return over('escaped');
      if (g.survivors.every((v) => !alive(v))) {
        // assassino vence se menos da metade escapou
        over(g.escapedCount * 2 < g.survivors.length ? 'dead' : 'escaped');
      }
    }
    function escapeSurvivor(sv) {
      if (!alive(sv)) return;
      sv.escaped = true; sv.vault = null; g.escapedCount++;
      popup('ESCAPOU!', sv.x, sv.y - 1.4, '#7dffa0');
      sfx('escape');
      checkEnd();
    }
    function killSurvivor(sv) {
      sv.dead = true; sv.vault = null; g.deadCount++;
      popup('ABATIDO!', sv.x, sv.y - 1.4, '#ff4d4d');
      checkEnd();
    }
    function hurt() {
      g.stats.hits++;
      s.invuln = 0.7; s.burst = CFG.BURST_T;
      g.shake = 6; g.flash = 0.3;
      sfx('hit', pan(s.x));
      popup(role === 'killer' ? 'ACERTOU!' : '-1', s.x, s.y - 1.4, role === 'killer' ? '#ffd23f' : '#ff4d4d');
      k.aware = 'hunt'; k.lost = 0;
      if (training) return;
      s.hp--;
      if (s.hp <= 0) killSurvivor(s);
    }

    // ---------- geradores, skill check, porta ----------
    function alert(x, y) {
      g.pings.push({ x, y, t: g.time });
      if (k.state === 'intro' || role === 'killer') return;
      k.last = { x: x + (rnd() - 0.5) * CFG.HEAR_ERR, y: y + (rnd() - 0.5) * CFG.HEAR_ERR }; k.lastV = { x: 0, y: 0 };
      if (k.aware !== 'hunt') { k.aware = 'search'; k.wait = 0; }
    }
    function findInteract() {
      let best = null, bd = 1e9;
      for (const o of g.gens) {
        if (o.done) continue;
        const d = Math.hypot(s.x - o.cx, s.y - o.cy);
        if (d < CFG.GEN_RANGE && d < bd) { bd = d; best = { type: 'gen', obj: o }; }
      }
      const ph = g.phone;
      if (ph && ph.state === 'ready') {
        const d = Math.hypot(s.x - ph.cx, s.y - ph.cy);
        if (d < CFG.GEN_RANGE && d < bd) { bd = d; best = { type: 'phone', obj: ph }; }
      }
      const dr = g.door;
      if (dr.powered && !dr.opened && !g.phone) {
        const d = Math.hypot(s.x - dr.cx, s.y - dr.cy);
        if (d < CFG.DOOR_RANGE && d < bd) { bd = d; best = { type: 'door', obj: dr }; }
      }
      for (const w of g.windows) {
        if (w.state !== 'closed') continue;
        const d = Math.hypot(s.x - w.cx, s.y - w.cy);
        if (d < CFG.WIN_RANGE && d < bd) { bd = d; best = { type: 'window', obj: w }; }
      }
      for (const v of g.vehicles) {
        const d = Math.hypot(s.x - v.cx, s.y - v.cy);
        if (d > v.range || d >= bd) continue;
        if (v.state === 'build' && s.item && s.item.veh === v.kind && !v.parts[s.item.part]) { bd = d; best = { type: 'install', obj: v }; }
        else if (v.state === 'ready') { bd = d; best = { type: 'start', obj: v }; }
        else if (v.state === 'started' && v.seated < v.seats) { bd = d; best = { type: 'board', obj: v }; }
      }
      for (const it of g.items) {
        if (it.holder || (it.kind === 'radio' && s.tool) || (it.kind === 'part' && s.item)) continue;
        const d = Math.hypot(s.x - it.x, s.y - it.y);
        if (d < CFG.ITEM_RANGE && d < bd) { bd = d; best = { type: 'item', obj: it }; }
      }
      return best;
    }
    function dropItem(sv, it) {
      if (!it) return;
      it.holder = null; it.x = it.cx = sv.x; it.y = it.cy = sv.y;
      if (sv.tool === it) { sv.tool = null; it.on = false; }
      if (sv.item === it) sv.item = null;
    }
    function pickUp(it) {
      if (it.kind === 'radio') { if (s.tool) return; s.tool = it; }
      else { if (s.item) dropItem(s, s.item); s.item = it; }
      it.holder = s;
      sfx('pick', pan(s.x));
      if (s.human) popup(it.kind === 'radio' ? 'RÁDIO! (Q LIGA/DESLIGA)' : it.kind === 'part' ? PARTS[it.part].name + ' (' + (it.veh === 'car' ? 'CARRO' : 'BARCO') + ')' : 'PEGOU', s.x, s.y - 1.5, '#9bd3f0');
    }
    function startSkill() { s.skill = { t: 0, tz: 1.5 + rnd() * 3.6 }; if (s.human) sfx('skill'); }
    function endSkill(result) {
      const o = s.acting && s.acting.obj;
      if (result === 'fail' || result === 'miss') {
        g.stats.skillFail++;
        if (o) o.progress = Math.max(0, o.progress - CFG.SKILL_FAIL);
        g.shake = Math.max(g.shake, 5); g.flash = Math.max(g.flash, 0.12);
        sfx('bang', pan(s.x));
        popup(role === 'killer' ? 'ALGO EXPLODIU!' : 'FALHOU!', s.x, s.y - 1.5, '#ff4d4d');
        alert(s.x, s.y);
      } else {
        g.stats.skillOk++;
        const great = result === 'great';
        if (o) o.progress = Math.min(1, o.progress + (great ? 0.05 : 0.025));
        if (s.human) sfx('skillok');
        if (s.human) popup(great ? 'PERFEITO!' : 'BOM', s.x, s.y - 1.5, great ? '#7dffa0' : '#cfe8ff');
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
      if (g.gensDone >= g.need && !g.door.powered) {
        g.door.powered = true;
        if (g.phone) { g.phone.state = 'ready'; popup('ENERGIA LIGADA! USE O TELEFONE', g.phone.cx, g.phone.cy - 2.2, '#ffd23f'); sfx('gates'); }
        else { popup('PORTA PRINCIPAL LIBERADA!', g.door.cx, 3, '#ffd23f'); sfx('gates'); }
      }
    }
    // entrar no veículo = escapar (quem entrou já não pode ser alcançado); ele parte depois de um tempo ou quando lota
    function boardVehicle(v, sv) {
      if (!alive(sv) || v.seated >= v.seats) return;
      v.seated++; v.pax.push(sv.id);
      if (sv.item) { g.items.splice(g.items.indexOf(sv.item), 1); sv.item = null; }
      sv.escaped = true; sv.vault = null; g.escapedCount++;
      popup('A BORDO!', sv.x, sv.y - 1.4, '#7dffa0'); sfx('escape');
      if (v.leaveT < 0) v.leaveT = CFG.ROUTES.leaveWait;
      if (v.seated >= v.seats) v.leaveT = Math.min(v.leaveT, 1.2);
      checkEnd();
    }
    function sabotageable(v) { return (v.state === 'build' && v.order.length > 0) || v.state === 'ready' || (v.state === 'started' && v.seated === 0); }
    function sabotageVehicle(v) {
      if (!sabotageable(v)) return;
      const pt = v.order.pop();
      if (!pt) return;
      v.parts[pt] = false; v.state = 'build'; v.startP = 0; v.leaveT = -1;
      let x = v.cx, y = v.cy + v.h / 2 + 1.2;
      for (let a = 0; a < 16; a++) { const px0 = v.cx + Math.cos(a * 0.7) * (v.w / 2 + 1.4), py0 = v.cy + Math.sin(a * 0.7) * (v.h / 2 + 1.4); if (!hitsCircle(px0, py0, 0.3) && t[Math.floor(py0) * W + Math.floor(px0)] !== T_WATER) { x = px0; y = py0; break; } }
      spawnItem('part', x, y, { part: pt, veh: v.kind });
      sfx('bang', pan(v.cx)); g.shake = Math.max(g.shake, 3);
      popup('SABOTADO!', v.cx, v.cy - 2.4, '#ff4d4d');
    }
    function vehicleTick(dt) {
      for (const v of g.vehicles) {
        if (v.state === 'started' && v.seated > 0) {
          v.leaveT -= dt;
          if (v.leaveT <= 0) {
            v.state = 'leaving'; v.anim = 0;
            if (v.kind === 'car') {
              for (let yy = 0; yy < v.h; yy++) for (let xx = 0; xx < v.w; xx++) if (t[(v.ty + yy) * W + v.tx + xx] === T_VEH) t[(v.ty + yy) * W + v.tx + xx] = 0;
              g.door.pass = true; g.door.t = 0; sfx('doorOpen');
            }
            sfx('engine', pan(v.cx));
          }
        } else if (v.state === 'leaving') {
          v.anim += dt;
          if (v.anim >= (v.kind === 'car' ? 5 : 6.5)) { v.state = 'gone'; if (v.kind === 'car') g.door.pass = false; }
        }
      }
    }
    function callPolice(ph) {
      ph.state = 'coming'; ph.eta = CFG.ROUTES.policeEta; ph.calls++;
      for (const v of g.survivors) if (v.acting && v.acting.obj === ph) v.acting = null;
      popup('A POLÍCIA FOI CHAMADA!', ph.cx, ph.cy - 2.2, '#7ad0ff');
      sfx('siren', pan(ph.cx)); g.shake = Math.max(g.shake, 2);
      alert(ph.cx, ph.cy);
    }
    function policeTick(dt) {
      const ph = g.phone;
      if (!ph) return;
      if (ph.state === 'coming') {
        ph.eta -= dt;
        if (ph.eta <= 0) {
          ph.state = 'here'; ph.win = CFG.ROUTES.policeWindow;
          g.door.opened = true; g.door.t = 0; sfx('doorOpen'); sfx('siren');
          popup('A POLÍCIA CHEGOU! CORRA PARA O PORTÃO', g.door.cx, 4, '#7ad0ff');
        }
      } else if (ph.state === 'here') {
        ph.win -= dt;
        if (ph.win <= 0) {
          ph.state = 'ready'; ph.progress = 0; g.door.opened = false; g.door.t = 0;
          popup('A POLÍCIA FOI EMBORA... LIGUE DE NOVO', g.door.cx, 4, '#ff9d5c');
        }
      }
    }
    function act(dt) {
      const tg = s.acting, o = tg.obj;
      s.tick -= dt;
      if (tg.type === 'gen') {
        s.noise = CFG.NOISE_REPAIR; o.noisyT = g.time;
        o.progress = Math.min(1, o.progress + dt / routeT('fuse') * (o.w === 0 ? 1 : CFG.TEAM_BONUS));
        o.w++;
        if (s.tick <= 0) { s.tick = 0.55; if (s.human || Math.hypot(o.cx - g.pl.x, o.cy - g.pl.y) < 12) sfx('repair', pan(o.cx)); }
        if (o.progress >= 1) finishGen(o);
      } else if (tg.type === 'phone') {
        s.noise = CFG.NOISE_PHONE; o.noisyT = g.time;
        o.progress = Math.min(1, o.progress + dt / routeT('phone') * (o.w === 0 ? 1 : CFG.TEAM_BONUS));
        o.w++;
        if (s.tick <= 0) { s.tick = 0.5; sfx('click', pan(o.cx)); }
        if (o.progress >= 1) callPolice(o);
      } else if (tg.type === 'install') {
        const pt = s.item.part;
        s.noise = CFG.NOISE_REPAIR; o.noisyT = g.time;
        o.wp[pt] = (o.wp[pt] || 0) + dt / routeT(o.kind + 'Part') * (o.w0 === 0 ? 1 : CFG.TEAM_BONUS);
        o.w0++;
        if (s.tick <= 0) { s.tick = 0.55; sfx('repair', pan(o.cx)); }
        if (o.wp[pt] >= 1) {
          o.parts[pt] = true; o.order.push(pt); o.wp[pt] = 0;
          g.items.splice(g.items.indexOf(s.item), 1); s.item = null; s.acting = null;
          sfx('genDone', pan(o.cx)); popup(PARTS[pt].name + ' INSTALADA!', o.cx, o.cy - 2.2, '#7dffa0');
          alert(o.cx, o.cy);
          if (o.need.every((n) => o.parts[n])) { o.state = 'ready'; popup(o.kind === 'car' ? 'CARRO PRONTO! LIGUE O MOTOR' : 'BARCO PRONTO! EMPURRE-O PARA A ÁGUA', o.cx, o.cy - 3.4, '#ffd23f'); }
        }
      } else if (tg.type === 'start') {
        s.noise = CFG.NOISE_ENGINE; o.noisyT = g.time;
        o.startP = Math.min(1, o.startP + dt / routeT(o.kind + 'Start') * (o.w0 === 0 ? 1 : CFG.TEAM_BONUS));
        o.w0++;
        if (s.tick <= 0) { s.tick = 0.45; sfx(o.kind === 'car' ? 'engine' : 'repair', pan(o.cx)); }
        if (o.startP >= 1) {
          o.state = 'started'; o.leaveT = -1; s.acting = null;
          sfx('engine', pan(o.cx)); alert(o.cx, o.cy); g.shake = Math.max(g.shake, 2);
          popup(o.kind === 'car' ? 'MOTOR LIGADO! ENTRE NO CARRO' : 'BARCO NA ÁGUA! ENTRE NO BARCO', o.cx, o.cy - 3.4, '#7dffa0');
        }
      } else if (tg.type === 'board') {
        s.noise = 2;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / 0.9;
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; boardVehicle(o, s); }
      } else if (tg.type === 'door') {
        s.noise = CFG.NOISE_GATE;
        o.progress = Math.min(1, o.progress + dt / routeT('door'));
        if (s.tick <= 0) { s.tick = 0.4; sfx('repair', pan(o.cx)); }
        if (o.progress >= 1) { o.opened = true; o.t = 0; sfx('doorOpen'); popup('PORTA ABERTA!', o.cx, 3, '#7dffa0'); }
      } else if (tg.type === 'item') {
        s.noise = 1;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / CFG.PICK_T;
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; pickUp(o); }
      } else {                                     // janela: abre sem barulho
        s.noise = 0.8;
        o.prog += dt / CFG.WIN_OPEN_T;
        if (o.prog >= 1) openWindow(o);
      }
    }

    // ---------- pular: pallet caído e janelas ----------
    function startVault(v) {
      s.vault = v;
      g.stats.vaults++;
      sfx(v.kind === 'crash' ? 'glass' : 'vault', pan(s.x));
    }
    function tryVault(ax, ay, len, walkMode) {
      // pallet caído
      for (const p of g.pallets) {
        if (p.state !== 'down') continue;
        const rx = s.x - p.cx, ry = s.y - p.cy;
        const along = rx * p.nx + ry * p.ny;
        const lat = -rx * p.ny + ry * p.nx;
        if (Math.abs(along) > 1.0 || Math.abs(along) < 0.3 || Math.abs(lat) > 0.55) continue;
        const away = along > 0 ? -1 : 1;
        if ((ax * p.nx + ay * p.ny) * away < 0.5 * Math.min(1, len)) continue;
        const x1 = p.nx ? p.cx + p.nx * away * 0.95 : s.x;
        const y1 = p.ny ? p.cy + p.ny * away * 0.95 : s.y;
        if (hitsCircle(x1, y1, CFG.R_S)) continue;
        startVault({ t: 0, dur: CFG.VAULT_T, x0: s.x, y0: s.y, x1, y1, kind: 'pallet', win: null });
        return;
      }
      // janelas
      for (const w of g.windows) {
        const rx = s.x - w.cx, ry = s.y - w.cy;
        const along = rx * w.nx + ry * w.ny;
        const lat = -rx * w.ny + ry * w.nx;
        if (Math.abs(along) > 1.05 || Math.abs(along) < 0.3 || Math.abs(lat) > 0.55) continue;
        const away = along > 0 ? -1 : 1;
        if ((ax * w.nx + ay * w.ny) * away < 0.5 * Math.min(1, len)) continue;
        const x1 = w.nx ? w.cx + w.nx * away * 0.95 : s.x;
        const y1 = w.ny ? w.cy + w.ny * away * 0.95 : s.y;
        if (hitsCircle(x1, y1, CFG.R_S)) continue;
        let kind;
        if (w.state === 'closed') { if (walkMode) continue; kind = 'crash'; }   // andando: precisa abrir (AGIR)
        else kind = walkMode ? 'walk' : 'run';
        const dur = kind === 'crash' ? CFG.VAULT_CRASH : kind === 'walk' ? CFG.VAULT_WALK : CFG.VAULT_RUN;
        startVault({ t: 0, dur, x0: s.x, y0: s.y, x1, y1, kind, win: w, did: false, dx: -away * w.nx, dy: -away * w.ny });
        return;
      }
    }
    function advanceVault(dt) {
      const v = s.vault;
      v.t += dt;
      const p = Math.min(1, v.t / v.dur);
      s.x = v.x0 + (v.x1 - v.x0) * p; s.y = v.y0 + (v.y1 - v.y0) * p;
      s.moving = true; s.walk += dt * (v.kind === 'walk' ? 6 : 14);
      s.noise = v.kind === 'crash' ? CFG.NOISE_CRASH : v.kind === 'walk' ? CFG.NOISE_WALK : CFG.NOISE_VAULT;
      if (v.win && !v.did) {
        if (v.kind === 'crash' && p >= 0.3) { v.did = true; g.stats.crashes++; breakWindow(v.win, false); cutSurvivor(); }
        else if (v.kind !== 'crash' && v.win.state === 'broken' && p >= 0.5) { v.did = true; cutSurvivor(); }
      }
      if (p >= 1) { s.vault = null; s.vaultCD = 0.15; if (v.win) v.win.usedT = g.time; }
    }

    function updateSurvivor(dt, inp) {
      s.noise = 0; s.acting = null;
      if (!s.vault) unstick(s, CFG.R_S);
      s.invuln = Math.max(0, s.invuln - dt);
      s.burst = Math.max(0, s.burst - dt);
      s.vaultCD = Math.max(0, s.vaultCD - dt);
      if (s.vault) { advanceVault(dt); return; }
      let ax = inp.ax || 0, ay = inp.ay || 0;
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      s.moving = len > 0.12;
      const walkMode = !!inp.walk;
      if (inp.act && !s.moving && s.interact) {
        s.acting = s.interact; s.walk = 0;
        s.face = Math.atan2(s.interact.obj.cy - s.y, s.interact.obj.cx - s.x);
        act(dt);
        return;
      }
      if (s.moving) {
        s.noise = walkMode ? CFG.NOISE_WALK : CFG.NOISE_MOVE;
        const sp = CFG.RUN * (s.burst > 0 ? CFG.BURST : 1) * (walkMode ? CFG.WALK : 1);
        moveBy(s, ax * sp * dt, ay * sp * dt, CFG.R_S);
        s.face = Math.atan2(ay, ax);
        s.walk += dt * (walkMode ? 7 : 11);
        if (!s.vaultCD) tryVault(ax, ay, len, walkMode);
      } else { s.walk = 0; }
      // porta principal aberta: quem chega nela escapa
      if (g.door.opened && s.y < 1.7 && Math.abs(s.x - g.door.cx) < 2.2) escapeSurvivor(s);
    }

    // ---------- assassino ----------
    function kickGen(o) {
      o.progress = Math.max(0, o.progress - CFG.KICK); g.stats.kicks++;
      sfx('bang', pan(k.x)); g.shake = Math.max(g.shake, 2);
      popup('REGREDIU', o.cx, o.cy - 1.2, '#ff7a59');
      k.state = 'recover'; k.t = 0; k.dur = 1.0;
    }
    function startBreak(o, kind) {
      k.state = 'break'; k.t = 0; k.pal = o; k.brk = 0; k.brkKind = kind || 'pallet';
      k.face = Math.atan2(o.cy - k.y, o.cx - k.x);
    }
    function startKVault(w) {
      const rx = k.x - w.cx, ry = k.y - w.cy;
      const along = rx * w.nx + ry * w.ny, away = along > 0 ? -1 : 1;
      const x1 = w.nx ? w.cx + w.nx * away * 0.95 : k.x, y1 = w.ny ? w.cy + w.ny * away * 0.95 : k.y;
      if (hitsCircle(x1, y1, CFG.R_K)) return false;
      k.state = 'kvault'; k.t = 0;
      k.vault = { dur: CFG.VAULT_K, x0: k.x, y0: k.y, x1, y1, win: w, dx: -away * w.nx, dy: -away * w.ny };
      k.face = Math.atan2(y1 - k.y, x1 - k.x);
      sfx('vault', pan(k.x));
      return true;
    }
    function tryKillerVault(ax, ay, len) {
      for (const w of g.windows) {
        if (w.state === 'closed') continue;
        const rx = k.x - w.cx, ry = k.y - w.cy;
        const along = rx * w.nx + ry * w.ny, lat = -rx * w.ny + ry * w.nx;
        if (Math.abs(along) > 1.1 || Math.abs(along) < 0.3 || Math.abs(lat) > 0.6) continue;
        const away = along > 0 ? -1 : 1;
        if ((ax * w.nx + ay * w.ny) * away < 0.5 * Math.min(1, len)) continue;
        if (startKVault(w)) return true;
      }
      return false;
    }
    function findKillerInteract() {
      let best = null, bd = 1e9;
      for (const p of g.pallets) {
        if (p.state !== 'down') continue;
        const d = Math.hypot(k.x - p.cx, k.y - p.cy);
        if (d < 1.25 && d < bd) { bd = d; best = { type: 'break', obj: p }; }
      }
      for (const w of g.windows) {
        if (w.state === 'broken') continue;
        const d = Math.hypot(k.x - w.cx, k.y - w.cy);
        if (d < 1.35 && d < bd) { bd = d; best = { type: 'smash', obj: w }; }
      }
      if (best) return best;
      for (const o of g.phone && g.phone.state === 'ready' ? g.gens.concat([g.phone]) : g.gens) {
        if (o.done || o.progress <= 0) continue;
        const d = Math.hypot(k.x - o.cx, k.y - o.cy);
        if (d < 1.7 && d < bd) { bd = d; best = { type: 'kick', obj: o }; }
      }
      for (const v of g.vehicles) {
        if (!sabotageable(v)) continue;
        const d = Math.hypot(k.x - v.cx, k.y - v.cy);
        if (d < v.range && d < bd) { bd = d; best = { type: 'sabotage', obj: v }; }
      }
      return best;
    }
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    function nearestAlive(e) {
      let best = null, bd = 1e9;
      for (const v of g.survivors) {
        if (!alive(v)) continue;
        const d = Math.hypot(v.x - e.x, v.y - e.y);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    }

    // controle do jogador quando ele é o assassino
    function playerKiller(dt, inp, dx, dy, d) {
      let ax = inp.ax || 0, ay = inp.ay || 0;
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      // espreita (segurar): vale andando ou parado (se esconder), e gasta energia
      const sneak = !inp.drop && !!inp.stealth && (k.energy > (k.sneakPrev ? 0.02 : CFG.STEALTH_MIN));
      if (sneak) { k.stealth = true; k.energy = Math.max(0, k.energy - (CFG.STEALTH_DRAIN + CFG.STEALTH_REGEN) * dt); }
      if (len > 0.12) {
        const ox = k.x, oy = k.y;
        moveBy(k, ax * CFG.K_SPEED_P * (sneak ? CFG.STEALTH_SPEED : 1) * dt, ay * CFG.K_SPEED_P * (sneak ? CFG.STEALTH_SPEED : 1) * dt, CFG.R_K);
        k.face = Math.atan2(ay, ax);
        if (Math.hypot(k.x - ox, k.y - oy) > 0.0005) { k.moving = true; k.walk += dt * 11; }
        if (tryKillerVault(ax, ay, len)) return;
      }
      if (inp.drop) {                                  // ATACAR (com um pouco de mira assistida); sair da espreita custa energia
        if (k.sneakPrev) k.energy = Math.max(0, k.energy - 0.15);
        let lx = Math.cos(k.face), ly = Math.sin(k.face);
        if (s && d < CFG.AIM_RANGE && hasLOS(k, s) && Math.abs(angDiff(Math.atan2(dy, dx), k.face)) < CFG.AIM_CONE) { lx = dx / (d || 1); ly = dy / (d || 1); }
        k.ldx = lx; k.ldy = ly; k.face = Math.atan2(ly, lx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x));
        return;
      }
      if (inp.actPress && g.kInteract) {
        const it = g.kInteract;
        if (it.type === 'break') startBreak(it.obj, 'pallet');
        else if (it.type === 'smash') startBreak(it.obj, 'window');
        else if (it.type === 'sabotage') startBreak(it.obj, 'sabotage');
        else kickGen(it.obj);
      }
    }

    // tropeço: depois do atordoamento ele cambaleia, desvia do rumo e cai de vez em quando
    function doStumble(dt, inp) {
      k.t += dt;
      const f = Math.max(0, 1 - k.t / CFG.STUMBLE_T);
      let hx, hy;
      if (role === 'killer') { hx = inp.ax || 0; hy = inp.ay || 0; }
      else { const tg = k.last || nearestAlive(k) || k; hx = tg.x - k.x; hy = tg.y - k.y; }
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
      k.moving = false;
      k.sneakPrev = k.stealth; k.stealth = false;                       // o stealth é recalculado a cada quadro
      k.energy = Math.min(1, k.energy + CFG.STEALTH_REGEN * dt);
      // quem o assassino está olhando agora: o alvo atual, senão o mais próximo
      let tgt = (k.target && alive(k.target)) ? k.target : nearestAlive(k);
      if (tgt) use(tgt);
      const dx = tgt ? s.x - k.x : 0, dy = tgt ? s.y - k.y : 0, d = tgt ? Math.hypot(dx, dy) : 99;

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
      if (k.state === 'kvault') {
        k.t += dt;
        const v = k.vault, p = Math.min(1, k.t / v.dur);
        k.x = v.x0 + (v.x1 - v.x0) * p; k.y = v.y0 + (v.y1 - v.y0) * p;
        k.moving = true; k.walk += dt * 8;
        if (p >= 1) { k.state = 'chase'; k.t = 0; k.vault = null; v.win.usedT = g.time; }
        return;
      }
      const P = role === 'killer';                        // assassino de pessoa: números mais generosos
      if (k.state === 'windup') {
        k.t += dt;
        if (k.t >= (P ? CFG.WINDUP_P : CFG.WINDUP)) { k.state = 'lunge'; k.t = 0; k.hitDone = false; g.stats.lunges++; sfx('lunge', pan(k.x)); }
        return;
      }
      if (k.state === 'lunge') {
        k.t += dt;
        if (P) {                                          // o bote "puxa" um pouco para o alvo mais perto da mira
          const tv = nearestAlive(k);
          if (tv) {
            const ddx = tv.x - k.x, ddy = tv.y - k.y;
            if (Math.hypot(ddx, ddy) < 3.2) {
              const cur = Math.atan2(k.ldy, k.ldx), diff = angDiff(Math.atan2(ddy, ddx), cur);
              if (Math.abs(diff) < 0.9) { const na = cur + clamp(diff, -CFG.HOMING * dt, CFG.HOMING * dt); k.ldx = Math.cos(na); k.ldy = Math.sin(na); }
            }
          }
        }
        const lsp = P ? CFG.K_LUNGE_P : CFG.K_LUNGE;
        moveBy(k, k.ldx * lsp * dt, k.ldy * lsp * dt, CFG.R_K);
        k.moving = true; k.walk += dt * 16;
        if (!k.hitDone) {
          for (const v of g.survivors) {
            if (!alive(v) || v.invuln > 0 || Math.hypot(v.x - k.x, v.y - k.y) >= (P ? CFG.HIT_R_P : CFG.HIT_R)) continue;
            use(v); k.hitDone = true; hurt(); break;
          }
        }
        if (k.t >= CFG.LUNGE_T) {
          k.state = 'recover'; k.t = 0;
          k.dur = k.hitDone ? (P ? CFG.RECOVER_HIT_P : CFG.RECOVER_HIT) : (P ? CFG.RECOVER_MISS_P : CFG.RECOVER_MISS);
        }
        return;
      }
      if (k.state === 'break') {
        if (role === 'killer' && Math.hypot(inp.ax || 0, inp.ay || 0) > 0.6 && k.t > 0.3) { k.state = 'chase'; k.t = 0; k.pal = null; return; }
        k.t += dt;
        const o = k.pal, isWin = k.brkKind === 'window', isSab = k.brkKind === 'sabotage';
        if (isSab && !sabotageable(o)) { k.pal = null; k.state = 'chase'; k.t = 0; return; }       // alguém embarcou / já foi sabotado
        if (Math.floor(k.t / 0.5) > k.brk) {
          k.brk++; sfx(isWin ? 'glassHit' : 'breakHit', pan(k.x)); g.shake = Math.max(g.shake, 1.5);
          if (isWin) glass(o.cx, o.cy, 3, 0, 0);
        }
        if (k.t >= (isWin ? CFG.WIN_BREAK_T : isSab ? CFG.SABOTAGE_T : CFG.BREAK_T)) {
          if (isSab) sabotageVehicle(o);
          else if (isWin) { breakWindow(o, true); popup('QUEBROU!', o.cx, o.cy - 1.2, '#9bd3f0'); }
          else {
            o.state = 'broken'; o.respawn = CFG.RESPAWN;
            g.stats.breaks++;
            sfx('breakDone', pan(o.cx));
            dust(o.cx, o.cy, 16, '#a07a45');
          }
          k.pal = null; k.state = 'chase'; k.t = 0;
        }
        return;
      }

      if (role === 'killer') { playerKiller(dt, inp, dx, dy, d); return; }
      if (!tgt) return;                                 // todos já saíram da partida

      // ---- percepção, com os mesmos limites de uma pessoa: ENXERGA (raio + cone, linha de vista) ou OUVE (ruído, posição aproximada) ----
      const kvis = diff.kp;
      g.gens.forEach((o, i) => {          // o gerador é um bloco sólido: olha para a face voltada para ele
        if (o.done) return;
        const dd = Math.hypot(k.x - o.cx, k.y - o.cy) || 1;
        if (canSee(k.x, k.y, k.face, true, o.cx + (k.x - o.cx) / dd * 0.75, o.cy + (k.y - o.cy) / dd * 0.75, kvis)) k.genMem[i] = o.progress;
      });
      let seen = null, sd = 1e9, heard = null, hd = 1e9;
      for (const v of g.survivors) {
        if (!alive(v)) continue;
        const vd = Math.hypot(v.x - k.x, v.y - k.y);
        if (canSee(k.x, k.y, k.face, true, v.x, v.y, kvis)) { if (vd < sd) { sd = vd; seen = v; } }
        else if (vd < v.noise && vd < hd) { hd = vd; heard = v; }
      }
      k.seenNow = !!seen;
      if (seen) {
        k.target = seen;
        k.aware = 'hunt'; k.lost = 0;
        k.last = { x: seen.x, y: seen.y }; k.lastV = { x: seen.vx || 0, y: seen.vy || 0 };
      } else if (k.aware === 'hunt') {
        k.lost += dt;
        if (k.lost > CFG.TRACK) { k.aware = 'search'; k.wait = 0; k.target = null; }
      }
      if (!seen && heard && k.aware !== 'hunt') {          // só ouviu: vai ver de onde vem (posição com erro)
        k.hearT -= dt;
        if (k.hearT <= 0 || !k.last) {
          k.hearT = 0.8;
          k.last = { x: heard.x + (rnd() - 0.5) * 2 * CFG.HEAR_ERR, y: heard.y + (rnd() - 0.5) * 2 * CFG.HEAR_ERR }; k.lastV = { x: 0, y: 0 };
        }
        if (k.aware === 'patrol') { k.aware = 'search'; k.wait = 0; }
      }
      const cur = seen || tgt; use(cur);
      const cdx = s.x - k.x, cdy = s.y - k.y, cd = Math.hypot(cdx, cdy);
      const los = !!seen;
      g.los = los;
      const hunting = k.aware === 'hunt';

      if (hunting && los && cd < CFG.ATTACK_RANGE && !s.vault) {
        const n = cd || 1;
        k.ldx = cdx / n; k.ldy = cdy / n; k.face = Math.atan2(cdy, cdx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x));
        return;
      }

      // ---- objetivo de movimento ----
      let gx, gy, speed = CFG.K_SPEED * diff.kp;
      if (!hunting && (k.aware === 'search' || k.aware === 'patrol') && k.energy > (k.sneakPrev ? 0.02 : 0.5)) {   // espreita enquanto procura
        k.stealth = true; k.energy = Math.max(0, k.energy - (CFG.STEALTH_DRAIN + CFG.STEALTH_REGEN) * dt); speed *= CFG.STEALTH_SPEED;
      }
      if (hunting) {
        if (seen) { gx = s.x; gy = s.y; }
        else {                                            // perdeu de vista: segue para onde a pessoa ia
          if (!k.last) k.last = { x: s.x, y: s.y };
          const lv = k.lastV || { x: 0, y: 0 }, tt = Math.min(k.lost, 1.2);
          gx = k.last.x + lv.x * tt; gy = k.last.y + lv.y * tt;
        }
      }
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
        if (!k.goal) { k.aware = 'search'; k.last = k.last || { x: k.x, y: k.y }; k.wait = 0; return; }
        const o = k.goal;
        gx = o.cx; gy = o.cy;
        if (Math.hypot(k.x - gx, k.y - gy) < (o.range ? o.range - 0.5 : 1.7)) {
          o.visited = g.time; k.goal = null;
          if (g.vehicles.includes(o) && sabotageable(o)) { k.face = Math.atan2(o.cy - k.y, o.cx - k.x); startBreak(o, 'sabotage'); return; }
          if (o.progress > 0 && !o.done && (g.gens.includes(o) || o === g.phone)) { kickGen(o); return; }
          k.state = 'recover'; k.t = 0; k.dur = 1.2;
          return;
        }
      }

      // às vezes quebra uma janela que acabaram de usar (para cortar quem passar depois)
      if (k.aware !== 'patrol' || true) {
        for (const w of g.windows) {
          if (w.state !== 'open' || !w.usedT || g.time - w.usedT > 6 || w.smashChecked === w.usedT) continue;
          if (Math.hypot(k.x - w.cx, k.y - w.cy) > 1.5) continue;
          w.smashChecked = w.usedT;
          if (rnd() < 0.6) { startBreak(w, 'window'); return; }
        }
      }

      const ti = clamp(Math.floor(gy), 0, H - 1) * W + clamp(Math.floor(gx), 0, W - 1);
      fieldT -= dt;
      if (fieldT <= 0 || ti !== fieldTile) { dijkstra(field, gx, gy, false, { until: k }); fieldT = 0.15; fieldTile = ti; }

      // mind game: às vezes o assassino "respeita" um pallet de pé entre vocês
      k.hesitate = false;
      if (hunting && seen) for (const p of g.pallets) {
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
      if (hunting && seen) { tx = s.x; ty = s.y; }
      else {
        const n = bestNb(field, k, false);
        if (!n) return;
        if (n.pal && Math.hypot(k.x - n.pal.cx, k.y - n.pal.cy) < 1.2) { startBreak(n.pal, 'pallet'); return; }
        if (n.win && Math.hypot(k.x - n.win.cx, k.y - n.win.cy) < 1.25 && startKVault(n.win)) return;
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

    // próximo gerador (ou a porta) a patrulhar: prefere os que já têm progresso e os que não visitou há pouco
    function pickGoal() {
      const ph = g.phone;
      const list = (!g.door.powered ? g.gens.filter((o) => !o.done) : ph ? (ph.state === 'ready' ? [ph] : [g.door]) : [g.door])
        .concat(g.vehicles.filter((v) => v.state === 'build' || v.state === 'ready' || v.state === 'started'));
      if (!list.length) return null;
      const w = list.map((o) => {
        const d = Math.hypot(k.x - o.cx, k.y - o.cy);
        const known = g.gens.includes(o) ? (k.genMem[g.gens.indexOf(o)] || 0) : 0;   // só sabe o progresso do que já viu
        return (known > 0 ? 3 : 1) * (o.range && !sabotageable(o) ? 0.25 : 1) * (g.time - o.visited > 25 ? 1 : 0.1) / (1 + d / 25);
      });
      let r = rnd() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }

    // ---------- IA do sobrevivente ----------
    const fS = new Float32Array(W * H), fK = new Float32Array(W * H), fTc = new Float32Array(W * H);   // fT (rumo ao destino) é um campo por bot: ai.fT

    // compromisso: só troca o plano de fuga se o atual deixou de valer ou depois de ~1,6 s (evita "barata tonta")
    function adoptPlan(cand) {
      const cur = ai.plan;
      let invalid = !cur;
      if (cur) {
        if (cur.pal) invalid = cur.pal.state !== 'up';
        else if (cur.T) {
          const j = clamp(Math.floor(cur.T.y), 0, H - 1) * W + clamp(Math.floor(cur.T.x), 0, W - 1);
          invalid = Math.hypot(cur.T.x - s.x, cur.T.y - s.y) < 0.5 || fS[j] / CFG.RUN + 0.1 > fK[j] / CFG.K_SPEED;
        } else invalid = true;
      }
      if (invalid || ai.planAge > 1.6) { ai.plan = cand; ai.fT.set(fTc); ai.planAge = 0; }
    }
    // giro suave: o bot não inverte a direção de um quadro para o outro
    function smoothOut(out, dt) {
      const l = Math.hypot(out.ax, out.ay);
      if (l < 0.01) { ai.dx = 0; ai.dy = 0; return out; }
      const tx = out.ax / l, ty = out.ay / l;
      if (!ai.dx && !ai.dy) { ai.dx = tx; ai.dy = ty; }
      else {
        const f = Math.min(1, dt * 9);
        ai.dx += (tx - ai.dx) * f; ai.dy += (ty - ai.dy) * f;
        const m = Math.hypot(ai.dx, ai.dy) || 1; ai.dx /= m; ai.dy /= m;
      }
      out.ax = ai.dx; out.ay = ai.dy;
      return out;
    }

    function steer(arr, out, goal) {
      // já no tile do destino: vai direto ao ponto (senão o campo empurra para fora do tile)
      if (goal && Math.floor(goal.x) === Math.floor(s.x) && Math.floor(goal.y) === Math.floor(s.y)) {
        const gx = goal.x - s.x, gy = goal.y - s.y, gl = Math.hypot(gx, gy);
        if (gl > 0.05) { out.ax = gx / gl; out.ay = gy / gl; }
        return;
      }
      const n = bestNb(arr, s, true);
      if (!n) return;
      if (n.win) {
        const wd = Math.hypot(s.x - n.win.cx, s.y - n.win.cy);
        if (n.win.state === 'closed' && ai.mode !== 'flee' && wd < 1.25) { out.winAct = n.win; return; }   // para e abre
        if (n.win.state !== 'closed' && ai.mode !== 'flee' && wd < 2.2) out.walk = true;                  // passa com calma
      }
      const mx = n.x + 0.5 - s.x, my = n.y + 0.5 - s.y, l = Math.hypot(mx, my) || 1;
      out.ax = mx / l; out.ay = my / l;
    }

    function planFlee() {
      const k0 = winPass; winPass = s.hp > 1 ? 1 : 0;       // com vida cheia aceita se cortar para escapar
      dijkstra(fS, s.x, s.y, true, { limit: 34 });
      dijkstra(fK, ai.K.x, ai.K.y, false, { limit: 95 });
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
        dijkstra(fTc, bT.x, bT.y, true, { until: s });
        adoptPlan({ pal: best, T: bT, err: (rnd() - 0.5) * 0.6, react: rnd() * 0.22 / botSkill() });
        winPass = k0;
        return;
      }
      // sem pallet seguro: o tile mais longe do assassino que ainda dá para alcançar primeiro (porta aberta tem bônus)
      let bt = null, bv = -1e9;
      for (let i = 0; i < W * H; i++) {
        if (t[i] !== 0 || fS[i] > 22 || fS[i] / myT + 0.15 > fK[i] / kT) continue;
        let v = Math.min(fK[i], 95) - 0.35 * fS[i] + ((i * 7919 + s.id * 104729) % 97) / 97 * 5;      // cada um escolhe um canto diferente
        for (const o of g.survivors) if (o !== s && alive(o) && Math.hypot(o.x - ((i % W) + 0.5), o.y - (((i / W) | 0) + 0.5)) < 5) v -= 4;
        if (v > bv) { bv = v; bt = i; }
      }
      if (g.door.opened) {
        const ni = 1 * W + Math.floor(g.door.cx);
        if (fS[ni] < 1e8 && fS[ni] / myT + 0.15 < fK[ni] / kT && 40 - 0.35 * fS[ni] + fK[ni] > bv) { bv = 40 - 0.35 * fS[ni] + fK[ni]; bt = ni; }
      }
      if (bt !== null) {
        const T = { x: (bt % W) + 0.5, y: ((bt / W) | 0) + 0.5 };
        dijkstra(fTc, T.x, T.y, true, { until: s });
        adoptPlan({ pal: null, T, err: 0, react: 0 });
      } else adoptPlan({ pal: null, T: null, err: 0, react: 0 });
      winPass = k0;
    }

    // o que ESTE sobrevivente sabe do assassino: vê (raio/cone + linha de vista), ouve (posição aproximada) ou só lembra
    const botSkill = () => (role === 'killer' ? diff.bot : 1);
    function killerNoise() {
      if (k.state === 'lunge' || k.state === 'windup' || k.state === 'break') return CFG.KN_ACT;
      if (k.state === 'stun' || k.state === 'recover' || k.state === 'intro') return 2;
      return (k.moving ? CFG.KN_MOVE : 2) * (k.stealth ? CFG.STEALTH_NOISE : 1);
    }
    function perceiveKiller(dt) {
      const bm = botSkill(), d = Math.hypot(k.x - s.x, k.y - s.y);
      if (canSee(s.x, s.y, s.face, false, k.x, k.y, bm) && (!k.stealth || d <= CFG.STEALTH_SEE)) {
        ai.K = { x: k.x, y: k.y, vx: k.vx, vy: k.vy, state: k.state, live: true };
        ai.lk = { x: k.x, y: k.y }; ai.aware = 4;
      } else if (d < killerNoise() * bm) {
        ai.hearT -= dt;
        if (ai.hearT <= 0 || !ai.est) { ai.hearT = 0.6; ai.est = { x: k.x + (rnd() - 0.5) * 2 * CFG.HEAR_ERR, y: k.y + (rnd() - 0.5) * 2 * CFG.HEAR_ERR }; }
        ai.K = { x: ai.est.x, y: ai.est.y, vx: 0, vy: 0, state: 'unknown', live: false };
        ai.lk = { x: ai.est.x, y: ai.est.y }; ai.aware = Math.max(ai.aware, 3);
      } else {
        ai.aware = Math.max(0, ai.aware - dt);
        if (ai.K) ai.K = { x: ai.K.x, y: ai.K.y, vx: 0, vy: 0, state: 'unknown', live: false };   // só lembra
      }
      if (s.burst > 0) ai.aware = Math.max(ai.aware, 3);
      return ai.K;
    }

    function aiSurvivor(dt) { return smoothOut(aiSurvivorRaw(dt), dt); }
    function aiSurvivorRaw(dt) {
      const out = { ax: 0, ay: 0, act: false, drop: false, press: false, actPress: false, walk: false, radio: false };
      const K = perceiveKiller(dt);
      // rádio: liga para trabalhar, desliga quando foge ou não precisa (economiza pilha)
      if (s.tool && s.tool.batt > 0) {
        const want = !ai.fetch && (ai.aware <= 0 || (K && !K.live)) && !s.vault;
        out.radio = want !== s.tool.on;
      }
      // "muito perto" no rádio sem ver o assassino: congela e fica quieto por um instante
      if (s.det === 3 && !(K && K.live)) ai.wary = 2.5; else ai.wary = Math.max(0, ai.wary - dt);
      const kdx = K ? K.x - s.x : 0, kdy = K ? K.y - s.y : 0, kd = K ? Math.hypot(kdx, kdy) : 99;

      // skill check: o "jogador" aperta com um pequeno erro
      if (s.skill) {
        if (ai.skill !== s.skill) { ai.skill = s.skill; ai.skillAt = s.skill.tz + (rnd() - 0.5) * 2 * CFG.AI_SKILL_ERR / botSkill(); }
        if (s.skill.t > CFG.SKILL_DELAY && skillAngle() >= ai.skillAt) out.press = true;
      }

      // foge de quem vê vindo na sua direção, ou de quem está muito perto; um assassino parado/distante não assusta
      const kSpd = K ? Math.hypot(K.vx, K.vy) : 0;
      const approaching = !!(K && K.live && kSpd > 0.6 && (K.vx * (s.x - K.x) + K.vy * (s.y - K.y)) > 0);
      const fleeing = !!K && ai.aware > 0 && (kd < 7 || (approaching && kd < CFG.AI_FLEE) || s.burst > 0);
      ai.mode = fleeing ? 'flee' : (g.door.powered ? 'exit' : 'repair');
      if (!fleeing) ai.plan = null; else ai.planAge += dt;

      if (ai.mode === 'flee') {
        ai.thinkT -= dt;
        if (ai.thinkT <= 0) { ai.thinkT = 0.3; planFlee(); }
        const plan = ai.plan;
        const p = plan && plan.pal;
        let waiting = false;
        if (p && p.state === 'up') {
          const ds = Math.hypot(s.x - p.cx, s.y - p.cy);
          const along = (s.x - p.cx) * p.nx + (s.y - p.cy) * p.ny;
          const kSide = (K.x - p.cx) * p.nx + (K.y - p.cy) * p.ny;
          if (ds < CFG.DROP_RANGE && along * kSide < 0 && !s.vault) {
            const dir = dropDir(p);
            const fake = { cx: p.cx + dir.x * plan.err, cy: p.cy + dir.y * plan.err, dir };
            const inc = K.live && (K.state === 'stun' || K.state === 'stumble');
            const ahead = { x: K.x + K.vx * (CFG.FALL_T + 0.12), y: K.y + K.vy * (CFG.FALL_T + 0.12) };
            const zone = K.live && inZone(fake, ahead);          // só decide pelo golpe do pallet se estiver VENDO o assassino
            // tempo de reação humano: a zona precisa ficar "ocupada" por um instante antes de ele reagir
            ai.zoneT = zone && !inc ? ai.zoneT + dt : 0;
            if (!inc && ((zone && ai.zoneT >= plan.react) || (K.live && kd < 1.7 && K.state !== 'recover')) && kd > 0.5) { out.drop = true; ai.noPal[p.tx + ',' + p.ty] = g.time + 5; }
            waiting = true;
            ai.wait += dt;
            if (ai.wait > 2.5 && kd < 9) { out.drop = true; ai.noPal[p.tx + ',' + p.ty] = g.time + 5; }   // trava a passagem
          }
        } else ai.wait = 0;
        const k0 = winPass; winPass = s.hp > 1 ? 1 : 0;
        if (plan && plan.T && !waiting) {
          if (Math.hypot(plan.T.x - s.x, plan.T.y - s.y) > 0.3) steer(ai.fT, out, plan.T);
        } else if (!plan || (!plan.T && !waiting)) {
          const l = kd || 1; out.ax = -kdx / l; out.ay = -kdy / l;     // sem opção: corre para longe
        }
        winPass = k0;
        return out;
      }
      ai.wait = 0;

      // exit/repair: caminha até o alvo e segura AGIR
      ai.fieldT -= dt;
      const k0 = winPass; winPass = 1;                                   // calmo: abre janelas fechadas
      let tg = null;
      if (g.door.opened) {
        // porta aberta: é só atravessar
        if (ai.fieldT <= 0) { dijkstra(ai.fT, g.door.cx, 1.2, true, { until: s }); ai.fieldT = 0.4; }
        steer(ai.fT, out, { x: g.door.cx, y: 1.2 });
        winPass = k0;
        return out;
      }
      // um rádio ou uma peça de veículo à vista? vai pegar (rádio: só quem não tem; peça: só quem não carrega uma e se o veículo ainda precisa dela)
      if (!ai.fetch) {
        for (const it of g.items) {
          if (it.holder) continue;
          if (it.kind === 'radio' ? s.tool : (it.kind !== 'part' || s.item || !partWanted(it))) continue;
          if (canSee(s.x, s.y, s.face, false, it.x, it.y, botSkill())) { ai.fetch = it; ai.fieldT = 0; break; }
        }
      }
      if (ai.fetch && (ai.fetch.holder || (ai.fetch.kind === 'radio' ? s.tool : (s.item || !partWanted(ai.fetch))))) ai.fetch = null;
      if (ai.wary > 0 && !fleeing) { out.walk = true; winPass = k0; return out; }          // quieto: não trabalha nem anda
      const vt = vehicleGoal();
      const rv = ai.route && ai.route !== 'police' ? vehByKind(ai.route) : null;
      if (vt) tg = vt;
      else if (ai.fetch) tg = ai.fetch;
      else if (rv && (rv.state === 'build' || rv.state === 'ready') && (g.time < 330 || rv.order.length > 0)) tg = exploreTarget();   // bot do carro/barco: procura peças (desiste depois de ~5 min sem progresso)
      else if (g.phone && ai.mode === 'exit') {
        // energia ligada: telefone; depois de chamar, espera a polícia perto do portão (longe do meio do mapa)
        if (g.phone.state === 'ready') tg = g.phone;
        else {
          tg = { cx: g.door.cx + (s.id - 1.5) * 3.2, cy: 13.5 - (s.id % 2) * 3, rally: true };
          if (Math.hypot(s.x - tg.cx, s.y - tg.cy) < 1.6) { out.walk = true; winPass = k0; return out; }
        }
      }
      else if (ai.mode === 'exit') tg = g.door;
      else {
        if ((!ai.target || !g.gens.includes(ai.target) || ai.target.done) && g.gens.some((o) => o.known && !o.done)) {
          dijkstra(fS, s.x, s.y, true);
          let bg = null, bv = 1e9;
          for (const o of g.gens) {
            if (o.done || !o.known) continue;
            let v = Math.min(fS[o.ty * W + o.tx - 1] || 1e9, fS[o.ty * W + o.tx + 1] || 1e9, fS[(o.ty + 1) * W + o.tx] || 1e9, fS[(o.ty - 1) * W + o.tx] || 1e9) - o.progress * 10;
            if (ai.lk && Math.hypot(ai.lk.x - o.cx, ai.lk.y - o.cy) < 9) v += 30;      // evita onde viu o assassino
            for (const other of g.survivors) if (other !== s && alive(other) && other.ai && other.ai.target === o) v += 8;   // reparte o trabalho
            if (v < bv) { bv = v; bg = o; }
          }
          ai.target = bg; ai.fieldT = 0;
        }
        if (ai.target && ai.target.done) ai.target = null;
        tg = ai.target || exploreTarget();
      }
      if (!tg) { winPass = k0; return out; }
      const it = s.interact;
      if (it && it.obj === tg) { out.act = true; winPass = k0; return out; }
      const gp = tg.stand || { x: tg.cx, y: tg.cy };                      // veículos: o ponto onde se fica de pé ao lado dele
      if (ai.fieldT <= 0) { dijkstra(ai.fT, gp.x, gp.y, true, { until: s }); ai.fieldT = 0.4; }
      steer(ai.fT, out, tg === g.door ? { x: g.door.cx, y: 1.2 } : gp);
      if (out.winAct && it && it.obj === out.winAct) out.act = true;
      winPass = k0;
      return out;
    }

    // conhecimento da equipe: um gerador "vira conhecido" quando alguém o vê; pontos de exploração viram "vistos" quando alguém passa perto
    function senseWorld(sv, dt) {
      sv.knowT = (sv.knowT || 0) - dt;
      if (sv.knowT > 0 || !g.explore.length) return;
      sv.knowT = 0.25;
      for (const o of g.gens) {
        if (o.known) continue;
        const dd = Math.hypot(sv.x - o.cx, sv.y - o.cy) || 1;
        if (canSee(sv.x, sv.y, sv.face, false, o.cx + (sv.x - o.cx) / dd * 0.75, o.cy + (sv.y - o.cy) / dd * 0.75, 1)) { o.known = true; if (sv.human || role === 'survivor') popupKnown(o); }
      }
      for (const e of g.explore) if (!e.seen && Math.hypot(sv.x - e.x, sv.y - e.y) < (e.kind === 'cabin' ? 4.5 : 6)) e.seen = true;
    }
    function popupKnown(o) { if (g.survivors[0].human) popup('GERADOR ENCONTRADO', o.cx, o.cy - 1.2, '#7dffa0'); }

    // peças e veículos: o que o bot faz com o que carrega e com um veículo pronto
    const partWanted = (it) => { const v = vehByKind(it.veh); return !!v && v.state === 'build' && !v.parts[it.part]; };
    function vehicleGoal() {
      if (!g.vehicles.length) return null;
      if (s.item && s.item.veh) {
        const v = vehByKind(s.item.veh);
        if (v && v.state === 'build' && !v.parts[s.item.part]) return v;
        dropItem(s, s.item);                                              // peça que não serve mais
      }
      for (const v of g.vehicles) {
        const mine = Math.hypot(s.x - v.cx, s.y - v.cy);
        if (v.state === 'ready') {
          let rank = 0;
          for (const o of g.survivors) if (o !== s && alive(o) && o.ai && Math.hypot(o.x - v.cx, o.y - v.cy) < mine) rank++;
          if (rank < 2 && (ai.route === v.kind || mine < 35)) return v;
        } else if (v.state === 'started' && v.seated < v.seats && (ai.route === v.kind || mine < 70)) return v;
      }
      return null;
    }

    // sem gerador conhecido: vai ao ponto de exploração mais interessante (cabanas primeiro) que ninguém da equipe viu ainda
    function exploreTarget() {
      let e = ai.exT;
      if (e && (e.seen || g.time - ai.exAt > 45)) e = null;
      if (!e) {
        let bv = 1e9, be = null, open = 0;
        for (const q of g.explore) {
          if (q.seen) continue;
          open++;
          let v = Math.hypot(q.x - s.x, q.y - s.y) - (q.kind === 'cabin' ? 14 : 0) + ((q.id * 7919 + s.id * 104729) % 97) / 97 * 8;
          for (const o of g.survivors) if (o !== s && alive(o) && o.ai && o.ai.exT === q) v += 30;
          if (v < bv) { bv = v; be = q; }
        }
        if (!open) for (const q of g.explore) q.seen = false;           // viu tudo e nada? recomeça a busca
        e = be; ai.exT = e; ai.exAt = g.time; ai.fieldT = 0;
      }
      return e ? { cx: e.x, cy: e.y, explore: e } : null;
    }

    // ---------- loop ----------
    g.tryDrop = () => { use(g.survivors[0]); return tryDrop(); };

    g.update = function (dt, inp) {
      inp = inp || {};
      if (g.hitstop > 0) { g.hitstop -= dt; return; }
      g.time += dt;
      g.shake = Math.max(0, g.shake - dt * 22);
      g.flash = Math.max(0, g.flash - dt);
      for (const w of g.windows) w.t += dt;
      g.door.t += dt;
      vehicleTick(dt);                       // os veículos continuam andando mesmo depois do fim da partida

      if (g.over) {
        g.overT += dt;
        return;
      }

      for (const o of g.gens) o.w = 0;
      if (g.phone) g.phone.w = 0;
      for (const v of g.vehicles) v.w0 = 0;
      policeTick(dt);
      for (const sv of g.survivors) {
        if (!alive(sv)) continue;
        use(sv);
        sv.px = sv.x; sv.py = sv.y;
        sv.interact = findInteract();
        senseWorld(sv, dt);
        const sin = sv.human ? inp : aiSurvivor(dt);
        if (s.skill && (sin.press || sin.drop || sin.actPress)) pressSkill();
        else if (sin.drop || (sin.actPress && !sv.interact)) { if (!(sin.drop || findDroppable()) && s.item) dropItem(s, s.item); else tryDrop(); }
        updateSurvivor(dt, sin);

        // rádio: liga/desliga, gasta pilha e mede a proximidade do assassino (3 faixas, sem direção)
        if (sin.radio && s.tool && s.tool.batt > 0) { s.tool.on = !s.tool.on; sfx('click'); }
        if (s.tool && s.tool.on) { s.tool.batt -= dt; if (s.tool.batt <= 0) { s.tool.batt = 0; s.tool.on = false; if (s.human) popup('RÁDIO SEM PILHA', s.x, s.y - 1.5, '#ff9d5c'); } }
        s.det = 0;
        if (s.tool && s.tool.on) {
          const dd = Math.hypot(k.x - s.x, k.y - s.y), m = k.stealth ? CFG.STEALTH_NOISE : 1;
          if (dd < CFG.DET_R * m) s.det = dd < CFG.DET_VERY * m ? 3 : dd < CFG.DET_NEAR * m ? 2 : 1;
        }

        // skill checks só acontecem enquanto conserta um gerador
        if (alive(sv) && s.acting && s.acting.type === 'gen') {
          if (!s.skill) { s.skillCD -= dt; if (s.skillCD <= 0) startSkill(); }
          else {
            s.skill.t += dt;
            if (skillAngle() > s.skill.tz + CFG.SKILL_ZONE + 0.1) endSkill('miss');
          }
        } else s.skill = null;
        sv.vx = (sv.x - sv.px) / (dt || 1); sv.vy = (sv.y - sv.py) / (dt || 1);
        if (alive(sv)) sv.near = findDroppable(); else sv.near = null;
        if (g.over) return;
      }

      g.interact = g.survivors[0].interact;
      g.kInteract = role === 'killer' ? findKillerInteract() : null;
      g.pInteract = role === 'killer' ? g.kInteract : g.interact;

      for (const p of g.pallets) {
        p.t += dt;
        if (p.state === 'falling' && p.t >= CFG.FALL_T) land(p);
        if (training && (p.state === 'down' || p.state === 'broken')) {
          p.respawn -= dt;
          if (p.respawn <= 0 && g.survivors.every((v) => !alive(v) || Math.hypot(v.x - p.cx, v.y - p.cy) > 1.6) && Math.hypot(k.x - p.cx, k.y - p.cy) > 1.6 &&
            !(k.state === 'break' && k.pal === p)) {
            p.state = 'up'; p.t = 0; p.respect = undefined;
            sfx('respawn');
          }
        }
      }
      for (const w of g.windows) {
        if (training && w.state !== 'closed' && w.state !== 'opening') {
          w.respawn -= dt;
          if (w.respawn <= 0 && g.survivors.every((v) => !alive(v) || Math.hypot(v.x - w.cx, v.y - w.cy) > 1.8) && Math.hypot(k.x - w.cx, k.y - w.cy) > 1.8 && !(k.state === 'break' && k.pal === w)) {
            w.state = 'closed'; w.t = 0; w.respawn = 0; sfx('respawn');
          }
        }
      }

      const kox = k.x, koy = k.y;
      updateKiller(dt, inp);
      k.vx = (k.x - kox) / (dt || 1); k.vy = (k.y - koy) / (dt || 1);
      g.nearList = [];
      for (const sv of g.survivors) if (alive(sv) && sv.near && (role === 'killer' || sv.human)) g.nearList.push({ pal: sv.near, sv });
      g.near = g.survivors[0].near;
      const ref = role === 'killer' ? nearestAlive(k) : g.survivors[0];
      g.dist = ref ? Math.hypot(ref.x - k.x, ref.y - k.y) : 99;
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
    g.alive = alive;
    g.canSee = (obs, tx, ty) => canSee(obs.x, obs.y, obs.face, obs === k, tx, ty, 1);
    // assassino em stealth só é visto bem de perto
    g.canSeeKiller = (obs) => canSee(obs.x, obs.y, obs.face, false, k.x, k.y, 1) && (!k.stealth || Math.hypot(k.x - obs.x, k.y - obs.y) <= CFG.STEALTH_SEE);
    g.castRay = castRay;
    g.routeTime = routeT;
    g.standing = () => g.pallets.filter((p) => p.state === 'up').length;
    g.inZone = inZone;
    g.solid = solid;
    g.dropDirFor = (sv, p) => { use(sv); return dropDir(p); };
    g.CFG = CFG;
    return g;
  }

  DP.createGame = createGame;
  DP.CFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
