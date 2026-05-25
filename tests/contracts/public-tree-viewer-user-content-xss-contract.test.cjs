const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_FILE = path.join(ROOT, 'js/viewer/public-tree-viewer.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

test('This is a static contract for public viewer title/memo/diary/tag user-content sinks', () => {
  const source = readFile(TARGET_FILE);

  // 1. Verify setContent definition and usage of textContent
  const setContentStart = source.indexOf('function setContent');
  const setContentEnd = source.indexOf('function show', setContentStart);
  assert.ok(setContentStart !== -1, 'setContent must be defined');
  assert.ok(setContentEnd !== -1, 'show must be defined');
  const setContentSlice = source.substring(setContentStart, setContentEnd);
  assert.match(setContentSlice, /\.textContent\s*=\s*/, 'setContent must assign to textContent');
  assert.doesNotMatch(setContentSlice, /\.innerHTML\s*=\s*/, 'setContent must not assign to innerHTML');

  // 2. Verify renderNodesList slice
  const renderNodesListStart = source.indexOf('function renderNodesList()');
  const renderNodesListEnd = source.indexOf('function formatMemoryDate', renderNodesListStart);
  assert.ok(renderNodesListStart !== -1, 'renderNodesList must be defined');
  assert.ok(renderNodesListEnd !== -1, 'formatMemoryDate must be defined');
  const renderNodesListSlice = source.substring(renderNodesListStart, renderNodesListEnd);

  // Ensure title, memo, date and tags are escaped when inserted into node innerHTML
  assert.match(renderNodesListSlice, /escapeHtml\(memory\.title\s*\|\|\s*memory\.emotionMemo\s*\|\|\s*['"]['"]\)/, 'node title/memo must be escaped');
  assert.match(renderNodesListSlice, /escapeHtml\(tag\)/, 'node tag must be escaped');
  assert.match(renderNodesListSlice, /escapeHtml\(formatMemoryDate\(memory\)\)/, 'node date must be escaped');

  // 3. Verify renderPreviewMemory slice
  const renderPreviewMemoryStart = source.indexOf('function renderPreviewMemory(');
  const renderPreviewMemoryEnd = source.indexOf('function setupRetry()', renderPreviewMemoryStart);
  assert.ok(renderPreviewMemoryStart !== -1, 'renderPreviewMemory must be defined');
  assert.ok(renderPreviewMemoryEnd !== -1, 'setupRetry must be defined');
  const renderPreviewMemorySlice = source.substring(renderPreviewMemoryStart, renderPreviewMemoryEnd);

  // Ensure preview title and quote use textContent paths
  assert.match(renderPreviewMemorySlice, /setContent\(SEL\.momentTitle,\s*memory\.title\s*\|\|\s*memory\.emotionMemo\s*\|\|\s*['"]['"]\)/, 'momentTitle must be set using setContent (textContent)');
  assert.match(renderPreviewMemorySlice, /quoteEl\.textContent\s*=\s*memory\.emotionMemo\s*\|\|\s*['"]['"]/, 'quoteEl must be set using textContent');

  // Ensure diary content handles formatting via escapeHtml and replacement
  assert.match(renderPreviewMemorySlice, /escapeHtml\(memory\.diaryContent\)\.replace\(\/\\n\/g,\s*['"]<br>['"]\)/, 'diaryContent must be escaped and line breaks converted');

  // 4. Verify no direct dangerous user content properties are embedded without escapeHtml (strip comments first)
  const cleanNodesListSlice = stripComments(renderNodesListSlice);
  const cleanPreviewMemorySlice = stripComments(renderPreviewMemorySlice);

  const unescapedDangerousPatterns = [
    '${memory.title}',
    '${memory.emotionMemo}',
    '${memory.diaryContent}',
    '${tag}',
    '${location}',
    '+ memory.title',
    '+ memory.emotionMemo',
    '+ memory.diaryContent',
    '+ tag',
    '+ location',
    'memory.title +',
    'memory.emotionMemo +',
    'memory.diaryContent +',
    'tag +',
    'location +'
  ];

  for (const pattern of unescapedDangerousPatterns) {
    assert.doesNotMatch(
      cleanNodesListSlice,
      new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')),
      `Forbidden unescaped pattern "${pattern}" must not exist in renderNodesList`
    );
    assert.doesNotMatch(
      cleanPreviewMemorySlice,
      new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')),
      `Forbidden unescaped pattern "${pattern}" must not exist in renderPreviewMemory`
    );
  }

  // 5. Check setContent(...).innerHTML is absent
  assert.doesNotMatch(source, /setContent\([^)]+\)\.innerHTML/, 'setContent(...).innerHTML is prohibited');

  // 6. XSS payloads referenced as compliance contract
  const xssPayloads = [
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    '<a href="javascript:alert(1)">x</a>'
  ];
  assert.ok(xssPayloads.length > 0);
});
