// Shared test harness: serves the app with python3 -m http.server, launches headless Chromium with a fake mic.
//
// The fake mic is Chromium's own: --use-file-for-fake-audio-capture=<wav>%noloop plays a WAV once into getUserMedia,
// starting when the tuner opens the mic. On top of that, an init script (micShim) wraps getUserMedia so a test can:
//   - record the constraints the app asked for (window.__mic.calls);
//   - mix the app's real output back into the mic, 60 ms late (speaker bleed), at a chosen level (opts.bleed);
//   - play extra samples into the mic on demand (window.__mic.say(samples)), for call and response.
// Bleed and say need the mic and the app on the same AudioContext, so the shim records the app's AudioContext and the
// node the app connects to ctx.destination (outBus).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { synth, wav, VOICES, TAIL } from './voices.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The app under test. SHADJA_SITE=<dir> tests another copy (e.g. a deliberately broken one, or the #61 split).
export const SITE = path.resolve(process.env.SHADJA_SITE || ROOT);
const OUT = path.join(ROOT, 'tests', '.out');

export function startServer() {
  return new Promise((resolve, reject) => {
    const p = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', SITE], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const onData = (d) => {
      buf += d;
      const m = buf.match(/port (\d+)/);
      if (m) { p.stdout.off('data', onData); resolve({ url: 'http://127.0.0.1:' + m[1] + '/', stop: () => p.kill() }); }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', () => {});                                  // request log
    p.on('error', reject);
    p.on('exit', (code) => reject(new Error('http.server exited with ' + code)));
  });
}

// Writes the WAV for a voice and returns its path and length in seconds.
export function voiceFile(name) {
  fs.mkdirSync(OUT, { recursive: true });
  const samples = synth(VOICES[name], { tail: TAIL });
  const file = path.join(OUT, name + '.wav');
  fs.writeFileSync(file, wav(samples));
  return { file, secs: samples.length / 48000 };
}

function micShim(opts) {
  const mic = window.__mic = { calls: [], tones: [], ctx: null, bus: null, inject: null };
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(o) { super(o); if (!mic.ctx) mic.ctx = this; }
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest) {
    if (dest && dest === this.context.destination && this.context === mic.ctx && !mic.bus) mic.bus = this;
    return connect.apply(this, arguments);
  };
  const start = OscillatorNode.prototype.start;                      // the app's piano notes, for call and response
  OscillatorNode.prototype.start = function () {
    if (this.context === mic.ctx && this.type === 'triangle') mic.tones.push(this.frequency.value);
    return start.apply(this, arguments);
  };
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = async function (c) {
    mic.calls.push(JSON.parse(JSON.stringify(c)));
    const real = await gum(c);
    if (!opts.mix) return real;
    const ctx = mic.ctx, dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(real).connect(dest);
    mic.inject = ctx.createGain(); mic.inject.connect(dest);
    if (opts.bleed) {
      const d = ctx.createDelay(1), g = ctx.createGain();
      d.delayTime.value = 0.06; g.gain.value = opts.bleed;
      const tap = () => { if (mic.bus) { mic.bus.connect(d); d.connect(g); g.connect(dest); } else setTimeout(tap, 20); };
      tap();
    }
    const tr = dest.stream.getAudioTracks()[0], rt = real.getAudioTracks()[0];
    Object.defineProperty(tr, 'label', { value: rt.label });
    tr.getSettings = () => rt.getSettings();
    const stop = tr.stop.bind(tr);
    tr.stop = () => { real.getTracks().forEach((t) => t.stop()); stop(); };
    return dest.stream;
  };
  // Plays Float32 samples (48 kHz) into the mic now; resolves when done.
  mic.say = (samples) => new Promise((resolve) => {
    const ctx = mic.ctx, b = ctx.createBuffer(1, samples.length, 48000);
    b.copyToChannel(Float32Array.from(samples), 0);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(mic.inject); s.onended = resolve; s.start();
  });
}

// Opens the app with a fake mic. voice: a VOICES name (or null for a silent mic).
// opts: { mix: route the mic through the shim's mixer (needed for say), bleed: level of the app's output fed back in }
export async function openApp(server, voice, opts = {}) {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  const v = voiceFile(voice || 'silence');
  args.push('--use-file-for-fake-audio-capture=' + v.file + '%noloop');
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: 440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(micShim, { mix: !!(opts.mix || opts.bleed), bleed: opts.bleed || 0 });
  await page.goto(server.url + 'index.html');
  return { browser, page, secs: v.secs, errors, close: () => browser.close() };
}

// The tuner's note history: [{ note: 'Re', ok: in tune (✓), cents: -28 (null for ✓ and ✗), text }]
export async function history(page) {
  return page.$$eval('#tHist .echo-note', (els) => els.map((e) => {
    const t = e.textContent.trim(), m = t.match(/([+−±])(\d+)¢/);
    return {
      text: t, note: t.split(' ')[0], ok: t.endsWith('✓'),
      cents: m ? (m[1] === '−' ? -1 : 1) * Number(m[2]) : null
    };
  }));
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
