// Conexão direta entre aparelhos (WebRTC), SEM servidor e SEM a sala do Claude: serve para quem não consegue usar o `room`
// (visitante do link público, convidado de outra organização). A "assinatura" da conexão é trocada à mão: o anfitrião gera um código
// de convite, manda por mensagem; o amigo cola, gera um código de resposta e devolve. Depois disso, tudo anda por um canal de dados.
// O objeto devolvido tem a mesma forma do `room` usado pelo multijogador (me / peers / presence), então js/net.js não sabe a diferença.
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

  // ---------- código de convite (curto e copiável) ----------
  // Em vez do SDP inteiro (centenas de linhas), o código leva só o que muda de verdade: usuário/senha do ICE, impressão digital do certificado,
  // endereços candidatos e o código da sala. O resto do SDP é sempre igual e é remontado do outro lado. ~130 caracteres.
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; };
  const TYPES = ['host', 'srflx', 'relay', 'prflx'];
  const hexOf = (b) => Array.prototype.map.call(b, (x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
  function packSdp(sdp, gameCode) {
    const line = (re) => { const m = re.exec(sdp); return m ? m[1].trim() : ''; };
    const ufrag = line(/a=ice-ufrag:(.*)/), pwd = line(/a=ice-pwd:(.*)/), fp = line(/a=fingerprint:sha-256 (.*)/);
    if (!ufrag || !pwd || !fp) throw new Error('SDP SEM DADOS');
    const fpb = fp.split(':').map((h) => parseInt(h, 16));
    const cands = [];
    sdp.split(/\r?\n/).forEach((l) => {
      const m = /^a=candidate:\S+ (\d+) (\w+) (\d+) (\S+) (\d+) typ (\w+)/.exec(l);
      if (m && m[1] === '1' && m[2].toLowerCase() === 'udp') cands.push({ ip: m[4], port: +m[5], type: Math.max(0, TYPES.indexOf(m[6])) });
    });
    const v4 = cands.filter((c) => /^\d+\.\d+\.\d+\.\d+$/.test(c.ip) || /^[0-9a-f-]{36}\.local$/i.test(c.ip));
    const use = (v4.length ? v4 : cands).slice(0, 6);
    const out = [], str = (t) => { out.push(t.length); for (let i = 0; i < t.length; i++) out.push(t.charCodeAt(i) & 255); };
    str(ufrag); str(pwd); fpb.forEach((x) => out.push(x)); str(gameCode || '');
    out.push(use.length);
    for (const c of use) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(c.ip)) { out.push(c.type | 0, ...c.ip.split('.').map(Number)); }
      else if (/^[0-9a-f-]{36}\.local$/i.test(c.ip)) { out.push(c.type | 4); const h = c.ip.slice(0, 36).replace(/-/g, ''); for (let i = 0; i < 32; i += 2) out.push(parseInt(h.slice(i, i + 2), 16)); }
      else { out.push(c.type | 8); str(c.ip); }
      out.push(c.port >> 8, c.port & 255);
    }
    return new Uint8Array(out);
  }
  function unpackSdp(bytes, answer) {
    let o = 0;
    const str = () => { const n = bytes[o++]; let t = ''; for (let i = 0; i < n; i++) t += String.fromCharCode(bytes[o++]); return t; };
    const ufrag = str(), pwd = str(), fp = Array.prototype.slice.call(bytes, o, o + 32).map((x) => (x < 16 ? '0' : '') + x.toString(16).toUpperCase()).join(':'); o += 32;
    const gameCode = str(), n = bytes[o++], lines = [];
    for (let i = 0; i < n; i++) {
      const f = bytes[o++], type = TYPES[f & 3], kind = f & 12;
      let ip;
      if (kind === 0) { ip = bytes[o] + '.' + bytes[o + 1] + '.' + bytes[o + 2] + '.' + bytes[o + 3]; o += 4; }
      else if (kind === 4) { const h = hexOf(bytes.slice(o, o + 16)); o += 16; ip = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local'; }
      else ip = str();
      const port = (bytes[o] << 8) | bytes[o + 1]; o += 2;
      lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + (((f & 3) === 0 ? 2122260223 : 1686052607) - i) + ' ' + ip + ' ' + port + ' typ ' + type);
    }
    if (o > bytes.length) throw new Error('CÓDIGO INCOMPLETO');
    const sdp = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=fingerprint:sha-256 ' + fp, 'a=setup:' + (answer ? 'active' : 'actpass'), 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'].concat(lines, ['a=end-of-candidates']).join('\r\n') + '\r\n';
    return { s: sdp, c: gameCode || null };
  }
  async function encode(kind, obj) { return 'DP2' + kind + '.' + b64(packSdp(obj.s, obj.c)); }
  async function decode(code, kind) {
    const m = /^DP2([oa])\.([A-Za-z0-9_-]+)$/.exec(String(code || '').replace(/\s+/g, ''));
    if (!m || m[1] !== kind) throw new Error(/^DP1/.test(String(code || '').trim()) ? 'CÓDIGO DE VERSÃO ANTIGA' : 'CÓDIGO INVÁLIDO');
    return unpackSdp(unb64(m[2]), kind === 'a');
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
    const dbg = { local: [], remote: [], ice: '-', gather: '-' };
    const watch = (pc) => {
      pc.addEventListener('icecandidate', (e) => { if (e.candidate) { const m = /candidate:\S+ \d+ (\w+) \d+ (\S+) \d+ typ (\w+)/.exec(e.candidate.candidate); if (m) dbg.local.push(m[3] + (/\.local$/.test(m[2]) ? '(mDNS)' : '') + (m[1].toLowerCase() === 'tcp' ? '/tcp' : '')); } });
      pc.addEventListener('iceconnectionstatechange', () => { dbg.ice = pc.iceConnectionState; });
      pc.addEventListener('icegatheringstatechange', () => { dbg.gather = pc.iceGatheringState; });
    };
    const note = (sdp) => { dbg.remote = []; String(sdp).split(/\r?\n/).forEach((l) => { const m = /^a=candidate:\S+ \d+ \w+ \d+ (\S+) \d+ typ (\w+)/.exec(l); if (m) dbg.remote.push(m[2] + (/\.local$/.test(m[1]) ? '(mDNS)' : '')); }); };
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
      wire(id, pc, ch); watch(pc);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      const code = await encode('o', { s: pc.localDescription.sdp, c: opts.code || null });
      return { id, code, finish: async (answerCode) => { const a = await decode(answerCode, 'a'); self.links[id].finished = true; note(a.s); await pc.setRemoteDescription({ type: 'answer', sdp: a.s }); } };
    };
    // convidado: recebe o convite e devolve o código de resposta
    self.accept = async (offerCode) => {
      const o = await decode(offerCode, 'o'), pc = new root.RTCPeerConnection({ iceServers: ICE });
      self.gameCode = o.c; self.pc = pc; watch(pc); note(o.s);
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
    // resumo técnico (para o painel): estado do ICE e os tipos de endereço de cada lado
    self.diag = () => 'ICE ' + dbg.ice + ' | MEUS: ' + (dbg.local.join(' ') || 'NENHUM') + ' | DELE: ' + (dbg.remote.join(' ') || 'NENHUM');
    self.close = () => { clearInterval(self.hb); for (const id of Object.keys(self.links)) { try { self.links[id].pc.close(); } catch (e) { /* já fechado */ } } self.links = {}; self.hostOpen = false; };
    self.room = room;
    return self;
  }

  DP.p2p = { supported: () => !!root.RTCPeerConnection, makeHost: (code) => makeRoom('host', { code }), makeGuest: () => makeRoom('guest'), encode, decode };
})(typeof window !== 'undefined' ? window : globalThis);
