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

test('unavailable item policy exists', () => {
  const doc = readDoc();
  assertContains(doc, 'AVAILABLE', 'available state');
  assertContains(doc, 'UNAVAILABLE', 'unavailable state');
  assertContains(doc, 'METADATA_PARTIAL', 'metadata partial state');
  assertContains(doc, 'THUMBNAIL_UNAVAILABLE', 'thumbnail unavailable state');
  assertContains(doc, 'BOUNDED_PARTIAL_WITH_EXPLICIT_STATE', 'partial result policy');
  assertContains(doc, 'never silently dropped', 'no silent drop');
});

test('thumbnail unavailable policy exists', () => {
  const doc = readDoc();
  assertContains(doc, 'thumbnailUrl', 'thumbnail URL field');
  assertContains(doc, 'deterministic LoveBud placeholder', 'placeholder fallback');
  assertContains(doc, 'multi-host retry', 'no multi-host retry');
});

test('quota policy exists', () => {
  const doc = readDoc();
  assertContains(doc, 'Quota cost', 'quota cost');
  assertContains(doc, '10,000 units', 'default daily quota');
  assertContains(doc, '2 units', 'per-preview cost');
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

test('provider secret browser exposure is prohibited', () => {
  const doc = readDoc();
  assertContains(doc, 'Server-side only', 'server-side only');
  assertContains(doc, 'never in browser bundle', 'browser bundle prohibition');
  assertContains(doc, 'YOUTUBE_DATA_API_KEY', 'config variable name');
  assertContains(doc, 'CONFIGURATION_REQUIRED', 'configuration status');
});

test('tutorial integration is referenced', () => {
  const doc = readDoc();
  assertContains(doc, '#3903', 'tutorial issue reference');
  assertContains(doc, 'YouTube 재생목록 가져오기', 'tutorial route name');
  assertContains(doc, 'read-only', 'read-only preview');
});

test('negative controls are present', () => {
  const doc = readDoc();
  const ncs = ['NC1', 'NC2', 'NC3', 'NC4', 'NC5', 'NC6', 'NC7', 'NC8', 'NC9', 'NC10', 'NC11', 'NC12', 'NC13', 'NC14', 'NC15'];
  for (const nc of ncs) {
    assertContains(doc, nc, `negative control ${nc}`);
  }
  assertContains(doc, 'Tree write 0', 'NC10 tree write zero');
  assertContains(doc, 'Moment write 0', 'NC11 moment write zero');
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
  assertContains(doc, 'Keep **#3903 OPEN**', '3903 keep open');
  assertContains(doc, 'Keep **#1882 OPEN**', '1882 keep open');
  assertContains(doc, 'Refs #1882', '1882 refs only');
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
