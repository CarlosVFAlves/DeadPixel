// Multijogador pelo "room" do artefato: sem servidor. O ANFITRIÃO roda o jogo de verdade; os outros jogadores mandam só os controles e recebem
// uma fotografia compacta do estado (~2 KB, 15 vezes por segundo) mais os eventos (sons, textos, partículas). Tudo viaja na "presença" de cada pessoa
// (o room entrega a presença de todos para todos, até ~30 vezes por segundo, limite de 4 KiB por pessoa).
// Este arquivo não usa DOM: recebe um objeto "room" com a mesma forma do `claude.use("room")` (ou um simulado, nos testes).
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};
  const VER = 1, SLOTS = ['k', 0, 1, 2, 3], MAXP = 3900;

  // ---------- util ----------
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mkCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  const nameOf = (peer) => 'J' + String(peer || '').slice(-3).toUpperCase();
  const slotIdx = (key) => SLOTS.indexOf(key);

  // ---------- eventos compactos ----------
  const SURF = ['grass', 'dirt', 'sand', 'wood', 'gravel'];
  function packEv(e) {
    if (e.t === 's') {
      if (e.ex && e.ex.surf) return [e.i, 's', e.n, e.x, e.y, SURF.indexOf(e.ex.surf) | (e.ex.heavy ? 8 : 0) | (e.ex.alt ? 16 : 0), Math.round(e.ex.loud * 100), e.ex.range];
      return [e.i, 's', e.n, e.x, e.y];
    }
    if (e.t === 'p') return [e.i, 'p', e.tx, e.x, e.y, e.c];
    if (e.t === 'd') return [e.i, 'd', e.x, e.y, e.n, e.c || 0];
    if (e.t === 'g') return [e.i, 'g', e.x, e.y, e.n, e.dx, e.dy];
    if (e.t === 'k') return [e.i, 'k', e.x, e.y];
    if (e.t === 'f') return [e.i, 'f', e.w, e.sh, e.fl, e.hs, e.x === undefined ? 0 : e.x, e.y === undefined ? 0 : e.y, e.r || 0];
    if (e.t === 'o') return [e.i, 'o', e.r];
    return null;
  }
  function unpackEv(a) {
    const i = a[0], t = a[1];
    if (t === 's') return { i, t, n: a[2], x: a[3], y: a[4], ex: a.length > 5 ? { surf: SURF[a[5] & 7], heavy: !!(a[5] & 8), alt: !!(a[5] & 16), loud: a[6] / 100, range: a[7] } : undefined };
    if (t === 'p') return { i, t, tx: a[2], x: a[3], y: a[4], c: a[5] };
    if (t === 'd') return { i, t, x: a[2], y: a[3], n: a[4], c: a[5] || undefined };
    if (t === 'g') return { i, t, x: a[2], y: a[3], n: a[4], dx: a[5], dy: a[6] };
    if (t === 'k') return { i, t, x: a[2], y: a[3] };
    if (t === 'f') return { i, t, w: a[2], sh: a[3], fl: a[4], hs: a[5], x: a[6], y: a[7], r: a[8] };
    return { i, t, r: a[2] };
  }

  // ---------- entrada compacta ----------
  // [seq, ax, ay, flags, cDrop, cAct, cPress, cRadio, cUse, cSlot, vSlot, cReply, vReply]
  function packInput(inp, st) {
    const c = st.c;
    if (inp.drop) c.drop++; if (inp.actPress) c.act++; if (inp.press) c.press++; if (inp.radio) c.radio++; if (inp.use) c.use++;
    if (inp.slot !== undefined && inp.slot !== null) { c.slot++; st.vSlot = inp.slot; }
    if (inp.reply !== undefined && inp.reply !== null) { c.reply++; st.vReply = inp.reply; }
    return [st.seq, Math.round((inp.ax || 0) * 100), Math.round((inp.ay || 0) * 100), (inp.walk ? 1 : 0) | (inp.act ? 2 : 0) | (inp.stealth ? 4 : 0), c.drop, c.act, c.press, c.radio, c.use, c.slot, st.vSlot, c.reply, st.vReply];
  }
  function unpackInput(a, last) {
    const inp = { ax: a[1] / 100, ay: a[2] / 100, walk: !!(a[3] & 1), act: !!(a[3] & 2), stealth: !!(a[3] & 4) };
    inp.drop = a[4] !== last[0]; inp.actPress = a[5] !== last[1]; inp.press = a[6] !== last[2]; inp.radio = a[7] !== last[3]; inp.use = a[8] !== last[4];
    if (a[9] !== last[5]) inp.slot = a[10]; if (a[11] !== last[6]) inp.reply = a[12];
    last[0] = a[4]; last[1] = a[5]; last[2] = a[6]; last[3] = a[7]; last[4] = a[8]; last[5] = a[9]; last[6] = a[11];
    return inp;
  }

  // ---------- anfitrião ----------
  function Host(room, name, opts) {
    opts = opts || {};
    const self = { code: opts.code || mkCode(), name: name || 'ANFITRIÃO', st: 'lobby', slots: [null, null, null, null, null], seed: 0, diff: opts.diff || 'normal', hostSlot: 1, over: false };
    const me = () => room.me();
    const guestsOf = () => room.peers().filter((p) => !p.isMe && p.presence && p.presence.c === self.code && p.presence.r === 'g' && p.presence.v === VER);
    let lastSn = 0, lastLobby = 0, lastEvSent = 0, inputs = {}, game = null, hostSlotKey = 0, t0 = 0, clock = 0, names = {};
    self.setHostSlot = (key) => { if (self.st !== 'lobby') return; const cur = self.slots[slotIdx(key)]; if (cur && cur !== me()) return; self.hostSlotKey = key; assign(); push(); };
    self.hostSlotKey = 0;
    function assign() {
      const gs = guestsOf(), ids = gs.map((p) => p.peer), mine = me();
      for (let i = 0; i < 5; i++) if (self.slots[i] && self.slots[i] !== mine && !ids.includes(self.slots[i])) self.slots[i] = null;
      for (let i = 0; i < 5; i++) if (self.slots[i] === mine) self.slots[i] = null;
      self.slots[slotIdx(self.hostSlotKey)] = mine;
      names = {}; names[mine] = self.name;
      for (const p of gs.slice().sort((a, b) => (a.peer < b.peer ? -1 : 1))) {
        names[p.peer] = p.presence.n || nameOf(p.peer);
        let have = self.slots.indexOf(p.peer);
        const want = p.presence.want === undefined ? -1 : slotIdx(p.presence.want);
        if (have >= 0 && (want < 0 || want === have)) continue;
        if (want >= 0 && !self.slots[want]) { if (have >= 0) self.slots[have] = null; self.slots[want] = p.peer; continue; }
        if (have >= 0) continue;
        const free = [1, 2, 3, 4, 0].find((i) => !self.slots[i]);
        if (free !== undefined) self.slots[free] = p.peer;
      }
    }
    function lobbyPresence() { return { v: VER, c: self.code, r: 'h', n: self.name, hs: [self.st, self.seed, self.diff, self.slots.map((s) => s || 0), self.slots.map((s) => (s ? names[s] || nameOf(s) : 0))] }; }
    function push() { room.presence(lobbyPresence()); }
    self.push = push;
    self.tick = (dt) => {
      clock += dt;
      if (self.st === 'lobby' && clock - lastLobby > 0.4) { lastLobby = clock; assign(); push(); }
    };
    // monta as opções do jogo a partir das vagas e cria o jogo do anfitrião (a tela de partida chama isto)
    self.start = (createGame, extra) => {
      assign();
      self.seed = 1 + Math.floor(Math.random() * 1e9);
      const humans = [], mine = me();
      for (let i = 1; i < 5; i++) if (self.slots[i]) humans.push(i - 1);
      const kh = !!self.slots[0], hostKey = SLOTS[self.slots.indexOf(mine)];
      const o = Object.assign({ map: 'camp', rng: mulberry(self.seed), survivors: 4, humans, killerHuman: kh, role: hostKey === 'k' ? 'killer' : 'survivor', me: hostKey === 'k' ? 0 : hostKey, difficulty: self.diff }, extra || {});
      game = createGame(o); game.record = true; self.game = game;
      for (const key of SLOTS) { const pid = self.slots[slotIdx(key)]; if (pid && pid !== mine) inputs[pid] = { key, last: [0, 0, 0, 0, 0, 0, 0], inp: {}, seq: 0, ts: clock }; }
      self.st = 'play'; self.hostKey = hostKey; lastSn = 0; push();
      return game;
    };
    // a cada quadro do anfitrião: devolve as entradas por vaga para game.update(dt, null, entradas)
    self.gather = (hostInp) => {
      const out = { s: {}, k: null }, mine = me();
      const hk = self.hostKey;
      if (hk === 'k') out.k = hostInp; else out.s[hk] = hostInp;
      for (const p of guestsOf()) {
        const rec = inputs[p.peer]; if (!rec) continue;
        const a = p.presence.in;
        if (a && a[0] !== rec.seq) { rec.seq = a[0]; rec.pulse = unpackInput(a, rec.last); rec.hold = rec.pulse; rec.ts = clock; }
        const h = rec.hold || {};
        const inp = Object.assign({}, h, rec.pulse || {});
        // pulsos valem só uma vez
        if (rec.pulse) { rec.pulse = null; }
        else { inp.drop = inp.actPress = inp.press = inp.radio = inp.use = false; inp.slot = undefined; inp.reply = undefined; }
        if (clock - rec.ts > 1.5) { inp.ax = 0; inp.ay = 0; inp.act = false; }       // ficou sem notícias: para
        if (rec.key === 'k') out.k = inp; else out.s[rec.key] = inp;
      }
      return out;
    };
    // quem saiu vira bot
    self.checkLeft = () => {
      if (!game) return;
      const ids = guestsOf().map((p) => p.peer);
      for (const pid of Object.keys(inputs)) if (!ids.includes(pid) && !inputs[pid].gone) { inputs[pid].gone = true; game.dropHuman(inputs[pid].key); }
    };
    self.send = (dt, ackNow) => {
      clock += dt;
      if (clock - lastSn < 1 / 15) return;
      lastSn = clock;
      const sn = game.snapshot();
      const evs = game.evq.filter((e) => e.i > lastEvSent - 40 && clock >= 0);       // reenvia uma janela de eventos recentes (o cliente descarta repetidos pelo id)
      const maxId = game.evq.length ? game.evq[game.evq.length - 1].i : 0;
      let ev = evs.slice(-26).map(packEv).filter(Boolean);
      const ak = []; for (const pid of Object.keys(inputs)) ak.push([pid, inputs[pid].seq]);
      const build = () => ({ v: VER, c: self.code, r: 'h', n: self.name, hs: [self.st, self.seed, self.diff, self.slots.map((s) => s || 0), self.slots.map((s) => (s ? names[s] || nameOf(s) : 0))], sn, ev, ak });
      let pl = build(), size = JSON.stringify(pl).length;
      while (size > MAXP && ev.length) { ev = ev.slice(Math.ceil(ev.length / 4)); pl = build(); size = JSON.stringify(pl).length; }
      self.lastSize = size;
      lastEvSent = maxId;
      room.presence(pl);
    };
    self.end = () => { self.st = 'over'; push(); };
    return self;
  }

  // ---------- convidado ----------
  function Guest(room, code, name) {
    const self = { code, name: name || nameOf(room.me()), want: undefined, st: 'lobby', slotKey: null, info: null, lastEv: 0, snapT: -1, ack: 0, seq: 0, pending: [], inSt: { seq: 0, c: { drop: 0, act: 0, press: 0, radio: 0, use: 0, slot: 0, reply: 0 }, vSlot: 0, vReply: 0 }, game: null, lastIn: null, sentAt: 0, clock: 0, hostGone: 0 };
    const hostPeer = () => room.peers().find((p) => !p.isMe && p.presence && p.presence.c === code && p.presence.r === 'h' && p.presence.v === VER) || null;
    function mine() { return { v: VER, c: code, r: 'g', n: self.name, want: self.want }; }
    self.join = () => room.presence(mine());
    let lastJoin = 0;
    self.tick = (dt) => { self.clock += dt; if (self.clock - lastJoin > 0.5 && !self.game) { lastJoin = self.clock; room.presence(mine()); } };       // reafirma a presença (o aviso de entrada pode se perder)
    self.setWant = (key) => { self.want = key; room.presence({ want: key }); };
    self.hostInfo = () => {
      const h = hostPeer(); if (!h) return null;
      const hs = h.presence.hs; if (!hs) return null;
      return { st: hs[0], seed: hs[1], diff: hs[2], slots: hs[3], names: hs[4], host: h.peer, n: h.presence.n };
    };
    self.mySlot = () => { const i = self.hostInfo() ? self.hostInfo().slots.indexOf(room.me()) : -1; return i >= 0 ? SLOTS[i] : null; };
    // cria a cópia do jogo quando o anfitrião inicia
    self.maybeStart = (createGame, extra) => {
      const hi = self.hostInfo();
      if (self.game || !hi || hi.st !== 'play') return null;
      const key = self.mySlot();
      if (key === null) return null;                                   // sem vaga: não dá para jogar
      const humans = []; for (let i = 1; i < 5; i++) if (hi.slots[i]) humans.push(i - 1);
      self.slotKey = key;
      self.game = createGame(Object.assign({ map: 'camp', rng: mulberry(hi.seed), survivors: 4, humans, killerHuman: !!hi.slots[0], role: key === 'k' ? 'killer' : 'survivor', me: key === 'k' ? 0 : key, difficulty: hi.diff, replica: true }, extra || {}));
      return self.game;
    };
    // quadro do convidado: manda os controles, anda na frente e aplica o que chegou do anfitrião
    self.frame = (dt, inp) => {
      const g = self.game; if (!g) return;
      self.clock += dt;
      self.seq++; self.inSt.seq = self.seq;
      const packed = packInput(inp, self.inSt);
      self.pending.push({ seq: self.seq, dt, inp: Object.assign({}, inp) });
      if (self.pending.length > 180) self.pending.shift();
      if (self.clock - self.sentAt > 1 / 30) { self.sentAt = self.clock; room.presence({ v: VER, c: code, r: 'g', n: self.name, want: self.want, in: packed }); }
      g.predict(dt, inp);
      const h = hostPeer();
      if (!h) { self.hostGone += dt; return; }
      self.hostGone = 0;
      const pl = h.presence;
      if (pl.sn && pl.sn.T !== self.snapT) {
        self.snapT = pl.sn.T;
        // eventos novos
        if (pl.ev) for (const a of pl.ev) { if (a[0] > self.lastEv) { self.lastEv = a[0]; const e = unpackEv(a); if (e.t === 'o') continue; g.playEvent(e); } }
        const role = g.role, idx = g.me;
        g.applySnapshot(pl.sn, role === 'survivor' ? idx : -1);
        let ack = 0; if (pl.ak) for (const a of pl.ak) if (a[0] === room.me()) ack = a[1];
        self.ack = ack;
        // reconciliação: parte da posição do anfitrião e refaz os controles que ele ainda não viu
        if (role === 'killer') { g.k.x = g.k.tx; g.k.y = g.k.ty; } else { const v = g.survivors[idx]; v.x = v.tx; v.y = v.ty; }
        self.pending = self.pending.filter((p) => p.seq > ack);
        for (const p of self.pending) g.predict(p.dt, p.inp);
      }
      g.replicaUpdate(dt);
    };
    self.leave = () => room.presence({ c: null, r: null, in: null, want: null });
    return self;
  }

  // lista de salas abertas (anfitriões em "lobby") vistas no room
  function listGames(room) {
    return room.peers().filter((p) => !p.isMe && p.presence && p.presence.r === 'h' && p.presence.v === VER && p.presence.hs && p.presence.hs[0] === 'lobby')
      .map((p) => ({ code: p.presence.c, host: p.presence.n || nameOf(p.peer), players: p.presence.hs[3].filter(Boolean).length }));
  }

  // sala de mentira para os testes: presença trocada dentro do processo, com atraso e perda configuráveis
  function MockBus(opts) {
    opts = opts || {};
    const bus = { t: 0, peers: {}, queue: [], delay: opts.delay || 0.05, jitter: opts.jitter || 0, loss: opts.loss || 0, rnd: mulberry(opts.seed || 5) };
    bus.room = (id) => ({
      me: () => id,
      peers: () => Object.keys(bus.peers).map((pid) => ({ peer: pid, isMe: pid === id, presence: pid === id ? bus.peers[pid].own : bus.peers[pid].seen, kind: 'viewer', guest: false })),
      presence: (patch) => {
        const mine = bus.peers[id].own = Object.assign({}, bus.peers[id].own, patch);
        for (const k of Object.keys(mine)) if (mine[k] === null) delete mine[k];
        for (const pid of Object.keys(bus.peers)) {
          if (pid === id) continue;
          if (bus.rnd() < bus.loss) continue;
          bus.queue.push({ at: bus.t + bus.delay + bus.rnd() * bus.jitter, to: pid, from: id, data: JSON.parse(JSON.stringify(mine)) });
        }
      }
    });
    bus.add = (id) => { bus.peers[id] = { own: {}, seen: {} }; return bus.room(id); };
    bus.remove = (id) => { delete bus.peers[id]; for (const pid of Object.keys(bus.peers)) { /* quem saiu some das listas */ } };
    bus.step = (dt) => {
      bus.t += dt;
      bus.queue.sort((a, b) => a.at - b.at);
      while (bus.queue.length && bus.queue[0].at <= bus.t) {
        const m = bus.queue.shift(); if (!bus.peers[m.to] || !bus.peers[m.from]) continue;
        bus.peers[m.to].seenFrom = bus.peers[m.to].seenFrom || {};
        bus.peers[m.to].seenFrom[m.from] = m.data;
      }
    };
    // presença "vista" de cada par muda conforme a entrega: cada ponto de vista tem seu próprio mapa
    bus.room = (id) => ({
      me: () => id,
      peers: () => Object.keys(bus.peers).map((pid) => ({ peer: pid, isMe: pid === id, presence: pid === id ? bus.peers[id].own : ((bus.peers[id].seenFrom || {})[pid] || {}) })),
      presence: (patch) => {
        const mine = bus.peers[id].own = Object.assign({}, bus.peers[id].own, patch);
        for (const k of Object.keys(mine)) if (mine[k] === null) delete mine[k];
        const snap = JSON.parse(JSON.stringify(mine));
        for (const pid of Object.keys(bus.peers)) {
          if (pid === id) continue;
          if (bus.rnd() < bus.loss) continue;
          bus.queue.push({ at: bus.t + bus.delay + bus.rnd() * bus.jitter, to: pid, from: id, data: snap });
        }
      }
    });
    return bus;
  }

  DP.net = { VER, SLOTS, Host, Guest, listGames, MockBus, mulberry, packInput, unpackInput, packEv, unpackEv, nameOf, mkCode };
})(typeof window !== 'undefined' ? window : globalThis);
