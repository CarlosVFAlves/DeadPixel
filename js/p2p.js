// Conexão direta entre aparelhos (WebRTC), SEM servidor e SEM a sala do Claude: serve para quem não consegue usar o `room`
// (visitante do link público, convidado de outra organização). A "assinatura" da conexão é trocada à mão: o anfitrião gera um código
// de convite, manda por mensagem; o amigo cola, gera um código de resposta e devolve. Depois disso, tudo anda por um canal de dados.
// O objeto devolvido tem a mesma forma do `room` usado pelo multijogador (me / peers / presence), então js/net.js não sabe a diferença.
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

  // ---------- código de convite (texto curto e copiável) ----------
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; };
  async function pipe(bytes, stream) {
    const w = stream.writable.getWriter(); w.write(bytes); w.close();
    const reader = stream.readable.getReader(), chunks = []; let n = 0;
    for (;;) { const r = await reader.read(); if (r.done) break; chunks.push(r.value); n += r.value.length; }
    const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
  }
  async function encode(kind, obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    let z = 0, bytes = raw;
    try { if (root.CompressionStream) { bytes = await pipe(raw, new root.CompressionStream('deflate-raw')); z = 1; } } catch (e) { bytes = raw; z = 0; }
    return 'DP1' + kind + z + '.' + b64(bytes);
  }
  async function decode(code, kind) {
    const m = /^DP1([oa])([01])\.([A-Za-z0-9_-]+)$/.exec(String(code || '').replace(/\s+/g, ''));
    if (!m || m[1] !== kind) throw new Error('CÓDIGO INVÁLIDO');
    let bytes = unb64(m[3]);
    if (m[2] === '1') bytes = await pipe(bytes, new root.DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function gathered(pc, ms) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const done = () => { pc.removeEventListener('icegatheringstatechange', ch); res(); };
      const ch = () => { if (pc.iceGatheringState === 'complete') done(); };
      pc.addEventListener('icegatheringstatechange', ch);
      setTimeout(done, ms || 5000);
    });
  }

  // ---------- "sala" sobre canais de dados ----------
  // role 'host': vários convidados (um canal por convidado); role 'guest': um canal com o anfitrião.
  function makeRoom(role, opts) {
    opts = opts || {};
    const self = { role, id: role === 'host' ? 'host' : 'guest', own: {}, links: {}, seen: {}, hostSeen: {}, hostOpen: false, nextId: 1, listeners: [], status: 'idle', code: null, pendingFlush: null, last: 0, onHello: null, onJoin: null, hb: null, pc: null };
    const LIVE_MS = 10000;                       // sem notícias por tanto tempo = a pessoa saiu (o canal demora a avisar sozinho)
    const dirty = {};
    function applyPatch(o, patch) { for (const k of Object.keys(patch)) { if (patch[k] === null) delete o[k]; else o[k] = patch[k]; } }
    function sendTo(ch, obj) { try { if (ch && ch.readyState === 'open') ch.send(JSON.stringify(obj)); } catch (e) { /* canal fechando */ } }
    function flush() {
      self.pendingFlush = null; self.last = Date.now();
      const patch = {}; for (const k of Object.keys(dirty)) patch[k] = dirty[k]; for (const k of Object.keys(dirty)) delete dirty[k];
      if (!Object.keys(patch).length) return;
      if (role === 'host') for (const id of Object.keys(self.links)) sendTo(self.links[id].ch, { p: patch });
      else sendTo(self.links.host && self.links.host.ch, { p: patch });
    }
    const room = {
      me: () => self.id,
      peers: () => {
        const list = [{ peer: self.id, isMe: true, presence: self.own, kind: 'viewer', guest: false }];
        if (role === 'host') { for (const id of Object.keys(self.links)) if (self.links[id].open && Date.now() - self.links[id].rx < LIVE_MS) list.push({ peer: id, isMe: false, presence: self.seen[id] || {}, kind: 'viewer', guest: true }); }
        else if (self.hostOpen && Date.now() - self.links.host.rx < LIVE_MS) list.push({ peer: 'host', isMe: false, presence: self.hostSeen, kind: 'viewer', guest: false });
        return list;
      },
      presence: (patch) => {
        applyPatch(self.own, patch);
        for (const k of Object.keys(patch)) dirty[k] = patch[k];
        if (Date.now() - self.last >= 30) flush(); else if (!self.pendingFlush) self.pendingFlush = setTimeout(flush, 30);
        return Promise.resolve();
      }
    };
    function onMessage(id, ev) {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (self.links[id]) self.links[id].rx = Date.now();
      if (m.p) { if (role === 'host') { self.seen[id] = self.seen[id] || {}; applyPatch(self.seen[id], m.p); } else applyPatch(self.hostSeen, m.p); }
      else if (m.hello && role === 'guest') { self.id = m.hello.id; if (self.onHello) self.onHello(m.hello); }
    }
    function wire(id, pc, ch) {
      const link = self.links[id] = { pc, ch, open: false, rx: Date.now(), finished: false };
      ch.onopen = () => {
        link.open = true; link.rx = Date.now();
        if (role === 'host') { self.seen[id] = {}; sendTo(ch, { hello: { id, code: opts.code || null } }); if (self.onJoin) self.onJoin(id); for (const k of Object.keys(self.own)) dirty[k] = self.own[k]; flush(); }
        else { self.hostOpen = true; self.status = 'conectado'; }
      };
      ch.onclose = () => { link.open = false; if (role === 'host') { delete self.seen[id]; } else { self.hostOpen = false; self.status = 'desconectado'; } };
      ch.onmessage = (ev) => onMessage(id, ev);
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { link.open = false; if (role === 'guest') self.hostOpen = false; } };
    }
    // o canal não é confiável (perde mensagens de propósito): o "olá" é repetido até o convidado aparecer
    if (role === 'host') self.hb = setInterval(() => {
      for (const id of Object.keys(self.links)) {
        const l = self.links[id]; if (!l.open) continue;
        if (!self.seen[id] || !Object.keys(self.seen[id]).length) sendTo(l.ch, { hello: { id, code: opts.code || null } });
        else sendTo(l.ch, { p: {} });                     // batimento: mantém o outro lado sabendo que estamos vivos
      }
    }, 500);
    else self.hb = setInterval(() => { if (self.links.host) sendTo(self.links.host.ch, { p: {} }); }, 1000);
    // anfitrião: gera um convite (oferta). Devolve { code, finish(answerCode) }.
    self.invite = async () => {
      for (const old of Object.keys(self.links)) { const l = self.links[old]; if (!l.open && !l.finished) { try { l.pc.close(); } catch (e) { /* já fechado */ } delete self.links[old]; } }       // convite anterior que ninguém usou
      const id = 'g' + (self.nextId++), pc = new root.RTCPeerConnection({ iceServers: ICE }), ch = pc.createDataChannel('dp', { ordered: false, maxRetransmits: 0 });
      wire(id, pc, ch);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      const code = await encode('o', { s: pc.localDescription.sdp, c: opts.code || null });
      return { id, code, finish: async (answerCode) => { const a = await decode(answerCode, 'a'); self.links[id].finished = true; await pc.setRemoteDescription({ type: 'answer', sdp: a.s }); } };
    };
    // convidado: recebe o convite e devolve o código de resposta
    self.accept = async (offerCode) => {
      const o = await decode(offerCode, 'o'), pc = new root.RTCPeerConnection({ iceServers: ICE });
      self.gameCode = o.c; self.pc = pc;
      pc.ondatachannel = (ev) => wire('host', pc, ev.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: o.s });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      self.status = 'aguardando';
      return encode('a', { s: pc.localDescription.sdp });
    };
    // estado da conexão mais recente, para a tela mostrar o que está acontecendo
    self.state = () => {
      if (role === 'guest') return self.hostOpen ? 'open' : (self.pc ? self.pc.connectionState : 'new');
      const ids = Object.keys(self.links); if (!ids.length) return 'new';
      const l = self.links[ids[ids.length - 1]]; return l.open ? 'open' : l.pc.connectionState;
    };
    self.close = () => { clearInterval(self.hb); for (const id of Object.keys(self.links)) { try { self.links[id].pc.close(); } catch (e) { /* já fechado */ } } self.links = {}; self.hostOpen = false; };
    self.room = room;
    return self;
  }

  DP.p2p = { supported: () => !!root.RTCPeerConnection, makeHost: (code) => makeRoom('host', { code }), makeGuest: () => makeRoom('guest'), encode, decode };
})(typeof window !== 'undefined' ? window : globalThis);
