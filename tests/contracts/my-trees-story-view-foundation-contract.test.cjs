/**
 * LoveBud #3811 My Trees Story View — Static Contract Test
 *
 * Refs #3811 (implementation child). Parent #3654 stays OPEN.
 * Prerequisite: #3813 / PR #3819 (shared controller surface-adapter boundary).
 * Baseline: 2070cb3160f2bfb63ba5732b96f52ca5416aa79a
 *
 * Locks the thin-adapter contract:
 *   - My Trees gains an optional fourth mode `story` (user label 스토리)
 *   - default stays `compact`; storage key stays `lovebud:myTrees:viewMode`
 *     and remains separate from the Browse key
 *   - the adapter is a THIN wrapper over window.LoveBudBrowseStoryView:
 *     shared-controller copy 0, second grouping/transition authority 0,
 *     backend pagination 0, autoplay/loop/swipe dependency 0
 *   - entry uses setMode('story', { initialTreeId }); result replacement
 *     uses refresh({ preferredTreeId }) in the same task
 *   - settled onGroupChange snapshot drives selection/preview-hub sync;
 *     mobile never auto-opens the bottom sheet
 *   - My Trees-specific surface translation (i18n-my-trees.js)
 *   - Story rail is loaded-with-cards only; destroy releases everything
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const adapterSrc = read('js/my-trees/my-trees-story-view.js');
const controllerSrc = read('js/search/search-story-view.js');
const bootstrapSrc = read('js/my-trees/my-trees-page-bootstrap.js');
const myTreesHtml = read('pages/my-trees.html');
const i18nMyTrees = read('js/i18n/i18n-my-trees.js');
const viewModeCss = read('css/tree-view-mode.css');
const switcherSrc = read('js/tree-view-mode-switcher.js');

function stripJsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

const adapter = stripJsComments(adapterSrc);

/* ── 1) Thin adapter structure ──────────────────────────────────── */
test('1. adapter exposes window.LoveBudMyTreesStoryView.create and initializes the shared controller', () => {
  assert.match(adapterSrc, /window\.LoveBudMyTreesStoryView\s*=\s*\{ create:\s*createMyTreesStoryAdapter \}/);
  assert.match(adapterSrc, /LoveBudBrowseStoryView\.init\(/);
  assert.match(adapterSrc, /results:\s*grid/);
  assert.match(adapterSrc, /navMount:\s*navMount/);
  assert.match(adapterSrc, /translate:\s*translate/);
  assert.match(adapterSrc, /onGroupChange:\s*onGroupChange/);
});

test('2. shared controller is NOT copied into the adapter (no second authority)', () => {
  for (const banned of [
    /groupSize\s*=\s*computeGroupSize/,
    /function goTo\s*\(/,
    /function step\s*\(/,
    /applyGroupImmediate/,
    /browse-story-transition-stage/,
    /browse-story-layer-outgoing/,
    /@keyframes\s+browse-story/,
    /collectCards\s*=\s*function/,
    /createElement\(['"]nav['"]\)/,
    /data-story-prev/,
    /data-story-next/
  ]) {
    assert.equal(banned.test(adapter), false, 'adapter must not reimplement ' + banned);
  }
});

test('3. adapter never performs backend/API pagination or DOM polling navigation', () => {
  for (const banned of [
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /apiClient/,
    /firebase/i,
    /postgres/i,
    /[?&]page=/,
    /\bpageSize\b/,
    /\boffset\b|\blimit\b/,
    /setInterval/,
    /requestAnimationFrame/,
    /autoplay/i
  ]) {
    assert.equal(banned.test(adapter), false, 'adapter must not contain ' + banned);
  }
});

test('4. adapter uses setMode({ initialTreeId }) for Story entry', () => {
  assert.match(adapterSrc, /setMode\(STORY_MODE,\s*\{\s*initialTreeId:\s*currentSelectedTreeId\(\)\s*\|\|\s*undefined\s*\}\)/);
});

test('5. adapter uses refresh({ preferredTreeId }) for result replacement', () => {
  assert.match(adapterSrc, /refresh\(\{\s*preferredTreeId:\s*currentSelectedTreeId\(\)\s*\|\|\s*undefined\s*\}\)/);
  assert.match(adapterSrc, /refresh\(\{\s*preferredTreeId:/);
});

test('6. adapter consumes the settled onGroupChange snapshot boundary', () => {
  assert.match(adapterSrc, /function onGroupChange\(snapshot\)/);
  assert.match(adapterSrc, /snapshot\.firstVisibleTreeId/);
  assert.match(adapterSrc, /collectCardIds\(\)/);
});

test('7. mobile never auto-opens the bottom sheet from a Story group change', () => {
  assert.match(adapterSrc, /function isMobile\(\)/);
  assert.match(adapterSrc, /MOBILE_MAX_WIDTH/);
  const setSel = adapterSrc.slice(adapterSrc.indexOf('function setSelectedTree'), adapterSrc.indexOf('function onGroupChange'));
  assert.match(setSel, /if \(isMobile\(\)\)/);
  assert.ok(setSel.indexOf('setSelectedTreeId') !== -1, 'mobile branch updates selection state');
  assert.ok(
    setSel.indexOf('setSelectedTreeId') < setSel.indexOf('onCardClick'),
    'mobile guard must precede the hub onCardClick path'
  );
});

test('8. desktop hub sync reuses the canonical card-click/selection path', () => {
  const desktopBranch = adapterSrc.slice(adapterSrc.indexOf('function setSelectedTree'), adapterSrc.indexOf('function onGroupChange'));
  assert.match(desktopBranch, /previewHub\.onCardClick\(tree,\s*\{\s*skipScroll:\s*true\s*\}\)/);
});

test('9. My Trees surface translation maps only the five semantic keys', () => {
  assert.match(adapterSrc, /SEMANTIC_TO_MY_TREES_KEY/);
  for (const key of ['story.regionLabel', 'story.previous', 'story.next', 'story.label', 'story.position']) {
    assert.ok(adapterSrc.indexOf("'" + key + "'") !== -1, 'semantic key ' + key + ' must be declared');
  }
  assert.match(adapterSrc, /window\.i18nMyTrees/);
  assert.equal(/window\.i18nSearch/.test(adapterSrc), false, 'adapter must not read/mutate Browse i18n');
  assert.equal(/search\.story\./.test(adapter), false, 'adapter must not reuse search.story.* keys');
});

test('10. Story rail is loaded-with-cards only', () => {
  assert.match(adapterSrc, /function syncRailVisibility/);
  assert.match(adapterSrc, /stateLoadedEl\s*&&\s*!stateLoadedEl\.hidden/);
  assert.match(adapterSrc, /querySelectorAll\('\.tree-card\[data-tree-id\]'\)\.length\s*>\s*0/);
  assert.match(adapterSrc, /navMount\.hidden/);
});

test('11. destroy() releases listeners/observers/callbacks', () => {
  assert.match(adapterSrc, /function destroy\(\)/);
  assert.match(adapterSrc, /railObserver\.disconnect/);
  assert.match(adapterSrc, /destroyController\(\)/);
  assert.match(adapterSrc, /originalRenderTrees/);
});

test('12. adapter has no per-card listeners', () => {
  const listeners = adapter.match(/addEventListener\s*\(\s*['"]([a-z]+)['"]/g) || [];
  assert.equal(listeners.length, 0, 'adapter must not register its own event listeners (' + listeners.join(',') + ')');
});

/* ── 2) View-mode capability ────────────────────────────────────── */
test('13. My Trees bootstrap passes exactly four modes with compact default', () => {
  assert.match(bootstrapSrc, /\[\s*['"]large['"]\s*,\s*['"]compact['"]\s*,\s*['"]list['"]\s*,\s*['"]story['"]\s*\]/);
  assert.match(bootstrapSrc, /defaultMode:\s*['"]compact['"]/);
});

test('14. My Trees storage key is page-scoped and Browse-independent', () => {
  assert.match(bootstrapSrc, /lovebud:myTrees:viewMode/);
  assert.equal(bootstrapSrc.includes('lovebud:browse:viewMode'), false, 'no Browse storage key in My Trees bootstrap');
});

test('15. My Trees HTML wires the shared controller and adapter before the bootstrap', () => {
  assert.ok(myTreesHtml.includes('id="myTreesStoryNavMount"'), 'Story nav mount present');
  const controllerIdx = myTreesHtml.indexOf('../js/search/search-story-view.js');
  const adapterIdx = myTreesHtml.indexOf('../js/my-trees/my-trees-story-view.js');
  const bootstrapIdx = myTreesHtml.indexOf('../js/my-trees/my-trees-page-bootstrap.js');
  assert.ok(controllerIdx !== -1 && adapterIdx !== -1 && bootstrapIdx !== -1, 'all three scripts present');
  assert.ok(controllerIdx < adapterIdx && adapterIdx < bootstrapIdx, 'controller < adapter < bootstrap');
});

test('16. My Trees i18n defines the surface story strings', () => {
  for (const key of [
    'myTrees.story.label',
    'myTrees.story.regionLabel',
    'myTrees.story.previous',
    'myTrees.story.next',
    'myTrees.story.position'
  ]) {
    assert.ok(i18nMyTrees.indexOf("'" + key + "'") !== -1, 'missing i18n key ' + key);
  }
});

/* ── 3) CSS geometry-only boundary ──────────────────────────────── */
test('17. My Trees Story CSS selectors exist and are geometry-only', () => {
  assert.match(viewModeCss, /\.trees-grid\[data-tree-view-mode="story"\]\s*\{/);
  assert.match(viewModeCss, /\.trees-grid\[data-tree-view-mode="story"\]\s+\.tree-card\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(viewModeCss, /\.trees-grid\[data-tree-view-mode="story"\]\[data-story-group-size="2"\]/);
  assert.match(viewModeCss, /\.trees-grid\[data-tree-view-mode="story"\]\[data-story-group-size="1"\]/);
  const myTreesSection = viewModeCss.slice(viewModeCss.indexOf('My Trees Story (#3811)'));
  assert.equal(/@keyframes\s+(?!browse-story)/.test(myTreesSection), false, 'My Trees section must not define its own keyframes');
  assert.match(viewModeCss, /\.browse-story-transition-stage/);
  assert.match(viewModeCss, /\.browse-story-layer-outgoing/);
  assert.match(viewModeCss, /\.browse-story-layer-incoming/);
});

test('18. reduced-motion branch exists for My Trees Story', () => {
  const rmBlock = viewModeCss.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.trees-grid\[data-tree-view-mode="story"\]\s+\.tree-card\.is-story-entering[\s\S]*?animation:\s*none/
  );
  assert.ok(rmBlock, 'My Trees Story reduced-motion block must disable entering animation');
});

/* ── 4) Cross-cutting prohibitions ──────────────────────────────── */
test('19. shared controller file is not modified/copied', () => {
  assert.equal(/myTrees/i.test(stripJsComments(controllerSrc)), false, 'controller runtime must not reference My Trees');
});

test('20. no framework/carousel/swipe dependency in the adapter', () => {
  for (const banned of [
    /\b(react|vue|svelte|angular|preact)\b/i,
    /\bimport\s+.*from\s+['"]/,
    /require\s*\(/,
    /swiper/i,
    /carousel/i,
    /\bgsap\b/i,
    /framer-motion/i
  ]) {
    assert.equal(banned.test(adapter), false, 'adapter must not contain ' + banned);
  }
});

test('21. exact nav mount id is locked', () => {
  assert.match(adapterSrc, /navMountSelector\s*=\s*opts\.navMount\s*\|\|\s*'#myTreesStoryNavMount'/);
  assert.ok(myTreesHtml.includes('#myTreesStoryNavMount') || myTreesHtml.includes('myTreesStoryNavMount'), 'HTML carries the nav mount');
});

test('22. switcher labels carry the Story mode label', () => {
  assert.match(switcherSrc, /story:\s*'스토리'/);
});
