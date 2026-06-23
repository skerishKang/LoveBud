const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function extractFunctionBody(source, functionName) {
  const patterns = [
    `export function ${functionName}(`,
    `function ${functionName}(`
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = source.indexOf(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) {
    return null;
  }

  let braceCount = 0;
  let bodyStart = -1;
  let i = startIdx;

  while (i < source.length) {
    if (source[i] === '{') {
      braceCount++;
      if (braceCount === 1) {
        bodyStart = i + 1;
      }
    } else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0 && bodyStart !== -1) {
        return source.slice(bodyStart, i);
      }
    }
    i++;
  }

  return null;
}

test('renderAffordancesForMemory keeps growthAffordance.renderGrowthAffordance call', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-renderer.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'renderAffordancesForMemory');

  assert.notEqual(functionBody, null, 'renderAffordancesForMemory function not found');
  assert.match(functionBody, /growthAffordance\.renderGrowthAffordance\s*\(/);
});

test('renderAffordancesForMemory removes branchPorts.renderPortsForNode call', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-renderer.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'renderAffordancesForMemory');

  assert.notEqual(functionBody, null, 'renderAffordancesForMemory function not found');
  assert.doesNotMatch(functionBody, /branchPorts\.renderPortsForNode\s*\(/);
});

test('renderAffordancesForMemory removes branchPorts.showPortsForMemory call', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-renderer.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'renderAffordancesForMemory');

  assert.notEqual(functionBody, null, 'renderAffordancesForMemory function not found');
  assert.doesNotMatch(functionBody, /branchPorts\.showPortsForMemory\s*\(/);
});

test('clearGrowthAffordances maintains branchPorts.clearPorts call', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-renderer.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'clearGrowthAffordances');

  assert.notEqual(functionBody, null, 'clearGrowthAffordances function not found');
  assert.match(functionBody, /branchPorts\.clearPorts\s*\(/);
});

test('editor-canvas-branch-ports.js module still exists', () => {
  const modulePath = path.join(ROOT, 'js/editor/editor-canvas-branch-ports.js');
  assert.ok(fs.existsSync(modulePath), 'editor-canvas-branch-ports.js should exist');
});

test('createPortButton click handler calls openAddMoment with fallback', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-branch-ports.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createPortButton');

  assert.notEqual(functionBody, null, 'createPortButton function not found');
  assert.match(functionBody, /addEventListener\s*\(\s*['"]click['"]/);
  assert.match(functionBody, /typeof\s+openAddMoment\s*===\s*['"]function['"]/);
  assert.match(functionBody, /openAddMoment\(\)/);
  assert.match(functionBody, /getElementById\s*\(\s*['"]addMemoryBtn['"]\)/);
  assert.match(functionBody, /\.click\(\)/);
});

test('createPortButton keydown handler calls openAddMoment on Enter and Space', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-branch-ports.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createPortButton');

  assert.notEqual(functionBody, null, 'createPortButton function not found');
  assert.match(functionBody, /addEventListener\s*\(\s*['"]keydown['"]/);
  assert.match(functionBody, /e\.key\s*===\s*['"]Enter['"]/);
  assert.match(functionBody, /e\.key\s*===\s*['"] ['"]/);
  assert.match(functionBody, /openAddMoment\(\)/);
});
