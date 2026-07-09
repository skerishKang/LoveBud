const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const modalApp = fs.readFileSync(path.join(ROOT, 'modal_compute', 'app.py'), 'utf8');
const treeLikes = fs.readFileSync(path.join(ROOT, 'modal_compute', 'tree_likes.py'), 'utf8');
const cloudflareRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'trees', '[tree_id]', 'likes.js'), 'utf8');
const catchAllRoute = fs.readFileSync(path.join(ROOT, 'functions', 'api', '[[path]].js'), 'utf8');
const browseSnapshot = fs.readFileSync(path.join(ROOT, 'modal_compute', 'browse_latest.py'), 'utf8');

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

test('Modal app exposes authenticated tree like summary and toggle routes', () => {
  assert.match(modalApp, /from\s+modal_compute\.tree_likes\s+import\s*\([\s\S]*toggle_tree_like[\s\S]*fetch_tree_like_summary[\s\S]*\)/);
  assert.match(modalApp, /@web_app\.post\("\/modal\/private\/trees\/\{tree_id\}\/likes"\)/);
  assert.match(modalApp, /def\s+post_tree_like\(/);
  assert.match(modalApp, /user\s*=\s*require_firebase_user\(authorization\)/);
  assert.match(modalApp, /return\s+toggle_tree_like\(tree_id,\s*user\["uid"\](,\s*idempotency_key=[^)]*)?\)/);
  assert.match(modalApp, /@web_app\.get\("\/modal\/private\/trees\/\{tree_id\}\/likes"\)/);
  assert.match(modalApp, /def\s+get_tree_likes\(/);
  assert.match(modalApp, /return\s+fetch_tree_like_summary\(tree_id,\s*user\["uid"\]\)/);
});

test('tree_likes repository keeps tree likes separate from memory reactions', () => {
  assert.match(treeLikes, /FROM\s+tree_likes/i);
  assert.match(treeLikes, /tree_social_counts/i);
  assert.doesNotMatch(treeLikes, /FROM\s+reactions/i);
  assert.doesNotMatch(treeLikes, /memory_id/i);
});

test('tree like repository allows only public tree boundary and hides private trees as not found', () => {
  const normalized = compact(treeLikes);
  assert.match(normalized, /selectid,visibilityfromtreeswhereid=%slimit1/);
  assert.match(normalized, /visibility.*public/);
  assert.match(normalized, /httpexception\(status_code=404,detail="treenotfound"\)/);
});

test('tree like toggle updates active row and aggregate count safely', () => {
  assert.match(treeLikes, /WHERE\s+tree_id\s+=\s+%s[\s\S]*AND\s+owner_id\s+=\s+%s[\s\S]*AND\s+deleted_at\s+IS\s+NULL/i);
  assert.match(treeLikes, /SET\s+deleted_at\s+=\s+NOW\(\)/i);
  assert.match(treeLikes, /GREATEST\(like_count\s+-\s+1,\s+0\)/i);
  assert.match(treeLikes, /SET\s+like_count\s+=\s+like_count\s+\+\s+1/i);
  assert.match(treeLikes, /"active"/);
  assert.match(treeLikes, /"likeCount"/);
});

test('public tree detail can read likeCount without enabling Browse counts or sort', () => {
  const publicLikeCountFunction = treeLikes.match(/def\s+fetch_public_tree_like_count[\s\S]*?return\s+int\(result\.get\("like_count"\)\s+or\s+0\)/)[0];
  assert.match(modalApp, /fetch_public_tree_like_count/);
  assert.match(modalApp, /@web_app\.get\("\/modal\/trees\/\{tree_id\}"\)/);
  assert.match(modalApp, /tree\["likeCount"\]\s*=\s*fetch_public_tree_like_count\(safe_tree_id\)/);
  assert.match(publicLikeCountFunction, /def\s+fetch_public_tree_like_count\(tree_id:\s*str\)\s*->\s*int:/);
  assert.match(publicLikeCountFunction, /FROM\s+tree_social_counts[\s\S]*WHERE\s+tree_id\s+=\s+%s/i);
  assert.match(publicLikeCountFunction, /return\s+\{"like_count":\s*0\}/);
  assert.doesNotMatch(publicLikeCountFunction, /_ensure_tree_social_counts/);
});

test('public like count read remains tree-level public-only read data', () => {
  const publicLikeReadSurface = treeLikes.match(/def\s+_fetch_public_tree_for_like_count[\s\S]*?return\s+int\(result\.get\("like_count"\)\s+or\s+0\)/)[0];
  assert.match(publicLikeReadSurface, /FROM\s+trees/i);
  assert.match(publicLikeReadSurface, /visibility\s*=\s*'public'/i);
  assert.match(publicLikeReadSurface, /is_public\s*=\s+%s/i);
  assert.match(publicLikeReadSurface, /_fetch_public_tree_for_like_count\(cur,\s*tree_id\)/);
  assert.match(publicLikeReadSurface, /HTTPException\(status_code=404,\s*detail="Tree not found"\)/);
  assert.match(publicLikeReadSurface, /FROM\s+tree_social_counts/i);
  assert.doesNotMatch(publicLikeReadSurface, /owner_id/i);
  assert.doesNotMatch(publicLikeReadSurface, /active/);
  assert.doesNotMatch(publicLikeReadSurface, /FROM\s+reactions/i);
});

test('Cloudflare tree like route proxies only authenticated GET and POST to Modal private route', () => {
  assert.match(cloudflareRoute, /export\s+async\s+function\s+onRequestGet/);
  assert.match(cloudflareRoute, /export\s+async\s+function\s+onRequestPost/);
  assert.match(cloudflareRoute, /Authorization required/);
  assert.match(cloudflareRoute, /\/modal\/private\/trees\/\$\{encodeURIComponent\(decodeURIComponent\(treeId\)\)\}\/likes/);
  assert.match(cloudflareRoute, /allow:\s*'GET, POST'/);
  assert.doesNotMatch(cloudflareRoute, /\/modal\/browse\/latest/);
  assert.doesNotMatch(cloudflareRoute, /sort=likes/);
  assert.doesNotMatch(cloudflareRoute, /sort=views/);
});

test('Unit A3 enables likeCount in latest Browse summary; sort=likes is now supported (Unit C)', () => {
  // sort=likes is now supported in router (Unit C runtime slice, multiline ternary)
  assert.match(catchAllRoute, /'likes'\s*\?\s*'likes'/);
  // sort=views remains unsupported
  assert.doesNotMatch(catchAllRoute, /sort'\)\s*===\s*'views'/);
  // viewCount still forbidden in Browse summary (Unit B policy)
  assert.doesNotMatch(browseSnapshot, /viewCount/);
});
