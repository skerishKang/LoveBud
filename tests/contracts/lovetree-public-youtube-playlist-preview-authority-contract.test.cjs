/**
 * Contract test for the LoveTree Public YouTube Playlist Preview Authority (Issue #3906).
 *
 * Docs-structure contract only. No runtime execution, no network, no DB,
 * no browser, no Production. Proves the authority document's required
 * sections, route decision, write-zero guarantee, SSRF controls,
 * pagination ceiling, unavailable-item policy, privacy/logging rules,
 * tutorial integration, negative controls, and verdict markers remain
 * explicit and cannot be silently weakened.
 *
 * Refs: #3906, #3897, #3903, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs/product/LOVETREE_PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY.md'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Authority document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

function assertContains(haystack, needle, label) {
  assert.ok(
    haystack.indexOf(needle) !== -1,
    `Authority document must contain: ${label || needle}`
  );
}

function assertNotContains(haystack, needle, label) {
  assert.ok(
    haystack.indexOf(needle) === -1,
    `Authority document must NOT contain: ${label || needle}`
  );
}

function assertSection(doc, heading) {
  assert.ok(
    doc.indexOf(heading) !== -1,
    `Required section missing: ${heading}`
  );
}

test('authority document exists and is non-empty', () => {
  const doc = readDoc();
  assert.ok(doc.length > 1000, 'Authority document must be substantial');
});

test('all 24 required sections are present', () => {
  const doc = readDoc();
  const sections = [
    '## 1. Purpose / scope',
    '## 2. Current-main authority map',
    '## 3. Existing reusable contracts',
    '## 4. Confirmed gaps',
    '## 5. Official YouTube provider constraints',
    '## 6. Accepted source forms and normalization',
    '## 7. Proposed same-origin route',
    '## 8. Authentication decision',
    '## 9. Request contract',
    '## 10. Ordered preview response contract',
    '## 11. Unavailable/private/deleted item policy',
    '## 12. Thumbnail-unavailable policy',
    '## 13. Pagination / ceiling / timeout policy',
    '## 14. Partial-result policy',
    '## 15. Error vocabulary',
    '## 16. Provider adapter boundary',
    '## 17. SSRF / arbitrary-fetch controls',
    '## 18. Privacy / logging / observability',
    '## 19. Quota and configuration boundary',
    '## 20. Beginner tutorial / UI integration',
    '## 21. Future implementation file boundary',
    '## 22. Negative controls',
    '## 23. Stop conditions',
    '## 24. Implementation verdict'
  ];
  for (const s of sections) {
    assertSection(doc, s);
  }
});

test('route decision is explicit', () => {
  const doc = readDoc();
  assertContains(doc, '/api/import/youtube/playlist/preview', 'proposed route path');
  assertContains(doc, 'POST', 'route method');
  assertContains(doc, 'AUTH_REQUIRED', 'auth decision');
});

test('route authority uses thin same-origin proxy, not a non-proxy claim', () => {
  const doc = readDoc();
  // Canonical architecture: Cloudflare thin proxy → Modal private endpoint owns normalization.
  assertContains(doc, 'thin proxy', 'cloudflare acts as a thin same-origin proxy');
  assertContains(doc, 'Modal private preview endpoint', 'modal endpoint owner');
  assertContains(doc, 'Error normalization owner', 'modal owns error normalization');
  assertContains(doc, 'thin same-origin proxy', 'thin same-origin proxy wording');
  // Reject stale non-proxy architecture wording (contradicts canonical §7–8).
  assertNotContains(doc, 'not a Modal proxy', 'stale non-proxy architecture wording');
});

test('verified Firebase auth is required, not header-presence-only', () => {
  const doc = readDoc();
  assertContains(doc, 'require_firebase_user', 'verified firebase auth boundary');
  assertContains(doc, 'verified Firebase principal', 'verified principal');
  assertContains(doc, 'header presence alone is NOT sufficient', 'header presence rejected');
  assertContains(doc, 'provider call must NEVER occur before', 'provider call ordering');
  assertContains(doc, 'modal_compute/auth.py', 'modal auth module reference');
  assertContains(doc, 'Modal private preview endpoint', 'modal endpoint');
  assertContains(doc, 'Cloudflare Pages Function', 'cloudflare proxy role');
});

test('write-zero guarantee is explicit', () => {
  const doc = readDoc();
  assertContains(doc, 'Tree write: **0**', 'tree write zero');
  assertContains(doc, 'Moment write: **0**', 'moment write zero');
  assertContains(doc, 'No persistence of any kind', 'no persistence');
});

test('semantic Connection auto-creation is forbidden', () => {
  const doc = readDoc();
  assertContains(doc, 'must NOT create semantic LoveTree Connections', 'no auto connections');
  assertContains(doc, 'No `parentId`', 'no parentId in response');
  assertContains(doc, '`connectionId`', 'no connectionId in response');
});

test('host allowlist and arbitrary-fetch prohibition', () => {
  const doc = readDoc();
  assertContains(doc, 'youtube.com', 'accepted host');
  assertContains(doc, 'No `fetch(userSuppliedUrl)`', 'no user URL fetch');
  assertContains(doc, 'www.googleapis.com', 'fixed API endpoint');
  assertContains(doc, 'arbitrary hostname', 'arbitrary hostname rejection');
  assertContains(doc, 'localhost', 'localhost rejection');
  assertContains(doc, 'file:', 'file scheme rejection');
  assertContains(doc, 'ftp:', 'ftp scheme rejection');
});

test('pagination ceiling exists', () => {
  const doc = readDoc();
  assertContains(doc, 'LoveBud preview item ceiling', 'item ceiling');
  assertContains(doc, 'Maximum page count', 'max page count');
  assertContains(doc, 'truncated', 'truncation flag');
});

test('item state model uses corrected vocabulary', () => {
  const doc = readDoc();
  assertContains(doc, 'AVAILABLE_METADATA', 'available metadata state');
  assertContains(doc, 'PRIVATE_OR_UNAVAILABLE', 'private or unavailable state');
  assertContains(doc, 'METADATA_PARTIAL', 'metadata partial state');
  assertContains(doc, 'THUMBNAIL_UNAVAILABLE', 'thumbnail unavailable state');
  assertContains(doc, 'BOUNDED_PARTIAL_WITH_EXPLICIT_STATE', 'partial result policy');
  assertContains(doc, 'never silently dropped', 'no silent drop');
});

test('stale item-state enum values do not appear as response state', () => {
  const doc = readDoc();
  // Remove NC16 line from the check — NC16 itself mentions the stale values to prohibit them
  const nc16Idx = doc.indexOf('| NC16 |');
  const docWithoutNC16 = nc16Idx >= 0
    ? doc.slice(0, nc16Idx) + doc.slice(doc.indexOf('\n', nc16Idx))
    : doc;
  // Also remove NC17 line to avoid false positive on "deleted/private/region"
  const nc17Idx = docWithoutNC16.indexOf('| NC17 |');
  const docClean = nc17Idx >= 0
    ? docWithoutNC16.slice(0, nc17Idx) + docWithoutNC16.slice(docWithoutNC16.indexOf('\n', nc17Idx))
    : docWithoutNC16;

  assert.doesNotMatch(
    docClean,
    /"state"\s*:\s*"AVAILABLE"/,
    'Response state must not use stale enum "AVAILABLE" (outside NC16 prohibition rule)'
  );
  assert.doesNotMatch(
    docClean,
    /"state"\s*:\s*"UNAVAILABLE"/,
    'Response state must not use stale enum "UNAVAILABLE" (outside NC16 prohibition rule)'
  );
});

test('success response example uses AVAILABLE_METADATA', () => {
  const doc = readDoc();
  assertContains(doc, '"state": "AVAILABLE_METADATA"', 'success example uses canonical state');
});

test('partial-result matrix uses PRIVATE_OR_UNAVAILABLE', () => {
  const doc = readDoc();
  assertContains(doc, 'state: "PRIVATE_OR_UNAVAILABLE"', 'partial result uses canonical state');
});

test('NC7 uses PRIVATE_OR_UNAVAILABLE', () => {
  const doc = readDoc();
  const nc7Line = doc.match(/\| NC7 \|.*\n/);
  assert.ok(nc7Line, 'NC7 must exist');
  assert.ok(
    nc7Line[0].indexOf('PRIVATE_OR_UNAVAILABLE') !== -1,
    'NC7 must use PRIVATE_OR_UNAVAILABLE, not stale UNAVAILABLE'
  );
});

test('thumbnail-null rule uses only canonical enum names', () => {
  const doc = readDoc();
  assertContains(doc, 'METADATA_PARTIAL` or `PRIVATE_OR_UNAVAILABLE', 'thumbnail-null uses canonical states');
});

test('privacyStatus does not claim embeddability', () => {
  const doc = readDoc();
  assertContains(doc, 'does NOT prove', 'privacyStatus limitation');
  assertContains(doc, 'embeddability', 'embeddability not inferred');
  assertContains(doc, 'region availability', 'region availability not inferred');
});

test('deprecated startAt/endAt are excluded', () => {
  const doc = readDoc();
  assertContains(doc, 'Deprecated', 'deprecated fields marked');
  assertContains(doc, 'startAt', 'startAt mentioned as deprecated');
  assertContains(doc, 'endAt', 'endAt mentioned as deprecated');
  assertContains(doc, 'NOT use these as interval', 'deprecated fields not used as authority');
});

test('thumbnail unavailable policy exists', () => {
  const doc = readDoc();
  assertContains(doc, 'thumbnailUrl', 'thumbnail URL field');
  assertContains(doc, 'deterministic LoveBud placeholder', 'placeholder fallback');
  assertContains(doc, 'multi-host retry', 'no multi-host retry');
});

test('Production 404 evidence does not fabricate underlying video availability cause', () => {
  const doc = readDoc();
  // The #3912 evidence section must state that the underlying cause was NOT established
  assertContains(doc, 'underlying video-availability cause was not established', 'evidence boundedness');
  // Must NOT claim the 404s occur because videos are deleted/private/region-blocked
  assertNotContains(doc, 'occur because the videos are deleted/private/region-blocked', 'fabricated root cause');
});

test('quota policy exists with corrected wording', () => {
  const doc = readDoc();
  assertContains(doc, 'Quota cost', 'quota cost');
  assertContains(doc, '10,000 units', 'default daily quota');
  assertContains(doc, '2 units', 'per-preview cost');
  assertContains(doc, 'theoretical upper bound', 'theoretical maximum wording');
  assertContains(doc, 'sole consumer', 'shared quota bucket caveat');
});

test('enforceable abuse controls are defined', () => {
  const doc = readDoc();
  assertContains(doc, 'Verified authenticated user required', 'verified auth control');
  assertContains(doc, 'Per-request maximum provider calls', 'max provider calls');
  assertContains(doc, 'No automatic retry loop', 'no retry');
  assertContains(doc, 'No page 2', 'no page 2');
  assertContains(doc, 'Provider timeout bounded', 'timeout bounded');
  assertContains(doc, 'Quota exhaustion fail closed', 'quota fail closed');
  assertContains(doc, 'Provider call before auth', 'provider call before auth forbidden');
});

test('rate-limit dependency is assessed', () => {
  const doc = readDoc();
  assertContains(doc, 'rate-limit', 'rate limit assessment');
  assertContains(doc, 'not a blocker', 'rate limit not a blocker');
  assertContains(doc, 'social_rate_limit', 'existing rate limit reference');
});

test('privacy and logging prohibitions exist', () => {
  const doc = readDoc();
  assertContains(doc, 'Firebase token', 'firebase token logging prohibition');
  assertContains(doc, 'YouTube API key', 'api key logging prohibition');
  assertContains(doc, 'playlist title', 'playlist title logging prohibition');
  assertContains(doc, 'video title', 'video title logging prohibition');
  assertContains(doc, 'raw source URL', 'raw URL logging prohibition');
  assertContains(doc, 'raw provider response', 'raw response logging prohibition');
  assertContains(doc, 'provider=youtube', 'sanitized telemetry');
  assertContains(doc, 'item_count_bucket', 'bucket telemetry');
});

test('provider secret is Modal-side, not Cloudflare env', () => {
  const doc = readDoc();
  assertContains(doc, 'Modal secret', 'modal secret');
  assertContains(doc, 'never in browser bundle', 'browser bundle prohibition');
  assertContains(doc, 'modal.Secret.from_name', 'modal secret pattern');
  assertContains(doc, 'CONFIGURATION_REQUIRED', 'configuration status');
  assertNotContains(doc, 'Cloudflare Pages environment variable', 'cloudflare env must not be used for key');
});

test('request conflict rule rejects ambiguous input', () => {
  const doc = readDoc();
  assertContains(doc, 'Both `source` and `playlistId` provided', 'conflict rule');
  assertContains(doc, 'INVALID_PLAYLIST_SOURCE', 'conflict rejection');
  assertContains(doc, 'ambiguous input rejected', 'ambiguous rejection');
});

test('tutorial integration is referenced', () => {
  const doc = readDoc();
  assertContains(doc, '#3903', 'tutorial issue reference');
  assertContains(doc, 'YouTube 재생목록 가져오기', 'tutorial route name');
  assertContains(doc, 'read-only', 'read-only preview');
});

test('negative controls are present', () => {
  const doc = readDoc();
  const ncs = ['NC1', 'NC2', 'NC3', 'NC4', 'NC5', 'NC6', 'NC7', 'NC8', 'NC9', 'NC10', 'NC11', 'NC12', 'NC13', 'NC14', 'NC15', 'NC16', 'NC17'];
  for (const nc of ncs) {
    assertContains(doc, nc, `negative control ${nc}`);
  }
  assertContains(doc, 'Tree write 0', 'NC10 tree write zero');
  assertContains(doc, 'Moment write 0', 'NC11 moment write zero');
});

test('NC16 prohibits stale item-state enum', () => {
  const doc = readDoc();
  assertContains(doc, 'NC16', 'NC16 exists');
  assertContains(doc, 'Stale item-state enum prohibited', 'NC16 stale enum prohibition');
});

test('NC17 bounds Production 404 evidence', () => {
  const doc = readDoc();
  assertContains(doc, 'NC17', 'NC17 exists');
  assertContains(doc, 'does not fabricate underlying video availability cause', 'NC17 evidence bounding');
});

test('verdict markers are present', () => {
  const doc = readDoc();
  assertContains(doc, 'PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_IMPLEMENTATION_READY', 'implementation ready verdict');
  assertContains(doc, 'PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY_AUDIT_COMPLETE', 'audit complete marker');
});

test('keep-open references are correct', () => {
  const doc = readDoc();
  assertContains(doc, 'Keep **#3906 OPEN**', '3906 keep open');
  assertContains(doc, 'Keep **#3897 OPEN**', '3897 keep open');
  assertContains(doc, '#3903** — completed prerequisite', '3903 completed');
  assertContains(doc, 'Keep **#1882 OPEN**', '1882 keep open');
  assertContains(doc, 'Refs #1882', '1882 refs only');
  // Ensure #3903 is NOT marked as keep-open
  assertNotContains(doc, 'Keep **#3903 OPEN**', '3903 must not be keep-open');
  // Ensure no Closes/Fixes/Resolves for keep-open issues
  const keepOpenSection = doc.slice(doc.indexOf('## Keep-open references'));
  assert.ok(
    !/Closes #1882|Fixes #1882|Resolves #1882/.test(keepOpenSection),
    'Must not Closes/Fixes/Resolves #1882'
  );
  assert.ok(
    !/Closes #3897|Fixes #3897|Resolves #3897/.test(keepOpenSection),
    'Must not Closes/Fixes/Resolves #3897'
  );
  assert.ok(
    !/Closes #3903|Fixes #3903|Resolves #3903/.test(keepOpenSection),
    'Must not Closes/Fixes/Resolves #3903'
  );
});

test('error vocabulary is bounded', () => {
  const doc = readDoc();
  const codes = [
    'INVALID_PLAYLIST_SOURCE',
    'UNSUPPORTED_PLAYLIST_SOURCE',
    'UNAUTHORIZED',
    'PLAYLIST_NOT_FOUND',
    'PLAYLIST_NOT_ACCESSIBLE',
    'PLAYLIST_UNSUPPORTED',
    'PROVIDER_QUOTA_EXCEEDED',
    'PROVIDER_TIMEOUT',
    'PROVIDER_UNAVAILABLE',
    'INTERNAL_PREVIEW_ERROR'
  ];
  for (const code of codes) {
    assertContains(doc, code, `error code ${code}`);
  }
  assertContains(doc, 'Raw YouTube API error bodies', 'raw provider error prohibition');
});

test('videos.list necessity is assessed', () => {
  const doc = readDoc();
  assertContains(doc, 'videos.list', 'videos.list assessment');
  assertContains(doc, 'NOT required for the first preview slice', 'videos.list not required');
});

test('current-main authority map references actual files', () => {
  const doc = readDoc();
  assertContains(doc, 'functions/api/[[path]].js', 'catch-all route');
  assertContains(doc, 'functions/api/youtube/oembed.js', 'existing youtube route');
  assertContains(doc, 'functions/api/scout/suggest.js', 'scout route');
  assertContains(doc, 'Modal compute', 'modal backend');
  assertContains(doc, 'Neon', 'neon persistence');
  assertContains(doc, 'Netlify', 'netlify legacy exclusion');
  assertContains(doc, 'modal_compute/auth.py', 'modal auth module');
  assertContains(doc, 'require_firebase_user', 'modal auth function');
});

test('existing schema fields are audited', () => {
  const doc = readDoc();
  assertContains(doc, 'sourceUrl', 'sourceUrl field');
  assertContains(doc, 'sourceType', 'sourceType field');
  assertContains(doc, 'thumbnail', 'thumbnail field');
  assertContains(doc, 'artist', 'artist field');
  assertContains(doc, 'channelId', 'channelId field');
  assertContains(doc, 'externalVideoId', 'externalVideoId absent');
  assertContains(doc, 'ABSENT', 'absent field classification');
  assertContains(doc, 'EXISTING_CANONICAL', 'canonical field classification');
});

test('official YouTube API constraints are verified', () => {
  const doc = readDoc();
  assertContains(doc, 'playlistItems.list', 'playlistItems.list');
  assertContains(doc, 'playlists.list', 'playlists.list');
  assertContains(doc, '1 unit per request', 'quota cost per request');
  assertContains(doc, '0–50', 'maxResults range');
  assertContains(doc, 'nextPageToken', 'pagination token');
  assertContains(doc, 'playlistNotFound', 'playlist not found error');
  assertContains(doc, 'playlistItemsNotAccessible', 'not accessible error');
  assertContains(doc, 'playlistOperationUnsupported', 'unsupported playlist error');
});

test('stop conditions are documented', () => {
  const doc = readDoc();
  assertContains(doc, 'active backend authority unclear', 'stop condition: backend');
  assertContains(doc, 'arbitrary URL fetch required', 'stop condition: arbitrary fetch');
  assertContains(doc, 'provider credential boundary unclear', 'stop condition: credentials');
  assertContains(doc, 'none of these stop conditions are triggered', 'no stop condition triggered');
});

test('future implementation paths reference Modal endpoint', () => {
  const doc = readDoc();
  assertContains(doc, 'modal_compute/app.py', 'modal app endpoint');
  assertContains(doc, 'modal_compute/youtube_playlist_preview.py', 'modal provider module');
  assertContains(doc, 'functions/api/import/youtube/playlist/preview.js', 'cloudflare proxy route');
  assertContains(doc, 'require_firebase_user', 'modal auth in implementation');
});
