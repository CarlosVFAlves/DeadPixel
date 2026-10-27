// node tests/browser-p2p.js [arquivo.html] — dois navegadores SEM a sala do Claude (como no link público): conectam pelo código de convite/resposta (WebRTC) e jogam
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] }), ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const pages = [await ctx.newPage(), await ctx.newPage()], errs = [];
  for (let i = 0; i < 2; i++) {
    const pg = pages[i];
    pg.on('pageerror', (e) => errs.push('p' + i + ': ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
    await pg.addInitScript((nm) => { window.claude = { use: async () => null }; try { localStorage.setItem('dp_name', nm); } catch (e) {} }, i ? 'Beto' : 'Ána');          // visitante: sem sala; nomes (com acento/minúscula, que o jogo limpa)
    await pg.goto('file://' + path.resolve(file)); await pg.waitForTimeout(300);
  }
  const click = async (pg, id) => {
    const r = await pg.evaluate((id) => { const bt = __dp.buttons().find((x) => x.id === id); const c = document.getElementById('c'), cr = c.getBoundingClientRect(), k = cr.width / c.width; return bt ? { x: cr.left + (bt.x + bt.w / 2) * k, y: cr.top + (bt.y + bt.h / 2) * k } : null; }, id);
    if (!r) throw new Error('sem botão ' + id);
    await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(150);
  };
  const press = (pg, text) => pg.evaluate((t) => { const bt = [...document.querySelectorAll('#p2p button')].find((x) => x.textContent === t); if (!bt || bt.disabled) return false; bt.click(); return true; }, text);
  let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FALHOU: ') + m); if (!c) fails++; };
  const [A, B] = pages;
  await click(A, 'go_mp'); await A.waitForTimeout(400);
  ok(await A.evaluate(() => __dp.buttons().some((x) => x.id === 'p2p_host')), 'sem a sala do Claude, o menu oferece criar por código');
  await A.screenshot({ path: path.join(__dirname, 'p2p-menu.png') }).catch(() => {});
  await click(A, 'p2p_host'); await A.waitForSelector('#p2p textarea', { timeout: 5000 });
  await A.waitForFunction(() => document.querySelector('#p2p textarea').value.startsWith("DP2o"), null, { timeout: 15000 });
  const offer = await A.evaluate(() => document.querySelector('#p2p textarea').value);
  ok(/^DP2o\.[A-Za-z0-9_-]+$/.test(offer), `convite gerado (${offer.length} caracteres)`);
  await A.screenshot({ path: path.join(__dirname, 'p2p-invite.png') }).catch(() => {});
  await click(B, 'go_mp'); await B.waitForTimeout(300); await click(B, 'p2p_join'); await B.waitForSelector('#p2p textarea');
  await B.fill('#p2p textarea', offer); ok(await press(B, 'GERAR RESPOSTA'), 'convidado cola o convite');
  await B.waitForFunction(() => { const t = document.querySelectorAll('#p2p textarea')[1]; return t && t.value.startsWith("DP2a"); }, null, { timeout: 15000 });
  const answer = await B.evaluate(() => document.querySelectorAll('#p2p textarea')[1].value);
  ok(/^DP2a\./.test(answer), `resposta gerada (${answer.length} caracteres)`);
  await A.evaluate((a) => { document.querySelectorAll('#p2p textarea')[1].value = a; }, answer);
  ok(await press(A, 'CONECTAR'), 'anfitrião cola a resposta');
  await B.waitForFunction(() => __dp.state === 'mplobby', null, { timeout: 20000 }).catch(() => {});
  ok(await B.evaluate(() => __dp.state) === 'mplobby' && await A.evaluate(() => __dp.state) === 'mplobby', 'os dois chegam na sala de espera');
  await A.waitForTimeout(1200);
  await B.screenshot({ path: path.join(__dirname, 'p2p-lobby-guest.png') }).catch(() => {});
  await A.waitForSelector('#p2p', { state: 'detached', timeout: 5000 }).catch(() => {});
  ok(await A.evaluate(() => !document.getElementById('p2p')), 'o painel de convite fecha sozinho quando o amigo conecta');
  await click(B, 'mp_slot0'); await B.waitForTimeout(1500);
  await A.screenshot({ path: path.join(__dirname, 'p2p-lobby-host.png') }).catch(() => {});
  await click(A, 'mp_start'); await A.waitForTimeout(2000);
  ok(await A.evaluate(() => __dp.state) === 'play' && await B.evaluate(() => __dp.state) === 'play', 'o anfitrião inicia e os dois entram na partida');
  const nmA = await A.evaluate(() => JSON.stringify(__dp.game.names)), nmB = await B.evaluate(() => JSON.stringify(__dp.game.names));
  ok(nmA === nmB && nmA === JSON.stringify(['BETO', 'ANA', null, null, null]), 'os dois veem os nomes limpos por vaga: ' + nmA);
  const ra = await A.evaluate(() => ({ role: __dp.game.role, k: __dp.game.killerHuman })), rb = await B.evaluate(() => ({ role: __dp.game.role, k: __dp.game.killerHuman }));
  ok(rb.role === 'killer' && ra.role === 'survivor' && ra.k && rb.k, 'o convidado joga de assassino e o anfitrião de sobrevivente');
  const k0 = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]);
  let kmax = 0;
  for (const key of ['d', 'a', 'a', 'w', 'w', 's']) { await B.keyboard.down(key); await B.waitForTimeout(500); await B.keyboard.up(key); const q = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]); kmax = Math.max(kmax, Math.hypot(q[0] - k0[0], q[1] - k0[1])); }
  await A.waitForTimeout(600);
  const k1 = await A.evaluate(() => [__dp.game.k.x, __dp.game.k.y]), kb = await B.evaluate(() => [__dp.game.k.x, __dp.game.k.y]);
  ok(kmax > 2 && Math.hypot(k1[0] - kb[0], k1[1] - kb[1]) < 1.5, `o assassino do convidado anda no anfitrião (${kmax.toFixed(1)} tiles) e as telas concordam (${Math.hypot(k1[0] - kb[0], k1[1] - kb[1]).toFixed(2)})`);
  const s0 = await B.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]);
  await A.keyboard.down('Shift'); await A.keyboard.down('s'); await A.waitForTimeout(1200); await A.keyboard.up('s'); await A.keyboard.up('Shift'); await B.waitForTimeout(700);
  const s1 = await B.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]), sa = await A.evaluate(() => [__dp.game.survivors[0].x, __dp.game.survivors[0].y]);
  ok(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) > 2 && Math.hypot(s1[0] - sa[0], s1[1] - sa[1]) < 1.5, 'o sobrevivente do anfitrião anda e a cópia do convidado acompanha');
  await B.screenshot({ path: path.join(__dirname, 'p2p-guest.png') }).catch(() => {});
  ok(errs.length === 0, 'sem erros nas duas telas' + (errs.length ? ': ' + errs.slice(0, 3).join(' || ') : ''));
  await b.close();
  console.log(fails ? fails + ' FALHA(S)' : 'conexão por código: tudo certo');
  process.exit(fails ? 1 : 0);
})();
