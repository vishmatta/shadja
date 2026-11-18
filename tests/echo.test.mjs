// Call and response tests (#18, #39): checkPhrase unit cases, and one answer sung into the fake mic.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openApp, SITE } from './harness.mjs';
import { SA, synth } from './voices.mjs';

// checkPhrase is pure (AGENTS.md), so it is lifted out of index.html by its source text and run in Node.
function loadCheckPhrase() {
  const src = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const start = src.indexOf('function checkPhrase(');
  assert.ok(start > -1, 'checkPhrase not found in index.html');
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return new Function('return ' + src.slice(start, i + 1))();
}
const checkPhrase = loadCheckPhrase();
const sung = (...ns) => ns.map((n, j) => ({ n, c: j * 3 - 3 }));      // cents -3, 0, 3, …
const statuses = (r) => r.results.map((x) => x.status);

test('checkPhrase: an exact answer is all right, with the sung cents', () => {
  const r = checkPhrase([0, 2, 4], sung(0, 2, 4));
  assert.deepEqual(r, { results: [{ pc: 0, status: 'right', cents: -3 }, { pc: 2, status: 'right', cents: 0 }, { pc: 4, status: 'right', cents: 3 }], extra: 0 });
});

test('checkPhrase: another octave counts', () => {
  assert.deepEqual(statuses(checkPhrase([0, 2, 4], sung(12, 14, -8))), ['right', 'right', 'right']);
  assert.deepEqual(statuses(checkPhrase([12, -1], sung(0, 11))), ['right', 'right']);
});

test('checkPhrase: a missed note does not shift the rest', () => {
  assert.deepEqual(statuses(checkPhrase([0, 2, 4, 5], sung(0, 4, 5))), ['right', 'missed', 'right', 'right']);
});

test('checkPhrase: a wrong note reports what was sung', () => {
  const r = checkPhrase([0, 2, 4], sung(0, 3, 4));
  assert.deepEqual(r.results[1], { pc: 2, status: 'wrong', sung: 3 });
  assert.equal(r.extra, 0);
});

test('checkPhrase: an extra note is counted, not matched', () => {
  const r = checkPhrase([0, 2], sung(0, 5, 2));
  assert.deepEqual(statuses(r), ['right', 'right']);
  assert.equal(r.extra, 1);
});

test('checkPhrase: repeated target notes may share one legato sung note', () => {
  const r = checkPhrase([0, 0, 2], sung(0, 2));
  assert.deepEqual(r.results, [{ pc: 0, status: 'right', cents: -3 }, { pc: 0, status: 'right', cents: -3 }, { pc: 2, status: 'right', cents: 0 }]);
  assert.equal(r.extra, 0);
});

test('checkPhrase: breaths (null) are skipped; nothing sung means all missed', () => {
  assert.deepEqual(statuses(checkPhrase([0, null, 2], sung(0, 2))), ['right', 'right']);
  assert.deepEqual(checkPhrase([0, 2], []), { results: [{ pc: 0, status: 'missed' }, { pc: 2, status: 'missed' }], extra: 0 });
});

test('checkPhrase: pure, does not change its inputs', () => {
  const t = [0, null, 2], s = sung(0, 2), t0 = JSON.stringify(t), s0 = JSON.stringify(s);
  checkPhrase(t, s); checkPhrase(t, s);
  assert.equal(JSON.stringify(t), t0);
  assert.equal(JSON.stringify(s), s0);
});

// One sung answer: the mic is a silent fake device plus the shim's mixer. The test listens to the app's piano notes
// during the call (window.__mic.tones), then sings the same notes into the mic during "Your turn".
let server;
before(async () => { server = await startServer(); });
after(() => server.stop());

test('call and response: the phrase sung back into the mic is graded all right', async () => {
  const app = await openApp(server, null, { mix: true });
  try {
    await app.page.click('#echoMic');                                 // starts the tuner
    await app.page.waitForFunction(() => document.getElementById('echoMic').getAttribute('aria-pressed') === 'true');
    await app.page.evaluate(() => { window.__mic.tones = []; });
    await app.page.click('#echoNew');
    await app.page.waitForFunction(() => /Your turn/.test(document.getElementById('echoResult').textContent), null, { timeout: 15000 });
    const freqs = await app.page.evaluate(() => window.__mic.tones);
    const phrase = freqs.map((f) => Math.round(12 * Math.log2(f / SA)));
    assert.ok(phrase.length >= 3 && phrase.length <= 5, 'phrase ' + JSON.stringify(phrase));
    const parts = [];
    phrase.forEach((n) => parts.push({ n, dur: 0.6 }, { rest: 0.12 }));
    await app.page.evaluate((x) => window.__mic.say(x), Array.from(synth(parts, { floor: 0 })));
    await app.page.waitForFunction(() => /notes right/.test(document.getElementById('echoResult').textContent), null, { timeout: 15000 });
    const text = await app.page.textContent('#echoResult');
    assert.match(text, new RegExp(phrase.length + ' of ' + phrase.length + ' notes right'), text + ' / phrase ' + JSON.stringify(phrase));
    assert.doesNotMatch(text, /extra note/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
