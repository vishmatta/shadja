// Phrase feedback uses the raga's rules (#68): checkPhrase(target, sung, raga) gives one plain-language reason, the
// first raga rule the sung notes break. Pure cases run in Node; browser cases check call and response, the tuner
// history, tapped keys and Western mode.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadRagas, loadFunctions } from './source.mjs';
import { startServer, openApp } from './harness.mjs';
import { SA, synth } from './voices.mjs';

const RAGAS = loadRagas();
const { checkPhrase, phraseRules } = loadFunctions(['checkPhrase', 'phraseRules', 'moveOk', 'moveWhy']);
const Sa = 0, Re = 2, ga = 3, Ga = 4, Ma = 5, Mat = 6, Pa = 7, Dha = 9, ni = 10, Ni = 11, SA_ = 12;
const raga = (name) => ({ name, r: RAGAS[name] });
const sung = (...ns) => ns.map((n) => ({ n, c: 0 }));
// The reason for a sung phrase, against a target that breaks no rule (just Sa), unless a target is given.
const why = (name, ns, target) => checkPhrase(target || [Sa], sung(...ns), raga(name)).why;

test('Bhimpalasi: wrong direction, non-resting end, note outside the raga', () => {
  assert.equal(why('Bhimpalasi', [Sa, Re, ga, Ma]), 'After Re, Bhimpalasi goes down: Re isn’t used going up.');
  assert.equal(why('Bhimpalasi', [Ma, ga, Re]), 'Re isn’t a resting note in Bhimpalasi. Try ending on Ma, Pa or Sa.');
  assert.equal(why('Bhimpalasi', [Sa, ga, Ga, Ma]), 'Ga isn’t in Bhimpalasi.');
  assert.equal(why('Bhimpalasi', [-2, Sa, ga, Ma, Pa, Ma, ga, Re, Sa]), null, 'its own aroha and avaroha pass');
});

test('Khamaj: Ni going down, Ni then Ni♭ back to back, non-resting end', () => {
  assert.equal(why('Khamaj', [Pa, Dha, Ni, Dha, Pa]), 'After Ni, Khamaj goes up: Ni isn’t used going down.');
  assert.equal(why('Khamaj', [Dha, Ni, ni, Dha, Pa]),
    'Ni then Ni♭: two forms of Ni back to back. Khamaj never puts them side by side; sing another note between them.');
  assert.equal(why('Khamaj', [Sa, Ga, Re]), 'Re isn’t a resting note in Khamaj. Try ending on Ga, Pa or Sa.');
  assert.equal(why('Khamaj', [Pa, Dha, Ni, SA_, ni, Dha, Pa]), null, 'Ni up, Ni♭ down passes');
});

test('Yaman: Pa going up, Ma♯ end, natural Ma outside; Sa always counts as a resting note', () => {
  assert.equal(why('Yaman', [Ga, Pa, Dha, Ni]), 'After Pa, Yaman goes down: Pa isn’t used going up.');
  assert.equal(why('Yaman', [Re, Ga, Mat]), 'Ma♯ isn’t a resting note in Yaman. Try ending on Ga, Re, Ni, Pa or Sa.');
  assert.equal(why('Yaman', [Ga, Ma, Ga]), 'Ma isn’t in Yaman.');
  assert.equal(why('Yaman', [-1, Re, Ga, Re, Sa]), null, 'its pakad ending on Sa passes');
  assert.equal(why('Yaman', [Mat, Pa, Mat, Ga]), null, 'Ma♯ → Pa (reached from below) passes (#74)');
});

test('Bihag: Pa Ma♯ Pa passes; Ga Ma♯ Pa is flagged; Ma then Ma♯ is back to back', () => {
  assert.equal(why('Bihag', [Pa, Mat, Pa, Ga]), null);
  assert.equal(why('Bihag', [Ga, Mat, Pa]), 'After Ma♯, Bihag goes down: Ma♯ isn’t used going up, except in the turn Pa Ma♯ Pa.');
  assert.equal(why('Bihag', [Ga, Ma, Mat, Ga]),
    'Ma then Ma♯: two forms of Ma back to back. Bihag never puts them side by side; sing another note between them.');
});

test('only the first reason is given', () => {
  // Re going up (2nd move) comes before the non-resting end on Dha.
  assert.equal(why('Bhimpalasi', [Sa, Re, ga, Ma, Pa, Dha]), 'After Re, Bhimpalasi goes down: Re isn’t used going up.');
  assert.equal(phraseRules([Sa, Re, ga, Ma, Pa, Dha], raga('Bhimpalasi')).length, 2, 'Re going up, and the end on Dha');
});

test('a rule the target phrase breaks the same way is not held against you', () => {
  // A phrase from the app may itself stop on Re; singing it back exactly is right.
  assert.equal(why('Khamaj', [Ga, Re], [Ga, Re]), null);
  assert.equal(why('Khamaj', [Ga, Re], [Ga, Pa]), 'Re isn’t a resting note in Khamaj. Try ending on Ga, Pa or Sa.');
});

test('repeated notes and breaths do not make a move', () => {
  assert.equal(why('Yaman', [Pa, Pa, Ga]), null, 'Pa Pa Ga: Pa then down');
  assert.equal(phraseRules([Pa, null, Pa, Ga], raga('Yaman')).length, 0);
  assert.equal(why('Yaman', [Ga, Pa, Pa, Dha]), 'After Pa, Yaman goes down: Pa isn’t used going up.');
});

test('open phrase (tuner history): no ending rule; each reason names the note it is about', () => {
  assert.deepEqual(phraseRules([Re, Ga, Mat], raga('Yaman'), true), []);
  assert.deepEqual(phraseRules([Sa, Re, Re, ga], raga('Bhimpalasi'), true),
    [{ at: 3, why: 'After Re, Bhimpalasi goes down: Re isn’t used going up.' }]);
});

test('no raga (Western mode): no why, and the result is exactly as before', () => {
  const r = checkPhrase([Ga, Pa, Dha], sung(Ga, Pa, Dha));
  assert.equal('why' in r, false);
  assert.deepEqual(r.results.map((x) => x.status), ['right', 'right', 'right']);
});

test('pure: inputs unchanged', () => {
  const t = [Ga, null, Pa], s = sung(Ga, Pa, Dha), t0 = JSON.stringify(t), s0 = JSON.stringify(s);
  checkPhrase(t, s, raga('Yaman')); checkPhrase(t, s, raga('Yaman'));
  assert.equal(JSON.stringify(t), t0);
  assert.equal(JSON.stringify(s), s0);
});

// Browser: the mic is the shim's mixer; the test hears the app's phrase, then sings its own notes during "Your turn".
let server;
before(async () => { server = await startServer(); });
after(() => server && server.stop());

async function echoRound(app, setup) {
  const { page } = app;
  if (setup) await setup(page);
  await page.click('#echoMic');
  await page.waitForFunction(() => document.getElementById('echoMic').getAttribute('aria-pressed') === 'true');
  await page.evaluate(() => { window.__mic.tones = []; });
  await page.click('#echoNew');
  await page.waitForFunction(() => /Your turn/.test(document.getElementById('echoResult').textContent), null, { timeout: 15000 });
  const freqs = await page.evaluate(() => window.__mic.tones);
  return freqs.map((f) => Math.round(12 * Math.log2(f / SA)));
}
function singNotes(page, ns) {
  const parts = [];
  ns.forEach((n) => parts.push({ n, dur: 0.6 }, { rest: 0.12 }));
  return page.evaluate((x) => window.__mic.say(x), Array.from(synth(parts, { floor: 0 })));
}
async function answer(page) {
  await page.waitForFunction(() => /right\./.test(document.getElementById('echoResult').textContent), null, { timeout: 15000 });
  return page.textContent('#echoResult');
}

test('browser, Yaman: Pa Dha Ni sung back gets the direction reason, in call and response and the tuner history', async () => {
  const app = await openApp(server, null, { mix: true });
  try {
    await echoRound(app);
    await singNotes(app.page, [Pa, Dha, Ni]);
    const text = await answer(app.page);
    assert.match(text, /After Pa, Yaman goes down: Pa isn’t used going up\./, text);
    const hw = await app.page.$eval('#tHistWhy', (e) => ({ hidden: e.hidden, text: e.textContent }));
    assert.deepEqual(hw, { hidden: false, text: 'After Pa, Yaman goes down: Pa isn’t used going up.' });
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('browser, Yaman: tapped keys still win over sung notes', async () => {
  const app = await openApp(server, null, { mix: true });
  try {
    const phrase = await echoRound(app);
    await singNotes(app.page, [Pa, Dha, Ni]);
    for (const n of phrase) await app.page.click(`.key[data-i="${n}"]`);
    const text = await answer(app.page);
    assert.match(text, new RegExp('^' + phrase.length + ' of ' + phrase.length + ' right\\.'), text + ' / ' + JSON.stringify(phrase));
    assert.doesNotMatch(text, /notes right|Yaman goes/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('browser, Western mode: no raga rule messages', async () => {
  const app = await openApp(server, null, { mix: true });
  try {
    await echoRound(app, (page) => page.click('#sW'));
    await singNotes(app.page, [Pa, Dha, Ni, Re]);
    const text = await answer(app.page);
    assert.match(text, /notes right/, text);
    assert.doesNotMatch(text, /goes (up|down)|resting note|back to back|isn’t in/, text);
    assert.equal(await app.page.$eval('#echoResult', (e) => e.querySelector('.echo-why') === null), true);
    assert.equal(await app.page.$eval('#tHistWhy', (e) => e.hidden), true);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
