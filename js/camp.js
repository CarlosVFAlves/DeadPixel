// Mapa grande "Acampamento" (144x96), gerado por semente:
// estrada e estacionamento ao norte (portão), praça com fogueira no centro, cabanas em volta,
// lago com cais a leste e floresta densa no resto. Tudo conectado (testado em várias sementes).
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  const W = 144, H = 96;
  const T_FLOOR = 0, T_WALL = 1, T_CRATE = 2, T_GEN = 3, T_GATE = 4, T_WIN = 5, T_TREE = 6, T_WATER = 7, T_VEH = 8;
  const G_GRASS = 0, G_DIRT = 1, G_SAND = 2, G_PLANK = 3, G_GRAVEL = 4;
  const PLAZA = { x: 71, y: 47 };

  // modelos de cabana (coordenadas relativas ao canto superior esquerdo); vêm das casas da arena
  const CABINS = [
    { w: 10, h: 8, pillar: [4, 3, 2, 2], doors: [[0, 3, 'v'], [9, 4, 'v']], wins: [[5, 0, 'h'], [6, 7, 'h']], gen: [2, 6] },
    { w: 11, h: 8, pillar: [4, 3, 3, 1], doors: [[2, 0, 'h'], [8, 7, 'h']], wins: [[0, 4, 'v'], [10, 3, 'v']], gen: [9, 5] },
    { w: 9, h: 8, pillar: [3, 3, 3, 1], doors: [[2, 0, 'h'], [8, 4, 'v']], wins: [[0, 3, 'v'], [5, 7, 'h']], gen: [6, 5] },
    { w: 10, h: 8, pillar: [4, 3, 2, 2], doors: [[0, 3, 'v'], [6, 7, 'h']], wins: [[9, 2, 'v'], [3, 0, 'h']], gen: [7, 5] }
  ];
  // onde as cabanas tentam ficar (canto superior esquerdo); cada partida sorteia 10 dessas e dá um pequeno desvio
  const ANCHORS = [[28, 24], [46, 34], [24, 50], [44, 60], [54, 72], [84, 38], [100, 24], [90, 62], [72, 74], [112, 16], [12, 36], [30, 76]];

  function buildCamp(opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const ns = ri(1, 1e9);

    const t = new Uint8Array(W * H), ground = new Uint8Array(W * H), indoor = new Uint8Array(W * H), occ = new Uint8Array(W * H);
    const pallets = [], windows = [], gens = [], pois = [], keys = [];
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const inner = (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
    const idx = (x, y) => y * W + x;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    function h2(x, y, k) {
      let h = (x * 374761393 + y * 668265263 + (ns + (k || 0)) * 2147483647) | 0;
      h = (h ^ (h >>> 13)) * 1274126177 | 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function vnoise(x, y, sc) {
      const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const s = (v) => v * v * (3 - 2 * v), u = s(fx), v = s(fy);
      const a = h2(x0, y0, 7), b = h2(x0 + 1, y0, 7), c = h2(x0, y0 + 1, 7), d = h2(x0 + 1, y0 + 1, 7);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }

    // ---------- floresta ----------
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inner(x, y)) { t[idx(x, y)] = T_TREE; continue; }
        const n = vnoise(x, y, 16) * 0.6 + vnoise(x, y, 5) * 0.4;
        const dc = Math.hypot((x - PLAZA.x) / 52, (y - PLAZA.y) / 34);
        const f = 0.3 + 0.7 * clamp(dc, 0, 1);              // mais aberto perto do centro
        const dens = (0.16 + 0.58 * n) * f;
        if (h2(x, y, 99) < dens) t[idx(x, y)] = T_TREE;
      }
    }

    function clearRect(x, y, w, h, gnd) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        if (!inb(xx, yy)) continue;
        const i = idx(xx, yy);
        if (t[i] === T_TREE && inner(xx, yy)) t[i] = T_FLOOR;
        if (gnd !== undefined && t[i] === T_FLOOR && !indoor[i]) ground[i] = gnd;
      }
    }
    function clearEllipse(cx, cy, rx, ry, gnd) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inb(x, y) || !inner(x, y)) continue;
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
        clearRect(x, y, 1, 1, gnd);
      }
    }
    // trilha em L (horizontal depois vertical), `w` de largura
    function trail(x0, y0, x1, y1, w) {
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      for (let x = x0; x !== x1 + sx; x += sx) clearRect(x, y0 - (w >> 1), 1, w, G_DIRT);
      for (let y = y0; y !== y1 + sy; y += sy) clearRect(x1 - (w >> 1), y, w, 1, G_DIRT);
    }
    function mark(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inb(xx, yy)) occ[idx(xx, yy)] = 1; }

    // ---------- estrada, estacionamento e praça ----------
    clearRect(69, 1, 4, 46, G_DIRT);
    mark(66, 0, 10, 46);
    clearRect(56, 5, 30, 12, G_GRAVEL);
    mark(56, 5, 30, 12);
    clearEllipse(PLAZA.x, PLAZA.y, 11, 8, G_DIRT);
    mark(PLAZA.x - 11, PLAZA.y - 8, 22, 16);
    const door = { tx: 70, ty: 0, w: 2 };
    for (let x = 0; x < 2; x++) t[idx(door.tx + x, 0)] = T_GATE;
    t[idx(69, 0)] = T_WALL; t[idx(72, 0)] = T_WALL;
    for (let x = 69; x <= 72; x++) { t[idx(x, 1)] = T_FLOOR; ground[idx(x, 1)] = G_DIRT; }          // a estrada chega até o portão
    pois.push({ kind: 'gate', x: 71, y: 2.5, r: 6 });
    pois.push({ kind: 'parking', x: 71, y: 10.5, r: 12 });
    pois.push({ kind: 'plaza', x: PLAZA.x + 0.5, y: PLAZA.y + 0.5, r: 9 });

    // ---------- escolha das cabanas ----------
    const specs = [];
    const order = ANCHORS.slice().sort(() => rng() - 0.5);
    for (const a of order) {
      if (specs.length >= 10) break;
      for (let tries = 0; tries < 6; tries++) {
        const m = pick(CABINS), fx = rng() < 0.5, fy = rng() < 0.5;
        const x = a[0] + ri(-2, 2), y = a[1] + ri(-2, 2);
        if (x < 6 || y < 6 || x + m.w > W - 6 || y + m.h > H - 6) continue;
        const ok = specs.every((s) => x > s.x + s.m.w + 4 || x + m.w + 4 < s.x || y > s.y + s.m.h + 4 || y + m.h + 4 < s.y);
        const nearRoad = x < 76 && x + m.w > 64 && y < 48;           // não em cima da estrada/praça
        const nearPlaza = Math.hypot(x + m.w / 2 - PLAZA.x, y + m.h / 2 - PLAZA.y) < 16;
        if (!ok || nearRoad || nearPlaza) continue;
        specs.push({ x, y, m, fx, fy });
        break;
      }
    }
    const tr = (s, rx, ry) => ({ x: s.x + (s.fx ? s.m.w - 1 - rx : rx), y: s.y + (s.fy ? s.m.h - 1 - ry : ry) });

    // ---------- lago, areia e cais ----------
    const LAKE = { x: 120 + ri(-3, 3), y: 64 + ri(-3, 3), rx: 20, ry: 14 };
    const nearCabin = (x, y, m) => specs.some((s) => x > s.x - m && x < s.x + s.m.w + m && y > s.y - m && y < s.y + s.m.h + m);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const q = ((x + 0.5 - LAKE.x) / LAKE.rx) ** 2 + ((y + 0.5 - LAKE.y) / LAKE.ry) ** 2;
      if (q < 1 + 0.5 * (vnoise(x, y, 5) - 0.5) && !nearCabin(x, y, 4)) { t[idx(x, y)] = T_WATER; }
    }
    // areia: tiles a até 2 de distância da água
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (t[idx(x, y)] === T_WATER) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy) && t[idx(x + dx, y + dy)] === T_WATER) { near = true; break; }
      if (near) { if (t[idx(x, y)] === T_TREE) t[idx(x, y)] = T_FLOOR; ground[idx(x, y)] = G_SAND; occ[idx(x, y)] = 1; }
    }
    // cais: sai da margem oeste para dentro da água, 2 tiles de largura
    let dockX = -1;
    const dockY = LAKE.y;
    for (let x = LAKE.x - LAKE.rx - 6; x < LAKE.x; x++) if (t[idx(x, dockY)] === T_WATER) { dockX = x; break; }
    const dockEnd = { x: dockX + 9.5, y: dockY + 1 };
    for (let x = dockX - 3; x < dockX + 10; x++) for (let y = dockY; y < dockY + 2; y++) {
      t[idx(x, y)] = T_FLOOR; ground[idx(x, y)] = G_PLANK; occ[idx(x, y)] = 1;
    }
    pois.push({ kind: 'dock', x: dockX + 3, y: dockY + 1, r: 8 });
    pois.push({ kind: 'lake', x: LAKE.x, y: LAKE.y, r: 16 });

    // trilhas: da praça para o cais, para o estacionamento lateral e para cada cabana
    trail(PLAZA.x, PLAZA.y + 3, dockX - 3, dockY, 3);
    for (const s of specs) {
      const d = s.m.doors[0], p = tr(s, d[0], d[1]);
      const o = d[0] === 0 ? [p.x - 1, p.y] : d[0] === s.m.w - 1 ? [p.x + 1, p.y] : d[1] === 0 ? [p.x, p.y - 1] : [p.x, p.y + 1];
      // a trilha começa na praça (ou no cais) e termina na porta
      trail(PLAZA.x + (o[0] < PLAZA.x ? -9 : 9), PLAZA.y + (o[1] < PLAZA.y ? -2 : 2), o[0], o[1], 2);
    }

    // ---------- cabanas ----------
    specs.forEach((s, n) => {
      const { m } = s;
      clearRect(s.x - 3, s.y - 3, m.w + 6, m.h + 6, G_GRASS);
      mark(s.x - 3, s.y - 3, m.w + 6, m.h + 6);
      for (let yy = 0; yy < m.h; yy++) for (let xx = 0; xx < m.w; xx++) {
        const p = tr(s, xx, yy), edge = xx === 0 || yy === 0 || xx === m.w - 1 || yy === m.h - 1;
        t[idx(p.x, p.y)] = edge ? T_WALL : T_FLOOR;
        indoor[idx(p.x, p.y)] = 1; ground[idx(p.x, p.y)] = G_PLANK;
      }
      const pl = tr(s, m.pillar[0], m.pillar[1]), pl2 = tr(s, m.pillar[0] + m.pillar[2] - 1, m.pillar[1] + m.pillar[3] - 1);
      for (let yy = Math.min(pl.y, pl2.y); yy <= Math.max(pl.y, pl2.y); yy++) for (let xx = Math.min(pl.x, pl2.x); xx <= Math.max(pl.x, pl2.x); xx++) t[idx(xx, yy)] = T_CRATE;
      for (const d of m.doors) {
        const p = tr(s, d[0], d[1]);
        t[idx(p.x, p.y)] = T_FLOOR; pallets.push({ tx: p.x, ty: p.y, orient: d[2] });
        const o = d[0] === 0 ? [p.x - 1, p.y] : d[0] === m.w - 1 ? [p.x + 1, p.y] : d[1] === 0 ? [p.x, p.y - 1] : [p.x, p.y + 1];
        ground[idx(o[0], o[1])] = G_PLANK; keys.push({ x: o[0], y: o[1] });
      }
      for (const w of m.wins) { const p = tr(s, w[0], w[1]); t[idx(p.x, p.y)] = T_WIN; windows.push({ tx: p.x, ty: p.y, orient: w[2] }); }
      s.n = n;
      pois.push({ kind: 'cabin', x: s.x + m.w / 2, y: s.y + m.h / 2, r: 8, id: n });
    });

    // ---------- muros com vão (pallet) e caixotes ----------
    const freeForProp = (x, y, w, h) => {
      for (let yy = y - 1; yy < y + h + 1; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) {
        if (!inner(xx, yy) || occ[idx(xx, yy)] || indoor[idx(xx, yy)]) return false;
        const v = t[idx(xx, yy)];
        if (v !== T_FLOOR && v !== T_TREE) return false;
      }
      return true;
    };
    function wallGap(x, y, len, gapAt, vertical) {
      clearRect(vertical ? x - 1 : x - 1, vertical ? y - 1 : y - 1, vertical ? 3 : len + 2, vertical ? len + 2 : 3, G_GRASS);
      for (let i = 0; i < len; i++) {
        const xx = vertical ? x : x + i, yy = vertical ? y + i : y;
        if (i === gapAt) {
          pallets.push({ tx: xx, ty: yy, orient: vertical ? 'v' : 'h' });
          if (vertical) { keys.push({ x: xx - 1, y: yy }); keys.push({ x: xx + 1, y: yy }); } else { keys.push({ x: xx, y: yy - 1 }); keys.push({ x: xx, y: yy + 1 }); }
        }
        else t[idx(xx, yy)] = T_WALL;
      }
      mark(vertical ? x - 1 : x - 1, vertical ? y - 1 : y - 1, vertical ? 3 : len + 2, vertical ? len + 2 : 3);
    }
    let placed = 0;
    for (let tries = 0; tries < 800 && placed < 16; tries++) {
      const v = rng() < 0.5, x = ri(8, W - 18), y = ri(8, H - 18);
      const w = v ? 1 : 7, h = v ? 7 : 1;
      if (!freeForProp(x, y, w, h)) continue;
      wallGap(x, y, 7, 3, v); placed++;
    }
    placed = 0;
    for (let tries = 0; tries < 800 && placed < 24; tries++) {
      const w = ri(1, 3), h = w === 1 ? ri(1, 3) : 1, x = ri(6, W - 10), y = ri(6, H - 10);
      if (!freeForProp(x, y, w, h)) continue;
      clearRect(x - 1, y - 1, w + 2, h + 2, G_GRASS);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) t[idx(x + xx, y + yy)] = T_CRATE;
      mark(x, y, w, h); placed++;
    }

    // ---------- geradores (caixas de fusível): 5 dentro de cabanas, 3 ao ar livre ----------
    const cabinOrder = specs.slice().sort(() => rng() - 0.5);
    const inside = cabinOrder.slice(0, 5);
    for (const s of inside) { const p = tr(s, s.m.gen[0], s.m.gen[1]); gens.push({ tx: p.x, ty: p.y, cabin: s.n }); }
    for (let tries = 0; tries < 3000 && gens.length < 8; tries++) {
      const x = ri(10, W - 12), y = ri(10, H - 12);
      if (!freeForProp(x - 1, y - 1, 3, 3)) continue;
      if (Math.hypot(x - 71, y - 2) < 24) continue;                 // longe do portão
      if (gens.some((g) => Math.hypot(g.tx - x, g.ty - y) < 22)) continue;
      clearRect(x - 2, y - 2, 5, 5, G_DIRT);
      mark(x - 2, y - 2, 5, 5);
      gens.push({ tx: x, ty: y, cabin: -1 });
      // dois caixotes ao lado marcam o "abrigo" do gerador
      const sx = rng() < 0.5 ? -2 : 2;
      t[idx(x + sx, y - 1)] = T_CRATE; t[idx(x + sx, y)] = T_CRATE;
    }
    for (const g of gens) { t[idx(g.tx, g.ty)] = T_GEN; }

    // ---------- telefone (guarita ao lado da estrada) ----------
    const phone = { tx: 75, ty: 30 };
    clearRect(phone.tx - 2, phone.ty - 2, 5, 5, G_DIRT);
    mark(phone.tx - 2, phone.ty - 2, 5, 5);
    t[idx(phone.tx, phone.ty)] = T_GEN;
    pois.push({ kind: 'phone', x: phone.tx + 0.5, y: phone.ty + 0.5, r: 5 });

    // ---------- veículos: carro no estacionamento (de frente para o portão) e barco na ponta do cais ----------
    const CAR = { x: 74, y: 8, w: 2, h: 3 };
    for (let yy = 0; yy < CAR.h; yy++) for (let xx = 0; xx < CAR.w; xx++) { t[idx(CAR.x + xx, CAR.y + yy)] = T_VEH; ground[idx(CAR.x + xx, CAR.y + yy)] = G_GRAVEL; }
    const vehicles = [
      { kind: 'car', cx: CAR.x + CAR.w / 2, cy: CAR.y + CAR.h / 2, w: CAR.w, h: CAR.h, tx: CAR.x, ty: CAR.y, range: 2.8, stand: { x: CAR.x + CAR.w / 2, y: CAR.y + CAR.h + 0.7 } },
      { kind: 'boat', cx: dockX + 11.5, cy: dockY + 1, w: 3, h: 2, tx: dockX + 10, ty: dockY, range: 3.2, stand: { x: dockX + 9.5, y: dockY + 1 } }
    ];
    pois.push({ kind: 'car', x: vehicles[0].cx, y: vehicles[0].cy, r: 4 });
    pois.push({ kind: 'boat', x: vehicles[1].cx, y: vehicles[1].cy, r: 4 });

    // ---------- pontos de partida ----------
    const sp = [[-6, -3], [6, -3], [-5, 4], [5, 4]].map((o) => ({ x: PLAZA.x + o[0] + 0.5, y: PLAZA.y + o[1] + 0.5 }));
    const kc = pick([[20, 84], [26, 88]]);
    clearRect(kc[0] - 2, kc[1] - 2, 5, 5, G_DIRT);
    const spawnKiller = { x: kc[0] + 0.5, y: kc[1] + 0.5 };
    pois.push({ kind: 'killer', x: spawnKiller.x, y: spawnKiller.y, r: 5 });

    // ---------- conectividade ----------
    const seen = new Uint8Array(W * H), q = new Int32Array(W * H);
    function flood(start) {
      seen.fill(0);
      let a = 0, b = 0; q[b++] = start; seen[start] = 1;
      while (a < b) {
        const i = q[a++], x = i % W, y = (i / W) | 0;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + d[0], ny = y + d[1];
          if (!inb(nx, ny)) continue;
          const j = idx(nx, ny);
          if (t[j] === T_FLOOR && !seen[j]) { seen[j] = 1; q[b++] = j; }
        }
      }
    }
    const root0 = idx(70, 2);
    function carveTo(sx, sy) {
      // BFS por piso/árvore até alcançar o conjunto já ligado; limpa as árvores do caminho
      const prev = new Int32Array(W * H).fill(-1), vis = new Uint8Array(W * H);
      let a = 0, b = 0; const s0 = idx(sx, sy); q[b++] = s0; vis[s0] = 1;
      let hit = -1;
      while (a < b && hit < 0) {
        const i = q[a++], x = i % W, y = (i / W) | 0;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + d[0], ny = y + d[1];
          if (!inner(nx, ny)) continue;
          const j = idx(nx, ny);
          if (vis[j]) continue;
          const v = t[j];
          if (v !== T_FLOOR && v !== T_TREE) continue;
          vis[j] = 1; prev[j] = i; q[b++] = j;
          if (seen[j]) { hit = j; break; }
        }
      }
      for (let j = hit; j >= 0 && j !== s0; j = prev[j]) if (t[j] === T_TREE) { t[j] = T_FLOOR; ground[j] = G_DIRT; }
      if (t[s0] === T_TREE) t[s0] = T_FLOOR;
    }
    const pts = keys.concat(sp.map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) })), [{ x: Math.floor(spawnKiller.x), y: Math.floor(spawnKiller.y) }, { x: Math.floor(dockEnd.x), y: Math.floor(dockEnd.y) }]);
    for (const g of gens.concat([phone])) for (const d of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = g.tx + d[0], y = g.ty + d[1]; if (t[idx(x, y)] === T_FLOOR || t[idx(x, y)] === T_TREE) { pts.push({ x, y }); break; } }
    flood(root0);
    for (const p of pts) { if (!seen[idx(p.x, p.y)]) { carveTo(p.x, p.y); flood(root0); } }
    // buracos isolados viram mata
    for (let i = 0; i < W * H; i++) if (t[i] === T_FLOOR && !seen[i]) t[i] = T_TREE;
    // árvores nas bordas internas viram "paredão" de mata; nada além disso

    // ---------- itens ----------
    const itemSpots = [];
    function freeNear(x, y) {
      for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (inb(xx, yy) && seen[idx(xx, yy)] && t[idx(xx, yy)] === T_FLOOR) return { x: xx + 0.5, y: yy + 0.5 };
      }
      return null;
    }
    for (const s of specs) { const p = freeNear(s.x + (s.m.w >> 1) + 2, s.y + s.m.h - 3); if (p) itemSpots.push({ x: p.x, y: p.y, inside: true }); }
    for (let tries = 0; tries < 400 && itemSpots.length < 30; tries++) {
      const x = ri(6, W - 8), y = ri(6, H - 8);
      if (!seen[idx(x, y)] || t[idx(x, y)] !== T_FLOOR || indoor[idx(x, y)]) continue;
      if (itemSpots.every((p) => Math.hypot(p.x - x, p.y - y) > 9)) itemSpots.push({ x: x + 0.5, y: y + 0.5 });
    }

    // pontos que as equipes visitam para "descobrir" geradores e itens: centro de cada cabana + malha na mata/clareiras
    const explore = [];
    for (const s of specs) { const p = freeNear(s.x + (s.m.w >> 1), s.y + (s.m.h >> 1)); if (p) explore.push({ x: p.x, y: p.y, kind: 'cabin' }); }
    for (let y = 12; y < H - 8; y += 14) for (let x = 12; x < W - 8; x += 14) {
      const p = freeNear(x + ri(-3, 3), y + ri(-3, 3));
      if (p && explore.every((e) => Math.hypot(e.x - p.x, e.y - p.y) > 8)) explore.push({ x: p.x, y: p.y, kind: 'spot' });
    }
    explore.forEach((e, i) => { e.id = i; });

    return {
      kind: 'camp', W, H, t, ground, indoor, pallets, gens, phone, vehicles, door, windows, NEED: 5,
      itemSpots, radios: 4, pois, explore, lake: LAKE, dock: { x: dockX, y: dockY, endX: dockEnd.x, endY: dockEnd.y },
      cabins: specs.map((s) => ({ x: s.x, y: s.y, w: s.m.w, h: s.m.h, id: s.n })),
      spawnSurvivors: sp, spawnKiller
    };
  }

  DP.buildCamp = buildCamp;
  DP.CAMP = { W, H, T_TREE, T_WATER, T_VEH, G_GRASS, G_DIRT, G_SAND, G_PLANK, G_GRAVEL };
})(typeof window !== 'undefined' ? window : globalThis);
