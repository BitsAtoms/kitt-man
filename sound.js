/* Synthesized sound effects (Web Audio API) — no external audio files,
 * so there is nothing to license: everything here is generated on the fly. */

const SFX = (() => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = Ctx ? new Ctx() : null;

  document.addEventListener('click', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { once: true });
  document.addEventListener('keydown', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { once: true });

  function tone(freq, duration, type = 'square', gainVal = 0.1, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function sweep(freqFrom, freqTo, duration, type = 'sawtooth', gainVal = 0.12, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // short burst of filtered noise — for whoosh/impact textures a pure oscillator can't give
  function noiseBurst(duration, { gainVal = 0.15, delay = 0, filterType = 'lowpass', freqFrom = 4000, freqTo = 400 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freqFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  // cartoon "boing" — a springy pitch that overshoots and bounces before settling
  function boing(baseFreq = 260, duration = 0.5, gainVal = 0.2, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 2.2, t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, t0 + duration * 0.22);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, t0 + duration * 0.45);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, t0 + duration * 0.68);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, t0 + duration * 0.86);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t0 + duration);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  let munchToggle = false;

  return {
    // classic Pac-Man "waka-waka" — a quick pitch-bent blip, alternating up/down each chomp
    munch() {
      if (munchToggle) sweep(240, 400, 0.07, 'square', 0.07);
      else sweep(400, 180, 0.07, 'square', 0.07);
      munchToggle = !munchToggle;
    },
    pellet() {
      sweep(320, 140, 0.16, 'square', 0.12);
    },
    ghostEaten() {
      sweep(400, 1000, 0.2, 'square', 0.1);
    },
    death() {
      [520, 440, 360, 280, 200, 120].forEach((f, i) => tone(f, 0.16, 'sawtooth', 0.12, i * 0.12));
    },
    lifeLost() {
      sweep(260, 90, 0.32, 'square', 0.14);
      tone(110, 0.24, 'sawtooth', 0.12, 0.18);
    },
    gameOver() {
      sweep(360, 55, 0.95, 'sawtooth', 0.18);
      [220, 175, 130, 85].forEach((f, i) => tone(f, 0.22, 'square', 0.12, 0.18 + i * 0.14));
    },
    win() {
      [400, 500, 600, 800, 1000, 1200].forEach((f, i) => tone(f, 0.16, 'square', 0.1, i * 0.11));
    },
    // KITT: Turbo Boost — a smooth rising "fiuuuuu" engine whistle with a soft wind layer
    turbo() {
      sweep(220, 1200, 0.55, 'sine', 0.17);
      sweep(230, 1210, 0.55, 'triangle', 0.07);
      noiseBurst(0.55, { gainVal: 0.07, filterType: 'bandpass', freqFrom: 500, freqTo: 2400 });
    },
    // KITT: Super Pursuit Mode — a springy cartoon "boing" leap
    jump() {
      boing(240, 0.55, 0.22);
    },
  };
})();
