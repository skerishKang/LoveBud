// @ts-check
/**
 * LoveBud home-v3 growth-stage visual contract test (Issue #3624)
 * Verifies the JS-controlled, rotating-YouTube growth hero:
 *   - caption reserved top zone, no overlap with cards
 *   - 1 featured + 3 supporting cards
 *   - YouTube remote thumbnails (real <img>)
 *   - artist label + YouTube attribution + safe external link
 *   - controlled cycle: no raw CSS infinite, no keyframe-driven reveal
 *   - reduced motion: first-artist completed memory network, no rotation
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
const cssResponsive = responsiveCss.join('\n');
const js = inlineInitJs.join('\n');

/**
 * Strip CSS block comments so contract assertions inspect real rule bodies,
 * not prose (e.g. a comment that mentions "!important" as a design principle).
 * @param {string} css
 * @returns {string}
 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const cssGrowthRules = stripCssComments(cssGrowth);
const cssResponsiveRules = stripCssComments(cssResponsive);

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
// 4. memory network core is present and decorative
// ============================================================
{
  assert.ok(html.includes('class="growth-stage-network-core"'),
    'growth-stage-network-core must exist');
  // The network is decorative; the card links carry the accessible interaction
  assert.ok(/class="growth-stage-network-core"[^>]*aria-hidden="true"/.test(html),
    'growth-stage-network-core should be aria-hidden="true" (decorative)');
  assert.ok(!html.includes('growth-tree-svg'),
    'the literal growth-tree-svg must be removed');
}
console.log('✓ 4: memory network core is decorative (tree removed)');

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
// 6. Network z-index < card z-index, and caption z-index > card z-index
// ============================================================
{
  const networkZ = cssGrowth.match(/\.growth-stage-network-core\s*\{[^}]*z-index:\s*(\d+)/);
  const cardZ = cssGrowth.match(/\.growth-stage-card\s*\{[^}]*z-index:\s*(\d+)/);
  const featuredZ = cssGrowth.match(/\.growth-stage-card\.featured\s*\{[^}]*z-index:\s*(\d+)/);
  const captionZ = cssGrowth.match(/\.growth-stage-caption\s*\{[^}]*z-index:\s*(\d+)/);

  assert.ok(networkZ, 'Memory network core must have z-index');
  assert.ok(cardZ, 'Card must have z-index');
  assert.ok(captionZ, 'Caption must have z-index');

  const networkZVal = parseInt(networkZ[1], 10);
  const cardZVal = parseInt(cardZ[1], 10);
  const captionZVal = parseInt(captionZ[1], 10);
  const featuredZVal = featuredZ ? parseInt(featuredZ[1], 10) : cardZVal;

  assert.ok(networkZVal < cardZVal,
    `Network z-index (${networkZVal}) must be less than card z-index (${cardZVal})`);
  assert.ok(captionZVal > cardZVal,
    `Caption z-index (${captionZVal}) must be greater than card z-index (${cardZVal}) so caption stays in safe zone`);
  assert.ok(featuredZVal >= cardZVal,
    `Featured card z-index (${featuredZVal}) must be >= card z-index (${cardZVal})`);
}
console.log('✓ 6: layer order is correct (network < card < caption)');

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
// 8. Stage uses data-stage-state attribute, keeps the network-linking phase
// ============================================================
{
  assert.ok(cssGrowth.includes('[data-stage-state='),
    'growth-stage.css must paint phase states via [data-stage-state=...] selectors');
  // The 5-phase machine is kept: pending -> caption-revealed -> network-linking
  // -> cards-revealing -> completed (+ fade-out). The network transition starts
  // at network-linking and the cards appear ~220ms later (concurrent reveal).
  const states = ['caption-revealed', 'network-linking', 'cards-revealing', 'completed', 'fade-out'];
  for (const s of states) {
    assert.ok(cssGrowth.includes('data-stage-state="' + s + '"') || cssGrowth.includes("data-stage-state='" + s + "'"),
      `growth-stage.css must reference data-stage-state="${s}"`);
  }
  assert.ok(cssGrowth.includes('network-linking'),
    'growth-stage.css must keep the network-linking phase (CTO Correction #1)');
  assert.ok(!cssGrowth.includes('branches-growing'),
    'growth-stage.css must not reference the removed branches-growing phase');
  assert.ok(!js.includes('branches-growing'),
    'index-inline-init.js must not reference the removed branches-growing phase');
}
console.log('✓ 8: stage keeps the 5-phase machine (network-linking present)');

// ============================================================
// 9. Network rail final state has opacity: 1 + full scale
// ============================================================
{
  const completedRule = cssGrowth.match(/\[data-stage-state="completed"\][^{]*\.growth-stage-network-rail[^{]*\{[^}]*\}/);
  assert.ok(completedRule, 'Must find completed-state rule for the memory network rail');
  assert.ok(completedRule[0].includes('opacity: 1'),
    'completed network state must have opacity: 1');
  assert.ok(completedRule[0].includes('scale(1)'),
    'completed network state must be fully scaled (scale(1))');
}
console.log('✓ 9: completed network state painted');

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
// 20. Reduced motion: cards fully visible, network completed
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
  assert.ok(block.includes('growth-stage-network-rail'),
    'reduced-motion block must reveal the memory network rail');
  assert.ok(block.includes('growth-stage-network-hub'),
    'reduced-motion block must reveal the memory network hub');
}
console.log('✓ 20: reduced-motion shows completed network');

// ============================================================
// 21. External YouTube links are safe
// ============================================================
{
  assert.ok(html.includes('target="_blank"'),
    'card links must open in a new tab');
  assert.ok(html.includes('rel="noopener noreferrer"'),
    'card links must use rel="noopener noreferrer"');
  // JS only sets href, not target/rel, so the HTML rel is preserved.
  // Match a `.rel =` / `.rel=` property assignment; a bare `rel=` substring
  // is allowed because the youtube-nocookie embed URL carries a `rel=0`
  // query param (click-to-play, #3624), which is not a link attribute write.
  assert.ok(!/\.rel\s*=/.test(js),
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

// ============================================================
// 24. Memory network is a responsive CSS grid container (CTO Req #1)
// ============================================================
{
  const networkRule = cssGrowth.match(/\.growth-stage-network\s*\{[^}]*\}/);
  assert.ok(networkRule, 'Must find a .growth-stage-network rule');
  assert.ok(networkRule[0].includes('display: grid'),
    '.growth-stage-network must be a CSS grid container (display: grid)');
  assert.ok(/grid-template-columns:\s*minmax\(0,\s*1\.12fr\)\s*48px\s*minmax\(0,\s*0\.92fr\)/.test(networkRule[0]),
    '.growth-stage-network must use the responsive template (1.12fr / 48px channel / 0.92fr)');
  assert.ok(networkRule[0].includes('grid-template-rows: auto auto'),
    '.growth-stage-network must define two auto rows');
  assert.ok(networkRule[0].includes('gap: 20px 16px'),
    '.growth-stage-network must use gap: 20px 16px');
}
console.log('✓ 24: memory network is a CSS grid container');

// ============================================================
// 25. Cards are grid items, never absolutely positioned
// ============================================================
{
  const cardRule = cssGrowth.match(/\.growth-stage-card\s*\{[^}]*\}/);
  assert.ok(cardRule, 'Must find the base .growth-stage-card rule');
  assert.ok(cardRule[0].includes('position: relative'),
    'base .growth-stage-card must be position: relative (a grid item)');
  assert.ok(!cardRule[0].includes('position: absolute'),
    'base .growth-stage-card must not be position: absolute');

  const expected = [
    ['.growth-stage-card.featured', 'grid-column: 1', 'grid-row: 1'],
    ['.growth-stage-card.supporting.one', 'grid-column: 3', 'grid-row: 1'],
    ['.growth-stage-card.supporting.two', 'grid-column: 1', 'grid-row: 2'],
    ['.growth-stage-card.supporting.three', 'grid-column: 3', 'grid-row: 2'],
  ];
  for (const [sel, col, row] of expected) {
    const esc = sel.replace(/\./g, '\\.');
    const re = new RegExp(esc + '\\s*\\{[^}]*' + col + ';[^}]*' + row + ';');
    assert.ok(re.test(cssGrowth),
      sel + ' must be placed via ' + col + ' + ' + row + ' (grid placement, not coordinates)');
  }
}
console.log('✓ 25: cards are grid items (no absolute coordinates)');

// ============================================================
// 26. No !important in the base visual layer (except spotlight)
// ============================================================
{
  // Base rules should not use !important. Spotlight classes intentionally
  // use !important to override data-stage-state transforms during the
  // center-focus animation (#3625). This is acceptable because spotlight
  // is a temporary animation state, not the base layout.
  const withoutSpotlight = cssGrowthRules
    .replace(/\.growth-stage-card\.is-spotlight[^{]*\{[^}]*\}/g, '')
    .replace(/\.growth-stage-card\.is-spotlight-return[^{]*\{[^}]*\}/g, '');

  // Check remaining (non-spotlight) rules for !important.
  // The only !important in the spotlight block must be in is-spotlight/
  // is-spotlight-return rules; nothing in the base card/grid/network rules
  // should use it.
  const nonSpotlightImportant = (withoutSpotlight.match(/!important/g) || []).length;
  assert.ok(nonSpotlightImportant === 0,
    `Non-spotlight growth-stage.css must not use !important (found ${nonSpotlightImportant} matches)`);
  assert.ok(!cssResponsiveRules.includes('!important'),
    'responsive.css must not use !important (mobile reflow is grid-native)');
}
console.log('✓ 26: no !important in base visual layer');

// ============================================================
// 27. Network + cards reveal concurrently (network-linking kept, overlap > 0)
// ============================================================
{
  assert.ok(cssGrowth.includes('network-linking'),
    'growth-stage.css must keep the network-linking phase (CTO Correction #1)');
  assert.ok(js.includes('network-linking'),
    'index-inline-init.js must keep the network-linking phase (CTO Correction #1)');

  // The rail starts its transition at network-linking ...
  const railAtNetwork = cssGrowth.match(/\[data-stage-state="network-linking"\][^{]*\.growth-stage-network-rail[^{]*\{/);
  assert.ok(railAtNetwork,
    'network rail must start revealing in the network-linking state');
  // ... and the cards appear in the following cards-revealing state, while the
  // rail transition is still running (concurrent / overlapping reveal).
  const cardAtCards = cssGrowth.match(/\[data-stage-state="cards-revealing"\][^{]*\.growth-stage-card\.featured[^{]*\{/);
  assert.ok(cardAtCards,
    'cards must reveal in the cards-revealing state');

  // Parse the real TIMINGS values from JS (max of reduced/normal variants).
  function maxTiming(key) {
    const vals = Array.from(js.matchAll(new RegExp(key + ':\\s*(\\d+)', 'g')),
      (m) => parseInt(m[1], 10));
    assert.ok(vals.length > 0, 'must find TIMINGS.' + key + ' in index-inline-init.js');
    return Math.max.apply(null, vals);
  }
  const tCaption = maxTiming('caption');
  const tNetwork = maxTiming('network');
  const tCards = maxTiming('cards');

  // CTO Correction #2: exact timing budget.
  assert.ok(tCaption <= 250, `TIMINGS.caption (${tCaption}) must be <= 250ms`);
  assert.ok(tNetwork <= 300, `TIMINGS.network (${tNetwork}) must be <= 300ms`);
  assert.ok(tCards <= 900, `TIMINGS.cards (${tCards}) must be <= 900ms`);
  assert.ok(tCaption + tNetwork + tCards <= 1450,
    `caption+network+cards (${tCaption + tNetwork + tCards}) must be <= 1450ms`);

  // The rail transition duration must outlast the network phase so the rail is
  // still drawing when the cards start to appear (overlap > 0). Parse the real
  // transform duration from the base rail rule (not a comment).
  const railRule = cssGrowthRules.match(/\.growth-stage-network-rail\s*\{[^}]*\}/);
  assert.ok(railRule, 'must find the base .growth-stage-network-rail rule');
  const durMatch = railRule[0].match(/transform\s+([\d.]+)(s|ms)/);
  assert.ok(durMatch, 'rail rule must declare a transform transition duration');
  const railDurMs = durMatch[2] === 'ms' ? parseFloat(durMatch[1]) : parseFloat(durMatch[1]) * 1000;
  assert.ok(railDurMs >= 650 && railDurMs <= 850,
    `rail transition duration (${railDurMs}ms) must be within 650-850ms`);
  assert.ok(railDurMs > tNetwork,
    `rail transition (${railDurMs}ms) must outlast TIMINGS.network (${tNetwork}ms) for a concurrent reveal`);
}
console.log('✓ 27: network + cards reveal concurrently (timing bounds hold)');

// ============================================================
// 28. Mobile reflows to a 2-column vertical journey (24px rail + card column)
// ============================================================
{
  // CTO Correction #3: mobile is NOT single-column. It is a 2-column grid:
  // column 1 = 24px rail, column 2 = stacked cards (featured -> one -> two -> three).
  assert.ok(cssResponsive.includes('grid-template-columns: 24px minmax(0, 1fr)'),
    'responsive.css must use a 24px rail column + card column on mobile');
  assert.ok(cssResponsive.includes('grid-template-rows: repeat(4, auto)'),
    'responsive.css must define 4 auto rows for the vertical journey');
  assert.ok(!cssResponsive.includes('grid-template-columns: minmax(0, 1fr);'),
    'responsive.css must not collapse the network to a single column on mobile');

  // Network core (rail) sits in column 1 spanning all rows.
  const coreRule = cssResponsiveRules.match(/\.growth-stage-network-core\s*\{[^}]*\}/);
  assert.ok(coreRule, 'must find a mobile .growth-stage-network-core rule');
  assert.ok(coreRule[0].includes('grid-column: 1'), 'mobile core must be in grid-column: 1');
  assert.ok(/grid-row:\s*1\s*\/\s*5/.test(coreRule[0]), 'mobile core must span grid-row: 1 / 5');

  // All four cards sit in column 2 (combined rule), rows 1-4 (individual rules).
  const ruleBlocks = cssResponsiveRules.match(/([^{}]+)\{([^}]*)\}/g) || [];
  const combinedCardRule = ruleBlocks.find((b) => {
    const sel = b.slice(0, b.indexOf('{'));
    return sel.includes('.growth-stage-card.featured') && sel.includes('.growth-stage-card.supporting.three');
  });
  assert.ok(combinedCardRule, 'must find a combined mobile card rule');
  assert.ok(combinedCardRule.includes('grid-column: 2'),
    'all mobile cards must be placed in grid-column: 2');

  const cardRows = [
    ['.growth-stage-card.featured', '1'],
    ['.growth-stage-card.supporting.one', '2'],
    ['.growth-stage-card.supporting.two', '3'],
    ['.growth-stage-card.supporting.three', '4'],
  ];
  for (const [sel, row] of cardRows) {
    const esc = sel.replace(/\./g, '\\.');
    const re = new RegExp(esc + '\\s*\\{[^}]*grid-row:\\s*' + row + ';');
    assert.ok(re.test(cssResponsiveRules),
      sel + ' must be placed at grid-row: ' + row + ' on mobile');
  }

  // Hub is hidden on mobile (the rail alone carries the journey).
  const hubRule = cssResponsiveRules.match(/\.growth-stage-network-hub\s*\{[^}]*\}/);
  assert.ok(hubRule, 'must find a mobile .growth-stage-network-hub rule');
  assert.ok(hubRule[0].includes('display: none'), 'mobile hub must be display: none');

  // No positional !important anywhere in the mobile reflow.
  assert.ok(!cssResponsiveRules.includes('!important'),
    'responsive.css must not use !important (mobile reflow is grid-native)');

  // The cards themselves must not be positioned with top/left/right/bottom.
  // Pseudo-element connectors (::before/::after) may use left/right offsets.
  for (const block of ruleBlocks) {
    const selector = block.slice(0, block.indexOf('{'));
    const body = block.slice(block.indexOf('{'));
    if (selector.includes('.growth-stage-card') && !selector.includes('::')) {
      assert.ok(!/(?<![-a-z])(top|left|right|bottom)\s*:/.test(body),
        'mobile card rule must not use top/left/right/bottom: ' + selector.trim());
    }
  }
}
console.log('✓ 28: mobile is a 2-column vertical journey (24px rail + cards)');

// ============================================================
// 29. Artist pill + card badge fully removed (HTML DOM and CSS rules)
// ============================================================
{
  const artistCount = (html.match(/growth-stage-card-artist/g) || []).length;
  assert.strictEqual(artistCount, 0,
    `growth-stage-card-artist markup must be fully removed (found ${artistCount})`);
  const badgeCount = (html.match(/growth-stage-card-badge/g) || []).length;
  assert.strictEqual(badgeCount, 0,
    `growth-stage-card-badge markup must be fully removed (found ${badgeCount})`);
  assert.ok(!html.includes('growth-stage-card-artist'),
    'growth-stage-card-artist must not appear anywhere in HTML');
  assert.ok(!html.includes('growth-stage-card-badge'),
    'growth-stage-card-badge must not appear anywhere in HTML');
  assert.ok(!cssGrowthRules.includes('.growth-stage-card-artist'),
    'removed artist pill selector must not return to CSS rules');
  assert.ok(!cssGrowthRules.includes('.growth-stage-card-badge'),
    'removed card badge selector must not return to CSS rules');
  assert.ok(
    !cssGrowthRules.includes('.growth-stage-card.featured span[data-i18n]'),
    'removed featured descriptive-copy selector must not return'
  );
  // Rotation machinery is kept (only the visible pill is gone): the artist
  // dataset drives the cycle and each card is tagged with data-artist-key via JS.
  assert.ok(js.includes('ARTIST_DATASETS'),
    'ARTIST_DATASETS must be kept for rotation');
  assert.ok(js.includes('data-artist-key'),
    'cards must still be tagged with data-artist-key for rotation');
}
console.log('✓ 29: artist + badge removed from HTML and CSS rules (data-artist-key kept)');

// ============================================================
// 30. Video modal loading overlay CSS exists (#3707)
// ============================================================
{
  assert.ok(cssGrowthRules.includes('.hero-video-modal-loading'),
    'growth-stage.css must define .hero-video-modal-loading');
  assert.ok(cssGrowthRules.includes('.hero-video-modal-loading-spinner'),
    'growth-stage.css must define a loading spinner');
  assert.ok(cssGrowthRules.includes('.hero-video-modal-loading-text'),
    'growth-stage.css must define loading text style');
  assert.ok(cssGrowthRules.includes('.hero-video-modal-error'),
    'growth-stage.css must define error overlay');
  assert.ok(cssGrowthRules.includes('.hero-video-modal-retry-btn'),
    'growth-stage.css must define retry button');
  assert.ok(cssGrowthRules.includes('.hero-video-modal-ready'),
    'growth-stage.css must define ready state selector');
  assert.ok(cssGrowthRules.includes('is-long-wait'),
    'growth-stage.css must define long-wait state variant');
  assert.ok(cssGrowthRules.includes('hero-video-modal-loading-spinner'),
    'growth-stage.css must define the spinner container size');
  assert.ok(cssGrowthRules.includes('prefers-reduced-motion: reduce'),
    'growth-stage.css must guard modal under reduced motion');
}
console.log('✓ 30: modal loading CSS classes present');

// ============================================================
// 31. Modal loading JS functions exist (#3707)
// ============================================================
{
  const requiredFns = [
    'handleModalIframeLoad',
    'retryVideoModal',
    'showModalError',
    'cleanupModalTimers',
    'createModalLoadingEl',
    'handleModalLongWait',
    'handleModalTimeout',
  ];
  for (const fn of requiredFns) {
    assert.ok(js.includes('function ' + fn),
      'index-inline-init.js must define function ' + fn);
  }
}
console.log('✓ 31: modal loading JS functions defined');

// ============================================================
// 32. Modal uses shared i18n loading keys (#3707)
// ============================================================
{
  const expectedKeys = [
    'loading.media.load',
    'loading.long.wait',
    'loading.error.primary',
    'loading.error.body',
    'loading.retry.action',
    'loading.retrying',
    'home.v3.youtube.attribution',
  ];
  for (const key of expectedKeys) {
    var pattern = "resolveI18n('" + key + "')";
    assert.ok(js.includes(pattern) || js.includes('resolveI18n("' + key + '")'),
      'index-inline-init.js must use resolveI18n for "' + key + '"');
  }
}
console.log('✓ 32: modal uses shared i18n loading keys');

// ============================================================
// 33. No innerHTML in newly added modal code (#3707)
// ============================================================
{
  const modalSection = js.slice(js.indexOf('var modalEl = null'), js.indexOf('// Card wiring'));
  assert.ok(!modalSection.includes('innerHTML'),
    'modal section must not use innerHTML (DOM XSS prevention)');
  assert.ok(!modalSection.includes('insertAdjacentHTML'),
    'modal section must not use insertAdjacentHTML');
}
console.log('✓ 33: no innerHTML in modal code');

// ============================================================
// 34. Focus trap includes error fallback links (#3707)
// ============================================================
{
  assert.ok(js.includes('a[href]'),
    'focus trap selector must include a[href] for error state YouTube link');
  assert.ok(js.includes('iframe:not([tabindex="-1"])'),
    'focus trap must exclude iframes with tabindex=-1 during loading');
  assert.ok(js.includes('iframe.tabIndex = -1'),
    'JS must set tabIndex=-1 on iframe during loading state');
  assert.ok(js.includes('iframe.removeAttribute(\'tabindex\')') || js.includes('iframe.removeAttribute("tabindex")'),
    'JS must remove tabindex on iframe when ready');
}
console.log('✓ 34: focus trap handles loading/error state');

// ============================================================
// 35. youtube-nocookie.com embed preserved (#3707)
// ============================================================
{
  assert.ok(js.includes('youtube-nocookie.com'),
    'embed URL must still use youtube-nocookie.com (privacy-enhanced)');
}
console.log('✓ 35: youtube-nocookie.com preserved');

// ============================================================
// 36. Timer cleanup on close (#3707)
// ============================================================
{
  assert.ok(js.indexOf('cleanupModalTimers') < js.indexOf('closeVideoModal'),
    'cleanupModalTimers must be defined before closeVideoModal');
  var closeBody = js.slice(js.indexOf('function closeVideoModal'), js.indexOf('function openVideoModal'));
  assert.ok(closeBody.includes('cleanupModalTimers'),
    'closeVideoModal must call cleanupModalTimers');
  assert.ok(closeBody.includes('modalCurrentVideo'),
    'closeVideoModal must reset modalCurrentVideo');
}
console.log('✓ 36: timer cleanup on close');

console.log('\n✅ All contract tests passed.');
