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
      g.update(1 / 60, { ax, ay, drop, act: rnd() < 0.5, press: rnd() < 0.05, actPress: rnd() < 0.02 });
      for (const e of [g.s, g.k]) {
        if (!isFinite(e.x) || !isFinite(e.y)) problems++;
        else if (g.solid(Math.floor(e.x), Math.floor(e.y)) && !g.s.vault) { problems++; if (problems < 4) console.log('   dentro de sólido', e === g.s ? 'S' : 'K', e.x.toFixed(2), e.y.toFixed(2)); }
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
  runFor(g, 7.5, { act: true });
  ok(gen.progress > 0.45 && gen.progress < 0.55, `segurando AGIR ~7,5s = ~50% (${gen.progress.toFixed(2)})`);
  runFor(g, 1, { act: true, ax: 1 });      // andar cancela o reparo
  const before = gen.progress;
  runFor(g, 1, { ax: 0, ay: 0 });
  ok(gen.progress === before, 'sem segurar AGIR o progresso não anda');
  g.s.x = gen.cx - 1.0; g.s.y = gen.cy;
  runFor(g, 8.5, { act: true });
  ok(gen.done && g.gensDone === 1, 'gerador concluído');
  ok(!g.gates[0].open, 'portões ainda fechados com 1 gerador');
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

// ---------- 9. portões e fuga ----------
console.log('portões');
{
  const g = scene(true); g.k.state = 'intro'; g.k.t = -999;
  g.s.skillCD = 999;
  for (let i = 0; i < 5; i++) { g.s.x = g.gens[i].cx - 1; g.s.y = g.gens[i].cy; if (g.solid(Math.floor(g.s.x), Math.floor(g.s.y))) g.s.x += 2; g.s.skillCD = 999; runFor(g, 0.05, {}); runFor(g, 15.5, { act: true }); }
  ok(g.gensDone === 5, '5 geradores concluídos');
  ok(g.gates.every((x) => x.open), 'portões energizados');
  const gate = g.gates[0];
  g.s.x = 1.6; g.s.y = gate.cy;
  runFor(g, 0.1, {});
  ok(g.interact && g.interact.type === 'gate', 'perto do portão há ação');
  runFor(g, 4.3, { act: true });
  ok(g.over && g.result === 'escaped', 'segurar AGIR no portão = escapou');
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
  ok(g.k.aware === 'hunt', 'ouve o barulho do reparo pela parede');
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
function CFG_SIGHT(g) { return g.cfg.SIGHT; }
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
function killerScene(training, seed) { return DP.createGame({ rng: seeded(seed || 3), role: 'killer', training: !!training }); }
{
  const g = killerScene();
  ok(g.role === 'killer' && g.k.state === 'chase', 'começa livre para andar');
  const x0 = g.k.x;
  runFor(g, 1, { ax: 1, ay: 0 });
  ok(Math.abs((g.k.x - x0) - DP.CFG.K_SPEED) < 0.3, `anda na velocidade do assassino (${(g.k.x - x0).toFixed(2)} tiles/s)`);
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
  for (let i = 0; i < 60 * 330 && !g.over; i++) g.update(1 / 60, {});
  tEsc = g.time;
  ok(g.over && g.result === 'escaped', `com o assassino parado, a IA escapa (geradores ${g.gensDone}, em ${tEsc.toFixed(0)}s)`);
  ok(tEsc > 90 && tEsc < 300, 'tempo de fuga plausível (90–300s)');
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
      g.update(1 / 60, { ax: still ? 0 : v.x, ay: still ? 0 : v.y, drop: atk, actPress: !!g.kInteract && g.k.state === 'chase' });
      if (g.k.state === 'stumble') ns++;
      for (const e of [g.s, g.k]) if (!isFinite(e.x) || !isFinite(e.y) || (g.solid(Math.floor(e.x), Math.floor(e.y)) && !g.s.vault)) bad++;
    }
    res[g.over ? g.result : 'timeout']++; stuns += g.stats.stuns; drops += g.stats.drops; hits += g.stats.hits; tTot += g.time; trips += ns > 0 ? 1 : 0;
  }
  ok(bad === 0, 'ninguém entra em parede/NaN com o bot jogando');
  ok(drops > 0, `a IA usa pallets (${drops} derrubados em 24 partidas, ${stuns} atordoamentos, ${trips} partidas com tropeço)`);
  console.log('   resultados (assassino-bot):', JSON.stringify(res), 'acertos:', hits, 'tempo médio', (tTot / 24).toFixed(0) + 's');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
