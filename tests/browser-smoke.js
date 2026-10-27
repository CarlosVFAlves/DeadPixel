// node tests/browser-smoke.js [arquivo.html]  — abre o jogo no Chromium (Playwright), põe o jogador perto de cada tipo de objeto e vê se algum quadro dá erro.
// (os testes de lógica em tests/sim.js não desenham nada; este pega erros de desenho, como variável inexistente no HUD)
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch();
  let fails = 0;
  for (const [vw, vh, label] of [[960, 540, 'PC'], [390, 780, 'celular']]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
    await page.goto('file://' + path.resolve(file)); await page.waitForTimeout(300);
    for (const st of ['menu', 'lobby', 'chars', 'shop', 'help', 'mp', 'mplobby']) { await page.evaluate((s) => { __dp.state = s; }, st); await page.waitForTimeout(120); }
    for (const role of ['survivor', 'killer']) {
      await page.evaluate((r) => { __dp.role = r; __dp.start(true); }, role); await page.waitForTimeout(400);
      const spots = await page.evaluate(() => {
        const g = __dp.game, o = [];
        const add = (n, x, y) => o.push([n, x, y]);
        const w = g.windows[0]; add('janela', w.cx + w.nx * 1.0, w.cy + w.ny * 1.0);
        const c = g.chests[0]; if (c) add('baú', c.stand.x, c.stand.y);
        const gen = g.gens[0]; add('gerador', gen.cx, gen.cy + 1.2);
        const l = g.lockers[0]; if (l) add('armário', l.stand.x, l.stand.y);
        const p = g.pallets[0]; add('pallet', p.cx, p.cy + 1.1);
        if (g.arsenal) add('arsenal', g.arsenal.stand.x, g.arsenal.stand.y);
        if (g.phone) add('telefone', g.phone.cx, g.phone.cy + 1.1);
        const v = g.vehicles[0]; if (v) add('carro', v.stand.x, v.stand.y);
        const it = g.items[0]; if (it) add('item', it.x, it.y);
        add('portão', g.door.cx, g.door.inY + (g.door.side === 'S' ? -1 : 1) * 1.5);
        return o;
      });
      for (const [name, x, y] of spots) {
        await page.evaluate(([x, y]) => { const g = __dp.game, s = g.s; g.k.state = 'intro'; g.k.t = -999; g.fullVision = true; s.skillCD = 999; if (g.role === 'killer') { g.k.x = x; g.k.y = y; } else { s.x = x; s.y = y; } }, [x, y]);
        await page.waitForTimeout(200);
      }
      // estados especiais: corpo, armadilha, cura, ligação, fim de jogo
      await page.evaluate(() => { const g = __dp.game; const v = g.survivors[1]; if (v) { v.dead = true; v.deadAt = g.time; v.x = g.pl.x + 2; v.y = g.pl.y; } g.traps.push({ owner: 'k', x: g.pl.x + 1, y: g.pl.y + 1, cx: g.pl.x + 1, cy: g.pl.y + 1, arm: 0, victim: null }); g.traps.push({ owner: 's', x: g.pl.x - 1, y: g.pl.y + 1, cx: g.pl.x - 1, cy: g.pl.y + 1, arm: 1, victim: null }); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { const g = __dp.game; g.over = true; g.result = 'dead'; g.overT = 0; }); await page.waitForTimeout(2200);
    }
    console.log(label + ': ' + (errs.length ? errs.length + ' ERRO(S)\n  ' + [...new Set(errs)].slice(0, 5).join('\n  ') : 'sem erros'));
    if (errs.length) fails++;
    await page.close();
  }
  await b.close();
  process.exit(fails ? 1 : 0);
})();
