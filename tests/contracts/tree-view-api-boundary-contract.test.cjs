const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const treeViews = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_views.py'), 'utf8');
const cloudflareRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'trees', '[tree_id]', 'views.js'), 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
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
  // The browser sends no actor identity; only the signed edge assertion is used.
  assert.doesNotMatch(modalApp, /payload\.get\("actorKey"/);
  // Modal never reads the raw client IP; the actor is an opaque signed digest.
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

test('Cloudflare tree view route proxies POST only and forwards a signed edge assertion (no client actor authority)', () => {
  assert.match(cloudflareRoute, /export\s+async\s+function\s+onRequestPost/);
  assert.match(cloudflareRoute, /method\s*!==\s*'POST'/);
  assert.match(cloudflareRoute, /allow:\s*'POST'/);
  assert.match(cloudflareRoute, /\/modal\/public\/trees\/\$\{encodeURIComponent\(decodeURIComponent\(treeId\)\)\}\/views/);
  // Edge authority: derived from trusted context, signed, and forwarded as
  // headers. No client actor identity is ever trusted or forwarded as a body.
  assert.match(cloudflareRoute, /TREE_VIEW_AUTHORITY_SECRET/);
  assert.match(cloudflareRoute, /CF-Connecting-IP/);
  assert.match(cloudflareRoute, /x-lovebud-tree-view-signature/);
  assert.match(cloudflareRoute, /buildSignedAssertionHeaders/);
  assert.match(cloudflareRoute, /deriveEdgeActorKey/);
  assert.doesNotMatch(cloudflareRoute, /body:\s*request\.body/);
  assert.doesNotMatch(cloudflareRoute, /parse_json_body/);
  // Fail-closed when the authority context is missing (no Modal call, no count).
  assert.match(cloudflareRoute, /view-authority-unavailable/);
  assert.doesNotMatch(cloudflareRoute, /Authorization required/);
  assert.doesNotMatch(cloudflareRoute, /\/modal\/browse\/latest/);
  assert.doesNotMatch(cloudflareRoute, /sort=views/);
});

test('Unit B2 still does not enable sort=views or public Browse viewCount payload (sort=likes is now supported as Unit C)', () => {
  // sort=views still forbidden (Unit B policy boundary)
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);
  // sort=likes is now supported (Unit C runtime slice, multiline ternary)
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
  // viewCount still forbidden in Browse summary (Unit B policy boundary)
  assert.doesNotMatch(browseSnapshot, /"viewCount"/);
});
