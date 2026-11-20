// Lifts code out of index.html as text, for pure tests that need no browser (#66, #74).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(process.env.SHADJA_SITE || ROOT);   // same switch as harness.mjs

export function loadRagas() {
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

// Lifts one top-level function (by name) out of index.html and returns it. Only for pure functions.
export function loadFunction(name) {
  const src = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start > -1, name + ' not found in index.html');
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return new Function('return ' + src.slice(start, i + 1))();
}

// Lifts several top-level functions, plus the SARGAM note names, into one scope, so pure functions that call each
// other (checkPhrase → phraseRules → moveOk, moveWhy) run together in Node (#68). Returns { name: fn }.
export function loadFunctions(names) {
  const src = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const sargam = src.match(/var SARGAM = \[[^\]]*\];/);
  assert.ok(sargam, 'var SARGAM not found in index.html');
  const parts = names.map((name) => {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start > -1, name + ' not found in index.html');
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(start, i + 1);
  });
  return new Function(sargam[0] + '\n' + parts.join('\n') + '\nreturn { ' + names.join(', ') + ' };')();
}
