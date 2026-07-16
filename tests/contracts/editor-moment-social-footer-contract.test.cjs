'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('node:crypto');

const templatePath = 'js/shared/canonical-appreciation-detail-presentation.js';
const ownerWrapperPath = 'js/editor/templates/editor-detail-view-mode-template.js';
const toolbarTemplatePath = 'js/editor/templates/editor-floating-toolbar-template.js';
const editorPagePath = 'pages/editor.html';
const cssOverridePath = 'css/editor/editor-overrides.css';

test('editor selected moment reactions render as labeled inline footer actions', () => {
  // #3563: execute owner authority HTML from shared builder (source also contains public-safe social).
  const vm = require('node:vm');
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(templatePath, 'utf8'), ctx);
  const source = ctx.window.LoveBudCanonicalAppreciationDetailPresentation.buildDetailViewModeHtml({
    authority: 'owner',
    socialMode: 'owner-interactive'
  });

  assert.match(source, /id="momentReactionsCard"[\s\S]*?aria-label="순간 반응과 댓글"/, 'reaction footer must have a clear grouped aria label');
  assert.match(source, /class="[^"]*public-viewer-social-status[^"]*editor-like-button/, 'like control must use the canonical status class on an interactive button');
  assert.match(source, /class="[^"]*public-viewer-social-status[^"]*editor-comment-toggle/, 'comment control must use the canonical toggle class');
  assert.match(source, /id="momentReactionLikeButton"/, 'owner like button id must remain interactive');
  assert.match(source, /id="momentReactionCommentStatus"/, 'owner comment toggle id must remain interactive');
  assert.doesNotMatch(source, /is-public-readonly|data-read-only-summary/, 'owner social card must not be public-readonly');
  assert.match(source, /<span class="editor-reaction-label">\s*좋아요\s*<\/span>/, 'like action must include a readable label');
  assert.match(source, /<span class="editor-reaction-label">\s*댓글\s*<\/span>/, 'comment action must include a readable label');
  assert.match(source, /class="editor-reaction-like-icon" aria-hidden="true">\s*🤍\s*<\/span>/, 'like decorative icon must be 🤍 and aria-hidden');
  assert.match(source, /class="editor-reaction-comment-icon" aria-hidden="true">\s*💬\s*<\/span>/, 'comment decorative icon must be 💬 and aria-hidden');
});

test('editor selected moment reaction footer uses soft card-like styling', () => {
  const css = fs.readFileSync(cssOverridePath, 'utf8');

  assert.match(css, /\.editor-moment-reactions-card\s*\{/, 'reactions card CSS class must be defined');
  assert.match(css, /border-radius:\s*14px/, 'reactions card must have soft rounded corners');
  assert.match(css, /background:\s*var\(--surface-variant/, 'reactions card must have a subtle background');
  assert.match(css, /gap:\s*6px/, 'reaction buttons must be tightly spaced');
});

test('editor page cache-busts the social footer stylesheet and template', () => {
  const source = fs.readFileSync(editorPagePath, 'utf8');

  // editor.css is not under the content-SHA fingerprint policy; verify a non-empty cache-bust value exists.
  const cssMatch = source.match(/editor\.css\?v=([^"']+)/);
  assert.ok(cssMatch, 'editor stylesheet entrypoint must be cache-busted');
  assert.ok(cssMatch[1].length > 0, 'editor stylesheet cache-bust value must be non-empty');

  // Owner thin wrapper is a tracked fingerprint asset; shared builder is also cache-busted.
  const wrapperSource = fs.readFileSync(ownerWrapperPath, 'utf8').replace(/\r\n/g, '\n');
  const expectedFingerprint = crypto.createHash('sha256').update(wrapperSource, 'utf8').digest('hex').slice(0, 12);
  const tplMatch = source.match(/editor-detail-view-mode-template\.js\?v=([^"']+)/);
  assert.ok(tplMatch, 'detail view template must be cache-busted in editor.html');
  assert.strictEqual(
    tplMatch[1],
    expectedFingerprint,
    `detail view template ?v must match content SHA-256[:12] (expected ${expectedFingerprint})`
  );
  const sharedMatch = source.match(/canonical-appreciation-detail-presentation\.js\?v=([^"']+)/);
  assert.ok(sharedMatch, 'shared canonical presentation builder must be cache-busted in editor.html');
  const sharedSource = fs.readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n');
  const sharedFp = crypto.createHash('sha256').update(sharedSource, 'utf8').digest('hex').slice(0, 12);
  assert.strictEqual(sharedMatch[1], sharedFp, `shared builder ?v must match content SHA-256[:12] (expected ${sharedFp})`);
});

test('editor branch creation affordance remains in floating toolbar without being a primary visible CTA', () => {
  const toolbarSource = fs.readFileSync(toolbarTemplatePath, 'utf8');
  const css = fs.readFileSync(cssOverridePath, 'utf8');

  assert.match(toolbarSource, /id="ftbBranchBtn"/, 'branch creation button must remain available');
  assert.match(toolbarSource, /id="ftbForkBtn"/, 'fork button must remain available');
  assert.match(toolbarSource, /style="display:none;"/, 'branch buttons must stay hidden by default');
  assert.doesNotMatch(toolbarSource, /editor-ftb-branch-btn[^>]*style="display:(inline|flex|block)/, 'branch buttons must not be primary visible CTAs');
});

test('editor social footer polish stays frontend-only and does not expand canvas scope', () => {
  const source = fs.readFileSync(templatePath, 'utf8');

  assert.doesNotMatch(source, /apiClient\.updateTree|apiClient\.create|ALTER\s+TABLE|CREATE\s+TABLE/i, 'must not add persistence or schema work');
  assert.doesNotMatch(source, /Scout|LLM|provider/i, 'must not add Scout/provider behavior');
  assert.doesNotMatch(source, /branch-port|rethread|relationship-hint/i, 'must not mix in branch/rethread controls');
});

test('editor social footer and branch control polish do not introduce relationship graph or DB/API changes', () => {
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const toolbarSource = fs.readFileSync(toolbarTemplatePath, 'utf8');
  const css = fs.readFileSync(cssOverridePath, 'utf8');

  for (const source of [templateSource, toolbarSource, css]) {
    assert.doesNotMatch(source, /relationship.graph|Obsidian|wiki/i, 'must not add relationship graph or Obsidian-style features');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i, 'must not add client persistence');
    assert.doesNotMatch(source, /#2418|#1882/i, 'must not reference closed issues');
  }
});
