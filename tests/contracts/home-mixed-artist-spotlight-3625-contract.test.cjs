// @ts-check
/**
 * LoveBud #3625 mixed-artist center-spotlight showcase contract test.
 * Verifies the fixed four-artist tree with sequential card spotlight:
 *   - RESCENE → BTS → BLACKPINK → CORTIS order
 *   - spotlight card movement (is-spotlight / is-spotlight-return)
 *   - no artist rotation (fixed card-to-artist mapping)
 *   - controlled cycle with spotlight sub-phases
 *   - reduced motion: no spotlight movement, static completed tree
 *   - spotlight zone exists in markup
 *   - caption theme updated for mixed-artist showcase
 *   - each card has unique artist-key in HTML
 *
 * Refs #3625.
 * Refs #3624 — Keep #3624 OPEN.
 * Refs #3425 — Keep #3425 OPEN.
 * Refs #3458 — Keep #3458 OPEN.
 * Refs #1882 — Keep #1882 OPEN.
 */
'use strict';

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readLines(relPath) {
  const abs = path.resolve(PROJECT_ROOT, relPath);
  return fs.readFileSync(abs, 'utf-8').split('\n');
}

const indexHtml = readLines('index.html');
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
const i18nStr = i18nJs.join('\n');

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const cssGrowthRules = stripCssComments(cssGrowth);
const cssResponsiveRules = stripCssComments(cssResponsive);

// ============================================================
// 1. Four cards with distinct artist-key attributes
// ============================================================
{
  const artistKeys = html.match(/data-artist-key="[^"]+"/g) || [];
  const keys = artistKeys.map(m => m.match(/data-artist-key="([^"]+)"/)[1]);
  assert.strictEqual(keys.length, 4,
    `Expected 4 data-artist-key attributes, found ${keys.length}`);
  // Order must be BTS, BLACKPINK, CORTIS, RESCENE
  const expectedOrder = ['bts', 'blackpink', 'cortis', 'rescene'];
  assert.deepStrictEqual(keys, expectedOrder,
    `Artist key order must be [${expectedOrder}], got [${keys}]`);
}
console.log('✓ 1: 4 cards with fixed artist keys in order');

// ============================================================
// 2. Each card has a unique artist channel label (not all same)
// ============================================================
{
  const channelLabels = html.match(/data-i18n="home\.v3\.artist\.channel\.[^"]+"/g) || [];
  assert.strictEqual(channelLabels.length, 4,
    `Expected 4 channel labels, found ${channelLabels.length}`);
  const chKeys = channelLabels.map(m => m.match(/home\.v3\.artist\.channel\.([^"]+)/)[1]);
  assert.strictEqual(new Set(chKeys).size, 4,
    'Each card must have a distinct artist channel label');
}
console.log('✓ 2: each card has distinct channel label');

// ============================================================
// 3. Collage uses data-hero-spotlight (not data-hero-cycle)
// ============================================================
{
  assert.ok(html.includes('data-hero-spotlight="active"'),
    'index.html collage must use data-hero-spotlight="active" (not data-hero-cycle)');
  assert.ok(!html.includes('data-hero-cycle'),
    'index.html must not retain legacy data-hero-cycle attribute');
  assert.ok(!html.includes('data-hero-artist'),
    'index.html must not retain legacy data-hero-artist attribute');
}
console.log('✓ 3: collage uses data-hero-spotlight');

// ============================================================
// 4. Spotlight zone exists in markup
// ============================================================
{
  assert.ok(html.includes('class="growth-stage-spotlight-zone"'),
    'index.html must contain .growth-stage-spotlight-zone');
  assert.ok(html.includes('aria-hidden="true"'),
    'spotlight zone must be aria-hidden');
}
console.log('✓ 4: spotlight zone element present');

// ============================================================
// 5. Caption updated for mixed-artist theme
// ============================================================
{
  assert.ok(html.includes('세대를 건너 이어진 네 개의 무대'),
    'index.html must show the mixed-artist caption text');
  assert.ok(i18nStr.includes('세대를 건너 이어진 네 개의 무대'),
    'i18n must define the mixed-artist caption (ko)');
  assert.ok(i18nStr.includes('Four stages connected across generations'),
    'i18n must define the mixed-artist caption (en)');
}
console.log('✓ 5: caption updated for mixed-artist theme');

// ============================================================
// 6. CSS spotlight classes exist
// ============================================================
{
  assert.ok(cssGrowth.includes('.growth-stage-card.is-spotlight'),
    'growth-stage.css must define .growth-stage-card.is-spotlight');
  assert.ok(cssGrowth.includes('.growth-stage-card.is-spotlight-return'),
    'growth-stage.css must define .growth-stage-card.is-spotlight-return');
  assert.ok(cssGrowth.includes('--spotlight-dx'),
    'growth-stage.css must reference CSS custom property --spotlight-dx');
  assert.ok(cssGrowth.includes('--spotlight-dy'),
    'growth-stage.css must reference CSS custom property --spotlight-dy');
  assert.ok(cssGrowth.includes('--spotlight-scale'),
    'growth-stage.css must declare --spotlight-scale');
}
console.log('✓ 6: spotlight CSS classes defined');

// ============================================================
// 7. Spotlight zone CSS
// ============================================================
{
  assert.ok(cssGrowth.includes('.growth-stage-spotlight-zone'),
    'growth-stage.css must style the spotlight zone');
  const zoneRule = cssGrowth.match(/\.growth-stage-spotlight-zone\s*\{[^}]*\}/);
  assert.ok(zoneRule, 'must find .growth-stage-spotlight-zone CSS rule');
  assert.ok(zoneRule[0].includes('pointer-events: none'),
    'spotlight zone must have pointer-events: none');
}
console.log('✓ 7: spotlight zone CSS styled');

// ============================================================
// 8. JS has spotlight state machine (no artist rotation flip)
// ============================================================
{
  assert.ok(js.includes('SPOTLIGHT_ORDER'),
    'JS must define SPOTLIGHT_ORDER array');
  assert.ok(js.includes('spotlightCard'),
    'JS must have spotlightCard() function');
  assert.ok(js.includes('returnSpotlightedCard'),
    'JS must have returnSpotlightedCard() function');
  assert.ok(js.includes('clearSpotlightClasses'),
    'JS must have clearSpotlightClasses() function');
  assert.ok(js.includes('spotlightMidPhase'),
    'JS must have spotlightMidPhase() function for sub-phase dispatch');
}
console.log('✓ 8: JS spotlight state machine functions');

// ============================================================
// 9. No artist rotation functions remain
// ============================================================
{
  assert.ok(!js.includes('advanceArtist'),
    'JS must not retain advanceArtist function');
  assert.ok(!js.includes('preloadNextThumbnails'),
    'JS must not retain preloadNextThumbnails function');
  assert.ok(!js.includes('flipToNextArtist'),
    'JS must not retain flipToNextArtist function');
  assert.ok(!js.includes('flipCard'),
    'JS must not retain flipCard function');
  assert.ok(!js.includes('state.flipping'),
    'JS must not reference flipping state');
  assert.ok(!js.includes('is-flip-out'),
    'JS must not reference is-flip-out class');
}
console.log('✓ 9: artist rotation functions removed');

// ============================================================
// 10. FIXED_CARD_MAP exists (fixed card-to-artist mapping)
// ============================================================
{
  assert.ok(js.includes('FIXED_CARD_MAP'),
    'JS must define FIXED_CARD_MAP');
  // Each card maps to a specific artist+video
  assert.ok(js.includes('artistIndex: 0, videoIndex: 0'),
    'card 0 must map to BTS (artistIndex 0)');
  assert.ok(js.includes('artistIndex: 1, videoIndex: 0'),
    'card 1 must map to BLACKPINK (artistIndex 1)');
  assert.ok(js.includes('artistIndex: 2, videoIndex: 0'),
    'card 2 must map to CORTIS (artistIndex 2)');
  assert.ok(js.includes('artistIndex: 3, videoIndex: 0'),
    'card 3 must map to RESCENE (artistIndex 3)');
}
console.log('✓ 10: FIXED_CARD_MAP with correct artist mapping');

// ============================================================
// 11. Spotlight order is BTS → BLACKPINK → CORTIS → RESCENE
// ============================================================
{
  assert.ok(js.includes('SPOTLIGHT_ORDER = [0, 1, 2, 3]'),
    'SPOTLIGHT_ORDER must be [0, 1, 2, 3] (BTS→BLACKPINK→CORTIS→RESCENE)');
}
console.log('✓ 11: spotlight order matches artist order');

// ============================================================
// 12. Spotlight timing constants exist
// ============================================================
{
  const timingVars = [
    'SPOTLIGHT_MOVE_MS',
    'SPOTLIGHT_HOLD_MS',
    'SPOTLIGHT_GAP_MS',
    'SPOTLIGHT_INITIAL_HOLD',
    'SPOTLIGHT_FINAL_HOLD',
    'FADE_MS'
  ];
  for (const v of timingVars) {
    assert.ok(js.includes(v),
      `JS must define ${v}`);
  }
}
console.log('✓ 12: spotlight timing constants defined');

// ============================================================
// 13. Reduced motion: no spotlight movement
// ============================================================
{
  assert.ok(cssAnim.includes('.growth-stage-card.is-spotlight'),
    'animations.css must override .growth-stage-card.is-spotlight for reduced motion');
  assert.ok(cssAnim.includes('.growth-stage-card.is-spotlight-return'),
    'animations.css must override .growth-stage-card.is-spotlight-return for reduced motion');
  // In reduced motion, spotlight classes should be neutralized
  const reduceIdx = cssAnim.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(reduceIdx !== -1, 'must find prefers-reduced-motion block');
  // Extract the block up to the closing brace
  var brace = 0;
  var inBlock = false;
  var block = '';
  for (var i = reduceIdx; i < cssAnim.length; i++) {
    var ch = cssAnim[i];
    if (ch === '{') { brace++; inBlock = true; }
    else if (ch === '}') { brace--; }
    if (inBlock) block += ch;
    if (brace === 0 && inBlock) break;
  }
  assert.ok(block.includes('transform: none'),
    'reduced motion must nullify spotlight transform');
}
console.log('✓ 13: reduced motion overrides spotlight');

// ============================================================
// 14. is-spotlight-return z-index matches is-spotlight (#3700)
//     The returning card must stay at z-index 35 (same as spotlight)
//     throughout the 580ms return animation so no other card jumps
//     in front while the transform is still running.
// ============================================================
{
  // Find the is-spotlight-return rule body
  const returnRule = cssGrowth.match(/\.growth-stage-card\.is-spotlight-return\s*\{[^}]*\}/);
  assert.ok(returnRule, 'must find .is-spotlight-return CSS rule');
  assert.ok(returnRule[0].includes('z-index: 35'),
    '.is-spotlight-return must have z-index: 35 (same as is-spotlight) to prevent layer drop during return animation');
  assert.ok(!returnRule[0].includes('z-index: 20'),
    '.is-spotlight-return must NOT use z-index: 20 (would cause other cards to jump in front during return)');

  // Verify the is-spotlight rule still has z-index 35
  const spotlightRule = cssGrowth.match(/\.growth-stage-card\.is-spotlight\s*\{[^}]*\}/);
  assert.ok(spotlightRule, 'must find .is-spotlight CSS rule');
  assert.ok(spotlightRule[0].includes('z-index: 35'),
    '.is-spotlight must have z-index: 35');

  // Verify clearSpotlightClasses removes both spotlight classes (base z-index applies)
  assert.ok(js.includes("card.classList.remove('is-spotlight', 'is-spotlight-return')"),
    'clearSpotlightClasses must remove both is-spotlight and is-spotlight-return');

  // Verify base featured card z-index is 24 (restored after return class removed)
  const featuredRule = cssGrowth.match(/\.growth-stage-card\.featured\s*\{[^}]*\}/g);
  const featuredHas24 = featuredRule && featuredRule.some(r => r.includes('z-index: 24'));
  assert.ok(featuredHas24,
    'base .growth-stage-card.featured must have z-index: 24 (restored after return)');

  // Verify base .growth-stage-card has z-index: 20 (supporting cards inherit this)
  const baseCardRule = cssGrowth.match(/\.growth-stage-card\s*\{[^}]*\}/);
  assert.ok(baseCardRule, 'must find base .growth-stage-card rule');
  assert.ok(baseCardRule[0].includes('z-index: 20'),
    'base .growth-stage-card must have z-index: 20');
}
console.log('✓ 14: is-spotlight-return z-index=35, base z-indexes correct');

// ============================================================
// 15. FADE phase exists (cycle can fade and restart)
// ============================================================
{
  assert.ok(js.includes("PHASE.FADE") || js.includes("'fade-out'"),
    'JS must define a FADE phase for cycle restart');
  assert.ok(js.includes("'fade-out'"),
    'JS must use fade-out stage state');
  assert.ok(cssGrowth.includes('fade-out'),
    'growth-stage.css must reference fade-out stage state');
}
console.log('✓ 15: FADE phase exists for cycle restart');

// ============================================================
// 16. RESPECT: Keep #3624 references but no Closes/Fixes
// ============================================================
{
  const forbiddenCloses = ['Closes', 'Fixes', 'Resolves'];
  for (const f of forbiddenCloses) {
    assert.ok(!html.includes(f + ' #3624'),
      `index.html must not contain '${f} #3624'`);
    assert.ok(!html.includes(f + ' #3625'),
      `index.html must not contain '${f} #3625'`);
  }
}
console.log('✓ 16: no Closes/Fixes/Resolves for protected issues');

// ============================================================
// 17. Reveal stagger delay scoped to cards-revealing only (#3700)
//     The supporting-card transition-delay (0.18s/0.34s/0.5s) must apply
//     ONLY during the initial cards-revealing stage. If it leaks into
//     completed/fade-out, the spotlight return transform (0.55s) is still
//     running when JS removes is-spotlight-return at ~580ms, causing a
//     position snap. Block-level parse: each delay value may appear only
//     inside a rule whose selector list includes cards-revealing.
// ============================================================
{
  // Parse CSS into {selectorList, body} blocks (comments already stripped).
  function parseBlocks(css) {
    const blocks = [];
    let depth = 0;
    let start = 0;
    let selectorStart = 0;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') {
        if (depth === 0) selectorStart = start;
        depth++;
        if (depth === 1) {
          blocks.push({ selector: css.slice(selectorStart, i).trim(), bodyStart: i + 1 });
        }
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && blocks.length) {
          blocks[blocks.length - 1].body = css.slice(blocks[blocks.length - 1].bodyStart, i);
          start = i + 1;
        }
      } else if (depth === 0 && ch !== ' ' && ch !== '\n' && ch !== '\t') {
        if (start === selectorStart || css.slice(start, i).trim() === '') start = i;
      }
    }
    return blocks.filter(b => b.body !== undefined);
  }

  const blocks = parseBlocks(cssGrowthRules);
  assert.ok(blocks.length > 0, 'must parse growth-stage.css into rule blocks');

  const delaySpecs = [
    { card: 'one', delay: '0.18s' },
    { card: 'two', delay: '0.34s' },
    { card: 'three', delay: '0.5s' }
  ];

  for (const spec of delaySpecs) {
    const cardSel = `.growth-stage-card.supporting.${spec.card}`;
    const delayRe = new RegExp(`transition-delay\\s*:\\s*${spec.delay.replace('.', '\\.')}`);
    const matching = blocks.filter(b => b.selector.includes(cardSel) && delayRe.test(b.body));

    assert.ok(matching.length >= 1,
      `supporting.${spec.card} must declare transition-delay: ${spec.delay} somewhere`);

    for (const b of matching) {
      assert.ok(b.selector.includes('cards-revealing'),
        `supporting.${spec.card} transition-delay ${spec.delay} must be scoped to a cards-revealing selector; found in: ${b.selector.slice(0, 120)}`);
      assert.ok(!b.selector.includes('"completed"'),
        `supporting.${spec.card} delay rule must not target the completed state`);
      assert.ok(!b.selector.includes('"fade-out"'),
        `supporting.${spec.card} delay rule must not target the fade-out state`);
    }
  }

  // No supporting-card transition-delay may appear in any completed/fade-out block.
  const leakBlocks = blocks.filter(b =>
    (b.selector.includes('"completed"') || b.selector.includes('"fade-out"')) &&
    b.selector.includes('.growth-stage-card.supporting') &&
    /transition-delay/.test(b.body)
  );
  assert.strictEqual(leakBlocks.length, 0,
    `completed/fade-out blocks must not set a supporting-card transition-delay; leaked in: ${leakBlocks.map(b => b.selector.slice(0, 100)).join(' | ')}`);

  // Common three-state reveal rules keep opacity/transform/pointer-events but no delay.
  for (const spec of delaySpecs) {
    const cardSel = `.growth-stage-card.supporting.${spec.card}`;
    const common = blocks.find(b =>
      b.selector.includes(cardSel) &&
      b.selector.includes('cards-revealing') &&
      b.selector.includes('"completed"') &&
      b.selector.includes('"fade-out"')
    );
    assert.ok(common,
      `must keep a combined cards-revealing/completed/fade-out rule for supporting.${spec.card}`);
    assert.ok(common.body.includes('opacity: 1'),
      `combined rule for supporting.${spec.card} must keep opacity: 1`);
    assert.ok(common.body.includes('transform: translateY(0) scale(1)'),
      `combined rule for supporting.${spec.card} must keep transform: translateY(0) scale(1)`);
    assert.ok(common.body.includes('pointer-events: auto'),
      `combined rule for supporting.${spec.card} must keep pointer-events: auto`);
    assert.ok(!/transition-delay/.test(common.body),
      `combined rule for supporting.${spec.card} must NOT set transition-delay`);
  }
}
console.log('✓ 17: reveal stagger delay scoped to cards-revealing only');

// ============================================================
// 18. Spotlight transform timing unchanged by delay fix (#3700)
//     The delay-scoping fix must not alter the 0.55s spotlight transform
//     duration, the 580ms JS move constant, or the return z-index.
// ============================================================
{
  const spotlightRule = cssGrowth.match(/\.growth-stage-card\.is-spotlight\s*\{[^}]*\}/);
  assert.ok(spotlightRule, 'must find .is-spotlight rule');
  assert.ok(spotlightRule[0].includes('transform 0.55s'),
    '.is-spotlight must keep transform duration 0.55s');

  const returnRule = cssGrowth.match(/\.growth-stage-card\.is-spotlight-return\s*\{[^}]*\}/);
  assert.ok(returnRule, 'must find .is-spotlight-return rule');
  assert.ok(returnRule[0].includes('transform 0.55s'),
    '.is-spotlight-return must keep transform duration 0.55s');
  assert.ok(returnRule[0].includes('z-index: 35'),
    '.is-spotlight-return must keep z-index: 35');

  assert.ok(js.includes('SPOTLIGHT_MOVE_MS = 580'),
    'SPOTLIGHT_MOVE_MS must remain 580 (JS timing unchanged by CSS delay fix)');
}
console.log('✓ 18: spotlight transform timing and return z-index unchanged');

console.log('\n✅ All #3625 contract tests passed.');
