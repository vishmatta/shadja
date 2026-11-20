// "What makes a raga?" explainer (#71): hidden in Western mode, fits one phone screen, AA contrast in both themes,
// accessible names, and every link reaches (scrolls to and focuses) its target.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); server.stop(); });

// A phone-sized page: 380 px wide, the iPhone's 763 px Safari viewport height.
async function phone(colorScheme = 'light') {
  const page = await browser.newPage({ viewport: { width: 380, height: 763 }, colorScheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(server.url + 'index.html');
  return { page, errors };
}

test('shown (folded) in raga mode, hidden in Western mode, back in raga mode', async () => {
  const { page, errors } = await phone();
  try {
    assert.equal(await page.isVisible('#whatPanel'), true);
    assert.equal(await page.$eval('#whatPanel', (d) => d.open), false);
    assert.equal(await page.textContent('#whatPanel > summary'), 'What makes a raga?');
    await page.click('#sW');
    assert.equal(await page.isHidden('#whatPanel'), true);
    await page.click('#sH');
    assert.equal(await page.isVisible('#whatPanel'), true);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('eight lines, each with a named link button that points at an existing control', async () => {
  const { page } = await phone();
  try {
    const items = await page.$$eval('#whatPanel ol.what > li', (lis) => lis.map((li) => {
      const b = li.querySelector('button.go');
      const id = b && b.getAttribute('aria-controls');
      return { text: li.textContent, type: b && b.type, label: b && b.getAttribute('aria-label'), target: id, exists: !!(id && document.getElementById(id)) };
    }));
    assert.equal(items.length, 8);
    for (const it of items) {
      assert.equal(it.type, 'button', it.text);
      assert.ok(it.label && it.label.length > 5, 'no accessible name: ' + it.text);
      assert.ok(it.exists, 'target #' + it.target + ' missing for: ' + it.text);
    }
    for (const word of ['Sa', 'Audav', 'Shadav', 'Sampurna', 'Ma and Pa', 'aroha', 'avaroha', 'vadi', 'samvadi', 'pakad', 'meend', 'andolan', 'rasa']) {
      assert.ok(items.some((it) => it.text.includes(word)), 'missing ' + word);
    }
  } finally { await page.close(); }
});

test('each link opens its panel, scrolls its target on screen and focuses it', async () => {
  const { page, errors } = await phone();
  try {
    const n = await page.$$eval('#whatPanel .go', (bs) => bs.length);
    assert.equal(n, 8);
    for (let i = 0; i < n; i++) {
      // Start each time with Raga rules folded, so a link has to open it.
      await page.evaluate(() => { document.getElementById('ragaPanel').open = false; document.getElementById('whatPanel').open = true; });
      const go = page.locator('#whatPanel .go').nth(i);
      const target = await go.getAttribute('aria-controls');
      await go.click();
      const r = await page.evaluate((id) => {
        const el = document.getElementById(id), box = el.getBoundingClientRect(), d = el.closest('details');
        return { focused: document.activeElement === el, top: box.top, bottom: box.bottom, h: innerHeight, open: d ? d.open : true, w: box.width };
      }, target);
      assert.ok(r.focused, '#' + target + ' not focused');
      assert.ok(r.open, '#' + target + ' is inside a folded panel');
      assert.ok(r.w > 0 && r.top >= 0 && r.bottom <= r.h, '#' + target + ' not on screen: ' + JSON.stringify(r));
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('expanded, it fits one 380×763 screen with no sideways scroll', async () => {
  const { page } = await phone();
  try {
    await page.click('#whatPanel > summary');
    const r = await page.evaluate(() => ({
      h: document.getElementById('whatPanel').getBoundingClientRect().height,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    }));
    assert.ok(r.h <= 763, 'panel is ' + r.h + ' px tall');
    assert.ok(r.sw <= r.cw, 'horizontal scroll: ' + r.sw + ' > ' + r.cw);
  } finally { await page.close(); }
});

test('desktop 1440×790: the stage stays pinned on screen while Raga rules is read', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 790 } });
  try {
    await page.goto(server.url + 'index.html');
    assert.equal(await page.$eval('#ragaPanel', (d) => d.open), true);   // open by default on a wide screen
    const top = await page.evaluate(async () => {
      document.getElementById('ragaPanel').scrollIntoView({ block: 'start' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return document.getElementById('stage').getBoundingClientRect().top;
    });
    assert.ok(top >= 0 && top <= 40, 'stage top is ' + top + ' px');
  } finally { await page.close(); }
});

for (const scheme of ['light', 'dark']) {
  test('text contrast is at least 4.5:1 (WCAG AA) in the ' + scheme + ' theme', async () => {
    const { page } = await phone(scheme);
    try {
      await page.click('#whatPanel > summary');
      const rows = await page.evaluate(() => {
        const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
        const lum = (c) => {
          const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bg = lum(rgb(getComputedStyle(document.getElementById('whatPanel')).backgroundColor));
        const els = [...document.querySelectorAll('#whatPanel summary, #whatPanel .what-lede, #whatPanel li, #whatPanel li b, #whatPanel .go')];
        return els.map((e) => {
          const a = lum(rgb(getComputedStyle(e).color));
          return { el: e.tagName + '.' + e.className, ratio: (Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05) };
        });
      });
      assert.ok(rows.length >= 26, 'only ' + rows.length + ' elements checked');
      for (const r of rows) assert.ok(r.ratio >= 4.5, r.el + ' is ' + r.ratio.toFixed(2) + ':1');
    } finally { await page.close(); }
  });
}
