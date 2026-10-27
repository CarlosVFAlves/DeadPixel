// Forja de personagens: monta um boneco a partir de "genes" (pele, cabelo, roupa, acessórios...) e o desenha em
// qualquer pose e direção. Sem imagens prontas: tudo é geometria (elipsoides, esferas em cadeia, caixas) lançada
// em pixels com buffer de profundidade, luz em faixas (toon) com sombras de tom deslocado e contorno seletivo.
// Ideias de arquitetura inspiradas em procedural-pixel-creatures (MIT): genoma com sementes + genes, esqueleto +
// "rig" por parâmetros, rasterizador analítico com z-buffer, exportador de folhas com metadados.
// O núcleo (render de pixels) não usa DOM: roda no Node (testes). A ponte para canvas fica no fim.
(function () {
  'use strict';
  const DP = window.DP = window.DP || {};

  // ---------- util ----------
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 1) + 1) % 1; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }
  // rampa de 4 tons: sombra (desloca para o azul/roxo), meia-sombra, base, luz (desloca para o amarelo)
  function ramp(color) {
    const [r, g, b] = hex(color), [h, s, l] = rgb2hsl(r, g, b);
    const shift = (dh, ds, dl) => hsl2rgb(h + dh, s * ds, l + dl);
    const d = h > 0.3 && h < 0.78 ? 1 : -1;      // sombra esfria: cores quentes vão para o vermelho/roxo, frias para o violeta
    return [shift(0.03 * d, 0.85, -0.2), shift(0.015 * d, 0.95, -0.09), [r, g, b], shift(-0.012 * d, 0.9, +0.09)];
  }

  // ---------- genes e opções (o que o construtor oferece) ----------
  const SKIN = ['#f2c9a0', '#e0ab7f', '#c68a5c', '#9b6540', '#6e4429', '#f7d9c4'];
  const HAIRC = ['#1c1c1c', '#3a2418', '#6b4a22', '#a87a3a', '#d9c07a', '#a83a2a', '#c9c9d0', '#3a5aa8', '#8a3aa8'];
  const CLOTH = ['#3d6fb5', '#b5503d', '#3db56f', '#c9a43d', '#7a4aa8', '#4a4a62', '#e9e6f0', '#e08a2a', '#3da8a8', '#8a8a99'];
  const PANTS = ['#26334d', '#3a3a44', '#5a4a32', '#2f4a32', '#7a6a52', '#4a2a2a', '#1c1c24'];
  const SHOES = ['#e9e6f0', '#1c1c1c', '#5a3a22', '#b5503d', '#c9a43d', '#3d6fb5'];
  const OPTS = {
    survivor: [
      { k: 'skin', label: 'PELE', n: SKIN.length, color: SKIN },
      { k: 'hair', label: 'CABELO', n: 8, names: ['CURTO', 'LONGO', 'RABO', 'MOICANO', 'CACHOS', 'COQUE', 'RASPADO', 'RASPADO'] },
      { k: 'hairC', label: 'COR CABELO', n: HAIRC.length, color: HAIRC },
      { k: 'top', label: 'ROUPA', n: 4, names: ['CAMISETA', 'JAQUETA', 'MOLETOM', 'COLETE'] },
      { k: 'topC', label: 'COR ROUPA', n: CLOTH.length, color: CLOTH },
      { k: 'pants', label: 'CALÇA', n: 3, names: ['JEANS', 'SHORTS', 'CARGO'] },
      { k: 'pantsC', label: 'COR CALÇA', n: PANTS.length, color: PANTS },
      { k: 'shoes', label: 'CALÇADO', n: 2, names: ['TÊNIS', 'BOTA'] },
      { k: 'shoesC', label: 'COR CALÇADO', n: SHOES.length, color: SHOES },
      { k: 'hat', label: 'CHAPÉU', n: 4, names: ['NENHUM', 'BONÉ', 'TOUCA', 'CAPUZ'] },
      { k: 'hatC', label: 'COR CHAPÉU', n: CLOTH.length, color: CLOTH },
      { k: 'glasses', label: 'ÓCULOS', n: 3, names: ['NÃO', 'REDONDO', 'ESCURO'] },
      { k: 'pack', label: 'MOCHILA', n: 2, names: ['NÃO', 'SIM'] },
      { k: 'scarf', label: 'CACHECOL', n: 2, names: ['NÃO', 'SIM'] },
      { k: 'build', label: 'PORTE', n: 3, names: ['MAGRO', 'MÉDIO', 'FORTE'] },
      { k: 'height', label: 'ALTURA', n: 3, names: ['BAIXO', 'MÉDIA', 'ALTO'] }
    ],
    killer: [
      { k: 'skin', label: 'PELE', n: SKIN.length, color: SKIN },
      { k: 'mask', label: 'MÁSCARA', n: 4, names: ['LISA', 'CAVEIRA', 'SORRISO', 'SACO'] },
      { k: 'maskC', label: 'COR MÁSCARA', n: 4, color: ['#d9d4c4', '#b8b8c0', '#c9a43d', '#8a6a42'] },
      { k: 'coat', label: 'CASACO', n: 3, names: ['LONGO', 'CURTO', 'AVENTAL'] },
      { k: 'coatC', label: 'COR CASACO', n: CLOTH.length, color: CLOTH },
      { k: 'hood', label: 'CAPUZ', n: 2, names: ['SIM', 'NÃO'] },
      { k: 'hairC', label: 'COR CABELO', n: HAIRC.length, color: HAIRC },
      { k: 'weapon', label: 'ARMA', n: 3, names: ['FACÃO', 'MACHADO', 'CANO'] },
      { k: 'pantsC', label: 'COR CALÇA', n: PANTS.length, color: PANTS },
      { k: 'build', label: 'PORTE', n: 3, names: ['MÉDIO', 'FORTE', 'GIGANTE'] }
    ]
  };

  function defaultGenome(role, id) {
    id = id || 0;
    if (role === 'killer') return { role: 'killer', seed: 7, skin: 5, mask: 0, maskC: 0, coat: 0, coatC: 5, hood: 0, hairC: 1, weapon: 0, pantsC: 6, build: 1 };
    const P = [
      { skin: 0, hair: 0, hairC: 1, top: 1, topC: 0, pants: 0, pantsC: 0, shoes: 0, shoesC: 0, hat: 0, hatC: 1, glasses: 0, pack: 0, scarf: 0, build: 1, height: 1 },
      { skin: 2, hair: 1, hairC: 0, top: 2, topC: 1, pants: 0, pantsC: 1, shoes: 1, shoesC: 1, hat: 0, hatC: 1, glasses: 0, pack: 1, scarf: 0, build: 1, height: 1 },
      { skin: 1, hair: 3, hairC: 4, top: 0, topC: 2, pants: 1, pantsC: 2, shoes: 0, shoesC: 3, hat: 1, hatC: 7, glasses: 2, pack: 0, scarf: 0, build: 0, height: 1 },
      { skin: 3, hair: 4, hairC: 0, top: 3, topC: 3, pants: 2, pantsC: 3, shoes: 1, shoesC: 2, hat: 0, hatC: 1, glasses: 1, pack: 0, scarf: 1, build: 2, height: 2 }
    ];
    return Object.assign({ role: 'survivor', seed: id }, P[id % 4]);
  }
  function randomGenome(role, seed) {
    const r = mulberry((seed | 0) * 2654435761 + 12345), g = { role, seed: seed | 0 };
    for (const o of OPTS[role]) {
      let v = Math.floor(r() * o.n);
      if (o.k === 'hat' && r() < 0.45) v = 0;
      if (o.k === 'glasses' && r() < 0.5) v = 0;
      if (o.k === 'pack' && r() < 0.5) v = 0;
      if (o.k === 'scarf' && r() < 0.65) v = 0;
      g[o.k] = v;
    }
    return g;
  }
  function normalize(g) {
    const base = defaultGenome(g.role === 'killer' ? 'killer' : 'survivor', g.seed || 0), out = Object.assign({}, base, g);
    for (const o of OPTS[out.role]) out[o.k] = ((out[o.k] | 0) % o.n + o.n) % o.n;
    return out;
  }
  function key(g) { return OPTS[g.role].map((o) => g[o.k]).join('.') + (g.role === 'killer' ? 'K' : 'S'); }

  // ---------- esqueleto e poses ----------
  // Unidades do modelo: ~20 de altura (1 unidade = 1 px a 16 px por tile). x = direita do boneco, y = cima, z = frente.
  // Pose: lean (inclinação do tronco p/ frente), twist, rootY/rootX/rootZ, head{p,y,r}, a{l,r}:{sw,ab,el}, l{l,r}:{sw,ab,kn}, drop (agachar), flags.
  const EASE = (t) => t * t * (3 - 2 * t);
  const SIN = Math.sin, COS = Math.cos, PI = Math.PI;
  const P0 = () => ({ rootY: 0, rootX: 0, rootZ: 0, lean: 0, twist: 0, roll: 0, head: { p: 0, y: 0, r: 0 }, aL: { sw: 0, ab: 0.12, el: 0 }, aR: { sw: 0, ab: 0.12, el: 0 }, lL: { sw: 0, ab: 0, kn: 0 }, lR: { sw: 0, ab: 0, kn: 0 }, eyes: 1, held: null, blood: 0, glow: 0, swing: null });
  function cyc(t) { return t * 2 * PI; }

  const ANIMS = {
    survivor: {
      parado: { frames: 4, fps: 3, loop: true, f(t) { const p = P0(), b = SIN(cyc(t)); p.rootY = b * 0.25; p.aL.sw = b * 0.05; p.aR.sw = -b * 0.05; p.head.p = b * 0.04; return p; } },
      andar: { frames: 6, fps: 9, loop: true, f(t) { const p = gait(t, 0.62, 0.45, 0.35, 0.18); p.aL.ab = p.aR.ab = 0.22; return p; } },
      correr: { frames: 6, fps: 12, loop: true, f(t) { const p = gait(t, 1.0, 1.15, 0.55, 0.32); p.lean = 0.22; p.aL.el = 1.1; p.aR.el = 1.1; return p; } },
      pular_andando: { frames: 5, fps: 8, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.rootY = a * 3.2 + 0; p.lean = 0.2 * a; p.lL.sw = -0.9 * a; p.lL.kn = 1.1 * a; p.lR.sw = 0.5 * a; p.lR.kn = 0.9 * a; p.aL.sw = -0.8 * a; p.aR.sw = -0.8 * a; p.aL.ab = 0.2; p.aR.ab = 0.2; return p; } },
      pular_correndo: { frames: 5, fps: 10, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.rootY = a * 4.4; p.lean = 0.3 + 0.1 * a; p.lL.sw = -1.2 * a; p.lL.kn = 1.3 * a; p.lR.sw = 0.9 * a; p.lR.kn = 1.0 * a; p.aL.sw = 0.9 * a; p.aR.sw = -1.0 * a; p.aL.el = 0.8; p.aR.el = 0.8; return p; } },
      atravessar: { frames: 5, fps: 10, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.rootY = a * 4.8; p.lean = 0.35 * a; p.lL.sw = -1.0 * a; p.lL.kn = 1.5 * a; p.lR.sw = -1.0 * a; p.lR.kn = 1.5 * a; p.aL.sw = 2.7 * a; p.aR.sw = 2.7 * a; p.aL.ab = 0.35; p.aR.ab = 0.35; p.eyes = a > 0.4 ? 0 : 1; return p; } },
      tropecar: { frames: 5, fps: 8, loop: false, f(t) { const a = EASE(Math.min(1, t * 1.4)), p = P0(); p.lean = 0.9 * a; p.rootY = -2.4 * a; p.rootZ = 1.6 * a; p.aL.sw = 2.3 * a; p.aR.sw = 2.5 * a; p.aL.ab = 0.5; p.aR.ab = 0.5; p.lL.sw = -0.7 * a; p.lL.kn = 0.9 * a; p.lR.sw = 0.5 * a; p.head.p = -0.5 * a; p.eyes = 0; return p; } },
      ferido: { frames: 4, fps: 5, loop: true, f(t) { const p = P0(), b = SIN(cyc(t)); p.lean = 0.28; p.rootY = -0.5 + b * 0.2; p.head.p = 0.25; p.aL.sw = 0.3; p.aR.sw = 0.5; p.aR.el = 1.4; p.blood = 1; p.lL.kn = 0.2; return p; } },
      consertar: { frames: 6, fps: 8, loop: true, f(t) { const p = P0(), b = SIN(cyc(t)); p.lean = 0.35; p.rootY = -1.6; p.lL.sw = -0.9; p.lL.kn = 1.3; p.lR.sw = -0.9; p.lR.kn = 1.3; p.lL.ab = 0.12; p.lR.ab = -0.12; p.aR.sw = 1.0 + b * 0.6; p.aR.el = 1.0; p.aL.sw = 0.8 - b * 0.4; p.aL.el = 0.9; p.head.p = 0.2; p.held = 'chave'; return p; } },
      carregar: { frames: 6, fps: 9, loop: true, f(t) { const p = gait(t, 0.55, 0.0, 0.28, 0.0); p.aL.sw = 1.1; p.aR.sw = 1.1; p.aL.el = 1.0; p.aR.el = 1.0; p.aL.ab = -0.1; p.aR.ab = -0.1; p.lean = -0.08; p.held = 'peca'; return p; } },
      pegar: { frames: 4, fps: 8, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.lean = 0.55 * a; p.rootY = -2 * a; p.lL.sw = -0.8 * a; p.lL.kn = 1.2 * a; p.lR.sw = -0.8 * a; p.lR.kn = 1.2 * a; p.aR.sw = 1.2 * a; p.aL.sw = 0.5 * a; p.head.p = 0.3 * a; return p; } },
      esconder: { frames: 4, fps: 6, loop: false, f(t) { const a = EASE(t), p = P0(); p.rootY = -1.2 * a; p.lean = 0.2 * a; p.aL.sw = 0.7 * a; p.aR.sw = 0.7 * a; p.aL.el = 1.2 * a; p.aR.el = 1.2 * a; p.lL.kn = 0.5 * a; p.lR.kn = 0.5 * a; p.lL.sw = -0.3 * a; p.lR.sw = -0.3 * a; p.head.p = 0.3 * a; return p; } },
      reagir: { frames: 4, fps: 10, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.lean = -0.4 * a; p.rootZ = -1.2 * a; p.head.p = -0.4 * a; p.aL.sw = -0.9 * a; p.aR.sw = -0.7 * a; p.aL.ab = 0.8 * a + 0.12; p.aR.ab = 0.8 * a + 0.12; p.eyes = 0; p.blood = 1; p.lL.sw = 0.4 * a; return p; } },
      comemorar: { frames: 6, fps: 8, loop: true, f(t) { const b = Math.abs(SIN(cyc(t) / 2)), p = P0(); p.rootY = b * 1.8; p.aL.sw = 2.9; p.aR.sw = 2.9; p.aL.ab = 0.45 + b * 0.2; p.aR.ab = 0.45 + b * 0.2; p.lL.kn = b * 0.5; p.lR.kn = b * 0.5; p.head.p = -0.2; return p; } }
    },
    killer: {
      parado: { frames: 4, fps: 3, loop: true, f(t) { const p = P0(), b = SIN(cyc(t)); p.rootY = b * 0.2; p.lean = 0.12; p.aL.sw = 0.08 + b * 0.04; p.aR.sw = 0.1; p.head.p = 0.18; p.held = 'arma'; return p; } },
      andar: { frames: 6, fps: 7, loop: true, f(t) { const p = gait(t, 0.5, 0.55, 0.3, 0.12); p.lean = 0.16; p.aL.el = 0.2; p.aR.sw *= 0.3; p.aR.el = 0.5; p.held = 'arma'; return p; } },
      perseguir: { frames: 6, fps: 11, loop: true, f(t) { const p = gait(t, 0.95, 1.0, 0.5, 0.3); p.lean = 0.3; p.aR.sw = -0.4; p.aR.el = 0.8; p.glow = 1; p.held = 'arma'; return p; } },
      preparar: { frames: 4, fps: 8, loop: false, f(t) { const a = EASE(t), p = P0(); p.lean = -0.15 * a; p.twist = -0.5 * a; p.aR.sw = 2.5 * a; p.aR.ab = 0.6 * a; p.aR.el = 0.7 * a; p.aL.sw = 0.5 * a; p.lL.sw = 0.5 * a; p.lR.sw = -0.4 * a; p.glow = 1; p.held = 'arma'; p.swing = -2 * a; return p; } },
      golpe: { frames: 4, fps: 14, loop: false, f(t) { const a = EASE(t), p = P0(); p.lean = 0.5 * a; p.twist = 0.7 * a - 0.2; p.rootZ = 1.6 * a; p.aR.sw = 2.5 - 3.4 * a; p.aR.ab = 0.5 - 0.5 * a; p.aL.sw = -0.4 * a; p.lL.sw = -0.9 * a; p.lL.kn = 0.5 * a; p.lR.sw = 0.7 * a; p.glow = 1; p.held = 'arma'; p.swing = -2 + 3 * a; return p; } },
      recuperar: { frames: 4, fps: 6, loop: false, f(t) { const a = 1 - EASE(t), p = P0(); p.lean = 0.45 * a + 0.1; p.aR.sw = -0.9 * a; p.aL.sw = 0.3; p.head.p = 0.2; p.held = 'arma'; p.swing = 0.9 * a; return p; } },
      atordoado: { frames: 4, fps: 6, loop: true, f(t) { const p = P0(), b = SIN(cyc(t)); p.roll = b * 0.14; p.lean = 0.28; p.head.p = 0.4; p.head.r = b * 0.2; p.aL.sw = 0.2; p.aR.sw = 0.2; p.aR.el = 0.4; p.eyes = 0; p.held = 'arma'; p.swing = 1.2; return p; } },
      cambalear: { frames: 6, fps: 9, loop: true, f(t) { const p = gait(t, 0.4, 0.2, 0.3, 0.2), b = SIN(cyc(t)); p.roll = b * 0.2; p.lean = 0.25; p.aL.sw = 1.1; p.aR.sw = -0.6; p.eyes = 0; p.held = 'arma'; p.swing = 0.8; return p; } },
      quebrar: { frames: 6, fps: 10, loop: true, f(t) { const a = Math.abs(SIN(cyc(t) / 2)), p = P0(); p.lean = 0.3 * a; p.aR.sw = 2.7 - 3.2 * a; p.aL.sw = 0.6 * a; p.lL.sw = 0.3; p.lR.sw = -0.3; p.glow = 1; p.held = 'arma'; p.swing = -1.8 + 3 * a; return p; } },
      sabotar: { frames: 6, fps: 8, loop: true, f(t) { const b = SIN(cyc(t)), p = P0(); p.lean = 0.4; p.rootY = -1.2; p.lL.sw = -0.8; p.lL.kn = 1.1; p.lR.sw = -0.4; p.lR.kn = 0.8; p.aR.sw = 1.1 + b * 0.7; p.aR.el = 0.8; p.aL.sw = 0.9; p.head.p = 0.3; p.held = 'arma'; p.swing = 1.0; return p; } },
      armario: { frames: 4, fps: 8, loop: false, f(t) { const a = SIN(t * PI), p = P0(); p.lean = 0.1; p.aL.sw = 1.4 * a; p.aR.sw = 0.2; p.aL.el = 0.2; p.head.p = 0.15; p.held = 'arma'; return p; } }
    }
  };
  // marcha com contra-balanço de braços/pernas. amp: amplitude da perna; arm: da braço; kn: dobra do joelho; bob: quique
  function gait(t, amp, arm, kn, bob) {
    const p = P0(), ph = cyc(t), s = SIN(ph);
    p.lL.sw = s * amp; p.lR.sw = -s * amp;
    p.lL.kn = Math.max(0, SIN(ph + PI * 0.5)) * kn * 1.6; p.lR.kn = Math.max(0, SIN(ph + PI * 1.5)) * kn * 1.6;
    p.aL.sw = -s * arm; p.aR.sw = s * arm;
    p.rootY = -Math.abs(COS(ph)) * bob * 2 + bob * 0.9;
    p.twist = s * 0.08 * (amp > 0.8 ? 1.4 : 1);
    p.aL.el = Math.max(0, s) * 0.6 * (arm > 0.8 ? 1.2 : 0.4); p.aR.el = Math.max(0, -s) * 0.6 * (arm > 0.8 ? 1.2 : 0.4);
    return p;
  }

  // ---------- vetores e matrizes 3x3 ----------
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    nrm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  };
  const rotX = (a) => [[1, 0, 0], [0, COS(a), -SIN(a)], [0, SIN(a), COS(a)]];
  const rotY = (a) => [[COS(a), 0, SIN(a)], [0, 1, 0], [-SIN(a), 0, COS(a)]];
  const rotZ = (a) => [[COS(a), -SIN(a), 0], [SIN(a), COS(a), 0], [0, 0, 1]];
  function mm(A, B) { const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]; return C; }
  const mv = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
  const tr = (A) => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];

  // ---------- câmera: vista de cima inclinada ----------
  const TILT = 0.2;   // ~11 graus: quase de frente, o rosto fica legível (o jogo é 3/4, mas sprites de 16 px pedem rosto grande)
  const CT = COS(TILT), ST = SIN(TILT);
  // mundo -> vista: vx = x ; vu = y*CT - z*ST (cima) ; vw = y*ST + z*CT (profundidade, maior = mais perto)
  const VIEW = [[1, 0, 0], [0, CT, -ST], [0, ST, CT]];
  const LIGHT = V.nrm([-0.55, 0.62, 0.55]);   // em coordenadas de vista (x, cima, perto)

  // ---------- primitivas ----------
  // Cada primitiva já está em coordenadas de vista (x, u=cima, w=perto). part: id de peça (p/ contorno e decalques); mat: índice de material.
  // elip: centro c, matriz M (forma quadrática inversa) -> ray-cast em w
  function mkEllip(c, R, rad, mat, part) {
    // R: rotação local->mundo (já com a vista aplicada); rad: raios locais. M = R * diag(1/r^2) * R^T
    const D = [[1 / (rad[0] * rad[0]), 0, 0], [0, 1 / (rad[1] * rad[1]), 0], [0, 0, 1 / (rad[2] * rad[2])]];
    const M = mm(mm(R, D), tr(R));
    // meia-extensão em x e u (projeção): sqrt dos elementos da matriz de covariância R diag(r^2) R^T
    const cov = (i) => Math.sqrt(R[i][0] * R[i][0] * rad[0] * rad[0] + R[i][1] * R[i][1] * rad[1] * rad[1] + R[i][2] * R[i][2] * rad[2] * rad[2]);
    return { t: 'e', c, M, ex: cov(0), eu: cov(1), mat, part };
  }
  function mkSphere(c, r, mat, part) {
    return { t: 's', c, r, ex: r, eu: r, mat, part };
  }
  // caixa orientada: centro, R local->vista, semi-lados h, borda arredondada rr (chanfro visual)
  function mkBox(c, R, h, mat, part) {
    const ex = Math.abs(R[0][0]) * h[0] + Math.abs(R[0][1]) * h[1] + Math.abs(R[0][2]) * h[2];
    const eu = Math.abs(R[1][0]) * h[0] + Math.abs(R[1][1]) * h[1] + Math.abs(R[1][2]) * h[2];
    return { t: 'b', c, R, Rt: tr(R), h, ex, eu, mat, part };
  }
  // ---------- rasterização ----------
  // Retorna {w,h,rgba,depth,part,ax,ay}. Âncora = pés no centro do chão (ax, ay).
  function rasterize(prims, W, H, ox, oy, ppu, palette) {
    const N = W * H, zb = new Float32Array(N).fill(-1e9), shade = new Uint8Array(N), matb = new Int16Array(N).fill(-1), partb = new Int16Array(N).fill(-1);
    const nxb = new Float32Array(N), nyb = new Float32Array(N), nzb = new Float32Array(N);
    for (const p of prims) {
      const x0 = Math.max(0, Math.floor(ox + (p.c[0] - p.ex) * ppu)), x1 = Math.min(W - 1, Math.ceil(ox + (p.c[0] + p.ex) * ppu));
      const y0 = Math.max(0, Math.floor(oy - (p.c[1] + p.eu) * ppu)), y1 = Math.min(H - 1, Math.ceil(oy - (p.c[1] - p.eu) * ppu));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - ox) / ppu - p.c[0], du = -(y + 0.5 - oy) / ppu - p.c[1];
        let dz, nx, ny, nz;
        if (p.t === 's') {
          const q = p.r * p.r - dx * dx - du * du; if (q <= 0) continue;
          dz = Math.sqrt(q); nx = dx / p.r; ny = du / p.r; nz = dz / p.r;
        } else if (p.t === 'e') {
          const M = p.M, a = M[2][2], b = M[0][2] * dx + M[1][2] * du, c0 = M[0][0] * dx * dx + 2 * M[0][1] * dx * du + M[1][1] * du * du - 1;
          const disc = b * b - a * c0; if (disc <= 0) continue;
          dz = (-b + Math.sqrt(disc)) / a;
          nx = M[0][0] * dx + M[0][1] * du + M[0][2] * dz; ny = M[1][0] * dx + M[1][1] * du + M[1][2] * dz; nz = M[2][0] * dx + M[2][1] * du + M[2][2] * dz;
          const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        } else {
          // raio (dx, du, t) em coordenadas de vista, direção (0,0,1) -> local
          const Rt = p.Rt, o = [Rt[0][0] * dx + Rt[0][1] * du, Rt[1][0] * dx + Rt[1][1] * du, Rt[2][0] * dx + Rt[2][1] * du], d = [Rt[0][2], Rt[1][2], Rt[2][2]];
          let t0 = -1e9, t1 = 1e9, ok = true;
          for (let i = 0; i < 3; i++) {
            if (Math.abs(d[i]) < 1e-7) { if (Math.abs(o[i]) > p.h[i]) { ok = false; break; } continue; }
            let ta = (-p.h[i] - o[i]) / d[i], tb = (p.h[i] - o[i]) / d[i];
            if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
            if (ta > t0) t0 = ta;
            if (tb < t1) t1 = tb;
            if (t0 > t1) { ok = false; break; }
          }
          if (!ok) continue;
          dz = t1;                                      // face mais próxima da câmera = maior w (saída do raio)
          let ax2 = -1, sg2 = 1;
          for (let i = 0; i < 3; i++) {
            if (Math.abs(d[i]) < 1e-7) continue;
            const tb = ((d[i] > 0 ? p.h[i] : -p.h[i]) - o[i]) / d[i];
            if (Math.abs(tb - t1) < 1e-6) { ax2 = i; sg2 = d[i] > 0 ? 1 : -1; }
          }
          if (ax2 < 0) continue;
          nx = p.R[0][ax2] * sg2; ny = p.R[1][ax2] * sg2; nz = p.R[2][ax2] * sg2;
          // suaviza as bordas (chanfro de 0,5): mistura a normal perto da quina
          let edge = 0;
          for (let i = 0; i < 3; i++) if (i !== ax2) { const e = p.h[i] - Math.abs(o[i] + d[i] * t1); if (e < 0.55) edge = Math.max(edge, (0.55 - e) / 0.55); }
          if (edge > 0) { const k2 = edge * 0.7; for (let i = 0; i < 3; i++) if (i !== ax2) { const s2 = (o[i] + d[i] * t1) >= 0 ? 1 : -1; const w = k2 * Math.max(0, (0.55 - (p.h[i] - Math.abs(o[i] + d[i] * t1))) / 0.55); nx += p.R[0][i] * s2 * w; ny += p.R[1][i] * s2 * w; nz += p.R[2][i] * s2 * w; } const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
        }
        const wv = p.c[2] + dz, i = y * W + x;
        if (wv <= zb[i]) continue;
        zb[i] = wv; matb[i] = p.mat; partb[i] = p.part; nxb[i] = nx; nyb[i] = ny; nzb[i] = nz;
        const lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        shade[i] = lam < -0.3 ? 0 : lam < 0.1 ? 1 : lam < 0.72 ? 2 : 3;
      }
    }
    return { W, H, zb, shade, mat: matb, part: partb, nx: nxb, ny: nyb, nz: nzb, ox, oy, ppu };
  }
  // converte buffers em RGBA com contorno
  function resolve(B, palette, opts) {
    const { W, H } = B, rgba = new Uint8ClampedArray(W * H * 4), N = W * H;
    const col = (i) => { const r = palette[B.mat[i]]; return r.ramp[B.shade[i]]; };
    for (let i = 0; i < N; i++) {
      if (B.mat[i] < 0) continue;
      const pal = palette[B.mat[i]];
      if (pal.flat) { const c = pal.flat; rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255; continue; }
      const c = col(i); rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
    }
    // contorno interno: onde a vizinhança é bem mais próxima da câmera e de outra peça, escurece o pixel que está atrás
    const thr = opts.contourDepth;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (B.mat[i] < 0) continue;
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (B.mat[j] < 0) continue;
        if (B.part[j] !== B.part[i] && B.zb[j] - B.zb[i] > thr) near = true;
      }
      if (near) { const c = palette[B.mat[i]].ramp[0]; rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; }
    }
    // contorno externo: pixels vazios ao lado do sprite
    const out = new Uint8ClampedArray(rgba);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (B.mat[i] >= 0) continue;
      let best = -1, bz = -1e9;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (B.mat[j] >= 0 && B.zb[j] > bz) { bz = B.zb[j]; best = j; }
      }
      if (best >= 0) {
        const pal = palette[B.mat[best]], c = pal.outline || pal.ramp[opts.outlineRamp === undefined ? 0 : opts.outlineRamp], k = opts.outlineK || 1;
        out[i * 4] = Math.round(c[0] * k); out[i * 4 + 1] = Math.round(c[1] * k); out[i * 4 + 2] = Math.round(c[2] * k * 1.05); out[i * 4 + 3] = 255;
      }
    }
    return out;
  }

  // ---------- montagem do corpo ----------
  const M = { SKIN: 0, HAIR: 1, TOP: 2, TOP2: 3, PANTS: 4, SHOE: 5, HAT: 6, EXTRA: 7, METAL: 8, DARK: 9, MASK: 10, EYE: 11, BLOOD: 12, WOOD: 13, COAT2: 14, SOLE: 15, WHITE: 16 };
  function buildPalette(g) {
    const p = [];
    if (g.role === 'killer') {
      p[M.SKIN] = { ramp: ramp(SKIN[g.skin]) };
      p[M.HAIR] = { ramp: ramp(HAIRC[g.hairC]) };
      p[M.TOP] = { ramp: ramp(CLOTH[g.coatC]) }; p[M.TOP2] = { ramp: ramp(shade(CLOTH[g.coatC], -0.07)) };
      p[M.PANTS] = { ramp: ramp(PANTS[g.pantsC]) };
      p[M.SHOE] = { ramp: ramp('#17171d') };
      p[M.HAT] = { ramp: ramp(shade(CLOTH[g.coatC], -0.04)) };
      p[M.MASK] = { ramp: ramp(['#d9d4c4', '#b8b8c0', '#c9a43d', '#8a6a42'][g.maskC]) };
    } else {
      p[M.SKIN] = { ramp: ramp(SKIN[g.skin]) };
      p[M.HAIR] = { ramp: ramp(HAIRC[g.hairC]) };
      p[M.TOP] = { ramp: ramp(CLOTH[g.topC]) }; p[M.TOP2] = { ramp: ramp(shade(CLOTH[g.topC], -0.1)) };
      p[M.PANTS] = { ramp: ramp(PANTS[g.pantsC]) };
      p[M.SHOE] = { ramp: ramp(SHOES[g.shoesC]) };
      p[M.HAT] = { ramp: ramp(CLOTH[g.hatC]) };
      p[M.MASK] = p[M.SKIN];
    }
    p[M.EXTRA] = { ramp: ramp('#6b5a3a') };
    p[M.METAL] = { ramp: ramp('#c9ced6') };
    p[M.DARK] = { ramp: ramp('#2a2a34') };
    p[M.EYE] = { flat: hex('#1a1a1a'), ramp: ramp('#1a1a1a') };
    p[M.BLOOD] = { ramp: ramp('#a02a2a') };
    p[M.WOOD] = { ramp: ramp('#7a4a22') };
    p[M.COAT2] = { ramp: ramp(g.role === 'killer' ? shade(CLOTH[g.coatC], -0.12) : '#2a2a34') };
    p[M.SOLE] = { ramp: ramp('#e9e6f0') };
    p[M.WHITE] = { ramp: ramp('#f4f1e8') };
    return p;
  }
  function shade(c, dl) { const [r, g, b] = hex(c), [h, s, l] = rgb2hsl(r, g, b), o = hsl2rgb(h, s, l + dl); return '#' + o.map((v) => ('0' + v.toString(16)).slice(-2)).join(''); }

  // dimensões por gene
  function dims(g) {
    const k = g.role === 'killer';
    const bw = k ? [1.12, 1.28, 1.45][g.build] : [0.95, 1.08, 1.22][g.build];
    const ht = k ? [1.12, 1.2, 1.32][g.build] : [0.92, 1.0, 1.1][g.height];
    return { bw, ht, legL: 7.0 * ht, torsoH: 6.4 * (k ? ht : (0.96 + 0.04 * ht)), headR: k ? 3.0 : 3.1 * (g.build === 2 ? 1.0 : 1.0), shW: 3.3 * bw, hipW: 1.65 * bw };
  }

  // monta as primitivas da pose para uma direção (yaw em rad: 0 = de frente para a câmera, PI/2 = virado para a direita da tela)
  function buildPrims(g, pose, yaw) {
    const D = dims(g), prims = [], kill = g.role === 'killer';
    const Rbody = mm(VIEW, rotY(yaw));              // local -> vista
    const T = (v, R) => V.add([0, 0, 0], mv(R || Rbody, v));    // vetor local -> vista
    let part = 0, low = 1e9;
    const P = () => part++;

    // raiz: pélvis
    const pelvisL = [pose.rootX, D.legL + pose.rootY, pose.rootZ];
    // tronco: rotação de inclinação (x) + torção (y) + rolagem (z) sobre a pélvis
    const RT = mm(Rbody, mm(rotZ(pose.roll), mm(rotX(pose.lean), rotY(pose.twist))));
    const chestL = V.add(pelvisL, mv(mm(rotZ(pose.roll), mm(rotX(pose.lean), rotY(pose.twist))), [0, D.torsoH * 0.5, 0]));
    const topL = V.add(pelvisL, mv(mm(rotZ(pose.roll), mm(rotX(pose.lean), rotY(pose.twist))), [0, D.torsoH, 0]));
    const Rt = mm(rotZ(pose.roll), mm(rotX(pose.lean), rotY(pose.twist)));   // local->local do tronco
    const toV = (loc) => mv(Rbody, loc);
    const chestV = toV(chestL), topV = toV(topL), pelvV = toV(pelvisL);
    const shirt = M.TOP, longSleeve = kill || g.top >= 1 && g.top !== 3, torsoMat = M.TOP;
    const bodyD = (kill ? 2.4 : 2.1) * (0.9 + 0.1 * D.bw);

    // pernas
    const legs = [[-1, pose.lL], [1, pose.lR]];
    for (const [side, L] of legs) {
      const hip = V.add(pelvisL, mv(mm(rotZ(pose.roll), rotY(pose.twist * 0.0)), [side * D.hipW, 0, 0]));
      const th = D.legL * 0.52, sh = D.legL * 0.48;
      const Rthigh = mm(rotX(L.sw), rotZ(-side * (L.ab)));
      const knee = V.add(hip, mv(Rthigh, [0, -th, 0]));
      const Rshin = mm(Rthigh, rotX(-L.kn));
      const ankle = V.add(knee, mv(Rshin, [0, -sh, 0]));
      if (ankle[1] < low) low = ankle[1];
      const pm = g.role === 'survivor' && g.pants === 1 ? M.SKIN : M.PANTS;
      const rt = (kill ? 1.55 : 1.35) * D.bw, rs = (kill ? 1.35 : 1.15) * D.bw;
      chain(prims, toV(hip), toV(knee), rt, rt * 0.92, M.PANTS, P());
      chain(prims, toV(knee), toV(ankle), rs, rs * 0.9, pm === M.SKIN && !kill ? M.SKIN : M.PANTS, P());
      if (pm === M.SKIN) { chain(prims, toV(knee), toV(ankle), rs * 0.95, rs * 0.9, M.SKIN, P()); }
      // sapato: caixa alongada para frente
      const boot = (g.role === 'survivor' && g.shoes === 1) || kill;
      const Rfoot = mm(Rbody, mm(rotX(L.sw * 0.4 - L.kn * 0.4), rotY(0)));
      const fc = V.add(toV(ankle), mv(Rfoot, [0, -0.4, 0.8]));
      prims.push(mkBox(fc, Rfoot, [rs * 0.9 * 0.9, boot ? 1.1 : 0.85, 2.0], M.SHOE, P()));
      if (!boot && !kill) prims.push(mkBox(V.add(fc, mv(Rfoot, [0, -0.7, 0.1])), Rfoot, [rs * 0.9 * 0.92, 0.3, 2.05], M.SOLE, P()));
      if (boot) { const kk = V.add(toV(ankle), mv(Rfoot, [0, 1.0, -0.2])); prims.push(mkEllip(kk, Rfoot, [rs * 1.05, 1.5, rs * 1.05], M.SHOE, P())); }
      if (!kill && g.pants === 2) { prims.push(mkEllip(V.add(toV(hip), mv(Rbody, [side * 0.3, -th * 0.8, 0.7])), Rbody, [rt * 0.55, 1.2, rt * 0.5], M.PANTS, P())); }   // bolso cargo
    }

    // casaco longo do assassino: cobre as coxas
    if (kill && g.coat !== 1) {
      const sk = V.add(pelvisL, mv(Rt, [0, g.coat === 2 ? -1.8 : -2.6, 0]));
      const sw = (pose.lL.sw - pose.lR.sw) * 0.0;
      void sw;
      prims.push(mkEllip(toV(sk), RT, [D.hipW + 1.7 * D.bw, g.coat === 2 ? 3.2 : 4.4, bodyD + 0.5], g.coat === 2 ? M.COAT2 : M.TOP, P()));
    }
    // tronco
    const trunk = P();
    if (kill) {
      prims.push(mkBox(chestV, RT, [D.shW * 0.72 + 0.2, D.torsoH * 0.5 + 0.3, bodyD + 0.1], M.TOP, trunk));
      prims.push(mkEllip(V.add(chestV, mv(RT, [0, D.torsoH * 0.5 - 0.4, 0])), RT, [D.shW * 0.9, 1.5, bodyD + 0.1], M.TOP, trunk));
    } else if (g.top === 3) {
      prims.push(mkBox(chestV, RT, [D.shW * 0.6, D.torsoH * 0.5, bodyD * 0.9], M.TOP2, trunk));
      prims.push(mkBox(V.add(chestV, mv(RT, [0, 0, 0.35])), RT, [D.shW * 0.58, D.torsoH * 0.49, bodyD * 0.95], M.TOP, P()));
    } else {
      prims.push(mkBox(chestV, RT, [D.shW * 0.62, D.torsoH * 0.5, bodyD * 0.92], M.TOP, trunk));
      if (g.top === 2) prims.push(mkEllip(V.add(chestV, mv(RT, [0, -D.torsoH * 0.28, 0.8])), RT, [D.shW * 0.45, 1.2, bodyD * 0.6], M.TOP2, P()));    // bolso canguru
      prims.push(mkBox(V.add(pelvV, mv(RT, [0, 0.6, 0])), RT, [D.hipW * 1.15, 0.9, bodyD * 0.85], M.PANTS, P()));
    }
    // cinto do assassino
    if (kill) prims.push(mkBox(V.add(pelvV, mv(RT, [0, 1.0, 0])), RT, [D.hipW * 1.4, 0.45, bodyD + 0.2], M.DARK, P()));
    if (!kill && g.top === 1) prims.push(mkBox(V.add(chestV, mv(RT, [0, 0, bodyD * 0.9 + 0.1])), RT, [0.35, D.torsoH * 0.46, 0.2], M.TOP2, P()));   // zíper
    // mochila
    if (!kill && g.pack) prims.push(mkBox(V.add(chestV, mv(RT, [0, -0.5, -bodyD - 1.1])), RT, [D.shW * 0.42, D.torsoH * 0.42, 1.3], M.EXTRA, P()));

    // pescoço e cabeça
    const neckL = V.add(topL, mv(Rt, [0, 0.6, 0.1]));
    const RH = mm(Rbody, mm(rotY(pose.head.y + pose.twist * 0.5), mm(rotX(pose.head.p + pose.lean * 0.5), rotZ(pose.head.r + pose.roll))));
    const headL = V.add(neckL, mv(mm(rotZ(pose.roll), mm(rotX(pose.lean * 0.3 + pose.head.p * 0.3), rotY(0))), [0, D.headR * 0.8, 0.0]));
    const headV = toV(headL);
    prims.push(mkEllip(V.add(toV(neckL), [0, -0.5, 0]), Rbody, [1.0, 0.9, 1.0], M.SKIN, P()));
    const headPart = P();
    prims.push(mkEllip(headV, RH, [D.headR * 0.97, D.headR, D.headR * 0.95], M.SKIN, headPart));
    // orelhas
    for (const side of [-1, 1]) prims.push(mkSphere(V.add(headV, mv(RH, [side * D.headR * 0.95, -0.2, 0])), 0.7, M.SKIN, headPart));

    // cabelo (elipsoides deslocadas p/ cima e para trás: a testa e o rosto aparecem à frente)
    const hairBase = (cx, cy, cz, rx, ry, rz, mat) => prims.push(mkEllip(V.add(headV, mv(RH, [cx, cy, cz])), RH, [rx, ry, rz], mat || M.HAIR, headPart));
    const hr = D.headR, hairId = kill ? -1 : g.hair;
    const hooded = kill ? g.hood === 0 : (g.hat === 3);
    if (!hooded && !(g.role === 'survivor' && g.hat === 2) && !kill) {
      if (hairId === 0) hairBase(0, 0.9, -0.55, hr * 1.04, hr * 0.92, hr * 1.02);
      else if (hairId === 1) { hairBase(0, 0.8, -0.5, hr * 1.06, hr * 0.95, hr * 1.04); hairBase(0, -2.0, -hr * 0.55, hr * 1.0, hr * 1.3, hr * 0.55); }
      else if (hairId === 2) { hairBase(0, 0.9, -0.55, hr * 1.04, hr * 0.92, hr * 1.02); chain(prims, V.add(headV, mv(RH, [0, 0.6, -hr * 0.9])), V.add(headV, mv(RH, [0, -2.8, -hr * 1.3])), 1.0, 0.7, M.HAIR, headPart); }
      else if (hairId === 3) { hairBase(0, 0.2, -0.3, hr * 0.98, hr * 0.9, hr * 0.98); hairBase(0, hr * 0.85, -0.3, 0.9, 1.4, hr * 1.0); }
      else if (hairId === 4) { hairBase(0, 1.0, -0.2, hr * 1.22, hr * 1.1, hr * 1.2); }
      else if (hairId === 5) { hairBase(0, 0.9, -0.55, hr * 1.04, hr * 0.92, hr * 1.02); prims.push(mkSphere(V.add(headV, mv(RH, [0, hr * 0.95, -hr * 0.55])), 1.5, M.HAIR, headPart)); }
      else hairBase(0, 0.55, -0.3, hr * 1.0, hr * 0.9, hr * 1.0);
    }
    if (kill && g.hood === 1) hairBase(0, 0.8, -0.5, hr * 1.04, hr * 0.92, hr * 1.02);
    // chapéus / capuz
    if (!kill) {
      if (g.hat === 1) { hairBase(0, 1.2, -0.1, hr * 1.06, hr * 0.78, hr * 1.06, M.HAT); prims.push(mkEllip(V.add(headV, mv(RH, [0, 0.55, hr * 0.85])), RH, [hr * 0.98, 0.35, 1.9], M.HAT, headPart)); }
      else if (g.hat === 2) { hairBase(0, 0.9, -0.1, hr * 1.1, hr * 1.05, hr * 1.1, M.HAT); prims.push(mkEllip(V.add(headV, mv(RH, [0, 0.0, 0.0])), RH, [hr * 1.12, 0.55, hr * 1.12], M.TOP2, headPart)); }
      else if (g.hat === 3) { hairBase(0, 0.4, -0.7, hr * 1.22, hr * 1.2, hr * 1.2, M.HAT); prims.push(mkEllip(toV(neckL), Rbody, [hr * 0.95, 1.1, hr * 0.8], M.HAT, P())); }
    }
    // assassino: capuz, máscara
    if (kill) {
      if (g.hood === 0) { hairBase(0, 0.6, -0.9, hr * 1.2, hr * 1.18, hr * 1.2, M.HAT); prims.push(mkEllip(toV(neckL), Rbody, [hr * 1.0, 1.4, hr * 0.85], M.HAT, P())); }
      prims.push(mkEllip(V.add(headV, mv(RH, [0, -0.2, hr * 0.62])), RH, [hr * 0.82, hr * 0.88, hr * 0.5], M.MASK, headPart));
    }
    // cachecol
    if (!kill && g.scarf) prims.push(mkEllip(toV(neckL), Rbody, [hr * 0.9, 1.0, hr * 0.78], M.TOP2, P()));

    // braços
    const arms = [[-1, pose.aL], [1, pose.aR]];
    const handPos = {};
    for (const [side, A] of arms) {
      const sh = V.add(topL, mv(Rt, [side * (D.shW * 0.62 + (kill ? 1.1 : 0.85)), -1.0, 0]));
      const ua = 4.0 * D.ht, fa = 3.8 * D.ht;
      const Ru = mm(Rt, mm(rotX(A.sw), rotZ(-side * A.ab)));
      const elbow = V.add(sh, mv(Ru, [0, -ua, 0]));
      const Rf = mm(Ru, rotX(A.el));
      const hand = V.add(elbow, mv(Rf, [0, -fa, 0]));
      const ru = (kill ? 1.2 : 0.95) * Math.sqrt(D.bw), rf = (kill ? 1.1 : 0.85) * Math.sqrt(D.bw);
      const sleeveFull = kill || g.top === 1 || g.top === 2;
      prims.push(mkSphere(toV(sh), ru * 1.1, kill ? M.TOP : M.TOP2, P()));
      chain(prims, toV(sh), toV(elbow), ru, ru * 0.9, kill ? M.TOP : M.TOP2, P());
      chain(prims, toV(elbow), toV(hand), rf, rf * 0.8, sleeveFull ? (kill ? M.TOP : M.TOP2) : M.SKIN, P());
      prims.push(mkSphere(toV(hand), kill ? 1.1 : 0.95, kill ? M.DARK : M.SKIN, P()));
      handPos[side] = { v: toV(hand), R: mm(Rbody, mm(Rt, mm(rotX(A.sw), mm(rotZ(-side * A.ab), rotX(A.el))))) };
    }
    // objetos nas mãos
    const hR = handPos[1], hL = handPos[-1];
    if (pose.held === 'chave') { prims.push(mkBox(V.add(hR.v, mv(hR.R, [0, -0.8, 0.7])), hR.R, [0.3, 0.3, 2.2], M.METAL, P())); prims.push(mkBox(V.add(hR.v, mv(hR.R, [0, -0.8, 2.6])), hR.R, [0.9, 0.6, 0.5], M.METAL, P())); }
    if (pose.held === 'peca') { const c = V.mul(V.add(hR.v, hL.v), 0.5); prims.push(mkBox(V.add(c, [0, 0.4, 0.4]), Rbody, [2.2, 1.5, 1.6], M.DARK, P())); prims.push(mkBox(V.add(c, [0, 1.5, 0.4]), Rbody, [1.6, 0.35, 1.2], M.METAL, P())); }
    if (kill && pose.held === 'arma') {
      const ang = pose.swing == null ? 0.6 : pose.swing;
      // a arma segue o antebraço, com um desvio de pulso "ang" no plano da mão
      const Rw = mm(hR.R, rotX(ang));
      const base = V.add(hR.v, mv(Rw, [0, -0.3, 0]));
      if (g.weapon === 0) {                    // facão
        chain(prims, base, V.add(base, mv(Rw, [0, -1.2, 0])), 0.55, 0.55, M.WOOD, P());
        prims.push(mkBox(V.add(base, mv(Rw, [0, -5.2, 0])), Rw, [0.28, 3.8, 0.9], M.METAL, P()));
      } else if (g.weapon === 1) {            // machado
        chain(prims, base, V.add(base, mv(Rw, [0, -6.0, 0])), 0.5, 0.5, M.WOOD, P());
        prims.push(mkBox(V.add(base, mv(Rw, [0, -5.4, 0.9])), Rw, [0.35, 1.3, 1.6], M.METAL, P()));
      } else {                                 // cano
        chain(prims, base, V.add(base, mv(Rw, [0, -7.2, 0])), 0.62, 0.62, M.DARK, P());
      }
    }
    return { prims, headV, RH, hr, headPart, hooded, D, low };
  }
  // cadeia de esferas: cápsula afunilada
  function chain(prims, a, b, ra, rb, mat, part) {
    const d = V.sub(b, a), L = V.len(d), n = Math.max(2, Math.ceil(L / (Math.min(ra, rb) * 0.45)));
    for (let i = 0; i <= n; i++) { const t = i / n; prims.push(mkSphere(V.add(a, V.mul(d, t)), ra + (rb - ra) * t, mat, part)); }
  }

  // ---------- decalques (rosto) ----------
  // Pontos em coordenadas locais da cabeça; só aparecem se a superfície estiver virada para a câmera.
  function faceDecals(B, built, g, pose, ppu, rgba, palette, extra) {
    const { headV, RH, hr, headPart } = built, kill = g.role === 'killer';
    const put = (loc, w, h, c, needFront) => {
      const v = V.add(headV, mv(RH, loc)), n = mv(RH, V.nrm(loc));
      if (n[2] < (needFront === undefined ? 0.15 : needFront)) return;
      const px = Math.round(B.ox + v[0] * ppu - w / 2 + 0.01), py = Math.round(B.oy - v[1] * ppu - h / 2 + 0.01);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const X = px + xx, Y = py + yy; if (X < 0 || Y < 0 || X >= B.W || Y >= B.H) continue;
        const i = Y * B.W + X; if (B.part[i] !== headPart) continue;
        rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
      }
    };
    const sx = hr * 0.42, ey = 0.1, ez = hr * 0.92;
    const big = ppu >= 1.5;
    const eyeC = pose.glow ? [255, 42, 42] : [26, 26, 26], dead = pose.eyes === 0;
    const ew = big ? 2 : 1, eh = big ? 3 : (kill ? 2 : 1);
    if (kill) {
      // máscara: olhos (fendas) e boca conforme o estilo
      const mk = g.mask;
      if (mk === 3) { put([-sx, ey, ez - 0.3], ew, eh, [20, 20, 20]); put([sx, ey, ez - 0.3], ew, eh, [20, 20, 20]); put([0, -hr * 0.45, ez - 0.2], big ? 4 : 2, 1, [60, 40, 20]); }
      else {
        const ec = dead ? [120, 120, 130] : eyeC;
        put([-sx, ey, ez], ew, eh, ec); put([sx, ey, ez], ew, eh, ec);
        if (mk === 1) { put([0, -hr * 0.1, ez], 1, 1, [40, 40, 44]); put([-hr * 0.3, -hr * 0.55, ez - 0.1], 1, 2, [40, 40, 44]); put([0, -hr * 0.55, ez - 0.1], 1, 2, [40, 40, 44]); put([hr * 0.3, -hr * 0.55, ez - 0.1], 1, 2, [40, 40, 44]); }
        else if (mk === 2) { put([-hr * 0.3, -hr * 0.5, ez - 0.1], 1, 1, [150, 30, 30]); put([0, -hr * 0.6, ez], big ? 3 : 1, 1, [150, 30, 30]); put([hr * 0.3, -hr * 0.5, ez - 0.1], 1, 1, [150, 30, 30]); }
        else put([0, -hr * 0.55, ez - 0.1], 1, 1, [60, 60, 66]);
      }
      return;
    }
    // sobrevivente: olhos, sobrancelha de dor, boca, óculos
    const ec = [26, 26, 26];
    if (dead) { put([-sx, ey, ez], ew + (big ? 0 : 0), 1, ec); put([sx, ey, ez], ew, 1, ec); }
    else {
      if (big) {   // 2x: olho com brilho
        put([-sx, ey + 0.1, ez], 2, 3, ec); put([sx, ey + 0.1, ez], 2, 3, ec);
        put([-sx, ey + 0.6, ez], 1, 1, [255, 255, 255]); put([sx, ey + 0.6, ez], 1, 1, [255, 255, 255]);
      } else { put([-sx, ey, ez], 1, 1, ec); put([sx, ey, ez], 1, 1, ec); }
    }
    if (g.glasses) {
      const gc = g.glasses === 2 ? [20, 20, 28] : [200, 205, 215];
      if (g.glasses === 2) { put([-sx, ey, ez + 0.1], big ? 3 : 2, big ? 2 : 1, gc); put([sx, ey, ez + 0.1], big ? 3 : 2, big ? 2 : 1, gc); put([0, ey, ez + 0.1], 1, 1, gc); }
      else { put([-sx, ey - 0.1, ez + 0.1], big ? 4 : 2, big ? 4 : 2, gc, 0.3); }
    }
    if (pose.blood) put([hr * 0.5, ey + 1.1, ez - 0.5], 1, big ? 3 : 2, [176, 42, 42]);
    if (pose.eyes === 0 && pose.blood) put([0, -hr * 0.5, ez - 0.1], big ? 3 : 2, 1, [90, 30, 30]);
    else if (!pose.blood) put([0, -hr * 0.52, ez - 0.2], big ? 2 : 1, 1, [150, 90, 80]);
  }

  // ---------- função principal: pixels de um quadro ----------
  // res: 16 (1 unidade = 1 px) ou 32 (1 unidade = 2 px). Retorna {w,h,rgba,ax,ay} (âncora = pés).
  const CELL = { 16: [40, 40], 32: [80, 80] };   // célula do sprite (largura, altura); os pés ficam 7 unidades acima da base
  function renderFrame(genome, anim, frame, yaw, res, opts) {
    opts = opts || {};
    const g = normalize(genome), set = ANIMS[g.role], A = set[anim] || set[Object.keys(set)[0]];
    const nF = A.frames, t = A.loop ? (frame % nF) / nF : Math.min(1, (frame % nF) / Math.max(1, nF - 1));
    const pose = A.f(t);
    if (opts.hurt) pose.blood = 1;
    const ppu = res / 16, [W, H] = CELL[res] || CELL[16];
    const ax = Math.floor(W / 2), ay = H - Math.round(7 * ppu);
    let built = buildPrims(g, pose, yaw);
    if (built.low < 0 && pose.rootY <= 0) { pose.rootY -= built.low; built = buildPrims(g, pose, yaw); }      // agachar não afunda os pés no chão
    const palette = buildPalette(g);
    const B = rasterize(built.prims, W, H, ax, ay, ppu, palette);
    // sombra no chão fica a cargo de quem desenha; aqui só o personagem
    const rgba = resolve(B, palette, { contourDepth: res >= 32 ? 1.2 : 99, outlineK: res >= 32 ? 0.7 : 0.85 });
    faceDecals(B, built, g, pose, ppu, rgba, palette);
    return { w: W, h: H, rgba, ax, ay, frames: nF };
  }

  // direções: nome -> yaw. Convenção do jogo: face em radianos de tela (0 = direita, PI/2 = baixo).
  const DIRS = [['baixo', 0], ['direita', PI / 2], ['cima', PI], ['esquerda', -PI / 2]];
  function yawFromFace(face) {
    // face (rad, tela) -> yaw 3D: baixo(PI/2)->0, direita(0)->PI/2, cima(-PI/2)->PI, esquerda(PI)->-PI/2
    const c = COS(face), s = SIN(face);
    return Math.abs(c) > Math.abs(s) ? (c > 0 ? PI / 2 : -PI / 2) : (s > 0 ? 0 : PI);
  }
  function dirIndex(face) { const c = COS(face), s = SIN(face); return Math.abs(c) > Math.abs(s) ? (c > 0 ? 1 : 3) : (s > 0 ? 0 : 2); }

  // ---------- ponte para canvas, cache, folhas ----------
  const cache = new Map(), imported = new Map();
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toCanvas(fr) { const c = mkCanvas(fr.w, fr.h), g = c.getContext('2d'); g.putImageData(new ImageData(fr.rgba, fr.w, fr.h), 0, 0); return c; }
  // sprite pronto para desenhar: {c, ax, ay}. Tem cache por genoma+pose+quadro+direção.
  function sprite(genome, anim, frame, dirI, res, opts) {
    res = res || 16;
    const g = normalize(genome), k = key(g) + '|' + anim + '|' + frame + '|' + dirI + '|' + res + '|' + (opts && opts.hurt ? 'h' : '');
    const imp = opts && opts.useImp && imported.get(g.role + '|' + anim + '|' + (frame % (ANIMS[g.role][anim] ? ANIMS[g.role][anim].frames : 1)) + '|' + dirI);
    if (imp) return imp;
    let s = cache.get(k);
    if (!s) {
      const fr = renderFrame(g, anim, frame, DIRS[dirI][1], res, opts);
      s = { c: toCanvas(fr), ax: fr.ax, ay: fr.ay, w: fr.w, h: fr.h };
      if (cache.size > 1500) cache.clear();
      cache.set(k, s);
    }
    return s;
  }

  // layout da folha: linhas = animação+quadro, colunas = 4 direções
  function layoutFor(role, names) {
    const set = ANIMS[role], rows = [];
    for (const n of names || Object.keys(set)) for (let f = 0; f < set[n].frames; f++) rows.push([n, f]);
    return rows;
  }
  // folha para exportar. Fundo magenta (#ff00ff) = transparente (opts.key=false: transparente de verdade). opts.scale amplia (inteiro).
  function exportSheet(genome, res, opts) {
    opts = opts || {};
    const g = normalize(genome), set = ANIMS[g.role], names = opts.anims || Object.keys(set);
    const [cw, ch] = CELL[res] || CELL[16], sc = opts.scale || 1, rowsDef = layoutFor(g.role, names);
    const c = mkCanvas(cw * 4 * sc, ch * rowsDef.length * sc), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    if (opts.key !== false) { x.fillStyle = '#ff00ff'; x.fillRect(0, 0, c.width, c.height); }
    const cells = [];
    rowsDef.forEach(([n, f], ri) => DIRS.forEach((d, di) => {
      const t = toCanvas(renderFrame(g, n, f, d[1], res, opts));
      x.drawImage(t, di * cw * sc, ri * ch * sc, cw * sc, ch * sc);
      cells.push({ anim: n, frame: f, dir: d[0], x: di * cw * sc, y: ri * ch * sc, w: cw * sc, h: ch * sc });
    }));
    const manifest = {
      forja: 1, papel: g.role, resolucao: res, escala: sc, celula: [cw * sc, ch * sc], ancora: [Math.floor(cw / 2) * sc, (ch - Math.round(7 * res / 16)) * sc],
      direcoes: DIRS.map((d) => d[0]), fundo: opts.key !== false ? '#ff00ff' : 'transparente',
      animacoes: names.map((n) => ({ nome: n, quadros: set[n].frames, fps: set[n].fps, repete: set[n].loop })),
      linhas: rowsDef.map((r) => r[0] + ':' + r[1]), genoma: g, celulas: cells
    };
    return { canvas: c, manifest };
  }
  // importa uma folha repintada com o MESMO layout da exportada (papel e tamanho da célula são deduzidos da proporção da imagem).
  // Cada célula vira um sprite do tamanho do jogo (24x32). Retorna {papel, quadros} ou null se a proporção não bate com nenhum papel.
  // Também aceita a folha de UMA animação (nome do arquivo: <papel>_<animação>.png, 4 colunas x quadros linhas), como as de assets/forja/.
  function importSheet(img, fname) {
    const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
    let role = null, rows = null;
    for (const r of ['survivor', 'killer']) { const n = layoutFor(r).length; if (Math.abs(H / W - n * CELL[16][1] / (4 * CELL[16][0])) < 0.02) { role = r; rows = layoutFor(r); } }
    if (!role && fname) {
      const m = /(sobrevivente|assassino)[_-]([a-z_]+?)(?:[_-]\d+px)?(?:\.[a-z]+)?$/i.exec(fname.toLowerCase().replace(/\.[a-z]+$/, ''));
      const r = m && (m[1] === 'assassino' ? 'killer' : 'survivor'), A = r && ANIMS[r][m[2]];
      if (A && Math.abs(H / W - A.frames * CELL[16][1] / (4 * CELL[16][0])) < 0.02) { role = r; rows = layoutFor(r, [m[2]]); }
    }
    if (!role) return null;
    const cw = W / 4, ch = H / rows.length, src = mkCanvas(W, H), sx = src.getContext('2d');
    sx.drawImage(img, 0, 0);
    let n = 0;
    rows.forEach(([anim, frame], ri) => DIRS.forEach((d, di) => {
      const t = mkCanvas(CELL[16][0], CELL[16][1]), tg = t.getContext('2d'); tg.imageSmoothingEnabled = false;
      tg.drawImage(src, di * cw, ri * ch, cw, ch, 0, 0, CELL[16][0], CELL[16][1]);
      const im = tg.getImageData(0, 0, CELL[16][0], CELL[16][1]), px = im.data;
      for (let i = 0; i < px.length; i += 4) if (px[i] > 225 && px[i + 1] < 40 && px[i + 2] > 225) px[i + 3] = 0;
      tg.putImageData(im, 0, 0);
      imported.set(role + '|' + anim + '|' + frame + '|' + di, { c: t, ax: CELL[16][0] / 2, ay: CELL[16][1] - 7, w: CELL[16][0], h: CELL[16][1], imp: true });
      n++;
    }));
    return { papel: role, quadros: n };
  }
  function clearImported() { imported.clear(); }

  // ---------- estado salvo (personagem do jogador, estilo) e edição ----------
  const S = { on: true, mine: null, killerG: null };
  function load() {
    try {
      const j = JSON.parse(localStorage.getItem('dp_forge') || 'null');
      if (j) { if (typeof j.on === 'boolean') S.on = j.on; if (j.mine) S.mine = normalize(Object.assign({}, j.mine, { role: 'survivor' })); if (j.killer) S.killerG = normalize(Object.assign({}, j.killer, { role: 'killer' })); }
    } catch (e) { /* sem armazenamento: usa o padrão */ }
    if (!S.mine) S.mine = defaultGenome('survivor', 0);
    if (!S.killerG) S.killerG = defaultGenome('killer');
  }
  function save() { try { localStorage.setItem('dp_forge', JSON.stringify({ on: S.on, mine: S.mine, killer: S.killerG })); } catch (e) { /* ok */ } }
  function genomeOf(role) { return role === 'killer' ? S.killerG : S.mine; }
  function edit(role, i, d) {
    const o = OPTS[role][i], g = genomeOf(role);
    g[o.k] = ((g[o.k] + d) % o.n + o.n) % o.n; save();
  }
  function randomize(role) {
    const g = randomGenome(role, (Math.random() * 1e9) | 0);
    if (role === 'killer') S.killerG = normalize(g); else S.mine = normalize(g);
    save();
  }
  function setOn(v) { S.on = !!v; save(); }

  // salva um arquivo (PNG ou JSON). No artefato publicado usa a capacidade `downloads` (confirmação do visualizador); fora dele, link de download comum.
  function download(name, blobOrCanvas, type) {
    const toBlob = () => new Promise((res) => { if (blobOrCanvas.toBlob) blobOrCanvas.toBlob(res, 'image/png'); else res(new Blob([blobOrCanvas], { type: type || 'application/json' })); });
    return toBlob().then(async (blob) => {
      let dl = null;
      try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
      if (dl) { try { await dl.save({ filename: name, data: blob }); return true; } catch (e) { return false; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    });
  }
  function exportDownload(role, res) {
    const sheet = exportSheet(genomeOf(role), res, {});
    const base = 'forja_' + (role === 'killer' ? 'assassino' : 'sobrevivente') + '_' + res + 'px';
    download(base + '.png', sheet.canvas).then((ok) => { if (ok) return download(base + '.json', JSON.stringify(sheet.manifest, null, 1), 'application/json'); });
    return base;
  }
  function pickImport(done) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/*'; inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const img = new Image(); img.onload = () => { done(importSheet(img, f.name)); URL.revokeObjectURL(img.src); }; img.onerror = () => done(null);
      img.src = URL.createObjectURL(f);
    };
    document.body.appendChild(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  }

  load();
  DP.forge = {
    OPTS, ANIMS, DIRS, CELL, defaultGenome, randomGenome, normalize, key, renderFrame, sprite, exportSheet, importSheet, clearImported, layoutFor,
    yawFromFace, dirIndex, toCanvas, edit, randomize, setOn, genomeOf, exportDownload, pickImport, save, hasImported: () => imported.size > 0,
    get on() { return S.on; }, get mine() { return S.mine; }, get killerG() { return S.killerG; }, internals: { ramp, hex, mulberry }
  };
})();
