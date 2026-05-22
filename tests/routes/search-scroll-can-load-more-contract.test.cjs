const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `${functionName} function not found`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(braceStart + 1, index);
    }
  }
  throw new Error(`${functionName} body not closed`);
}

test('search UI delegates canLoadMorePublicTrees check directly to helper', () => {
  const uiModule = read('js/search/search-ui.js');
  const body = extractFunctionBody(uiModule, 'canLoadMorePublicTrees');

  assert.match(body, /ScrollLoad\.canLoadMorePublicTrees\(state,\s*callbacks,\s*flags\s*\|\|\s*\{[\s\S]*?isQueued:\s*isScrollLoadQueued[\s\S]*?\}\)/);
  assert.doesNotMatch(body, /typeof\s+ScrollLoad\.canLoadMorePublicTrees\s*===\s*['"]function['"]/);
  assert.doesNotMatch(body, /return\s+false/);
});

test('scroll helper owns canLoadMorePublicTrees implementation and export', () => {
  const helperModule = read('js/search/search-scroll-load.js');

  assert.match(helperModule, /function canLoadMorePublicTrees\(state,\s*callbacks,\s*flags\)/);
  assert.match(helperModule, /canLoadMorePublicTrees:\s*canLoadMorePublicTrees/);
  assert.match(helperModule, /state\.apiTreesLoaded/);
  assert.match(helperModule, /state\.hasMoreTrees/);
  assert.match(helperModule, /!state\.isLoadingMore/);
  assert.match(helperModule, /!flags\.isQueued/);
});
