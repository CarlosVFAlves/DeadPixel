// Gera as folhas-molde de textura a partir dos sprites atuais (16 px lógicos, ampliados 8x).
// Uso: node tools/export-sheets.js  (abre o jogo no Chromium, injeta este arquivo e salva PNGs em assets/template/)
// Fundo magenta (#ff00ff) = transparente. Cada folha tem um manifest com o nome e a posição de cada célula.
(function () {
  'use strict';
  const DP = window.DP, I = DP.render.internals, TS = I.TS, SC = 8, BG = '#ff00ff';
  const CAM = () => document.createElement('canvas');
  function sheet(w, h) { const c = CAM(); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = BG; g.fillRect(0, 0, w, h); return { c, g }; }
  // marcações (versão para humanos: grade e nomes; NÃO mandar esta para repintar)
  function labeled(base, cells) {
    const c = CAM(); c.width = base.width; c.height = base.height + 0; const g = c.getContext('2d'); g.drawImage(base, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.fillStyle = '#fff'; g.font = '14px monospace';
    for (const e of cells) { g.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2); g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(e.x + 3, e.y + 3, e.name.length * 8 + 6, 16); g.fillStyle = '#fff'; g.fillText(e.name, e.x + 6, e.y + 16); }
    return c;
  }
  const out = {};
  const DIRS = [['baixo', Math.PI / 2], ['esquerda', Math.PI], ['direita', 0], ['cima', -Math.PI / 2]];

  // ---------- 1) sobreviventes: uma folha por jaqueta; colunas = 4 direções; linhas = poses ----------
  const CW = 24 * SC, CH = 32 * SC;           // célula: 24x32 px lógicos (192x256)
  const SROWS = [
    ['parado', { moving: false }], ['andando A', { moving: true, walk: 0 }], ['andando B', { moving: true, walk: 1 }],
    ['pulo correndo', { vault: { kind: 'run', t: 0.5, dur: 1 } }], ['pulo andando', { vault: { kind: 'walk', t: 0.5, dur: 1 } }],
    ['atravessa vidro', { vault: { kind: 'crash', t: 0.5, dur: 1 } }], ['tropeçando', { moving: true, walk: 1, tripT: 1 }], ['ferido', { hp: 1 }]
  ];
  const JACKET = ['azul', 'vermelha', 'verde', 'amarela'];
  for (let id = 0; id < 4; id++) {
    const S = sheet(CW * 4, CH * SROWS.length), cells = [];
    SROWS.forEach((row, ri) => DIRS.forEach((d, di) => {
      const x = di * CW, y = ri * CH;
      const o = Object.assign({ id, face: d[1], moving: false, hp: 2, tm: 0 }, row[1]);
      if (o.vault) { const v = o.vault; o.vault = { kind: v.kind, t: v.t, dur: v.dur, x0: 0, y0: 0, x1: Math.cos(d[1]), y1: Math.sin(d[1]) }; }
      DP.render.uiSurvivor(S.g, x + CW / 2, y + CH - 4 * SC, SC, o);
      cells.push({ name: row[0] + ' / ' + d[0], x, y, w: CW, h: CH, row: ri, col: di, pose: row[0], dir: d[0] });
    }));
    out['survivor_' + id + '_' + JACKET[id]] = { sheet: S.c, cells, cell: [CW, CH] };
  }

  // ---------- 2) assassino ----------
  {
    const KR = [['parado', 'recover', false, 0], ['andando A', 'chase', true, 0], ['andando B', 'chase', true, 1], ['preparando golpe', 'windup', false, 0], ['golpe (bote)', 'lunge', true, 0], ['atordoado', 'stun', false, 0], ['cambaleando', 'stumble', true, 0], ['quebrando', 'break', false, 0]];
    const S = sheet(CW * 4, CH * KR.length), cells = [];
    KR.forEach((row, ri) => DIRS.forEach((d, di) => {
      const x = di * CW, y = ri * CH;
      DP.render.uiKiller(S.g, x + CW / 2, y + CH - 4 * SC, SC, { state: row[1], face: d[1], moving: row[2], walk: row[3], tm: 0.3 });
      cells.push({ name: row[0] + ' / ' + d[0], x, y, w: CW, h: CH, row: ri, col: di, pose: row[0], dir: d[0] });
    }));
    out.killer = { sheet: S.c, cells, cell: [CW, CH] };
  }

  // ---------- 3) chão, paredes, água e árvores (renderizados pelo mapa estático real) ----------
  {
    const MW = 40, MH = 30, t = new Uint8Array(MW * MH), ground = new Uint8Array(MW * MH), indoor = new Uint8Array(MW * MH);
    const T = { tree: 6, water: 7, wall: 1, crate: 2 };
    const rows = [];   // [nome, quantidade, tipo de tile, ground, indoor]
    rows.push(['grama', 8, 0, 0, 0], ['terra', 8, 0, 1, 0], ['areia', 8, 0, 2, 0], ['cascalho', 8, 0, 4, 0], ['tábua da varanda/cais', 8, 0, 3, 0], ['piso interno', 8, 0, 0, 1], ['água', 8, 7, 0, 0], ['parede de tijolo', 8, 1, 0, 0]);
    let y = 1;
    for (const r of rows) { for (let i = 0; i < r[1]; i++) { const x = 1 + i; t[y * MW + x] = r[2]; ground[y * MW + x] = r[3]; indoor[y * MW + x] = r[4]; } y += 2; }
    // árvores isoladas (cada uma com folga de 1 tile ao redor)
    const trees = [];
    for (let i = 0; i < 8; i++) { const x = 3 + (i % 4) * 4, y2 = 18 + Math.floor(i / 4) * 4; t[y2 * MW + x] = T.tree; trees.push([x, y2]); }
    // caixote e rochas (caixote é tile)
    t[27 * MW + 3] = T.crate; t[27 * MW + 6] = T.crate;
    const stat = I.buildStatic({ map: { W: MW, H: MH, t, indoor, ground } });
    const bare = I.buildStatic({ map: { W: MW, H: MH, t, indoor, ground, bare: true } });      // árvores e caixotes sem o chão por baixo (fundo transparente)
    const cellsOut = [], labelsList = [];
    const tile = TS * SC;                                                           // 128
    const cols = 8, S = sheet(cols * tile + 4 * 3 * tile, 0 + 1);                    // largura provisória; altura definida abaixo
    // layout final: tiles em 8 colunas; árvores em células 3x3 tiles
    const rowCount = rows.length, treeCell = 3 * tile;
    const W2 = Math.max(cols * tile, 4 * treeCell), H2 = rowCount * tile + 2 * treeCell + 2 * tile;
    const S2 = sheet(W2, H2);
    rows.forEach((r, ri) => { for (let i = 0; i < r[1]; i++) { const sx = (1 + i) * TS, sy = (1 + ri * 2) * TS; S2.g.drawImage(stat, sx, sy, TS, TS, i * tile, ri * tile, tile, tile); cellsOut.push({ name: r[0] + ' #' + (i + 1), x: i * tile, y: ri * tile, w: tile, h: tile, kind: r[0], index: i }); } });
    trees.forEach((tr, i) => { const sx = (tr[0] - 1) * TS, sy = (tr[1] - 1) * TS, dx = (i % 4) * treeCell, dy = rowCount * tile + Math.floor(i / 4) * treeCell; S2.g.drawImage(bare, sx, sy, 3 * TS, 3 * TS, dx, dy, treeCell, treeCell); cellsOut.push({ name: 'árvore #' + (i + 1), x: dx, y: dy, w: treeCell, h: treeCell, kind: 'árvore', index: i }); });
    [3, 6].forEach((cx, i) => { const dx = i * tile * 2, dy = rowCount * tile + 2 * treeCell; S2.g.drawImage(bare, (cx - 0.5) * TS, 26.5 * TS, 2 * TS, 2 * TS, dx, dy, 2 * tile, 2 * tile); cellsOut.push({ name: 'caixote #' + (i + 1), x: dx, y: dy, w: 2 * tile, h: 2 * tile, kind: 'caixote', index: i }); });
    out.tiles = { sheet: S2.c, cells: cellsOut, cell: [tile, tile] };
  }

  // ---------- 4) objetos: armários, gerador, telefone, pallets, janelas, veículos, itens ----------
  {
    const items = [];
    const G = { survivors: [], k: { state: 'chase', pal: null, x: 99, y: 99 }, cfg: DP.CFG, map: {}, door: { cx: 20 }, vehicles: [] };
    let grp = 'props_moveis';
    const draw = (name, w, h, fn) => items.push({ name, w, h, fn, grp });     // w,h em tiles
    const L = (nx, ny, open) => ({ tx: 0, ty: 0, cx: 0.5, cy: 0.5, nx, ny, occ: open ? {} : null, t: open ? 0 : 9, open: 0 });
    [[0, 1, 'frente para baixo'], [0, -1, 'frente para cima'], [1, 0, 'frente para direita'], [-1, 0, 'frente para esquerda']].forEach((f) => {
      draw('armário fechado, ' + f[2], 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawLocker(g, L(f[0], f[1], false), G, 0); g.restore(); });
      draw('armário aberto, ' + f[2], 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawLocker(g, L(f[0], f[1], true), G, 0); g.restore(); });
    });
    [[0, 'gerador vazio'], [0.5, 'gerador na metade'], [1, 'gerador pronto']].forEach((q) => draw(q[1], 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawGen(g, { tx: 0, ty: 0, cx: 0.5, cy: 0.5, progress: q[0], done: q[0] === 1 }, G, 0); g.restore(); }));
    [['locked', 'telefone sem energia'], ['ready', 'telefone pronto'], ['coming', 'telefone chamando']].forEach((q) => draw(q[1], 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawPhone(g, { tx: 0, ty: 0, cx: 0.5, cy: 0.5, state: q[0], progress: 0 }, G, 0); g.restore(); }));
    ['h', 'v'].forEach((o) => {
      const P = { tx: 0, ty: 0, orient: o, cx: 0.5, cy: 0.5, dir: o === 'h' ? { x: 0, y: 1 } : { x: 1, y: 0 }, nx: o === 'v' ? 1 : 0, ny: o === 'h' ? 1 : 0 };
      draw('pallet de pé (' + (o === 'h' ? 'porta horizontal' : 'porta vertical') + ')', 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawPalletUp(g, P, 0); g.restore(); });
      draw('pallet caído (' + o + ')', 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawPalletFlat(g, P, 1); g.restore(); });
      draw('pallet quebrado (' + o + ')', 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawBroken(g, P); g.restore(); });
      for (const st of ['closed', 'open', 'broken']) draw('janela ' + st + ' (' + o + ')', 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 8, oy + 8); I.drawWindow(g, { tx: 0, ty: 0, orient: o, state: st, prog: 0, t: 9, cx: 0.5, cy: 0.5 }, G, 0); g.restore(); });
    });
    grp = 'props_veiculos';
    const V = (kind, parts, state) => ({ kind, state, cx: 1.5, cy: 1.5, w: 2, h: 3, tx: 0, ty: 0, range: 3, need: kind === 'car' ? ['battery', 'ckey', 'cfuel'] : ['prop', 'bkey', 'bfuel'], parts, wp: {}, order: Object.keys(parts), anim: 0, pax: [], seated: 0 });
    draw('carro (capô aberto, sem peças)', 4, 5, (g, ox, oy) => { g.save(); g.translate(ox + 2 * TS, oy + 2.5 * TS); const v = V('car', {}, 'build'); v.cx = 0; v.cy = 0; I.drawVehicle(g, v, G, 0); g.restore(); });
    draw('carro (ligado)', 4, 5, (g, ox, oy) => { g.save(); g.translate(ox + 2 * TS, oy + 2.5 * TS); const v = V('car', { battery: true, ckey: true, cfuel: true }, 'started'); v.cx = 0; v.cy = 0; I.drawVehicle(g, v, G, 0); g.restore(); });
    draw('barco (sem peças)', 5, 3, (g, ox, oy) => { g.save(); g.translate(ox + 2.5 * TS, oy + 1.5 * TS); const v = V('boat', {}, 'build'); v.cx = 0; v.cy = 0; v.w = 3; v.h = 2; I.drawVehicle(g, v, G, 0); g.restore(); });
    draw('barco (ligado)', 5, 3, (g, ox, oy) => { g.save(); g.translate(ox + 2.5 * TS, oy + 1.5 * TS); const v = V('boat', { prop: true, bkey: true, bfuel: true }, 'started'); v.cx = 0; v.cy = 0; v.w = 3; v.h = 2; I.drawVehicle(g, v, G, 0); g.restore(); });
    grp = 'props_itens';
    for (const nm of ['radio', 'battery', 'ckey', 'bkey', 'cfuel', 'bfuel', 'prop']) draw('item: ' + nm, 2, 2, (g, ox, oy) => { g.save(); g.translate(ox + 16, oy + 20); I.drawItem(g, nm === 'radio' ? { kind: 'radio', x: 0, y: 0, id: 0 } : { kind: 'part', part: nm, x: 0, y: 0, id: 0 }, 0); g.restore(); });
    // empacota cada grupo em linhas com largura máxima (folhas de no máximo ~2000 px de altura)
    const tile = TS * SC, MAXW = 6 * tile;
    for (const gname of ['props_moveis', 'props_veiculos', 'props_itens']) {
      const list = items.filter((it) => it.grp === gname);
      const MW2 = gname === 'props_moveis' ? 8 * tile : MAXW;
      let x = 0, y = 0, rowH = 0; const placed = [];
      for (const it of list) { const w = it.w * tile, h = it.h * tile; if (x + w > MW2) { x = 0; y += rowH; rowH = 0; } placed.push({ it, x, y, w, h }); x += w; rowH = Math.max(rowH, h); }
      const S = sheet(gname === 'props_itens' ? 4 * 2 * tile : MW2, y + rowH), cells = [];
      for (const p of placed) { S.g.save(); S.g.translate(p.x, p.y); S.g.scale(SC, SC); p.it.fn(S.g, 0, 0); S.g.restore(); cells.push({ name: p.it.name, x: p.x, y: p.y, w: p.w, h: p.h }); }
      out[gname] = { sheet: S.c, cells, cell: [tile, tile] };
    }
  }

  // ---------- resultado ----------
  const res = {};
  for (const k of Object.keys(out)) res[k] = { png: out[k].sheet.toDataURL('image/png'), labeled: labeled(out[k].sheet, out[k].cells).toDataURL('image/png'), cells: out[k].cells, w: out[k].sheet.width, h: out[k].sheet.height, cell: out[k].cell };
  return res;
})();
