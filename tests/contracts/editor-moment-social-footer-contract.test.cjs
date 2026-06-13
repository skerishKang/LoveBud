const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const templatePath = 'js/editor/templates/editor-detail-view-mode-template.js';
const editorPagePath = 'pages/editor.html';

test('editor selected moment reactions render as labeled inline footer actions', () => {
  const source = fs.readFileSync(templatePath, 'utf8');

  assert.match(source, /id="momentReactionsCard" aria-label="순간 반응"/, 'reaction footer must have a clear grouped aria label');
  assert.match(source, /class="editor-moment-reaction editor-reaction-like-btn"/, 'like action must use the shared inline reaction class');
  assert.match(source, /class="editor-moment-reaction editor-reaction-comment-btn"/, 'comment action must use the shared inline reaction class');
  assert.match(source, /<span class="editor-reaction-label">좋아요<\/span>/, 'like action must include a readable label');
  assert.match(source, /<span class="editor-reaction-label">댓글<\/span>/, 'comment action must include a readable label');
  assert.match(source, /aria-hidden="true">🤍<\/span>/, 'decorative like icon must not be the only accessible text');
  assert.match(source, /aria-hidden="true">💬<\/span>/, 'decorative comment icon must not be the only accessible text');
});

test('editor selected moment reaction footer styling avoids boxed button chrome', () => {
  const source = fs.readFileSync(templatePath, 'utf8');

  assert.match(source, /style="display:inline-flex;/, 'reaction footer should render as a compact inline group');
  assert.match(source, /border:0;/, 'reaction actions should not keep default boxed button borders');
  assert.match(source, /background:transparent;/, 'reaction actions should not look like separate box buttons by default');
  assert.match(source, /font-variant-numeric:tabular-nums;/, 'counts should remain stable as they update');
});

test('editor page cache-busts the social footer template and stylesheet entrypoint', () => {
  const source = fs.readFileSync(editorPagePath, 'utf8');

  assert.match(source, /editor\.css\?v=20260614-2465/, 'editor stylesheet entrypoint must be cache-busted for footer style changes');
  assert.match(source, /editor-detail-view-mode-template\.js\?v=20260614-2465/, 'detail view template must be cache-busted for reaction footer markup changes');
});

test('editor social footer polish stays frontend-only and does not expand canvas scope', () => {
  const source = fs.readFileSync(templatePath, 'utf8');

  assert.doesNotMatch(source, /apiClient\.updateTree|apiClient\.create|ALTER\s+TABLE|CREATE\s+TABLE/i, 'must not add persistence or schema work');
  assert.doesNotMatch(source, /Scout|LLM|provider/i, 'must not add Scout/provider behavior');
  assert.doesNotMatch(source, /branch-port|rethread|relationship-hint/i, 'must not mix in branch/rethread controls');
});
