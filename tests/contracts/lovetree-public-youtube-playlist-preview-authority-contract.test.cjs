/**
 * Contract test for the LoveTree public YouTube playlist read-only preview
 * authority (Issue #3906).
 *
 * Docs-structure contract only. No provider request, no runtime route, no
 * network, no DB, no browser, no Production. Proves the proposed route and
 * runtime owner, bounded request fields and accepted URL/ID forms, normalized
 * tutorial-vocabulary response, pagination policy, provider adapter seam,
 * security/privacy/quota controls, tutorial integration, implementation
 * scope, negative controls, and stop conditions remain explicit.
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

const EXPECTED_MAIN_SHA = '3fe01d6a563d60534f0c818299ebb58415ec8e64';

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

function extractSection(source, startHeading, nextHeading) {
  const startIdx = source.indexOf(startHeading);
  assert.ok(startIdx >= 0, `start heading not found: ${startHeading}`);
  const afterStart = startIdx + startHeading.length;
  let endIdx = source.length;
  if (nextHeading) {
    const n = source.indexOf(nextHeading, afterStart);
    if (n >= 0) endIdx = n;
  } else {
    const rest = source.slice(afterStart);
    const m = rest.match(/\n#{1,3} /);
    if (m && typeof m.index === 'number') endIdx = afterStart + m.index;
  }
  return source.slice(startIdx, endIdx);
}

const REQUIRED_SECTIONS = [
  '## 1. Current-main baseline and authority mapping',
  '## 2. Official provider constraints (YouTube)',
  '## 3. Proposed same-origin preview route and active runtime owner',
  '## 4. Normalized ordered preview response',
  '## 5. Pagination, item ceiling, timeout, truncation, retry, partial-result policy',
  '## 6. Minimum YouTube-specific provider adapter seam',
  '## 7. Host allowlist, arbitrary-fetch prevention, bounded response, privacy, logging, quota controls',
  '## 8. Beginner tutorial / UI integration point',
  '## 9. Exact implementation paths, maximum scope, tests, negative controls, stop conditions',
  '## 10. Verdict',
  '## 11. Hard prohibitions (non-actions)',
];

test('contract document exists', () => {
  assert.ok(fs.existsSync(DOC_PATH));
});

for (const section of REQUIRED_SECTIONS) {
  test(`contract document contains required section "${section}"`, () => {
    const doc = readDoc();
    assert.ok(doc.includes(section), `Required section "${section}" missing`);
  });
}

test('contract records the exact current main SHA and prerequisite closure', () => {
  const doc = readDoc();
  assert.ok(doc.includes(EXPECTED_MAIN_SHA), `Contract must record current main SHA ${EXPECTED_MAIN_SHA}`);
  assert.ok(/PR #3905 merged/.test(doc), 'must record PR #3905 merged');
  assert.ok(/#3903 CLOSED/.test(doc), 'must record #3903 closed');
});

test('authority mapping names the active runtime path and current same-origin routes', () => {
  const doc = readDoc();
  assert.ok(/browser → same-origin \/api\/\* → Cloudflare Pages Functions → Modal → Neon/.test(doc));
  for (const routeFile of [
    'functions/api/[[path]].js',
    'functions/api/trees.js',
    'functions/api/trees/[id].js',
    'functions/api/memories.js',
    'functions/api/memories/[id].js',
    'functions/api/youtube/oembed.js',
  ]) {
    assert.ok(doc.includes(routeFile), `missing route file: ${routeFile}`);
  }
  assert.ok(/functions\/api\/youtube\/oembed\.js/.test(doc), 'must name the existing YouTube oembed seam');
});

test('auth-policy public prefix rule is recorded', () => {
  const doc = readDoc();
  assert.ok(/endpointLikelyRequiresAuth/.test(doc), 'must name endpointLikelyRequiresAuth');
  assert.ok(/\/community\//.test(doc), 'must record the public-safe prefix rule');
});

test('proposed route and runtime owner are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 3. Proposed same-origin preview route and active runtime owner', '## 4. Normalized ordered preview response');
  assert.ok(/GET \/api\/import\/youtube\/playlist\/preview/.test(section), 'must propose the exact preview route');
  assert.ok(/Cloudflare Pages Functions/.test(section), 'must name the active runtime owner');
  assert.ok(/functions\/api\/import\/youtube\/playlist\/preview\.js/.test(section), 'must name the proposed route file');
  assert.ok(/No Modal, no Neon, no OAuth, no write/i.test(section), 'must exclude Modal/Neon/OAuth/write');
});

test('bounded request fields and accepted playlist URL/ID forms are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 3.2 Bounded request fields', '### 3.3 Accepted playlist URL/ID forms');
  for (const field of ['url', 'playlistId', 'pageToken']) {
    assert.ok(section.includes(field), `missing request field: ${field}`);
  }
  assert.ok(/2048/.test(section), 'must bound url length to 2048');
  assert.ok(/64/.test(section), 'must bound playlistId length');
  const forms = extractSection(doc, '### 3.3 Accepted playlist URL/ID forms', '## 4. Normalized ordered preview response');
  for (const form of [
    'https://www.youtube.com/playlist?list=PL',
    'https://youtube.com/playlist?list=PL',
    'bare playlist ID',
    'Rejected: non-`https`',
  ]) {
    assert.ok(forms.includes(form), `missing URL/ID form: ${form}`);
  }
  assert.ok(/PL…/.test(forms) || /^[0-9A-Za-z_-]{10,64}$/.test(forms), 'playlist ID charset bound must be present');
});

test('normalized preview response uses the merged tutorial vocabulary', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 4. Normalized ordered preview response', '## 5. Pagination');
  assert.ok(/merged tutorial vocabulary/.test(section), 'must reference the merged tutorial vocabulary');
  for (const state of [
    'source collection',
    'proposed Tree',
    'group/folder',
    'proposed Moment',
    'included / excluded',
    'duplicate',
    'unavailable',
    'unsupported',
    'needs review',
  ]) {
    assert.ok(section.includes(state), `missing preview vocabulary state: ${state}`);
  }
  assert.ok(/playback order only/.test(section), 'must state playlist order is playback order only');
  assert.ok(/must \*\*not\*\* fabricate emotional\/narrative Connections/.test(section), 'must forbid fabricating Connections');
});

test('preview response shape is bounded and write-free', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 4.1 Response shape (bounded)', '### 4.2 Ordering rule');
  for (const token of ['sourceCollection', 'proposedTree', 'items', 'pagination', 'order', 'writes']) {
    assert.ok(section.includes(token), `missing response shape token: ${token}`);
  }
  assert.ok(/"writes": 0/.test(section), 'response must declare writes 0');
});

test('pagination policy covers ceiling, timeout, truncation, retry, partial results', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 5. Pagination, item ceiling, timeout, truncation, retry, partial-result policy', '## 6. Minimum YouTube-specific provider adapter seam');
  for (const token of [
    'maxResults',
    '50',
    'item ceiling',
    '200',
    'truncated',
    'timeout',
    'retry',
    'partial',
    'unavailable',
    'duplicate',
  ]) {
    assert.ok(section.includes(token), `missing pagination policy token: ${token}`);
  }
});

test('provider adapter seam is bounded and the only YouTube-touching module', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 6. Minimum YouTube-specific provider adapter seam', '## 7. Host allowlist');
  assert.ok(/functions\/api\/_shared\/youtube-playlist-provider\.js/.test(section), 'must name the adapter file');
  for (const fn of [
    'buildPlaylistApiUrl',
    'parsePlaylistMetadata',
    'parsePlaylistItems',
    'classifyItemState',
    'mapToPreviewItem',
  ]) {
    assert.ok(section.includes(fn), `missing adapter function: ${fn}`);
  }
  assert.ok(/only.*module allowed to touch|only\*\* module allowed/.test(section), 'adapter must be the only YouTube-touching module');
  assert.ok(/injected.*fetch|inject.*fetch|fake `fetch`/.test(section), 'must define an injected fetch mock seam');
});

test('security, privacy, and quota controls are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 7. Host allowlist, arbitrary-fetch prevention, bounded response, privacy, logging, quota controls', '## 8. Beginner tutorial / UI integration point');
  for (const token of [
    'Host allowlist',
    'www.googleapis.com/youtube/v3',
    'arbitrary fetch',
    'bounded response',
    'no credentials',
    'quota',
    'fail-closed',
    'kill switch',
  ]) {
    assert.ok(section.includes(token), `missing security/privacy token: ${token}`);
  }
});

test('tutorial integration point references the merged tutorial contract', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 8. Beginner tutorial / UI integration point', '## 9. Exact implementation paths');
  assert.ok(/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT\.md/.test(section), 'must reference the merged tutorial contract');
  assert.ok(/YouTube 재생목록 가져오기/.test(section), 'must name the tutorial entry route');
  assert.ok(/no write in the first preview slice/.test(section), 'must keep first slice write-free');
});

test('implementation paths, scope, tests, negative controls, and stop conditions are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 9. Exact implementation paths, maximum scope, tests, negative controls, stop conditions', '## 10. Verdict');
  for (const token of [
    'functions/api/import/youtube/playlist/preview.js',
    'functions/api/_shared/youtube-playlist-provider.js',
    'Maximum scope',
    'read-only ordered preview',
    'no Tree/Moment write',
    'no OAuth',
    'no schema/migration',
    'Negative controls',
    'Stop conditions',
  ]) {
    assert.ok(section.includes(token), `missing implementation-scope token: ${token}`);
  }
  for (const nc of [
    'arbitrary upstream URL rejected',
    'invalid charset rejected',
    'quota 403',
    'deleted/private item not silently dropped',
    'duplicate videoId classified as duplicate',
    'truncated',
    'any write method (POST/PUT/PATCH/DELETE) on the preview route → rejected',
  ]) {
    assert.ok(section.includes(nc), `missing negative control: ${nc}`);
  }
});

test('verdict is exactly one of the three allowed values', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 10. Verdict');
  const allowed = [
    'PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_IMPLEMENTATION_READY',
    'PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_CONFIGURATION_BLOCKED',
    'PUBLIC_YOUTUBE_PLAYLIST_PREVIEW_AUTHORITY_BLOCKED',
  ];
  const present = allowed.filter((v) => section.includes(v));
  assert.equal(present.length, 1, `must contain exactly one allowed verdict, found ${present.length}`);
});

test('official provider constraints and attribution are present', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 2. Official provider constraints (YouTube)', '## 3. Proposed same-origin preview route');
  for (const token of [
    'playlistItems.list',
    'maxResults',
    '50',
    'pageToken',
    'nextPageToken',
    'playlists.list',
    'Quota',
    'Attribution',
    'Watch History and Watch Later',
  ]) {
    assert.ok(section.includes(token), `missing provider constraint: ${token}`);
  }
});

test('hard prohibitions and non-actions are stated', () => {
  const doc = readDoc();
  for (const prohibition of [
    'no external provider request',
    'no runtime route implementation',
    'no OAuth',
    'no Tree/Moment write',
    'no schema/migration',
    'no Production/Preview',
    'no modification of PR #3898',
  ]) {
    assert.ok(doc.includes(prohibition), `missing hard prohibition: ${prohibition}`);
  }
});

test('keep-open references are present and no closure language is used', () => {
  const doc = readDoc();
  assert.ok(/Keep \*\*#3906 OPEN\*\*|Keep #3906 OPEN/i.test(doc));
  assert.ok(/Keep \*\*#3897 OPEN\*\*|Keep #3897 OPEN/i.test(doc));
  assert.ok(/Keep \*\*#1882 OPEN\*\*|Keep #1882 OPEN|#1882.*\*\*OPEN\*\*/i.test(doc));
  assert.ok(!/Closes #3906|Fixes #3906|Resolves #3906/.test(doc));
  assert.ok(!/Closes #3897|Fixes #3897|Resolves #3897/.test(doc));
  assert.ok(!/Closes #1882|Fixes #1882|Resolves #1882/.test(doc));
});
