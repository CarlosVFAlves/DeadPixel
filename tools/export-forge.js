// Gera as folhas da Forja em assets/forja/ (uma por animação, ampliadas, fundo magenta = transparente) + manifest.json.
// Uso: node tools/export-forge.js [escala=6] [resolução=16]
// Envie cada PNG ao GPT/artista pedindo para repintar mantendo grade, pose e o fundo magenta; depois use IMPORTAR na tela PERSONAGENS.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const sc = +(process.argv[2] || 6), res = +(process.argv[3] || 16), root = path.join(__dirname, '..');
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent('<canvas></canvas>');
  await p.addScriptTag({ content: 'window.DP={};' + fs.readFileSync(path.join(root, 'js', 'forge.js'), 'utf8') });
  const out = await p.evaluate(({ sc, res }) => {
    const F = DP.forge, files = {}, manifest = {};
    for (const role of ['survivor', 'killer']) {
      const g = role === 'killer' ? F.defaultGenome('killer') : F.defaultGenome('survivor', 0);
      const pt = role === 'killer' ? 'assassino' : 'sobrevivente';
      for (const an of Object.keys(F.ANIMS[role])) {
        const sh = F.exportSheet(g, res, { anims: [an], scale: sc });
        files[pt + '_' + an + '.png'] = sh.canvas.toDataURL().split(',')[1];
        manifest[pt + '_' + an] = sh.manifest;
      }
      const full = F.exportSheet(g, res, { scale: 1 });
      files[pt + '_folha_completa_1x.png'] = full.canvas.toDataURL().split(',')[1];
      manifest[pt + '_folha_completa'] = full.manifest;
    }
    return { files, manifest };
  }, { sc, res });
  const dir = path.join(root, 'assets', 'forja'); fs.mkdirSync(dir, { recursive: true });
  for (const [n, d] of Object.entries(out.files)) fs.writeFileSync(path.join(dir, n), Buffer.from(d, 'base64'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(out.manifest, null, 1));
  console.log(Object.keys(out.files).length + ' arquivos em assets/forja/');
  await b.close();
})();
