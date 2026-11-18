// Hold-a-note exercise tests (#29, #38): the same fake-mic voices, asserting on the progress bar and the result text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, wait } from './harness.mjs';

let server;
before(async () => { server = await startServer(); });
after(() => server.stop());

// Starts the hold exercise on Sa (the default target, 5 s) and samples the progress bar every 100 ms.
async function holdSa(voice, live) {
  const app = await openApp(server, voice);
  try {
    if (live) await app.page.click('#tmLive');
    await app.page.click('#holdBtn');                                // starts the tuner too
    assert.equal(await app.page.getAttribute('#holdNotes [aria-label="Hold Sa"]', 'aria-pressed'), 'true');
    let barMax = 0;
    const end = Date.now() + app.secs * 1000 + 1000;
    while (Date.now() < end) {
      barMax = Math.max(barMax, Number(await app.page.getAttribute('#holdBar', 'aria-valuenow')));
      await wait(100);
    }
    assert.deepEqual(app.errors, []);
    return { barMax, result: await app.page.textContent('#holdResult') };
  } finally { await app.close(); }
}

test('steady Sa for 6 s: bar fills, well held, steady, on the note', async () => {
  const r = await holdSa('holdSteady');
  assert.equal(r.barMax, 5);
  assert.match(r.result, /Well held/);
  assert.match(r.result, /Steadiness: steady/);
  assert.match(r.result, /Pitch: on the note/);
  assert.match(r.result, /try 8 seconds/);
});

test('Sa sung 40¢ flat, Live mode: the bar does not fill, and the result says about 40¢ flat', async () => {
  const r = await holdSa('holdFlat', true);
  assert.ok(r.barMax < 0.5, 'bar reached ' + r.barMax);
  assert.doesNotMatch(r.result, /Well held/);
  const m = r.result.match(/Pitch: about (\d+)¢ flat/);
  assert.ok(m && Math.abs(Number(m[1]) - 40) <= 5, r.result);
  assert.match(r.result, /Try lifting the note slightly/);
});

test('Sa with a ±35¢ wobble: wavering', async () => {
  const r = await holdSa('holdWobble');
  assert.match(r.result, /Steadiness: wavering/);
  assert.doesNotMatch(r.result, /Well held/);
});
