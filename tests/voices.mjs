// Synthetic singing voices for the tuner tests (#23). Deterministic: the same seed gives the same samples every run.
// Pure functions with no Node APIs outside the CLI block at the end.
//
// A "voice" is a list of parts, each either { rest: seconds } or a sung note:
//   { n: semitones from Sa, c: cents offset, dur: s, amp: peak level (default 0.3),
//     scoop: { from: cents below/above the target to start at, time: s to reach it },
//     vib: { depth: ± cents, rate: Hz } }
// Notes that follow each other with no rest are sung legato: the pitch glides over 40 ms and the voice never stops.

export const SR = 48000;
export const SA = 130.8128;          // the app's default Sa: C3 (root 0, octave 3)

export function rng(seed) {          // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Harmonic levels: a soft vocal spectrum, with a bump near 500-700 Hz like an "aa" vowel.
function harmonics(f0) {
  const hs = [];
  for (let k = 1; k <= 12; k++) {
    const fk = f0 * k;
    if (fk > 4000) break;
    const formant = 1 + 1.5 * Math.exp(-Math.pow((fk - 600) / 250, 2));
    hs.push(formant / Math.pow(k, 1.2));
  }
  return hs;
}

export function synth(parts, opts = {}) {
  const sr = opts.sr || SR, rand = rng(opts.seed || 1);
  const floor = opts.floor === undefined ? 0.0005 : opts.floor;   // room noise RMS
  const total = parts.reduce((s, p) => s + (p.rest !== undefined ? p.rest : p.dur), 0) + (opts.tail || 0);
  const out = new Float32Array(Math.ceil(total * sr));
  // room noise everywhere
  for (let i = 0; i < out.length; i++) out[i] = floor * 1.7 * (rand() * 2 - 1);
  let i0 = 0, phase = 0, prevCents = null;
  parts.forEach((p, idx) => {
    if (p.rest !== undefined) { i0 += Math.round(p.rest * sr); prevCents = null; return; }
    const len = Math.round(p.dur * sr), amp = p.amp === undefined ? 0.3 : p.amp;
    const target = p.n * 100 + (p.c || 0);
    const next = parts[idx + 1], legatoIn = prevCents !== null, legatoOut = next && next.rest === undefined;
    const hs = harmonics(SA * Math.pow(2, target / 1200));
    const norm = 1 / hs.reduce((s, h) => s + h, 0);
    let drift = 0;                                                   // slow random pitch wander, about ±3 cents
    for (let j = 0; j < len && i0 + j < out.length; j++) {
      const t = j / sr;
      let cents = target;
      if (legatoIn && t < 0.04) cents = prevCents + (target - prevCents) * (t / 0.04);
      if (p.scoop && t < p.scoop.time) cents = target + p.scoop.from * (1 - t / p.scoop.time);
      if (p.vib) cents += p.vib.depth * Math.sin(2 * Math.PI * p.vib.rate * t);
      if (j % 480 === 0) drift = Math.max(-3, Math.min(3, drift + (rand() - 0.5) * 1.2));
      cents += drift;
      phase += 2 * Math.PI * SA * Math.pow(2, cents / 1200) / sr;
      let s = 0;
      for (let k = 0; k < hs.length; k++) s += hs[k] * Math.sin((k + 1) * phase);
      const att = legatoIn ? 1 : Math.min(1, t / 0.04);
      const rel = legatoOut ? 1 : Math.min(1, (p.dur - t) / 0.06);
      const breath = 0.01 * (rand() * 2 - 1);
      out[i0 + j] += amp * att * rel * (s * norm + breath);
    }
    i0 += len;
    prevCents = target;
  });
  return out;
}

export function rms(x) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); }

// 16-bit PCM mono WAV, the format Chromium's --use-file-for-fake-audio-capture reads.
export function wav(samples, sr = SR) {
  const n = samples.length, buf = new ArrayBuffer(44 + 2 * n), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + 2 * n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, 2 * n, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return new Uint8Array(buf);
}

// Semitones from Sa in raga Yaman (the default raga): Sa 0, Re 2, Ga 4, Ma♯ 6, Pa 7, Dha 9, Ni 11.
// Each voice starts with 1 s of room noise so the tuner can learn the background level first.
export const VOICES = {
  held:     [{ rest: 1 }, { n: 0, c: 0, dur: 1 }, { rest: 0.5 }, { n: 2, c: -28, dur: 1 }, { rest: 0.5 }, { n: 4, c: 35, dur: 1 }],
  legato:   [{ rest: 1 }, { n: 0, dur: 0.6 }, { n: 2, dur: 0.6 }, { n: 4, dur: 0.6 }],
  short04:  [{ rest: 1 }, { n: 4, dur: 0.4 }],
  short02:  [{ rest: 1 }, { n: 4, dur: 0.2 }],
  scoop:    [{ rest: 1 }, { n: 2, dur: 1.2, scoop: { from: -100, time: 0.15 } }],
  // a voice crack: Re with 0.1 s jumping 150¢ up in the middle, all legato
  crack:    [{ rest: 1 }, { n: 2, dur: 0.5 }, { n: 2, c: 150, dur: 0.1 }, { n: 2, dur: 0.5 }],
  vibrato:  [{ rest: 1 }, { n: 4, dur: 1.5, vib: { depth: 30, rate: 5.5 } }],
  quiet:    [{ rest: 1 }, { n: 0, dur: 1.2, amp: 0.012 }],
  silence:  [{ rest: 3 }],
  // drone bleed: 2.5 s of drone only (the tuner's drone check), then Ga, then drone only again
  bleed:    [{ rest: 2.5 }, { n: 4, dur: 1.2, amp: 0.45 }, { rest: 2.5 }],
  live:     [{ rest: 1 }, { n: 4, dur: 2.5 }],
  // hold exercise (target Sa, 5 s)
  holdSteady: [{ rest: 1 }, { n: 0, dur: 6 }],
  holdFlat:   [{ rest: 1 }, { n: 0, c: -40, dur: 6 }],
  holdWobble: [{ rest: 1 }, { n: 0, dur: 6, vib: { depth: 35, rate: 4 } }]
};
export const TAIL = 1;               // seconds of room noise after the last part

// CLI: node tests/voices.mjs <dir>  writes every voice as a WAV, to listen to.
if (typeof process !== 'undefined' && process.argv && import.meta.url === 'file://' + process.argv[1]) {
  const fs = await import('node:fs'), path = await import('node:path');
  const dir = process.argv[2] || 'tests/.out';
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, parts] of Object.entries(VOICES)) {
    const file = path.join(dir, name + '.wav');
    fs.writeFileSync(file, wav(synth(parts, { tail: TAIL })));
    console.log(file);
  }
}
