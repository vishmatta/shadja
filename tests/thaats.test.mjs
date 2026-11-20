// Thaats (#69): the 10 parent scales play through the normal player, every raga shows its thaat, the panels fit a
// 380 px phone in light and dark, and Western mode is unchanged.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRagas, loadThaats, loadVar } from './source.mjs';
import { startServer, openApp, wait, ROOT } from './harness.mjs';
import { THAATS_EXPECTED } from './thaat-table.mjs';

const RAGAS = loadRagas();
const THAATS = loadThaats();
const SCALES = loadVar('SCALES');
const SA_MIDI = 48;                                     // default Sa: C3 (root 0, octave 3)
const offsetOf = (f) => Math.round(12 * Math.log2(f / 440) + 69 - SA_MIDI);

let server;
before(async () => { server = await startServer(); });
after(() => server.stop());

// Plays one thing and returns the semitone offsets of the piano notes it scheduled (triangle oscillators).
async function notesOf(page, click, doneText) {
  await page.evaluate(() => { window.__mic.tones = []; });
  await page.click(click);
  await page.waitForFunction(([sel, t]) => document.querySelector(sel).textContent.trim() === t, [click, doneText], { timeout: 20000, polling: 100 });
  return (await page.evaluate(() => window.__mic.tones)).map(offsetOf);
}
async function fast(page) {
  await page.evaluate(() => { const b = document.getElementById('bpm'); b.value = 160; b.dispatchEvent(new Event('input')); });
}

test('the THAATS table: each thaat changes exactly one note from the one it names', () => {
  const names = Object.keys(THAATS);
  assert.deepEqual(names.slice(0, 6), ['Kalyan', 'Bilawal', 'Khamaj', 'Kafi', 'Asavari', 'Bhairavi'], 'the chain comes first, in order');
  for (const [name, t] of Object.entries(THAATS)) {
    assert.deepEqual(t.notes, THAATS_EXPECTED[name], name);
    if (name === 'Kalyan') { assert.equal(t.from, ''); continue; }
    const f = THAATS[t.from];
    assert.ok(f, `${name}: from "${t.from}" is not a thaat`);
    const now = t.notes.filter((n) => !f.notes.includes(n)), was = f.notes.filter((n) => !t.notes.includes(n));
    assert.equal(now.length, 1, `${name} vs ${t.from}: ${now}`); assert.equal(was.length, 1);
  }
  for (let i = 1; i < 6; i++) assert.equal(THAATS[names[i]].from, names[i - 1], `${names[i]} follows the chain`);
});

test('all 10 thaats play their seven notes up to upper Sa and back down', async () => {
  const app = await openApp(server, null);
  try {
    await fast(app.page);
    await app.page.click('#thaatPanel summary');
    for (const name of Object.keys(THAATS_EXPECTED)) {
      const sel = `#thaatList button[data-thaat="${name}"]`;
      const got = await notesOf(app.page, sel, 'Play');
      const up = [...THAATS_EXPECTED[name], 12];
      assert.deepEqual(got, [...up, ...up.slice(0, -1).reverse()], name);
    }
    // The button reads Stop while it plays, with aria-pressed, and a second press stops it.
    const b = '#thaatList button[data-thaat="Todi"]';
    await app.page.click(b);
    assert.equal(await app.page.getAttribute(b, 'aria-pressed'), 'true');
    assert.equal(await app.page.textContent(b), 'Stop');
    await app.page.click(b);
    assert.equal(await app.page.getAttribute(b, 'aria-pressed'), 'false');
    assert.equal(await app.page.textContent(b), 'Play');
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('every raga shows its thaat in the raga rules, and its Play button plays that thaat', async () => {
  const app = await openApp(server, null);
  try {
    await fast(app.page);
    await app.page.click('#ragaPanel summary');
    for (const [name, r] of Object.entries(RAGAS)) {
      await app.page.selectOption('#scale', name);
      assert.match(await app.page.textContent('#ragaThaat'), new RegExp('^Parent scale \\(thaat\\): ' + r.thaat + ' · '), name);
      assert.equal(await app.page.$eval('#thaatList li.cur', (li) => li.dataset.thaat), r.thaat, name);
      assert.equal(await app.page.$eval('#thaatList [data-raga].cur', (s) => s.dataset.raga), name);
      assert.match(await app.page.getAttribute('#ragaThaatPlay', 'aria-label'), new RegExp('Play ' + r.thaat + ' thaat'));
    }
    await app.page.selectOption('#scale', 'Kafi');
    const got = await notesOf(app.page, '#ragaThaatPlay', 'Play its 7 notes');
    assert.deepEqual(got.slice(0, 8), [...THAATS_EXPECTED.Kafi, 12]);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

for (const scheme of ['light', 'dark']) {
  test(`layout at 380 px wide, ${scheme}: thaat panels fit, buttons are tappable, text passes AA`, async () => {
    const app = await openApp(server, null);
    try {
      const { page } = app;
      await page.setViewportSize({ width: 380, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.click('#thaatPanel summary');
      await page.evaluate(() => { document.getElementById('ragaPanel').open = true; });
      await page.selectOption('#scale', 'Bhairav');
      const r = await page.evaluate(() => {
        const lum = (c) => {
          const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bgOf = (el) => { for (; el; el = el.parentElement) { const b = getComputedStyle(el).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(b)) return b; } return 'rgb(255,255,255)'; };
        const ratio = (el) => { const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
        const sels = ['.thaat-name', '.thaat-west', '.thaat-notes', '.thaat-notes .chg', '.thaat-from', '.thaat-ragas', '.thaat-ragas .cur', '#ragaThaat', '#thaatList button', '#ragaThaatPlay'];
        const contrast = Object.fromEntries(sels.map((s) => [s, Math.min(...[...document.querySelectorAll(s)].map(ratio))]));
        const over = [...document.querySelectorAll('#thaatPanel *, #ragaPanel .thaat-line *')]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.left < 0 || b.right > 380); })
          .map((e) => e.className || e.id || e.tagName);
        const btns = [...document.querySelectorAll('#thaatList button, #ragaThaatPlay')].map((b) => b.getBoundingClientRect().height);
        return { scroll: document.documentElement.scrollWidth, contrast, over, minBtn: Math.min(...btns) };
      });
      fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
      await (await page.$('#thaatPanel')).screenshot({ path: path.join(ROOT, 'tests', '.out', `thaats-380-${scheme}.png`) });
      await (await page.$('#ragaPanel')).screenshot({ path: path.join(ROOT, 'tests', '.out', `raga-thaat-380-${scheme}.png`) });
      assert.ok(r.scroll <= 380, `page scrolls sideways: ${r.scroll}px`);
      assert.deepEqual(r.over, [], 'elements past the 380 px edge');
      assert.ok(r.minBtn >= 44, `a button is ${r.minBtn}px tall`);
      for (const [s, c] of Object.entries(r.contrast)) assert.ok(c >= 4.5, `${s}: contrast ${c.toFixed(2)} < 4.5`);
      assert.deepEqual(app.errors, []);
    } finally { await app.close(); }
  });
}

test('Western mode is unchanged: no thaat panels, and Play scale plays the scale', async () => {
  const app = await openApp(server, null);
  try {
    const { page } = app;
    await fast(page);
    await page.click('#sW');
    assert.equal(await page.$eval('#thaatPanel', (e) => e.hidden), true);
    assert.equal(await page.$eval('#ragaPanel', (e) => e.hidden), true);
    const scale = await page.$eval('#scale', (s) => s.value);
    assert.ok(scale in SCALES, scale);
    assert.equal(await page.textContent('#play'), 'Play scale');
    const got = await notesOf(page, '#play', 'Play scale');
    assert.deepEqual(got, [...SCALES[scale], 12], scale);
    // Back to Hindustani: the panels return.
    await page.click('#sH');
    assert.equal(await page.$eval('#thaatPanel', (e) => e.hidden), false);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});
