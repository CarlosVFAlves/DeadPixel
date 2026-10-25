// node tests/sim.js — valida o mapa e a mecânica de pallet sem navegador
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Date, Uint8Array, Float32Array, Array, Object };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['map.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const DP = ctx.DP;

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('  FALHOU:', msg); } else console.log('  ok:', msg); }

function seeded(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- 1. mapa ----------
console.log('mapa');
{
  const m = DP.buildMap();
  const { W, H, t } = m;
  const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && t[y * W + x] === 0;
  ok(free(Math.floor(m.spawnSurvivor.x), Math.floor(m.spawnSurvivor.y)), 'spawn do sobrevivente livre');
  ok(free(Math.floor(m.spawnKiller.x), Math.floor(m.spawnKiller.y)), 'spawn do assassino livre');

  // flood fill (4-vizinhos): todo piso alcançável
  const seen = new Uint8Array(W * H), st = [[Math.floor(m.spawnSurvivor.x), Math.floor(m.spawnSurvivor.y)]];
  seen[st[0][1] * W + st[0][0]] = 1;
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (free(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); }
    }
  }
  let unreach = 0;
  for (let i = 0; i < W * H; i++) if (t[i] === 0 && !seen[i]) unreach++;
  ok(unreach === 0, `todo piso conectado (${unreach} tiles isolados)`);
  ok(seen[Math.floor(m.spawnKiller.y) * W + Math.floor(m.spawnKiller.x)] === 1, 'assassino alcança o sobrevivente');

  // cada pallet: parede dos dois lados do vão e piso livre dos dois lados da passagem
  let bad = 0;
  for (const p of m.pallets) {
    const a = p.orient === 'h' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];      // lados (paredes)
    const b = p.orient === 'h' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];      // passagem (piso)
    for (const [dx, dy] of a) if (free(p.tx + dx, p.ty + dy)) { bad++; console.log('  pallet sem parede', p); }
    for (const [dx, dy] of b) if (!free(p.tx + dx, p.ty + dy)) { bad++; console.log('  pallet sem passagem', p); }
  }
  ok(bad === 0, `${m.pallets.length} pallets bem encaixados nos vãos`);
}

// ---------- helpers de cenário ----------
function scene(training) {
  const g = DP.createGame({ rng: seeded(1), training: !!training });
  g.k.state = 'chase';
  return g;
}
function runFor(g, secs, inp) { for (let i = 0; i < secs * 60; i++) g.update(1 / 60, typeof inp === 'function' ? inp(g) : inp); }

// ---------- 2. pallet atordoa quando o assassino está na zona ----------
console.log('atordoar');
{
  const g = scene();
  const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);   // porta oeste da casa 1 (queda para leste/oeste)
  // sobrevivente fora da casa (oeste), assassino dentro (leste) -> pallet cai para leste, em cima do assassino
  g.s.x = p.cx - 0.9; g.s.y = p.cy;
  g.k.x = p.cx + 1.0; g.k.y = p.cy; g.k.state = 'recover'; g.k.dur = 99;
  ok(g.tryDrop(), 'derrubou o pallet');
  ok(p.state === 'falling', 'pallet em queda');
  runFor(g, 0.4, {});
  ok(p.state === 'down', 'pallet no chão');
  ok(p.dir.x === 1, 'caiu para longe do sobrevivente (leste)');
  ok(g.k.state === 'stun', 'assassino atordoado');
  ok(g.stats.stuns === 1, 'contagem de atordoamentos = 1');
  runFor(g, DP.CFG.STUN + 0.2, {});
  ok(g.k.state !== 'stun', 'assassino se recupera depois');
}

// ---------- 3. errou: assassino fora da zona ----------
console.log('errar');
{
  const g = scene();
  const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);
  g.s.x = p.cx - 0.9; g.s.y = p.cy;
  g.k.x = p.cx + 3.0; g.k.y = p.cy; g.k.state = 'recover'; g.k.dur = 99;   // longe demais
  g.tryDrop(); runFor(g, 0.4, {});
  ok(g.k.state === 'recover', 'não atordoou (longe)');
  ok(g.stats.misses === 1, 'contou como errado (quase)');
  ok(p.state === 'down', 'pallet fica caído e bloqueia');
  ok(g.solid(p.tx, p.ty), 'tile do pallet caído é sólido');
}
{
  // assassino do MESMO lado do sobrevivente -> não atordoa
  const g = scene();
  const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);
  g.s.x = p.cx - 0.9; g.s.y = p.cy;
  g.k.x = p.cx - 1.8; g.k.y = p.cy; g.k.state = 'recover'; g.k.dur = 99;
  g.tryDrop(); runFor(g, 0.4, {});
  ok(g.stats.stuns === 0, 'assassino do mesmo lado não é atordoado');
}

// ---------- 4. pular pallet caído e o assassino quebrando ----------
console.log('pular e quebrar');
{
  const g = scene();
  const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);
  g.s.x = p.cx - 0.9; g.s.y = p.cy;
  g.k.x = p.cx + 8; g.k.y = p.cy; g.k.state = 'recover'; g.k.dur = 99;
  g.tryDrop(); runFor(g, 0.4, {});
  // empurra contra o pallet (leste): deve pular
  runFor(g, 0.2, { ax: 1, ay: 0 });
  ok(g.s.vault || g.stats.vaults > 0, 'iniciou pulo ao empurrar contra o pallet');
  runFor(g, 0.8, { ax: 0, ay: 0 });
  ok(g.s.x > p.cx + 0.5, 'sobrevivente passou para o outro lado');
  ok(!g.s.vault, 'pulo terminou');
}
{
  // assassino do outro lado de um pallet caído, sem rota curta -> quebra
  const g = scene();
  const p = g.pallets.find((q) => q.orient === 'h' && q.tx === 22 && q.ty === 12);   // casa central, porta norte
  // sobrevivente dentro da casa central, assassino fora ao norte; a porta caída é o caminho mais curto
  p.state = 'down'; p.dir = { x: 0, y: -1 };
  g.s.x = 22.5; g.s.y = 14.5;
  g.k.x = 22.5; g.k.y = 10.5; g.k.state = 'chase';
  let broke = false;
  for (let i = 0; i < 60 * 8; i++) { g.update(1 / 60, {}); if (g.k.state === 'break') broke = true; if (p.state === 'broken') break; }
  ok(broke, 'assassino entrou em estado de quebrar');
  ok(p.state === 'broken' || g.stats.breaks >= 1 || g.k.state !== 'chase', 'pallet foi quebrado (ou rota alternativa tomada)');
}

// ---------- 5. mind game: assassino hesita perto de pallet de pé ----------
console.log('hesitação');
{
  let hesitated = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = DP.createGame({ rng: seeded(seed) });
    g.k.state = 'chase';
    const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);
    g.s.x = p.cx - 0.9; g.s.y = p.cy;
    g.k.x = p.cx + 2.4; g.k.y = p.cy;
    for (let i = 0; i < 60; i++) { g.update(1 / 60, {}); if (g.k.hesitate) { hesitated++; break; } }
  }
  ok(hesitated > 5 && hesitated < 30, `assassino hesita em parte dos encontros (${hesitated}/30)`);
}

// ---------- 6. fuzz: bot aleatório, sem NaN e sem ficar preso em parede ----------
console.log('fuzz');
{
  let problems = 0, stunsTotal = 0, downs = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const rnd = seeded(seed * 7);
    const g = DP.createGame({ rng: rnd, training: seed % 2 === 0 });
    let ax = 0, ay = 0, ct = 0;
    for (let i = 0; i < 60 * 90 && !g.over; i++) {
      ct -= 1 / 60;
      if (ct <= 0) { const a = rnd() * Math.PI * 2; ax = Math.cos(a); ay = Math.sin(a); ct = 0.3 + rnd() * 1.2; }
      // bot tolo: derruba o pallet quando o assassino está perto
      const drop = g.near && g.dist < 2.6 && rnd() < 0.2;
      g.update(1 / 60, { ax, ay, drop });
      for (const e of [g.s, g.k]) {
        if (!isFinite(e.x) || !isFinite(e.y)) problems++;
        else if (g.solid(Math.floor(e.x), Math.floor(e.y)) && !g.s.vault) { problems++; if (problems < 4) console.log('   dentro de sólido', e === g.s ? 'S' : 'K', e.x.toFixed(2), e.y.toFixed(2)); }
      }
    }
    stunsTotal += g.stats.stuns; if (g.over) downs++;
  }
  ok(problems === 0, `nenhum NaN / ninguém dentro de parede (problemas: ${problems})`);
  ok(stunsTotal > 0, `bots conseguiram atordoar (total ${stunsTotal}); abatidos: ${downs}/40`);
}

// ---------- 7. a IA persegue e acerta quem fica parado ----------
console.log('IA');
{
  const g = scene();
  runFor(g, 30, {});
  ok(g.over, 'sobrevivente parado é derrubado em até 30s');
  ok(g.stats.hits >= 2, `precisou de 2 acertos (acertos: ${g.stats.hits})`);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
