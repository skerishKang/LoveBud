/**
 * Contract tests for the tree-level comment read / list boundary audit (Issue #3400).
 *
 * These tests verify that docs/product/lovebud-tree-comments-read-list-boundary-audit.md
 * audits the future tree comment read/list boundary without implementing the GET route,
 * reader/helper, client adapters, UI, or changing the #3398 create path, #3075 moment
 * behavior, Scout files, or #1882 implementation behavior.
 *
 * Refs: #3400, #3188, #3396, #3398, #3393, #3394, #3388, #3392, #3075, #1882
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
  'lovebud-tree-comments-read-list-boundary-audit.md'
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

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only audit ──────────────────────────

test('tree comment read/list boundary audit document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /source-only read\/list boundary audit|documentation and contract tests only|audit/i.test(doc),
    'Document must declare source-only / audit posture'
  );
});

test('document references required Refs: #3400 #3188 #3396 #3398 #3393 #3394 #3388 #3392 #3075 #1882', () => {
  const doc = readDoc();
  for (const ref of ['#3400', '#3188', '#3396', '#3398', '#3393', '#3394', '#3388', '#3392', '#3075', '#1882']) {
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

// ─── 3. Read/list boundary documented ───────────────────────────────────────

test('document defines the future tree-comment read/list boundary (GET route candidate)', () => {
  const doc = readDoc();
  assert.ok(
    /GET \/api\/trees\/:treeId\/comments/i.test(doc),
    'Document must define GET /api/trees/:treeId/comments route candidate'
  );
  assert.ok(
    /dedicated tree-target|target_kind = 'tree'/i.test(doc),
    'Document must require dedicated tree-target routes'
  );
  assert.ok(
    /no `memoryId` segment|must \*\*not\*\* reuse/i.test(doc),
    'Document must forbid reusing moment comment routes for tree read/list'
  );
});

// ─── 4. Route / helper candidates documented ────────────────────────────────

test('document documents future route + Modal/Python reader/helper candidates', () => {
  const doc = readDoc();
  assert.ok(
    /GET \/api\/trees\/:treeId\/comments/i.test(doc),
    'Document must document the future GET route candidate'
  );
  assert.ok(
    /fetch_tree_comments/i.test(doc),
    'Document must name the candidate Modal reader fetch_tree_comments'
  );
  assert.ok(
    /modal_compute\/tree_comments/i.test(doc),
    'Document must locate the candidate reader in modal_compute/tree_comments.py'
  );
  assert.ok(
    /require_public_tree_for_like/i.test(doc),
    'Document must reuse require_public_tree_for_like for the read public gate'
  );
});

// ─── 5. Public-tree visibility gate documented ──────────────────────────────

test('document documents public-tree visibility gate before returning comments', () => {
  const doc = readDoc();
  assert.ok(/public-tree visibility gate/i.test(doc), 'Document must name the public-tree visibility gate');
  assert.ok(/visibility = 'public'|public/i.test(doc), 'Document must require public tree visibility for read');
  assert.ok(/require_public_tree_for_like/i.test(doc), 'Document must reuse require_public_tree_for_like');
});

// ─── 6. Non-leaking not-found / private behavior documented ──────────────────

test('document documents non-leaking not-found / private posture', () => {
  const doc = readDoc();
  assert.ok(/non-leaking not-found|not-found \/ private/i.test(doc), 'Document must cover non-leaking not-found/private posture');
  assert.ok(
    /collapse to the \*\*same safe response\*\*|same `404 Tree not found`|no existence leak/i.test(doc),
    'Document must collapse missing and private/non-public to the same safe response (no existence leak)'
  );
  assert.ok(
    /never.*raw backend errors|DB rows|account identifiers|auth headers/i.test(doc),
    'Document must forbid raw backend/DB/account/auth output'
  );
});

// ─── 7. Safe response fields documented ─────────────────────────────────────

test('document documents safe response fields (id, treeId, body, createdAt, updatedAt)', () => {
  const doc = readDoc();
  for (const field of ['id', 'treeId', 'body', 'createdAt', 'updatedAt']) {
    assert.ok(new RegExp(`-${field}:`).test(doc) || doc.includes(field), `Document must document response field ${field}`);
  }
  assert.ok(/safe fields only|safe comment records/i.test(doc), 'Document must require safe-field-only response');
  assert.ok(/bounded/i.test(doc), 'Document must bound the returned list');
});

// ─── 8. Commenter identity policy documented ────────────────────────────────

test('document documents commenter identity policy: authorDisplayLabel, not raw ownerId', () => {
  const doc = readDoc();
  assert.ok(/authorDisplayLabel/i.test(doc), 'Document must define authorDisplayLabel');
  assert.ok(
    /must NOT return.*raw `ownerId`|never expose.*owner_id|raw `ownerId`/i.test(doc),
    'Document must forbid returning the raw ownerId'
  );
  assert.ok(/public display metadata|anonymous-safe/i.test(doc), 'Document must describe public display metadata / anonymous-safe label');
});

// ─── 9. Pagination / sorting posture documented or unresolved ───────────────

test('document documents pagination/sorting posture or explicitly marks it unresolved', () => {
  const doc = readDoc();
  const hasCursorParam = /cursor/i.test(doc);
  const hasLimitParam = /limit/i.test(doc);
  const hasSorting = /newest-first|oldest-first/i.test(doc);
  const unresolvedMarked =
    /UNRESOLVED/i.test(doc) ||
    (hasCursorParam && /UNRESOLVED/i.test(doc)) ||
    (hasSorting && /UNRESOLVED/i.test(doc));
  assert.ok(hasLimitParam, 'Document must document the limit request parameter');
  assert.ok(
    hasCursorParam || hasSorting || unresolvedMarked,
    'Document must document cursor/sorting or explicitly mark posture unresolved'
  );
  assert.ok(unresolvedMarked, 'Unresolved pagination/sorting decisions must be explicitly marked UNRESOLVED');
});

// ─── 10. Safe error taxonomy documented ─────────────────────────────────────

test('document documents safe error taxonomy (invalid tree id, not found/private, invalid pagination, backend unavailable)', () => {
  const doc = readDoc();
  assert.ok(/INVALID_TREE_ID/i.test(doc), 'Document must define invalid tree id error');
  assert.ok(/not found \/ private \/ non-public|Tree not found/i.test(doc), 'Document must define not found/private error');
  assert.ok(/INVALID_PAGINATION/i.test(doc), 'Document must define invalid pagination error');
  assert.ok(/modal-unavailable|modal-timeout|503|504/i.test(doc), 'Document must define backend unavailable error');
  assert.ok(/safe error/i.test(doc), 'Document must require a safe error boundary');
});

// ─── 11. Strict #3075 moment-comment separation documented ──────────────────

test('document documents strict separation from #3075 moment comments', () => {
  const doc = readDoc();
  assert.ok(/#3075/.test(doc), 'Document must reference #3075');
  assert.ok(
    /[Mm]oment comments? (route|writer|reader).*must not be reused|must not be reused for tree comments/i.test(doc),
    'Document must forbid reusing moment comment route/writer/reader for tree comments'
  );
  assert.ok(/comments\.py|fetchComments|fetchPublicMomentComments|createComment/i.test(doc), 'Document must reference moment helpers as boundary-only');
  assert.ok(/tree_comments/i.test(doc), 'Document must scope the tree reader to tree_comments only');
});

// ─── 12. No Scout behavior documented ───────────────────────────────────────

test('document documents no Scout behavior change', () => {
  const doc = readDoc();
  assert.ok(/Scout/i.test(doc), 'Document must mention Scout to state non-goal');
  assert.ok(/do \*\*not\*\* change Scout files/i.test(doc), 'Document must forbid changing Scout files');
});

// ─── 13. No runtime read/list implementation in this child ──────────────────

test('document states no runtime GET/read/list implementation in this child', () => {
  const doc = readDoc();
  assert.ok(/do \*\*not\*\* implement the `GET`\/read\/list route runtime/i.test(doc), 'Document must state no GET/read/list runtime implementation');
  assert.ok(/do \*\*not\*\* change `functions\/api\/trees\/\[tree_id\]\/comments\.js` runtime behavior/i.test(doc), 'Document must state comments.js runtime unchanged');
  assert.ok(/do \*\*not\*\* change `modal_compute\/tree_comments\.py` runtime behavior/i.test(doc), 'Document must state tree_comments.py runtime unchanged');
});

// ─── 14. Future child split documented ──────────────────────────────────────

test('document defines future child split (contract, impl, UI, moderation, non-prod)', () => {
  const doc = readDoc();
  assert.ok(/Read\/list contract/i.test(doc), 'Document must name read/list contract child');
  assert.ok(/Read\/list implementation/i.test(doc), 'Document must name read/list implementation child');
  assert.ok(/UI\/client integration/i.test(doc), 'Document must name UI/client integration child');
  assert.ok(/Moderation\/deletion/i.test(doc), 'Document must name moderation/deletion child');
  assert.ok(/Non-prod verification/i.test(doc), 'Document must name non-prod verification child');
  assert.ok(/this #3400 audit satisfies none/i.test(doc), 'Document must state this audit alone does not satisfy implementation steps');
});

// ─── 15. Companion artifact self-check ──────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comments-read-list-boundary-audit-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 16. Source-level check: #3398 create route remains POST/create-focused ─

test('existing #3398 create route (comments.js) remains POST/create-focused, no GET read/list runtime', () => {
  const src = fs.readFileSync(COMMENTS_JS_PATH, 'utf8');
  assert.ok(src.includes("allow: 'POST'"), 'comments.js must still reject non-POST with allow: POST');
  assert.ok(src.includes('buildMethodNotAllowedResponse'), 'comments.js must keep the method-not-allowed response');
  assert.ok(
    !/export async function onRequestGet/.test(src),
    'comments.js must NOT export a GET read/list handler in this child'
  );
  assert.ok(
    !/fetch_tree_comments|SELECT[\s\S]*tree_comments[\s\S]*ORDER BY/i.test(src),
    'comments.js must NOT implement a tree_comments list query'
  );
  assert.ok(
    /onRequestPost/.test(src) && /proxyTreeCommentCreate/.test(src),
    'comments.js must still expose the POST create proxy'
  );
});

// ─── 17. Source-level check: tree_comments.py reader not implemented ────────

test('modal_compute/tree_comments.py has no read/list reader implemented in this child', () => {
  const src = fs.readFileSync(TREE_COMMENTS_PY_PATH, 'utf8');
  assert.ok(
    !/def fetch_tree_comments/.test(src),
    'tree_comments.py must NOT define fetch_tree_comments (read reader) in this audit-only child'
  );
  assert.ok(
    /def create_tree_comment/.test(src),
    'tree_comments.py must still contain the #3398 create writer (unchanged)'
  );
  assert.ok(
    !/def fetch_tree_comment_list|def list_tree_comments|def read_tree_comments/.test(src),
    'tree_comments.py must NOT define any alternative read/list reader'
  );
});

// ─── 18. This test file itself stays source-only ────────────────────────────

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(
    !/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self),
    'Contract test must not call fetch'
  );
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
});
