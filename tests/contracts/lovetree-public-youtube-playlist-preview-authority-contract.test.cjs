/**
 * Contract test for the LoveTree public YouTube playlist read-only preview
 * authority (Issue #3906).
 *
 * Docs-structure contract only. No provider request, no runtime route, no
 * network, no DB, no browser, no Production. Proves the authority-corrected
 * decisions remain explicit: POST-only preview RPC, Modal Firebase
 * verification authority, Cloudflare gateway/forwarding role, body XOR,
 * fixed host policy, server-internal pagination with hard 200 ceiling, no
 * partial preview, overall deadline, credential/activation boundary, and
 * contradiction-free phrasing.
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
  '## 3. Proposed canonical path and role split',
  '## 4. Request method, body, and privacy boundary',
  '## 5. URL/host policy — single decision (first slice)',
  '## 6. Normalized ordered preview response',
  '## 7. Pagination and 200-item ceiling (corrected)',
  '## 8. Partial-result policy (corrected)',
  '## 9. Timeout and retry (single authority)',
  '## 10. API key, quota, and activation boundary',
  '## 11. Security and privacy controls',
  '## 12. Beginner tutorial / UI integration point',
  '## 13. Exact implementation paths (repository-accurate)',
  '## 14. Verdict',
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
    'functions/api/youtube/oembed.js',
  ]) {
    assert.ok(doc.includes(routeFile), `missing route file: ${routeFile}`);
  }
});

test('authentication authority facts are recorded correctly', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### Authentication authority facts (current main)', '### The canonical owner-token verification authority');
  assert.ok(/js\/api\/auth-policy\.js/.test(section), 'must name auth-policy.js');
  assert.ok(/not\*\* a server token-verification authority|not a server token-verification authority/.test(section), 'auth-policy must be stated as client-attachment decision only');
  assert.ok(/functions\/api\/trees\.js/.test(section), 'must name trees.js forwarding');
  assert.ok(/Cloudflare does not verify the Firebase token itself|does not verify the token itself/.test(section), 'must state Cloudflare does not verify the token');
  assert.ok(/mock-disabled/.test(section), 'must record Scout verifier is mock-disabled');
  assert.ok(/oembed\.js/.test(section), 'must record oembed seam');
  assert.ok(/not\*\* be reused as the owner-only import auth authority|not be reused as the owner-only import auth authority/.test(section), 'must forbid reusing oembed as owner auth authority');
});

test('canonical Modal Firebase verification authority is recorded with exact files and function', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### The canonical owner-token verification authority', '## 2. Official provider constraints');
  assert.ok(/modal_compute\/auth\.py/.test(section), 'must name modal_compute/auth.py');
  assert.ok(/require_firebase_user\(authorization\)/.test(section), 'must name require_firebase_user');
  assert.ok(/RS256/.test(section), 'must record RS256 verification');
  assert.ok(/audience/.test(section), 'must record audience check');
  assert.ok(/issuer/.test(section), 'must record issuer check');
  assert.ok(/modal\/private\/trees/.test(section), 'must name the /modal/private/trees route example');
  assert.ok(/modal_compute\/app\.py/.test(section), 'must name modal_compute/app.py');
  assert.ok(/lovebud-firebase-admin/.test(section), 'must record the Modal firebase secret');
});

test('modal authority conclusion rejects Cloudflare-only authority', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### The canonical owner-token verification authority', '## 2. Official provider constraints');
  assert.ok(/must verify tokens in Modal via `require_firebase_user`, never in Cloudflare/.test(section), 'must require Modal verification');
  assert.ok(/never via the Scout mock-disabled verifier/.test(section), 'must forbid Scout mock-disabled verifier as runtime authority');
  assert.ok(/never via the public oEmbed seam/.test(section), 'must forbid oEmbed seam as auth authority');
});

test('canonical path and role split are explicit and contradiction-free', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 3. Proposed canonical path and role split', '## 4. Request method');
  assert.ok(/POST \/api\/import\/youtube\/playlist\/preview/.test(section), 'must propose POST preview route');
  assert.ok(/Cloudflare Pages Function gateway/.test(section), 'must name Cloudflare gateway');
  assert.ok(/Authorization 그대로 전달|Authorization forwarding/.test(section), 'must name Authorization forwarding');
  assert.ok(/Modal private preview endpoint/.test(section), 'must name Modal private endpoint');
  assert.ok(/require_firebase_user/.test(section), 'must name Modal auth function in role split');
  assert.ok(/Neon:\n미사용|Neon:\s*미사용|미사용 \(0\)/.test(section), 'must state Neon unused');
  assert.ok(/Cloudflare does \*\*not\*\* verify authentication/.test(section), 'must state Cloudflare does not verify auth');
  assert.ok(!/No Modal/.test(section), 'must not contain "No Modal" (Modal owns auth/provider authority)');
});

test('request method, transport, and body XOR contract are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 4. Request method, body, and privacy boundary', '## 5. URL/host policy');
  assert.ok(/POST \/api\/import\/youtube\/playlist\/preview/.test(section), 'must be POST');
  assert.ok(/Content-Type: application\/json/.test(section), 'must require JSON content type');
  assert.ok(/Authorization: Bearer <Firebase ID token>/.test(section), 'must require Bearer token');
  assert.ok(/neither url nor playlistId\s+-> 400|neither url nor playlistId -> 400/.test(section), 'must 400 when both missing');
  assert.ok(/both url and playlistId\s+-> 400|both url and playlistId -> 400/.test(section), 'must 400 when both present');
  assert.ok(/url: <= 2048/.test(section), 'must bound url to 2048');
  assert.ok(/playlistId: <= 64/.test(section), 'must bound playlistId to 64');
  assert.ok(/performs no write/.test(section), 'must state POST performs no write');
});

test('privacy boundary keeps source identity out of query/path/telemetry/error', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 4.3 Privacy boundary', '## 5. URL/host policy');
  assert.ok(/never appear in a query string, request path, request-id, telemetry, or error response/.test(section), 'must forbid source identity in query/path/request-id/telemetry/error');
});

test('URL/host policy is a single decision with music.youtube.com resolved', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 5. URL/host policy — single decision (first slice)', '## 6. Normalized ordered preview response');
  for (const host of [
    'https://youtube.com/playlist?list=',
    'https://www.youtube.com/playlist?list=',
    'https://m.youtube.com/playlist?list=',
    'https://music.youtube.com/playlist?list=',
    'https://youtube.com/watch?...&list=',
    'https://www.youtube.com/watch?...&list=',
    'bare playlist ID',
  ]) {
    assert.ok(section.includes(host), `missing allowed host/form: ${host}`);
  }
  assert.ok(/music\.youtube\.com` is \*\*allowed in the first slice\*\*/.test(section), 'must resolve music.youtube.com as allowed');
  for (const rejected of [
    'http:',
    'unknown host',
    'username/password',
    'port',
    'fragment',
    'list가 없는 watch URL',
    'youtu.be URL',
    '/embed, /shorts, /live URL',
    'invalid playlist ID charset',
  ]) {
    assert.ok(section.includes(rejected), `missing rejected form: ${rejected}`);
  }
  assert.ok(/canonical source URL:\nhttps:\/\/www\.youtube\.com\/playlist\?list=<playlistId>/.test(section), 'must define canonical source URL');
  assert.ok(/no “추후 결정”, “unless decided”, or “논의 필요” remains/.test(section), 'must explicitly ban deferred-decision language');
  assert.ok(section.includes('“unless decided”'), 'must forbid "unless decided" wording');
});

test('normalized preview response uses tutorial vocabulary with corrected item states', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 6. Normalized ordered preview response', '## 7. Pagination and 200-item ceiling');
  assert.ok(/merged tutorial vocabulary/.test(section), 'must reference the merged tutorial vocabulary');
  for (const state of ['included', 'duplicate', 'unavailable', 'unsupported', 'needsReview']) {
    assert.ok(section.includes(state), `missing item state: ${state}`);
  }
  assert.ok(/`excluded` is \*\*not\*\* a provider-assigned state/.test(section), 'must distinguish excluded as user-selected');
  assert.ok(/must \*\*not\*\* fabricate a group field/.test(section), 'must not fabricate group/folder for YouTube');
  assert.ok(/must \*\*not\*\* fabricate emotional\/narrative Connections/.test(section), 'must forbid fabricating Connections');
  assert.ok(/"writes": 0/.test(section), 'response must declare writes 0');
  assert.ok(!/partial: true/.test(section), 'response must not contain partial: true');
  assert.ok(/no nextPageToken/.test(section), 'must state the response carries no nextPageToken');
  const shapeBlock = extractSection(section, '```text\n{', '```');
  assert.ok(shapeBlock.length > 0, 'response shape code block must exist');
  assert.ok(!/nextPageToken/.test(shapeBlock), 'response shape JSON must not contain a nextPageToken field');
});

test('pagination is server-internal with hard 200 ceiling and no client pageToken', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 7. Pagination and 200-item ceiling (corrected)', '## 8. Partial-result policy');
  assert.ok(/Client request carries \*\*no `pageToken`\*\*/.test(section), 'must forbid client pageToken');
  assert.ok(/`pageToken` is \*\*server-internal only\*\*/.test(section), 'must state pageToken is server-internal');
  assert.ok(/playlists\.list/ .test(section), 'must name playlists.list');
  assert.ok(/maximum 4 pages|최대 4페이지/.test(section), 'must cap internal pages at 4');
  assert.ok(/maxResults\s+—\s+50|maxResults\n.+50/.test(section) || /maxResults/.test(section) && /50/.test(section), 'must record maxResults 50');
  assert.ok(/hard ceiling — \*\*200\*\*|200/.test(section), 'must record 200 hard ceiling');
  assert.ok(/Response exposes \*\*no `nextPageToken`\*\*/.test(section), 'must forbid public nextPageToken');
  assert.ok(/이 재생목록은 항목이 많아 처음 200개만 미리 보여드려요\./.test(section), 'must include the user-facing truncation copy');
});

test('partial-result policy forbids partial preview and page-prefix return', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 8. Partial-result policy (corrected)', '## 9. Timeout and retry');
  assert.ok(/partial preview is forbidden|partial preview \*\*is forbidden\*\*/.test(section), 'must forbid partial preview');
  assert.ok(/preview item 0/.test(section), 'must return zero items on failure');
  assert.ok(/writes 0/.test(section), 'must keep writes 0 on failure');
  assert.ok(/No previously successful page prefix is returned/.test(section), 'must not return page prefix on later failure');
  assert.ok(/if page 2 fails, page 1 items must not appear/.test(section), 'must add page-2-failure negative control');
  assert.ok(!/partial: true/.test(section), 'must not contain partial: true');
});

test('timeout and retry use one overall deadline authority', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 9. Timeout and retry (single authority)', '## 10. API key, quota');
  assert.ok(/전체 preview request wall-clock budget: 10초|10 s/.test(section), 'must record 10s overall budget');
  assert.ok(/최대 1회|1회/.test(section), 'must record max 1 retry');
  assert.ok(/retry는 전체 deadline을 넘을 수 없음/.test(section), 'retry must not exceed overall deadline');
  assert.ok(/400\/401\/403\/404는 retry 0|400\/401\/403\/404.*retry 0/.test(section), 'must not retry 4xx');
  assert.ok(/AbortSignal 기반 취소|AbortSignal/.test(section), 'must require AbortSignal cancellation');
  assert.ok(/never “each fetch gets 10 s”/.test(section), 'must forbid unbounded per-fetch deadlines');
});

test('API key and activation boundary are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 10. API key, quota, and activation boundary', '## 11. Security and privacy controls');
  assert.ok(/never\*\* exposed to the browser/.test(section), 'must forbid exposing API key to browser');
  assert.ok(/Modal secret boundary/.test(section), 'must place credential in Modal secret boundary');
  assert.ok(/Implementation PR vs activation are separated|implementation PR can merge/.test(section), 'must separate implementation from activation');
  assert.ok(/disabled-by-default runtime guard/.test(section), 'must require disabled-by-default guard');
  assert.ok(/activation\*\* boundary, not an implementation blocker|not an implementation blocker/.test(section), 'must classify as activation boundary');
});

test('Modal is the provider execution owner with credential boundary', () => {
  const doc = readDoc();
  assert.ok(/With Modal as the provider-execution owner/.test(readDoc()), 'must state Modal owns provider execution');
});

test('security and privacy controls are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 11. Security and privacy controls', '## 12. Beginner tutorial / UI integration point');
  for (const token of [
    'www.googleapis.com/youtube/v3',
    'arbitrary fetch',
    'Bounded response',
    'no caller-supplied upstream URL',
    'kill switch',
    'fail-closed',
  ]) {
    assert.ok(section.includes(token), `missing security control: ${token}`);
  }
});

test('tutorial integration point references the merged tutorial contract', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 12. Beginner tutorial / UI integration point', '## 13. Exact implementation paths');
  assert.ok(/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT\.md/.test(section), 'must reference the merged tutorial contract');
  assert.ok(/YouTube 재생목록 가져오기/.test(section), 'must name the tutorial entry route');
  assert.ok(/no write in the first preview slice/.test(section), 'must keep first slice write-free');
});

test('implementation paths are repository-accurate with bounded slice files', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 13. Exact implementation paths (repository-accurate)', '## 14. Verdict');
  assert.ok(/modal_compute\//.test(section), 'must reference modal_compute layout');
  assert.ok(/functions\/api\/import\/youtube\/playlist\/preview\.js/.test(section), 'must name Cloudflare gateway file');
  assert.ok(/modal_compute\/youtube_playlist_preview\.py/.test(section), 'must name Modal private route file');
  assert.ok(/modal_compute\/youtube_playlist_provider\.py/.test(section), 'must name Modal provider adapter file');
  assert.ok(/js\/import\/youtube-playlist-preview-client\.js/.test(section), 'must name client API file');
  assert.ok(/Exact maximum file count for the backend slice: \*\*5\*\*|maximum file count/.test(section), 'must state a numeric maximum file count');
  assert.ok(/Slice 1:\nauthenticated backend preview contract/.test(section), 'must separate backend slice');
  assert.ok(/Slice 2:\nbeginner tutorial entry/.test(section), 'must separate UI/tutorial slice');
  assert.ok(/UI\/tutorial rendering is \*\*not\*\* mixed into the backend implementation PR/.test(section), 'must not mix UI into backend PR');
});

test('negative controls include method 405, body XOR, partial ban, and persistence ban', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 13.4 Negative controls', '### 13.5 Stop conditions');
  for (const nc of [
    'arbitrary upstream URL rejected',
    'GET/PUT/PATCH/DELETE on the preview route → 405',
    'neither url nor playlistId → 400',
    'both url and playlistId → 400',
    'quota 403',
    'page 2 failure → page 1 items must not be in the response',
    'deleted/private item not silently dropped',
    'duplicate videoId classified as duplicate',
    'any Tree/Memory/Connection persistence invoked → test fails',
    'source URL/playlist ID present in query, path, request-id, telemetry, or error response → test fails',
  ]) {
    assert.ok(section.includes(nc), `missing negative control: ${nc}`);
  }
});

test('old GET query-based route is fully removed', () => {
  const doc = readDoc();
  assert.ok(!/\?url=\.\.\./.test(doc), 'must not show query-string url form');
  assert.ok(!/\?playlistId=\.\.\./.test(doc), 'must not show query-string playlistId form');
  assert.ok(!/any POST\/PUT\/PATCH\/DELETE rejected/.test(doc), 'must not contain the old negative control wording');
});

test('verdict is exactly one of the three allowed values', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 14. Verdict');
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
  const section = extractSection(doc, '## 2. Official provider constraints (YouTube)', '## 3. Proposed canonical path');
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
