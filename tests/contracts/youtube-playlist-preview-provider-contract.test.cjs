/**
 * Provider contract test for the authenticated YouTube playlist preview
 * (modal_compute/youtube_playlist_preview.py and app.py endpoint) — Issue #3914.
 *
 * Verifies the Modal side:
 *  - verified auth (require_firebase_user) happens BEFORE any provider call
 *  - fixed official YouTube Data API endpoints only (no arbitrary fetch)
 *  - provider ceilings: 1 playlists.list, 1 playlistItems.list, no retry,
 *    no second page, max 50 items, no videos.list
 *  - canonical item-state vocabulary only (no stale AVAILABLE/UNAVAILABLE)
 *  - bounded error normalization; no raw provider body/exposure
 *  - provider key is a Modal-side secret (lovebud-youtube-data-api)
 *  - no Tree/Moment/Connection write
 *
 * No network, no DB, no browser, no Production.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_FILE = path.join(ROOT, 'modal_compute/youtube_playlist_preview.py');
const APP_FILE = path.join(ROOT, 'modal_compute/app.py');

function readModuleSource() {
  return fs.readFileSync(MODULE_FILE, 'utf8');
}

function readAppSource() {
  return fs.readFileSync(APP_FILE, 'utf8');
}

test('provider module exists and is non-empty', () => {
  const source = readModuleSource();
  assert.ok(source.length > 1000, 'provider module must be substantial');
});

test('only fixed official YouTube Data API endpoints are used', () => {
  const source = readModuleSource();
  assert.match(source, /PLAYLISTS_ENDPOINT\s*=\s*"https:\/\/www\.googleapis\.com\/youtube\/v3\/playlists"/);
  assert.match(source, /PLAYLIST_ITEMS_ENDPOINT\s*=\s*"https:\/\/www\.googleapis\.com\/youtube\/v3\/playlistItems"/);
});

test('no arbitrary/user-supplied URL is ever fetched', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /fetch\(|urlopen\(\s*(source|value)/);
  assert.doesNotMatch(source, /urllib\.request\.urlopen\(\s*_(?:value|source)/);
  assert.match(source, /parse_playlist_source/);
  assert.match(source, /_extract_playlist_id_from_url/);
});

test('redirect following is forbidden', () => {
  const source = readModuleSource();
  assert.match(source, /NoRedirectHandler|redirect_request/);
  assert.match(source, /HTTPRedirectHandler/);
});

test('provider call ceilings are enforced (1 playlists + 1 playlistItems = 2)', () => {
  const source = readModuleSource();
  assert.match(source, /PROVIDER_MAX_CALLS\s*=\s*2/);
  assert.match(source, /PROVIDER_PAGE_SIZE\s*=\s*50/);
  assert.match(source, /PROVIDER_ITEM_CEILING\s*=\s*50/);
  assert.match(source, /PROVIDER_MAX_PAGES\s*=\s*1/);
  assert.match(source, /def fetch_playlist_metadata/);
  assert.match(source, /def fetch_playlist_items/);
  assert.match(source, /def normalize_playlist_preview/);
  assert.match(source, /PLAYLISTS_ENDPOINT/);
  assert.match(source, /PLAYLIST_ITEMS_ENDPOINT/);
});

test('no automatic retry, no second page, no videos.list', () => {
  const source = readModuleSource();
  // No retry loop in code (docstring may mention "retry: 0" as a contract).
  assert.doesNotMatch(source, /for\s+attempt|while\s+attempt|retry\s*\(|max_retries|maxRetries/);
  // No videos.list endpoint constant.
  assert.doesNotMatch(source, /videos.*END_POINT|ENDPOINT.*videos|youtube\/v3\/videos/);
  // fetch_playlist_items must not loop on nextPageToken for page 2.
  const itemsFn = sliceBetween(
    source,
    /def fetch_playlist_items/,
    /def _normalize_playlist_item/
  );
  assert.doesNotMatch(itemsFn, /while|for\s+page|nextPageToken.*loop/i);
});

test('provider request timeout and secret are defined', () => {
  const source = readModuleSource();
  assert.match(source, /PROVIDER_TIMEOUT_SECONDS\s*=\s*10/);
  assert.match(source, /PROVIDER_SECRET_NAME\s*=\s*"lovebud-youtube-data-api"/);
  assert.match(source, /PROVIDER_KEY_ENV\s*=\s*"YOUTUBE_DATA_API_KEY"/);
  assert.match(source, /CONFIGURATION_REQUIRED/);
});

test('canonical item state vocabulary is used; stale AVAILABLE/UNAVAILABLE absent', () => {
  const source = readModuleSource();
  for (const state of [
    'AVAILABLE_METADATA',
    'PRIVATE_OR_UNAVAILABLE',
    'METADATA_PARTIAL',
    'THUMBNAIL_UNAVAILABLE',
    'UNKNOWN',
  ]) {
    assert.match(source, new RegExp(state));
  }
  assert.doesNotMatch(source, /"state"\s*:\s*"AVAILABLE"/);
  assert.doesNotMatch(source, /"state"\s*:\s*"UNAVAILABLE"/);
});

test('no fabricated Connection / parentId / connectionId / relationship fields', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /parentId|connectionId|relationship|parent_id|connection_id/);
});

test('no deprecated contentDetails.startAt / endAt authority', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /startAt|endAt|start_seconds|end_seconds|startSeconds|endSeconds/);
});

test('no embeddability/region inference from privacyStatus', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /embeddable|regionRestriction|region_restriction/i);
});

test('thumbnail policy: provider URL used, null allowed, no multi-host retry chain', () => {
  const source = readModuleSource();
  assert.match(source, /_pick_thumbnail/);
  assert.match(source, /thumbnails/);
  assert.match(source, /thumbnailUrl/);
  assert.doesNotMatch(source, /img\.youtube\.com.*i\.ytimg\.com/i);
});

test('app.py endpoint requires verified auth BEFORE any provider call', () => {
  const appSource = readAppSource();
  const endpointBlock = sliceBetween(
    appSource,
    /def post_youtube_playlist_preview/,
    /# ── Public \(guest-safe\) moment social read endpoints ──/
  );
  // require_firebase_user appears before parse/resolve_provider/app providers.
  const authIndex = endpointBlock.indexOf('require_firebase_user(authorization)');
  const apiKeyIndex = endpointBlock.indexOf('resolve_provider_api_key()');
  const metadataIndex = endpointBlock.indexOf('fetch_playlist_metadata');
  assert.notEqual(authIndex, -1, 'endpoint must call require_firebase_user');
  assert.notEqual(apiKeyIndex, -1, 'endpoint must resolve provider key');
  assert.notEqual(metadataIndex, -1, 'endpoint must fetch playlist metadata');
  assert.ok(authIndex < apiKeyIndex, 'auth must run before provider key resolution');
  assert.ok(authIndex < metadataIndex, 'auth must run before any provider call');
});

test('app.py registers PlaylistPreviewError as bounded envelope', () => {
  const appSource = readAppSource();
  assert.match(appSource, /playlist_preview_error_handler/);
  assert.match(appSource, /"ok":\s*False/);
  assert.match(appSource, /"code":\s*exc\.code/);
});

test('app.py binds the Modal provider secret the same way as existing secrets', () => {
  const appSource = readAppSource();
  assert.match(appSource, /modal\.Secret\.from_name\("lovebud-youtube-data-api"\)/);
  assert.match(appSource, /modal\.Secret\.from_name\("lovebud-db"\)/);
  assert.match(appSource, /modal\.Secret\.from_name\("lovebud-firebase-admin"\)/);
});

test('preview endpoint performs zero Tree/Moment/Connection/DB writes', () => {
  const appSource = readAppSource();
  const endpoint = sliceBetween(
    appSource,
    /async def post_youtube_playlist_preview/,
    /# ── Public \(guest-safe\) moment social read endpoints ──/
  );
  assert.doesNotMatch(endpoint, /create_owner_tree|create_owner_memory|fork_public_tree/);
  assert.doesNotMatch(endpoint, /save|insert|UPDATE|mutation|create_owner/i);
});

test('privacy: no raw token/key/user content logging in the provider', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /print\(.*(token|api_key|title|description|playlist)/i);
});

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `missing start pattern ${startPattern}`);
  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `missing end pattern ${endPattern}`);
  return afterStart.slice(0, end);
}