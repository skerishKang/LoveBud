/**
 * Provider contract test for the authenticated YouTube playlist preview
 * (modal_compute/youtube_playlist_preview.py and app.py endpoint) — Issue #3914.
 *
 * Two evidence layers:
 *
 * 1. Static source assertions on the Modal side:
 *    - verified auth (require_firebase_user) happens BEFORE any provider call
 *    - fixed official YouTube Data API endpoints only (no arbitrary fetch)
 *    - provider ceilings: 1 playlists.list + 1 playlistItems.list = 2,
 *      page size 50, item ceiling 50, max 1 page, no retry, no videos.list
 *    - canonical item-state vocabulary only (no stale AVAILABLE/UNAVAILABLE)
 *    - auth failures normalized into the Scout envelope (UNAUTHORIZED)
 *    - provider key is a Modal-side secret (lovebud-youtube-data-api)
 *    - no Tree/Moment/Connection/DB write
 *
 * 2. EXECUTED_FAKE Python driver: the real provider module is imported in a
 *    local `python3` subprocess with the network layer monkeypatched (fake
 *    opener / fake provider responses). No network, no DB, no Production.
 *    Covers parser acceptance/rejection, item-state derivation, unsupported-400
 *    normalization, not-found/quota/timeout normalization, malformed nested
 *    provider evidence -> bounded INTERNAL_PREVIEW_ERROR, provider call
 *    ceiling = 2 with zero retry, source-order preservation, unavailable items
 *    kept, and canonical response shape.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_FILE = path.join(ROOT, 'modal_compute/youtube_playlist_preview.py');
const APP_FILE = path.join(ROOT, 'modal_compute/app.py');

function readModuleSource() {
  return fs.readFileSync(MODULE_FILE, 'utf8');
}

function readAppSource() {
  return fs.readFileSync(APP_FILE, 'utf8');
}

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `missing start pattern ${startPattern}`);
  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `missing end pattern ${endPattern}`);
  return afterStart.slice(0, end);
}

// ── Static Modal boundary assertions ─────────────────────────────────────────

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
  assert.doesNotMatch(source, /urlopen\(\s*(source|value)/);
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
});

test('no automatic retry, no second page, no videos.list', () => {
  const source = readModuleSource();
  assert.doesNotMatch(source, /for\s+attempt|while\s+attempt|retry\s*\(|max_retries|maxRetries/);
  assert.doesNotMatch(source, /youtube\/v3\/videos/);
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

test('unexpected privacy status maps to UNKNOWN and missing thumbnail to METADATA_PARTIAL', () => {
  const source = readModuleSource();
  const fn = sliceBetween(source, /def _derive_item_state/, /def _pick_thumbnail/);
  assert.match(fn, /not in PUBLIC_PRIVACY_STATUSES/);
  assert.match(fn, /return "UNKNOWN"/);
  assert.match(fn, /has_thumbnail/);
  assert.match(fn, /return "METADATA_PARTIAL"/);
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
  const authIndex = endpointBlock.indexOf('require_firebase_user(authorization)');
  const apiKeyIndex = endpointBlock.indexOf('resolve_provider_api_key()');
  const metadataIndex = endpointBlock.indexOf('fetch_playlist_metadata');
  assert.notEqual(authIndex, -1, 'endpoint must call require_firebase_user');
  assert.notEqual(apiKeyIndex, -1, 'endpoint must resolve provider key');
  assert.notEqual(metadataIndex, -1, 'endpoint must fetch playlist metadata');
  assert.ok(authIndex < apiKeyIndex, 'auth must run before provider key resolution');
  assert.ok(authIndex < metadataIndex, 'auth must run before any provider call');
});

test('app.py normalizes auth failures into the bounded UNAUTHORIZED envelope', () => {
  const appSource = readAppSource();
  const endpointBlock = sliceBetween(
    appSource,
    /def post_youtube_playlist_preview/,
    /# ── Public \(guest-safe\) moment social read endpoints ──/
  );
  assert.match(endpointBlock, /"UNAUTHORIZED"/);
  assert.match(endpointBlock, /except HTTPException as error:/);
  assert.match(endpointBlock, /except RuntimeError as error:/);
});

test('app.py preserves the HTTP 503 dependency-outage taxonomy (never collapses to 401)', () => {
  const appSource = readAppSource();
  const endpointBlock = sliceBetween(
    appSource,
    /def post_youtube_playlist_preview/,
    /# ── Public \(guest-safe\) moment social read endpoints ──/
  );
  // #3972 raises HTTPException(503) on trusted Firebase cert dependency
  // outage; the route must preserve 503 with a safe message.
  assert.match(endpointBlock, /error\.status_code >= 500/);
  assert.match(endpointBlock, /status_code=503/);
  assert.match(endpointBlock, /status_code=401/);
  assert.match(endpointBlock, /Authentication service is temporarily unavailable/);
  // Raw auth detail must never be forwarded verbatim.
  assert.doesNotMatch(endpointBlock, /error\.detail/);
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

// ── EXECUTED_FAKE Python driver ──────────────────────────────────────────────

const DRIVER_SOURCE = `
import importlib.util
import io
import json
import sys
import urllib.error

spec = importlib.util.spec_from_file_location("ypp", "modal_compute/youtube_playlist_preview.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

results = []


def check(name, cond):
    results.append((name, bool(cond)))
    if not cond:
        print("FAIL " + name)


def expect_error(name, fn, code, status=None):
    try:
        fn()
        check(name, False)
    except mod.PlaylistPreviewError as exc:
        ok = exc.code == code and (status is None or exc.status_code == status)
        check(name, ok)
    except Exception:
        check(name, False)


# 1. accepted playlist URL / bare ID normalization
try:
    pid = mod.parse_playlist_source("https://www.youtube.com/playlist?list=PLAbCdEfGhIjKlMnOp")
    check("url_normalized", pid == "PLAbCdEfGhIjKlMnOp")
except Exception:
    check("url_normalized", False)
try:
    pid = mod.parse_playlist_source("  https://m.youtube.com/playlist?list=PLAbCdEfGhIjKlMnOp  ")
    check("url_whitespace_normalized", pid == "PLAbCdEfGhIjKlMnOp")
except Exception:
    check("url_whitespace_normalized", False)
try:
    pid = mod.parse_playlist_source("PLAbCdEfGhIjKlMnOp")
    check("bare_normalized", pid == "PLAbCdEfGhIjKlMnOp")
except Exception:
    check("bare_normalized", False)

# 2. rejected schemes/hosts/arbitrary URLs
reject_cases = [
    ("http://www.youtube.com/playlist?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://music.youtube.com/playlist?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://youtu.be/dQw4w9WgXcQ?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("file:///etc/passwd", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("ftp://youtube.com/playlist?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("javascript:alert(1)", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("data:text/html,hi", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://evil.example.com/playlist?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("https://localhost/playlist?list=PLAbCdEfGhIjKlMnOp", "UNSUPPORTED_PLAYLIST_SOURCE"),
    ("PLbad!", "INVALID_PLAYLIST_SOURCE"),
    ("", "INVALID_PLAYLIST_SOURCE"),
    ("   ", "INVALID_PLAYLIST_SOURCE"),
]
for i, (src, expected_code) in enumerate(reject_cases):
    expect_error("reject_%d" % i, (lambda s=src: mod.parse_playlist_source(s)), expected_code)
expect_error("reject_nonstring", (lambda: mod.parse_playlist_source(12345)), "INVALID_PLAYLIST_SOURCE")

# 3. item-state derivation (canonical states only)
state_cases = [
    (("Private video", "public", "abc", True), "PRIVATE_OR_UNAVAILABLE"),
    (("Deleted video", "public", "abc", True), "PRIVATE_OR_UNAVAILABLE"),
    (("Title", "private", "abc", True), "PRIVATE_OR_UNAVAILABLE"),
    (("Title", "public", "", True), "METADATA_PARTIAL"),
    (("Title", "", "abc", True), "UNKNOWN"),
    (("Title", "weird", "abc", True), "UNKNOWN"),
    (("Title", "public", "abc", False), "METADATA_PARTIAL"),
    (("Title", "unlisted", "abc", True), "AVAILABLE_METADATA"),
    (("Title", "public", "abc", True), "AVAILABLE_METADATA"),
]
for i, (args, expected) in enumerate(state_cases):
    check("state_%d" % i, mod._derive_item_state(*args) == expected)

# 4. unsupported-400 normalization (playlistOperationUnsupported as invalidValue 400)
class Fake400UnsupportedOpener:
    def open(self, url, timeout=None):
        raise urllib.error.HTTPError(
            url, 400, "Bad Request", {},
            io.BytesIO(b'{"error":{"errors":[{"reason":"playlistOperationUnsupported"}]}}'),
        )


mod._build_opener = lambda: Fake400UnsupportedOpener()
expect_error(
    "unsupported_400",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlistItems?x=1"),
    "PLAYLIST_UNSUPPORTED",
    400,
)


# 5. not-found (404) and quota (403 / 429) and inaccessible (403) normalization
class Fake404Opener:
    def open(self, url, timeout=None):
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, io.BytesIO(b'{"error":{"errors":[{"reason":"playlistNotFound"}]}}'))


mod._build_opener = lambda: Fake404Opener()
expect_error(
    "not_found_404",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlists?x=1"),
    "PLAYLIST_NOT_FOUND",
    404,
)


class FakeQuotaOpener:
    def open(self, url, timeout=None):
        raise urllib.error.HTTPError(url, 403, "Forbidden", {}, io.BytesIO(b'{"error":{"errors":[{"reason":"quotaExceeded"}]}}'))


mod._build_opener = lambda: FakeQuotaOpener()
expect_error(
    "quota_403",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlists?x=1"),
    "PROVIDER_QUOTA_EXCEEDED",
    429,
)


class Fake429Opener:
    def open(self, url, timeout=None):
        raise urllib.error.HTTPError(url, 429, "Too Many Requests", {}, io.BytesIO(b'{}'))


mod._build_opener = lambda: Fake429Opener()
expect_error(
    "quota_429",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlists?x=1"),
    "PROVIDER_QUOTA_EXCEEDED",
    429,
)


class FakeInaccessibleOpener:
    def open(self, url, timeout=None):
        raise urllib.error.HTTPError(url, 403, "Forbidden", {}, io.BytesIO(b'{"error":{"errors":[{"reason":"playlistItemsNotAccessible"}]}}'))


mod._build_opener = lambda: FakeInaccessibleOpener()
expect_error(
    "inaccessible_403",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlistItems?x=1"),
    "PLAYLIST_NOT_ACCESSIBLE",
    403,
)


# 6. timeout normalization
class FakeTimeoutOpener:
    def open(self, url, timeout=None):
        raise urllib.error.URLError(TimeoutError("timed out"))


mod._build_opener = lambda: FakeTimeoutOpener()
expect_error(
    "timeout_normalized",
    lambda: mod._provider_get_json("https://www.googleapis.com/youtube/v3/playlists?x=1"),
    "PROVIDER_TIMEOUT",
    504,
)

# 7. malformed nested provider evidence -> bounded INTERNAL_PREVIEW_ERROR
expect_error(
    "malformed_item",
    lambda: mod._normalize_playlist_item("not-a-dict"),
    "INTERNAL_PREVIEW_ERROR",
    500,
)
expect_error(
    "malformed_snippet",
    lambda: mod._normalize_playlist_item({"snippet": "bad", "contentDetails": {}, "status": {}}),
    "INTERNAL_PREVIEW_ERROR",
    500,
)
expect_error(
    "malformed_content_details",
    lambda: mod._normalize_playlist_item({"snippet": {}, "contentDetails": None, "status": {}}),
    "INTERNAL_PREVIEW_ERROR",
    500,
)


# 8. provider call ceiling = 2, zero retry, source order preserved, unavailable kept
calls = []


def fake_provider(url, **kwargs):
    calls.append(str(url))
    if "/playlists" in str(url):
        return {
            "items": [
                {"id": "PL1", "snippet": {"title": "T", "channelTitle": "C"}, "contentDetails": {"itemCount": 3}}
            ]
        }
    return {
        "items": [
            {
                "snippet": {"position": 0, "title": "First", "channelTitle": "C", "thumbnails": {"medium": {"url": "https://i.ytimg.com/a.jpg"}}},
                "contentDetails": {"videoId": "v1"},
                "status": {"privacyStatus": "public"},
            },
            {
                "snippet": {"position": 1, "title": "Private video", "channelTitle": "C"},
                "contentDetails": {"videoId": "v2"},
                "status": {"privacyStatus": "private"},
            },
            {
                "snippet": {"position": 2, "title": "Third", "channelTitle": "C", "thumbnails": {"medium": {"url": "https://i.ytimg.com/c.jpg"}}},
                "contentDetails": {"videoId": "v3"},
                "status": {"privacyStatus": "unlisted"},
            },
        ],
        "pageInfo": {"totalResults": 3},
    }


mod._provider_get_json = fake_provider
meta = mod.fetch_playlist_metadata("PL1", "test-key")
items_result = mod.fetch_playlist_items("PL1", "test-key")
check("call_ceiling_2", len(calls) == 2)
check("no_retry_single_page", len(calls) == 2)
check("order_preserved", [i["position"] for i in items_result["items"]] == [0, 1, 2])
check("unavailable_not_dropped", any(i["state"] == "PRIVATE_OR_UNAVAILABLE" for i in items_result["items"]))
check("item_count_bounded", len(items_result["items"]) <= 50)

resp = mod.normalize_playlist_preview(meta, items_result)
check("canonical_states_only", {i["state"] for i in resp["items"]} <= mod.CANONICAL_ITEM_STATES)
check("no_semantic_fields", not any(k in resp for k in ("parentId", "connectionId", "relationship")))
check("ok_true", resp["ok"] is True)
check("previewed_items", resp["previewedItems"] == 3)

# 9. item ceiling 50 even when provider returns more
many_items = [
    {
        "snippet": {"position": idx, "title": "T%d" % idx, "channelTitle": "C", "thumbnails": {"medium": {"url": "https://i.ytimg.com/x.jpg"}}},
        "contentDetails": {"videoId": "v%d" % idx},
        "status": {"privacyStatus": "public"},
    }
    for idx in range(60)
]


def fake_many(url, **kwargs):
    if "/playlists" in str(url):
        return {"items": [{"id": "PL1", "snippet": {"title": "T", "channelTitle": "C"}, "contentDetails": {"itemCount": 60}}]}
    return {"items": many_items, "pageInfo": {"totalResults": 60}, "nextPageToken": "CAEQAA"}


mod._provider_get_json = fake_many
many_items_result = mod.fetch_playlist_items("PL1", "test-key")
check("ceiling_50", len(many_items_result["items"]) == 50)
many_resp = mod.normalize_playlist_preview(mod.fetch_playlist_metadata("PL1", "test-key"), many_items_result)
check("truncated_flag", many_resp["truncated"] is True)

print("RESULTS " + json.dumps(results))
if not all(r for _, r in results):
    sys.exit(1)
print("DRIVER_OK")
`;

// #4185 — deterministic Python launcher selection for the EXECUTED_FAKE
// driver. Linux/CI keeps the python3 authority unchanged. Windows-native
// hosts usually have no `python3` on PATH (only `python` or the `py`
// launcher), so we probe candidates with spawnSync('-c', ...) and use the
// first one that actually runs Python 3. No new dependency, no skip, no
// bypass: whichever launcher wins still executes the same real driver.
function resolvePythonLauncher() {
  const probe = (cmd, args) => {
    const r = spawnSync(cmd, args.concat(['-c', 'import sys; print("%d.%d" % sys.version_info[:2])']), {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    if (r.error || r.status !== 0) return null;
    return /^3\.\d+/m.test(String(r.stdout || '')) ? { cmd, args } : null;
  };
  if (process.platform === 'win32') {
    // Windows order: plain `python` first, then the `py` launcher pinned to 3.
    for (const candidate of [
      { cmd: 'python', args: [] },
      { cmd: 'py', args: ['-3'] },
    ]) {
      const usable = probe(candidate.cmd, candidate.args);
      if (usable) return usable;
    }
  } else {
    const usable = probe('python3', []);
    if (usable) return usable;
  }
  return null;
}

test('executed python driver: parser, states, error normalization, ceilings, ordering, no writes', () => {
  const launcher = resolvePythonLauncher();
  assert.ok(launcher, `no usable Python 3 launcher found on ${process.platform} for EXECUTED_FAKE evidence`);
  const driverPath = path.join(os.tmpdir(), `ypp-driver-3914-${process.pid}.py`);
  fs.writeFileSync(driverPath, DRIVER_SOURCE, 'utf8');
  try {
    const result = spawnSync(launcher.cmd, launcher.args.concat([driverPath]), {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
    });
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    assert.equal(
      result.status,
      0,
      `python driver must exit 0\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
    assert.ok(stdout.includes('DRIVER_OK'), 'driver must complete all checks');
    const match = stdout.match(/RESULTS\s+(\[.*\])/s);
    assert.ok(match, 'driver must emit RESULTS JSON');
    const checks = JSON.parse(match[1]);
    const failed = checks.filter((entry) => entry[1] !== true);
    assert.deepEqual(failed, [], `all driver checks must pass; failed: ${JSON.stringify(failed)}`);
  } finally {
    try {
      fs.unlinkSync(driverPath);
    } catch (e) {
      // best-effort temp cleanup
    }
  }
});
