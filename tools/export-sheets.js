// node tools/export-sheets.js  -> gera assets/template/*.png (+ _labeled.png) e manifest.json a partir dos sprites atuais
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const root = path.join(__dirname, '..'), outDir = path.join(root, 'assets', 'template');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => console.log('erro de página:', e));
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(400);
  const src = fs.readFileSync(path.join(__dirname, 'sheets.js'), 'utf8');
  const res = await page.evaluate(src);
  const manifest = {};
  for (const k of Object.keys(res)) {
    const r = res[k];
    fs.writeFileSync(path.join(outDir, k + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(outDir, k + '_com_grade.png'), Buffer.from(r.labeled.split(',')[1], 'base64'));
    manifest[k] = { width: r.w, height: r.h, scale: 8, logicalTile: 16, cells: r.cells };
    console.log(k, r.w + 'x' + r.h, r.cells.length + ' células');
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  await b.close();
})();
