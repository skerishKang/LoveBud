const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const JS_PATH = path.join(ROOT, 'js', 'index-inline-init.js');
const CSS_MANIFEST_PATH = path.join(ROOT, 'css', 'index-visual.css');
const GROWTH_STAGE_CSS_PATH = path.join(ROOT, 'css', 'index', 'visual', 'growth-stage.css');

test('Contract: index.html elements integrity', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. index.html has the memory network (the literal tree is removed) and exactly 4 growth-stage-cards
  assert.ok(html.includes('growth-stage-network'),
    'index.html must have the growth-stage-network wrapper');
  assert.ok(html.includes('growth-stage-network-core'),
    'index.html must have the growth-stage-network-core');
  assert.ok(!html.includes('growth-tree-svg'),
    'the literal growth-tree-svg must be removed from index.html');
  const matches = html.match(/<article[^>]*class="growth-stage-card /g) || [];
  assert.equal(matches.length, 4, `index.html must have exactly 4 growth-stage-cards, found ${matches.length}`);

  // 2. There is one featured card and three supporting cards.
  assert.ok(html.includes('class="growth-stage-card featured"'),
    'index.html must have a featured card');
  const supporting = (html.match(/class="growth-stage-card supporting /g) || []).length;
  assert.equal(supporting, 3, `index.html must have 3 supporting cards, found ${supporting}`);

  // 3. index.html must not have legacy decorative markup
  assert.ok(!html.includes('home-v3-card'), 'index.html must not contain home-v3-card markup');
  assert.ok(!html.includes('home-v3-note-paper'), 'index.html must not contain home-v3-note-paper markup');
  assert.ok(!html.includes('growth-stage-card one"'),
    'legacy .growth-stage-card.one/two/three/four classes must be removed');
});

test('Contract: css manifest and growth-stage.css rules', () => {
  // 4. css/index-visual.css does not import cards.css
  const manifest = fs.readFileSync(CSS_MANIFEST_PATH, 'utf8');
  assert.ok(!manifest.includes('cards.css'), 'index-visual.css must not import cards.css');

  // 5. growth-stage.css has default hidden policy
  const growthCss = fs.readFileSync(GROWTH_STAGE_CSS_PATH, 'utf8');
  const defaultPolicyPattern = /\.growth-stage-card\s*\{[^}]*opacity:\s*0;[^}]*visibility:\s*visible;[^}]*pointer-events:\s*none;/;
  assert.ok(defaultPolicyPattern.test(growthCss),
    'growth-stage.css must have default hidden policy for .growth-stage-card');

  // 6. growth-stage.css uses state-based reveal (not keyframe + fill-mode)
  const stateAttrPattern = /\[data-stage-state="cards-revealing"\][^{]*\.growth-stage-card/;
  assert.ok(stateAttrPattern.test(growthCss),
    'growth-stage.css must use [data-stage-state="cards-revealing"] for card reveal');
});

test('Contract: index-inline-init.js — no community tree API', () => {
  const js = fs.readFileSync(JS_PATH, 'utf8');

  // 7. JS must NOT depend on the community trees API for hero thumbnails.
  assert.ok(!js.includes('/api/community/trees'),
    'index-inline-init.js must not fetch community tree API for hero thumbnails');
  assert.ok(!js.includes('representativeThumbnail') && !js.includes('representative_thumbnail'),
    'index-inline-init.js must not read community tree thumbnail fields');
  assert.ok(!js.includes('has-hero-thumbnail') && !js.includes('has-real-thumbnails'),
    'legacy community-tree thumbnail class flags must be removed');

  // 8. JS must use curated artist dataset and YouTube remote thumbnails.
  assert.ok(js.includes('ARTIST_DATASETS') || js.includes('artist'),
    'index-inline-init.js must define a curated artist dataset');
  assert.ok(js.includes('youtubeThumbUrl') || js.includes('ytimg.com'),
    'index-inline-init.js must use YouTube remote thumbnail endpoint');
  assert.ok(js.includes('youtubeWatchUrl') || js.includes('youtube.com/watch'),
    'index-inline-init.js must use YouTube watch URLs');
});

test('Contract: index.html query param cache-bust values', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 9. index.html CSS/JS cache-bust are 20260722-3624-1 (this issue)
  assert.match(
    html,
    /href="css\/index-visual\.css\?v=20260722-3624-1"/,
    'index.html css/index-visual.css version must be 20260722-3624-1'
  );
  assert.match(
    html,
    /src="js\/index-inline-init\.js\?v=20260722-3624-1"/,
    'index.html js/index-inline-init.js version must be 20260722-3624-1'
  );
  assert.match(
    html,
    /src="js\/i18n\/i18n-home-v3\.js\?v=20260722-3624-1"/,
    'index.html js/i18n/i18n-home-v3.js version must be 20260722-3624-1'
  );
});
