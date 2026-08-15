const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const treeViews = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_views.py'), 'utf8');
const cloudflareRoutePath = path.join(ROOT, 'functions', 'api', 'trees', '[tree_id]', 'views.js');
const cloudflareRoute = fs.readFileSync(cloudflareRoutePath, 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');

const TREE_VIEW_URL = 'https://lovebud.pages.dev/api/trees/tree-A/views';
const TREE_VIEW_SECRET = 'test-tree-view-authority-secret-3917';
const TREE_VIEW_ENV = {
  MODAL_BASE_URL: 'https://modal.lovebud.internal',
  TREE_VIEW_AUTHORITY_SECRET: TREE_VIEW_SECRET,
};

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

async function loadCloudflareTreeViewRoute() {
  return import(pathToFileURL(cloudflareRoutePath).href);
}

function makeTreeViewRequest({ method = 'POST', headers = {}, body } = {}) {
  const init = { method, headers };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    init.body = body;
  }
  return new Request(TREE_VIEW_URL, init);
}

async function withCapturedModalFetch(fn) {
  const originalFetch = globalThis.fetch;
  const captured = [];
  globalThis.fetch = async (url, options) => {
    captured.push({ url: String(url), options });
    return new Response('{"counted":true,"viewCount":1}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await fn(captured);
    return { result, captured };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('Modal app verifies signed edge assertion before counting public tree views', () => {
  assert.match(modalApp, /from\s+modal_compute\.tree_views\s+import\s+record_public_tree_view/);
  assert.match(modalApp, /from\s+modal_compute\.tree_view_authority\s+import\s+\(?\s*TreeViewAuthorityError,\s*verify_tree_view_assertion\s*\)?/);
  assert.match(modalApp, /@web_app\.post\("\/modal\/public\/trees\/\{tree_id\}\/views"\)/);
  assert.match(modalApp, /async\s+def\s+post_public_tree_view\(/);
  assert.match(modalApp, /verify_tree_view_assertion\(request\.headers,\s*tree_id\)/);
  assert.match(modalApp, /authority\["actor_key"\]/);
  assert.match(modalApp, /authority\["actor_kind"\]/);
  assert.match(modalApp, /authority\["source"\]/);
  assert.match(modalApp, /TREE_VIEW_AUTHORITY_REJECTED/);
  assert.doesNotMatch(modalApp, /payload\.get\("actorKey"/);
  assert.doesNotMatch(modalApp, /CF-Connecting-IP/i);
  assert.doesNotMatch(treeViews, /CF-Connecting-IP/i);
  assert.doesNotMatch(modalApp, /@web_app\.get\("\/modal\/public\/trees\/\{tree_id\}\/views"\)/);
});

test('tree view repository writes only privacy-scoped dedup and aggregate view count', () => {
  assert.match(treeViews, /def\s+record_public_tree_view\(/);
  assert.match(treeViews, /tree_view_dedup_events/);
  assert.match(treeViews, /tree_social_counts/);
  assert.match(treeViews, /ON\s+CONFLICT\s+\(tree_id,\s*actor_key,\s*counted_window_start\)\s+DO\s+NOTHING/i);
  assert.match(treeViews, /SET\s+view_count\s*=\s*view_count\s*\+\s*1/i);
  assert.match(treeViews, /"counted"/);
  assert.match(treeViews, /"viewCount"/);
  assert.doesNotMatch(treeViews, /raw_ip/i);
  assert.doesNotMatch(treeViews, /user_agent/i);
  assert.doesNotMatch(treeViews, /fingerprint/i);
  assert.doesNotMatch(treeViews, /referrer/i);
  assert.doesNotMatch(treeViews, /request_headers/i);
});

test('tree view repository enforces public tree boundary and allowed sources', () => {
  const normalized = compact(treeViews);
  assert.match(treeViews, /visibility\s*=\s*'public'/);
  assert.match(treeViews, /is_public\s*=\s+%s/);
  assert.match(treeViews, /HTTPException\(status_code=404,\s*detail="Tree not found"\)/);
  assert.match(treeViews, /_ALLOWED_VIEW_SOURCES\s*=\s*\{"public_tree_detail",\s*"public_tree_card_open"\}/);
  assert.match(treeViews, /_ALLOWED_ACTOR_KINDS\s*=\s*\{"authenticated",\s*"anonymous"\}/);
  assert.match(normalized, /ifnormalizednotin_allowed_view_sources/);
  assert.match(normalized, /ifnormalizednotin_allowed_actor_kinds/);
});

test('Cloudflare tree view route preserves bounded stream enforcement and forwards only signed edge authority', () => {
  assert.match(cloudflareRoute, /export\s+async\s+function\s+onRequestPost/);
  assert.match(cloudflareRoute, /method\s*!==\s*'POST'/);
  assert.match(cloudflareRoute, /allow:\s*'POST'/);
  assert.match(cloudflareRoute, /\/modal\/public\/trees\/\$\{encodeURIComponent\(decodeURIComponent\(treeId\)\)\}\/views/);

  // #3920 resource boundary remains authoritative even though accepted body
  // bytes are discarded instead of forwarded.
  assert.match(cloudflareRoute, /bounded-request-body\.js/);
  assert.match(cloudflareRoute, /await\s+readBoundedRequestBody\(request\)/);
  assert.match(cloudflareRoute, /payload-too-large/);
  assert.match(cloudflareRoute, /body-read-failed/);

  // #3917 identity authority: derived from trusted edge context, signed, and
  // forwarded as headers only. Client actor bytes never reach Modal.
  assert.match(cloudflareRoute, /TREE_VIEW_AUTHORITY_SECRET/);
  assert.match(cloudflareRoute, /CF-Connecting-IP/);
  assert.match(cloudflareRoute, /x-lovebud-tree-view-signature/);
  assert.match(cloudflareRoute, /buildSignedAssertionHeaders/);
  assert.match(cloudflareRoute, /deriveEdgeActorKey/);
  assert.doesNotMatch(cloudflareRoute, /body:\s*(?:request\.body|bodyResult\.body)/);
  assert.doesNotMatch(cloudflareRoute, /parse_json_body/);
  assert.match(cloudflareRoute, /view-authority-unavailable/);
  assert.doesNotMatch(cloudflareRoute, /Authorization required/);
  assert.doesNotMatch(cloudflareRoute, /\/modal\/browse\/latest/);
  assert.doesNotMatch(cloudflareRoute, /sort=views/);
});

test('runtime: client actor identity is discarded and signed edge assertion is valid', async () => {
  const mod = await loadCloudflareTreeViewRoute();
  const request = makeTreeViewRequest({
    headers: {
      'content-type': 'application/json',
      'CF-Connecting-IP': '203.0.113.7',
    },
    body: JSON.stringify({ actorKey: 'client-forged', actorKind: 'authenticated' }),
  });
  const { result, captured } = await withCapturedModalFetch(() =>
    mod.onRequestPost({ request, env: TREE_VIEW_ENV }));

  assert.equal(result.status, 200);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].options.body, undefined, 'accepted client bytes are never forwarded');
  const headers = captured[0].options.headers;
  assert.equal(headers['x-lovebud-tree-view-tree-id'], 'tree-A');
  assert.equal(headers['x-lovebud-tree-view-actor-kind'], 'anonymous');
  assert.notEqual(headers['x-lovebud-tree-view-actor-key'], 'client-forged');
  assert.match(headers['x-lovebud-tree-view-actor-key'], /^[a-f0-9]{64}$/);
  assert.match(headers['x-lovebud-tree-view-signature'], /^[a-f0-9]{64}$/);
  const expectedSignature = await mod.signAssertion(
    TREE_VIEW_SECRET,
    'tree-A',
    headers['x-lovebud-tree-view-actor-key'],
    'anonymous',
    'public_tree_detail',
    headers['x-lovebud-tree-view-counted-window']
  );
  assert.equal(headers['x-lovebud-tree-view-signature'], expectedSignature);
});

test('runtime: 100 rotated client actorKeys collapse to one authoritative edge actor per IP/day', async () => {
  const mod = await loadCloudflareTreeViewRoute();
  const actorKeys = new Set();
  const signatures = new Set();
  const { captured } = await withCapturedModalFetch(async () => {
    for (let i = 0; i < 100; i++) {
      const request = makeTreeViewRequest({
        headers: {
          'content-type': 'application/json',
          'CF-Connecting-IP': '198.51.100.23',
        },
        body: JSON.stringify({ actorKey: `attacker-${i}`, actorKind: 'authenticated' }),
      });
      const response = await mod.onRequestPost({ request, env: TREE_VIEW_ENV });
      assert.equal(response.status, 200);
    }
  });

  assert.equal(captured.length, 100);
  for (const call of captured) {
    assert.equal(call.options.body, undefined);
    actorKeys.add(call.options.headers['x-lovebud-tree-view-actor-key']);
    signatures.add(call.options.headers['x-lovebud-tree-view-signature']);
  }
  assert.equal(actorKeys.size, 1, 'same trusted IP/day must map to one edge actor');
  assert.equal(signatures.size, 1, 'same canonical assertion must produce one signature');
});

test('runtime: missing authority secret or trusted edge IP fails closed before Modal', async () => {
  const mod = await loadCloudflareTreeViewRoute();

  for (const fixture of [
    {
      name: 'missing secret',
      request: makeTreeViewRequest({ headers: { 'CF-Connecting-IP': '198.51.100.23' } }),
      env: { MODAL_BASE_URL: 'https://modal.lovebud.internal' },
    },
    {
      name: 'missing trusted edge IP',
      request: makeTreeViewRequest(),
      env: TREE_VIEW_ENV,
    },
  ]) {
    const { result, captured } = await withCapturedModalFetch(() =>
      mod.onRequestPost({ request: fixture.request, env: fixture.env }));
    assert.equal(result.status, 503, fixture.name);
    assert.equal(result.headers.get('x-lovebud-route-status'), 'view-authority-unavailable', fixture.name);
    assert.equal(captured.length, 0, `${fixture.name} must not call Modal`);
  }
});

test('runtime: raw client IP never appears in forwarded assertion headers', async () => {
  const mod = await loadCloudflareTreeViewRoute();
  const rawIp = '203.0.113.44';
  const request = makeTreeViewRequest({ headers: { 'CF-Connecting-IP': rawIp } });
  const { captured } = await withCapturedModalFetch(() =>
    mod.onRequestPost({ request, env: TREE_VIEW_ENV }));
  assert.equal(captured.length, 1);
  const serialized = JSON.stringify(captured[0].options.headers);
  assert.doesNotMatch(serialized, new RegExp(rawIp.replace(/\./g, '\\.')));
  assert.notEqual(captured[0].options.headers['x-lovebud-tree-view-actor-key'], rawIp);
});

test('runtime: native Request retains prototype-backed headers and non-POST is rejected without Modal', async () => {
  const mod = await loadCloudflareTreeViewRoute();
  const nativeRequest = makeTreeViewRequest({ headers: { 'CF-Connecting-IP': '203.0.113.7' } });
  assert.deepEqual(Object.keys(nativeRequest), [], 'native Request has no enumerable request fields');
  const ok = await withCapturedModalFetch(() =>
    mod.onRequestPost({ request: nativeRequest, env: TREE_VIEW_ENV }));
  assert.equal(ok.result.status, 200);
  assert.equal(ok.captured.length, 1);
  assert.equal(ok.captured[0].options.headers['x-lovebud-tree-view-actor-kind'], 'anonymous');

  const getRequest = makeTreeViewRequest({
    method: 'GET',
    headers: { 'CF-Connecting-IP': '203.0.113.7' },
  });
  const denied = await withCapturedModalFetch(() =>
    mod.onRequestPost({ request: getRequest, env: TREE_VIEW_ENV }));
  assert.equal(denied.result.status, 405);
  assert.equal(denied.captured.length, 0);
});

test('Unit B2 still does not enable sort=views or public Browse viewCount payload (sort=likes is now supported as Unit C)', () => {
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
  assert.doesNotMatch(browseSnapshot, /"viewCount"/);
});
