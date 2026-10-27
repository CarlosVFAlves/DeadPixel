// node tests/browser-mp.js [arquivo.html] — dois navegadores (duas páginas) ligados por uma "sala" simulada no Node: cria sala, entra, inicia a partida e confere a cópia
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch(), ctxA = await b.newContext({ viewport: { width: 960, height: 540 } });
  const pages = [await ctxA.newPage(), await ctxA.newPage()], ids = ['pessoaAAAA1', 'pessoaBBBB2'], errs = [];
  const state = { [ids[0]]: {}, [ids[1]]: {} };
  const view = (id) => Object.keys(state).map((pid) => ({ peer: pid, isMe: pid === id, presence: state[pid], kind: 'viewer', guest: false }));
  for (let i = 0; i < 2; i++) {
    const pg = pages[i], id = ids[i];
    pg.on('pageerror', (e) => errs.push('p' + i + ': ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
    await pg.exposeFunction('__presence', (patch) => { const o = state[id]; for (const k of Object.keys(patch)) { if (patch[k] === null) delete o[k]; else o[k] = patch[k]; } });
    await pg.addInitScript((me) => { window.__me = me; window.__peers = []; window.claude = { use: async (n) => (n === 'room' ? { peers: () => window.__peers, presence: (p) => window.__presence(JSON.parse(JSON.stringify(p))), onPeers: () => () => {} } : null) }; }, id);
    await pg.goto('file://' + path.resolve(file)); await pg.waitForTimeout(300);
  }
  const timer = setInterval(() => { pages.forEach((pg, i) => pg.evaluate((v) => { window.__peers = v; }, JSON.parse(JSON.stringify(view(ids[i])))).catch(() => {})); }, 25);
  const click = async (pg, id) => {
    const r = await pg.evaluate((id) => { const bt = __dp.buttons().find((x) => x.id === id); const c = document.getElementById('c'), cr = c.getBoundingClientRect(), k = cr.width / c.width; return bt ? { x: cr.left + (bt.x + bt.w / 2) * k, y: cr.top + (bt.y + bt.h / 2) * k } : null; }, id);
    if (!r) throw new Error('sem botão ' + id);
    await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(150);
  };
  let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FALHOU: ') + m); if (!c) fails++; };
  const [A, B] = pages;
  await click(A, 'go_mp'); await A.waitForTimeout(300); await click(A, 'mp_create'); await A.waitForTimeout(500);
  ok(await A.evaluate(() => __dp.state) === 'mplobby', 'o anfitrião cria a sala e vai para a espera');
  await click(B, 'go_mp'); await B.waitForTimeout(800);
  await click(B, 'mp_join0'); await B.waitForTimeout(900);
  ok(await B.evaluate(() => __dp.state) === 'mplobby', 'o convidado vê a sala na lista e entra');
  await click(B, 'mp_slot0'); await B.waitForTimeout(900);              // pede o assassino
  await A.screenshot({ path: path.join(__dirname, '..', 'tests', 'mp-lobby.png') }).catch(() => {});
  await click(A, 'mp_start'); await A.waitForTimeout(1500);
  ok(await A.evaluate(() => __dp.state) === 'play' && await B.evaluate(() => __dp.state) === 'play', 'o anfitrião inicia e os dois entram na partida');
  const ra = await A.evaluate(() => ({ role: __dp.game.role, k: __dp.game.killerHuman })), rb = await B.evaluate(() => ({ role: __dp.game.role, k: __dp.game.killerHuman }));
  ok(rb.role === 'killer' && ra.role === 'survivor' && ra.k && rb.k, 'o convidado joga de assassino e o anfitrião de sobrevivente');
  // o convidado (assassino) anda; o anfitrião vê o assassino se mexer
  const k0 = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]);
  let kmax = 0;
  for (const key of ['d', 'a', 'a', 'w', 'w', 's']) { await B.keyboard.down(key); await B.waitForTimeout(500); await B.keyboard.up(key); const q = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]); kmax = Math.max(kmax, Math.hypot(q[0] - k0[0], q[1] - k0[1])); }
  await A.waitForTimeout(500);
  const k1 = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]), kb = await B.evaluate(() => [__dp.game.k.x, __dp.game.k.y]);
  ok(kmax > 2 && Math.hypot(k1[0] - kb[0], k1[1] - kb[1]) < 1.5, `o assassino do convidado anda no anfitrião (${kmax.toFixed(1)} tiles) e as telas concordam (${Math.hypot(k1[0] - kb[0], k1[1] - kb[1]).toFixed(2)})`);
  // o anfitrião (sobrevivente) anda; o convidado vê
  const s0 = await B.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]);
  await A.keyboard.down('Shift'); await A.keyboard.down('s'); await A.waitForTimeout(1200); await A.keyboard.up('s'); await A.keyboard.up('Shift'); await B.waitForTimeout(600);
  const s1 = await B.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]), sa = await A.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]);
  ok(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) > 2 && Math.hypot(s1[0] - sa[0], s1[1] - sa[1]) < 1.5, 'o sobrevivente do anfitrião anda e a cópia do convidado acompanha');
  await A.screenshot({ path: path.join(__dirname, '..', 'tests', 'mp-host.png') }).catch(() => {});
  await B.screenshot({ path: path.join(__dirname, '..', 'tests', 'mp-guest.png') }).catch(() => {});
  ok(errs.length === 0, 'sem erros nas duas telas' + (errs.length ? ': ' + errs.slice(0, 3).join(' || ') : ''));
  clearInterval(timer); await b.close();
  console.log(fails ? fails + ' FALHA(S)' : 'multijogador no navegador: tudo certo');
  process.exit(fails ? 1 : 0);
})();
