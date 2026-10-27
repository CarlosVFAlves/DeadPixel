// Arena fixa do protótipo: casas com 2 portas (cada uma com um pallet),
// muros com vão + pallet e algumas caixas para criar "loops" de perseguição.
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  const W = 48, H = 32;
  const T_FLOOR = 0, T_WALL = 1, T_CRATE = 2, T_GEN = 3, T_GATE = 4, T_WIN = 5;

  function buildArena() {
    const t = new Uint8Array(W * H);
    const indoor = new Uint8Array(W * H);
    const pallets = [];
    const set = (x, y, v) => { t[y * W + x] = v; };

    for (let x = 0; x < W; x++) { set(x, 0, T_WALL); set(x, H - 1, T_WALL); }
    for (let y = 0; y < H; y++) { set(0, y, T_WALL); set(W - 1, y, T_WALL); }

    // orient 'h': porta numa parede horizontal (a passagem é vertical, o pallet cai para norte/sul)
    // orient 'v': porta numa parede vertical (a passagem é horizontal, o pallet cai para leste/oeste)
    function house(x, y, w, h, pillar, doors) {
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          const edge = xx === x || xx === x + w - 1 || yy === y || yy === y + h - 1;
          set(xx, yy, edge ? T_WALL : T_FLOOR);
          indoor[yy * W + xx] = 1;
        }
      }
      if (pillar) for (let yy = 0; yy < pillar[3]; yy++) for (let xx = 0; xx < pillar[2]; xx++) set(pillar[0] + xx, pillar[1] + yy, T_CRATE);
      for (const d of doors) { set(d[0], d[1], T_FLOOR); pallets.push({ tx: d[0], ty: d[1], orient: d[2] }); }
    }

    function block(x, y, w, h, type) {
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) set(x + xx, y + yy, type);
    }

    // muro solto com vão no meio: o pallet fica no vão (dá para contornar pelas pontas)
    function wallGap(x, y, len, gapAt) {
      for (let i = 0; i < len; i++) {
        if (i === gapAt) pallets.push({ tx: x + i, ty: y, orient: 'h' });
        else set(x + i, y, T_WALL);
      }
    }

    house(5, 4, 10, 8, [9, 7, 2, 2], [[5, 7, 'v'], [14, 8, 'v']]);
    house(31, 4, 11, 8, [35, 7, 3, 1], [[33, 4, 'h'], [39, 11, 'h']]);
    house(6, 20, 9, 8, [9, 23, 3, 1], [[8, 20, 'h'], [14, 24, 'v']]);
    house(32, 20, 10, 8, [36, 23, 2, 2], [[32, 23, 'v'], [38, 27, 'h']]);
    house(20, 12, 8, 8, [23, 15, 2, 2], [[22, 12, 'h'], [25, 19, 'h']]);

    wallGap(8, 15, 7, 3);   // x 8..14, vão em 11
    wallGap(33, 15, 7, 3);  // x 33..39, vão em 36

    // caixas/obstáculos de cenário
    block(18, 7, 2, 1, T_CRATE);
    block(28, 8, 1, 2, T_CRATE);
    block(17, 16, 1, 2, T_CRATE);
    block(29, 22, 2, 1, T_CRATE);
    block(23, 23, 2, 1, T_CRATE);
    block(44, 13, 1, 3, T_CRATE);
    block(3, 14, 1, 3, T_CRATE);
    block(16, 28, 3, 1, T_CRATE);
    block(44, 24, 2, 2, T_CRATE);

    // geradores (sólidos): um em cada casa e 3 ao ar livre; são precisos 5 de 8
    const gens = [[7, 10], [40, 9], [12, 25], [39, 25], [22, 17], [2, 22], [16, 2], [45, 6]].map((g) => ({ tx: g[0], ty: g[1] }));
    for (const g of gens) set(g.tx, g.ty, T_GEN);

    // porta principal: 2 tiles no meio da parede norte (abre depois de 5 geradores)
    const door = { tx: 23, ty: 0, w: 2 };
    set(23, 0, T_GATE); set(24, 0, T_GATE);

    // janelas: um tile de parede com vidro. 'h' = em parede horizontal (passa-se na vertical)
    const windows = [
      [10, 4, 'h'], [11, 11, 'h'],            // casa 1
      [31, 8, 'v'], [41, 7, 'v'],             // casa 2
      [6, 23, 'v'], [11, 27, 'h'],            // casa 3
      [41, 22, 'v'], [35, 20, 'h'],           // casa 4
      [20, 15, 'v'], [27, 16, 'v']            // casa central
    ].map((w) => ({ tx: w[0], ty: w[1], orient: w[2] }));
    for (const w of windows) set(w.tx, w.ty, T_WIN);

    return {
      W, H, t, indoor, pallets, gens, door, windows, NEED: 5,
      // onde itens (rádios) podem aparecer: dentro das casas e ao ar livre
      itemSpots: [[13.5, 10.5], [33.5, 9.5], [13.5, 21.5], [39.5, 21.5], [26.5, 18.5], [30.5, 3.5], [3.5, 28.5], [44.5, 19.5]].map((q) => ({ x: q[0], y: q[1] })),
      radios: 2,
      spawnSurvivors: [{ x: 24.5, y: 8.5 }, { x: 17.5, y: 10.5 }, { x: 29.5, y: 14.5 }, { x: 10.5, y: 13.5 }],
      spawnKiller: { x: 24.5, y: 26.5 }
    };
  }

  // kind: 'camp' (padrão, 144x96 gerado por semente) ou 'arena' (48x32 fixa: treino e testes)
  DP.buildMap = function (opts) {
    opts = opts || {};
    return opts.kind === 'arena' ? buildArena() : DP.buildCamp(opts);
  };
  DP.T = { FLOOR: T_FLOOR, WALL: T_WALL, CRATE: T_CRATE, GEN: T_GEN, GATE: T_GATE, WIN: T_WIN, TREE: 6, WATER: 7, VEH: 8, LOCKER: 9, CHEST: 10 };
})(typeof window !== 'undefined' ? window : globalThis);
