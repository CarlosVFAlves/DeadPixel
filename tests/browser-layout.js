// node tests/browser-layout.js [arquivo.html] — em vários tamanhos de tela (inclusive celular deitado, baixo), nenhum botão sai da tela nem se sobrepõe a outro
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch();
  let fails = 0;
  for (const [w, h] of [[640, 312], [667, 320], [740, 360], [800, 400], [960, 540], [390, 700]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
    await p.addInitScript(() => { window.claude = { use: async () => null }; try { localStorage.setItem('dp_name', 'TESTE'); } catch (e) {} });
    await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(300);
    const res = await p.evaluate(async () => {
      const out = [], W = document.getElementById('c').width, H = document.getElementById('c').height;
      const check = (name) => {
        const bs = __dp.buttons().filter((x) => !x.ghost && x.w && x.h);
        for (const x of bs) if (x.x < 0 || x.y < 0 || x.x + x.w > W + 0.5 || x.y + x.h > H + 0.5) out.push(name + ': ' + x.id + ' fora da tela');
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], c = bs[j];
          if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) out.push(name + ': ' + a.id + ' x ' + c.id + ' sobrepostos');
        }
      };
      for (const st of ['menu', 'lobby', 'chars', 'shop', 'help', 'mp']) { __dp.state = st; await new Promise((r) => setTimeout(r, 150)); check(st); }
      // sala de espera do multijogador (anfitrião por código)
      __dp.state = 'mp'; await new Promise((r) => setTimeout(r, 200));
      const bt = __dp.buttons().find((x) => x.id === 'p2p_host'); if (bt) { const c = document.getElementById('c'), cr = c.getBoundingClientRect(), k = cr.width / c.width; c.dispatchEvent(new PointerEvent('pointerdown', { clientX: cr.left + (bt.x + bt.w / 2) * k, clientY: cr.top + (bt.y + bt.h / 2) * k, pointerId: 1, pointerType: 'mouse', bubbles: true })); }
      await new Promise((r) => setTimeout(r, 300)); if (window.DP.p2pui) DP.p2pui.close();
      check('mplobby(' + __dp.state + ')');
      return { out, W, H };
    });
    for (const m of res.out) { console.log('  FALHOU [' + w + 'x' + h + ' → ' + res.W + 'x' + res.H + '] ' + m); fails++; }
    console.log('  ' + w + 'x' + h + ' (' + res.W + 'x' + res.H + '): ' + (res.out.length ? res.out.length + ' problema(s)' : 'ok'));
  }
  await b.close();
  console.log(fails ? fails + ' FALHA(S)' : 'layout dos menus: tudo certo');
  process.exit(fails ? 1 : 0);
})();
