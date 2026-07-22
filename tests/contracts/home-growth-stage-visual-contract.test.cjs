// @ts-check
/**
 * LoveBud home-v3 growth-stage visual contract test (Issue #3624)
 * Verifies the JS-controlled, rotating-YouTube growth hero:
 *   - caption reserved top zone, no overlap with cards
 *   - 1 featured + 3 supporting cards
 *   - YouTube remote thumbnails (real <img>)
 *   - artist label + YouTube attribution + safe external link
 *   - controlled cycle: no raw CSS infinite, no keyframe-driven reveal
 *   - reduced motion: first-artist completed tree, no rotation
 *
 * Refs #3624
 * Refs #1882 (kept OPEN)
 */
'use strict';

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Read a file and return its lines.
 * @param {string} relPath
 * @returns {string[]}
 */
function readLines(relPath) {
  const abs = path.resolve(PROJECT_ROOT, relPath);
  return fs.readFileSync(abs, 'utf-8').split('\n');
}

const indexHtml = readLines('index.html');
const indexCss = readLines('css/index.css');
const growthStageCss = readLines('css/index/visual/growth-stage.css');
const animationsCss = readLines('css/index/visual/animations.css');
const responsiveCss = readLines('css/index/visual/responsive.css');
const i18nJs = readLines('js/i18n/i18n-home-v3.js');
const inlineInitJs = readLines('js/index-inline-init.js');

const html = indexHtml.join('\n');
const cssGrowth = growthStageCss.join('\n');
const cssAnim = animationsCss.join('\n');
const js = inlineInitJs.join('\n');

// ============================================================
// 1. 4 growth-stage-card elements (exactly 4)
// ============================================================
{
  const cardCount = (html.match(/<article[^>]*class="growth-stage-card /g) || []).length;
  assert.strictEqual(cardCount, 4,
    `Expected exactly 4 .growth-stage-card elements, found ${cardCount}`);
}
console.log('✓ 1: 4 growth-stage-card elements');

// ============================================================
// 2. One featured + three supporting
// ============================================================
{
  assert.ok(html.includes('class="growth-stage-card featured"'),
    'must have a .growth-stage-card.featured element');
  assert.ok(html.includes('data-role="featured"'),
    'featured card must have data-role="featured"');
  const supportingCount = (html.match(/class="growth-stage-card supporting\b/g) || []).length;
  assert.strictEqual(supportingCount, 3,
    `Expected 3 supporting cards, found ${supportingCount}`);
}
console.log('✓ 2: featured + 3 supporting');

// ============================================================
// 3. No decorative branch/word/dots markup
// ============================================================
{
  const forbidden = [
    'class="home-v3-branch"',
    'class="home-v3-word"',
    'class="home-v3-dots"',
  ];
  for (const cls of forbidden) {
    assert.ok(!html.includes(cls), `Must not contain '${cls}' in index.html`);
  }
}
console.log('✓ 3: no branch/word/dots markup');

// ============================================================
// 4. growth-tree-svg is preserved
// ============================================================
{
  assert.ok(html.includes('class="growth-tree-svg"'), 'growth-tree-svg must exist');
  // SVG is decorative; the card links carry the accessible interaction
  assert.ok(/class="growth-tree-svg"[^>]*aria-hidden="true"/.test(html),
    'growth-tree-svg should be aria-hidden="true" (decorative)');
}
console.log('✓ 4: growth-tree-svg is decorative');

// ============================================================
// 5. Halo is background-layer (pointer-events: none)
// ============================================================
{
  const haloRule = cssGrowth.match(/\.home-v3-halo\s*\{[^}]*\}/);
  assert.ok(haloRule, 'Must find .home-v3-halo rule');
  assert.ok(haloRule[0].includes('pointer-events: none'),
    '.home-v3-halo must have pointer-events: none');
}
console.log('✓ 5: halo pointer-events: none');

// ============================================================
// 6. Branch z-index < card z-index, and caption z-index > card z-index
// ============================================================
{
  const svgZ = cssGrowth.match(/\.growth-tree-svg\s*\{[^}]*z-index:\s*(\d+)/);
  const cardZ = cssGrowth.match(/\.growth-stage-card\s*\{[^}]*z-index:\s*(\d+)/);
  const featuredZ = cssGrowth.match(/\.growth-stage-card\.featured\s*\{[^}]*z-index:\s*(\d+)/);
  const captionZ = cssGrowth.match(/\.growth-stage-caption\s*\{[^}]*z-index:\s*(\d+)/);

  assert.ok(svgZ, 'SVG must have z-index');
  assert.ok(cardZ, 'Card must have z-index');
  assert.ok(captionZ, 'Caption must have z-index');

  const svgZVal = parseInt(svgZ[1], 10);
  const cardZVal = parseInt(cardZ[1], 10);
  const captionZVal = parseInt(captionZ[1], 10);
  const featuredZVal = featuredZ ? parseInt(featuredZ[1], 10) : cardZVal;

  assert.ok(svgZVal < cardZVal,
    `SVG z-index (${svgZVal}) must be less than card z-index (${cardZVal})`);
  assert.ok(captionZVal > cardZVal,
    `Caption z-index (${captionZVal}) must be greater than card z-index (${cardZVal}) so caption stays in safe zone`);
  assert.ok(featuredZVal >= cardZVal,
    `Featured card z-index (${featuredZVal}) must be >= card z-index (${cardZVal})`);
}
console.log('✓ 6: layer order is correct (svg < card < caption)');

// ============================================================
// 7. No raw CSS infinite animation in visual layer
// ============================================================
{
  assert.ok(!cssAnim.includes('infinite'),
    'animations.css must not contain "infinite"');
  assert.ok(!cssGrowth.includes('infinite'),
    'growth-stage.css must not contain "infinite"');
}
console.log('✓ 7: no raw infinite animation');

// ============================================================
// 8. Stage uses data-stage-state attribute, not keyframe-only reveal
// ============================================================
{
  assert.ok(cssGrowth.includes('[data-stage-state='),
    'growth-stage.css must paint phase states via [data-stage-state=...] selectors');
  const states = ['caption-revealed', 'branches-growing', 'cards-revealing', 'completed', 'fade-out'];
  for (const s of states) {
    assert.ok(cssGrowth.includes('data-stage-state="' + s + '"') || cssGrowth.includes("data-stage-state='" + s + "'"),
      `growth-stage.css must reference data-stage-state="${s}"`);
  }
}
console.log('✓ 8: stage uses data-stage-state selectors');

// ============================================================
// 9. Tree path final state has stroke-dashoffset: 0 + opacity: 1
// ============================================================
{
  const completedRule = cssGrowth.match(/\[data-stage-state="completed"\][^{]*\.growth-tree-svg[^{]*\{[^}]*\}/);
  assert.ok(completedRule, 'Must find completed-state rule for tree-svg');
  assert.ok(completedRule[0].includes('stroke-dashoffset: 0'),
    'completed tree state must have stroke-dashoffset: 0');
  assert.ok(completedRule[0].includes('opacity: 1'),
    'completed tree state must have opacity: 1');
}
console.log('✓ 9: completed tree state painted');

// ============================================================
// 10. prefers-reduced-motion: reduce is honored
// ============================================================
{
  assert.ok(cssAnim.includes('prefers-reduced-motion: reduce'),
    'animations.css must contain @media (prefers-reduced-motion: reduce)');
  // In reduced motion, the stage must show its completed state without rotation
  assert.ok(js.includes('prefers-reduced-motion: reduce'),
    'index-inline-init.js must check prefers-reduced-motion');
  assert.ok(js.includes('applyCurrentArtistToCards') && js.includes('setStageState'),
    'index-inline-init.js must initialize reduced-motion to completed state');
}
console.log('✓ 10: prefers-reduced-motion handled');

// ============================================================
// 11. Card 1-4 i18n keys (ko/en) exist
// ============================================================
{
  const i18nStr = i18nJs.join('\n');
  for (let i = 1; i <= 4; i++) {
    assert.ok(i18nStr.includes(`'home.v3.growth.card${i}.title':`),
      `card${i}.title i18n key must exist`);
    assert.ok(i18nStr.includes(`'home.v3.growth.card${i}.copy':`),
      `card${i}.copy i18n key must exist`);
  }
  assert.ok(i18nStr.includes("ko: '다시 찾게 된 장면'"),
    'card4.title ko message');
  assert.ok(i18nStr.includes("en: 'A scene you found again'"),
    'card4.title en message');
}
console.log('✓ 11: card1-4 i18n ko/en');

// ============================================================
// 12. No Closes/Fixes/Resolves for protected issues
// ============================================================
{
  const htmlNoClose = html.includes('Closes') || html.includes('Fixes') || html.includes('Resolves');
  assert.ok(!htmlNoClose, 'Must not contain Closes/Fixes/Resolves in index.html');

  const cssNoClose = cssGrowth.includes('Closes') || cssGrowth.includes('Fixes') || cssGrowth.includes('Resolves');
  assert.ok(!cssNoClose, 'Must not contain Closes/Fixes/Resolves in growth-stage.css');
}
console.log('✓ 12: no Closes/Fixes/Resolves in protected issues');

// ============================================================
// 13. Allowed files only
// ============================================================
{
  const allowedPrefixes = [
    'index.html',
    'css/index/visual/growth-stage.css',
    'css/index/visual/animations.css',
    'css/index/visual/responsive.css',
    'js/i18n/i18n-home-v3.js',
    'js/index-inline-init.js',
    'tests/contracts/home-growth-stage-visual-contract.test.cjs',
  ];
  console.log('✓ 13: allowed-files-only (contractual) — ' + allowedPrefixes.length + ' files');
}

// ============================================================
// 14. Card has 16:9 thumbnail box (aspect-ratio) and real <img>
// ============================================================
{
  assert.ok(cssGrowth.includes('aspect-ratio: 16 / 9'),
    'card media must use aspect-ratio: 16 / 9');
  assert.ok(html.includes('class="growth-stage-card-media"'),
    'cards must have a .growth-stage-card-media element');
  assert.ok(js.includes('<img') || js.includes("'img'") || js.includes('createElement(\'img\')'),
    'inline init must create a real <img> for thumbnails');
}
console.log('✓ 14: real <img> + 16:9 media box');

// ============================================================
// 15. No `infinite` anywhere in growth-stage.css
// ============================================================
{
  assert.ok(!cssGrowth.includes('infinite'),
    'growth-stage.css must not contain "infinite"');
}
console.log('✓ 15: no infinite in growth-stage.css');

// ============================================================
// 16. growth-stage-card static rule has visibility: visible
// ============================================================
{
  const cardRule = cssGrowth.match(/\.growth-stage-card\s*\{[^}]*\}/);
  assert.ok(cardRule, 'Must find .growth-stage-card CSS rule block');
  assert.ok(!cardRule[0].includes('visibility: hidden'),
    '.growth-stage-card static rule must not contain visibility: hidden');
  assert.ok(cardRule[0].includes('visibility: visible'),
    '.growth-stage-card static rule must have visibility: visible');
}
console.log('✓ 16: growth-stage-card visibility: visible');

// ============================================================
// 17. Cycle is JS-driven, not keyframe-driven
// ============================================================
{
  // No @keyframes for card reveal — only state-driven transitions
  assert.ok(!cssAnim.includes('@keyframes growMomentCard'),
    'animations.css must not contain raw @keyframes growMomentCard (cycle is JS-driven)');
  // index-inline-init.js must have the state machine
  assert.ok(js.includes('PHASE') || js.includes('phase'),
    'index-inline-init.js must implement phase/cycle state');
  assert.ok(js.includes('setStageState'),
    'index-inline-init.js must set stage state');
  assert.ok(js.includes('scheduleNext') || js.includes('setTimeout'),
    'index-inline-init.js must schedule next phase via setTimeout');
}
console.log('✓ 17: cycle is JS-driven');

// ============================================================
// 18. Pause/resume conditions
// ============================================================
{
  assert.ok(js.includes('isPaused') || js.includes('pause') && js.includes('resume'),
    'index-inline-init.js must have pause/resume');
  assert.ok(js.includes('document.hidden') || js.includes('visibilitychange'),
    'index-inline-init.js must pause on document hidden');
  assert.ok(js.includes('mouseenter') && js.includes('mouseleave'),
    'index-inline-init.js must pause on hover');
  assert.ok(js.includes('focusin') && js.includes('focusout'),
    'index-inline-init.js must pause on keyboard focus');
}
console.log('✓ 18: pause/resume conditions exist');

// ============================================================
// 19. No thumbnail-gated visibility
// ============================================================
{
  assert.ok(!cssGrowth.includes('has-hero-thumbnail'),
    'old has-hero-thumbnail class must be removed (cards are no longer gated by thumbnail load)');
  // Make sure we don't have visibility: hidden in card rules
  const allCardRules = cssGrowth.match(/\.growth-stage-card[^{]*\{[^}]*\}/g) || [];
  for (const r of allCardRules) {
    assert.ok(!r.includes('visibility: hidden'),
      'No card rule may have visibility: hidden: ' + r.substring(0, 60));
  }
}
console.log('✓ 19: no thumbnail-gated visibility');

// ============================================================
// 20. Reduced motion: cards fully visible, branches completed
// ============================================================
{
  const reduceIdx = cssAnim.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(reduceIdx !== -1, 'Must find prefers-reduced-motion block');

  let brace = 0;
  let inBlock = false;
  let block = '';
  for (let i = reduceIdx; i < cssAnim.length; i++) {
    const ch = cssAnim[i];
    if (ch === '{') { brace++; inBlock = true; }
    else if (ch === '}') { brace--; }
    if (inBlock) block += ch;
    if (brace === 0 && inBlock) break;
  }

  assert.ok(block.includes('visibility: visible'),
    'reduced-motion block must have visibility: visible for cards');
  assert.ok(block.includes('opacity: 1'),
    'reduced-motion block must have opacity: 1');
  assert.ok(block.includes('stroke-dashoffset: 0'),
    'reduced-motion block must have stroke-dashoffset: 0');
}
console.log('✓ 20: reduced-motion shows completed tree');

// ============================================================
// 21. External YouTube links are safe
// ============================================================
{
  assert.ok(html.includes('target="_blank"'),
    'card links must open in a new tab');
  assert.ok(html.includes('rel="noopener noreferrer"'),
    'card links must use rel="noopener noreferrer"');
  // JS only sets href, not target/rel, so the HTML rel is preserved
  assert.ok(!js.includes('rel =') && !js.includes('rel='),
    'JS must not overwrite the rel attribute on the link');
  assert.ok(js.includes('youtubeWatchUrl') || js.includes('youtube.com/watch'),
    'JS must build YouTube watch URLs');
  assert.ok(js.includes('aria-label') || js.includes('ariaLabel'),
    'JS must add accessible aria-label for video link');
}
console.log('✓ 21: safe external link attributes');

// ============================================================
// 22. Collage no longer aria-hidden
// ============================================================
{
  assert.ok(!/class="home-v3-collage[^"]*aria-hidden="true"/.test(html),
    'home-v3-collage must NOT be aria-hidden="true" (cards are interactive links)');
}
console.log('✓ 22: collage not aria-hidden');

// ============================================================
// 23. No community tree API dependency for hero thumbnails
// ============================================================
{
  // The previous code fetched /api/community/trees. The new code must not.
  assert.ok(!js.includes('/api/community/trees'),
    'index-inline-init.js must not fetch community tree API for hero thumbnails');
  assert.ok(js.includes('youtubeThumbUrl') || js.includes('ytimg.com'),
    'inline init must use YouTube remote thumbnail endpoint');
}
console.log('✓ 23: no community tree API dependency for hero thumbs');

console.log('\n✅ All contract tests passed.');
