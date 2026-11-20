// Strict-mode move rule (#74): judge the note you leave, not the note you reach.
// moveOk is pure, so it is lifted out of index.html and run in Node; one browser test checks the tap path.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadRagas, loadFunction } from './source.mjs';
import { startServer, openApp } from './harness.mjs';

const RAGAS = loadRagas();
const moveOk = loadFunction('moveOk');
// Sargam offsets from Sa (lower octave negative, upper Sa 12).
const Sa = 0, re = 1, Re = 2, ga = 3, Ga = 4, Ma = 5, Mat = 6, Pa = 7, dha = 8, Dha = 9, ni = 10, Ni = 11, SA = 12;
const ok = (raga, from, to, prev) => moveOk(RAGAS[raga], from, to, prev);

test('Yaman: Pa may be reached from below, but the next note must be lower', () => {
  assert.equal(ok('Yaman', Mat, Pa), true, 'Ma♯ → Pa');
  assert.equal(ok('Yaman', Ga, Pa), true, 'Ga → Pa');
  assert.equal(ok('Yaman', Pa, Mat), true, 'Pa → Ma♯');
  assert.equal(ok('Yaman', Pa, Dha), false, 'Pa → Dha');
  assert.equal(ok('Yaman', Pa, Ni), false, 'Pa → Ni');
});

test('Bihag: its own Pa Ma♯ Pa turn is allowed; Ma♯ is never used going straight up', () => {
  assert.equal(ok('Bihag', Pa, Mat), true, 'Pa → Ma♯');
  assert.equal(ok('Bihag', Mat, Pa, Pa), true, 'Pa Ma♯ → Pa (its own turn)');
  assert.equal(ok('Bihag', Mat, Pa), true, 'Ma♯ → Pa with no note before it');
  assert.equal(ok('Bihag', Mat, Pa, Ga), false, 'Ga Ma♯ → Pa (#75 review, finding 1)');
  assert.equal(ok('Bihag', Mat, Pa, Ma), false, 'Ma Ma♯ → Pa (#75 review, finding 1)');
  assert.equal(ok('Bihag', Mat, Dha, Pa), false, 'Pa Ma♯ → Dha');
});

test('Bageshree: the avaroha’s Ma Pa Dha is allowed, but not Pa going straight up from Ga♭', () => {
  assert.equal(ok('Bageshree', Ma, Pa), true, 'Ma → Pa');
  assert.equal(ok('Bageshree', Pa, Dha, Ma), true, 'Ma Pa → Dha (its own turn)');
  assert.equal(ok('Bageshree', Pa, Dha, ga), false, 'Ga♭ Pa → Dha (#75 review, finding 1)');
});

test('Bhimpalasi: Re may be touched from Sa, but not used going up', () => {
  assert.equal(ok('Bhimpalasi', Sa, Re), true, 'Sa → Re');
  assert.equal(ok('Bhimpalasi', Re, Sa), true, 'Re → Sa');
  assert.equal(ok('Bhimpalasi', Re, ga), false, 'Re → Ga♭');
});

test('Khamaj: natural Ni must be followed by a higher note', () => {
  assert.equal(ok('Khamaj', SA, Ni), true, 'upper Sa → Ni');
  assert.equal(ok('Khamaj', Ni, SA), true, 'Ni → upper Sa');
  assert.equal(ok('Khamaj', Ni, Dha), false, 'Ni → Dha');
  assert.equal(ok('Khamaj', ni, Dha), true, 'Ni♭ → Dha');
});

test('a breath in the pakad does not make a move', () => {
  const r = { aroha: [Sa, Re, Ga, SA], avaroha: [SA, Ga, Re, Sa], pakad: [Pa, null, Dha] };
  assert.equal(moveOk(r, Pa, Dha), false, 'Pa, breath, Dha is not a Pa → Dha move');
  assert.equal(moveOk(r, Pa, Sa), false, 'a breath is not Sa: Pa, breath is not a Pa → Sa move (#75 review, finding 2)');
  assert.equal(moveOk({ ...r, pakad: [Pa, Dha] }, Pa, Dha), true, 'Pa → Dha with no breath is');
});

test('every move in each raga’s aroha, avaroha and pakad is allowed, with the note before it', () => {
  for (const [name, r] of Object.entries(RAGAS)) {
    const segs = [r.aroha, r.avaroha, r.pakad];
    for (const s of segs) for (let i = 0; i + 1 < s.length; i++) {
      if (s[i] === null || s[i + 1] === null) continue;
      const prev = i > 0 && s[i - 1] !== null ? s[i - 1] : undefined;
      assert.equal(moveOk(r, s[i], s[i + 1], prev), true, `${name}: ${prev} ${s[i]} → ${s[i + 1]}`);
    }
  }
});

let server;
before(async () => { server = await startServer(); });
after(() => server && server.stop());

test('browser, Yaman strict: Ma♯ then Pa plays; Pa then Dha is blocked with the new message', async () => {
  const app = await openApp(server, null);
  try {
    const { page } = app;
    const tap = (i) => page.click(`.key[data-i="${i}"]`);
    await tap(Mat);
    await tap(Pa);
    assert.equal(await page.$eval('#status', (e) => e.classList.contains('bad')), false, 'Ma♯ → Pa not blocked');
    await tap(Dha);
    const st = await page.$eval('#status', (e) => ({ bad: e.classList.contains('bad'), text: e.textContent }));
    assert.equal(st.bad, true, 'Pa → Dha blocked');
    assert.match(st.text, /^After Pa .*Yaman goes down: Pa isn’t used going up\.$/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('browser, Bihag strict: Pa Ma♯ Pa plays; Ga Ma♯ Pa is blocked at Pa', async () => {
  const app = await openApp(server, null);
  try {
    const { page } = app;
    await page.selectOption('#scale', 'Bihag');
    const tap = (i) => page.click(`.key[data-i="${i}"]`);
    const bad = () => page.$eval('#status', (e) => e.classList.contains('bad'));
    await tap(Pa); await tap(Mat); await tap(Pa);
    assert.equal(await bad(), false, 'Pa Ma♯ Pa not blocked');
    await tap(Ga); await tap(Mat); await tap(Pa);
    assert.equal(await bad(), true, 'Ga Ma♯ Pa blocked');
    assert.match(await page.$eval('#status', (e) => e.textContent),
      /^After Ma♯ .*Bihag goes down: Ma♯ isn’t used going up, except in the turn Pa Ma♯ Pa\.$/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
