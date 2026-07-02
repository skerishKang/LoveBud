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

  // 1. index.html has growth-tree-svg and exactly 4 growth-stage-cards
  assert.ok(html.includes('growth-tree-svg'), 'index.html must have growth-tree-svg');
  const matches = html.match(/class="[^"]*growth-stage-card\b[^"]*"/g) || [];
  assert.equal(matches.length, 4, `index.html must have exactly 4 growth-stage-cards, found ${matches.length}`);

  // 2. index.html does not have home-v3-card and home-v3-note-paper
  assert.ok(!html.includes('home-v3-card'), 'index.html must not contain home-v3-card markup');
  assert.ok(!html.includes('home-v3-note-paper'), 'index.html must not contain home-v3-note-paper markup');
});

test('Contract: css manifest and growth-stage.css rules', () => {
  // 3. css/index-visual.css does not import cards.css
  const manifest = fs.readFileSync(CSS_MANIFEST_PATH, 'utf8');
  assert.ok(!manifest.includes('cards.css'), 'index-visual.css must not import cards.css');

  // 4. growth-stage.css has default hidden policy
  const growthCss = fs.readFileSync(GROWTH_STAGE_CSS_PATH, 'utf8');
  const defaultPolicyPattern = /\.growth-stage-card\s*\{[^}]*opacity:\s*0;[^}]*visibility:\s*visible;[^}]*pointer-events:\s*none;/;
  assert.ok(defaultPolicyPattern.test(growthCss), 'growth-stage.css must have default hidden policy for .growth-stage-card');

  // 5. growth-stage.css uses animation-based reveal (not toggled visibility)
  const animatePattern = /\.growth-stage-card\s*\{[^}]*animation:\s*growMomentCard[^}]*\bboth\b/;
  assert.ok(animatePattern.test(growthCss), 'growth-stage.css must use animation growMomentCard with "both" fill mode');
});

test('Contract: index-inline-init.js class adjustments and fallback absence', () => {
  const js = fs.readFileSync(JS_PATH, 'utf8');

  // 6. index-inline-init.js adds has-hero-thumbnail and has-real-thumbnails on onload
  assert.ok(js.includes('has-hero-thumbnail'), 'index-inline-init.js must add has-hero-thumbnail class');
  assert.ok(js.includes('has-real-thumbnails'), 'index-inline-init.js must add has-real-thumbnails class');

  // 7. fetch failure path does not create fabricated static card fallback
  assert.ok(!js.includes('card-root') && !js.includes('home-v3-card'), 'index-inline-init.js must not create fallback static cards');
});

test('Contract: index.html query param cache-bust values', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 8. index.html CSS/JS cache-bust are all 20260701-2821-1
  assert.match(
    html,
    /href="css\/index-visual\.css\?v=20260701-2821-1"/,
    'index.html css/index-visual.css version must be 20260701-2821-1'
  );
  assert.match(
    html,
    /src="js\/index-inline-init\.js\?v=20260701-2821-1"/,
    'index.html js/index-inline-init.js version must be 20260701-2821-1'
  );
});
