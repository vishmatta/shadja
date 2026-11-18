// Tuner tests: synthetic voices through Chromium's fake mic, asserting on the note history (#16, #17, #23).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, history, wait } from './harness.mjs';

let server;
before(async () => { server = await startServer(); });
after(() => server.stop());

// Starts the tuner on a voice, waits for the whole voice plus a second, returns the note history.
async function sing(voice, setup) {
  const app = await openApp(server, voice);
  try {
    if (setup) await setup(app.page);
    await app.page.click('#tunerBtn');
    await wait(app.secs * 1000 + 1000);
    assert.deepEqual(app.errors, []);
    return { hist: await history(app.page), status: await app.page.textContent('#tStatus'), page: app.page, close: app.close };
  } catch (e) { await app.close(); throw e; }
}
const notes = (h) => h.map((e) => e.note);
const near = (got, want, tol, msg) => assert.ok(got !== null && Math.abs(got - want) <= tol, msg + ': got ' + got + ', want ' + want + ' ±' + tol);

test('held notes at known offsets: Sa in tune, Re 28¢ flat, Ga 35¢ sharp', async () => {
  const r = await sing('held'); await r.close();
  assert.deepEqual(notes(r.hist), ['Sa', 'Re', 'Ga']);
  assert.ok(r.hist[0].ok, 'Sa ✓');
  near(r.hist[1].cents, -28, 5, 'Re');
  near(r.hist[2].cents, 35, 5, 'Ga');
});

test('legato Sa Re Ga, back to back with no gap: each note gets a result (#16)', async () => {
  const r = await sing('legato'); await r.close();
  assert.deepEqual(notes(r.hist), ['Sa', 'Re', 'Ga']);
  assert.ok(r.hist.every((e) => e.ok), JSON.stringify(r.hist));
  assert.match(r.status, /Listening/);                               // status line, never over the result
});

test('a 0.4 s note is counted (#16)', async () => {
  const r = await sing('short04'); await r.close();
  assert.deepEqual(notes(r.hist), ['Ga']);
});

test('a 0.2 s note is too short: no result, and a hint in the status line', async () => {
  const r = await sing('short02'); await r.close();
  assert.deepEqual(r.hist, []);
  assert.match(r.status, /too short/);
});

test('a scoop into Re from a semitone below gives one Re (#16)', async () => {
  const r = await sing('scoop'); await r.close();
  assert.deepEqual(notes(r.hist), ['Re']);
  assert.ok(r.hist[0].ok, JSON.stringify(r.hist));
});

test('a 0.1 s voice crack in the middle of Re does not split it: one Re (#16 hysteresis)', async () => {
  const r = await sing('crack'); await r.close();
  assert.deepEqual(notes(r.hist), ['Re'], JSON.stringify(r.hist));
});

test('gentle vibrato (±30¢) on Ga gives one Ga (#16)', async () => {
  const r = await sing('vibrato'); await r.close();
  assert.deepEqual(notes(r.hist), ['Ga']);
});

test('quiet humming (RMS about 0.003) is still heard (#16)', async () => {
  const r = await sing('quiet'); await r.close();
  assert.deepEqual(notes(r.hist), ['Sa']);
});

test('room noise only: no notes', async () => {
  const r = await sing('silence'); await r.close();
  assert.deepEqual(r.hist, []);
});

// Drone bleed (#17): the app's real output is fed back into the mic 60 ms late at half level, like a phone speaker.
// The voice is 2.5 s of quiet (the tuner's 2 s drone check), Ga, then 2.5 s of quiet with only the drone.
test('drone bleeding into the mic: only the sung Ga, no false Sa or Pa (#17)', async () => {
  const app = await openApp(server, 'bleed', { bleed: 0.5 });
  try {
    await app.page.click('#droneBtn');
    await wait(300);
    await app.page.click('#tunerBtn');
    await wait(app.secs * 1000 + 1000);
    assert.deepEqual(app.errors, []);
    const h = await history(app.page);
    assert.deepEqual(notes(h), ['Ga'], JSON.stringify(h));
    // the drone really reached the mic, so this test isn't passing on silence
    const k = Number((await app.page.textContent('#micCheck')).match(/Drone reaching the mic: [a-z ]+\(([\d.]+)\)/)[1]);
    assert.ok(k > 0.25 && k < 0.8, 'measured leak ' + k);
  } finally { await app.close(); }
});

test('Live mode shows the note while it is sung', async () => {
  const app = await openApp(server, 'live');
  try {
    await app.page.click('#tmLive');
    await app.page.click('#tunerBtn');
    await wait(2200);                                                // 1 s quiet, then 1.2 s into Ga
    assert.match(await app.page.textContent('#tNote'), /^Ga/);
    assert.equal(await app.page.$eval('#tNeedle', (e) => e.classList.contains('hide')), false);
    assert.equal(await app.page.getAttribute('#tmLive', 'aria-pressed'), 'true');
  } finally { await app.close(); }
});

test('Western mode: the same legato run reads C3 D3 E3', async () => {
  const r = await sing('legato', (page) => page.click('#sW')); await r.close();
  assert.deepEqual(notes(r.hist), ['C3', 'D3', 'E3']);
});

// Mic settings (#17): the constraints the app passes to getUserMedia.
test('mic cleanup sends echoCancellation as a plain boolean, and the switch restarts the mic', async () => {
  const app = await openApp(server, 'silence');
  try {
    await app.page.click('#tunerBtn');
    await app.page.click('#micBox summary');                         // open "Mic settings and check"
    await wait(500);
    await app.page.click('#mcOff');
    await wait(500);
    await app.page.click('#mcOn');
    await wait(500);
    const calls = await app.page.evaluate(() => window.__mic.calls);
    assert.deepEqual(calls.map((c) => c.audio.echoCancellation), [true, false, true]);
    calls.forEach((c) => { assert.equal(c.audio.noiseSuppression, false); assert.equal(c.audio.autoGainControl, false); assert.equal(c.audio.deviceId, undefined); });
    assert.equal(await app.page.getAttribute('#mcOn', 'aria-pressed'), 'true');
    assert.match(await app.page.textContent('#micCheck'), /Cleanup in use: on/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('choosing a mic sends deviceId exact; a missing mic falls back to the default', async () => {
  const app = await openApp(server, 'silence');
  try {
    await app.page.click('#tunerBtn');
    await wait(500);
    // a mic that isn't there (unplugged since it was chosen): Chromium rejects it with OverconstrainedError
    await app.page.evaluate(() => {
      const s = document.getElementById('micSel'), o = document.createElement('option');
      o.value = 'gone-mic'; o.textContent = 'Gone'; s.appendChild(o); s.value = 'gone-mic';
      s.dispatchEvent(new Event('change'));
    });
    await wait(800);
    const calls = await app.page.evaluate(() => window.__mic.calls);
    assert.deepEqual(calls[1].audio.deviceId, { exact: 'gone-mic' });
    assert.equal(calls[2].audio.deviceId, undefined);
    assert.match(await app.page.textContent('#tMsg'), /default one is in use/);
    assert.equal(await app.page.textContent('#tunerBtn'), 'Stop tuner');
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
