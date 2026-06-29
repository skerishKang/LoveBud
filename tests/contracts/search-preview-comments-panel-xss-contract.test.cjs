const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Static contract: the hub DOM patch no longer contains comments panel
 * markup or social shell rendering.
 *
 * The truthful social shell (view count + share button only) is owned
 * by search-share-link.js. This test verifies that the hub DOM patch
 * does NOT re-introduce any comments panel, fake likes, or static
 * social shell that could become an XSS vector.
 */
test('hub DOM patch does not render social shell or comments panel', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/search/search-preview-hub-dom-patch.js'), 'utf8');

  // The old renderSocialShell and ensureSocialShell must not exist
  assert.ok(!source.includes('function renderSocialShell'),
    'renderSocialShell must be removed from hub DOM patch');
  assert.ok(!source.includes('function ensureSocialShell'),
    'ensureSocialShell must be removed from hub DOM patch');
  assert.ok(!source.includes('socialBound'),
    'socialBound flag must be removed');

  // No comments-related markup
  assert.ok(!source.includes('data-preview-comments'),
    'comments selector must not exist');
  assert.ok(!source.includes('preview-comments-panel'),
    'comments panel must not exist');
  assert.ok(!source.includes('아직 댓글이 없어요'),
    'comments placeholder must not exist');
  assert.ok(!source.includes('댓글 작성 기능은 후속 기능'),
    'future comments note must not exist');

  // No likes
  assert.ok(!source.includes('data-preview-like'),
    'likes selector must not exist');
  assert.ok(!source.includes('data-preview-share-tree-id'),
    'share button must not be rendered from DOM patch (owned by share-link)');
});

/**
 * Static contract: the truthful social shell is owned by search-share-link.js.
 * It contains no dynamic user content — treeId is escaped via escapeHtml.
 */
test('share-link social shell uses safe static markup with escaped treeId', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/search/search-share-link.js'), 'utf8');

  // Share button uses escapeHtml for treeId in data attribute
  assert.match(source, /escapeHtml.*tree\.id/,
    'treeId must be escaped before being placed in HTML');
  // safeTreeId is assigned on a separate line from the data attribute
  assert.ok(source.includes('safeTreeId'),
    'share button uses escaped safe tree ID variable');

  // No unescaped dynamic content in share button HTML
  // All values go through escapeHtml
  assert.ok(source.includes('.innerHTML') === false,
    'share-link must not use innerHTML');
  assert.ok(source.includes('.outerHTML') === false,
    'share-link must not use outerHTML');
  assert.ok(source.includes('.insertAdjacentHTML') === false,
    'share-link must not use insertAdjacentHTML');
});
