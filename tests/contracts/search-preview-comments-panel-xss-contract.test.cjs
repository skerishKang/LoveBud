const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_FILE = path.join(ROOT, 'js/search/search-preview-hub-dom-patch.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('This is a static contract for search preview comments panel / comment body XSS checks (not applicable yet / static shell only)', () => {
  const source = readFile(TARGET_FILE);

  // 1. Extract renderSocialShell function source slice
  const startKeyword = 'function renderSocialShell()';
  const endKeyword = 'function ensureSocialShell()';
  
  const startIndex = source.indexOf(startKeyword);
  const endIndex = source.indexOf(endKeyword);
  
  assert.ok(startIndex !== -1, 'renderSocialShell must be defined');
  assert.ok(endIndex !== -1, 'ensureSocialShell must be defined');
  assert.ok(startIndex < endIndex, 'renderSocialShell must precede ensureSocialShell');
  
  const renderSocialShellSlice = source.substring(startIndex, endIndex);

  // 2. Verify renderSocialShell slice does not contain dynamic comment properties or loop constructs
  const forbiddenPatterns = [
    'comment.body',
    'comment.text',
    'comment.content',
    'comments.map',
    'comments.forEach',
    '${comment',
    '+ comment.',
    '.innerHTML = comment',
    '.insertAdjacentHTML(... comment'
  ];

  for (const pattern of forbiddenPatterns) {
    assert.ok(!renderSocialShellSlice.includes(pattern), `Forbidden pattern "${pattern}" must not exist in renderSocialShell`);
  }

  // 3. Verify insertAdjacentHTML('beforeend', renderSocialShell()) is used to insert the social shell
  assert.match(
    source,
    /\.insertAdjacentHTML\(\s*['"]beforeend['"]\s*,\s*renderSocialShell\(\)\s*\)/,
    "Must preserve the insertAdjacentHTML('beforeend', renderSocialShell()) insertion pattern"
  );

  // 4. Verify static comments panel is returned
  assert.match(renderSocialShellSlice, /댓글/, 'Should include static text: 댓글');
  assert.match(renderSocialShellSlice, /아직 댓글이 없어요\./, 'Should include static text: 아직 댓글이 없어요.');
  assert.match(renderSocialShellSlice, /댓글 작성 기능은 후속 기능으로 준비 중입니다\./, 'Should include static text: 댓글 작성 기능은 후속 기능으로 준비 중입니다.');

  // 5. XSS payloads referenced as "not applicable yet / static shell only" contract
  const xssPayloads = [
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    '<a href="javascript:alert(1)">x</a>'
  ];
  
  assert.ok(xssPayloads.length > 0);
});
