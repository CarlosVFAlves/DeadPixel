// Lógica do jogo: 4 sobreviventes (você + bots, ou 4 bots), assassino, pallets, janelas,
// geradores e porta principal. Sem DOM aqui — render e entrada ficam em render.js / main.js
// (e dá para testar no Node).
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  const CFG = {
    RUN: 4.0,            // velocidade do sobrevivente (tiles/s)
    WALK: 0.6,           // multiplicador ao andar (Shift / joystick leve)
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
    K_SPEED_P_CAMP: 5.1,  // no acampamento (mapa enorme) o assassino-jogador é um pouco mais rápido
    KILLER_TASK: 1.5,     // multiplicador do tempo das tarefas dos bots quando quem joga é o assassino
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
    INTRO: 3, INTRO_CAMP: 20,   // segundos até o assassino começar a andar (no mapa grande ele nasce longe e a equipe ganha vantagem)

    // objetivo: 5 de 8 geradores + porta principal
    TREE_R: 0.45,        // raio do tronco (tiles): com o raio do corpo cobre o tile inteiro (ninguém fica "dentro" de uma árvore para os bots), mas os cantos são arredondados e o dedo escorrega
    HP: 2, HP_CAMP: 3,   // golpes que um sobrevivente aguenta (o último abate); o mapa grande é mais longo e perdoa mais
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
    ROUTES: { fuse: 45, door: 3, phone: 30, policeEta: 150, policeWindow: 120, carPart: 35, carStart: 10, boatPart: 40, boatStart: 15, leaveWait: 10 },
    // MEDO (anti-loop): quanto mais perto o assassino (e te vendo), mais medo; com medo, CORRER faz tropeçar com mais frequência (chance/s = FEAR_TRIP × medo²)
    K_TRAPS: 3, K_TRAP_START: 2, K_TRAP_T: 3.5, S_TRAP_T: 4, TRAP_ARM: 1.4, TRAP_R: 0.6, TRAP_DISARM: 1.2, FREE_T: 1.5,   // armadilha de urso: o assassino leva até 3 (2 se for pessoa); prende sobrevivente 4 s e assassino 3,5 s
    BAG: 3, CHEST_T: 1.2, HEAL_T: 6, HEAL_RANGE: 1.6,   // mochila (espaços: rádio, peça, kit médico...), tempo para abrir um baú, para se curar (1 vida) e alcance para curar um colega
    CHEST_LOOT: [['medkit', 0.4], ['trap', 0.2]],       // o que há num baú (o resto vem vazio)
    LEARN: 1,            // o assassino-IA aprende: cada bote errado aumenta a antecipação da mira e o acompanhamento do bote (0 desliga)
    GLASS_DEATH: 0.01,   // chance de morrer ao se cortar no vidro com a última vida
    FEAR_R: 9, FEAR_MIN: 1.2, FEAR_TRIP: 0.13, FEAR_CALM: 4, FEAR_RELIEF: 2.5, SURV_TRIP_T: 1.3, SURV_TRIP_SLOW: 0.5,
    // (depois de tropeçar ficam FEAR_CALM s sem novo tropeço; derrubar pallet / pular janela dá FEAR_RELIEF s de coragem)
    HEAR_NEAR: 5, HEAR_FAR: 30,   // som: volume cheio até 5 tiles, some aos 30
    HIDE_T: 0.6, LOCKER_OPEN_T: 1.1, LOCKER_RANGE: 1.5,   // armários: entrar (segurar), o assassino abre em ~1 s
    SABOTAGE_T: 2.5,         // assassino: tempo para sabotar um veículo (tira a última peça)

    // visão — a MESMA para pessoas e bots (paridade de informação): raio ambiente + cone de lanterna, com linha de vista
    VIS_S: { r: 3, cone: 11, half: 0.55 },      // sobrevivente
    VIS_K: { r: 3.5, cone: 12, half: 0.65 },    // assassino-IA enxerga um pouco mais
    VIS_KP: { r: 3.5, cone: 18, half: 0.72 },    // assassino-jogador: o mapa é enorme, então ele enxerga bem mais
    HEAR_ERR: 2.2,       // erro (tiles) na posição de algo que só se OUVE
    KN_MOVE: 6, KN_ACT: 9,   // alcance em que se ouve o assassino: andando / golpe e quebra

    // itens, rádio detector (sobrevivente) e stealth (assassino)
    ITEM_RANGE: 1.25, PICK_T: 0.5,
    RADIO_BATT: 120,                   // segundos de pilha
    DET_R: 24, DET_NEAR: 15, DET_VERY: 9,   // faixas do detector (tiles): longe / perto / muito perto
    STEALTH_SPEED: 0.8, STEALTH_NOISE: 0.25, STEALTH_SEE: 3.5,   // espreita: devagar, 25% do barulho e do alcance do rádio, só visto a 3,5 tiles
    STEALTH_DRAIN: 0.07, STEALTH_REGEN: 0.05, STEALTH_MIN: 0.15,  // energia: ~14 s ligada, ~20 s para recarregar

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
  const T_WIN = 5, T_TREE = 6, T_WATER = 7, T_VEH = 8, T_LOCKER = 9, T_CHEST = 10;
  // peças dos veículos: o carro leva bateria, chave e combustível; o barco, hélice, chave e combustível
  const PARTS = {
    battery: { veh: 'car', name: 'BATERIA' }, ckey: { veh: 'car', name: 'CHAVE' }, cfuel: { veh: 'car', name: 'COMBUSTÍVEL' },
    prop: { veh: 'boat', name: 'HÉLICE' }, bkey: { veh: 'boat', name: 'CHAVE' }, bfuel: { veh: 'boat', name: 'COMBUSTÍVEL' }
  };

  function createGame(opts) {
    opts = opts || {};
    const rnd = opts.rng || Math.random;
    const sfxOut = opts.sfx || function () {};
    // fila de eventos (só o anfitrião do multijogador liga g.record): sons, textos e partículas que as outras telas também precisam ver/ouvir
    let evId = 0, lastPan = null;
    const emit = (e) => { if (!g.record) return; e.i = ++evId; g.evq.push(e); if (g.evq.length > 80) g.evq.shift(); };
    const sfx = (name, p, extra) => {
      const v = pendingVol, lp = lastPan; pendingVol = 1; lastPan = null;
      if (g.record) emit({ t: 's', n: name, x: lp ? Math.round(lp.x * 10) / 10 : null, y: lp ? Math.round(lp.y * 10) / 10 : null, ex: extra && extra.surf ? extra : undefined });
      if (v > 0.03) sfxOut(name, p, v, extra);
    };
    // "sentir": tremor, piscada e travada só para quem vive o momento (o dono daquela tela); nas outras telas vai como evento
    function feel(who, shake, flash, hitstop) {
      if (who === g.pl) { if (shake) g.shake = Math.max(g.shake, shake); if (flash) g.flash = Math.max(g.flash, flash); if (hitstop && !g.record) g.hitstop = Math.max(g.hitstop, hitstop); }
      emit({ t: 'f', w: who === g.k ? 'k' : who.id, sh: shake || 0, fl: flash || 0, hs: hitstop || 0 });
    }
    const training = !!opts.training;
    const role = opts.role === 'killer' ? 'killer' : 'survivor';       // papel de quem está olhando esta cópia do jogo (a câmera)
    let KH = opts.killerHuman !== undefined ? !!opts.killerHuman : role === 'killer';          // o assassino é uma pessoa (nesta ou em outra tela)
    const humanIds = opts.humans || (role === 'survivor' ? [0] : []);                             // quais sobreviventes são pessoas
    const meIdx = opts.me || 0;                                                                    // qual sobrevivente é o desta tela
    const replica = !!opts.replica;                                                                // cópia que só mostra o que o anfitrião manda (multijogador)
    // dificuldade é sempre "para quem joga": o que ela muda depende do papel
    const level = ['easy', 'normal', 'hard'].includes(opts.difficulty) ? opts.difficulty : 'normal';
    const dl = { easy: -1, normal: 0, hard: 1 }[level];
    const diff = {
      level, dl,
      time: humanIds.length ? 1 + 0.3 * dl : (1 - 0.25 * dl) * CFG.KILLER_TASK,   // tempo das tarefas (sobrevivente-jogador: mais longo no difícil; com assassino-jogador os bots trabalham mais devagar)
      bot: KH ? 1 + 0.25 * dl : 1,                  // habilidade dos bots sobreviventes (reação, erro, sentidos)
      kp: !KH ? { easy: 0.88, normal: 1, hard: 1.05 }[level] : 1   // força do assassino-IA (velocidade e visão): no fácil é um pouco mais lento que quem corre
    };
    const routeT = (name) => CFG.ROUTES[name] * diff.time;
    const bots = opts.bots === undefined ? 3 : opts.bots;
    const map = DP.buildMap({ kind: opts.map || 'camp', rng: rnd });
    const W = map.W, H = map.H, t = map.t;

    const g = {
      cfg: CFG, map, training, role, diff, fullVision: false, introT: map.kind === 'camp' ? CFG.INTRO_CAMP : CFG.INTRO, hpMax: map.kind === 'camp' ? CFG.HP_CAMP : CFG.HP,
      time: 0, over: false, overT: 0,
      stats: { lunges: 0, stuns: 0, drops: 0, misses: 0, hits: 0, breaks: 0, vaults: 0, gens: 0, kicks: 0, skillOk: 0, skillFail: 0, sabotages: 0, hides: 0, finds: 0, cuts: 0, smashes: 0, crashes: 0 },
      pallets: [], windows: [], popups: [], fx: [], survivors: [],
      shake: 0, hitstop: 0, flash: 0,
      near: null, nearList: [], los: false, dist: 99, interact: null, kInteract: null, pInteract: null,
      pings: [], result: null, gensDone: 0, need: map.NEED, gens: [],
      escapedCount: 0, deadCount: 0, via: { gate: 0, car: 0, boat: 0 }
    };

    g.evq = []; g.record = false;

    function makeAI(i) {
      return { route: map.vehicles ? ['police', 'car', 'boat', 'police'][i % 4] : 'police', mode: 'repair', target: null, aware: 0, lk: null, thinkT: rnd() * 0.3, plan: null, skill: null, skillAt: 0, wait: 0, noPal: {}, fieldT: 0, fT: new Float32Array(W * H), zoneT: 0, planAge: 0, dx: 0, dy: 0, K: null, est: null, hearT: 0, fetch: null, wary: 0, hideLike: rnd(), hideCD: 0, hideGoal: null, hideGoalT: 0, hideUntil: 0, hideSeen: null, lootLike: rnd() };
    }
    g.makeAI = makeAI;      // (testes de equilíbrio: transformar o 'jogador' em bot)
    const nSurv = opts.survivors || 1 + bots;
    for (let i = 0; i < nSurv; i++) {
      const sp = map.spawnSurvivors[i % map.spawnSurvivors.length];
      const human = humanIds.includes(i);
      g.survivors.push({
        id: i, x: sp.x, y: sp.y, face: Math.PI / 2,
        hp: map.kind === 'camp' ? CFG.HP_CAMP : CFG.HP, fear: 0, calm: 0, tripT: 0, burst: 0, invuln: 0, vault: null, vaultCD: 0, moving: false, walk: 0,
        noise: 0, acting: null, skill: null, skillCD: 4 + i * 1.7, tick: 0,
        dead: false, escaped: false, near: null, interact: null, human, item: null, tool: null, pickP: 0, pickFor: null, det: 0,
        ai: human ? null : makeAI(i), usedWin: 0, bag: [], heal: null, trapT: 0
      });
    }

    k_init();
    function k_init() {
      g.k = {
        x: (KH && map.spawnKillerP ? map.spawnKillerP : map.spawnKiller).x, y: (KH && map.spawnKillerP ? map.spawnKillerP : map.spawnKiller).y, face: -Math.PI / 2,
        state: KH ? 'chase' : 'intro', t: 0, dur: 0, trip: 0, tripCD: 0, tripDir: 0, ph: 0, vx: 0, vy: 0, ldx: 0, ldy: 0, hitDone: false, pal: null, brkKind: 'pallet', brk: 0,
        moving: false, walk: 0, hesitate: false, vault: null,
        traps: KH ? CFG.K_TRAP_START : CFG.K_TRAPS, trapCD: 0, learn: 0, aware: 'patrol', lost: 0, last: null, lastV: null, wait: 0, goal: null, target: null, seenNow: false, genMem: {}, hearT: 0, stealth: false, sneakPrev: false, energy: 1
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
    // armários: dá para se esconder (invisível e inaudível); o assassino pode abrir e, se achar alguém, acerta
    g.lockers = (map.lockers || []).map((l) => ({ tx: l.tx, ty: l.ty, nx: l.nx, ny: l.ny, cx: l.tx + 0.5, cy: l.ty + 0.5, stand: { x: l.tx + 0.5 + l.nx * 0.95, y: l.ty + 0.5 + l.ny * 0.95 }, occ: null, checked: -99, t: 99, open: 0 }));
    // baús: abrir (segurar AGIR) revela o conteúdo; quem abre o guarda na mochila (ou deixa no chão se estiver cheia)
    g.chests = (map.chests || []).map((c) => {
      let r = rnd(), loot = null;
      for (const [kind, p0] of CFG.CHEST_LOOT) { if (r < p0) { loot = kind; break; } r -= p0; }
      return { tx: c.tx, ty: c.ty, nx: c.nx, ny: c.ny, cx: c.tx + 0.5, cy: c.ty + 0.5, stand: { x: c.tx + 0.5 + c.nx * 0.95, y: c.ty + 0.5 + c.ny * 0.95 }, open: false, t: 99, loot, known: false };
    });
    // armadilhas de urso (visíveis só de perto) e o arsenal do assassino no barracão
    g.traps = [];
    g.arsenal = map.arsenal ? { tx: map.arsenal.tx, ty: map.arsenal.ty, cx: map.arsenal.tx + 0.5, cy: map.arsenal.ty + 0.5, nx: map.arsenal.nx, ny: map.arsenal.ny, stand: { x: map.arsenal.tx + 0.5 + map.arsenal.nx * 0.95, y: map.arsenal.ty + 0.5 + map.arsenal.ny * 0.95 } } : null;
    g.partName = (it) => PARTS[it.part].name + ' (' + (it.veh === 'car' ? 'CARRO' : 'BARCO') + ')';
    // telefone (só no mapa grande): com energia ligada, segurar AGIR liga para a polícia; ela chega depois de um tempo e abre o portão por uma janela
    g.phone = map.phone ? { tx: map.phone.tx, ty: map.phone.ty, cx: map.phone.tx + 0.5, cy: map.phone.ty + 0.5, progress: 0, state: 'locked', visited: -99, w: 0, eta: 0, win: 0, calls: 0, noisyT: -99 } : null;
    const dSouth = map.door.side === 'S';
    g.door = { side: dSouth ? 'S' : 'N', inY: dSouth ? H - 1.2 : 1.2, tx: map.door.tx, ty: map.door.ty, w: map.door.w, cx: map.door.tx + map.door.w / 2, cy: dSouth ? H - 0.5 : 0.5, progress: 0, powered: false, opened: false, t: 99, visited: -99 };

    const k = g.k;
    let s = g.survivors[0];      // "contexto": o sobrevivente que as funções abaixo estão tratando
    let ai = s.ai;
    const use = (sv) => { s = sv; ai = sv.ai; };
    const alive = (sv) => !sv.dead && !sv.escaped;
    g.s = g.survivors[meIdx]; g.me = meIdx; g.killerHuman = KH;
    Object.defineProperty(g, 'ai', { get() { return g.survivors[0].ai; } });
    g.pl = role === 'killer' ? k : g.survivors[meIdx];       // quem a câmera segue

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
          if (t[ty * W + tx] === T_TREE) {                       // árvore: só o tronco (círculo) bloqueia o corpo; dá para passar rente e escorregar
            const ex = x - (tx + 0.5), ey = y - (ty + 0.5), rr = r + CFG.TREE_R;
            if (ex * ex + ey * ey < rr * rr) return true;
            continue;
          }
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
      const V = killerEye ? (KH ? CFG.VIS_KP : CFG.VIS_K) : CFG.VIS_S, m = mult || 1;
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
    function popup(text, x, y, color) { g.popups.push({ text, x, y, t: 0, color: color || '#fff' }); emit({ t: 'p', tx: text, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: color || '#fff' }); }
    function dust(x, y, n, col) {
      emit({ t: 'd', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n, c: col });
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = 0.6 + rnd() * 2;
        g.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.35 + rnd() * 0.3, c: col || '#8b7355' });
      }
    }
    const GLASS = ['#d6f2ff', '#9bd3f0', '#6fb4dc', '#ffffff'];
    function glass(x, y, n, dirx, diry) {
      emit({ t: 'g', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n, dx: dirx || 0, dy: diry || 0 });
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, sp = 1 + rnd() * 3;
        g.fx.push({ x, y, vx: Math.cos(a) * sp + (dirx || 0) * 2, vy: Math.sin(a) * sp + (diry || 0) * 2, t: 0, life: 0.45 + rnd() * 0.5, c: GLASS[(rnd() * GLASS.length) | 0] });
      }
    }
    // som posicional: estéreo pela direção e volume pela distância até quem joga (só se ouve o que está perto)
    let pendingVol = 1;
    const pan = (x, y) => {
      lastPan = { x, y: y === undefined ? g.pl.y : y };
      const d = Math.hypot(x - g.pl.x, (y === undefined ? g.pl.y : y) - g.pl.y);
      pendingVol = d < CFG.HEAR_NEAR ? 1 : Math.pow(Math.max(0, 1 - (d - CFG.HEAR_NEAR) / (CFG.HEAR_FAR - CFG.HEAR_NEAR)), 2);
      return clamp((x - g.pl.x) / 10, -0.8, 0.8);
    };

    // passos: um som a cada tanto de chão andado (corrida > caminhada > espreita); o tipo de piso muda o timbre
    // alcance em tiles: a corrida se ouve de longe; andando devagar, só de perto. Os próprios passos soam baixinho.
    function surfaceAt(x, y) {
      const i = (y | 0) * W + (x | 0);
      if (map.indoor && map.indoor[i]) return 'wood';
      const gr = map.ground ? map.ground[i] : 0;
      return gr === 1 ? 'dirt' : gr === 2 ? 'sand' : gr === 3 ? 'wood' : gr === 4 ? 'gravel' : 'grass';
    }
    function stepSfx(e, moved, stride, loud, range, heavy) {
      e.stepD = (e.stepD || 0) + moved;
      if (e.stepD < stride) return;
      e.stepD -= stride; if (e.stepD > stride) e.stepD = 0;
      const p = pan(e.x, e.y), d = Math.hypot(e.x - g.pl.x, e.y - g.pl.y);
      pendingVol = e === g.pl ? 0.3 * loud : pendingVol * loud * clamp(1 - d / range, 0, 1);
      sfx('step', p, { surf: surfaceAt(e.x, e.y), heavy: !!heavy, alt: (e.stepAlt = !e.stepAlt), loud, range });
    }
    function stepTick() {
      for (const sv of g.survivors) {
        const moved = Math.hypot(sv.x - (sv.px === undefined ? sv.x : sv.px), sv.y - (sv.py === undefined ? sv.y : sv.py));
        if (!alive(sv) || sv.hidden || sv.vault || sv.tripT > 0 || moved < 0.002 || moved > 1) { sv.stepD = 0; continue; }
        if (sv.runMode === false) stepSfx(sv, moved, 0.95, 0.55, 8, false); else stepSfx(sv, moved, 1.3, 1, 17, false);
      }
      const dk = Math.hypot(k.x - (k.spx === undefined ? k.x : k.spx), k.y - (k.spy === undefined ? k.y : k.spy));
      if (k.state === 'chase' || k.state === 'stumble' || k.state === 'kvault') {
        if (dk > 0.002 && dk < 1.5 && k.state !== 'kvault') stepSfx(k, dk, 1.5, k.stealth ? 0.3 : 1.1, k.stealth ? 7 : 20, true); else k.stepD = 0;
      } else k.stepD = 0;
    }

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
      p.state = 'falling'; p.t = 0; p.dir = dropDir(p); s.calm = Math.max(s.calm, CFG.FEAR_RELIEF); s.fear *= 0.5;
      g.stats.drops++;
      sfx('creak', pan(p.cx, p.cy));
      return true;
    }
    function land(p) {
      p.state = 'down'; p.t = 0; p.respawn = CFG.RESPAWN;
      sfx('slam', pan(p.cx, p.cy));
      if (Math.hypot(p.cx - g.pl.x, p.cy - g.pl.y) < 9) g.shake = Math.max(g.shake, 2.5);     // só treme a tela de quem está perto (nas outras telas: evento 'f' com 'w' = -1)
      emit({ t: 'f', w: -1, sh: 2.5, fl: 0, hs: 0, x: Math.round(p.cx), y: Math.round(p.cy), r: 9 });
      dust(p.cx + p.dir.x * 0.6, p.cy + p.dir.y * 0.6, 10);

      const kd = Math.hypot(k.x - p.cx, k.y - p.cy);
      const stunned = inZone(p, k) && k.state !== 'intro';
      if (stunned) {
        k.state = 'stun'; k.t = 0; k.pal = null; k.vault = null; k.aware = 'hunt'; k.lost = 0;
        g.stats.stuns++;
        feel(k, 7, 0.25, 0.1); if (s && s.human) feel(s, 7, 0.25, 0.1);        // pisca/trava só para quem vive o momento (assassino atordoado ou quem derrubou o pallet)
        sfx('stun', pan(k.x, k.y));
        popup('ATORDOADO!', k.x, k.y - 1.3, '#ffd23f');
        dust(k.x, k.y, 14, '#d9d2b6');
      } else if (kd < 3.4 && k.state !== 'intro') {
        g.stats.misses++;
        sfx('miss', pan(k.x, k.y));
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
      sfx('glass', pan(w.cx, w.cy));
      g.shake = Math.max(g.shake, 3);
      if (byKiller) { g.stats.smashes++; }
    }
    function openWindow(w) {
      w.state = 'open'; w.t = 0; w.prog = 0;
      sfx('winOpen', pan(w.cx, w.cy));
    }
    // corte de vidro: perde 1 de vida (nunca mata), grita e denuncia onde está
    function cutSurvivor() {
      g.stats.cuts++;
      sfx('cut', pan(s.x, s.y));
      if (s.human) feel(s, 0, 0.12);
      if (!training && s.hp > 1) s.hp--;
      else if (!training && s.hp === 1 && rnd() < CFG.GLASS_DEATH) {          // sem corações de sobra, o vidro pode ser fatal
        popup('O VIDRO FOI FATAL...', s.x, s.y - 1.5, '#ff2a2a'); killSurvivor(s); g.stats.glassDeaths = (g.stats.glassDeaths || 0) + 1;
        alert(s.x, s.y); return;
      }
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
      emit({ t: 'o', r: result });
    }
    function checkEnd() {
      if (g.over) return;
      const h = !KH && humanIds.length === 1 ? g.survivors[humanIds[0]] : null;      // a sós contra a IA: morrer ou escapar encerra a partida; em grupo, só quando todos saem
      if (h && h.dead) return over('dead');
      if (h && h.escaped) return over('escaped');
      if (g.survivors.every((v) => !alive(v))) {
        // assassino vence se menos da metade escapou
        over(g.escapedCount * 2 < g.survivors.length ? 'dead' : 'escaped');
      }
    }
    function escapeSurvivor(sv) {
      if (!alive(sv)) return;
      sv.escaped = true; sv.vault = null; g.escapedCount++; sv.via = 'gate'; g.via.gate++;
      popup('ESCAPOU!', sv.x, sv.y - 1.4, '#7dffa0');
      sfx('escape');
      checkEnd();
    }
    function killSurvivor(sv) {
      sv.dead = true; sv.vault = null; g.deadCount++;
      sv.deadAt = g.time; sv.deadFace = sv.face; sv.moving = false; sv.acting = null; sv.skill = null;       // o corpo fica onde caiu
      if (sv.item) dropItem(sv, sv.item);                                                                      // o que carregava (peça, rádio) cai no chão
      if (sv.tool) dropItem(sv, sv.tool);
      while (sv.bag.length) dropItem(sv, sv.bag[0]);
      sv.heal = null;
      popup('ABATIDO!', sv.x, sv.y - 1.4, '#ff4d4d');
      checkEnd();
    }
    function hurt() {
      g.stats.hits++;
      s.invuln = 0.7; s.burst = CFG.BURST_T; s.heal = null;
      if (s.human) feel(s, 6, 0.3);               // golpe em bot não pisca a tela de ninguém; em pessoa, só a dela (e a do assassino)
      if (KH) feel(k, 6, 0.3);
      sfx('hit', pan(s.x, s.y));
      popup(KH ? 'ACERTOU!' : '-1', s.x, s.y - 1.4, KH ? '#ffd23f' : '#ff4d4d');
      k.aware = 'hunt'; k.lost = 0;
      if (training) return;
      s.hp--;
      if (s.hp <= 0) killSurvivor(s);
    }

    // ---------- geradores, skill check, porta ----------
    function alert(x, y) {
      g.pings.push({ x, y, t: g.time });
      if (KH) { g.pings.push({ x, y, t: g.time }); emit({ t: 'k', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }); return; }
      if (k.state === 'intro') return;
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
      for (const l of g.lockers) {
        if (l.occ) continue;
        const d = Math.hypot(s.x - l.cx, s.y - l.cy);
        if (d < CFG.LOCKER_RANGE && d < bd && (s.x - l.cx) * l.nx + (s.y - l.cy) * l.ny > 0.3) { bd = d; best = { type: 'hide', obj: l }; }
      }
      for (const v of g.vehicles) {
        const d = Math.hypot(s.x - v.cx, s.y - v.cy);
        if (d > v.range || d >= bd) continue;
        if (v.state === 'build' && s.item && s.item.veh === v.kind && !v.parts[s.item.part]) { bd = d; best = { type: 'install', obj: v }; }
        else if (v.state === 'ready') { bd = d; best = { type: 'start', obj: v }; }
        else if (v.state === 'started' && v.seated < v.seats) { bd = d; best = { type: 'board', obj: v }; }
      }
      for (const it of g.items) {
        if (it.holder || !canTake(s, it)) continue;
        const d = Math.hypot(s.x - it.x, s.y - it.y);
        if (d < CFG.ITEM_RANGE && d < bd) { bd = d; best = { type: 'item', obj: it }; }
      }
      for (const c of g.chests) {
        if (c.open) continue;
        const d = Math.hypot(s.x - c.cx, s.y - c.cy);
        if (d < CFG.LOCKER_RANGE && d < bd) { bd = d; best = { type: 'chest', obj: c }; }
      }
      for (const tr of g.traps) {                                         // desarmar uma armadilha do assassino (que você enxergou)
        if (tr.owner !== 'k' || tr.arm > 0 || tr.victim) continue;
        const d = Math.hypot(s.x - tr.x, s.y - tr.y);
        if (d < 1.15 && d < bd) { bd = d; best = { type: 'disarm', obj: tr }; }
      }
      for (const o of g.survivors) {                                      // soltar um colega preso
        if (o === s || !alive(o) || !(o.trapT > 0)) continue;
        const d = Math.hypot(s.x - o.x, s.y - o.y);
        if (d < 1.5 && d < bd) { bd = d; best = { type: 'free', obj: o }; }
      }
      return best;
    }
    // mochila: o rádio, a peça e os itens de uso (kit médico, armadilha) dividem os CFG.BAG espaços
    const slotsOf = (sv) => [sv.tool, sv.item].concat(sv.bag).filter(Boolean);
    const bagFree = (sv) => slotsOf(sv).length < CFG.BAG;
    g.slotsOf = slotsOf; g.bagFree = bagFree;
    function canTake(sv, it) { return it.kind === 'part' ? !sv.item && bagFree(sv) : bagFree(sv) && (it.kind !== 'radio' || !sv.tool); }
    function dropItem(sv, it) {
      if (!it) return;
      it.holder = null; it.x = it.cx = sv.x; it.y = it.cy = sv.y;
      if (sv.tool === it) { sv.tool = null; it.on = false; }
      if (sv.item === it) sv.item = null;
      const bi = sv.bag.indexOf(it); if (bi >= 0) sv.bag.splice(bi, 1);
    }
    function pickUp(it) {
      if (!canTake(s, it)) { if (s.human) popup('MOCHILA CHEIA', s.x, s.y - 1.5, '#ff9d5c'); return; }
      if (it.kind === 'radio') s.tool = it;
      else if (it.kind === 'medkit' || it.kind === 'trap') s.bag.push(it);
      else { if (s.item) dropItem(s, s.item); s.item = it; }
      it.holder = s;
      sfx('pick', pan(s.x, s.y));
      if (s.human) popup(it.kind === 'radio' ? 'RÁDIO! (Q LIGA/DESLIGA)' : it.kind === 'medkit' ? 'KIT MÉDICO (F USA)' : it.kind === 'trap' ? 'ARMADILHA (F COLOCA)' : it.kind === 'part' ? PARTS[it.part].name + ' (' + (it.veh === 'car' ? 'CARRO' : 'BARCO') + ')' : 'PEGOU', s.x, s.y - 1.5, '#9bd3f0');
    }
    // usar um espaço da mochila (índice na ordem rádio, peça, itens de uso) ou, sem índice, o primeiro kit médico
    function startHeal(it) {
      let tgt = null;
      if (s.hp < g.hpMax) tgt = s;
      else { let bd = CFG.HEAL_RANGE; for (const o of g.survivors) if (o !== s && alive(o) && !o.hidden && o.hp < g.hpMax) { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < bd) { bd = d; tgt = o; } } }
      if (!tgt) { if (s.human) popup('NINGUÉM PRECISA DE CURA', s.x, s.y - 1.5, '#8a8a99'); return false; }
      s.heal = { t: 0, target: tgt, it };
      if (s.human) popup(tgt === s ? 'CURANDO... (FIQUE PARADO)' : 'CURANDO COLEGA...', s.x, s.y - 1.5, '#7dffa0');
      return true;
    }
    function useSlot(i, kind) {
      const list = slotsOf(s), it = i === undefined ? (s.bag.find((b) => b.kind === (kind || 'medkit')) || (kind ? null : s.bag.find((b) => b.kind === 'trap'))) : list[i];
      if (!it || s.vault || s.hidden || s.heal) return;
      if (it.kind === 'medkit') startHeal(it);
      else if (it.kind === 'radio') { if (s.tool && s.tool.batt > 0) { s.tool.on = !s.tool.on; sfx('click'); } }
      else if (it.kind === 'trap') { if (g.placeTrap) g.placeTrap(s, it); }
      else if (it.kind === 'part') { dropItem(s, it); sfx('click'); }
    }
    function trapSpotOk(x, y) { return !hitsCircle(x, y, 0.3) && g.traps.every((q) => Math.hypot(q.x - x, q.y - y) > 1.2); }
    function addTrap(owner, x, y) { g.traps.push({ owner, x, y, cx: x, cy: y, arm: CFG.TRAP_ARM, victim: null }); sfx('trapSet', pan(x, y)); }
    g.placeTrap = (sv, it) => {                                           // sobrevivente põe a armadilha da mochila aos pés
      if (!trapSpotOk(sv.x, sv.y)) { if (sv.human) popup('LUGAR RUIM', sv.x, sv.y - 1.5, '#ff9d5c'); return false; }
      addTrap('s', sv.x, sv.y);
      sv.bag.splice(sv.bag.indexOf(it), 1); g.items.splice(g.items.indexOf(it), 1);
      if (sv.human) popup('ARMADILHA ARMADA!', sv.x, sv.y - 1.5, '#ffd23f');
      g.stats.trapsSet = (g.stats.trapsSet || 0) + 1;
      return true;
    };
    function killerPlaceTrap() {
      if (k.traps <= 0 || k.trapCD > 0 || !trapSpotOk(k.x, k.y)) return false;
      k.traps--; k.trapCD = 1; addTrap('k', k.x, k.y); g.stats.trapsSet = (g.stats.trapsSet || 0) + 1;
      if (KH) popup('ARMADILHA ARMADA! (' + k.traps + ' RESTAM)', k.x, k.y - 1.5, '#ffd23f');
      return true;
    }
    function trapTick(dt) {
      k.trapCD = Math.max(0, k.trapCD - dt);
      for (let i = g.traps.length - 1; i >= 0; i--) {
        const tr = g.traps[i];
        if (tr.arm > 0) { tr.arm -= dt; continue; }
        if (tr.victim) {
          const v = tr.victim;
          if (v === k ? k.state !== 'trapped' : (!(v.trapT > 0) || v.dead)) g.traps.splice(i, 1);
          continue;
        }
        if (tr.owner === 'k') {
          for (const v of g.survivors) {
            if (!alive(v) || v.hidden || v.vault || v.trapT > 0 || Math.hypot(v.x - tr.x, v.y - tr.y) >= CFG.TRAP_R) continue;
            v.trapT = CFG.S_TRAP_T; v.x = tr.x; v.y = tr.y; v.heal = null; v.acting = null; tr.victim = v;
            sfx('trapSnap', pan(v.x, v.y)); popup('PRESO!', v.x, v.y - 1.5, '#ff4d4d'); alert(v.x, v.y); g.stats.trapped = (g.stats.trapped || 0) + 1;
            if (v.human) feel(v, 5, 0.2);
            break;
          }
        } else if (k.state !== 'intro' && k.state !== 'trapped' && k.state !== 'kvault' && Math.hypot(k.x - tr.x, k.y - tr.y) < CFG.TRAP_R) {
          k.state = 'trapped'; k.t = 0; k.vault = null; k.x = tr.x; k.y = tr.y; tr.victim = k;
          sfx('trapSnap', pan(k.x, k.y)); popup('PRESO!', k.x, k.y - 1.6, '#ffd23f'); g.stats.kTrapped = (g.stats.kTrapped || 0) + 1;
          if (KH) feel(k, 5, 0.2);
        }
      }
    }
    function startSkill() { s.skill = { t: 0, tz: 1.5 + rnd() * 3.6 }; if (s.human) sfx('skill'); }
    function endSkill(result) {
      const o = s.acting && s.acting.obj;
      if (result === 'fail' || result === 'miss') {
        g.stats.skillFail++;
        if (o) o.progress = Math.max(0, o.progress - CFG.SKILL_FAIL);
        if (s.human) feel(s, 5, 0.12);
        sfx('bang', pan(s.x, s.y));
        popup(KH ? 'ALGO EXPLODIU!' : 'FALHOU!', s.x, s.y - 1.5, '#ff4d4d');
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
      sfx('genDone', pan(o.cx, o.cy));
      popup('GERADOR PRONTO!', o.cx, o.cy - 1.4, '#7dffa0');
      alert(o.cx, o.cy);               // a explosão de luz denuncia o gerador
      if (g.gensDone >= g.need && !g.door.powered) {
        g.door.powered = true;
        if (g.phone) { g.phone.state = 'ready'; popup('ENERGIA LIGADA! USE O TELEFONE', g.phone.cx, g.phone.cy - 2.2, '#ffd23f'); sfx('gates'); }
        else { popup('PORTA PRINCIPAL LIBERADA!', g.door.cx, dSouth ? H - 3 : 3, '#ffd23f'); sfx('gates'); }
      }
    }
    function enterLocker(sv, l) {
      if (l.occ) return;
      g.stats.hides++;
      l.occ = sv; sv.hidden = l; sv.hideT = 0; sv.acting = null; sv.skill = null; sv.noise = 0;
      sv.x = l.cx; sv.y = l.cy; sv.face = Math.atan2(l.ny, l.nx);
      l.t = 0; sfx('click', pan(l.cx, l.cy));
      if (sv.human) popup('ESCONDIDO (E: SAIR)', l.cx, l.cy - 1.4, '#9bd3f0');
    }
    function exitLocker(sv, forced) {
      const l = sv.hidden;
      if (!l) return;
      l.occ = null; sv.hidden = null; l.t = 0;
      sv.x = l.stand.x; sv.y = l.stand.y; sv.face = Math.atan2(l.ny, l.nx);
      sv.invuln = Math.max(sv.invuln, forced ? 0.4 : 0.2);
      sfx('click', pan(l.cx, l.cy));
    }
    function openChest(c, sv) {
      c.open = true; c.t = 0; g.stats.chests = (g.stats.chests || 0) + 1;
      sfx('chest', pan(c.cx, c.cy));
      if (!c.loot) { if (sv.human) popup('VAZIO', c.cx, c.cy - 1.3, '#8a8a99'); return; }
      const it = spawnItem(c.loot, c.cx, c.cy);
      if (bagFree(sv)) { it.holder = sv; sv.bag.push(it); } else { it.x = it.cx = c.stand.x; it.y = it.cy = c.stand.y; }     // mochila cheia: cai na frente do baú
      if (sv.human) popup(c.loot === 'medkit' ? 'KIT MÉDICO!' : 'ARMADILHA!', c.cx, c.cy - 1.3, '#7dffa0');
    }
    // o assassino abre o armário: quem estiver dentro é arrancado de lá e levado um golpe
    function openLocker(l) {
      l.checked = g.time; l.t = 0; sfx('creak', pan(l.cx, l.cy));
      const v = l.occ;
      if (v) {
        g.stats.finds++;
        exitLocker(v, true);
        use(v); hurt();
        popup('ENCONTRADO!', l.cx, l.cy - 1.4, '#ff4d4d');
        k.last = { x: v.x, y: v.y }; k.lastV = { x: 0, y: 0 }; k.target = v; k.aware = 'hunt'; k.lost = 0;
      } else popup('VAZIO', l.cx, l.cy - 1.2, '#8a8a99');
    }
    // entrar no veículo = escapar (quem entrou já não pode ser alcançado); ele parte depois de um tempo ou quando lota
    function boardVehicle(v, sv) {
      if (!alive(sv) || v.seated >= v.seats) return;
      v.seated++; v.pax.push(sv.id);
      if (sv.item) { g.items.splice(g.items.indexOf(sv.item), 1); sv.item = null; }
      sv.escaped = true; sv.vault = null; g.escapedCount++; sv.via = v.kind; g.via[v.kind]++;
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
      sfx('bang', pan(v.cx, v.cy)); g.shake = Math.max(g.shake, 3);
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
            sfx('engine', pan(v.cx, v.cy));
          }
        } else if (v.state === 'leaving') {
          v.anim += dt;
          if (v.anim >= (v.kind === 'car' ? 5 : 6.5)) { v.state = 'gone'; if (v.kind === 'car') g.door.pass = false; }
        }
      }
    }
    // chat da ligação (só para quem joga de sobrevivente): a atendente pergunta, você responde com 1/2/3 ou tocando; é só ambientação, não muda as regras
    const CALL = [
      { q: ['190, EMERGÊNCIA. O QUE ESTÁ ACONTECENDO?', 'CENTRAL DE EMERGÊNCIA, QUAL É O PROBLEMA?', 'POLÍCIA, BOA NOITE. PODE FALAR.'],
        a: ['TEM UM ASSASSINO AQUI!', 'SOCORRO! ESTAMOS PRESOS NUM ACAMPAMENTO!', 'PRECISO DE AJUDA, É URGENTE!', 'ALGUÉM ESTÁ TENTANDO NOS MATAR!'] },
      { q: ['CALMA, ESTOU TE OUVINDO. ONDE VOCÊS ESTÃO?', 'RESPIRE FUNDO. ME DIGA A SUA LOCALIZAÇÃO.', 'CERTO. QUAL É O LOCAL EXATO?'],
        a: ['ACAMPAMENTO DO LAGO, NA FLORESTA', 'NÃO SEI, É UM LUGAR ENORME!', 'PERTO DE UM TELEFONE, NO MEIO DO NADA', 'NUM ACAMPAMENTO COM PORTÃO AO NORTE'] },
      { q: ['QUANTAS PESSOAS ESTÃO COM VOCÊ?', 'ALGUÉM ESTÁ FERIDO?', 'VOCÊS ESTÃO EM QUANTOS?'],
        a: ['SOMOS QUATRO, COM EU', 'SÓ EU AQUI, NÃO SEI DOS OUTROS', 'ALGUÉM FOI FERIDO, RÁPIDO!', 'NOS SEPARAMOS, NÃO SEI'] },
      { q: ['O AGRESSOR ESTÁ PERTO DE VOCÊ AGORA?', 'ELE ESTÁ VENDO VOCÊ?', 'CONSEGUE OUVIR ELE POR PERTO?'],
        a: ['NÃO SEI, ESTOU OUVINDO PASSOS!', 'PODE APARECER A QUALQUER MOMENTO!', 'POR ENQUANTO NÃO, MAS SEM TEMPO', 'FALA BAIXO, ELE PODE OUVIR!'] },
      { q: ['ENTENDI. MANTENHA A LINHA, ESTOU ACIONANDO A VIATURA.', 'JÁ ESTOU ENVIANDO UMA EQUIPE. FIQUE ESCONDIDO.', 'CERTO, DESPACHANDO AS VIATURAS AGORA.'],
        a: ['POR FAVOR, VENHAM LOGO!', 'OBRIGADO, VAMOS AGUENTAR!', 'QUANTO TEMPO VAI DEMORAR?'] }
    ];
    const pickOf = (arr) => arr[(rnd() * arr.length) | 0];
    Object.defineProperty(g, 'call', { get() { return g.survivors[meIdx] ? g.survivors[meIdx].call || null : null; } });
    function callBeat(o) {
      if (!s.human) return;
      const c = s.call || (s.call = { lines: [], stage: -1, choices: null, last: g.time, done: false });
      const back = c.lines.length && g.time - c.last > 4.5;
      c.last = g.time;
      if (back) c.lines.push({ who: 'att', text: pickOf(['ALÔ? AINDA ESTÁ AÍ?', 'VOLTOU? CONTINUE, ESTOU OUVINDO.']), t: g.time });
      const want = Math.min(CALL.length - 1, Math.floor(o.progress / 0.2));
      while (c.stage < want) {
        if (c.choices) c.lines.push({ who: 'you', text: '...', t: g.time });      // não respondeu a tempo
        c.stage++;
        const st = CALL[c.stage], pool = st.a.slice(), ch = [];
        while (ch.length < 3 && pool.length) ch.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
        c.lines.push({ who: 'att', text: pickOf(st.q), t: g.time });
        c.choices = ch;
      }
    }
    g.chatReply = (i, sv) => {
      const c = (sv || g.survivors[meIdx]).call;
      if (!c || !c.choices || !c.choices[i]) return false;
      c.lines.push({ who: 'you', text: c.choices[i], t: g.time }); c.choices = null; c.last = g.time;
      sfx('click');
      return true;
    }
    function callEnd(ph) {
      for (const v of g.survivors) { const c = v.call; if (!c || c.done) continue;
      c.choices = null; c.done = true; c.last = g.time;
      c.lines.push({ who: 'att', text: 'VIATURA A CAMINHO. CHEGA EM CERCA DE ' + Math.round(CFG.ROUTES.policeEta) + ' SEGUNDOS. AGUENTEM!', t: g.time }); }
    }
    function callPolice(ph) {
      callEnd(ph);
      ph.state = 'coming'; ph.eta = CFG.ROUTES.policeEta; ph.calls++;
      for (const v of g.survivors) if (v.acting && v.acting.obj === ph) v.acting = null;
      popup('A POLÍCIA FOI CHAMADA!', ph.cx, ph.cy - 2.2, '#7ad0ff');
      sfx('siren', pan(ph.cx, ph.cy)); g.shake = Math.max(g.shake, 2);
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
          popup('A POLÍCIA CHEGOU! CORRA PARA O PORTÃO', g.door.cx, dSouth ? H - 4 : 4, '#7ad0ff');
        }
      } else if (ph.state === 'here') {
        ph.win -= dt;
        if (ph.win <= 0) {
          ph.state = 'ready'; ph.progress = 0; g.door.opened = false; g.door.t = 0;
          popup('A POLÍCIA FOI EMBORA... LIGUE DE NOVO', g.door.cx, dSouth ? H - 4 : 4, '#ff9d5c');
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
        if (s.tick <= 0) { s.tick = 0.55; if (s.human || Math.hypot(o.cx - g.pl.x, o.cy - g.pl.y) < 12) sfx('repair', pan(o.cx, o.cy)); }
        if (o.progress >= 1) finishGen(o);
      } else if (tg.type === 'phone') {
        s.noise = CFG.NOISE_PHONE; o.noisyT = g.time;
        o.progress = Math.min(1, o.progress + dt / routeT('phone') * (o.w === 0 ? 1 : CFG.TEAM_BONUS));
        o.w++;
        if (s.tick <= 0) { s.tick = 0.5; sfx('click', pan(o.cx, o.cy)); }
        callBeat(o);
        if (o.progress >= 1) callPolice(o);
      } else if (tg.type === 'hide') {
        s.noise = 1;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / CFG.HIDE_T;
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; enterLocker(s, o); }
      } else if (tg.type === 'install') {
        const pt = s.item.part;
        s.noise = CFG.NOISE_REPAIR; o.noisyT = g.time;
        o.wp[pt] = (o.wp[pt] || 0) + dt / routeT(o.kind + 'Part') * (o.w0 === 0 ? 1 : CFG.TEAM_BONUS);
        o.w0++;
        if (s.tick <= 0) { s.tick = 0.55; sfx('repair', pan(o.cx, o.cy)); }
        if (o.wp[pt] >= 1) {
          o.parts[pt] = true; o.order.push(pt); o.wp[pt] = 0;
          g.items.splice(g.items.indexOf(s.item), 1); s.item = null; s.acting = null;
          sfx('genDone', pan(o.cx, o.cy)); popup(PARTS[pt].name + ' INSTALADA!', o.cx, o.cy - 2.2, '#7dffa0');
          alert(o.cx, o.cy);
          if (o.need.every((n) => o.parts[n])) { o.state = 'ready'; popup(o.kind === 'car' ? 'CARRO PRONTO! LIGUE O MOTOR' : 'BARCO PRONTO! EMPURRE-O PARA A ÁGUA', o.cx, o.cy - 3.4, '#ffd23f'); }
        }
      } else if (tg.type === 'start') {
        s.noise = CFG.NOISE_ENGINE; o.noisyT = g.time;
        o.startP = Math.min(1, o.startP + dt / routeT(o.kind + 'Start') * (o.w0 === 0 ? 1 : CFG.TEAM_BONUS));
        o.w0++;
        if (s.tick <= 0) { s.tick = 0.45; sfx(o.kind === 'car' ? 'engine' : 'repair', pan(o.cx, o.cy)); }
        if (o.startP >= 1) {
          o.state = 'started'; o.leaveT = -1; s.acting = null;
          sfx('engine', pan(o.cx, o.cy)); alert(o.cx, o.cy); g.shake = Math.max(g.shake, 2);
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
        if (s.tick <= 0) { s.tick = 0.4; sfx('repair', pan(o.cx, o.cy)); }
        if (o.progress >= 1) { o.opened = true; o.t = 0; sfx('doorOpen'); popup('PORTA ABERTA!', o.cx, dSouth ? H - 3 : 3, '#7dffa0'); }
      } else if (tg.type === 'chest') {
        s.noise = 1.2;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / CFG.CHEST_T;
        if (s.tick <= 0) { s.tick = 0.4; sfx('creak', pan(o.cx, o.cy)); }
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; s.acting = null; openChest(o, s); }
      } else if (tg.type === 'disarm') {
        s.noise = 0.8;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / CFG.TRAP_DISARM;
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; s.acting = null; g.traps.splice(g.traps.indexOf(o), 1); sfx('click', pan(o.x, o.y)); if (s.human) popup('DESARMADA', o.x, o.y - 1, '#7dffa0'); }
      } else if (tg.type === 'free') {
        s.noise = 1;
        if (s.pickFor !== o) { s.pickFor = o; s.pickP = 0; }
        s.pickP += dt / CFG.FREE_T;
        if (s.pickP >= 1) { s.pickP = 0; s.pickFor = null; s.acting = null; o.trapT = 0; sfx('pick', pan(o.x, o.y)); popup('SOLTOU!', o.x, o.y - 1.4, '#7dffa0'); }
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
      s.vault = v; s.jumpT = 0; s.calm = Math.max(s.calm, CFG.FEAR_RELIEF); s.fear *= 0.7;
      g.stats.vaults++;
      sfx(v.kind === 'crash' ? 'glass' : 'vault', pan(s.x, s.y));
    }
    // allowOpen: pular pallet caído / janela aberta. Bots pulam sozinhos ao chegar; a pessoa precisa apertar ESPAÇO (jump). Janela fechada: só se estiver CORRENDO contra ela (quebra).
    function tryVault(ax, ay, len, walkMode, allowOpen) {
      // pallet caído
      for (const p of g.pallets) {
        if (p.state !== 'down' || !allowOpen) continue;
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
        if (w.state === 'closed') { if (walkMode || !allowOpen) continue; kind = 'crash'; }   // andando: precisa abrir (AGIR); correndo só atravessa se a pessoa decidir pular (SHIFT+ESPAÇO)
        else if (!allowOpen) continue;
        else kind = walkMode ? 'walk' : 'run';
        const dur = kind === 'crash' ? CFG.VAULT_CRASH : kind === 'walk' ? CFG.VAULT_WALK : CFG.VAULT_RUN;
        startVault({ t: 0, dur, x0: s.x, y0: s.y, x1, y1, kind, win: w, did: false, dx: -away * w.nx, dy: -away * w.ny });
        return;
      }
    }
    // algo para pular aqui perto? (janela aberta/quebrada ou pallet caído, perto o bastante e de frente)
    function findVaultable(v) {
      for (const p of g.pallets) {
        if (p.state !== 'down') continue;
        const rx = v.x - p.cx, ry = v.y - p.cy, along = rx * p.nx + ry * p.ny, lat = -rx * p.ny + ry * p.nx;
        if (Math.abs(along) < 1.2 && Math.abs(along) > 0.2 && Math.abs(lat) < 0.7) return p;
      }
      for (const w of g.windows) {
        if (w.state === 'closed') continue;
        const rx = v.x - w.cx, ry = v.y - w.cy, along = rx * w.nx + ry * w.ny, lat = -rx * w.ny + ry * w.nx;
        if (Math.abs(along) < 1.25 && Math.abs(along) > 0.2 && Math.abs(lat) < 0.7) return w;
      }
      return null;
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
      // medo: sobe rápido quando o assassino está perto e te vendo, cai devagar quando ele some
      {
        const kd = Math.hypot(k.x - s.x, k.y - s.y);
        const ft = (k.state !== 'intro' && k.state !== 'stun' && k.state !== 'stumble' && k.state !== 'trapped' && !s.hidden && kd < CFG.FEAR_R && hasLOS(k, s)) ? clamp(1 - (kd - CFG.FEAR_MIN) / (CFG.FEAR_R - CFG.FEAR_MIN), 0, 1) : 0;
        s.fear += (ft - s.fear) * Math.min(1, dt * (ft > s.fear ? 5 : 1.3));
        s.calm = Math.max(0, s.calm - dt);
      }
      s.noise = 0; s.acting = null;
      if (s.hidden) {                                                   // dentro do armário: quieto; E (ou empurrar o direcional) sai
        s.hideT += dt; s.moving = false; s.walk = 0;
        if (s.hideT > 0.25 && (inp.actPress || Math.hypot(inp.ax || 0, inp.ay || 0) > 0.6)) exitLocker(s, false);
        return;
      }
      if (s.trapT > 0) {                                                // preso na armadilha: parado e gritando por uns segundos
        s.trapT -= dt; s.moving = false; s.walk = 0; s.noise = 2.5; s.heal = null; s.vault = null;
        s.invuln = Math.max(0, s.invuln - dt);
        return;
      }
      if (!s.vault) unstick(s, CFG.R_S);
      s.invuln = Math.max(0, s.invuln - dt);
      s.burst = Math.max(0, s.burst - dt);
      s.vaultCD = Math.max(0, s.vaultCD - dt);
      s.jumpT = Math.max(0, (s.jumpT || 0) - dt);
      s.tripT = Math.max(0, s.tripT - dt);
      if (inp.jump) s.jumpT = 0.3;                                       // ESPAÇO: pular (vale por 0,3 s, para apertar um pouco antes de chegar)
      if (s.vault) { s.heal = null; advanceVault(dt); return; }
      let ax = inp.ax || 0, ay = inp.ay || 0;
      // cura em andamento: parado, ~6 s; mexer, agir, ser acertado ou o alvo sumir cancela
      if (s.heal) {
        const h = s.heal;
        const stop = Math.hypot(ax, ay) > 0.35 || (inp.act && s.interact) || s.tripT > 0 || !alive(h.target) || h.target.hp >= g.hpMax || !s.bag.includes(h.it) || (h.target !== s && Math.hypot(h.target.x - s.x, h.target.y - s.y) > CFG.HEAL_RANGE + 0.5);
        if (stop) { if (s.human && h.t > 0.3 && Math.hypot(ax, ay) > 0.35) popup('CURA CANCELADA', s.x, s.y - 1.5, '#ff9d5c'); s.heal = null; }
        else {
          h.t += dt; s.noise = 1; s.moving = false; s.walk = 0;
          if (h.t >= CFG.HEAL_T) {
            h.target.hp = Math.min(g.hpMax, h.target.hp + 1);
            s.bag.splice(s.bag.indexOf(h.it), 1); g.items.splice(g.items.indexOf(h.it), 1);
            sfx('heal', pan(s.x, s.y)); popup('+1 VIDA', h.target.x, h.target.y - 1.6, '#7dffa0'); g.stats.heals = (g.stats.heals || 0) + 1;
            s.heal = null;
          }
          return;
        }
      }
      const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      s.moving = len > 0.12;
      const walkMode = !!inp.walk;
      if (inp.act && !s.moving && s.interact) {
        s.acting = s.interact; s.walk = 0;
        { const io = s.interact.obj; s.face = Math.atan2((io.cy === undefined ? io.y : io.cy) - s.y, (io.cx === undefined ? io.x : io.cx) - s.x); }
        act(dt);
        return;
      }
      if (s.moving) {
        s.noise = walkMode ? CFG.NOISE_WALK : CFG.NOISE_MOVE;
        // com medo, correr faz tropeçar: a chance cresce com o quadrado do medo (pallet/janela dão coragem por um instante; andar não tropeça)
        if (!walkMode && s.fear > 0.25 && s.tripT <= 0 && s.calm <= 0 && rnd() < CFG.FEAR_TRIP * s.fear * s.fear * dt) {
          s.tripT = CFG.SURV_TRIP_T; s.calm = CFG.FEAR_CALM; g.stats.trips = (g.stats.trips || 0) + 1;
          sfx('trip', pan(s.x, s.y)); popup('TROPEÇOU!', s.x, s.y - 1.5, '#ff9d5c'); dust(s.x, s.y + 0.3, 6, '#8b7355'); s.noise = CFG.NOISE_MOVE * 1.6;
        }
        const sp = CFG.RUN * (s.burst > 0 ? CFG.BURST : 1) * (walkMode ? CFG.WALK : 1) * (s.tripT > 0 ? CFG.SURV_TRIP_SLOW : 1);
        moveBy(s, ax * sp * dt, ay * sp * dt, CFG.R_S);
        s.face = Math.atan2(ay, ax);
        s.runMode = !walkMode; s.walk += dt * (walkMode ? 7 : 11);
        if (!s.vaultCD) tryVault(ax, ay, len, walkMode, !s.human || s.jumpT > 0);
      } else {
        s.walk = 0;
        if (s.human && s.jumpT > 0 && !s.vaultCD) tryVault(Math.cos(s.face), Math.sin(s.face), 1, true, true);   // parado de frente para a janela/pallet: pula
      }
      // porta principal aberta: quem chega nela escapa
      if (g.door.opened && (dSouth ? s.y > H - 1.7 : s.y < 1.7) && Math.abs(s.x - g.door.cx) < 2.2) escapeSurvivor(s);
    }

    // ---------- assassino ----------
    function kickGen(o) {
      o.progress = Math.max(0, o.progress - CFG.KICK); g.stats.kicks++;
      sfx('bang', pan(k.x, k.y)); g.shake = Math.max(g.shake, 2);
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
      sfx('vault', pan(k.x, k.y));
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
      for (const l of g.lockers) {
        const d = Math.hypot(k.x - l.cx, k.y - l.cy);
        if (d < CFG.LOCKER_RANGE && d < bd && (k.x - l.cx) * l.nx + (k.y - l.cy) * l.ny > 0.2) { bd = d; best = { type: 'locker', obj: l }; }
      }
      if (g.arsenal && k.traps < CFG.K_TRAPS) {
        const d = Math.hypot(k.x - g.arsenal.cx, k.y - g.arsenal.cy);
        if (d < CFG.LOCKER_RANGE && d < bd) { bd = d; best = { type: 'arsenal', obj: g.arsenal }; }
      }
      for (const tr of g.traps) {
        if (tr.owner !== 's' || tr.arm > 0 || tr.victim) continue;
        const d = Math.hypot(k.x - tr.x, k.y - tr.y);
        if (d < 1.2 && d < bd) { bd = d; best = { type: 'disarm', obj: tr }; }
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
        if (!alive(v) || v.hidden) continue;
        const d = Math.hypot(v.x - e.x, v.y - e.y);
        if (d < bd) { bd = d; best = v; }
      }
      if (!best) for (const v of g.survivors) if (alive(v)) { best = v; break; }        // todos escondidos: o assassino continua "vivo" (procura)
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
        moveBy(k, ax * (map.kind === 'camp' ? CFG.K_SPEED_P_CAMP : CFG.K_SPEED_P) * (sneak ? CFG.STEALTH_SPEED : 1) * dt, ay * (map.kind === 'camp' ? CFG.K_SPEED_P_CAMP : CFG.K_SPEED_P) * (sneak ? CFG.STEALTH_SPEED : 1) * dt, CFG.R_K);
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
        sfx('windup', pan(k.x, k.y));
        return;
      }
      if (inp.use) killerPlaceTrap();
      if (inp.actPress && g.kInteract) {
        const it = g.kInteract;
        if (it.type === 'break') startBreak(it.obj, 'pallet');
        else if (it.type === 'smash') startBreak(it.obj, 'window');
        else if (it.type === 'sabotage') startBreak(it.obj, 'sabotage');
        else if (it.type === 'locker') startBreak(it.obj, 'locker');
        else if (it.type === 'arsenal') { k.traps = Math.min(CFG.K_TRAPS, k.traps + 1); sfx('pick', pan(k.x, k.y)); popup('+1 ARMADILHA (' + k.traps + '/' + CFG.K_TRAPS + ')', k.x, k.y - 1.5, '#ffd23f'); }
        else if (it.type === 'disarm') { g.traps.splice(g.traps.indexOf(it.obj), 1); sfx('click', pan(k.x, k.y)); popup('DESARMOU', k.x, k.y - 1.3, '#cfcfd8'); }
        else kickGen(it.obj);
      }
    }

    // tropeço: depois do atordoamento ele cambaleia, desvia do rumo e cai de vez em quando
    function doStumble(dt, inp) {
      k.t += dt;
      const f = Math.max(0, 1 - k.t / CFG.STUMBLE_T);
      let hx, hy;
      if (KH) { hx = inp.ax || 0; hy = inp.ay || 0; }
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
          sfx('trip', pan(k.x, k.y)); dust(k.x, k.y + 0.3, 6, '#8b7355'); g.shake = Math.max(g.shake, 2);
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
      k.learn = Math.max(0, k.learn - 0.02 * dt);
      k.sneakPrev = k.stealth; k.stealth = false;                       // o stealth é recalculado a cada quadro
      k.energy = Math.min(1, k.energy + CFG.STEALTH_REGEN * dt);
      // quem o assassino está olhando agora: o alvo atual, senão o mais próximo
      let tgt = (k.target && alive(k.target) && !k.target.hidden) ? k.target : nearestAlive(k);
      if (tgt) use(tgt);
      const dx = tgt ? s.x - k.x : 0, dy = tgt ? s.y - k.y : 0, d = tgt ? Math.hypot(dx, dy) : 99;

      if (k.state === 'intro') { k.t += dt; if (k.t >= g.introT) { k.state = 'chase'; k.t = 0; k.aware = 'patrol'; } return; }
      if (k.state === 'stun') {
        k.t += dt;
        if (k.t >= CFG.STUN) {
          k.state = 'stumble'; k.t = 0; k.trip = 0; k.tripCD = 0.45; k.ph = rnd() * 6.28;
          sfx('trip', pan(k.x, k.y));
        }
        return;
      }
      if (k.state === 'trapped') {                                      // preso na armadilha: parado; o jogador pode se debater (ESPAÇO/E) para soltar um pouco mais rápido
        k.t += dt; k.moving = false;
        if (KH && (inp.drop || inp.actPress)) k.t += 0.22;
        if (k.t >= CFG.K_TRAP_T) { k.state = 'chase'; k.t = 0; popup('SOLTOU-SE', k.x, k.y - 1.6, '#cfcfd8'); }
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
      const P = KH;                        // assassino de pessoa: números mais generosos
      if (k.state === 'windup') {
        k.t += dt;
        if (k.t >= (P ? CFG.WINDUP_P : CFG.WINDUP)) { k.state = 'lunge'; k.t = 0; k.hitDone = false; g.stats.lunges++; sfx('lunge', pan(k.x, k.y)); }
        return;
      }
      if (k.state === 'lunge') {
        k.t += dt;
        if (P || k.learn * CFG.LEARN > 0.1) {             // o bote "puxa" um pouco para o alvo mais perto da mira (a IA só depois de errar algumas vezes)
          const tv = nearestAlive(k);
          if (tv) {
            const ddx = tv.x - k.x, ddy = tv.y - k.y;
            if (Math.hypot(ddx, ddy) < 3.2) {
              const cur = Math.atan2(k.ldy, k.ldx), diff = angDiff(Math.atan2(ddy, ddx), cur);
              if (Math.abs(diff) < 0.9) { const hm = P ? CFG.HOMING : CFG.HOMING * Math.min(1, k.learn * CFG.LEARN * 1.3), na = cur + clamp(diff, -hm * dt, hm * dt); k.ldx = Math.cos(na); k.ldy = Math.sin(na); }
            }
          }
        }
        const lsp = P ? CFG.K_LUNGE_P : CFG.K_LUNGE;
        moveBy(k, k.ldx * lsp * dt, k.ldy * lsp * dt, CFG.R_K);
        k.moving = true; k.walk += dt * 16;
        if (!k.hitDone) {
          for (const v of g.survivors) {
            if (!alive(v) || v.hidden || v.invuln > 0 || Math.hypot(v.x - k.x, v.y - k.y) >= (P ? CFG.HIT_R_P : CFG.HIT_R)) continue;
            use(v); k.hitDone = true; hurt(); break;
          }
        }
        if (k.t >= CFG.LUNGE_T) {
          if (!k.hitDone) { sfx('whiff', pan(k.x, k.y)); k.learn = Math.min(1, k.learn + 0.22); }        // errou o golpe: o ar cortado e o corpo freando; a IA aprende
          else k.learn = Math.max(0, k.learn - 0.35);
          k.state = 'recover'; k.t = 0;
          k.dur = k.hitDone ? (P ? CFG.RECOVER_HIT_P : CFG.RECOVER_HIT) : (P ? CFG.RECOVER_MISS_P : CFG.RECOVER_MISS);
        }
        return;
      }
      if (k.state === 'break') {
        if (KH && Math.hypot(inp.ax || 0, inp.ay || 0) > 0.6 && k.t > 0.3) { k.state = 'chase'; k.t = 0; k.pal = null; return; }
        k.t += dt;
        const o = k.pal, isWin = k.brkKind === 'window', isSab = k.brkKind === 'sabotage', isLck = k.brkKind === 'locker';
        if (isSab && !sabotageable(o)) { k.pal = null; k.state = 'chase'; k.t = 0; return; }       // alguém embarcou / já foi sabotado
        if (Math.floor(k.t / 0.5) > k.brk) {
          k.brk++; sfx(isWin ? 'glassHit' : isLck ? 'creak' : 'breakHit', pan(k.x, k.y)); g.shake = Math.max(g.shake, 1.5);
          if (isWin) glass(o.cx, o.cy, 3, 0, 0);
        }
        if (k.t >= (isWin ? CFG.WIN_BREAK_T : isSab ? CFG.SABOTAGE_T : isLck ? CFG.LOCKER_OPEN_T : CFG.BREAK_T)) {
          if (isLck) openLocker(o);
          else if (isSab) { sabotageVehicle(o); g.stats.sabotages++; }
          else if (isWin) { breakWindow(o, true); popup('QUEBROU!', o.cx, o.cy - 1.2, '#9bd3f0'); }
          else {
            o.state = 'broken'; o.respawn = CFG.RESPAWN;
            g.stats.breaks++;
            sfx('breakDone', pan(o.cx, o.cy));
            dust(o.cx, o.cy, 16, '#a07a45');
          }
          k.pal = null; k.state = 'chase'; k.t = 0;
        }
        return;
      }

      // o assassino (jogador ou IA) só sabe o progresso dos geradores que viu; o gerador é um bloco sólido: olha para a face voltada para ele
      const kvis = KH ? 1 : diff.kp;
      g.gens.forEach((o, i) => {
        if (o.done) return;
        const dd = Math.hypot(k.x - o.cx, k.y - o.cy) || 1;
        if (canSee(k.x, k.y, k.face, true, o.cx + (k.x - o.cx) / dd * 0.75, o.cy + (k.y - o.cy) / dd * 0.75, kvis)) k.genMem[i] = o.progress;
      });
      if (KH) { playerKiller(dt, inp, dx, dy, d); return; }
      if (!tgt) return;                                 // todos já saíram da partida

      // ---- percepção, com os mesmos limites de uma pessoa: ENXERGA (raio + cone, linha de vista) ou OUVE (ruído, posição aproximada) ----
      let seen = null, sd = 1e9, heard = null, hd = 1e9;
      for (const v of g.survivors) {
        if (!alive(v) || v.hidden) continue;
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
        // aprendeu que o alvo desvia na hora do bote? mira onde ele VAI estar (antecipação cresce a cada erro)
        const lead = (0.1 + 0.8 * k.learn * CFG.LEARN) * 0.5;
        const px2 = s.x + (s.vx || 0) * lead * 2, py2 = s.y + (s.vy || 0) * lead * 2, adx = px2 - k.x, ady = py2 - k.y, n = Math.hypot(adx, ady) || 1;
        k.ldx = adx / n; k.ldy = ady / n; k.face = Math.atan2(ady, adx);
        k.state = 'windup'; k.t = 0;
        sfx('windup', pan(k.x, k.y));
        return;
      }

      // ---- objetivo de movimento ----
      let gx, gy, speed = CFG.K_SPEED * diff.kp;
      if (!hunting && (k.aware === 'search' || k.aware === 'patrol') && k.energy > (k.sneakPrev ? 0.02 : 0.5)) {   // espreita enquanto procura
        k.stealth = true; k.energy = Math.max(0, k.energy - (CFG.STEALTH_DRAIN + CFG.STEALTH_REGEN) * dt); speed *= CFG.STEALTH_SPEED;
      }
      if (hunting) {
        if (seen) { gx = s.x; gy = s.y; }
        else if (k.target && k.target.hidden) {                           // viu o alvo se esconder: vai direto ao armário
          const l = k.target.hidden; gx = l.stand.x; gy = l.stand.y;
          if (Math.hypot(k.x - gx, k.y - gy) < 1.2) { k.face = Math.atan2(l.cy - k.y, l.cx - k.x); startBreak(l, 'locker'); return; }
        } else {                                            // perdeu de vista: segue para onde a pessoa ia
          if (!k.last) k.last = { x: s.x, y: s.y };
          const lv = k.lastV || { x: 0, y: 0 }, tt = Math.min(k.lost, 1.2);
          gx = k.last.x + lv.x * tt; gy = k.last.y + lv.y * tt;
        }
      }
      else if (k.aware === 'search') {
        if (!k.last) k.last = { x: s.x, y: s.y };
        gx = k.last.x; gy = k.last.y; speed *= CFG.PATROL_SPEED;
        if (k.lockerGoal) {                                                // vai conferir um armário perto de onde perdeu a pista
          const l = k.lockerGoal; gx = l.stand.x; gy = l.stand.y;
          if (Math.hypot(k.x - gx, k.y - gy) < 1.2) { k.lockerGoal = null; k.face = Math.atan2(l.cy - k.y, l.cx - k.x); startBreak(l, 'locker'); return; }
        } else if (Math.hypot(k.x - gx, k.y - gy) < 1.4) {
          k.wait += dt;
          if (k.wait > 0.5 && !k.lockerChecked) {                           // chegou ao último ponto: dá uma olhada nos armários próximos (nem todos)
            k.lockerChecked = true;
            let bl = null, bdl = 6;
            for (const l of g.lockers) { const d = Math.hypot(l.cx - k.x, l.cy - k.y); if (d < bdl && g.time - l.checked > 25) { bdl = d; bl = l; } }
            if (bl && rnd() < 0.7) { k.lockerGoal = bl; k.wait = 0; }
          }
          if (k.wait > CFG.SEARCH_WAIT) { k.aware = 'patrol'; k.goal = null; }
        } else k.lockerChecked = false;
      } else {
        speed *= CFG.PATROL_SPEED;
        if (!k.goal) k.goal = pickGoal();
        if (!k.goal) { k.aware = 'search'; k.last = k.last || { x: k.x, y: k.y }; k.wait = 0; return; }
        const o = k.goal;
        gx = o.cx; gy = o.cy;
        if (Math.hypot(k.x - gx, k.y - gy) < (o.range ? o.range - 0.5 : 1.7)) {
          o.visited = g.time; k.goal = null;
          if (g.vehicles.includes(o) && sabotageable(o)) { k.face = Math.atan2(o.cy - k.y, o.cx - k.x); startBreak(o, 'sabotage'); return; }
          if (g.gens.includes(o) && k.traps > 0 && rnd() < 0.55) killerPlaceTrap();                       // arma uma armadilha no caminho de quem repara
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
      if (hunting && seen && walkClear(k.x, k.y, s.x, s.y)) { tx = s.x; ty = s.y; }      // vê e o caminho em linha reta está livre: vai direto
      else {                                                                            // vê através da janela/pallet mas não dá para passar reto: contorna / pula / quebra pelo caminho
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

    // corredor livre em linha reta (para o corpo do assassino)? janelas são de vidro: dá para ver através, mas não passar
    function walkClear(x0, y0, x1, y1) {
      const dd = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(dd / 0.3));
      for (let i = 1; i <= n; i++) { const f = i / n; if (hitsCircle(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, CFG.R_K * 0.85)) return false; }
      return true;
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
      // preso na quina de um tile sólido (não deveria, mas um bot nunca pode ficar parado): sai para o vizinho livre mais próximo
      const sx0 = Math.floor(s.x), sy0 = Math.floor(s.y);
      if (hardBlocked(sx0, sy0)) {
        let bn = null, bd2 = 1e9;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (hardBlocked(sx0 + d[0], sy0 + d[1])) continue;
          const dd = Math.hypot(sx0 + d[0] + 0.5 - s.x, sy0 + d[1] + 0.5 - s.y);
          if (dd < bd2) { bd2 = dd; bn = d; }
        }
        if (bn) { const mx = sx0 + bn[0] + 0.5 - s.x, my = sy0 + bn[1] + 0.5 - s.y, l = Math.hypot(mx, my) || 1; out.ax = mx / l; out.ay = my / l; return; }
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
        const ni = (dSouth ? H - 2 : 1) * W + Math.floor(g.door.cx);
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
    const botSkill = () => (KH ? diff.bot : 1);
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
      const fleeing = !!K && ai.aware > 0 && ((kd < 7 && (kSpd > 0.6 || kd < 3.5)) || (approaching && kd < CFG.AI_FLEE) || s.burst > 0);   // um assassino parado a mais de 3,5 tiles não assusta
      // armário: perdeu o assassino de vista com ele por perto? esconde-se (só alguns bots gostam; quem ele viu entrar é achado)
      if (s.hidden) {
        const l = s.hidden;
        if (ai.hideSeen !== l) { ai.hideSeen = l; ai.hideUntil = g.time + 8 + rnd() * 10; }
        if (g.time > ai.hideUntil && !(K && kd < 5)) { out.actPress = true; ai.hideCD = g.time + 30; }           // sai quando a barra parece limpa
        return out;
      }
      if (ai.hideGoal && (ai.hideGoal.occ || g.time > ai.hideGoalT || (K && K.live))) ai.hideGoal = null;
      if (!ai.hideGoal && g.lockers.length && ai.hideLike < 0.7 && g.time > ai.hideCD && ai.aware > 0 && K && !K.live && kd > 3.5 && kd < 20 && !s.vault) {
        let bl = null, bdl = 9;
        for (const l of g.lockers) {
          if (l.occ) continue;
          const dm = Math.hypot(l.stand.x - s.x, l.stand.y - s.y), dk = Math.hypot(l.stand.x - K.x, l.stand.y - K.y);
          if (dm < bdl && dk > dm + 2) { bdl = dm; bl = l; }
        }
        if (bl) { ai.hideGoal = bl; ai.hideGoalT = g.time + 8; ai.fieldT = 0; }
      }
      if (ai.hideGoal) {
        const l = ai.hideGoal;
        if (s.interact && s.interact.obj === l) { out.act = true; return out; }
        ai.fieldT -= dt;
        if (ai.fieldT <= 0) { dijkstra(ai.fT, l.stand.x, l.stand.y, true, { until: s }); ai.fieldT = 0.4; }
        steer(ai.fT, out, l.stand);
        return out;
      }
      // ferido, com kit médico e o assassino longe: para e se cura
      if (!fleeing && !s.vault && s.hp < g.hpMax && s.bag.some((b) => b.kind === 'medkit') && (!K || kd > 14)) { if (!s.heal) out.use = true; return out; }
      ai.mode = fleeing ? 'flee' : (g.door.powered ? 'exit' : 'repair');
      if (!fleeing) ai.plan = null; else ai.planAge += dt;

      if (ai.mode === 'flee') {
        if (K && K.live && kd > 2.5 && kd < 8 && !s.vault && g.time - (ai.trapAt || -99) > 6 && s.bag.some((b) => b.kind === 'trap')) { out.use = true; out.useKind = 'trap'; ai.trapAt = g.time; }     // foge e deixa uma armadilha no caminho do assassino
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
        if (ai.fieldT <= 0) { dijkstra(ai.fT, g.door.cx, g.door.inY, true, { until: s }); ai.fieldT = 0.4; }
        steer(ai.fT, out, { x: g.door.cx, y: g.door.inY });
        winPass = k0;
        return out;
      }
      // um rádio ou uma peça de veículo à vista? vai pegar (rádio: só quem não tem; peça: só quem não carrega uma e se o veículo ainda precisa dela)
      const fetchOk = (f) => !f.holder && (f.loot !== undefined ? !f.open && bagFree(s) : f.kind === 'medkit' ? bagFree(s) : f.kind === 'radio' ? !s.tool && bagFree(s) : (!s.item && bagFree(s) && partWanted(f)));
      if (!ai.fetch && !fleeing && bagFree(s)) {                       // kit médico à vista ou baú conhecido: ferido procura longe; saudável, só perto e se for do tipo "saqueador"
        const needMed = s.hp < g.hpMax && !s.bag.some((b) => b.kind === 'medkit');
        for (const it of g.items) if (!ai.fetch && !it.holder && it.kind === 'medkit' && (needMed || ai.lootLike < 0.6) && canSee(s.x, s.y, s.face, false, it.x, it.y, botSkill())) { ai.fetch = it; ai.fieldT = 0; }
        if (!ai.fetch && (needMed || ai.lootLike < 0.5)) {
          let bc = null, bdc = needMed ? 55 : 14;
          for (const c of g.chests) { if (c.open || !c.known) continue; const d = Math.hypot(c.cx - s.x, c.cy - s.y); if (d < bdc) { bdc = d; bc = c; } }
          if (bc) { ai.fetch = bc; ai.fieldT = 0; }
        }
      }
      if (!ai.fetch) {
        for (const it of g.items) {
          if (it.holder) continue;
          if (it.kind === 'radio' ? s.tool : (it.kind !== 'part' || s.item || !partWanted(it))) continue;
          if (canSee(s.x, s.y, s.face, false, it.x, it.y, botSkill())) { ai.fetch = it; ai.fieldT = 0; break; }
        }
      }
      if (ai.fetch && !fetchOk(ai.fetch)) ai.fetch = null;
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
          tg = { cx: g.door.cx + (s.id - 1.5) * 3.2, cy: dSouth ? H - 13.5 + (s.id % 2) * 3 : 13.5 - (s.id % 2) * 3, rally: true };
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
      steer(ai.fT, out, tg === g.door ? { x: g.door.cx, y: g.door.inY } : gp);
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
        if (canSee(sv.x, sv.y, sv.face, false, o.cx + (sv.x - o.cx) / dd * 0.75, o.cy + (sv.y - o.cy) / dd * 0.75, 1)) { o.known = true; if (sv.human || !KH) popupKnown(o); }
      }
      for (const c of g.chests) {
        if (c.known) continue;
        const dd = Math.hypot(sv.x - c.cx, sv.y - c.cy) || 1;
        if (dd < 14 && canSee(sv.x, sv.y, sv.face, false, c.cx + (sv.x - c.cx) / dd * 0.75, c.cy + (sv.y - c.cy) / dd * 0.75, 1)) c.known = true;
      }
      for (const e of g.explore) if (!e.seen && Math.hypot(sv.x - e.x, sv.y - e.y) < (e.kind === 'cabin' ? 4.5 : 6)) e.seen = true;
    }
    function popupKnown(o) { if (humanIds.length) popup('GERADOR ENCONTRADO', o.cx, o.cy - 1.2, '#7dffa0'); }

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

    // inputs (multijogador, só o anfitrião): { s: { [id do sobrevivente]: entrada }, k: entrada do assassino }; sem isso, `inp` vale para o único humano
    g.update = function (dt, inp, inputs) {
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
        const sin = sv.human ? (inputs && inputs.s ? inputs.s[sv.id] || {} : inp) : aiSurvivor(dt);
        if (sin.reply !== undefined && sin.reply !== null && sv.human) g.chatReply(sin.reply, sv);
        if (sv.human && sin.drop && !s.skill && !findDroppable()) sin.jump = true;
        if (s.skill && (sin.press || sin.drop || sin.actPress)) pressSkill();
        else if (!sv.hidden && (sin.drop || (sin.actPress && !sv.interact))) { if (!(sin.drop || findDroppable()) && s.item) dropItem(s, s.item); else tryDrop(); }
        if (sin.use && !s.skill) useSlot(undefined, sin.useKind); else if (sin.slot !== undefined && sin.slot !== null && !s.skill) useSlot(sin.slot);
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
        if (alive(sv) && !sv.hidden) sv.near = findDroppable(); else sv.near = null;
        if (g.over) return;
      }

      const ms = g.survivors[meIdx];
      g.vaultHint = (ms.human && alive(ms) && !ms.hidden && !ms.vault) ? findVaultable(ms) : null;
      g.interact = ms.interact;
      g.kInteract = KH ? findKillerInteract() : null;
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
      k.spx = kox; k.spy = koy;
      updateKiller(dt, inputs && inputs.k ? inputs.k : inp);
      k.vx = (k.x - kox) / (dt || 1); k.vy = (k.y - koy) / (dt || 1);
      trapTick(dt);
      stepTick();
      // quem está escondido num armário respira baixinho: só se ouve de muito perto (nunca balança o armário)
      for (const l of g.lockers) {
        if (!l.occ || k.state === 'intro') continue;
        const d = Math.hypot(k.x - l.cx, k.y - l.cy);
        if (d >= 3.6) { l.br = 0.4; continue; }
        l.br = (l.br === undefined ? 0.4 : l.br) - dt;
        if (l.br <= 0) { l.br = 2.0 + rnd() * 0.5; const pn = pan(l.cx, l.cy); pendingVol = (1 - d / 3.6) * 0.55; sfx('breath', pn); }
      }
      g.nearList = [];
      for (const sv of g.survivors) if (alive(sv) && sv.near && (role === 'killer' ? sv.human || KH : sv === g.survivors[meIdx])) g.nearList.push({ pal: sv.near, sv });
      g.near = g.survivors[meIdx].near;
      const ref = role === 'killer' ? nearestAlive(k) : g.survivors[meIdx];
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
    g.solid = solid; g.hitsCircle = hitsCircle;
    g.sfxAt = (name, x, y) => sfx(name, pan(x, y));     // som posicional (testes e efeitos avulsos)
    g.dropDirFor = (sv, p) => { use(sv); return dropDir(p); };
    // ======================================================================================
    // Multijogador: o anfitrião roda o jogo de verdade (g.snapshot) e as outras telas guardam uma CÓPIA (opts.replica) que só aplica o que chega
    // (g.applySnapshot), anda os próprios passos na frente (g.predict) e calcula localmente o que depende de quem olha (g.replicaUpdate).
    // ======================================================================================
    const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
    const KST = ['intro', 'chase', 'windup', 'lunge', 'recover', 'stun', 'stumble', 'break', 'kvault', 'trapped'];
    const PST = ['up', 'falling', 'down', 'broken'], WST = ['closed', 'opening', 'open', 'broken'];
    const VST = ['build', 'ready', 'started', 'leaving', 'gone'], PHST = ['locked', 'ready', 'coming', 'here'];
    const VKIND = ['walk', 'run', 'crash', 'pallet'], ACTT = ['gen', 'phone', 'door', 'window', 'hide', 'install', 'start', 'board', 'item', 'chest', 'disarm', 'free'];
    const IKIND = ['radio', 'part', 'medkit', 'trap'], PARTN = Object.keys(PARTS), BRK = ['pallet', 'window', 'locker', 'sabotage'];
    const objIdx = (type, o) => type === 'gen' ? g.gens.indexOf(o) : type === 'window' ? g.windows.indexOf(o) : type === 'hide' ? g.lockers.indexOf(o)
      : (type === 'install' || type === 'start' || type === 'board') ? g.vehicles.indexOf(o) : type === 'item' ? o.id : type === 'chest' ? g.chests.indexOf(o)
      : type === 'disarm' ? g.traps.indexOf(o) : type === 'free' ? o.id : 0;
    const idxObj = (type, i) => type === 'gen' ? g.gens[i] : type === 'phone' ? g.phone : type === 'door' ? g.door : type === 'window' ? g.windows[i] : type === 'hide' ? g.lockers[i]
      : (type === 'install' || type === 'start' || type === 'board') ? g.vehicles[i] : type === 'item' ? g.items.find((q) => q.id === i) : type === 'chest' ? g.chests[i]
      : type === 'disarm' ? g.traps[i] : type === 'free' ? g.survivors[i] : null;
    function encSurv(v) {
      const vt = v.vault, ac = v.acting;
      return [r2(v.x), r2(v.y), r2(v.face), v.hp, (v.dead ? 1 : 0) | (v.escaped ? 2 : 0) | (v.moving ? 4 : 0) | (v.runMode === false ? 8 : 0) | (v.human ? 16 : 0),
        r2(v.tripT), r2(v.trapT || 0), r2(v.invuln), r2(v.burst), v.hidden ? g.lockers.indexOf(v.hidden) : -1,
        vt ? [VKIND.indexOf(vt.kind), r2(vt.t), r2(vt.dur), r2(vt.x0), r2(vt.y0), r2(vt.x1), r2(vt.y1), vt.win ? g.windows.indexOf(vt.win) : -1, vt.did ? 1 : 0, vt.dx || 0, vt.dy || 0] : 0,
        v.item ? v.item.id : -1, v.tool ? v.tool.id : -1, v.bag.map((b) => b.id),
        v.heal ? [r2(v.heal.t), v.heal.target.id, v.heal.it.id] : 0, r2(v.fear), ac ? [ACTT.indexOf(ac.type), objIdx(ac.type, ac.obj)] : 0,
        r2(v.deadAt || 0), r2(v.deadFace || 0), v.skill ? [r2(v.skill.t), r2(v.skill.tz)] : 0, v.det || 0, r2(v.pickP || 0), r2(v.noise || 0),
        v.call ? [v.call.lines.slice(-5).map((l) => [l.who === 'att' ? 0 : l.who === 'you' ? 1 : 2, l.text, r2(g.time - l.t)]), v.call.choices || 0, v.call.stage, r2(g.time - v.call.last), v.call.done ? 1 : 0] : 0,
        r2(v.skillCD || 0)];
    }
    function decSurv(v, a, local) {
      if (local || !v._init) { v.x = a[0]; v.y = a[1]; }
      v.tx = a[0]; v.ty = a[1]; v._init = true;
      v.face = a[2]; v.hp = a[3]; v.dead = !!(a[4] & 1); v.escaped = !!(a[4] & 2); v.moving = !!(a[4] & 4); v.runMode = (a[4] & 8) ? false : true; v.human = !!(a[4] & 16);
      v.tripT = a[5]; v.trapT = a[6]; v.invuln = a[7]; v.burst = a[8]; v.hidden = a[9] >= 0 ? g.lockers[a[9]] : null;
      const vt = a[10]; v.vault = vt ? { kind: VKIND[vt[0]], t: vt[1], dur: vt[2], x0: vt[3], y0: vt[4], x1: vt[5], y1: vt[6], win: vt[7] >= 0 ? g.windows[vt[7]] : null, did: !!vt[8], dx: vt[9], dy: vt[10] } : null;
      const byId = (id) => (id >= 0 ? g.items.find((q) => q.id === id) || null : null);
      v.item = byId(a[11]); v.tool = byId(a[12]); v.bag = a[13].map(byId).filter(Boolean);
      v.heal = a[14] ? { t: a[14][0], target: g.survivors[a[14][1]], it: byId(a[14][2]) } : null; v.fear = a[15];
      v.acting = a[16] ? { type: ACTT[a[16][0]], obj: idxObj(ACTT[a[16][0]], a[16][1]) } : null; if (v.acting && !v.acting.obj) v.acting = null;
      v.deadAt = a[17]; v.deadFace = a[18]; v.skill = a[19] ? { t: a[19][0], tz: a[19][1] } : null; v.det = a[20]; v.pickP = a[21]; v.noise = a[22];
      const c = a[23];
      v.call = c ? { lines: c[0].map((l) => ({ who: l[0] === 0 ? 'att' : l[0] === 1 ? 'you' : 'sys', text: l[1], t: g.time - l[2] })), choices: c[1] || null, stage: c[2], last: g.time - c[3], done: !!c[4] } : null;
      v.skillCD = a[24];
      v.dead = v.dead; v.interactDirty = true;
    }
    g.snapshot = function () {
      const k0 = k;
      return {
        T: r2(g.time), O: g.over ? [g.result === 'dead' ? 0 : 1, r2(g.overT)] : 0,
        st: [g.gensDone, g.escapedCount, g.deadCount, g.stats.stuns, g.stats.trips || 0, g.stats.hits, g.stats.lunges, g.stats.drops, g.stats.vaults, g.stats.breaks, g.via.gate, g.via.car, g.via.boat],
        s: g.survivors.map(encSurv),
        k: [r2(k0.x), r2(k0.y), r2(k0.face), KST.indexOf(k0.state), r2(k0.t), r2(k0.dur), r2(k0.trip), (k0.moving ? 1 : 0) | (k0.stealth ? 2 : 0) | (k0.hesitate ? 4 : 0) | (k0.hitDone ? 8 : 0), r2(k0.energy), k0.traps,
          k0.pal ? [BRK.indexOf(k0.brkKind), k0.brkKind === 'pallet' ? g.pallets.indexOf(k0.pal) : k0.brkKind === 'window' ? g.windows.indexOf(k0.pal) : k0.brkKind === 'locker' ? g.lockers.indexOf(k0.pal) : g.vehicles.indexOf(k0.pal)] : 0,
          r2(k0.ph), k0.vault ? [r2(k0.vault.dur), r2(k0.vault.x0), r2(k0.vault.y0), r2(k0.vault.x1), r2(k0.vault.y1), k0.vault.win ? g.windows.indexOf(k0.vault.win) : -1, k0.vault.dx || 0, k0.vault.dy || 0] : 0,
          r2(k0.ldx), r2(k0.ldy), g.gens.map((o, i) => r2(k0.genMem[i] || 0)), r2(k0.vx), r2(k0.vy), r2(k0.brk || 0)],
        G: g.gens.map((o) => [r3(o.progress), o.done ? 1 : 0, o.known ? 1 : 0, g.time - (o.noisyT || -99) < 1.5 ? 1 : 0]),
        P: g.pallets.map((p) => [PST.indexOf(p.state), r2(p.t), p.dir.x, p.dir.y]),
        Wn: g.windows.map((w) => [WST.indexOf(w.state), r2(w.t), r2(w.prog), r2(w.usedT || 0)]),
        L: g.lockers.map((l) => [l.occ ? l.occ.id : -1, r2(l.t)]),
        C: g.chests.map((c) => [c.open ? 1 : 0, c.known ? 1 : 0, r2(c.t)]),
        V: g.vehicles.map((v) => [VST.indexOf(v.state), v.need.map((n) => (v.parts[n] ? 1 : 0)).join(''), v.need.map((n) => r2(v.wp[n] || 0)), v.order.map((n) => v.need.indexOf(n)), r2(v.startP), v.seated, r2(v.leaveT), r2(v.anim), v.pax]),
        Ph: g.phone ? [PHST.indexOf(g.phone.state), r3(g.phone.progress), r2(g.phone.eta), r2(g.phone.win), g.phone.calls] : 0,
        D: [g.door.powered ? 1 : 0, g.door.opened ? 1 : 0, r3(g.door.progress), r2(g.door.t), g.door.pass ? 1 : 0],
        I: g.items.map((it) => [it.id, IKIND.indexOf(it.kind), it.part ? PARTN.indexOf(it.part) : -1, r2(it.x), r2(it.y), it.holder ? it.holder.id : -1, it.on ? 1 : 0, r2(it.batt || 0)]),
        Tr: g.traps.map((t) => [t.owner === 'k' ? 0 : 1, r2(t.x), r2(t.y), r2(t.arm), t.victim ? (t.victim === k ? -2 : t.victim.id) : -1])
      };
    };
    g.applySnapshot = function (sn, localId) {
      g.time = sn.T;
      if (sn.O && !g.over) { g.over = true; g.result = sn.O[0] === 0 ? 'dead' : 'escaped'; g.overT = sn.O[1]; }
      const st = sn.st; g.gensDone = st[0]; g.escapedCount = st[1]; g.deadCount = st[2]; g.stats.stuns = st[3]; g.stats.trips = st[4]; g.stats.hits = st[5]; g.stats.lunges = st[6]; g.stats.drops = st[7]; g.stats.vaults = st[8]; g.stats.breaks = st[9];
      g.via.gate = st[10]; g.via.car = st[11]; g.via.boat = st[12];
      sn.G.forEach((a, i) => { const o = g.gens[i]; o.progress = a[0]; o.done = !!a[1]; o.known = !!a[2]; o.noisyT = a[3] ? g.time : -99; });
      sn.P.forEach((a, i) => { const p = g.pallets[i]; p.state = PST[a[0]]; p.t = a[1]; p.dir = { x: a[2], y: a[3] }; });
      sn.Wn.forEach((a, i) => { const w = g.windows[i]; w.state = WST[a[0]]; w.t = a[1]; w.prog = a[2]; w.usedT = a[3]; });
      sn.C.forEach((a, i) => { const c = g.chests[i]; c.open = !!a[0]; c.known = !!a[1]; c.t = a[2]; });
      // objetos soltos e armadilhas são recriados; depois os sobreviventes resolvem as referências por id
      g.items = sn.I.map((a) => { const kind = IKIND[a[1]], it = { id: a[0], kind, x: a[3], y: a[4], cx: a[3], cy: a[4], holder: null, batt: a[7], on: !!a[6] }; if (a[2] >= 0) { it.part = PARTN[a[2]]; it.veh = PARTS[it.part].veh; } return it; });
      g.traps = sn.Tr.map((a) => ({ owner: a[0] === 0 ? 'k' : 's', x: a[1], y: a[2], cx: a[1], cy: a[2], arm: a[3], victim: null, vic: a[4] }));
      sn.s.forEach((a, i) => decSurv(g.survivors[i], a, i === localId));
      g.survivors.forEach((v) => { for (const it of g.items) if (it === v.item || it === v.tool || v.bag.includes(it)) it.holder = v; });
      g.traps.forEach((t) => { t.victim = t.vic === -2 ? k : t.vic >= 0 ? g.survivors[t.vic] : null; });
      sn.L.forEach((a, i) => { const l = g.lockers[i]; l.occ = a[0] >= 0 ? g.survivors[a[0]] : null; l.t = a[1]; });
      sn.V.forEach((a, i) => { const v = g.vehicles[i]; v.state = VST[a[0]]; v.need.forEach((n, j) => { v.parts[n] = a[1][j] === '1'; v.wp[n] = a[2][j]; }); v.order = a[3].map((j) => v.need[j]); v.startP = a[4]; v.seated = a[5]; v.leaveT = a[6]; v.anim = a[7]; v.pax = a[8]; });
      if (sn.Ph && g.phone) { const p = g.phone; p.state = PHST[sn.Ph[0]]; p.progress = sn.Ph[1]; p.eta = sn.Ph[2]; p.win = sn.Ph[3]; p.calls = sn.Ph[4]; }
      g.door.powered = !!sn.D[0]; g.door.opened = !!sn.D[1]; g.door.progress = sn.D[2]; g.door.t = sn.D[3]; g.door.pass = !!sn.D[4];
      const a = sn.k;
      if (!k._init) { k.x = a[0]; k.y = a[1]; k._init = true; }
      k.tx = a[0]; k.ty = a[1]; k.face = a[2]; k.state = KST[a[3]]; k.t = a[4]; k.dur = a[5]; k.trip = a[6]; k.moving = !!(a[7] & 1); k.stealth = !!(a[7] & 2); k.hesitate = !!(a[7] & 4); k.hitDone = !!(a[7] & 8); k.energy = a[8]; k.traps = a[9];
      k.brkKind = a[10] ? BRK[a[10][0]] : 'pallet'; k.pal = a[10] ? (a[10][0] === 0 ? g.pallets[a[10][1]] : a[10][0] === 1 ? g.windows[a[10][1]] : a[10][0] === 2 ? g.lockers[a[10][1]] : g.vehicles[a[10][1]]) : null;
      k.ph = a[11]; k.vault = a[12] ? { dur: a[12][0], x0: a[12][1], y0: a[12][2], x1: a[12][3], y1: a[12][4], win: a[12][5] >= 0 ? g.windows[a[12][5]] : null, dx: a[12][6], dy: a[12][7] } : null;
      k.ldx = a[13]; k.ldy = a[14]; a[15].forEach((v, i) => { k.genMem[i] = v; }); k.vx = a[16]; k.vy = a[17]; k.brk = a[18];
    };
    // eventos (sons, textos, partículas, pings, tremores): cada tela toca com a própria posição de escuta
    g.playEvent = function (e) {
      if (e.t === 'p') g.popups.push({ text: e.tx, x: e.x, y: e.y, t: 0, color: e.c });
      else if (e.t === 'd') dust(e.x, e.y, e.n, e.c);
      else if (e.t === 'g') glass(e.x, e.y, e.n, e.dx, e.dy);
      else if (e.t === 'k') g.pings.push({ x: e.x, y: e.y, t: g.time });
      else if (e.t === 'f') {
        if (e.w === -1) { if (Math.hypot(e.x - g.pl.x, e.y - g.pl.y) < e.r) g.shake = Math.max(g.shake, e.sh); }
        else if ((e.w === 'k' && role === 'killer') || (e.w !== 'k' && role === 'survivor' && e.w === meIdx)) { g.shake = Math.max(g.shake, e.sh); g.flash = Math.max(g.flash, e.fl); }
      } else if (e.t === 's') {
        let p, v = 1;
        if (e.x === null || e.x === undefined) p = 0;
        else {
          const d = Math.hypot(e.x - g.pl.x, e.y - g.pl.y);
          p = clamp((e.x - g.pl.x) / 10, -0.8, 0.8);
          if (e.ex && e.ex.range) v = d < 0.5 ? 0.3 * e.ex.loud : e.ex.loud * clamp(1 - d / e.ex.range, 0, 1);
          else v = d < CFG.HEAR_NEAR ? 1 : Math.pow(Math.max(0, 1 - (d - CFG.HEAR_NEAR) / (CFG.HEAR_FAR - CFG.HEAR_NEAR)), 2);
        }
        if (v > 0.03) sfxOut(e.n, p, v, e.ex);
      }
    };
    // movimento previsto do jogador desta tela (só quando está livre; o resto vem do anfitrião)
    g.predict = function (dt, inp) {
      if (role === 'killer') {
        if (k.state !== 'chase') return;
        const ax0 = inp.ax || 0, ay0 = inp.ay || 0, len = Math.hypot(ax0, ay0);
        if (len < 0.12) { k.moving = false; return; }
        const ax = len > 1 ? ax0 / len : ax0, ay = len > 1 ? ay0 / len : ay0, sneak = !inp.drop && !!inp.stealth && k.energy > 0.02, sp = (map.kind === 'camp' ? CFG.K_SPEED_P_CAMP : CFG.K_SPEED_P) * (sneak ? CFG.STEALTH_SPEED : 1);
        const ox = k.x, oy = k.y; moveBy(k, ax * sp * dt, ay * sp * dt, CFG.R_K); k.face = Math.atan2(ay, ax);
        if (Math.hypot(k.x - ox, k.y - oy) > 0.0005) { k.moving = true; k.walk += dt * 11; } else k.moving = false;
        return;
      }
      const v = g.survivors[meIdx];
      if (v.dead || v.escaped || v.hidden || v.vault || v.heal || v.trapT > 0) return;
      let ax = inp.ax || 0, ay = inp.ay || 0; const len = Math.hypot(ax, ay);
      if (len > 1) { ax /= len; ay /= len; }
      if (inp.act && len <= 0.12 && v.interact) return;                   // segurando AGIR parado: quem manda é o anfitrião
      v.moving = len > 0.12;
      if (!v.moving) { v.walk = 0; return; }
      const walkMode = !!inp.walk, sp = CFG.RUN * (v.burst > 0 ? CFG.BURST : 1) * (walkMode ? CFG.WALK : 1) * (v.tripT > 0 ? CFG.SURV_TRIP_SLOW : 1);
      moveBy(v, ax * sp * dt, ay * sp * dt, CFG.R_S); v.face = Math.atan2(ay, ax); v.runMode = !walkMode; v.walk += dt * (walkMode ? 7 : 11);
    };
    // a cada quadro da cópia: relógios locais, suavização dos outros jogadores e as dicas que dependem de quem olha
    g.replicaUpdate = function (dt) {
      g.time += dt;
      g.shake = Math.max(0, g.shake - dt * 22); g.flash = Math.max(0, g.flash - dt);
      for (const pu of g.popups) pu.t += dt; g.popups = g.popups.filter((pu) => pu.t < 1.1);
      for (const f of g.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; } g.fx = g.fx.filter((f) => f.t < f.life);
      g.pings = g.pings.filter((q) => g.time - q.t < 4);
      for (const p of g.pallets) p.t += dt; for (const w of g.windows) w.t += dt; for (const l of g.lockers) l.t += dt; for (const c of g.chests) c.t += dt; g.door.t += dt;
      for (const tr of g.traps) if (tr.arm > 0) tr.arm -= dt;
      const sm = Math.min(1, dt * 14);
      for (const v of g.survivors) {
        if (v.vault) v.vault.t = Math.min(v.vault.dur, v.vault.t + dt);
        if (v.heal) v.heal.t += dt;
        if (v.moving && v !== g.survivors[meIdx]) v.walk += dt * (v.runMode === false ? 7 : 11);
        if (v === g.survivors[meIdx] && role === 'survivor') continue;
        if (v.tx !== undefined) { if (Math.hypot(v.tx - v.x, v.ty - v.y) > 3) { v.x = v.tx; v.y = v.ty; } else { v.x += (v.tx - v.x) * sm; v.y += (v.ty - v.y) * sm; } }
      }
      if (k.state !== 'intro') k.t += dt;
      if (k.moving && role !== 'killer') k.walk += dt * 11;
      if (role !== 'killer' && k.tx !== undefined) { if (Math.hypot(k.tx - k.x, k.ty - k.y) > 3) { k.x = k.tx; k.y = k.ty; } else { k.x += (k.tx - k.x) * sm; k.y += (k.ty - k.y) * sm; } }
      for (const v of g.vehicles) if (v.state === 'leaving') v.anim += dt;
      // dicas locais
      const ms = g.survivors[meIdx];
      if (role === 'survivor' && alive(ms)) {
        use(ms); ms.interact = findInteract(); ms.near = ms.hidden ? null : findDroppable();
        g.vaultHint = (!ms.hidden && !ms.vault) ? findVaultable(ms) : null; g.interact = ms.interact; g.near = ms.near; g.pInteract = g.interact;
        g.nearList = ms.near ? [{ pal: ms.near, sv: ms }] : [];
      } else if (role === 'killer') {
        g.kInteract = findKillerInteract(); g.pInteract = g.kInteract; g.nearList = [];
        for (const sv of g.survivors) { if (!alive(sv) || sv.hidden) { sv.near = null; continue; } use(sv); sv.near = findDroppable(); if (sv.near && sv.human) g.nearList.push({ pal: sv.near, sv }); }
      }
      const ref = role === 'killer' ? nearestAlive(k) : ms;
      g.dist = ref ? Math.hypot(ref.x - k.x, ref.y - k.y) : 99;
      if (g.over) g.overT += dt;
    };
    // quem saiu da partida vira bot (sobrevivente) ou o assassino volta a ser a IA
    g.dropHuman = (key) => {
      if (key === 'k') { if (!KH) return; KH = false; g.killerHuman = false; k.aware = 'search'; k.last = { x: k.x, y: k.y }; k.lost = 0; if (k.state === 'intro') k.t = 0; return; }
      const sv = g.survivors[key]; if (!sv || !sv.human) return;
      sv.human = false; sv.ai = makeAI(key); sv.heal = null; const hi = humanIds.indexOf(key); if (hi >= 0) humanIds.splice(hi, 1);
    };
    g.setLocal = (role2, id) => { g.pl = role2 === 'killer' ? k : g.survivors[id]; };

    g.CFG = CFG;
    return g;
  }

  DP.VERSION = '0.0.2';          // versão do jogo (aparece no menu); a cada entrega sobe: 0.0.2, 0.0.3...
  DP.createGame = createGame;
  DP.CFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
