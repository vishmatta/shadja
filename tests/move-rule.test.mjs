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
const ok = (raga, from, to) => moveOk(RAGAS[raga], from, to);

test('Yaman: Pa may be reached from below, but the next note must be lower', () => {
  assert.equal(ok('Yaman', Mat, Pa), true, 'Ma♯ → Pa');
  assert.equal(ok('Yaman', Ga, Pa), true, 'Ga → Pa');
  assert.equal(ok('Yaman', Pa, Mat), true, 'Pa → Ma♯');
  assert.equal(ok('Yaman', Pa, Dha), false, 'Pa → Dha');
  assert.equal(ok('Yaman', Pa, Ni), false, 'Pa → Ni');
});

test('Bihag: its own Pa Ma♯ Pa turn is allowed; Ma♯ never goes on up past Pa', () => {
  assert.equal(ok('Bihag', Pa, Mat), true, 'Pa → Ma♯');
  assert.equal(ok('Bihag', Mat, Pa), true, 'Ma♯ → Pa');
  assert.equal(ok('Bihag', Mat, Dha), false, 'Ma♯ → Dha');
});

test('Bageshree: the avaroha’s Ma Pa Dha is allowed', () => {
  assert.equal(ok('Bageshree', Ma, Pa), true, 'Ma → Pa');
  assert.equal(ok('Bageshree', Pa, Dha), true, 'Pa → Dha');
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
  assert.equal(moveOk({ ...r, pakad: [Pa, Dha] }, Pa, Dha), true, 'Pa → Dha with no breath is');
});

test('every move between consecutive aroha, avaroha and pakad notes is allowed', () => {
  for (const [name, r] of Object.entries(RAGAS)) {
    const segs = [r.aroha, r.avaroha, r.pakad];
    for (const s of segs) for (let i = 0; i + 1 < s.length; i++) {
      if (s[i] === null || s[i + 1] === null) continue;
      assert.equal(moveOk(r, s[i], s[i + 1]), true, `${name}: ${s[i]} → ${s[i + 1]}`);
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
