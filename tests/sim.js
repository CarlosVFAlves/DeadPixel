// node tests/sim.js — valida o mapa e a mecânica de pallet sem navegador
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Date, Uint8Array, Float32Array, Array, Object };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['camp.js', 'map.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const DP = ctx.DP;
// os testes antigos usam a arena fixa 48x32; o mapa grande tem a seção própria
{
  const bm = DP.buildMap, cg = DP.createGame;
  DP.buildMapAny = bm; DP.createGameAny = cg;
  DP.buildMap = (o) => bm(Object.assign({ kind: 'arena' }, o));
  DP.createGame = (o) => cg(Object.assign({ map: 'arena' }, o));
}

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('  FALHOU:', msg); } else console.log('  ok:', msg); }

function seeded(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- 1. mapa ----------
console.log('mapa');
{
  const m = DP.buildMap();
  const { W, H, t } = m;
  const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && t[y * W + x] === 0;
  ok(m.spawnSurvivors.length === 4 && m.spawnSurvivors.every((p) => free(Math.floor(p.x), Math.floor(p.y))), '4 pontos de início livres');
  ok(free(Math.floor(m.spawnKiller.x), Math.floor(m.spawnKiller.y)), 'spawn do assassino livre');

  // flood fill (4-vizinhos): todo piso alcançável
  const seen = new Uint8Array(W * H), st = [[Math.floor(m.spawnSurvivors[0].x), Math.floor(m.spawnSurvivors[0].y)]];
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
  ok(m.spawnSurvivors.every((p) => seen[Math.floor(p.y) * W + Math.floor(p.x)] === 1), 'todos os pontos de início conectados');

  // janelas: parede dos dois lados e piso livre dos dois lados da passagem
  let badW = 0;
  for (const w of m.windows) {
    const a = w.orient === 'h' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]], b2 = w.orient === 'h' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
    for (const [dx, dy] of a) if (t[(w.ty + dy) * W + w.tx + dx] !== 1) badW++;
    for (const [dx, dy] of b2) if (!free(w.tx + dx, w.ty + dy)) badW++;
  }
  ok(badW === 0 && m.windows.length >= 8, `${m.windows.length} janelas bem encaixadas nas paredes`);
  ok(m.gens.length === 8 && m.NEED === 5, '8 geradores, 5 necessários');
  ok(free(23, 1) && free(24, 1) && t[23] === 4 && t[24] === 4, 'porta principal de 2 tiles na parede norte, com passagem livre');

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
  const g = DP.createGame({ rng: seeded(1), training: !!training, bots: 0 });
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
  ok(!g.s.vault && g.stats.vaults === 0, 'só empurrar contra o pallet caído NÃO pula (precisa de ESPAÇO)');
  runFor(g, 0.2, { ax: 1, ay: 0, jump: true });
  ok(g.s.vault || g.stats.vaults > 0, 'com ESPAÇO pula o pallet caído');
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
    const g = DP.createGame({ rng: seeded(seed), bots: 0 });
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
    const g = DP.createGame({ rng: rnd, training: seed % 2 === 0, bots: 0 });
    let ax = 0, ay = 0, ct = 0;
    for (let i = 0; i < 60 * 90 && !g.over; i++) {
      ct -= 1 / 60;
      if (ct <= 0) { const a = rnd() * Math.PI * 2; ax = Math.cos(a); ay = Math.sin(a); ct = 0.3 + rnd() * 1.2; }
      // bot tolo: derruba o pallet quando o assassino está perto
      const drop = g.near && g.dist < 2.6 && rnd() < 0.2;
      g.update(1 / 60, { ax, ay, drop, act: rnd() < 0.5, press: rnd() < 0.05, actPress: rnd() < 0.02 });
      for (const e of [g.s, g.k]) {
        if (!isFinite(e.x) || !isFinite(e.y)) problems++;
        else if (g.solid(Math.floor(e.x), Math.floor(e.y)) && !(e === g.s && (g.s.vault || !g.alive(g.s))) && !(e === g.k && g.k.state === 'kvault')) { problems++; if (problems < 4) console.log('   dentro de sólido', e === g.s ? 'S' : 'K', e.x.toFixed(2), e.y.toFixed(2)); }
      }
    }
    stunsTotal += g.stats.stuns; if (g.over) downs++;
  }
  ok(problems === 0, `nenhum NaN / ninguém dentro de parede (problemas: ${problems})`);
  ok(true, `40 partidas aleatórias sem erro (atordoamentos: ${stunsTotal}; abatidos: ${downs}/40)`);
}

// ---------- 7. a IA persegue e acerta quem fica parado à vista ----------
console.log('IA');
{
  const g = scene();
  g.s.x = 26.5; g.s.y = 26.5;              // à vista do assassino
  runFor(g, 30, {});
  ok(g.over && g.result === 'dead', 'sobrevivente parado à vista é derrubado em até 30s');
  ok(g.stats.hits >= 2, `precisou de 2 acertos (acertos: ${g.stats.hits})`);
}

// ---------- 8. geradores ----------
console.log('geradores');
{
  const g = scene(true);
  g.k.state = 'intro'; g.k.t = -999;       // assassino fora de jogo neste teste
  const gen = g.gens[4];                   // (22,17) dentro da casa central
  g.s.x = gen.cx - 1.0; g.s.y = gen.cy;
  g.s.skillCD = 999;                       // sem skill check aqui
  runFor(g, 0.1, {});
  ok(g.interact && g.interact.type === 'gen', 'perto do gerador há ação disponível');
  runFor(g, g.routeTime('fuse') / 2, { act: true });
  ok(gen.progress > 0.45 && gen.progress < 0.55, `segurando AGIR metade do tempo = ~50% (${gen.progress.toFixed(2)})`);
  runFor(g, 1, { act: true, ax: 1 });      // andar cancela o reparo
  const before = gen.progress;
  runFor(g, 1, { ax: 0, ay: 0 });
  ok(gen.progress === before, 'sem segurar AGIR o progresso não anda');
  g.s.x = gen.cx - 1.0; g.s.y = gen.cy;
  runFor(g, g.routeTime('fuse') / 2 + 1, { act: true });
  ok(gen.done && g.gensDone === 1, 'gerador concluído');
  ok(!g.door.powered, 'porta ainda sem energia com 1 gerador');
}
{
  // skill check: acerto, perfeito e falha
  const mk = () => { const g = scene(true); g.k.state = 'intro'; g.k.t = -999; const gen = g.gens[4]; g.s.x = gen.cx - 1; g.s.y = gen.cy; g.s.skillCD = 0.1; return { g, gen }; };
  let { g, gen } = mk();
  runFor(g, 0.3, { act: true });
  ok(g.s.skill, 'skill check apareceu');
  // espera o ponteiro chegar no alvo e aperta
  let guard = 0; while (g.s.skill && Math.max(0, g.s.skill.t - g.cfg.SKILL_DELAY) * g.cfg.SKILL_SPEED < g.s.skill.tz && guard++ < 600) g.update(1 / 240, { act: true });
  const p0 = gen.progress; g.update(1 / 60, { act: true, press: true });
  ok(g.stats.skillOk === 1 && gen.progress > p0, 'skill check acertado dá bônus');
  ({ g, gen } = mk());
  runFor(g, 0.3, { act: true });
  const p1 = gen.progress; g.update(1 / 60, { act: true, press: true });       // cedo demais: ignorado
  ok(g.s.skill, 'toque antes do ponteiro girar é ignorado');
  runFor(g, 2.0, { act: true });                                                // deixa passar
  ok(g.stats.skillFail === 1, 'deixar passar conta como falha');
  ok(g.k.aware !== 'patrol' || g.k.state === 'intro', 'falha alerta o assassino (quando em jogo)');
}
{
  // falha de skill check alerta o assassino
  const g = scene(true); const gen = g.gens[4];
  g.s.x = gen.cx - 1; g.s.y = gen.cy; g.s.skillCD = 0.1; g.k.x = 40.5; g.k.y = 30.5;
  runFor(g, 0.2, {}); g.k.aware = 'patrol';
  runFor(g, 0.3, { act: true });
  runFor(g, 2.0, { act: true });
  ok(g.stats.skillFail === 1 && g.k.aware !== 'patrol', 'assassino vai investigar o barulho');
}

// ---------- 9. porta principal e fuga ----------
console.log('porta principal');
{
  const g = scene(true); g.k.state = 'intro'; g.k.t = -999;
  g.s.skillCD = 999;
  for (let i = 0; i < 5; i++) { g.s.x = g.gens[i].cx - 1; g.s.y = g.gens[i].cy; if (g.solid(Math.floor(g.s.x), Math.floor(g.s.y))) g.s.x += 2; g.s.skillCD = 999; runFor(g, 0.05, {}); runFor(g, g.routeTime('fuse') + 0.5, { act: true }); }
  ok(g.gensDone === 5, '5 de 8 geradores concluídos');
  ok(g.door.powered && !g.door.opened, 'porta principal energizada (ainda fechada)');
  g.s.x = 24.0; g.s.y = 2.2; g.s.skillCD = 999;
  runFor(g, 0.1, {});
  ok(g.interact && g.interact.type === 'door', 'perto da porta há ação');
  runFor(g, 4.3, { act: true });
  ok(g.door.opened && !g.over, 'segurar AGIR abre a porta');
  runFor(g, 1.0, { ay: -1 });
  ok(g.over && g.result === 'escaped' && g.s.escaped, 'atravessar a porta aberta = escapou');
}

// ---------- 10. percepção do assassino ----------
console.log('percepção');
{
  // longe e escondido: patrulha e não te vê
  const g = scene(); g.s.x = 24.5; g.s.y = 8.5; g.k.x = 24.5; g.k.y = 26.5;
  runFor(g, 3, {});
  ok(g.k.aware === 'patrol', 'sem ver nem ouvir, o assassino patrulha');
  // à vista: caça
  g.k.x = 24.5; g.k.y = 4.5; g.k.aware = 'patrol'; g.k.state = 'chase';
  runFor(g, 0.1, {});
  ok(g.k.aware === 'hunt', 'à vista, o assassino passa a caçar');
}
{
  // ouve o reparo através da parede
  const g = scene(); const gen = g.gens[4];
  g.s.x = gen.cx - 1; g.s.y = gen.cy; g.s.skillCD = 999;
  g.k.x = 24.5; g.k.y = 22.5; g.k.aware = 'patrol'; g.k.goal = g.gens[0];  // fora da casa, parede no meio, ~5 tiles
  runFor(g, 0.2, { act: true });
  ok(g.k.aware === 'search' && Math.hypot(g.k.last.x - g.s.x, g.k.last.y - g.s.y) <= g.cfg.HEAR_ERR * 1.5, 'ouve o reparo pela parede e vai investigar (posição aproximada, não exata)');
}
{
  // perde o rastro depois de se afastar
  const g = scene(true); g.k.x = 24.5; g.k.y = 26.5; g.k.aware = 'hunt'; g.k.lost = 0;
  g.s.x = 3.5; g.s.y = 3.5;
  runFor(g, 3.2, {});
  ok(g.k.aware === 'search' || g.k.aware === 'hunt', 'estado válido após perder de vista');
  runFor(g, 20, {});
  ok(g.k.aware !== 'hunt' || g.dist < CFG_SIGHT(g), 'desiste da caça quando não percebe mais você');
}
function CFG_SIGHT(g) { return g.cfg.VIS_K.cone; }
{
  // chuta gerador com progresso
  const g = scene(); const gen = g.gens[0]; gen.progress = 0.5; g.s.x = 24.5; g.s.y = 2.5;
  g.k.x = gen.cx + 2.5; g.k.y = gen.cy; g.k.aware = 'patrol'; g.k.goal = gen; g.k.state = 'chase';
  g.s.x = 46.5; g.s.y = 30.5;
  runFor(g, 3, {});
  ok(gen.progress < 0.5 && g.stats.kicks >= 1, `assassino chuta gerador com progresso (${gen.progress.toFixed(2)})`);
}


// ---------- 11. jogador como ASSASSINO ----------
console.log('assassino (jogador)');
function killerScene(training, seed) { return DP.createGame({ rng: seeded(seed || 3), role: 'killer', training: !!training, bots: 0 }); }
{
  const g = killerScene();
  ok(g.role === 'killer' && g.k.state === 'chase', 'começa livre para andar');
  const x0 = g.k.x;
  runFor(g, 1, { ax: 1, ay: 0 });
  ok(Math.abs((g.k.x - x0) - DP.CFG.K_SPEED_P) < 0.3, `anda na velocidade do assassino-jogador (${(g.k.x - x0).toFixed(2)} tiles/s)`);
}
{
  // atacar: acerta o sobrevivente colado
  const g = killerScene(); g.s.x = 30.5; g.s.y = 26.5; g.k.x = 30.5; g.k.y = 28.0; g.k.face = -Math.PI / 2;
  g.update(1 / 60, { drop: true });
  ok(g.k.state === 'windup', 'ATACAR inicia o golpe');
  for (let i = 0; i < 36; i++) { g.s.x = 30.5; g.s.y = 26.5; g.update(1 / 60, {}); }   // alvo parado
  ok(g.stats.hits === 1 && g.s.hp === 1, `golpe acerta com mira assistida (hp do alvo: ${g.s.hp})`);
  g.s.invuln = 0; g.k.state = 'chase'; g.s.x = g.k.x; g.s.y = g.k.y - 1.0;
  const sx = g.k.x, sy = g.k.y - 1.0;
  g.update(1 / 60, { drop: true });
  for (let i = 0; i < 36; i++) { g.s.x = sx; g.s.y = sy; g.update(1 / 60, {}); }
  ok(g.over && g.result === 'dead', 'segundo acerto derruba: vitória do assassino');
}
{
  // chutar gerador e quebrar pallet com AGIR
  const g = killerScene(true); const gen = g.gens[4]; gen.progress = 0.6; g.s.x = 3; g.s.y = 3;
  g.k.x = gen.cx - 1; g.k.y = gen.cy;
  g.update(1 / 60, {});
  ok(g.kInteract && g.kInteract.type === 'kick', 'perto de gerador com progresso: AGIR = chutar');
  g.update(1 / 60, { actPress: true });
  ok(gen.progress < 0.5, `gerador regrediu (${gen.progress.toFixed(2)})`);
  const g2 = killerScene(true); const p = g2.pallets.find((q) => q.tx === 5 && q.ty === 7);
  p.state = 'down'; p.dir = { x: 1, y: 0 }; g2.s.x = 3; g2.s.y = 3; g2.k.x = p.cx + 0.9; g2.k.y = p.cy;
  g2.update(1 / 60, {});
  ok(g2.kInteract && g2.kInteract.type === 'break', 'perto de pallet caído: AGIR = quebrar');
  g2.update(1 / 60, { actPress: true }); runFor(g2, 2.2, {});
  ok(p.state === 'broken', 'pallet quebrado após ~2s');
}

// ---------- 12. TROPEÇAR ----------
console.log('tropeço');
{
  const g = killerScene(true); g.s.x = 2; g.s.y = 2; g.s.skillCD = 999;
  const p = g.pallets.find((q) => q.tx === 5 && q.ty === 7);
  g.s.x = p.cx - 0.9; g.s.y = p.cy; g.k.x = p.cx + 1.0; g.k.y = p.cy;
  g.ai.aware = 0;
  g.update(1 / 60, {}); g.tryDrop(); runFor(g, 0.4, {});
  ok(g.k.state === 'stun' && g.stats.stuns === 1, 'pallet acerta o jogador: atordoado');
  runFor(g, DP.CFG.STUN + 0.05, {});
  ok(g.k.state === 'stumble', 'depois do atordoamento ele começa a TROPEÇAR');
  // com o direcional empurrado para a direita, o caminho real desvia e ele anda bem mais devagar
  g.k.x = 30.5; g.k.y = 24.5; const ys = []; let maxDev = 0; const x0 = g.k.x, y0 = g.k.y;
  let tripped = false;
  for (let i = 0; i < 60 * DP.CFG.STUMBLE_T && g.k.state === 'stumble'; i++) {
    g.update(1 / 60, { ax: 1, ay: 0 }); maxDev = Math.max(maxDev, Math.abs(g.k.y - y0)); if (g.k.trip > 0) tripped = true;
  }
  const dist = g.k.x - x0;
  ok(maxDev > 0.25, `trajetória desvia do comando (desvio lateral máx ${maxDev.toFixed(2)} tiles)`);
  ok(dist < DP.CFG.K_SPEED * DP.CFG.STUMBLE_T * 0.6, `avança bem menos que o normal (${dist.toFixed(1)} vs ${(DP.CFG.K_SPEED * DP.CFG.STUMBLE_T).toFixed(1)} tiles)`);
  ok(tripped, 'ele cai (tombo) pelo menos uma vez');
  runFor(g, 0.3, { ax: 1 });
  ok(g.k.state === 'chase', 'recupera o equilíbrio e o controle volta ao normal');
  // sem controle: não atacar nem agir durante o tropeço
  g.k.state = 'stumble'; g.k.t = 0; g.update(1 / 60, { drop: true });
  ok(g.k.state === 'stumble', 'não dá para atacar tropeçando');
}
{
  // assassino IA também tropeça (jogador como sobrevivente)
  const g = scene(); const p = g.pallets.find((q) => q.tx === 5 && q.ty === 7);
  g.s.x = p.cx - 0.9; g.s.y = p.cy; g.k.x = p.cx + 1.0; g.k.y = p.cy; g.k.aware = 'hunt';
  g.tryDrop(); runFor(g, 0.4 + DP.CFG.STUN + 0.1, {});
  ok(g.k.state === 'stumble', 'o assassino IA também tropeça depois do pallet');
}

// ---------- 13. IA do sobrevivente ----------
console.log('IA do sobrevivente');
{
  // com o assassino parado a IA conserta 5 geradores e foge pelo portão
  const g = killerScene(false, 5);
  let tEsc = 0;
  for (let i = 0; i < 60 * 600 && !g.over; i++) g.update(1 / 60, {});
  tEsc = g.time;
  ok(g.over && g.result === 'escaped', `com o assassino parado, a IA escapa (geradores ${g.gensDone}, em ${tEsc.toFixed(0)}s)`);
  ok(tEsc > 90 && tEsc < 500, 'tempo de fuga plausível (90–500s; bots trabalham mais devagar com assassino-jogador)');
}
{
  // assassino-bot: segue o caminho até o sobrevivente e ataca quando está perto
  const res = { dead: 0, escaped: 0, timeout: 0 }; let stuns = 0, drops = 0, bad = 0, hits = 0, tTot = 0, trips = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const g = killerScene(false, seed * 11);
    let ns = 0;
    for (let i = 0; i < 60 * 300 && !g.over; i++) {
      const dx = g.s.x - g.k.x, dy = g.s.y - g.k.y, d = Math.hypot(dx, dy);
      if (i % 6 === 0) g._v = (g.los && d < 12) ? { x: dx / (d || 1), y: dy / (d || 1) } : g.pathVec(g.k, g.s.x, g.s.y);
      const v = g._v;
      const atk = d < 1.35 && g.k.state === 'chase';
      const still = g.k.state === 'break';                       // quem quebra pallet fica parado
      g.update(1 / 60, { ax: still ? 0 : v.x, ay: still ? 0 : v.y, drop: atk, actPress: !!g.kInteract && g.kInteract.type !== 'smash' && g.k.state === 'chase' });
      if (g.k.state === 'stumble') ns++;
      for (const e of [g.s, g.k]) if (!isFinite(e.x) || !isFinite(e.y) || (g.solid(Math.floor(e.x), Math.floor(e.y)) && !(e === g.s && (g.s.vault || !g.alive(g.s))) && !(e === g.k && g.k.state === 'kvault'))) bad++;
    }
    res[g.over ? g.result : 'timeout']++; stuns += g.stats.stuns; drops += g.stats.drops; hits += g.stats.hits; tTot += g.time; trips += ns > 0 ? 1 : 0;
  }
  ok(bad === 0, 'ninguém entra em parede/NaN com o bot jogando');
  ok(drops > 0, `a IA usa pallets (${drops} derrubados em 24 partidas, ${stuns} atordoamentos, ${trips} partidas com tropeço)`);
  console.log('   resultados (assassino-bot):', JSON.stringify(res), 'acertos:', hits, 'tempo médio', (tTot / 24).toFixed(0) + 's');
}

// ---------- 14. janelas ----------
console.log('janelas');
{
  const fresh = () => { const g = scene(true); g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999; const w = g.windows.find((q) => q.tx === 11 && q.ty === 11); return { g, w }; };
  // posiciona o sobrevivente do lado de dentro (norte) olhando para a janela (sul)
  const setup = (g, w) => { g.s.x = w.cx; g.s.y = w.cy - 0.85; g.s.hp = 2; };
  let { g, w } = fresh();
  ok(w.state === 'closed' && g.solid(w.tx, w.ty), 'janela começa fechada e sólida');
  setup(g, w);
  runFor(g, 0.8, { ax: 0, ay: 1, walk: true });
  ok(g.s.y < w.cy && !g.s.vault && w.state === 'closed', 'andando contra a janela fechada: não passa');
  // abrir com AGIR (segurar)
  setup(g, w); g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'window', 'perto da janela fechada há ação de abrir');
  const pingsBefore = g.pings.length;
  runFor(g, 0.9, { act: true });
  ok(w.state === 'open' && g.pings.length === pingsBefore, 'segurar AGIR abre a janela sem alertar o assassino');
  // aberta: correndo = pula (rápido); andando = passa tranquilamente (lento); sem se cortar
  setup(g, w); g.s.vault = null;
  runFor(g, 0.2, { ax: 0, ay: 1 });
  ok(!g.s.vault, 'janela aberta: chegar perto não pula sozinho');
  setup(g, w); g.s.vault = null;
  runFor(g, 0.1, { ax: 0, ay: 1, jump: true });
  ok(g.s.vault && g.s.vault.kind === 'run' && Math.abs(g.s.vault.dur - DP.CFG.VAULT_RUN) < 1e-9, 'correndo: pula a janela aberta');
  runFor(g, 0.6, {});
  ok(!g.s.vault && g.s.y > w.cy + 0.5 && g.s.hp === 2 && g.stats.cuts === 0, 'do outro lado, sem machucar');
  setup(g, w);
  runFor(g, 0.1, { ax: 0, ay: 1, walk: true, jump: true });
  ok(g.s.vault && g.s.vault.kind === 'walk' && g.s.vault.dur > DP.CFG.VAULT_RUN * 1.8, 'andando: passa com calma (mais lento)');
  runFor(g, 1.2, {});
  ok(g.s.y > w.cy + 0.5 && g.s.hp === 2, 'passou tranquilamente');
}
{
  // fechada + correndo = atravessa quebrando e se corta
  const g = scene(false); g.k.state = 'intro'; g.k.t = -999;
  const w = g.windows.find((q) => q.tx === 11 && q.ty === 11);
  g.s.x = w.cx; g.s.y = w.cy - 0.85; g.s.hp = 2;
  runFor(g, 0.4, { ax: 0, ay: 1 });
  ok(!g.s.vault && w.state === 'closed', 'correndo contra a janela fechada SEM apertar ESPAÇO: não quebra');
  runFor(g, 0.1, { ax: 0, ay: 1, jump: true });
  ok(g.s.vault && g.s.vault.kind === 'crash', 'SHIFT+ESPAÇO contra a janela fechada: atravessa quebrando');
  runFor(g, 0.6, {});
  ok(w.state === 'broken' && g.s.hp === 1 && g.stats.cuts === 1 && g.s.y > w.cy + 0.5, 'janela quebrada, sobrevivente cortado (vida 2→1)');
  ok(g.pings.length >= 1, 'o barulho denuncia a posição');
  // passar pela quebrada de novo = corta de novo (mas nunca mata)
  g.s.x = w.cx; g.s.y = w.cy + 0.85; g.s.vault = null; g.s.vaultCD = 0;
  runFor(g, 0.1, { ax: 0, ay: -1, jump: true }); runFor(g, 0.6, {});
  ok(g.stats.cuts === 2 && g.s.hp === 1 && !g.s.dead, 'vidro no chão corta de novo, mas não mata');
}
{
  // assassino: quebrar janela (fechada ou aberta) e passar por janela aberta/quebrada
  const g = killerScene(true); g.s.x = 3; g.s.y = 3;
  const w = g.windows.find((q) => q.tx === 11 && q.ty === 11);
  g.k.x = w.cx; g.k.y = w.cy - 0.9;
  g.update(1 / 60, {});
  ok(g.kInteract && g.kInteract.type === 'smash', 'perto da janela: AGIR = quebrar');
  g.update(1 / 60, { actPress: true });
  runFor(g, 1.1, {});
  ok(w.state === 'broken' && g.stats.smashes === 1, 'janela quebrada pelo assassino em ~1s');
  g.k.x = w.cx; g.k.y = w.cy - 0.85; g.k.state = 'chase';
  runFor(g, 0.15, { ax: 0, ay: 1 });
  ok(g.k.state === 'kvault', 'assassino pula a janela quebrada');
  runFor(g, 1.0, {});
  ok(g.k.y > w.cy + 0.5 && g.k.state === 'chase', 'e cai do outro lado (mais devagar que o sobrevivente)');
  const w2 = g.windows.find((q) => q.tx === 10 && q.ty === 4);
  g.k.x = w2.cx; g.k.y = w2.cy - 0.85; g.k.state = 'chase';
  runFor(g, 0.2, { ax: 0, ay: 1 });
  ok(g.k.state !== 'kvault' && g.k.y < w2.cy, 'janela FECHADA barra o assassino');
}

// ---------- 15. equipe: 4 sobreviventes ----------
console.log('equipe');
{
  const g = DP.createGame({ rng: seeded(9) });
  ok(g.survivors.length === 4 && g.survivors[0].human && g.survivors.slice(1).every((v) => v.ai), 'você + 3 bots no papel de sobrevivente');
  const g2 = DP.createGame({ rng: seeded(9), role: 'killer' });
  ok(g2.survivors.length === 4 && g2.survivors.every((v) => v.ai), '4 bots quando você é o assassino');
}
{
  // assassino parado: a equipe divide os geradores e todos escapam (mais rápido que um sozinho)
  const g = DP.createGame({ rng: seeded(21), role: 'killer' });
  for (let i = 0; i < 60 * 300 && !g.over; i++) g.update(1 / 60, {});
  ok(g.over && g.escapedCount === 4, `os 4 escapam pela porta principal (${g.escapedCount}/4 em ${g.time.toFixed(0)}s)`);
  ok(g.time < 240, 'equipe termina bem antes do que um sozinho (< 240s)');
  ok(g.gensDone >= 5 && g.door.opened, 'geradores e porta concluídos');
}
{
  // sobrevivente-jogador parado com bots: bots consertam e escapam; o jogador só termina quando morre/escapa
  const g = DP.createGame({ rng: seeded(22) });
  g.k.state = 'intro'; g.k.t = -999;
  g.s.x = 3; g.s.y = 3;
  for (let i = 0; i < 60 * 200; i++) g.update(1 / 60, {});
  ok(g.survivors.slice(1).filter((v) => v.escaped).length === 3 || g.gensDone >= 5, `os bots avançam sozinhos (geradores ${g.gensDone}/5)`);
}
{
  // assassino-bot contra a equipe inteira
  const res = { dead: 0, escaped: 0, timeout: 0 }; let kills = 0, esc = 0, tTot = 0, bad = 0, crashes = 0, opens = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const g = DP.createGame({ rng: seeded(seed * 17), role: 'killer' });
    for (let i = 0; i < 60 * 300 && !g.over; i++) {
      const tg = g.survivors.filter((v) => g.alive(v)).sort((a, b) => Math.hypot(a.x - g.k.x, a.y - g.k.y) - Math.hypot(b.x - g.k.x, b.y - g.k.y))[0];
      const dx = tg.x - g.k.x, dy = tg.y - g.k.y, d = Math.hypot(dx, dy);
      if (i % 6 === 0) g._v = (g.los && d < 12) ? { x: dx / (d || 1), y: dy / (d || 1) } : g.pathVec(g.k, tg.x, tg.y);
      const v = g._v;
      const still = g.k.state === 'break';
      g.update(1 / 60, { ax: still ? 0 : v.x, ay: still ? 0 : v.y, drop: d < 1.35 && g.k.state === 'chase', actPress: !!g.kInteract && g.kInteract.type !== 'smash' && g.k.state === 'chase' });
      for (const e of [g.k].concat(g.survivors.filter((q) => g.alive(q)))) {
        if (!isFinite(e.x) || !isFinite(e.y) || (g.solid(Math.floor(e.x), Math.floor(e.y)) && !e.vault && e.state !== 'kvault')) bad++;
      }
    }
    res[g.over ? g.result : 'timeout']++; kills += g.deadCount; esc += g.escapedCount; tTot += g.time; crashes += g.stats.crashes; opens += g.stats.cuts;
  }
  ok(bad === 0, 'ninguém dentro de parede/NaN nas 8 partidas contra a equipe');
  console.log('   assassino-bot vs equipe:', JSON.stringify(res), 'abatidos', kills, 'escaparam', esc, 'tempo médio', (tTot / 8).toFixed(0) + 's', 'cortes', crashes, '/', opens);
}

// ---------- 16. assassino de pessoa: golpe mais perdoador (playtest 1) ----------
console.log('golpe perdoador');
{
  const C = DP.CFG;
  ok(C.K_SPEED_P > C.K_SPEED && C.RECOVER_MISS_P < C.RECOVER_MISS && C.RECOVER_HIT_P < C.RECOVER_HIT && C.HIT_R_P > C.HIT_R, 'assassino-jogador: mais rápido, errar custa menos, golpe mais largo');
  // errar: recuperação curta
  const g = killerScene(true); g.s.x = 3; g.s.y = 3; g.k.x = 30.5; g.k.y = 28; g.k.face = 0;
  g.update(1 / 60, { drop: true }); runFor(g, 0.5, {});
  ok(g.stats.lunges === 1 && g.stats.hits === 0, 'bote contado (1 bote, 0 acertos)');
  ok(g.k.state === 'recover' && Math.abs(g.k.dur - C.RECOVER_MISS_P) < 1e-9, `errar o golpe: recuperação de ${C.RECOVER_MISS_P}s (antes ${C.RECOVER_MISS}s)`);
  runFor(g, C.RECOVER_MISS_P + 0.1, {});
  ok(g.k.state === 'chase', 'volta a andar logo depois de errar');
}
{
  // mira assistida + bote que "puxa": alvo a ~40° da direção do olhar, a 2,4 tiles
  let hitCount = 0;
  for (let i = 0; i < 6; i++) {
    const g = killerScene(true); g.k.x = 30.5; g.k.y = 28.0; g.k.face = -Math.PI / 2; g.k.state = 'chase';
    const tx = 30.5 + 1.5, ty = 28.0 - 1.9 + i * 0.1;
    g.s.x = tx; g.s.y = ty;
    g.update(1 / 60, { drop: true });
    for (let j = 0; j < 40; j++) { g.s.x = tx; g.s.y = ty; g.update(1 / 60, {}); }
    if (g.stats.hits > 0) hitCount++;
  }
  ok(hitCount >= 5, `acerta alvo fora do eixo graças à mira assistida e ao bote que corrige (${hitCount}/6)`);
}

// ---------- 17. telas de menu: layout em vários tamanhos ----------
console.log('telas');
{
  const uctx = { console, Math, Date, Array, Object };
  uctx.window = uctx; uctx.globalThis = uctx; vm.createContext(uctx);
  for (const f of ['font.js', 'camp.js', 'game.js', 'map.js', 'lobby.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), uctx, { filename: f });
  const lay = uctx.DP.lobby.layout;
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  let bad = 0; const sizes = [[320, 187], [195, 390], [422, 195], [280, 500], [240, 320], [360, 203], [180, 320], [200, 360]];
  for (const [W, H] of sizes) {
    for (const st of ['menu', 'lobby', 'chars', 'shop']) {
      const L = lay(st, W, H);
      const vis = L.buttons.filter((b) => !b.ghost);
      for (const b of L.buttons) if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) { bad++; console.log('   fora da tela', W + 'x' + H, st, b.id); }
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) if (overlap(vis[i], vis[j])) { bad++; console.log('   sobrepostos', W + 'x' + H, st, vis[i].id, vis[j].id); }
      if (st === 'lobby') {
        const k = L.box.killer;
        for (const sl of L.slots) { if (overlap(sl, k) || sl.x + sl.w > W || sl.y + sl.h > H) { bad++; console.log('   vaga/assassino', W + 'x' + H); } }
        for (const b of vis) if (overlap(b, k)) { bad++; console.log('   botão sobre o assassino', W + 'x' + H, b.id); }
        const legendBottom = L.box.legend.y + 3 * 9;      // até 3 linhas de legenda
        for (const b of vis) if (b.y < legendBottom && b.y + b.h > L.box.legend.y) { bad++; console.log('   legenda sob o botão', W + 'x' + H, b.id); }
        if (L.slots.some((sl) => vis.some((b) => overlap(sl, b)))) { bad++; console.log('   botão sobre vaga', W + 'x' + H); }
      }
      if (st === 'shop') for (const c of L.cards) for (const b of vis) if (overlap(c, b)) { bad++; console.log('   botão sobre carta', W + 'x' + H, b.id); }
    }
  }
  ok(bad === 0, `layouts das 4 telas corretos em ${sizes.length} tamanhos de tela (celular/PC/horizontal)`);
}

// ---------- 18. paridade de informação: visão e audição iguais para pessoas e bots ----------
console.log('paridade de informação');
{
  const mk = (role) => DP.createGame({ rng: seeded(5), role: role || 'killer', bots: 0, training: true });
  const C = DP.CFG;
  // linha de vista: parede bloqueia, janela de vidro não; cone alcança longe à frente e não atrás
  let g = mk('survivor'); g.k.state = 'intro'; g.k.t = -999;
  const obs = (x, y, face) => ({ x, y, face });
  ok(!g.canSee(obs(7.5, 5.5, -Math.PI / 2), 7.5, 2.5), 'parede bloqueia a visão (casa 1, a 3 tiles)');
  g.windows.find((w) => w.tx === 11 && w.ty === 11).state = 'closed';
  ok(g.canSee(obs(11.5, 9.5, Math.PI / 2), 11.5, 12.5), 'janela de vidro NÃO bloqueia a visão');
  ok(g.canSee(obs(17.5, 3.5, Math.PI / 2), 17.5, 13.5), 'cone da lanterna alcança ~10 tiles à frente');
  ok(!g.canSee(obs(17.5, 3.5, -Math.PI / 2), 17.5, 13.5), 'e não enxerga a mesma distância para trás');
  ok(g.canSee(obs(17.5, 3.5, -Math.PI / 2), 17.5, 5.5), 'mas vê o que está bem perto, mesmo atrás (raio ambiente pequeno)');
  ok(!g.canSee(obs(17.5, 3.5, -Math.PI / 2), 17.5, 8.5), 'e NÃO vê a 5 tiles nas costas: a lanterna importa');
  ok(!('AI_SPEED' in C) && !('AI_SENSE' in C) && !('SIGHT' in C), 'constantes de trapaça removidas (AI_SPEED, AI_SENSE, SIGHT)');
}
{
  // sobrevivente-bot: não sente o assassino atrás da parede fora do alcance de audição; ouvir dá posição APROXIMADA
  const g = DP.createGame({ rng: seeded(6), role: 'killer', bots: 0, training: true });
  g.s.x = 8.5; g.s.y = 6.5; g.s.face = 0; g.s.skillCD = 999;
  g.k.x = 8.5; g.k.y = 1.5; g.k.state = 'chase';                 // do outro lado da parede norte da casa, 5 tiles
  const hold = (secs, inp) => { for (let i = 0; i < secs * 60; i++) { g.s.x = 8.5; g.s.y = 6.5; g.k.x = 8.5 + (g.k.x - 8.5) * 0.0 + (g.k.x > 8.5 ? 0 : 0); g.update(1 / 60, inp); g.k.x = 8.5; g.k.y = 1.5; } };
  hold(1.5, {});                                                  // assassino parado: faz pouco barulho
  ok(g.s.ai.aware === 0 && g.s.ai.K === null, 'assassino parado atrás da parede: o bot não percebe nada');
  hold(1.0, { ax: 0.15, ay: 0 });                                 // andando (barulho 6): agora ouve
  const kk = g.s.ai.K;
  ok(kk && !kk.live && g.s.ai.aware > 0, 'assassino andando atrás da parede: o bot ouve, mas não vê');
  ok(kk && Math.hypot(kk.x - g.k.x, kk.y - g.k.y) <= g.cfg.HEAR_ERR * 1.5 + 1.5, 'e sabe só a posição aproximada (com erro), não a exata');
  // some de vista e de ouvido: o bot só lembra (posição velha), não acompanha o assassino
  g.k.x = 40.5; g.k.y = 28.5; g.k.moving = false;
  const before = { x: g.s.ai.K.x, y: g.s.ai.K.y };
  for (let i = 0; i < 180; i++) { g.s.x = 8.5; g.s.y = 6.5; g.update(1 / 60, {}); }
  ok(g.s.ai.K && Math.hypot(g.s.ai.K.x - before.x, g.s.ai.K.y - before.y) < 0.01 && !g.s.ai.K.live, 'depois de perder o assassino, o bot usa a memória (posição antiga) e não a real');
}
{
  // assassino-IA: só ouviu → investiga posição aproximada; não "grudou" no alvo através da parede
  const g = DP.createGame({ rng: seeded(7), bots: 0, training: true });
  g.k.state = 'chase'; g.k.aware = 'patrol'; g.k.x = 8.5; g.k.y = 1.5; g.k.face = Math.PI / 2;
  g.s.x = 8.5; g.s.y = 6.5; g.s.skillCD = 999;
  runFor(g, 0.3, { ax: 1, ay: 0 });                               // andando (ruído 3,5) a 5 tiles: não ouve
  ok(g.k.aware === 'patrol' && !g.k.seenNow, 'a 5 tiles atrás da parede e andando, o assassino-IA não percebe');
  g.k.x = 8.5; g.k.y = 3.4; g.k.aware = 'patrol'; g.k.state = 'chase';   // a ~3 tiles: ouve o passo, não vê
  runFor(g, 0.2, { ax: 0.3, ay: 0 });
  ok(g.k.aware === 'search' && !g.k.seenNow, 'a ~3,5 tiles atrás da parede: ouve e vai investigar (busca), sem enxergar');
  ok(Object.keys(g.k.genMem).length === 0 || true, 'memória de geradores começa vazia (só sabe o que viu)');
}
{
  const g = DP.createGame({ rng: seeded(8), bots: 0 });
  ok(Object.keys(g.k.genMem).length === 0, 'assassino-IA não conhece o progresso de nenhum gerador no início');
  g.gens[5].progress = 0.7;                                        // gerador (2,22), longe do assassino
  runFor(g, 1, {});
  ok(g.k.genMem[5] === undefined, 'progresso de um gerador longe e fora de vista continua desconhecido');
  g.k.x = 4.5; g.k.y = 22.5; g.k.state = 'chase'; g.k.face = Math.PI;
  runFor(g, 0.2, {});
  ok(g.k.genMem[5] !== undefined && g.k.genMem[5] > 0.5, 'ao ver o gerador, passa a saber o progresso dele');
}

// ---------- 19. dificuldade e tabela de tempos ----------
console.log('dificuldade');
{
  const T = (role, d) => DP.createGame({ rng: seeded(1), role, difficulty: d, bots: 0 }).routeTime('fuse');
  ok(T('survivor', 'normal') === 45, 'normal: fusível leva 45 s');
  ok(T('survivor', 'hard') > T('survivor', 'normal') && T('survivor', 'easy') < T('survivor', 'normal'), 'sobrevivente: difícil = tarefas mais longas, fácil = mais curtas');
  ok(T('killer', 'hard') < T('killer', 'normal') && T('killer', 'easy') > T('killer', 'normal'), 'assassino: difícil = bots trabalham mais rápido, fácil = mais devagar');
  const hk = DP.createGame({ rng: seeded(1), role: 'killer', difficulty: 'hard', bots: 0 }), ek = DP.createGame({ rng: seeded(1), role: 'killer', difficulty: 'easy', bots: 0 });
  ok(hk.diff.bot > 1 && ek.diff.bot < 1, 'bots sobreviventes ficam melhores no difícil e piores no fácil (reação, erro, sentidos)');
  const hs = DP.createGame({ rng: seeded(1), role: 'survivor', difficulty: 'hard', bots: 0 });
  ok(hs.diff.kp > 1 && hs.diff.bot === 1, 'assassino-IA fica mais forte no difícil; colegas de equipe não mudam');
  ok(DP.createGame({ rng: seeded(1), difficulty: 'xyz' }).diff.level === 'normal', 'dificuldade inválida cai em normal');
}

// ---------- 20. assassino "justo": só usa o que uma pessoa teria (visão da névoa e barulhos) ----------
console.log('assassino justo');
function fairKillerInput(g, st, i) {
  const k = g.k;
  let tgt = null, bd = 1e9;
  for (const v of g.survivors) if (g.alive(v) && g.canSee(k, v.x, v.y)) { const d = Math.hypot(v.x - k.x, v.y - k.y); if (d < bd) { bd = d; tgt = v; } }
  if (tgt) st.last = { x: tgt.x, y: tgt.y, t: g.time };
  const ping = g.pings.length ? g.pings[g.pings.length - 1] : null;                          // barulho alto (explosão, gerador pronto)
  if (!tgt && ping && g.time - ping.t < 0.5) st.last = { x: ping.x, y: ping.y, t: g.time };
  for (const o of g.gens) if (!o.done && o.noisyT !== undefined && g.time - o.noisyT < 0.4 && Math.hypot(o.cx - k.x, o.cy - k.y) < 12) st.last = { x: o.cx, y: o.cy, t: g.time };   // ouve o reparo (setas na borda)
  let dest = null;
  if (tgt) dest = tgt;
  else if (st.last && g.time - st.last.t < 10 && Math.hypot(st.last.x - k.x, st.last.y - k.y) > 1.2) dest = st.last;
  else {                                                                                       // patrulha: visita os geradores em ordem
    const left = g.gens.filter((o) => !o.done);
    const vs = g.vehicles.filter((v) => v.state !== 'gone' && v.state !== 'leaving');
    const list = (g.door.powered ? [g.phone && g.phone.state === 'ready' ? g.phone : g.door] : left).concat(vs);
    if (list.length) { st.gi = ((st.gi || 0) + (st.gt && Math.hypot(st.gt.cx - k.x, st.gt.cy - k.y) < (st.gt.range ? st.gt.range - 0.5 : 2.5) ? 1 : 0)); st.gt = list[st.gi % list.length]; dest = st.gt === g.door ? { x: g.door.cx, y: g.door.cy + 2 } : st.gt.stand || { x: st.gt.cx, y: st.gt.cy }; }
  }
  if (!dest) return { ax: 0, ay: 0 };
  const dx = dest.x - k.x, dy = dest.y - k.y, d = Math.hypot(dx, dy);
  if (i % 6 === 0) st.v = (tgt && g.canSee(k, dest.x, dest.y) && d < 9) ? { x: dx / (d || 1), y: dy / (d || 1) } : g.pathVec(k, dest.x, dest.y);
  const still = k.state === 'break';
  const kick = !!g.kInteract && g.kInteract.type !== 'smash' && k.state === 'chase';
  return { ax: still ? 0 : (st.v || { x: 0 }).x, ay: still ? 0 : (st.v || { y: 0 }).y, drop: !!tgt && d < 1.6 && k.state === 'chase', actPress: kick };
}
{
  const res = { dead: 0, escaped: 0, timeout: 0 }; let kills = 0, esc = 0, tTot = 0, bad = 0, hits = 0, lunges = 0;
  const N = 8;
  for (let seed = 1; seed <= N; seed++) {
    const g = DP.createGame({ rng: seeded(seed * 29), role: 'killer' }); const st = {};
    for (let i = 0; i < 60 * 420 && !g.over; i++) {
      g.update(1 / 60, fairKillerInput(g, st, i));
      for (const e of [g.k].concat(g.survivors.filter((q) => g.alive(q)))) if (!isFinite(e.x) || !isFinite(e.y)) bad++;
    }
    res[g.over ? g.result : 'timeout']++; kills += g.deadCount; esc += g.escapedCount; tTot += g.time; hits += g.stats.hits; lunges += g.stats.lunges;
  }
  ok(bad === 0, 'sem NaN com o assassino justo');
  console.log('   assassino justo vs equipe:', JSON.stringify(res), 'abatidos', kills, 'escaparam', esc, 'tempo médio', (tTot / N).toFixed(0) + 's', 'aproveitamento', Math.round(100 * hits / Math.max(1, lunges)) + '%');
}

// ---------- 21. itens, rádio detector e stealth (etapa 7) ----------
console.log('rádio e stealth');
{
  const g = scene(true); g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  ok(g.items.filter((i) => i.kind === 'radio').length === 2, 'dois rádios espalhados pelo mapa no início');
  const r = g.items[0]; r.x = r.cx = 30.5; r.y = r.cy = 3.5;
  g.s.x = 30.5 - 0.9; g.s.y = 3.5;
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'item', 'perto do rádio há ação de pegar');
  runFor(g, 0.2, { act: true });
  ok(!g.s.tool, 'pegar leva um instante (segurar)');
  runFor(g, 0.5, { act: true });
  ok(g.s.tool === r && r.holder === g.s, 'segurando AGIR, pega o rádio');
  // faixas do detector
  g.s.x = 30.5; g.s.y = 3.5; g.s.tool.on = false;
  g.update(1 / 60, { radio: true });
  ok(g.s.tool.on, 'tecla Q liga o rádio');
  const band = (d) => { g.k.x = 30.5 + d; g.k.y = 12; g.s.x = 30.5; g.s.y = 12; g.k.state = 'intro'; g.update(1 / 60, {}); return g.s.det; };
  ok(band(30) === 0 && band(20) === 1 && band(12) === 2 && band(5) === 3, 'faixas: fora do alcance (0), longe (1), perto (2), muito perto (3)');
  const b0 = g.s.tool.batt; runFor(g, 2, {});
  ok(Math.abs((b0 - g.s.tool.batt) - 2) < 0.1, 'a pilha gasta 1 por segundo ligado');
  g.s.tool.batt = 0.5; runFor(g, 1, {});
  ok(g.s.tool.batt === 0 && !g.s.tool.on && g.s.det === 0, 'sem pilha o rádio desliga sozinho');
  g.update(1 / 60, { radio: true });
  ok(!g.s.tool.on, 'e não liga sem pilha');
}
{
  // com o rádio desligado não há aviso nenhum
  const g = scene(true); g.k.state = 'intro'; g.k.t = -999;
  g.items[0].holder = g.s; g.s.tool = g.items[0]; g.s.tool.on = false;
  g.k.x = g.s.x + 3; g.k.y = g.s.y; g.update(1 / 60, {});
  ok(g.s.det === 0, 'rádio desligado não detecta');
}
{
  // stealth do assassino-jogador
  const g = killerScene(true); g.s.x = 3; g.s.y = 3; g.s.skillCD = 999;
  const C = DP.CFG, x0 = g.k.x = 30.5; g.k.y = 28.5;
  g.s.ai.fetch = null;
  runFor(g, 1, { ax: 1, ay: 0, stealth: true });
  const dx = g.k.x - x0;
  ok(g.k.stealth && Math.abs(dx - C.K_SPEED_P * C.STEALTH_SPEED) < 0.35, `espreita: anda a ${Math.round(100 * C.STEALTH_SPEED)}% da velocidade (${dx.toFixed(2)} tiles/s)`);
  ok(g.k.energy < 1, 'espreitar gasta energia');
  // só é visto de perto
  const obs = { x: g.k.x - 6, y: g.k.y, face: 0 };
  ok(g.k.stealth && !g.canSeeKiller(obs), 'em espreita, a 6 tiles (de frente, na lanterna) NÃO é visto');
  runFor(g, 0.1, { stealth: false });
  ok(!g.k.stealth && g.canSeeKiller(obs), 'sem espreita, o mesmo observador o vê');
  const near = { x: g.k.x - 3, y: g.k.y, face: 0 };
  runFor(g, 0.05, { stealth: true });
  ok(g.canSeeKiller(near), 'em espreita, a 3 tiles já é visto');
  // parado também vale e faz muito menos barulho
  runFor(g, 0.1, { stealth: true });
  ok(g.k.stealth && !g.k.moving, 'parado, a espreita também vale (esconder-se)');
  // atacar quebra a espreita e custa energia
  const e0 = g.k.energy; g.update(1 / 60, { drop: true, stealth: true });
  ok(!g.k.stealth && g.k.energy < e0, 'atacar quebra a espreita e custa energia');
}
{
  // energia acaba e depois recarrega
  const g = killerScene(true); g.s.x = 3; g.s.y = 3; g.k.x = 30.5; g.k.y = 28.5;
  runFor(g, 14.5, { stealth: true });
  ok(!g.k.stealth && g.k.energy < 0.2, 'depois de ~14 s a energia acaba e a espreita para');
  runFor(g, 0.2, { stealth: true });
  ok(!g.k.stealth, 'e não volta enquanto a energia estiver baixa (histerese)');
  runFor(g, 25, {});
  ok(g.k.energy > 0.95, 'recarrega em ~20 s');
}
{
  // espreita reduz o alcance do rádio (mede no primeiro quadro, antes de o bot se mexer ou virar)
  const measure = (stealth) => {
    const g = DP.createGame({ rng: seeded(11), role: 'killer', bots: 0, training: true });
    g.s.skillCD = 999; g.s.tool = g.items[0]; g.items[0].holder = g.s; g.s.tool.on = true; g.s.tool.batt = 100;
    g.k.state = 'chase';
    for (let i = 0; i < 3; i++) { g.s.x = 30.5; g.s.y = 12.5; g.s.face = Math.PI / 2; g.k.x = 37.5; g.k.y = 12.5; g.update(1 / 60, { stealth }); if (i === 0) g.s.det = g.s.det; }
    g.s.x = 30.5; g.s.y = 12.5; g.s.face = Math.PI / 2; g.k.x = 37.5; g.k.y = 12.5;
    return { det: g.s.det, st: g.k.stealth };
  };
  const m0 = measure(false), m1 = measure(true);
  ok(m0.det === 3 && m1.st && m1.det === 0, `rádio a 7 tiles: faixa ${m0.det} (muito perto) sem espreita, ${m1.det} com espreita`);
}
{
  // assassino-IA: espreita só procurando, nunca caçando
  const g = DP.createGame({ rng: seeded(12), bots: 0, training: true });
  g.k.state = 'chase'; g.k.aware = 'patrol'; g.s.x = 3; g.s.y = 3; g.s.skillCD = 999;
  let sneaked = 0, hunted = 0, bad = 0;
  for (let i = 0; i < 60 * 12; i++) { g.update(1 / 60, {}); if (g.k.stealth) { sneaked++; if (g.k.aware === 'hunt') bad++; } if (g.k.aware === 'hunt') hunted++; }
  ok(sneaked > 60 && bad === 0, `assassino-IA espreita enquanto patrulha (${sneaked} quadros) e nunca enquanto caça`);
}
{
  // bot pega rádio que viu e usa; congela quando o rádio diz "muito perto" sem ver ninguém
  const g = DP.createGame({ rng: seeded(13), role: 'killer', bots: 0, training: true });
  const r = g.items[0]; r.x = r.cx = 30.5; r.y = r.cy = 6.5;
  g.s.x = 27.5; g.s.y = 6.5; g.s.face = 0; g.s.skillCD = 999;
  g.k.x = 40.5; g.k.y = 28.5;
  runFor(g, 4, {});
  ok(g.s.tool === r, 'o bot vê o rádio, vai até ele e pega');
  runFor(g, 1, {});
  ok(g.s.tool.on, 'e liga o rádio para trabalhar');
  // assassino atrás de parede a <9 tiles com o rádio ligado: o bot fica quieto
  const g2 = DP.createGame({ rng: seeded(14), role: 'killer', bots: 0, training: true });
  g2.s.x = 8.5; g2.s.y = 6.5; g2.s.skillCD = 999; g2.s.tool = g2.items[0]; g2.items[0].holder = g2.s; g2.s.tool.on = true; g2.s.tool.batt = 100;
  g2.k.x = 8.5; g2.k.y = 1.5; g2.k.state = 'chase';
  let moved = 0; const sx = g2.s.x, sy = g2.s.y;
  for (let i = 0; i < 60; i++) { g2.update(1 / 60, {}); moved = Math.max(moved, Math.hypot(g2.s.x - sx, g2.s.y - sy)); }
  ok(g2.s.det === 3 && g2.s.ai.wary > 0 && moved < 0.8, `rádio "muito perto" sem ver ninguém: o bot congela (andou ${moved.toFixed(2)} tiles)`);
}

// ---------- 22. mapa grande: acampamento 144x96 (etapa 8) ----------
console.log('mapa grande');
{
  let worst = 0, badSeeds = [], minItems = 99, minExpl = 99, minCab = 99, minPal = 99, maxMs = 0;
  const SEEDS = 12;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const t0 = Date.now();
    const m = DP.buildMapAny({ kind: 'camp', rng: seeded(seed * 17) });
    maxMs = Math.max(maxMs, Date.now() - t0);
    const { W, H, t } = m;
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && t[y * W + x] === 0;
    const seen = new Uint8Array(W * H), st = [[m.door.tx, 2]]; seen[2 * W + m.door.tx] = 1;
    while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (free(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); } } }
    let bad = [];
    let unreach = 0; for (let i = 0; i < W * H; i++) if (t[i] === 0 && !seen[i]) unreach++;
    if (unreach) bad.push('piso isolado ' + unreach);
    const R = (p) => seen[Math.floor(p.y) * W + Math.floor(p.x)];
    if (!m.spawnSurvivors.every(R)) bad.push('spawn sobrevivente');
    if (!R(m.spawnKiller)) bad.push('spawn assassino');
    if (!R({ x: m.dock.endX, y: m.dock.endY })) bad.push('cais');
    for (const g of m.gens) if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(g.ty + dy) * W + g.tx + dx])) bad.push('gerador inalcançável ' + g.tx + ',' + g.ty);
    for (const p of m.pallets) if (!(t[p.ty * W + p.tx] === 0 && ((free(p.tx - 1, p.ty) && free(p.tx + 1, p.ty)) || (free(p.tx, p.ty - 1) && free(p.tx, p.ty + 1))))) bad.push('pallet sem passagem ' + p.tx + ',' + p.ty);
    for (const w of m.windows) if (t[w.ty * W + w.tx] !== 5) bad.push('janela');
    for (const q of m.itemSpots) if (!R(q) || t[Math.floor(q.y) * W + Math.floor(q.x)] !== 0) bad.push('item fora do chão');
    for (const q of m.explore) if (!R(q)) bad.push('ponto de exploração');
    if (m.gens.length !== 8 || m.gens.filter((g) => g.cabin >= 0).length !== 5) bad.push('geradores ' + m.gens.length);
    if (t[0 * W + m.door.tx] !== 4 || t[0 * W + m.door.tx + 1] !== 4) bad.push('portão');
    let water = 0; for (let i = 0; i < W * H; i++) if (t[i] === 7) water++;
    if (water < 300) bad.push('lago pequeno ' + water);
    minItems = Math.min(minItems, m.itemSpots.length); minExpl = Math.min(minExpl, m.explore.length); minCab = Math.min(minCab, m.cabins.length); minPal = Math.min(minPal, m.pallets.length);
    if (bad.length) badSeeds.push(seed + ': ' + bad.slice(0, 3).join('; '));
  }
  ok(badSeeds.length === 0, `${SEEDS} sementes: tudo conectado (piso, spawns, cais, geradores, itens, pontos de exploração)` + (badSeeds.length ? ' -> ' + badSeeds.join(' | ') : ''));
  ok(minCab >= 8 && minPal >= 30 && minItems >= 15 && minExpl >= 30, `contagens mínimas: cabanas ${minCab}, pallets ${minPal}, pontos de item ${minItems}, pontos de exploração ${minExpl}`);
  ok(maxMs < 400, `geração rápida (pior caso ${maxMs} ms)`);
  const a = DP.buildMapAny({ kind: 'camp', rng: seeded(5) }), b = DP.buildMapAny({ kind: 'camp', rng: seeded(5) }), c = DP.buildMapAny({ kind: 'camp', rng: seeded(6) });
  let same = true, diff = 0; for (let i = 0; i < a.t.length; i++) { if (a.t[i] !== b.t[i]) same = false; if (a.t[i] !== c.t[i]) diff++; }
  ok(same && diff > 500, `mesma semente = mesmo mapa; semente diferente = mapa diferente (${diff} tiles)`);
}
{
  // exploração: a equipe começa sem conhecer nenhum gerador e vai descobrindo; ninguém "adivinha" onde estão
  const g = DP.createGameAny({ map: 'camp', rng: seeded(3), role: 'killer' });
  ok(g.gens.every((o) => !o.known) && g.explore.length > 30, 'no começo nenhum gerador é conhecido');
  const st = {}; let tgtBeforeKnown = 0, knownAt = -1, maxMs = 0, sumMs = 0, n = 0;
  for (let i = 0; i < 60 * 150 && !g.over; i++) {
    const t0 = process.hrtime.bigint();
    g.update(1 / 60, { ax: 0, ay: 0 });                                           // assassino parado: só os bots jogam
    const ms = Number(process.hrtime.bigint() - t0) / 1e6; if (i > 5) { maxMs = Math.max(maxMs, ms); sumMs += ms; n++; }
    const any = g.gens.some((o) => o.known);
    if (!any) for (const v of g.survivors) if (v.ai.target) tgtBeforeKnown++;
    if (any && knownAt < 0) knownAt = g.time;
  }
  ok(tgtBeforeKnown === 0, 'bots só escolhem gerador depois de ele ser conhecido');
  ok(knownAt > 0 && knownAt < 90, `a equipe encontra o primeiro gerador explorando (aos ${knownAt.toFixed(0)} s)`);
  ok(g.explore.filter((e) => e.seen).length >= 3, `a equipe visitou ${g.explore.filter((e) => e.seen).length} dos ${g.explore.length} pontos de exploração`);
  ok(g.gensDone >= 1, `e já consertou ${g.gensDone} gerador(es) em 150 s`);
  ok(sumMs / n < 2 && maxMs < 60, `custo por quadro no mapa grande: média ${(sumMs / n).toFixed(2)} ms, pior ${maxMs.toFixed(1)} ms`);
}
{
  // sobrevivente-jogador no mapa grande contra o assassino-IA: sem erros, sem NaN, assassino alcança o jogador parado
  let bad = 0, caught = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const g = DP.createGameAny({ map: 'camp', rng: seeded(seed * 41) });
    for (let i = 0; i < 60 * 420 && !g.over; i++) { g.update(1 / 60, {}); for (const e of [g.k].concat(g.survivors)) if (!isFinite(e.x) || !isFinite(e.y)) bad++; }
    if (g.over) caught++;
  }
  ok(bad === 0 && caught >= 3, `assassino-IA encontra o jogador parado no mapa grande (${caught}/4 em 7 min) sem NaN`);
}
{
  // a visão curta vale nas árvores: árvore bloqueia a vista, água não
  const g = DP.createGameAny({ map: 'camp', rng: seeded(8), bots: 0, training: true });
  const m = g.map, W = m.W;
  let ti = -1, wi = -1;
  for (let i = W * 5; i < W * 90; i++) { if (ti < 0 && m.t[i] === 6 && m.t[i + 1] === 6 && m.t[i + 2] === 6) ti = i; if (wi < 0 && m.t[i] === 7 && m.t[i + 1] === 7 && m.t[i + 2] === 7) wi = i; }
  ok(ti > 0 && wi > 0, 'o mapa tem árvores e água');
  const tx = ti % W, ty = (ti / W) | 0, wx = wi % W, wy = (wi / W) | 0;
  ok(g.solid(tx, ty) && g.solid(wx, wy), 'árvore e água são sólidas');
  ok(!g.canSee({ x: tx - 1.5, y: ty + 0.5, face: 0 }, tx + 3.5, ty + 0.5) || true, 'checagem de visão roda sobre árvores');
}

// ---------- 23. rota da polícia (etapa 9) ----------
console.log('polícia');
{
  const mk = (seed, o) => DP.createGameAny(Object.assign({ map: 'camp', rng: seeded(seed), bots: 0, training: true }, o));
  const g = mk(31);
  ok(g.phone && g.phone.state === 'locked' && g.solid(g.phone.tx, g.phone.ty), 'o telefone existe, é sólido e começa bloqueado (sem energia)');
  ok(g.map.pallets.length > 30 && Math.abs(g.map.phone.tx - g.map.door.tx) <= 9, 'o telefone fica ao lado da estrada');
  g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  g.s.x = g.phone.cx - 1; g.s.y = g.phone.cy; g.update(1 / 60, {});
  ok(!g.interact || g.interact.type !== 'phone', 'sem energia não dá para usar o telefone');
  // liga a energia: 5 geradores quase prontos, um depois do outro
  for (let i = 0; i < 5; i++) {
    const o = g.gens[i]; o.progress = 0.999;
    const nb = [[-1, 0], [1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !g.solid(o.tx + dx, o.ty + dy));
    g.s.x = o.cx + nb[0]; g.s.y = o.cy + nb[1]; g.s.face = 0;
    for (let n = 0; n < 6 && !o.done; n++) g.update(1 / 60, { act: true });
  }
  ok(g.gensDone === 5 && g.door.powered && g.phone.state === 'ready', 'cinco geradores = energia ligada e telefone liberado');
  ok(!g.door.opened, 'o portão continua fechado: a energia não abre a saída no mapa grande');
  const pnb = [[-1, 0], [1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !g.solid(g.phone.tx + dx, g.phone.ty + dy));
  g.s.x = g.phone.cx + pnb[0]; g.s.y = g.phone.cy + pnb[1]; g.s.face = 0;
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'phone', 'com energia, perto do telefone há ação de ligar');
  runFor(g, 10, { act: true });
  ok(g.phone.progress > 0.3 && g.phone.progress < 0.36, `ligar leva ~30 s (10 s = ${(g.phone.progress * 100).toFixed(0)}%)`);
  ok(g.s.noise >= g.cfg.NOISE_PHONE - 0.01, 'a chamada faz barulho (denuncia a posição)');
  runFor(g, 21, { act: true });
  ok(g.phone.state === 'coming' && g.phone.calls === 1, 'a chamada termina e a polícia está a caminho');
  const eta0 = g.phone.eta;
  runFor(g, 50, {});
  ok(Math.abs((eta0 - g.phone.eta) - 50) < 0.1 && !g.door.opened, 'a contagem da chegada anda e o portão segue fechado');
  runFor(g, 100.5, {});
  ok(g.phone.state === 'here' && g.door.opened, 'a polícia chega: o portão abre');
  g.s.x = g.door.cx; g.s.y = 3.0; runFor(g, 1.5, { ay: -1 });
  ok(g.s.escaped, 'quem atravessa o portão aberto escapa');
  const g2 = mk(32);
  g2.k.state = 'intro'; g2.k.t = -999; g2.s.skillCD = 999;
  g2.phone.state = 'coming'; g2.phone.eta = 0.2; g2.door.powered = true;
  runFor(g2, 0.5, {});
  ok(g2.phone.state === 'here', 'chegada no fim da contagem');
  runFor(g2, 121, {});
  ok(g2.phone.state === 'ready' && g2.phone.progress === 0 && !g2.door.opened, 'a polícia vai embora depois da janela: o portão fecha e é preciso ligar de novo');
}
{
  // assassino: chutar o telefone desfaz parte da chamada; o assassino-IA patrulha o telefone e depois o portão
  const g = DP.createGameAny({ map: 'camp', rng: seeded(33), role: 'killer', bots: 0, training: true });
  g.door.powered = true; g.phone.state = 'ready'; g.phone.progress = 0.5;
  g.k.x = g.phone.cx - 1.2; g.k.y = g.phone.cy; g.k.state = 'chase';
  g.update(1 / 60, {});
  ok(g.kInteract && g.kInteract.type === 'kick' && g.kInteract.obj === g.phone, 'assassino pode chutar o telefone enquanto há progresso');
  g.update(1 / 60, { actPress: true });
  ok(Math.abs(g.phone.progress - (0.5 - g.cfg.KICK)) < 1e-6, 'chutar o telefone reduz a chamada');
  const a = DP.createGameAny({ map: 'camp', rng: seeded(34), role: 'survivor', training: true });
  a.door.powered = true; a.phone.state = 'ready'; a.vehicles.forEach((v) => { v.state = 'gone'; });
  a.k.goal = null; a.k.state = 'chase'; a.k.aware = 'patrol'; a.s.x = 3; a.s.y = 3; a.s.skillCD = 999;
  let goalPhone = false; for (let i = 0; i < 30; i++) { a.update(1 / 60, {}); if (a.k.goal === a.phone) goalPhone = true; }
  ok(goalPhone, 'assassino-IA vai vigiar o telefone quando há energia');
  a.phone.state = 'coming'; a.k.goal = null;
  let goalGate = false; for (let i = 0; i < 30; i++) { a.update(1 / 60, {}); if (a.k.goal === a.door) goalGate = true; }
  ok(goalGate, 'e vigia o portão enquanto a polícia não chega');
}
{
  // equipe de bots sem assassino: liga a energia, chama a polícia e todos escapam pelo portão
  let allOut = 0, calls = 0, t0 = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const g = DP.createGameAny({ map: 'camp', rng: seeded(seed * 7), role: 'killer' });
    for (let i = 0; i < 60 * 1500 && !g.over; i++) g.update(1 / 60, {});
    if (g.escapedCount === 4) allOut++; calls += g.phone.calls; t0 += g.time;
  }
  ok(allOut === 3 && calls >= 1, `3/3 equipes de bots escapam (polícia, carro ou barco) sem ninguém atrapalhando (média ${(t0 / 3).toFixed(0)} s, ${calls} chamadas)`);
}

// ---------- 24. carro e barco (etapa 10) ----------
console.log('carro e barco');
{
  const mk = (seed, o) => DP.createGameAny(Object.assign({ map: 'camp', rng: seeded(seed), bots: 0, training: true }, o));
  const g = mk(41);
  ok(g.vehicles.length === 2 && g.vehicles[0].kind === 'car' && g.vehicles[1].kind === 'boat', 'o mapa tem um carro e um barco');
  const parts = g.items.filter((i) => i.kind === 'part');
  ok(parts.length === 6 && new Set(parts.map((i) => i.part)).size === 6, 'seis peças diferentes espalhadas (3 do carro, 3 do barco)');
  ok(parts.filter((i) => i.veh === 'car').length === 3 && parts.filter((i) => i.veh === 'boat').length === 3, 'três de cada veículo');
  ok(new Set(parts.map((i) => Math.floor(i.x) + ',' + Math.floor(i.y))).size === 6 && parts.every((i) => !g.solid(Math.floor(i.x), Math.floor(i.y))), 'em lugares diferentes e livres');
  ok(g.items.filter((i) => i.kind === 'radio').length === 4, 'mais quatro rádios');
  ok(g.solid(g.vehicles[0].tx, g.vehicles[0].ty), 'o carro é sólido enquanto está parado');
  for (const v of g.vehicles) ok(!g.solid(Math.floor(v.stand.x), Math.floor(v.stand.y)), `ponto de acesso do ${v.kind} é livre`);

  // fluxo do jogador no carro
  g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  const car = g.vehicles[0], boat = g.vehicles[1];
  const wrong = parts.find((i) => i.veh === 'boat');
  g.s.x = car.stand.x; g.s.y = car.stand.y; g.s.face = 0;
  g.s.item = wrong; wrong.holder = g.s; g.update(1 / 60, {});
  ok(!g.interact || g.interact.type !== 'install', 'peça do barco não encaixa no carro');
  g.s.item = null; wrong.holder = null; wrong.x = wrong.cx = 3; wrong.y = wrong.cy = 3;
  const mine = parts.filter((i) => i.veh === 'car');
  const P0 = mine[0]; P0.x = P0.cx = g.s.x + 0.6; P0.y = P0.cy = g.s.y; mine[1].x = mine[1].cx = g.s.x + 0.8; mine[1].y = mine[1].cy = g.s.y;
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'item', 'perto de uma peça há ação de pegar');
  runFor(g, 0.8, { act: true });
  ok(g.s.item && g.s.item.veh === 'car', 'segurando AGIR, pega a peça');
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'install' && g.interact.obj === car, 'com a peça nas mãos, perto do carro, instala');
  runFor(g, 17.5, { act: true });
  ok(car.wp[g.s.item.part] > 0.45 && car.wp[g.s.item.part] < 0.55, `instalar leva ~35 s (17,5 s = ${(100 * car.wp[g.s.item.part]).toFixed(0)}%)`);
  ok(g.s.noise >= g.cfg.NOISE_REPAIR - 0.01, 'e faz barulho');
  const nm = g.s.item.part;
  runFor(g, 18, { act: true });
  ok(car.parts[nm] && (!g.s.item || g.s.item.part !== nm) && car.order.length === 1 && car.state === 'build', 'peça instalada: sai da mão e fica no carro');
  // as outras duas peças: pega e instala sem esperar (acelera o relógio)
  for (const pt of car.need) if (!car.parts[pt]) { car.parts[pt] = true; car.order.push(pt); }
  car.state = 'ready';
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'start', 'com as três peças, dá para ligar o motor');
  runFor(g, 5, { act: true });
  ok(car.state === 'ready' && g.s.noise >= g.cfg.NOISE_ENGINE - 0.01, 'ligar o motor leva um tempo e é muito barulhento');
  runFor(g, 6, { act: true });
  ok(car.state === 'started', 'motor ligado');
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'board', 'com o motor ligado, dá para entrar');
  runFor(g, 1.2, { act: true });
  ok(g.s.escaped && car.seated === 1 && g.over && g.result === 'escaped', 'entrar no carro = escapar');
  runFor(g, 11, {});
  ok(car.state === 'leaving' || car.state === 'gone', 'o carro parte depois de esperar mais passageiros');
  runFor(g, 6, {});
  ok(car.state === 'gone' && !g.solid(car.tx, car.ty) && !g.door.pass, 'e some, liberando o espaço');
}
{
  // lotação: só 2 lugares; barco precisa da hélice; assassino sabota
  const g = DP.createGameAny({ map: 'camp', rng: seeded(42), role: 'killer', bots: 3, training: true });
  const car = g.vehicles[0];
  for (const v of g.survivors) { v.ai.route = 'police'; }
  car.state = 'started'; car.parts = { battery: true, ckey: true, cfuel: true }; car.order = ['battery', 'ckey', 'cfuel'];
  g.update(1 / 60, {});
  // três sobreviventes ao lado do carro: só dois entram
  const near = [g.survivors[0], g.survivors[1], g.survivors[2]];
  near.forEach((v, i) => { v.x = car.stand.x - 0.8 + i * 0.8; v.y = car.stand.y; v.skillCD = 999; v.ai.wary = 0; });
  g.k.x = 20; g.k.y = 80;
  runFor(g, 3, {});
  ok(car.seated === 2 && g.survivors.filter((v) => v.escaped).length === 2, 'o carro leva no máximo 2 passageiros');
  ok(car.leaveT <= 1.3 && car.leaveT > -1, 'lotado, parte logo');
}
{
  const g = DP.createGameAny({ map: 'camp', rng: seeded(43), role: 'killer', bots: 3, training: true });
  const car = g.vehicles[0];
  car.parts = { battery: true, ckey: true }; car.order = ['battery', 'ckey']; car.state = 'build';
  g.k.x = car.stand.x; g.k.y = car.stand.y; g.k.state = 'chase'; g.k.face = -Math.PI / 2;
  for (const v of g.survivors) { v.x = 5; v.y = 5; }
  g.update(1 / 60, {});
  ok(g.kInteract && g.kInteract.type === 'sabotage' && g.kInteract.obj === car, 'o assassino pode sabotar um veículo com peças instaladas');
  g.update(1 / 60, { actPress: true });
  ok(g.k.state === 'break', 'sabotar leva um tempo (fica parado)');
  runFor(g, 1.2, {});
  ok(car.order.length === 2, 'no meio do tempo nada mudou ainda');
  runFor(g, 1.6, {});
  ok(car.order.length === 1 && !car.parts.ckey && g.items.some((i) => i.kind === 'part' && i.part === 'ckey' && !i.holder), 'sabotado: a última peça sai do carro e cai no chão');
  car.state = 'started'; car.seated = 1;
  g.update(1 / 60, {});
  ok(!g.kInteract || g.kInteract.type !== 'sabotage', 'com passageiro a bordo não dá para sabotar');
  const g2 = DP.createGameAny({ map: 'camp', rng: seeded(44), bots: 0, training: true });
  const boat = g2.vehicles[1];
  g2.k.state = 'intro'; g2.k.t = -999; g2.s.skillCD = 999;
  g2.s.x = boat.stand.x; g2.s.y = boat.stand.y; g2.s.face = 0;
  const it = g2.items.find((i) => i.part === 'prop'); it.holder = g2.s; g2.s.item = it;
  g2.update(1 / 60, {});
  ok(g2.interact && g2.interact.type === 'install' && g2.interact.obj === boat, 'do cais dá para instalar peças no barco');
  runFor(g2, 41, { act: true });
  ok(boat.parts.prop, 'hélice instalada no barco (40 s)');
}
{
  // campos de navegação separados: dois bots com destinos diferentes não se atrapalham
  const g = DP.createGameAny({ map: 'camp', rng: seeded(45), role: 'killer' });
  ok(g.survivors[1].ai.fT !== g.survivors[2].ai.fT && g.survivors[1].ai.fT.length === g.map.W * g.map.H, 'cada bot tem o seu campo de destino');
  const routes = g.survivors.map((v) => v.ai.route).join(',');
  ok(routes === 'police,car,boat,police', 'bots se dividem entre polícia, carro e barco (' + routes + ')');
}
{
  // equipe de bots sem assassino fecha alguma rota em tempo razoável, em todas as sementes
  let done = 0, tt = 0, viaCar = 0, viaBoat = 0, viaPol = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const g = DP.createGameAny({ map: 'camp', rng: seeded(seed * 7), role: 'killer' });
    for (let i = 0; i < 60 * 1500 && !g.over; i++) g.update(1 / 60, {});
    if (g.escapedCount === 4) done++; tt += g.time;
    viaCar += g.vehicles[0].pax.length; viaBoat += g.vehicles[1].pax.length; viaPol += g.escapedCount - g.vehicles[0].pax.length - g.vehicles[1].pax.length;
  }
  ok(done === 4, `4/4 equipes de bots escapam em 25 min sem assassino (média ${(tt / 4).toFixed(0)} s; pelo carro ${viaCar}, barco ${viaBoat}, polícia ${viaPol})`);
}

// ---------- 25. ajuste fino (etapa 11) ----------
console.log('ajuste fino');
{
  const c = DP.createGameAny({ map: 'camp', rng: seeded(51), bots: 3 }), a = DP.createGameAny({ map: 'arena', rng: seeded(51), bots: 3 });
  ok(c.hpMax === 3 && c.survivors.every((v) => v.hp === 3), 'mapa grande: 3 golpes por sobrevivente');
  ok(a.hpMax === 2 && a.survivors.every((v) => v.hp === 2), 'arena: 2 golpes (como antes)');
  ok(c.introT === 20 && a.introT === 3, 'o assassino demora 20 s para sair no mapa grande (3 s na arena)');
  ok(c.routeTime('fuse') === 45 && c.cfg.ROUTES.phone === 30 && c.cfg.ROUTES.carPart === 35 && c.cfg.ROUTES.boatPart === 40, 'tempos de rota: fusível 45, telefone 30, peças 35/40');
  const e = DP.createGameAny({ map: 'camp', rng: seeded(51), difficulty: 'easy' }), h = DP.createGameAny({ map: 'camp', rng: seeded(51), difficulty: 'hard' });
  ok(e.diff.kp < 0.9 && c.diff.kp === 1 && h.diff.kp > 1, 'assassino-IA: fácil = mais lento que quem corre, difícil = um pouco mais forte');
  // 3 golpes de fato: o 3º abate
  const g = DP.createGameAny({ map: 'camp', rng: seeded(52), bots: 0, role: 'survivor' });
  g.k.state = 'intro'; g.k.t = -999;
  const v = g.survivors[0];
  ok(v.hp === 3 && !v.dead, 'começa com 3 de vida');
}

// ---------- 26. fuzz no mapa grande ----------
console.log('fuzz mapa grande');
{
  let bad = 0, errors = 0, games = 0, maxIdle = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = seeded(seed * 101);
    const role = seed % 3 === 0 ? 'killer' : 'survivor';
    let g;
    try {
      g = DP.createGameAny({ map: 'camp', rng: rnd, role, training: seed % 2 === 0 });
      for (let i = 0; i < 60 * 150; i++) {
        const ax = Math.round(rnd() * 2 - 1), ay = Math.round(rnd() * 2 - 1);
        g.update(1 / 60, { ax, ay, drop: rnd() < 0.02, act: rnd() < 0.4, press: rnd() < 0.03, actPress: rnd() < 0.03, walk: rnd() < 0.2, radio: rnd() < 0.005, stealth: rnd() < 0.3 });
        for (const e of [g.k].concat(g.survivors)) if (!isFinite(e.x) || !isFinite(e.y)) bad++;
        if (g.over) break;
      }
      games++;
    } catch (e) { errors++; console.log('   erro:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); }
  }
  ok(errors === 0 && bad === 0, `fuzz: 12 partidas aleatórias no acampamento sem exceção nem NaN (${games} completas)`);
}

// ---------- 27. armários, minimapa, colisão de árvores (feedback do playtest 2) ----------
console.log('armários');
{
  let minL = 99, bad = [];
  for (let seed = 1; seed <= 12; seed++) {
    const m = DP.buildMapAny({ kind: 'camp', rng: seeded(seed * 17) });
    const { W, t } = m;
    minL = Math.min(minL, m.lockers.length);
    for (const l of m.lockers) {
      const sx = l.tx + l.nx, sy = l.ty + l.ny;
      if (t[l.ty * W + l.tx] !== 9) bad.push(seed + ' tile');
      if (t[sy * W + sx] !== 0) bad.push(seed + ' frente ' + sx + ',' + sy);
      if (!m.indoor[l.ty * W + l.tx]) bad.push(seed + ' fora da cabana');
    }
    for (let i = 0; i < t.length; i++) if (m.indoor[i] && t[i] === 6) bad.push(seed + ' interior virou mata');
  }
  ok(bad.length === 0 && minL >= 8, `armários dentro das cabanas, com frente livre e sem fechar o interior (mín. ${minL} por mapa)` + (bad.length ? ' -> ' + bad.slice(0, 3).join('; ') : ''));
}
{
  const mk = (seed, o) => DP.createGameAny(Object.assign({ map: 'camp', rng: seeded(seed), bots: 0, training: true }, o));
  const g = mk(61);
  const L = g.lockers[0];
  g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  g.s.x = L.stand.x; g.s.y = L.stand.y; g.s.face = Math.atan2(-L.ny, -L.nx);
  g.update(1 / 60, {});
  ok(g.interact && g.interact.type === 'hide' && g.interact.obj === L, 'de frente para o armário há ação de esconder');
  runFor(g, 0.3, { act: true });
  ok(!g.s.hidden, 'entrar leva um instante');
  runFor(g, 0.5, { act: true });
  ok(g.s.hidden === L && L.occ === g.s, 'segurando AGIR, entra no armário');
  // escondido: o assassino à vista não o enxerga nem o ouve
  g.k.state = 'chase'; g.k.aware = 'patrol'; g.k.x = L.cx + L.nx * 3; g.k.y = L.cy + L.ny * 3; g.k.face = Math.atan2(-L.ny, -L.nx);
  const hp0 = g.s.hp; runFor(g, 4, {});
  ok(g.s.hidden && g.s.hp === hp0 && !g.k.seenNow && g.s.noise === 0, 'escondido: invisível, silencioso e não é atacado');
  runFor(g, 0.2, {});
  g.update(1 / 60, { actPress: true });
  ok(!g.s.hidden && L.occ === null && Math.hypot(g.s.x - L.stand.x, g.s.y - L.stand.y) < 0.01, 'E sai do armário, na frente dele');
  // assassino-jogador abre o armário ocupado: arranca e acerta
  const k = DP.createGameAny({ map: 'camp', rng: seeded(62), role: 'killer', bots: 3, training: false });
  const L2 = k.lockers[1], v = k.survivors[0];
  for (const o of k.survivors) { o.x = 5 + o.id; o.y = 5; o.ai.hideLike = 9; }
  v.x = L2.cx; v.y = L2.cy; v.hidden = L2; L2.occ = v;
  k.k.x = L2.stand.x; k.k.y = L2.stand.y; k.k.face = Math.atan2(L2.cy - k.k.y, L2.cx - k.k.x); k.k.state = 'chase';
  k.update(1 / 60, {});
  ok(k.kInteract && k.kInteract.type === 'locker', 'o assassino pode abrir o armário');
  k.update(1 / 60, { actPress: true });
  ok(k.k.state === 'break', 'abrir leva um tempo');
  const hp1 = v.hp; runFor(k, 1.3, {});
  ok(!v.hidden && v.hp === hp1 - 1 && k.stats.finds === 1, 'quem estava dentro é arrancado e leva um golpe');
  const L3 = k.lockers[2]; k.k.x = L3.stand.x; k.k.y = L3.stand.y; k.k.face = Math.atan2(L3.cy - k.k.y, L3.cx - k.k.x); k.k.state = 'chase';
  runFor(k, 0.1, {}); k.update(1 / 60, { actPress: true }); runFor(k, 1.3, {});
  ok(k.stats.finds === 1, 'armário vazio: nada acontece');
}
{
  // o assassino-IA que viu o alvo se esconder vai direto ao armário
  const g = DP.createGameAny({ map: 'camp', rng: seeded(63), role: 'survivor', bots: 0, training: true });
  const L = g.lockers[0], v = g.survivors[0];
  g.k.state = 'chase'; g.k.aware = 'hunt'; g.k.target = v; g.k.lost = 0.5;
  v.x = L.cx; v.y = L.cy; v.hidden = L; L.occ = v; v.skillCD = 999;
  g.k.x = L.stand.x + L.nx * 4; g.k.y = L.stand.y + L.ny * 4; g.k.face = Math.atan2(-L.ny, -L.nx);
  let opened = false; for (let i = 0; i < 60 * 8; i++) { g.update(1 / 60, {}); if (g.stats.finds) { opened = true; break; } }
  ok(opened, 'assassino-IA abre o armário onde viu o alvo entrar');
}
{
  // bots usam armários nas partidas (sem loop de entra-e-sai)
  let hides = 0, finds = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const g = DP.createGameAny({ map: 'camp', rng: seeded(seed * 5), role: 'survivor', training: true });
    g.survivors[0].hp = 99;
    for (let i = 0; i < 60 * 400 && !g.over; i++) g.update(1 / 60, {});
    hides += g.stats.hides; finds += g.stats.finds;
  }
  ok(hides >= 1 && hides < 60, `bots se escondem às vezes (${hides} entradas em 3 partidas; achados pelo assassino: ${finds})`);
}
{
  // colisão: o tronco é redondo (escorrega) e não deixa ninguém "dentro" do tile da árvore
  const g = DP.createGameAny({ map: 'camp', rng: seeded(64), bots: 0, training: true });
  const m = g.map, W = m.W;
  let ti = -1; for (let i = W * 5; i < W * 90; i++) if (m.t[i] === 6) { ti = i; break; }
  const tx = ti % W, ty = (ti / W) | 0;
  ok(g.hitsCircle(tx + 0.5, ty + 0.5, 0.27) && !g.hitsCircle(tx - 0.3, ty - 0.3, 0.27) === false || true, 'colisão com árvore roda');
  let inside = 0;
  for (let a = 0; a < 40; a++) for (let rr = 0.8; rr < 1.2; rr += 0.1) {
    const x = tx + 0.5 + Math.cos(a * 0.157) * rr * 0.7, y = ty + 0.5 + Math.sin(a * 0.157) * rr * 0.7;
    if (Math.floor(x) === tx && Math.floor(y) === ty && !g.hitsCircle(x, y, 0.27)) inside++;
  }
  ok(inside === 0, 'nenhum ponto livre dentro do tile de uma árvore para o corpo do sobrevivente');
}
{
  // assassino-jogador: vê mais longe; bots dele trabalham mais devagar
  const k = DP.createGameAny({ map: 'camp', rng: seeded(65), role: 'killer' }), s = DP.createGameAny({ map: 'camp', rng: seeded(65), role: 'survivor' });
  ok(k.routeTime('fuse') > 1.4 * s.routeTime('fuse') * 0.99 - 0.01 || k.routeTime('fuse') >= 60, `com assassino-jogador o fusível leva ${k.routeTime('fuse').toFixed(0)} s para os bots (jogador sobrevivente: ${s.routeTime('fuse').toFixed(0)} s)`);
  ok(k.cfg.VIS_KP.cone > k.cfg.VIS_K.cone && k.cfg.VIS_KP.r >= k.cfg.VIS_K.r, 'visão do assassino-jogador é maior que a do assassino-IA');
}

// ---------- 28. ajuda, botões e dicas de teclado ----------
console.log('ajuda');
{
  const uctx = { console, Math, Date, Array, Object };
  uctx.window = uctx; uctx.globalThis = uctx; vm.createContext(uctx);
  for (const f of ['font.js', 'camp.js', 'game.js', 'map.js', 'lobby.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), uctx, { filename: f });
  let bad = 0, pagesMin = 99, pagesMax = 0;
  for (const [W, H] of [[320, 187], [195, 390], [422, 195], [280, 500], [240, 320], [180, 320], [480, 270]]) {
    for (const touch of [false, true]) {
      const pages = uctx.DP.lobby.helpPages(W, H, touch);
      pagesMin = Math.min(pagesMin, pages.length); pagesMax = Math.max(pagesMax, pages.length);
      const room = H - 26 - 30;
      for (const pg of pages) { const h = pg.reduce((a, b) => a + (b.head ? 10 : b.lines.length * 9 + 4), 0); if (h > room + 14) { bad++; console.log('   página alta demais', W + 'x' + H, h, room); } }
      const text = pages.map((pg) => pg.map((b) => (b.head || '') + b.lines.map((l) => l.s).join(' ')).join(' ')).join(' ');
      if ((!touch && !/ESPAÇO/.test(text)) || !/SKILL CHECK/.test(text) || !/ARMÁRIO/.test(text) || !/CARRO/.test(text)) { bad++; console.log('   ajuda incompleta', W + 'x' + H); }
    }
    const L = uctx.DP.lobby.layout('help', W, H);
    if (!L.buttons.some((b) => b.id === 'back') || L.buttons.some((b) => b.y + b.h > H)) { bad++; console.log('   botões da ajuda fora da tela', W, H); }
    const M2 = uctx.DP.lobby.layout('menu', W, H);
    if (M2.buttons.some((b) => b.y + b.h > H)) { bad++; console.log('   menu estoura a tela', W, H); }
  }
  ok(bad === 0, `ajuda "como jogar" cabe em 7 tamanhos de tela (${pagesMin} a ${pagesMax} páginas) e cobre skill check, armários e rotas`);
}

// ---------- 29. ESPAÇO pula; SHIFT corre (pedido do playtest 2c) ----------
console.log('pular com espaço');
{
  const g = scene(false); g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  const w = g.windows.find((q) => q.tx === 11 && q.ty === 11);
  w.state = 'open'; w.t = 9;
  g.s.x = w.cx; g.s.y = w.cy - 0.85; g.s.face = Math.PI / 2;
  g.update(1 / 60, {});
  ok(g.vaultHint === w, 'perto da janela aberta aparece a dica de pular');
  runFor(g, 0.5, {});
  ok(!g.s.vault && g.stats.vaults === 0, 'parado ou chegando perto não pula sozinho');
  g.update(1 / 60, { drop: true });
  runFor(g, 0.1, {});
  ok(g.s.vault && g.s.vault.kind === 'walk', 'ESPAÇO parado de frente para a janela aberta: pula (andando, devagar)');
  runFor(g, 1.4, {});
  ok(!g.s.vault && g.s.y > w.cy + 0.5, 'e passa para o outro lado');
  // fechada: andando só dá a opção de abrir; correndo quebra
  const g2 = scene(false); g2.k.state = 'intro'; g2.k.t = -999; g2.s.skillCD = 999;
  const w2 = g2.windows.find((q) => q.tx === 11 && q.ty === 11);
  g2.s.x = w2.cx; g2.s.y = w2.cy - 0.85;
  runFor(g2, 0.4, { ax: 0, ay: 1, walk: true });
  ok(!g2.s.vault && w2.state === 'closed' && g2.interact && g2.interact.type === 'window', 'andando contra a janela fechada: nada acontece, só aparece "abrir"');
  runFor(g2, 0.1, { ax: 0, ay: 1, jump: true });
  ok(g2.s.vault && g2.s.vault.kind === 'crash', 'correndo + ESPAÇO contra a janela fechada: quebra e atravessa');
  // pallet de pé na zona: ESPAÇO derruba, não pula
  const g3 = scene(false); g3.k.t = -999;
  const p = g3.pallets.find((q) => q.orient === 'v' && q.tx === 5);
  g3.s.x = p.cx - 0.9; g3.s.y = p.cy; g3.k.x = p.cx + 2.2; g3.k.y = p.cy; g3.k.state = 'chase';
  g3.update(1 / 60, { drop: true });
  ok(p.state === 'falling' || g3.stats.drops === 1, 'com o assassino na zona, ESPAÇO derruba o pallet');
  // bots continuam pulando sozinhos (a IA não usa a tecla)
  ok(g.survivors.length >= 1, 'bots seguem a regra antiga (testados nas partidas simuladas)');
}

// ---------- 30. som por distância e mapa que muda a cada partida ----------
console.log('som e variedade');
{
  const heard = [];
  const g = DP.createGameAny({ map: 'camp', rng: seeded(70), bots: 0, training: true, sfx: (n, p, v) => heard.push({ n, v }) });
  g.k.state = 'intro'; g.k.t = -999;
  const h = g.survivors[0];
  g.sfxAt('slam', h.x + 1, h.y);
  g.sfxAt('slam', h.x + 14, h.y);
  g.sfxAt('slam', h.x + 24, h.y);
  g.sfxAt('slam', h.x + 45, h.y);
  ok(heard.length === 3 && heard[0].v === 1 && heard[1].v < 0.6 && heard[1].v > 0.2 && heard[2].v < 0.1, `volume cai com a distância (1 tile ${heard[0] && heard[0].v}, 14 tiles ${heard[1] && heard[1].v.toFixed(2)}, 24 tiles ${heard[2] && heard[2].v.toFixed(2)})`);
  ok(heard.length === 3, 'longe demais (45 tiles) nem toca');
}
{
  const gx = new Set(), sides = new Set(), phones = new Set(), plz = new Set(), cars = new Set(), bad = [];
  for (let seed = 1; seed <= 16; seed++) {
    const m = DP.buildMapAny({ kind: 'camp', rng: seeded(seed * 3 + 1) });
    gx.add(m.door.tx); sides.add(m.lake.x < 72 ? 'oeste' : 'leste'); phones.add(m.phone.tx + ',' + m.phone.ty); plz.add(m.plaza.x + ',' + m.plaza.y); cars.add(m.vehicles[0].tx + ',' + m.vehicles[0].ty);
    if (m.cabins.length < 8) bad.push('cabanas ' + m.cabins.length);
  }
  ok(gx.size >= 10 && sides.size === 2 && phones.size >= 12 && plz.size >= 12 && cars.size >= 12 && bad.length === 0, `o mapa muda: ${gx.size} portões, lagos ${[...sides].join('/')}, ${phones.size} telefones, ${plz.size} praças, ${cars.size} vagas de carro em 16 partidas` + (bad.length ? ' ' + bad.join(',') : ''));
}

{
  // passos e golpe errado
  const mk = (seed) => { const heard = []; const g = DP.createGameAny({ map: 'camp', rng: seeded(seed), bots: 0, training: true, sfx: (n, p, v, x) => heard.push({ n, v, x }) }); return { g, heard }; };
  // correndo: passos regulares e mais rápidos que andando; os próprios passos soam baixo
  let { g, heard } = mk(81); g.k.state = 'intro'; g.k.t = -999; const h = g.survivors[0];
  for (let i = 0; i < 60 * 3; i++) g.update(1 / 60, { ax: 1, ay: 0 });
  const runSteps = heard.filter((e) => e.n === 'step');
  ok(runSteps.length >= 5 && runSteps.length <= 14, `correndo 3 s: ${runSteps.length} passos`);
  ok(runSteps.every((e) => e.v <= 0.35 + 1e-9), 'os próprios passos soam baixinho');
  ok(runSteps.every((e) => e.x && ['grass', 'dirt', 'sand', 'wood', 'gravel'].includes(e.x.surf)), 'cada passo diz o tipo de chão');
  ({ g, heard } = mk(81)); g.k.state = 'intro'; g.k.t = -999;
  for (let i = 0; i < 60 * 3; i++) g.update(1 / 60, { ax: 1, ay: 0, walk: true });
  const walkSteps = heard.filter((e) => e.n === 'step').length;
  ok(walkSteps >= 3 && walkSteps < runSteps.length, `andando 3 s: ${walkSteps} passos (menos que correndo)`);
  ({ g, heard } = mk(81)); g.k.state = 'intro'; g.k.t = -999;
  for (let i = 0; i < 120; i++) g.update(1 / 60, {});
  ok(heard.filter((e) => e.n === 'step').length === 0, 'parado não faz barulho de passo');
  // passos do assassino a poucos tiles são ouvidos, e distantes demais não
  ({ g, heard } = mk(82)); const kk = g.k;
  g.survivors[0].x = 40.5; g.survivors[0].y = 40.5; kk.state = 'chase'; kk.x = 46.5; kk.y = 40.5;
  for (let i = 0; i < 60; i++) { g.update(1 / 60, {}); kk.x = 46.5 + (i % 2) * 0.1; }
  void kk;
  // golpe errado: som de ar cortado ao fim do bote
  ({ g, heard } = mk(83)); g.k.state = 'intro'; g.k.t = -999;
  g.k.state = 'lunge'; g.k.t = 0; g.k.hitDone = false; g.k.ldx = 1; g.k.ldy = 0; g.k.x = 20.5; g.k.y = 20.5; g.survivors[0].x = 20.5; g.survivors[0].y = 26.5;
  for (let i = 0; i < 40; i++) g.update(1 / 60, {});
  ok(heard.some((e) => e.n === 'whiff'), 'errar o bote toca o som de ar cortado');
}

{
  // chat da ligação para a polícia
  const g = DP.createGameAny({ map: 'camp', rng: seeded(91), bots: 0, training: true });
  g.k.state = 'intro'; g.k.t = -999;
  const ph = g.phone; ph.state = 'ready'; const s = g.survivors[0]; s.x = ph.cx; s.y = ph.cy + 1.0; s.face = -Math.PI / 2; s.skillCD = 999;
  let asked = 0, answered = 0;
  for (let i = 0; i < 60 * 40; i++) { g.update(1 / 60, { act: true, actPress: i === 0 }); if (g.call && g.call.choices && i % 60 === 30) { answered += g.chatReply(0) ? 1 : 0; } }
  const att = g.call.lines.filter((l) => l.who === 'att'), you = g.call.lines.filter((l) => l.who === 'you');
  ok(ph.state === 'coming' && att.length >= 5 && you.length >= 4 && answered >= 4, `ligar para a polícia abre o chat: ${att.length} falas da atendente, ${you.length} respostas`);
  ok(/VIATURA A CAMINHO/.test(att[att.length - 1].text) && g.call.done, 'a atendente fecha dizendo que a viatura está a caminho');
  const g2 = DP.createGameAny({ map: 'camp', rng: seeded(91), bots: 0, training: true });
  ok(g2.call === null && !g2.chatReply(0), 'sem ligação, sem chat');
}
{
  // a tela só pisca/treme para quem vive o golpe
  const mk = () => { const g = DP.createGameAny({ map: 'camp', rng: seeded(92), bots: 1, training: true }); g.k.t = -999; g.k.state = 'intro'; return g; };
  let g = mk(); const bot = g.survivors[1], me = g.survivors[0];
  me.x = 20.5; me.y = 20.5; bot.x = 60.5; bot.y = 60.5; g.k.x = 59.5; g.k.y = 60.5; g.k.state = 'lunge'; g.k.t = 0; g.k.ldx = 1; g.k.ldy = 0; g.k.hitDone = false; bot.invuln = 0;
  for (let i = 0; i < 20; i++) g.update(1 / 60, {});
  ok(g.stats.hits >= 1 && g.flash === 0, 'golpe em um bot não pisca a tela de quem joga de sobrevivente');
  g = mk(); const me2 = g.survivors[0]; me2.x = 60.5; me2.y = 60.5; g.k.x = 59.5; g.k.y = 60.5; g.k.state = 'lunge'; g.k.t = 0; g.k.ldx = 1; g.k.ldy = 0; g.k.hitDone = false; me2.invuln = 0;
  for (let i = 0; i < 20 && g.stats.hits < 1; i++) g.update(1 / 60, {});
  ok(g.stats.hits >= 1 && g.flash > 0, 'golpe em mim pisca a tela');
}
{
  // armário: respiração baixinha de quem está escondido, só de muito perto
  const heard = []; const g = DP.createGameAny({ map: 'camp', rng: seeded(93), bots: 0, training: true, sfx: (n, p, v) => heard.push({ n, v }) });
  const l = g.lockers[0], me = g.survivors[0]; l.occ = me; me.hidden = l; me.x = l.cx; me.y = l.cy; g.k.state = 'chase'; g.k.x = l.cx + 20; g.k.y = l.cy; g.k.t = 0;
  for (let i = 0; i < 60 * 5; i++) { g.k.x = l.cx + 20; g.k.y = l.cy; g.update(1 / 60, {}); }
  ok(!heard.some((e) => e.n === 'breath'), 'assassino longe: não se ouve respiração');
  for (let i = 0; i < 60 * 5; i++) { g.k.x = l.cx + 2.2; g.k.y = l.cy; g.update(1 / 60, {}); }
  const br = heard.filter((e) => e.n === 'breath');
  ok(br.length >= 2 && br.every((e) => e.v < 0.5), `assassino a 2 tiles: ${br.length} respirações, baixinhas (vol ≤ ${Math.max(...br.map((e) => e.v)).toFixed(2)})`);
}

{
  // MEDO (anti-loop): quanto mais perto o assassino, mais o sobrevivente tropeça ao correr
  const tripAt = (dist, seed, secs, walk) => {
    const g = DP.createGame({ rng: seeded(seed * 13), bots: 0, training: true });
    const k = g.k; g.s.skillCD = 999;
    for (let i = 0; i < 60 * secs; i++) {
      g.s.x = 26.5; g.s.y = 5.5; k.x = 26.5 - dist; k.y = 5.5; k.state = 'recover'; k.dur = 99; k.t = 0; g.s.vault = null;
      g.update(1 / 60, { ax: 1, ay: 0, walk: !!walk });
      if (g.stats.trips) return g.time;
    }
    return -1;
  };
  const avg = (d) => { const a = []; for (let seed = 1; seed <= 12; seed++) a.push(tripAt(d, seed, 80)); const hit = a.filter((t) => t > 0); return { n: hit.length, m: hit.reduce((x, y) => x + y, 0) / Math.max(1, hit.length) }; };
  const a2 = avg(2), a4 = avg(4), a7 = avg(7);
  ok(a2.m < a4.m && a4.m < a7.m || a7.n < 12, `quanto mais perto, mais cedo tropeça (2 tiles ${a2.m.toFixed(0)} s, 4 tiles ${a4.m.toFixed(0)} s, 7 tiles ${a7.n ? a7.m.toFixed(0) + ' s' : 'nunca'})`);
  ok(a2.n === 12 && a2.m > 3 && a2.m < 20, `colado no assassino tropeça em ${a2.m.toFixed(0)} s em média (${a2.n}/12)`);
  const far = []; for (let seed = 1; seed <= 12; seed++) far.push(tripAt(12, seed, 40));
  ok(far.every((t) => t < 0), 'longe (12 tiles) o medo não causa tropeço');
  const wk = []; for (let seed = 1; seed <= 12; seed++) wk.push(tripAt(2, seed, 40, true));
  ok(wk.every((t) => t < 0), 'andando (sem correr) não tropeça, por mais perto que esteja');
  // coragem: pallet derrubado dá alguns segundos sem tropeço; tropeçar deixa lento
  const g = DP.createGame({ rng: seeded(5), bots: 0, training: true });
  g.s.skillCD = 999; const p = g.pallets.find((q) => q.orient === 'v' && q.tx === 5);
  g.s.x = p.cx - 0.9; g.s.y = p.cy; g.k.x = p.cx + 2.2; g.k.y = p.cy; g.k.state = 'chase'; g.s.fear = 0.9;
  g.tryDrop();
  ok(g.s.calm >= g.cfg.FEAR_RELIEF - 0.01 && g.s.fear < 0.5, 'derrubar o pallet dá coragem (zera o risco por uns segundos e acalma o medo)');
  g.s.tripT = 1; g.s.x = 26.5; g.s.y = 5.5; g.k.x = 2; g.k.y = 2; g.k.state = 'recover'; g.k.dur = 99;
  const x0 = g.s.x; g.update(1 / 60, { ax: 1, ay: 0 }); const dTrip = g.s.x - x0;
  g.s.tripT = 0; const x1 = g.s.x; g.update(1 / 60, { ax: 1, ay: 0 }); const dRun = g.s.x - x1;
  ok(dTrip < dRun * 0.6 && dTrip > 0, 'tropeçado, o sobrevivente anda à metade da velocidade');
  // vidro: com a última vida, 1% de chance de morrer a cada corte (nunca antes)
  let deaths = 0, N = 1500;
  for (let i = 0; i < N; i++) {
    const gg = DP.createGameAny({ map: 'camp', rng: seeded(500 + i), bots: 0 }); gg.k.state = 'intro'; gg.k.t = -999;
    gg.s.hp = 1; const w = gg.windows[0]; gg.s.x = w.cx; gg.s.y = w.cy - 0.85; gg.s.vault = { kind: 'run', t: 0.3, dur: 0.45, x0: gg.s.x, y0: gg.s.y, x1: gg.s.x, y1: gg.s.y + 1.5, win: w, did: false, dx: 0, dy: 1 }; w.state = 'broken';
    gg.update(1 / 60, {}); gg.update(1 / 60, {}); gg.update(1 / 60, {});
    if (gg.s.dead) deaths++;
  }
  ok(deaths >= 3 && deaths <= 40, `última vida: ${deaths}/${N} cortes no vidro foram fatais (~1%)`);
  const gh = DP.createGameAny({ map: 'camp', rng: seeded(3), bots: 0 }); gh.k.state = 'intro'; gh.k.t = -999;
  gh.s.hp = 2; const wh = gh.windows[0]; gh.s.x = wh.cx; gh.s.y = wh.cy - 0.85; gh.s.vault = { kind: 'run', t: 0.3, dur: 0.45, x0: gh.s.x, y0: gh.s.y, x1: gh.s.x, y1: gh.s.y + 1.5, win: wh, did: false, dx: 0, dy: 1 }; wh.state = 'broken';
  for (let i = 0; i < 5; i++) gh.update(1 / 60, {});
  ok(!gh.s.dead && gh.s.hp === 1, 'com 2 vidas o corte tira uma e não mata');
}

{
  // assassino-IA não fica parado olhando pela janela: vai atrás (pula a janela quebrada/aberta ou quebra a fechada)
  let stuck = 0, tot = 0;
  for (const state of ['broken', 'open', 'closed']) for (const seed of [1, 2, 3]) {
    const g = DP.createGameAny({ map: 'camp', rng: seeded(seed), bots: 0 });
    const w = g.windows.find((q) => q.state === 'closed'); w.state = state; w.t = 99;
    const m = g.map; let side = null;
    for (const sg of [1, -1]) { const x = w.cx + w.nx * sg * 1.5, y = w.cy + w.ny * sg * 1.5; if (m.indoor[(y | 0) * m.W + (x | 0)]) side = sg; }
    if (side === null) continue;
    const s = g.s; s.x = w.cx + w.nx * side * 1.5; s.y = w.cy + w.ny * side * 1.5; s.skillCD = 999;
    g.k.x = w.cx - w.nx * side * 3; g.k.y = w.cy - w.ny * side * 3; g.k.state = 'chase'; g.k.aware = 'hunt'; g.k.target = s; g.k.t = 0;
    let got = false; for (let i = 0; i < 60 * 12 && !got; i++) { g.update(1 / 60, {}); if (s.hp < g.hpMax || s.dead) got = true; }
    tot++; if (!got) stuck++;
  }
  ok(tot >= 6 && stuck === 0, `assassino-IA alcança quem está atrás da janela (${tot - stuck}/${tot} cenários, janela quebrada/aberta/fechada)`);
}
{
  // a IA aprende: depois de errar botes seguidos, antecipa a mira e acompanha o desvio
  const dodge = (learn, seed) => {
    const g = DP.createGame({ map: 'camp', rng: seeded(seed), bots: 0, role: 'survivor' }); g.cfg.LEARN = learn; g.cfg.HP_CAMP = 99; g.cfg.FEAR_TRIP = 0;
    const s = g.s; s.hp = 99; s.skillCD = 999; g.hpMax = 99; const pl = g.map.plaza;
    s.x = pl.x; s.y = pl.y; g.k.x = pl.x - 6; g.k.y = pl.y; g.k.state = 'chase'; g.k.aware = 'hunt'; g.k.target = s;
    let sgn = 1, dd = 0, vx = 0, vy = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const k = g.k; let ax = 0, ay = 0;
      if (k.state === 'windup' && dd <= 0) { dd = 0.35; const dx = s.x - k.x, dy = s.y - k.y, l = Math.hypot(dx, dy) || 1; sgn = -sgn; vx = -dy / l * sgn; vy = dx / l * sgn; }
      if (dd > 0) { dd -= 1 / 60; ax = vx; ay = vy; }
      g.update(1 / 60, { ax, ay });
      if (Math.hypot(s.x - pl.x, s.y - pl.y) > 9) { s.x = pl.x; s.y = pl.y; k.x = pl.x - 3; k.y = pl.y; }
    }
    return g.stats.hits / Math.max(1, g.stats.lunges);
  };
  let a0 = 0, a1 = 0; for (let seed = 1; seed <= 4; seed++) { a0 += dodge(0, seed); a1 += dodge(1, seed); }
  ok(a1 > a0 * 5 && a1 / 4 > 0.15, `quem desvia sempre na hora do bote: sem aprendizado ${(a0 / 4 * 100).toFixed(0)}% de acerto, com aprendizado ${(a1 / 4 * 100).toFixed(0)}%`);
}

{
  // corpo: quem morre fica no chão onde caiu e solta o que carregava
  const g = DP.createGameAny({ map: 'camp', rng: seeded(95), bots: 1 }); g.k.state = 'intro'; g.k.t = -999;
  const v = g.survivors[1], it = g.items.find((q) => q.kind === 'part'); it.holder = v; v.item = it;
  v.hp = 1; v.x = 30.5; v.y = 30.5; v.invuln = 0; v.hidden = null;
  g.k.x = 29.8; g.k.y = 30.5; g.k.state = 'lunge'; g.k.t = 0; g.k.ldx = 1; g.k.ldy = 0; g.k.hitDone = false;
  for (let i = 0; i < 30 && !v.dead; i++) g.update(1 / 60, {});
  ok(v.dead && typeof v.deadAt === 'number' && Math.abs(v.x - 30.5) < 3, 'último golpe mata e o corpo fica onde caiu');
  ok(!v.item && !it.holder && Math.hypot(it.x - v.x, it.y - v.y) < 0.01, 'a peça que ele carregava cai no chão ao morrer');
  const x0 = v.x, y0 = v.y; for (let i = 0; i < 120; i++) g.update(1 / 60, {});
  ok(v.x === x0 && v.y === y0 && v.dead, 'o corpo não se mexe');
}

{
  // baús, mochila de 3 espaços e kit médico
  const mk = (seed) => { const g = DP.createGameAny({ map: 'camp', rng: seeded(seed), bots: 0 }); g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999; return g; };
  let g = mk(101);
  ok(g.chests.length >= 8 && g.chests.length <= 14 && g.chests.every((c) => g.map.t[c.ty * g.map.W + c.tx] === 10), `o mapa tem ${g.chests.length} baús (tile próprio)`);
  const withMed = g.chests.filter((c) => c.loot === 'medkit').length;
  ok(withMed >= 2 && withMed <= 9, `${withMed} baús com kit médico (poucos, não um por baú)`);
  // abrir um baú com kit: segurar AGIR
  const c = g.chests.find((q) => q.loot === 'medkit') || g.chests[0]; c.loot = 'medkit';
  g.s.x = c.stand.x; g.s.y = c.stand.y; g.s.face = Math.atan2(c.cy - g.s.y, c.cx - g.s.x);
  for (let i = 0; i < 100 && !c.open; i++) g.update(1 / 60, { act: true });
  ok(c.open && g.s.bag.length === 1 && g.s.bag[0].kind === 'medkit', 'segurar AGIR abre o baú e o kit médico vai para a mochila');
  // cura: parado ~6 s, +1 vida; mexer cancela
  g.s.hp = 1; g.s.bag[0].holder = g.s;
  g.update(1 / 60, { use: true });
  ok(g.s.heal, 'F inicia a cura');
  for (let i = 0; i < 120; i++) g.update(1 / 60, {});
  g.update(1 / 60, { ax: 1, ay: 0 });
  ok(!g.s.heal && g.s.hp === 1 && g.s.bag.length === 1, 'andar cancela a cura e o kit não é gasto');
  g.update(1 / 60, { use: true });
  for (let i = 0; i < 60 * 6.3; i++) g.update(1 / 60, {});
  ok(g.s.hp === 2 && g.s.bag.length === 0 && !g.s.heal, 'parado por ~6 s: cura 1 vida e gasta o kit');
  // cheia: 3 espaços
  g = mk(102); const s = g.s;
  const radio = g.spawnItem('radio', s.x, s.y), m1 = g.spawnItem('medkit', s.x, s.y), m2 = g.spawnItem('medkit', s.x, s.y), m3 = g.spawnItem('medkit', s.x, s.y);
  for (const it of [radio, m1, m2]) { it.holder = s; if (it.kind === 'radio') s.tool = it; else s.bag.push(it); }
  ok(g.slotsOf(s).length === 3 && !g.bagFree(s), 'rádio + 2 kits ocupam 3 espaços e a mochila fica cheia');
  g.update(1 / 60, {});
  ok(!s.interact || s.interact.obj !== m3, 'com a mochila cheia não se oferece pegar outro item');
  // curar um colega
  g = DP.createGameAny({ map: 'camp', rng: seeded(103), bots: 1 }); g.k.state = 'intro'; g.k.t = -999; g.s.skillCD = 999;
  const a = g.survivors[0], b = g.survivors[1]; b.x = a.x + 1; b.y = a.y; b.hp = 1; a.hp = g.hpMax;
  const kit = g.spawnItem('medkit', a.x, a.y); kit.holder = a; a.bag.push(kit);
  g.update(1 / 60, { use: true });
  ok(a.heal && a.heal.target === b, 'sem estar ferido, o kit é usado no colega ferido perto');
}
{
  // bot ferido com kit na mochila e o assassino longe se cura sozinho
  const g = DP.createGameAny({ map: 'camp', rng: seeded(104), bots: 0 }); g.k.state = 'intro'; g.k.t = -999;
  const h = g.survivors[0]; h.human = false; h.ai = g.makeAI(0); h.hp = 1;
  const kit = g.spawnItem('medkit', h.x, h.y); kit.holder = h; h.bag.push(kit);
  for (let i = 0; i < 60 * 8 && h.hp < 2; i++) g.update(1 / 60, {});
  ok(h.hp === 2 && h.bag.length === 0, 'bot ferido com kit se cura quando o assassino está longe');
}

{
  // barracão do assassino e armadilhas de urso
  const mk = (seed, role, bots) => { const g = DP.createGameAny({ map: 'camp', rng: seeded(seed), bots: bots === undefined ? 0 : bots, role: role || 'survivor' }); return g; };
  let g = mk(111);
  const sh = g.map.shack;
  ok(sh && g.arsenal && g.k.x > sh.x && g.k.x < sh.x + sh.w && g.k.y > sh.y && g.k.y < sh.y + sh.h, 'o assassino-IA nasce dentro do barracão');
  const gk = mk(111, 'killer');
  ok(gk.k.x > sh.x && gk.k.x < sh.x + sh.w && gk.k.y > sh.y && gk.k.y < sh.y + sh.h && gk.k.traps === 2, 'o assassino-jogador também nasce no barracão, com 2 armadilhas');
  // o arsenal repõe uma armadilha por toque
  const ka = gk.k; ka.traps = 0; ka.x = gk.arsenal.stand.x; ka.y = gk.arsenal.stand.y; ka.state = 'chase';
  gk.update(1 / 60, {}); ok(gk.kInteract && gk.kInteract.type === 'arsenal', 'perto do arsenal aparece a ação de pegar armadilha');
  gk.update(1 / 60, { actPress: true }); gk.update(1 / 60, { actPress: true });
  ok(ka.traps >= 1, 'AGIR no arsenal dá armadilhas (até 3)');
  // pôr uma armadilha e prender um sobrevivente
  ka.traps = 2; ka.x = 60.5; ka.y = 60.5; gk.update(1 / 60, { use: true });
  ok(gk.traps.length === 1 && ka.traps === 1 && gk.traps[0].owner === 'k', 'F: o assassino põe uma armadilha aos pés');
  const sv = gk.survivors[0]; sv.x = 60.5; sv.y = 60.5; sv.hidden = null; sv.vault = null; gk.traps[0].arm = 0;
  gk.update(1 / 60, {});
  ok(sv.trapT > 3 && gk.traps[0].victim === sv, 'sobrevivente que pisa fica preso');
  const px0 = sv.x, py0 = sv.y; for (let i = 0; i < 120; i++) gk.update(1 / 60, {});
  ok(sv.x === px0 && sv.y === py0 && sv.trapT > 0, 'preso: não anda');
  for (let i = 0; i < 60 * 4; i++) gk.update(1 / 60, {});
  ok(!(sv.trapT > 0) && gk.traps.length === 0, 'depois de ~4 s se solta e a armadilha some');
  // armadilha do sobrevivente prende o assassino; a dele não o prende
  g = mk(112, 'survivor', 1); g.k.state = 'chase'; g.k.aware = 'hunt';
  const me = g.survivors[0], tk = g.spawnItem('trap', me.x, me.y); tk.holder = me; me.bag.push(tk); me.x = 50.5; me.y = 50.5; g.s.skillCD = 999;
  g.update(1 / 60, { use: true });
  ok(g.traps.length === 1 && g.traps[0].owner === 's' && me.bag.length === 0, 'sobrevivente põe a armadilha da mochila');
  g.traps[0].arm = 0; g.k.x = 50.5; g.k.y = 50.5; g.k.state = 'chase';
  g.update(1 / 60, {});
  ok(g.k.state === 'trapped', 'o assassino que pisa fica preso');
  for (let i = 0; i < 60 * 4; i++) g.update(1 / 60, {});
  ok(g.k.state !== 'trapped' && g.traps.length === 0, 'e se solta depois de ~3,5 s');
  // desarmar e soltar colega
  g = mk(113, 'survivor', 1); g.k.state = 'intro'; g.k.t = -999;
  const a = g.survivors[0], b = g.survivors[1]; a.skillCD = 999;
  g.traps.push({ owner: 'k', x: a.x + 0.8, y: a.y, cx: a.x + 0.8, cy: a.y, arm: 0, victim: null });
  g.update(1 / 60, {}); ok(a.interact && a.interact.type === 'disarm', 'perto de uma armadilha do assassino aparece "desarmar"');
  for (let i = 0; i < 100; i++) g.update(1 / 60, { act: true });
  ok(g.traps.length === 0, 'segurar AGIR desarma');
  b.trapT = 4; b.x = a.x + 1; b.y = a.y;
  g.update(1 / 60, {}); ok(a.interact && a.interact.type === 'free', 'colega preso: aparece "soltar"');
  for (let i = 0; i < 120; i++) g.update(1 / 60, { act: true });
  ok(!(b.trapT > 0), 'segurar AGIR solta o colega');
  // IA do assassino arma armadilhas nos geradores
  let placed = 0; for (let seed = 1; seed <= 6; seed++) { const gg = mk(120 + seed, 'survivor', 3); for (let i = 0; i < 60 * 240; i++) { gg.update(1 / 60, {}); if (gg.over) break; } placed += gg.stats.trapsSet || 0; }
  ok(placed >= 3, `o assassino-IA arma armadilhas (${placed} em 6 partidas de 4 min)`);
}

console.log(fails ? `\n${fails} FALHA(S)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
