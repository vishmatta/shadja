// Raga rules test (#66): checks every raga in RAGAS against the grammar every raga follows.
// Pure data test: no browser. The `var RAGAS = {...};` block is lifted out of index.html as text and evaluated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(process.env.SHADJA_SITE || ROOT);   // same switch as harness.mjs

function loadRagas() {
  const src = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const start = src.indexOf('var RAGAS = {');
  assert.ok(start > -1, 'var RAGAS not found in index.html');
  // Match braces, skipping anything inside strings and comments, so a "{" or "}" in raga text can't end the block early.
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i); if (i < 0) i = src.length;
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 1;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  try {
    return new Function('return ' + src.slice(open, i + 1))();
  } catch (e) {
    throw new Error('could not parse RAGAS from index.html: ' + e.message);
  }
}

// Pitch class (0..11) of a semitone offset from Sa; works for lower and upper octaves.
const pc = (n) => ((n % 12) + 12) % 12;
// Swara (note name) of each pitch class: two forms of one note (Re♭ and Re, Ma and Ma♯…) are one swara.
const SWARA = ['Sa', 'Re', 'Re', 'Ga', 'Ga', 'Ma', 'Ma', 'Pa', 'Dha', 'Dha', 'Ni', 'Ni'];
const NAME = ['Sa', 'Re♭', 'Re', 'Ga♭', 'Ga', 'Ma', 'Ma♯', 'Pa', 'Dha♭', 'Dha', 'Ni♭', 'Ni'];

// The 10 thaats (parent scales), as pitch classes.
export const THAATS = {
  Kalyan:   [0, 2, 4, 6, 7, 9, 11],
  Bilawal:  [0, 2, 4, 5, 7, 9, 11],
  Khamaj:   [0, 2, 4, 5, 7, 9, 10],
  Kafi:     [0, 2, 3, 5, 7, 9, 10],
  Asavari:  [0, 2, 3, 5, 7, 8, 10],
  Bhairavi: [0, 1, 3, 5, 7, 8, 10],
  Bhairav:  [0, 1, 4, 5, 7, 8, 11],
  Poorvi:   [0, 1, 4, 6, 7, 8, 11],
  Marwa:    [0, 1, 4, 6, 7, 9, 11],
  Todi:     [0, 1, 3, 6, 7, 8, 11],
};

// Rule 4 allow-list: raga name → pitch-class pairs that may sit back to back. Empty today.
// (If Lalit is added, it needs [5, 6]: Lalit sings Ma and Ma♯ one after the other.)
const ADJACENT_OK = {};

// Rule 6 allow-list: raga name → pitch classes allowed outside its thaat.
const THAAT_OK = {
  // Bihag is in Bilawal thaat but uses Ma♯ as a passing note in the turn Pa Ma♯ Pa.
  'Bihag': [6],
  // Khamaj (the raga) climbs with shuddha Ni and comes down with Ni♭. Khamaj thaat has only Ni♭.
  'Khamaj': [11],
};

const ALTERED_PAIRS = [[1, 2], [3, 4], [5, 6], [8, 9], [10, 11]];

// Runs every rule on one raga. Returns { failures: [...], warnings: [...] }, each message naming raga and rule.
export function checkRaga(name, r, opts = {}) {
  const adjOk = (opts.adjacentOk || ADJACENT_OK)[name] || [];
  const thaatOk = (opts.thaatOk || THAAT_OK)[name] || [];
  const failures = [], warnings = [];
  const fail = (rule, msg) => failures.push(`${name}: rule ${rule}: ${msg}`);
  const notes = new Set([...r.aroha, ...r.avaroha].map(pc));
  const names = (ns) => [...ns].map((n) => NAME[pc(n)]).join(', ');

  // 1. 5 to 7 notes (Audav, Shadav, Sampurna). Counted as swaras: Ma and Ma♯ in one raga are one note, Ma.
  const swaras = new Set([...notes].map((n) => SWARA[n]));
  if (swaras.size < 5 || swaras.size > 7) fail('1 (5 to 7 notes)', `has ${swaras.size} notes (${[...swaras].join(', ')})`);

  // 2. Sa is always present.
  if (!notes.has(0)) fail('2 (Sa present)', 'Sa is missing from aroha and avaroha');

  // 3. Ma or Pa is present.
  if (!notes.has(5) && !notes.has(6) && !notes.has(7)) fail('3 (Ma or Pa present)', 'has neither Ma nor Pa');

  // 4. No natural and altered form of one note back to back.
  for (const part of ['aroha', 'avaroha', 'pakad']) {
    const seq = (r[part] || []).filter((n) => n !== null);
    for (let i = 1; i < seq.length; i++) {
      const a = pc(seq[i - 1]), b = pc(seq[i]);
      const pair = ALTERED_PAIRS.find(([x, y]) => (a === x && b === y) || (a === y && b === x));
      if (pair && !adjOk.some(([x, y]) => x === pair[0] && y === pair[1])) {
        fail('4 (no altered note next to its natural)', `${part} has ${NAME[a]} next to ${NAME[b]} (positions ${i - 1}–${i})`);
      }
    }
  }

  // 5. Vadi, samvadi and every rest note are raga notes.
  for (const [label, n] of [['vadi', r.vadi], ['samvadi', r.samvadi], ...(r.rest || []).map((n) => ['rest', n])]) {
    if (typeof n !== 'number' || !notes.has(pc(n))) fail('5 (vadi, samvadi, rest are raga notes)', `${label} ${NAME[pc(n)] ?? n} is not a raga note`);
  }

  // 6. The raga's notes fit its thaat.
  const thaat = THAATS[r.thaat];
  if (!thaat) fail('6 (fits thaat)', `unknown thaat "${r.thaat}"`);
  else {
    const out = [...notes].filter((n) => !thaat.includes(n) && !thaatOk.includes(n));
    if (out.length) fail('6 (fits thaat)', `${names(out)} not in ${r.thaat} thaat`);
  }

  // 7. Vadi and samvadi a 4th or 5th apart. "Almost always", so a warning only.
  const gap = pc(r.samvadi - r.vadi);
  if (gap !== 5 && gap !== 7) warnings.push(`${name}: rule 7 (vadi–samvadi a 4th or 5th): ${NAME[pc(r.vadi)]} and ${NAME[pc(r.samvadi)]} are ${gap} semitones apart`);

  // 8. Every pakad note is a raga note.
  const stray = (r.pakad || []).filter((n) => n !== null && !notes.has(pc(n)));
  if (stray.length) fail('8 (pakad uses raga notes)', `pakad has ${names(new Set(stray.map(pc)))}, not in aroha or avaroha`);

  return { failures, warnings };
}

const RAGAS = loadRagas();

test('RAGAS loads and has ragas', () => {
  assert.ok(Object.keys(RAGAS).length > 0, 'no ragas found');
});

for (const [name, r] of Object.entries(RAGAS)) {
  test(`raga rules: ${name}`, (t) => {
    const { failures, warnings } = checkRaga(name, r);
    for (const w of warnings) t.diagnostic(`warning: ${w}`);
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}

test('every allow-list entry names a real raga', () => {
  for (const n of [...Object.keys(ADJACENT_OK), ...Object.keys(THAAT_OK)]) {
    assert.ok(n in RAGAS, `allow-list names "${n}", which is not in RAGAS`);
  }
});

// Self-check: the rules must catch a deliberately broken raga.
test('self-check: a broken raga (no Sa, Ga♭ next to Ga) fails with named rules', () => {
  const broken = {
    thaat: 'Bilawal', vadi: 4, samvadi: 11, rest: [4, 0],
    aroha: [2, 3, 4, 5, 7, 9, 11], avaroha: [11, 9, 7, 5, 4, 2], pakad: [2, 3, 4, null, 1],
  };
  const { failures } = checkRaga('Broken test raga', broken);
  const has = (re) => failures.some((f) => f.startsWith('Broken test raga: ') && re.test(f));
  assert.ok(has(/rule 2 \(Sa present\)/), 'missing Sa not caught:\n' + failures.join('\n'));
  assert.ok(has(/rule 4 .*aroha has Ga♭ next to Ga/), 'Ga♭–Ga in aroha not caught:\n' + failures.join('\n'));
  assert.ok(has(/rule 4 .*pakad has Ga♭ next to Ga/), 'Ga♭–Ga in pakad not caught:\n' + failures.join('\n'));
  assert.ok(has(/rule 5 .*rest Sa/), 'rest on a missing Sa not caught:\n' + failures.join('\n'));
  assert.ok(has(/rule 6 .*Ga♭/), 'Ga♭ outside Bilawal not caught:\n' + failures.join('\n'));
  assert.ok(has(/rule 8 .*Re♭/), 'pakad Re♭ outside the raga not caught:\n' + failures.join('\n'));

  // Rules 1, 3 and 7 on their own.
  const tiny = { thaat: 'Kafi', vadi: 0, samvadi: 2, rest: [], aroha: [0, 2, 3, 12], avaroha: [12, 3, 2, 0], pakad: [] };
  const t2 = checkRaga('Tiny', tiny);
  assert.ok(t2.failures.some((f) => /^Tiny: rule 1 /.test(f)), 'too few notes not caught');
  assert.ok(t2.failures.some((f) => /^Tiny: rule 3 /.test(f)), 'no Ma or Pa not caught');
  assert.ok(t2.warnings.some((w) => /^Tiny: rule 7 /.test(w)), 'vadi–samvadi gap not warned');

  // Allow-lists work, and only for the raga they name.
  const lalitish = { thaat: 'Marwa', vadi: 5, samvadi: 0, rest: [], aroha: [0, 1, 4, 5, 6, 9, 11, 12], avaroha: [12, 11, 9, 6, 5, 4, 1, 0], pakad: [] };
  assert.ok(checkRaga('X', lalitish).failures.some((f) => /rule 4/.test(f)));
  assert.ok(!checkRaga('X', lalitish, { adjacentOk: { X: [[5, 6]] } }).failures.some((f) => /rule 4/.test(f)));
});
