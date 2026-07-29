const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const JS_PATH = path.join(ROOT, 'js', 'index-inline-init.js');

test('Contract: 3627 Home Runtime Metadata i18n Stable', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const js = fs.readFileSync(JS_PATH, 'utf8');

  // 1. exactly four `[data-runtime-video-title]` nodes
  const titleNodes = html.match(/data-runtime-video-title="true"/g) || [];
  assert.equal(titleNodes.length, 4, 'Must have exactly four [data-runtime-video-title] nodes');

  // 2. title fallback values are exactly: NORMAL, GO, REDRED, LOVE ATTACK
  assert.ok(html.includes('<strong data-runtime-video-title="true">NORMAL</strong>'));
  assert.ok(html.includes('<strong data-runtime-video-title="true">GO</strong>'));
  assert.ok(html.includes('<strong data-runtime-video-title="true">REDRED</strong>'));
  assert.ok(html.includes('<strong data-runtime-video-title="true">LOVE ATTACK</strong>'));

  // 3. those four title nodes have no `data-i18n`
  assert.ok(!html.includes('data-i18n="home.v3.growth.card1.title"'));
  assert.ok(!html.includes('data-i18n="home.v3.growth.card2.title"'));
  assert.ok(!html.includes('data-i18n="home.v3.growth.card3.title"'));
  assert.ok(!html.includes('data-i18n="home.v3.growth.card4.title"'));

  // 4. fixed video IDs and order unchanged
  assert.ok(js.includes(`{ id: 'GEk4jHwfFTA', title: 'NORMAL' }`));
  assert.ok(js.includes(`{ id: '2GJfWMYCWY0', title: 'GO' }`));
  assert.ok(js.includes(`{ id: 'U6BDbXIah-Y', title: 'REDRED' }`));
  assert.ok(js.includes(`{ id: '9XttLI0oH0I', title: 'LOVE ATTACK' }`));

  // 5. language listener uses one duplicate-binding guard
  assert.ok(js.includes('__lovebudHomeRuntimeMetadataLangBound'));

  // 6. language listener does not call `applyCurrentArtistToCards()` and targets window, not document
  assert.ok(!js.includes(`document.addEventListener('lovebud-lang-change'`), 'Must NOT bind lovebud-lang-change to document (canonical is window)');
  const listenerBody = js.match(/window\.addEventListener\('lovebud-lang-change'[^]*?\}\);/);
  assert.ok(listenerBody, 'Must bind to lovebud-lang-change on window');
  assert.ok(listenerBody[0].includes('refreshRuntimeCardMetadata'), 'Listener must call refreshRuntimeCardMetadata()');
  assert.ok(!listenerBody[0].includes('applyCurrentArtistToCards'), 'Listener must not call applyCurrentArtistToCards()');

  // 7. metadata-only locale refresh does not create an `img`
  const updateFuncs = js.match(/function updateCardMetadata[^]*?function applyCurrentArtistToCards/);
  assert.ok(updateFuncs, 'Must have metadata update functions');
  assert.ok(!updateFuncs[0].includes('document.createElement(\'img\')'), 'Refresh must not create img');

  // 8. metadata-only locale refresh does not change image src
  assert.ok(!updateFuncs[0].includes('img.src'), 'Refresh must not change image src');

  // 9. metadata-only locale refresh does not reset the stage/timer
  assert.ok(!updateFuncs[0].includes('setStageState'), 'Refresh must not reset stage state');
  assert.ok(!updateFuncs[0].includes('clearTimer'), 'Refresh must not clear timer');

  // 10. canonical language source does not depend solely on document `<html lang>`
  assert.ok(js.includes('window.getCurrentLang'), 'Language resolution must check window.getCurrentLang');
  
  // 11. script cache version is exactly `20260729-3627-1`
  assert.ok(html.includes('js/index-inline-init.js?v=20260729-3627-1'), 'Script version must be 20260729-3627-1');
});
