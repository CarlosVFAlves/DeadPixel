// node tests/browser-spec.js [arquivo.html] — duas páginas (sala simulada): o sobrevivente do anfitrião "morre" e vira espectador; troca de alvo por teclado e por botão; HUD sem erros
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const pages = [await ctx.newPage(), await ctx.newPage()], ids = ['pessoaAAAA1', 'pessoaBBBB2'], errs = [];
  const state = { [ids[0]]: {}, [ids[1]]: {} };
  const view = (id) => Object.keys(state).map((pid) => ({ peer: pid, isMe: pid === id, presence: state[pid], kind: 'viewer', guest: false }));
  for (let i = 0; i < 2; i++) {
    const pg = pages[i], id = ids[i];
    pg.on('pageerror', (e) => errs.push('p' + i + ': ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
    await pg.exposeFunction('__presence', (patch) => { const o = state[id]; for (const k of Object.keys(patch)) { if (patch[k] === null) delete o[k]; else o[k] = patch[k]; } });
    await pg.addInitScript((me) => { try { localStorage.setItem('dp_name', me === 'pessoaAAAA1' ? 'ANA' : 'BETO'); } catch (e) {} window.__me = me; window.__peers = []; window.claude = { use: async (n) => (n === 'room' ? { peers: () => window.__peers, presence: (p) => window.__presence(JSON.parse(JSON.stringify(p))), onPeers: () => () => {} } : null) }; }, id);
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
  await click(B, 'go_mp'); await B.waitForTimeout(800); await click(B, 'mp_join0'); await B.waitForTimeout(900);
  await click(A, 'mp_start'); await A.waitForTimeout(1500);
  ok(await A.evaluate(() => __dp.state) === 'play' && await B.evaluate(() => __dp.state) === 'play', 'partida começou nas duas telas (anfitrião sobrevivente 1, convidado sobrevivente 2)');
  const who = await B.evaluate(() => __dp.game.me);
  ok(await A.evaluate(() => !__dp.game.spec), 'vivo: sem modo espectador');
  // o sobrevivente do anfitrião morre (como se o assassino tivesse acabado com ele)
  await A.evaluate(() => { const g = __dp.game, v = g.survivors[g.me]; v.hp = 0; v.dead = true; v.deadAt = g.time; });
  await A.waitForTimeout(700);
  const sp = await A.evaluate(() => ({ spec: __dp.game.spec, pl: __dp.game.pl === __dp.game.survivors[__dp.game.me], name: __dp.game.specName(), btns: __dp.buttons().map((b) => b.id).filter((i) => i.indexOf('spec') === 0) }));
  ok(sp.spec && !sp.pl, 'morreu: vira espectador e a câmera sai do próprio corpo (seguindo ' + sp.name + ')');
  ok(sp.btns.length === 2, 'aparecem os botões de trocar de pessoa: ' + sp.btns.join(','));
  await A.screenshot({ path: path.join(__dirname, 'spec-1.png') }).catch(() => {});
  const t0 = await A.evaluate(() => __dp.game.specName());
  await A.keyboard.press('ArrowRight'); await A.waitForTimeout(200);
  const t1 = await A.evaluate(() => __dp.game.specName());
  await click(A, 'spec_next'); await A.waitForTimeout(200);
  const t2 = await A.evaluate(() => __dp.game.specName());
  await click(A, 'spec_prev'); await A.waitForTimeout(200);
  const t3 = await A.evaluate(() => __dp.game.specName());
  ok(t1 !== t0 && t2 !== t1 && t3 === t1, `troca de alvo por teclado e por botão: ${t0} → ${t1} → ${t2} → ${t3}`);
  // o outro jogador continua normal e se mexe; o espectador o vê
  const p0 = await A.evaluate(() => [__dp.game.survivors[1].x, __dp.game.survivors[1].y]);
  await B.keyboard.down('Shift'); await B.keyboard.down('d'); await B.waitForTimeout(900); await B.keyboard.up('d'); await B.keyboard.up('Shift'); await A.waitForTimeout(500);
  const p1 = await A.evaluate(() => [__dp.game.survivors[1].x, __dp.game.survivors[1].y]);
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1, 'o espectador acompanha o colega que continua jogando (' + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1) + ' tiles)');
  await A.screenshot({ path: path.join(__dirname, 'spec-2.png') }).catch(() => {});
  ok(await B.evaluate(() => !__dp.game.spec) && await B.evaluate(() => __dp.state) === 'play', 'o colega vivo não vira espectador e a partida continua para ele');
  ok(errs.length === 0, 'sem erros nas duas telas' + (errs.length ? ': ' + errs.slice(0, 3).join(' || ') : ''));
  clearInterval(timer); await b.close();
  console.log(fails ? fails + ' FALHA(S)' : 'espectador: tudo certo');
  process.exit(fails ? 1 : 0);
})();
