/**
 * Contract tests for the tree-level comment read / list route contract (Issue #3404).
 *
 * These tests verify that docs/product/lovebud-tree-comments-read-list-route-contract.md
 * defines the future tree comment GET read/list route contract without implementing
 * the runtime, reader/helper, client adapters, UI, or changing the #3398 create path,
 * #3075 moment behavior, Scout files, or #1882 implementation behavior.
 *
 * Refs: #3404, #3188, #3400, #3401, #3396, #3398, #3393, #3394, #3388, #3392, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs',
  'product',
  'lovebud-tree-comments-read-list-route-contract.md'
);
const COMMENTS_JS_PATH = path.join(
  ROOT,
  'functions',
  'api',
  'trees',
  '[tree_id]',
  'comments.js'
);
const TREE_COMMENTS_PY_PATH = path.join(
  ROOT,
  'modal_compute',
  'tree_comments.py'
);
const APP_PY_PATH = path.join(ROOT, 'modal_compute', 'app.py');

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only route contract ─────────────────

test('tree comment read/list route contract document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only route contract|documentation and contract tests only|contract/i.test(doc),
    'Document must declare source-only / contract posture'
  );
});

test('document references required Refs: #3404 #3188 #3400 #3401 #3396 #3398 #3393 #3394 #3388 #3392 #3075 #1882', () => {
  const doc = readDoc();
  for (const ref of ['#3404', '#3188', '#3400', '#3401', '#3396', '#3398', '#3393', '#3394', '#3388', '#3392', '#3075', '#1882']) {
    assert.ok(doc.includes(ref), `Document must reference ${ref}`);
  }
});

// ─── 2. No close/fix/resolve parent keyword ─────────────────────────────────

test('document forbids closing #3188/#3075/#1882 and requires Refs-only', () => {
  const doc = readDoc();
  assert.ok(/Refs #1882/i.test(doc), 'Document must use Refs #1882 language');
  assert.ok(
    /never use GitHub close keywords|Closes.*Fixes.*Resolves|close keywords/i.test(doc),
    'Document must forbid Closes/Fixes/Resolves close keywords'
  );
  assert.ok(!/\bCloses\s+#3188\b/i.test(doc), 'Document must not use Closes #3188');
  assert.ok(!/\bFixes\s+#3188\b/i.test(doc), 'Document must not use Fixes #3188');
  assert.ok(!/\bResolves\s+#3188\b/i.test(doc), 'Document must not use Resolves #3188');
  assert.ok(!/\bCloses\s+#3075\b/i.test(doc), 'Document must not use Closes #3075');
  assert.ok(!/\bCloses\s+#1882\b/i.test(doc), 'Document must not use Closes #1882');
  assert.ok(!/\bFixes\s+#1882\b/i.test(doc), 'Document must not use Fixes #1882');
  assert.ok(!/\bResolves\s+#1882\b/i.test(doc), 'Document must not use Resolves #1882');
});

// ─── 3. Route / method contract documented ─────────────────────────────────

test('document defines GET /api/trees/:treeId/comments route/method contract', () => {
  const doc = readDoc();
  assert.ok(/GET \/api\/trees\/:treeId\/comments/i.test(doc), 'Document must define GET /api/trees/:treeId/comments');
  assert.ok(/public-read eligible/i.test(doc), 'Document must state public-read eligible surface');
  assert.ok(/no mutation|does not mutate|never writes/i.test(doc), 'Document must state no mutation');
  assert.ok(
    /dedicated tree-target|target_kind = 'tree'/i.test(doc),
    'Document must require dedicated tree-target route'
  );
});

// ─── 4. Reader/helper candidate documented (not implemented) ───────────────

test('document documents fetch_tree_comments reader candidate but does NOT implement it', () => {
  const doc = readDoc();
  assert.ok(/fetch_tree_comments/i.test(doc), 'Document must name the candidate reader fetch_tree_comments');
  assert.ok(/modal_compute\/tree_comments/i.test(doc), 'Document must locate the candidate reader in modal_compute/tree_comments.py');
  assert.ok(
    /NOT implemented in this PR|is NOT implemented|documented only/i.test(doc),
    'Document must state the reader is not implemented in this PR'
  );
});

// ─── 5. Request parameters documented ──────────────────────────────────────

test('document documents request parameters (treeId UUID, bounded limit, optional non-leaking cursor)', () => {
  const doc = readDoc();
  assert.ok(/validate_required_uuid/i.test(doc), 'Document must require treeId UUID validation');
  assert.ok(/limit/i.test(doc), 'Document must document bounded limit');
  assert.ok(/INVALID_PAGINATION/i.test(doc), 'Document must define invalid pagination error');
  assert.ok(
    /opaque|non-leaking/i.test(doc),
    'Document must require cursor (if adopted) to be opaque/non-leaking'
  );
});

// ─── 6. Response DTO documented ────────────────────────────────────────────

test('document documents safe response DTO (id, treeId, body, createdAt, updatedAt, authorDisplayLabel, optional nextCursor)', () => {
  const doc = readDoc();
  for (const field of ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel']) {
    assert.ok(doc.includes(field), `Document must document response field ${field}`);
  }
  assert.ok(/bounded/i.test(doc), 'Document must bound the returned comments array');
  assert.ok(/nextCursor/i.test(doc), 'Document must document optional nextCursor (only if cursor adopted)');
  assert.ok(
    /raw account identifier|raw `ownerId`|never raw ownerId/i.test(doc),
    'Document must forbid raw account identifier in public response'
  );
});

// ─── 7. Public-tree visibility gate documented ─────────────────────────────

test('document documents public-tree visibility gate before returning comments', () => {
  const doc = readDoc();
  assert.ok(/public-tree visibility gate/i.test(doc), 'Document must name the public-tree visibility gate');
  assert.ok(/require_public_tree_for_like/i.test(doc), 'Document must reuse require_public_tree_for_like');
  assert.ok(/visibility = 'public'|public/i.test(doc), 'Document must require public tree visibility for read');
});

// ─── 8. Non-leaking not-found / private behavior documented ─────────────────

test('document documents non-leaking not-found / private posture', () => {
  const doc = readDoc();
  assert.ok(/non-leaking not-found|not-found \/ private/i.test(doc), 'Document must cover non-leaking not-found/private posture');
  assert.ok(
    /collapse to the \*\*same safe response\*\*|same `404 Tree not found`|no existence leak/i.test(doc),
    'Document must collapse missing and private/non-public to the same safe response (no existence leak)'
  );
  assert.ok(/never.*raw backend errors|DB rows|account identifiers|auth headers/i.test(doc), 'Document must forbid raw output');
});

// ─── 9. Pagination / sorting resolved or explicitly unresolved ─────────────

test('document resolves pagination/sorting (limit-only, oldest-first) or marks unresolved', () => {
  const doc = readDoc();
  assert.ok(/limit-only|limit based|limit-only pagination/i.test(doc), 'Document must resolve pagination as limit-only');
  assert.ok(/oldest-first/i.test(doc), 'Document must resolve sorting as oldest-first');
  assert.ok(/ORDER BY created_at ASC/i.test(doc), 'Document must specify oldest-first ordering');
  assert.ok(/resolved in this contract/i.test(doc), 'Document must state the decisions are resolved in this contract');
});

// ─── 10. Safe error taxonomy documented ────────────────────────────────────

test('document documents safe error taxonomy (invalid tree id, invalid pagination, not found/private, upstream unavailable/timeout, unexpected)', () => {
  const doc = readDoc();
  assert.ok(/INVALID_TREE_ID/i.test(doc), 'Document must define invalid tree id error');
  assert.ok(/INVALID_PAGINATION/i.test(doc), 'Document must define invalid pagination error');
  assert.ok(/not found \/ private \/ non-public|Tree not found/i.test(doc), 'Document must define not found/private error');
  assert.ok(/modal-unavailable|503/i.test(doc), 'Document must define upstream unavailable error');
  assert.ok(/modal-timeout|504/i.test(doc), 'Document must define upstream timeout error');
  assert.ok(/unexpected|Unexpected failure/i.test(doc), 'Document must define unexpected safe error');
  assert.ok(/safe error/i.test(doc), 'Document must require a safe error boundary');
});

// ─── 11. Strict #3075 moment-comment separation documented ─────────────────

test('document documents strict separation from #3075 moment comments', () => {
  const doc = readDoc();
  assert.ok(/#3075/.test(doc), 'Document must reference #3075');
  assert.ok(/no `memory_id`/i.test(doc), 'Document must forbid memory_id in tree read path');
  assert.ok(/never.*moment `comments` table|moment `comments` table/i.test(doc), 'Document must forbid moment comments table use');
  assert.ok(
    /must not be reused for tree comments|not be reused/i.test(doc),
    'Document must forbid reusing moment route/helper/client-adapter for tree comments'
  );
});

// ─── 12. Future child split documented ─────────────────────────────────────

test('document defines future child split (impl, client/UI, moderation, non-prod, prod activation)', () => {
  const doc = readDoc();
  assert.ok(/Read\/list implementation/i.test(doc), 'Document must name read/list implementation child');
  assert.ok(/Client\/UI integration|Client\/UI/i.test(doc), 'Document must name client/UI integration child');
  assert.ok(/Moderation\/deletion/i.test(doc), 'Document must name moderation/deletion child');
  assert.ok(/Non-prod verification/i.test(doc), 'Document must name non-prod verification child');
  assert.ok(/Production activation/i.test(doc), 'Document must name production activation child (separate approval)');
  assert.ok(/this #3404 contract satisfies none/i.test(doc), 'Document must state this contract alone does not satisfy implementation steps');
});

// ─── 13. Source-level: comments.js exposes GET read alongside POST create ──

test('comments.js exposes GET read handler and keeps POST create proxy intact', () => {
  const src = fs.readFileSync(COMMENTS_JS_PATH, 'utf8');
  assert.ok(src.includes('buildMethodNotAllowedResponse'), 'comments.js must keep the method-not-allowed response');
  assert.ok(/export async function onRequestGet/.test(src), 'comments.js must now export a GET read/list handler (added by #3408)');
  assert.ok(/onRequestPost/.test(src) && /proxyTreeCommentCreate/.test(src), 'comments.js must still expose the POST create proxy (unchanged)');
  assert.ok(/if \(method === 'POST'\) return proxyTreeCommentCreate/.test(src), 'comments.js POST create behavior must remain intact');
});

// ─── 14. Source-level: tree_comments.py now has the reader ─────────────────

test('modal_compute/tree_comments.py now defines fetch_tree_comments reader', () => {
  const src = fs.readFileSync(TREE_COMMENTS_PY_PATH, 'utf8');
  assert.ok(/def fetch_tree_comments/.test(src), 'tree_comments.py must now define fetch_tree_comments (added by #3408)');
  assert.ok(/def create_tree_comment/.test(src), 'tree_comments.py must still contain the #3398 create writer (unchanged)');
  assert.ok(/FROM tree_comments[\s\S]*ORDER BY created_at ASC, id ASC/.test(src), 'reader must query tree_comments only, oldest-first stable ordering');
});

// ─── 15. Source-level: app.py now registers GET tree-comments route ────────

test('modal_compute/app.py now registers GET tree-comments route (added by #3408)', () => {
  const src = fs.readFileSync(APP_PY_PATH, 'utf8');
  const hasGetTreeComments = /@web_app\.get\("\/modal\/private\/trees\/{tree_id}\/comments"\)/.test(src);
  assert.ok(
    hasGetTreeComments,
    'app.py must now register a GET tree-comments route (implemented by #3408)'
  );
  // POST tree-comments must still be present and unchanged (from #3398).
  assert.ok(/@web_app\.post\("\/modal\/private\/trees\/{tree_id}\/comments"\)/.test(src), 'app.py must still have the #3398 POST tree-comments route');
  assert.ok(/fetch_tree_comments/.test(src), 'app.py must reference fetch_tree_comments');
});

// ─── 16. Companion artifact self-check ─────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comments-read-list-route-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 17. This test file itself stays source-only ───────────────────────────

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(!/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self), 'Contract test must not call fetch');
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});
