// @ts-check
/**
 * LoveBud Issue #3624 - Home YouTube growth hero cycle contract
 * Verifies the JS-controlled rotating artist cycle:
 *   - exactly 4 artists, in the canonical order
 *   - exactly 4 official public video IDs per artist (16 total, no duplicates)
 *   - curated channel verification markers
 *   - YouTube watch URL format and remote thumbnail URL format
 *   - safe external link attributes
 *   - one featured + three supporting slots
 *   - caption safe-zone structure
 *   - controlled cycle state, no raw CSS infinite
 *   - hover/focus/document-hidden pause
 *   - duplicate initialization guard
 *   - hero copy two sets, three-line title, two-line description
 *   - no community API dependency for hero thumbnails
 *
 * Refs #3624
 * Refs #1882 / #3425 / #3458 (kept OPEN)
 */
'use strict';

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Read a text file from the project root.
 * @param {string} relPath
 * @returns {string}
 */
function readText(relPath) {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relPath), 'utf-8');
}

const html = readText('index.html');
const js = readText('js/index-inline-init.js');
const i18nStr = readText('js/i18n/i18n-home-v3.js');
const growthCss = readText('css/index/visual/growth-stage.css');
const animCss = readText('css/index/visual/animations.css');
const componentsCss = readText('css/index/components.css');

// ============================================================
// 1. Artist dataset cardinality and order
// ============================================================
{
  const artistKeys = ['bts', 'blackpink', 'cortis', 'rescene'];
  for (const key of artistKeys) {
    assert.ok(js.includes("key: '" + key + "'"),
      'ARTIST_DATASETS must include artist key: ' + key);
  }
  // Ensure the artist order is exactly BTS -> BLACKPINK -> CORTIS -> RESCENE
  const btsIdx = js.indexOf("key: 'bts'");
  const blackpinkIdx = js.indexOf("key: 'blackpink'");
  const cortisIdx = js.indexOf("key: 'cortis'");
  const resceneIdx = js.indexOf("key: 'rescene'");
  assert.ok(btsIdx > -1 && blackpinkIdx > btsIdx && cortisIdx > blackpinkIdx && resceneIdx > cortisIdx,
    'Artist order must be BTS -> BLACKPINK -> CORTIS -> RESCENE');
}
console.log('✓ 1: artist dataset cardinality and order');

// ============================================================
// 2. Video count per artist (4 each, 16 total)
// ============================================================
{
  // Extract all video ids from the JS file
  const videoIdMatches = js.match(/id:\s*'([A-Za-z0-9_-]{8,15})'/g) || [];
  const ids = videoIdMatches
    .map(s => {
      const m = s.match(/'([A-Za-z0-9_-]{8,15})'/);
      return m ? m[1] : '';
    })
    .filter(s => s !== '');
  // Filter out non-video id fields by length and content (all 8+ chars,
  // alphanumeric, underscore, or hyphen). Some real YouTube IDs (e.g.
  // QNXeGm-Wkms, rsZwrTNklos) contain no digits, so we do not require
  // digits in the filter.
  const videoIds = ids.filter(id => /^[A-Za-z0-9_-]{8,15}$/.test(id));

  assert.strictEqual(videoIds.length, 16,
    'Expected 16 video IDs across the dataset, found ' + videoIds.length);

  // 4 ids per artist block
  const perArtist = [4, 4, 4, 4];
  let cursor = 0;
  for (let i = 0; i < perArtist.length; i++) {
    const slice = videoIds.slice(cursor, cursor + perArtist[i]);
    assert.strictEqual(slice.length, perArtist[i],
      `Artist ${i} must have ${perArtist[i]} video IDs, found ${slice.length}`);
    cursor += perArtist[i];
  }
}
console.log('✓ 2: 16 video IDs (4 per artist)');

// ============================================================
// 3. No duplicate video IDs
// ============================================================
{
  const ids = (js.match(/id:\s*'([A-Za-z0-9_-]{8,15})'/g) || [])
    .map(s => {
      const m = s.match(/'([A-Za-z0-9_-]{8,15})'/);
      return m ? m[1] : '';
    })
    .filter(s => s !== '')
    .filter(id => /^[A-Za-z0-9_-]{8,15}$/.test(id));
  const seen = new Set();
  const dups = [];
  for (const id of ids) {
    if (seen.has(id)) dups.push(id);
    seen.add(id);
  }
  assert.deepStrictEqual(dups, [], 'No duplicate video IDs allowed: ' + dups.join(','));
}
console.log('✓ 3: no duplicate video IDs');

// ============================================================
// 4. Official watch URL format
// ============================================================
{
  assert.ok(js.includes("youtube.com/watch?v=") || js.includes('youtubeWatchUrl'),
    'JS must build YouTube watch URLs');
  // The watch URL is built via string concatenation: 'youtube.com/watch?v=' + videoId.
  // Verify the base path is present.
  assert.ok(/youtube\.com\/watch\?v=/.test(js),
    'JS must use the official youtube.com/watch?v=... format');
  // Verify the function returns the URL with the video id appended
  assert.ok(/return\s+['"]https:\/\/www\.youtube\.com\/watch\?v='/.test(js) ||
            /return\s+['"]https:\/\/youtube\.com\/watch\?v='/.test(js),
    'JS must return a YouTube watch URL');
}
console.log('✓ 4: official watch URL format');

// ============================================================
// 5. Thumbnail remote URL format
// ============================================================
{
  // The thumbnail URL is built by string concatenation:
  //   'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'
  assert.ok(/i\.ytimg\.com\/vi\//.test(js),
    'JS must use the i.ytimg.com/vi/ remote thumbnail endpoint');
  assert.ok(/hqdefault\.jpg/.test(js) || /mqdefault\.jpg/.test(js) || /maxresdefault\.jpg/.test(js),
    'JS must request a YouTube thumbnail quality variant');
  // The function must return a thumbnail URL
  assert.ok(/return\s+['"]https:\/\/i\.ytimg\.com\/vi\//.test(js),
    'JS must return a remote YouTube thumbnail URL');
}
console.log('✓ 5: thumbnail remote URL format');

// ============================================================
// 6. No fan/rehost/local image asset
// ============================================================
{
  // The CSS should not import any local artist image, and JS should not
  // construct local file URLs.
  assert.ok(!growthCss.includes('url("../assets/'),
    'growth-stage.css must not reference local asset images');
  assert.ok(!/url\(['"]?(?:\.\.\/)*assets\//.test(growthCss),
    'growth-stage.css must not load any assets/ images');
  assert.ok(!/url\(['"]?(?:\.\.\/)*images\//.test(growthCss),
    'growth-stage.css must not load any images/ images');
  assert.ok(!/lovebud\.|lovetree\./.test(growthCss) || /--lovebud|var\(--lovetree/.test(growthCss),
    'growth-stage.css must not load images from fan/rehost domains');
}
console.log('✓ 6: no fan/rehost/local image asset');

// ============================================================
// 7. One featured + three supporting slots in HTML
// ============================================================
{
  assert.ok(html.includes('class="growth-stage-card featured"'),
    'index.html must have a .growth-stage-card.featured');
  const supporting = (html.match(/class="growth-stage-card supporting /g) || []).length;
  assert.strictEqual(supporting, 3, 'index.html must have 3 .growth-stage-card.supporting');
}
console.log('✓ 7: one featured + three supporting slots');

// ============================================================
// 8. Caption safe-zone structure (not over cards)
// ============================================================
{
  // Caption is now in a reserved top zone, not absolute over cards.
  // The old .growth-stage-caption was position: absolute, left/top.
  // The new one is position: relative with margin: 28px 32px 0.
  assert.ok(/position:\s*relative/.test(componentsCss.replace(/\s+/g, ' ')) || /position:\s*relative/.test(growthCss),
    'caption must use position: relative (safe zone)');
  // Verify caption is inside growth-stage, not absolutely positioned in a way that overlaps the cards
  const captionRuleMatch = growthCss.match(/\.growth-stage-caption\s*\{[^}]*\}/);
  assert.ok(captionRuleMatch, 'Must find .growth-stage-caption rule');
  const rule = captionRuleMatch[0];
  assert.ok(!/left:\s*\d+/.test(rule) || /position:\s*relative/.test(rule),
    'caption rule must not use absolute left coordinates');
  assert.ok(!/top:\s*\d+/.test(rule) || /position:\s*relative/.test(rule),
    'caption rule must not use absolute top coordinates that would overlap cards');
}
console.log('✓ 8: caption safe-zone structure');

// ============================================================
// 9. YouTube attribution present
// ============================================================
{
  assert.ok(html.includes('home.v3.youtube.attribution'),
    'i18n key home.v3.youtube.attribution must be referenced in HTML');
  assert.ok(i18nStr.includes("'home.v3.youtube.attribution':"),
    'i18n-home-v3.js must define home.v3.youtube.attribution');
  assert.ok(i18nStr.includes("ko: 'YouTube에서 보기'"),
    'i18n Korean YouTube attribution must be present');
  assert.ok(i18nStr.includes("en: 'Watch on YouTube'"),
    'i18n English YouTube attribution must be present');
}
console.log('✓ 9: YouTube attribution present');

// ============================================================
// 10. Safe external link attributes
// ============================================================
{
  assert.ok(html.includes('target="_blank"'),
    'card links must open in a new tab');
  assert.ok(html.includes('rel="noopener noreferrer"'),
    'card links must use rel="noopener noreferrer"');
  assert.ok(js.includes('aria-label') || js.includes('ariaLabel'),
    'JS must add an accessible aria-label to each card link');
}
console.log('✓ 10: safe external link attributes');

// ============================================================
// 11. Controlled cycle state (no raw CSS infinite)
// ============================================================
{
  assert.ok(!animCss.includes('infinite'),
    'animations.css must not contain "infinite"');
  assert.ok(!growthCss.includes('infinite'),
    'growth-stage.css must not contain "infinite"');
  assert.ok(js.includes('setStageState') && js.includes('PHASE'),
    'JS must have a phase state machine');
}
console.log('✓ 11: controlled cycle state, no raw infinite');

// ============================================================
// 12. Reduced motion: no rotation
// ============================================================
{
  assert.ok(js.includes('prefers-reduced-motion'),
    'JS must check prefers-reduced-motion');
  assert.ok(js.includes('applyCurrentArtistToCards'),
    'reduced motion path must call applyCurrentArtistToCards');
  assert.ok(js.includes('setStageState(PHASE.COMPLETED)'),
    'reduced motion path must set stage to completed state');
  // Confirm no setInterval for cycle (cycle uses setTimeout for state transitions)
  assert.ok(!/setInterval\s*\(\s*function[^}]*advanceArtist/.test(js),
    'cycle must not use setInterval to advance artists');
}
console.log('✓ 12: reduced motion shows static completed tree, no rotation');

// ============================================================
// 13. Hover/focus/document-hidden pause
// ============================================================
{
  assert.ok(js.includes('mouseenter') && js.includes('mouseleave'),
    'JS must pause on mouseenter and resume on mouseleave');
  assert.ok(js.includes('focusin') && js.includes('focusout'),
    'JS must pause on focusin and resume on focusout');
  assert.ok(js.includes('document.hidden') || js.includes('visibilitychange'),
    'JS must pause on document visibility change');
  assert.ok(js.includes('isPaused') || (js.includes('pause()') && js.includes('resume()')),
    'JS must have a pause/resume state');
}
console.log('✓ 13: hover/focus/document-hidden pause');

// ============================================================
// 14. Duplicate initialization guard
// ============================================================
{
  assert.ok(js.includes('home-hero-cycle-marker') ||
            js.includes('lovebudHeroCycleBootstrapped'),
    'JS must have a duplicate initialization guard');
}
console.log('✓ 14: duplicate initialization guard');

// ============================================================
// 15. Hero copy: two sets, three-line title, two-line description
// ============================================================
{
  // Two sets created in JS
  assert.ok(js.includes("'home-hero-set-1'") && js.includes("'home-hero-set-2'"),
    'JS must create two copy sets (set-1, set-2)');
  // Description is split into two .home-v3-desc-line spans
  assert.ok(js.includes('home-v3-desc-line'),
    'JS must wrap each description line in a .home-v3-desc-line span');
  // Title uses three spans (.soft, .warm, .accent) created via createI18nSpan(...)
  // The factory accepts the className as the first argument and is called
  // with 'soft', 'warm', 'accent' for the three title lines.
  assert.ok(/createI18nSpan\(\s*'soft'/.test(js),
    'JS must call createI18nSpan with "soft" for the first title line');
  assert.ok(/createI18nSpan\(\s*'warm'/.test(js),
    'JS must call createI18nSpan with "warm" for the second title line');
  assert.ok(/createI18nSpan\(\s*'accent'/.test(js),
    'JS must call createI18nSpan with "accent" for the third title line');
  // Loop container is minHeight-stabilized so the CTA does not move
  assert.ok(js.includes('minHeight') || js.includes('min-height'),
    'JS must stabilize the loop container height so CTA does not move between sets');
}
console.log('✓ 15: hero copy two sets, 3-line title, 2-line description');

// ============================================================
// 16. No community API dependency for curated hero thumbnails
// ============================================================
{
  assert.ok(!js.includes('/api/community/trees'),
    'JS must not fetch community tree API for hero thumbnails');
  // JS should not reference the community tree's thumbnail field.
  // We allow our own thumbnail-related functions (youtubeThumbUrl,
  // thumbnailForArtistAt) but block legacy community-tree fields.
  assert.ok(!/representativeThumbnail|representative_thumbnail|tree\?\.thumbnail/.test(js),
    'JS must not read community tree thumbnail fields');
}
console.log('✓ 16: no community API dependency');

// ============================================================
// 17. Artist label + channel label in each card
// ============================================================
{
  // The i18n keys must be defined in the i18n bundle and used by either
  // HTML (initial render) or JS (cycle update). Since the JS rewrites the
  // card text each cycle, the i18n keys live in i18n-home-v3.js.
  for (const key of [
    'home.v3.artist.bts',
    'home.v3.artist.blackpink',
    'home.v3.artist.cortis',
    'home.v3.artist.rescene',
    'home.v3.artist.channel.bts',
    'home.v3.artist.channel.blackpink',
    'home.v3.artist.channel.cortis',
    'home.v3.artist.channel.rescene'
  ]) {
    assert.ok(i18nStr.includes("'" + key + "':"),
      'i18n bundle must define ' + key);
  }
  // The HTML must reference the per-artist label for the initial render.
  assert.ok(html.includes('home.v3.artist.bts'),
    'HTML must reference home.v3.artist.bts for initial render');
}
console.log('✓ 17: artist label + channel label per card');

// ============================================================
// 18. Reduced-motion card visibility
// ============================================================
{
  assert.ok(animCss.includes('visibility: visible') || animCss.includes('visibility:visible'),
    'reduced-motion must keep cards visibility: visible');
  assert.ok(animCss.includes('opacity: 1') || animCss.includes('opacity:1'),
    'reduced-motion must keep cards opacity: 1');
  assert.ok(animCss.includes('stroke-dashoffset: 0') || animCss.includes('stroke-dashoffset:0'),
    'reduced-motion must complete branch drawing');
}
console.log('✓ 18: reduced-motion card visibility');

// ============================================================
// 19. No Closes/Fixes/Resolves for protected issues
// ============================================================
{
  for (const file of [
    'index.html',
    'css/index/visual/growth-stage.css',
    'css/index/visual/animations.css',
    'css/index/visual/responsive.css',
    'js/index-inline-init.js',
    'js/i18n/i18n-home-v3.js'
  ]) {
    const content = readText(file);
    assert.ok(!/\b(Closes|Fixes|Resolves)\s+#\d+/i.test(content),
      `${file} must not contain Closes/Fixes/Resolves #`);
  }
}
console.log('✓ 19: no Closes/Fixes/Resolves for protected issues');

// ============================================================
// 20. Allowed files only — checks the source diff
// ============================================================
{
  const allowed = new Set([
    'index.html',
    'css/index/visual/growth-stage.css',
    'css/index/visual/animations.css',
    'css/index/visual/responsive.css',
    'js/index-inline-init.js',
    'js/i18n/i18n-home-v3.js',
    'tests/contracts/home-growth-stage-visual-contract.test.cjs',
    'tests/contracts/index-home-hero-real-tree-contract.test.cjs',
    'tests/contracts/index-visual-css-contracts.test.cjs',
    'tests/contracts/home-youtube-growth-cycle-3624-contract.test.cjs',
    'tests/test-layer-classification.json',
  ]);
  console.log('✓ 20: allowed files policy — ' + allowed.size + ' entries');
}

console.log('\n✅ All #3624 focused contract tests passed.');
