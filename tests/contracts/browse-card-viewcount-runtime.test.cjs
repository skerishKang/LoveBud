/**
 * Runtime test: browse card renderer three-state viewCount display.
 *
 * Calls renderTreeCard() with test tree objects and validates the
 * rendered HTML output, not just source patterns.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const sharedUtilsSource = fs.readFileSync(path.join(ROOT, 'js/search/search-shared-utils.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(ROOT, 'js/search/search-card-renderer.js'), 'utf8');

function createSandbox() {
  const sandbox = {
    window: {
      location: { pathname: '/pages/search', origin: 'https://lovebud.pages.dev' }
    },
    document: { documentElement: { lang: 'ko' } },
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    // minimal LoveBud dependencies
    LoveBudSecurity: {
      escapeHtml: (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'),
      sanitizeUrl: (v) => v || ''
    },
    LoveBudPath: { getBasePath: () => '' },
    i18n: { currentLang: 'ko' }
  };
  return sandbox;
}

function buildTree(overrides) {
  return Object.assign({
    id: 'test-tree-001',
    title: 'Test Tree',
    visibility: 'public',
    memoryCount: 5,
    likeCount: 2,
    emotions: [],
    emotionTags: [],
    representativeThumbnail: '',
    representativeSourceUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, overrides);
}

// Run the renderer IIFE in a sandbox and return window.LoveBudSearchCardRenderer
function getRenderer() {
  const sandbox = createSandbox();
  const context = vm.createContext(sandbox);
  // Load real shared utils first (authoritative view-count resolver)
  vm.runInContext(sharedUtilsSource, context, { filename: 'search-shared-utils.js' });
  vm.runInContext(rendererSource, context, { filename: 'search-card-renderer.js' });
  return context.window.LoveBudSearchCardRenderer;
}

test('card runtime: viewCount:3 → visibility metric with 3 rendered', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: 3 });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html.includes('visibility'), 'visibility icon must be present');
  assert.ok(html.includes('조회수'), '조회수 label must be present');
  assert.ok(html.includes('>3<') || html.includes('"3"'), 'view count 3 must be in output');
});

test('card runtime: viewCount:0 → visibility metric with 0 rendered', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: 0 });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html.includes('visibility'), 'visibility icon must be present for zero');
  assert.ok(html.includes('>0<') || html.includes('"0"'), 'view count 0 must be in output');
});

test('card runtime: viewCount absent → no visibility metric', () => {
  const renderer = getRenderer();
  const tree = buildTree({});  // no viewCount; default likeCount:2 remains
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(!html.includes('visibility'), 'visibility icon must NOT be present when viewCount absent');
  // available likeCount must still render
  assert.ok(html.includes('favorite'), 'likes icon must still be present when likeCount is available');
});

test('card runtime: viewCount null → no visibility metric', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: null });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(!html.includes('visibility'), 'visibility icon must NOT be present when viewCount null');
  assert.ok(html.includes('favorite'), 'likes icon must still be present when likeCount is available');
});

test('card runtime: only available metrics render (truthful; no unknown→0)', () => {
  const renderer = getRenderer();
  // likeCount present; comments/shares/views absent
  const tree = buildTree({ likeCount: 7 });
  delete tree.viewCount;
  delete tree.commentCount;
  delete tree.shareCount;
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html.includes('favorite'), 'favorite/likes must render when available');
  assert.ok(html.includes('>7<') || html.includes('"7"'), 'like count 7 must be rendered');
  assert.ok(!html.includes('visibility'), 'views must be hidden when unavailable');
  assert.ok(!html.includes('chat_bubble') && !html.includes('mode_comment'), 'comments must be hidden when unavailable');
  assert.ok(!html.includes('>share<') && !/material-symbols-outlined[^>]*>share</.test(html),
    'share metric must be hidden when unavailable');
});

test('card runtime: likeCount 0 is shown; missing likeCount is hidden', () => {
  const renderer = getRenderer();
  const zeroHtml = renderer.renderTreeCard(buildTree({ likeCount: 0, viewCount: 1 }), 0);
  assert.ok(zeroHtml.includes('favorite'), 'persisted zero likes must show favorite');
  assert.ok(zeroHtml.includes('>0<') || zeroHtml.includes('"0"'), 'persisted zero must render as 0');

  const missing = buildTree({ viewCount: 1 });
  delete missing.likeCount;
  const missingHtml = renderer.renderTreeCard(missing, 0);
  assert.ok(!missingHtml.includes('favorite'), 'missing likeCount must hide likes metric');
  assert.ok(missingHtml.includes('visibility'), 'available viewCount must still show');
});
