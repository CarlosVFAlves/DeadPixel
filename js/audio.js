// Áudio 100% sintetizado (sem arquivos)
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};

  let ctx = null, master = null, noiseBuf = null;
  let muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function out(pan) {
    if (!ctx.createStereoPanner || !pan) return master;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(master);
    return p;
  }

  const vmul = () => (DP.audio && DP.audio.vol !== undefined ? DP.audio.vol : 1);
  function tone(freq, dur, type, vol, slideTo, pan, delay) {
    if (!ctx || muted) return;
    vol *= vmul();
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out(pan));
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq, type, q, pan, delay, freqTo) {
    if (!ctx || muted) return;
    vol *= vmul();
    const t0 = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.setValueAtTime(freq || 800, t0);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    f.Q.value = q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out(pan));
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  const sfx = {
    // pallet batendo no chão
    slam(pan) {
      tone(95, 0.28, 'sine', 0.9, 38, pan);
      noise(0.22, 0.9, 1400, 'lowpass', 0.7, pan);
      noise(0.09, 0.5, 3200, 'highpass', 0.7, pan);
    },
    // pallet acertando o assassino
    stun(pan) {
      tone(190, 0.35, 'square', 0.35, 60, pan);
      noise(0.3, 0.8, 2400, 'bandpass', 3, pan);
      tone(1250, 0.5, 'triangle', 0.18, 700, pan, 0.03);
      tone(1870, 0.45, 'triangle', 0.1, 1100, pan, 0.03);
    },
    miss(pan) { noise(0.18, 0.28, 900, 'bandpass', 1.5, pan, 0.05); },
    // pallet de pé sendo puxado (rangido de madeira)
    creak(pan) { tone(160, 0.18, 'sawtooth', 0.12, 110, pan); noise(0.12, 0.25, 600, 'bandpass', 4, pan); },
    // killer: respiração + rosnado subindo ao erguer a arma
    windup(pan) { noise(0.16, 0.35, 500, 'bandpass', 1.5, pan, 0, 1400); tone(95, 0.2, 'sawtooth', 0.16, 190, pan); },
    // o bote: chicotada do ar + lâmina cortando
    lunge(pan) {
      noise(0.3, 0.75, 500, 'bandpass', 1.1, pan, 0, 3600);
      tone(1500, 0.22, 'triangle', 0.16, 420, pan);
      tone(110, 0.22, 'sawtooth', 0.14, 70, pan);
    },
    // errou: o ar cortado esvaindo e o corpo freando
    whiff(pan) { noise(0.24, 0.32, 2600, 'bandpass', 1.3, pan, 0.02, 420); tone(105, 0.14, 'sine', 0.3, 60, pan, 0.05); noise(0.1, 0.18, 700, 'lowpass', 0.8, pan, 0.08); },
    // baú: tampa rangendo e o conteúdo chacoalhando
    chest(pan) { noise(0.3, 0.3, 700, 'bandpass', 2, pan, 0, 1800); tone(150, 0.14, 'square', 0.1, 220, pan, 0.05); tone(880, 0.07, 'triangle', 0.1, 1200, pan, 0.2); },
    // cura concluída: acorde subindo
    heal(pan) { for (let i = 0; i < 3; i++) tone(440 * Math.pow(1.26, i), 0.22, 'triangle', 0.18, 0, pan, i * 0.1); },
    // respiração abafada de quem está escondido (inspira e solta): baixa, só se ouve de muito perto
    breath(pan) { noise(0.5, 0.16, 700, 'bandpass', 0.9, pan, 0, 420); noise(0.6, 0.12, 500, 'bandpass', 0.8, pan, 0.55, 300); },
    // passos: x = { surf, heavy, alt } (alt alterna pé esquerdo/direito: pequena variação de tom)
    step(pan, x) {
      x = x || {}; const surf = x.surf || 'grass', hv = !!x.heavy, v = 0.9 + Math.random() * 0.2, f = (x.alt ? 1 : 0.88) * v;
      if (hv) tone(78 * f, 0.13, 'sine', 0.5, 42 * f, pan);
      if (surf === 'grass') noise(0.09, hv ? 0.4 : 0.26, 520 * f, 'lowpass', 0.8, pan);
      else if (surf === 'dirt') { noise(0.07, hv ? 0.5 : 0.32, 900 * f, 'lowpass', 0.9, pan); if (!hv) tone(120 * f, 0.06, 'sine', 0.12, 70, pan); }
      else if (surf === 'sand') noise(0.13, hv ? 0.3 : 0.2, 2300 * f, 'bandpass', 0.8, pan, 0, 1200);
      else if (surf === 'gravel') { for (let i = 0; i < 3; i++) noise(0.04, hv ? 0.4 : 0.26, (2600 + Math.random() * 1400) * f, 'bandpass', 2.5, pan, i * 0.028); }
      else { tone((hv ? 120 : 190) * f, 0.075, 'sine', hv ? 0.5 : 0.3, (hv ? 70 : 110) * f, pan); noise(0.05, hv ? 0.4 : 0.25, 750 * f, 'bandpass', 3, pan); }   // madeira: toc oco
    },
    hit(pan) {
      tone(80, 0.25, 'sine', 0.9, 40, pan);
      noise(0.16, 0.8, 1800, 'lowpass', 0.8, pan);
      tone(420, 0.22, 'sawtooth', 0.25, 120, pan, 0.02);
    },
    breakHit(pan) { noise(0.1, 0.45, 1200, 'lowpass', 0.8, pan); tone(120, 0.1, 'square', 0.18, 70, pan); },
    breakDone(pan) {
      noise(0.45, 0.9, 1800, 'lowpass', 0.8, pan, 0, 200);
      tone(70, 0.3, 'sine', 0.6, 35, pan);
    },
    vault(pan) { noise(0.2, 0.3, 700, 'bandpass', 1.2, pan, 0, 2200); },
    respawn() { tone(520, 0.12, 'triangle', 0.12, 760); },
    death() {
      tone(55, 1.4, 'sine', 0.9, 30);
      noise(1.0, 0.6, 700, 'lowpass', 0.8, 0, 0.05, 80);
      for (let i = 0; i < 3; i++) tone(520 + i * 170, 0.9, 'sawtooth', 0.22, 190 + i * 60, 0, 0.08);
    },
    repair(pan) { noise(0.05, 0.3, 2600, 'bandpass', 5, pan); tone(240 + Math.random() * 60, 0.06, 'square', 0.07, 180, pan); },
    skill() { tone(980, 0.09, 'square', 0.16, 980); tone(980, 0.09, 'square', 0.16, 980, 0, 0.14); },
    skillok() { tone(660, 0.08, 'triangle', 0.22, 660); tone(990, 0.14, 'triangle', 0.22, 990, 0, 0.08); },
    bang(pan) { noise(0.35, 0.9, 1800, 'lowpass', 0.8, pan, 0, 150); tone(90, 0.3, 'square', 0.35, 40, pan); },
    genDone(pan) { for (let i = 0; i < 4; i++) tone(330 * Math.pow(1.26, i), 0.16, 'square', 0.14, 0, pan, i * 0.09); noise(0.3, 0.3, 4000, 'highpass', 0.7, pan); },
    gates() { for (let i = 0; i < 3; i++) tone(220 * (i + 2), 0.5, 'sawtooth', 0.12, 220 * (i + 2) * 1.5, 0, i * 0.12); },
    // motor: ronco grave com tosse
    engine(pan) { noise(0.5, 0.5, 220, 'lowpass', 0.9, pan); tone(70, 0.5, 'sawtooth', 0.22, 110, pan); tone(55, 0.35, 'square', 0.12, 90, pan, 0.15); },
    // sirene de polícia: duas notas alternadas
    siren(pan) { for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 880, 0.2, 'square', 0.09, 0, pan, i * 0.2); },
    escape() { for (let i = 0; i < 5; i++) tone(392 * Math.pow(1.19, i), 0.25, 'triangle', 0.2, 0, 0, i * 0.11); },
    trip(pan) { noise(0.16, 0.5, 700, 'lowpass', 0.8, pan); tone(130, 0.2, 'square', 0.2, 55, pan); tone(300, 0.1, 'triangle', 0.12, 180, pan, 0.05); },
    // vidro estilhaçando: estalo agudo + chuva de cacos
    glass(pan) {
      noise(0.07, 0.9, 5200, 'highpass', 0.7, pan);
      for (let i = 0; i < 7; i++) tone(2400 + Math.random() * 3200, 0.07 + Math.random() * 0.07, 'triangle', 0.1, 1500 + Math.random() * 1500, pan, 0.02 + i * 0.045);
      noise(0.35, 0.3, 3800, 'highpass', 0.6, pan, 0.12);
    },
    glassHit(pan) { noise(0.06, 0.5, 4200, 'highpass', 0.7, pan); tone(1800, 0.06, 'square', 0.08, 900, pan); },
    winOpen(pan) { noise(0.28, 0.22, 900, 'bandpass', 3, pan, 0, 2200); tone(180, 0.2, 'sawtooth', 0.06, 260, pan); },
    cut(pan) { tone(880, 0.16, 'sawtooth', 0.2, 300, pan); noise(0.12, 0.35, 2800, 'bandpass', 2, pan); },
    doorOpen() { noise(0.7, 0.4, 500, 'lowpass', 1.2, 0, 0, 120); tone(70, 0.6, 'sawtooth', 0.14, 45); for (let i = 0; i < 3; i++) tone(330 * Math.pow(1.26, i), 0.3, 'triangle', 0.14, 0, 0, 0.2 + i * 0.1); },
    pick(pan) { tone(520, 0.07, 'square', 0.12, 780, pan); tone(780, 0.09, 'square', 0.1, 1040, pan, 0.06); },
    // bipe do rádio: faixa 1 (longe) grave e lento, 3 (muito perto) agudo e rápido
    beep(band) { tone(band === 3 ? 1560 : band === 2 ? 1170 : 780, 0.07, 'square', band === 3 ? 0.2 : 0.13, 0); },
    click() { tone(660, 0.05, 'square', 0.1, 440); },
    // batida de coração (raio de terror)
    heart(vol) {
      if (!ctx || muted) return;
      tone(58, 0.16, 'sine', vol, 40);
      tone(52, 0.18, 'sine', vol * 0.7, 36, 0, 0.19);
    }
  };

  DP.audio = {
    init,
    sfx,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    toggleMute() { this.setMuted(!muted); return muted; },
    get muted() { return muted; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
