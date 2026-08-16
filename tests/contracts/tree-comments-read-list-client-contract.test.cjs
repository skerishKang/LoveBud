/**
 * Contract tests for the tree-level comment read / list client integration
 * contract (Issue #3412).
 *
 * These tests verify that docs/product/lovebud-tree-comments-read-list-client-contract.md
 * defines the future tree comment read/list client integration contract without
 * implementing the client adapter, UI, CSS, drawer/modal, Tree Workspace surface,
 * changing the #3410 backend route/reader, #3075 moment behavior, Scout files,
 * or #1882 implementation behavior.
 *
 * Refs: #3412, #3188, #3408, #3410, #3404, #3405, #3400, #3401, #3396, #3398,
 *       #3393, #3394, #3388, #3392, #3075, #1882
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
  'lovebud-tree-comments-read-list-client-contract.md'
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
const CLIENT_CANDIDATE_PATH = path.join(
  ROOT,
  'js',
  'social',
  'tree-comments-client.js'
);

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

// ─── 1. Document exists and is a source-only client contract ────────────────

test('tree comment read/list client contract document exists', () => {
  const doc = readDoc();
  assert.ok(doc.length > 0, 'Document must not be empty');
  assert.ok(
    /client integration contract|documentation and contract tests only|client contract/i.test(doc),
    'Document must declare source-only / client contract posture'
  );
});

test('document references required Refs: #3412 #3188 #3408 #3410 #3404 #3405 #3400 #3401 #3396 #3398 #3393 #3394 #3388 #3392 #3075 #1882', () => {
  const doc = readDoc();
  for (const ref of [
    '#3412', '#3188', '#3408', '#3410', '#3404', '#3405', '#3400', '#3401',
    '#3396', '#3398', '#3393', '#3394', '#3388', '#3392', '#3075', '#1882',
  ]) {
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
  for (const issue of ['#3188', '#3075', '#1882']) {
    assert.ok(!new RegExp(`\\bCloses\\s+${issue}\\b`, 'i').test(doc), `Document must not use Closes ${issue}`);
    assert.ok(!new RegExp(`\\bFixes\\s+${issue}\\b`, 'i').test(doc), `Document must not use Fixes ${issue}`);
    assert.ok(!new RegExp(`\\bResolves\\s+${issue}\\b`, 'i').test(doc), `Document must not use Resolves ${issue}`);
  }
});

// ─── 3. Client adapter / module candidate documented (not implemented) ──────

test('document documents the client adapter/module candidate but does NOT implement it', () => {
  const doc = readDoc();
  assert.ok(
    /js\/social\/tree-comments-client\.js/i.test(doc),
    'Document must name the candidate client adapter path js/social/tree-comments-client.js'
  );
  assert.ok(/fetchTreeComments/i.test(doc), 'Document must name the candidate fetchTreeComments adapter');
  assert.ok(
    /NOT implemented in this PR|not implemented|does \*\*not\*\* create|is documented only/i.test(doc),
    'Document must state the client adapter is not implemented in this PR'
  );
  assert.ok(
    fs.existsSync(CLIENT_CANDIDATE_PATH),
    'Candidate client adapter is now implemented by the follow-up #3414 (Refs #3414), so the file must exist on main'
  );
});

// ─── 4. Request contract documented ─────────────────────────────────────────

test('document documents the request contract (treeId required, optional limit, backend 1..50 clamp, no cursor)', () => {
  const doc = readDoc();
  assert.ok(/treeId/i.test(doc), 'Document must require treeId');
  assert.ok(/required/i.test(doc), 'Document must mark treeId as required');
  assert.ok(/limit/i.test(doc), 'Document must document optional limit');
  assert.ok(/1\.\.50|1\.\.50|clamps.*1\.\.50|clamp to safe bounds/i.test(doc), 'Document must document backend clamp 1..50');
  assert.ok(/cursor/i.test(doc), 'Document must address cursor');
  assert.ok(/no cursor|none.*cursor|cursor pagination in this contract/i.test(doc), 'Document must state no cursor pagination in this contract');
});

// ─── 5. Response normalization documented ───────────────────────────────────

test('document documents response normalization (bounded comments, safe fields, no raw account id)', () => {
  const doc = readDoc();
  for (const field of ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel']) {
    assert.ok(doc.includes(field), `Document must document response field ${field}`);
  }
  assert.ok(/bounded/i.test(doc), 'Document must bound the returned comments array');
  assert.ok(
    /raw account identifier|raw `ownerId`|never raw ownerId|raw account id/i.test(doc),
    'Document must forbid raw account identifier in the normalized client shape'
  );
});

// ─── 6. Raw account id forbidden documented ────────────────────────────────

test('document explicitly forbids raw account id exposure', () => {
  const doc = readDoc();
  assert.ok(
    /raw account identifier.*forbidden|no raw account identifier|forbidden in the normalized client shape/i.test(doc),
    'Document must explicitly forbid raw account id exposure'
  );
});

// ─── 7. Safe client states documented ──────────────────────────────────────

test('document documents all required safe client states', () => {
  const doc = readDoc();
  const states = [
    [/idle/i, 'idle'],
    [/loading/i, 'loading'],
    [/loaded_empty|loaded empty|`loaded_empty`/i, 'loaded empty'],
    [/loaded_with_comments|loaded with comments/i, 'loaded with comments'],
    [/invalid_tree_id|invalid tree id/i, 'invalid tree id'],
    [/not_found_private_non_public|not found.*private.*non-public|not found \/ private \/ non-public/i, 'not found/private/non-public collapsed'],
    [/upstream_unavailable|upstream unavailable|503/i, 'upstream unavailable'],
    [/upstream_timeout|upstream timeout|504/i, 'upstream timeout'],
    [/unexpected_safe_error|unexpected safe error|unexpected/i, 'unexpected safe error'],
    [/retry/i, 'retry'],
  ];
  for (const [pattern, label] of states) {
    assert.ok(pattern.test(doc), `Document must define client state: ${label}`);
  }
});

// ─── 8. Guest / public read behavior documented ────────────────────────────

test('document documents guest/public read behavior (guest read allowed, no guest mutation, no 401 loop)', () => {
  const doc = readDoc();
  assert.ok(/guest|signed-out/i.test(doc), 'Document must cover guest/signed-out read');
  assert.ok(/public.*read|public-read eligible|public comment-eligible/i.test(doc), 'Document must allow guest read on public eligible tree');
  assert.ok(/no guest mutation|must \*\*not\*\* send any write|never call `POST/i.test(doc), 'Document must forbid guest mutation/write');
  assert.ok(/401 loop|not.*enter a `401` retry loop|no 401 loop/i.test(doc), 'Document must forbid 401 loop in read/list');
});

// ─── 9. #3075 moment-comment separation documented ─────────────────────────

test('document documents strict separation from #3075 moment comments', () => {
  const doc = readDoc();
  assert.ok(/#3075/.test(doc), 'Document must reference #3075');
  assert.ok(/no `memory_id`/i.test(doc), 'Document must forbid memory_id in tree read path');
  assert.ok(/never reuse `fetchComments`|must not be reused for tree comments|not be reused/i.test(doc), 'Document must forbid moment adapter reuse');
  assert.ok(
    /no moment drawer|moment drawer|no moment drawer \/ composer/i.test(doc),
    'Document must forbid moment drawer/composer behavior'
  );
  assert.ok(
    /no moment route.*helper.*client|moment route \/ helper \/ client behavior is changed|not modified/i.test(doc),
    'Document must forbid moment route/helper/client behavior change'
  );
});

// ─── 10. No-UI boundary documented ─────────────────────────────────────────

test('document documents the no-UI boundary (no drawer/modal/Tree Workspace/CSS)', () => {
  const doc = readDoc();
  assert.ok(/no-UI boundary|client contract only|No-UI/i.test(doc), 'Document must state no-UI boundary');
  for (const term of ['drawer', 'modal', 'Tree Workspace', 'CSS']) {
    assert.ok(new RegExp(`no .*${term}|${term}.*not|no ${term}`, 'i').test(doc) || /no drawer \/ modal \/ Tree Workspace/i.test(doc),
      `Document must forbid ${term} in this child`);
  }
});

// ─── 11. Future implementation gates documented ────────────────────────────

test('document defines the 6 future implementation gates', () => {
  const doc = readDoc();
  const gates = [
    [/client adapter implementation/i, 'client adapter implementation'],
    [/read-list state tests/i, 'read-list state tests'],
    [/Tree Workspace.*UI contract|surface UI contract/i, 'Tree Workspace / public tree surface UI contract'],
    [/UI integration/i, 'UI integration'],
    [/non-prod verification/i, 'non-prod verification'],
    [/production visual check/i, 'production visual check'],
  ];
  for (const [pattern, label] of gates) {
    assert.ok(pattern.test(doc), `Document must define future gate: ${label}`);
  }
  assert.ok(/this #3412 contract satisfies none/i.test(doc), 'Document must state this contract alone does not satisfy the gates');
});

// ─── 12. Current UI/client surfaces do NOT yet consume GET tree comments ────

test('no existing JS client surfaces consume GET /api/trees/:treeId/comments', () => {
  // Recursively scan js/ for any tree-target comment GET usage (excluding moment path).
  const violations = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        if (/trees\/\$\{?[^}]*\}?\/comments/.test(src) && !/memories\/[^/]+\/comments/.test(src)) {
          // Only flag tree-target (no memory segment) comment GET calls.
          if (/apiFetch\([^)]*comments[^)]*\)|`\/trees\/\$\{?\w+\}?\/comments`/.test(src)) {
            violations.push(full);
          }
        }
      }
    }
  }
  walk(path.join(ROOT, 'js'));
  assert.deepEqual(violations, [], `No JS client may yet consume GET /api/trees/:treeId/comments (violations: ${violations.join(', ')})`);
});

// ─── 13. No drawer/modal/Tree Workspace integration added ───────────────────

test('document and this PR add no drawer/modal/Tree Workspace integration', () => {
  const doc = readDoc();
  assert.ok(/no drawer \/ modal implementation/i.test(doc) || /No drawer \/ modal/i.test(doc), 'Document must forbid drawer/modal implementation');
  assert.ok(/do \*\*not\*\* integrate Tree Workspace/i.test(doc) || /no.*Tree Workspace/i.test(doc), 'Document must forbid Tree Workspace integration');
  // The client adapter file now exists because the follow-up #3414 (Refs #3414)
  // implements it; this #3413 child still added no drawer/modal/Tree Workspace
  // surface, only the documentation + contract test.
  assert.ok(fs.existsSync(CLIENT_CANDIDATE_PATH), 'Client adapter implemented by follow-up #3414 (Refs #3414)');
});

// ─── 14. No Scout files touched ─────────────────────────────────────────────

test('document forbids Scout file changes and no Scout file is modified by this PR', () => {
  const doc = readDoc();
  assert.ok(/do \*\*not\*\* change Scout files/i.test(doc), 'Document must forbid Scout file changes');
  // Verify no Scout source change in this working tree (scope check).
  const status = require('node:child_process').execSync('git status --porcelain', { cwd: ROOT }).toString();
  for (const line of status.split('\n')) {
    if (/js\/scout\//.test(line)) {
      assert.fail(`Scout file changed by this PR: ${line}`);
    }
  }
});

// ─── 15. No moment comment client/route/helper behavior touched ─────────────

test('document forbids moment comment client/route/helper behavior change', () => {
  const doc = readDoc();
  assert.ok(/do \*\*not\*\* change moment-level #3075 behavior/i.test(doc) || /moment-level #3075 behavior is not modified/i.test(doc),
    'Document must forbid moment comment behavior change');
  assert.ok(/no moment route \/ helper \/ client behavior is changed|No moment route/i.test(doc), 'Document must state no moment route/helper/client change');
});

// ─── 16. Backend route/reader from #3410 unchanged by this PR ───────────────

test('backend route/reader from #3410 remains intact and is not changed by this PR', () => {
  const commentsSrc = fs.readFileSync(COMMENTS_JS_PATH, 'utf8');
  assert.ok(/export async function onRequestGet/.test(commentsSrc), 'comments.js must still expose the #3410 GET read/list handler (unchanged)');
  assert.ok(/export async function onRequestPost/.test(commentsSrc), 'comments.js must still expose the POST create handler (unchanged)');

  const readerSrc = fs.readFileSync(TREE_COMMENTS_PY_PATH, 'utf8');
  assert.ok(/def fetch_tree_comments/.test(readerSrc), 'tree_comments.py must still define fetch_tree_comments (from #3410, unchanged)');
  assert.ok(/def create_tree_comment/.test(readerSrc), 'tree_comments.py must still contain the #3398 create writer (unchanged)');

  const appSrc = fs.readFileSync(APP_PY_PATH, 'utf8');
  assert.ok(/@web_app\.get\("\/modal\/private\/trees\/{tree_id}\/comments"\)/.test(appSrc), 'app.py must still register the GET tree-comments route (from #3410, unchanged)');
  assert.ok(/@web_app\.post\("\/modal\/private\/trees\/{tree_id}\/comments"\)/.test(appSrc), 'app.py must still register the POST tree-comments route (from #3398, unchanged)');

  const doc = readDoc();
  assert.ok(
    /remains intact|unchanged by this PR|is unchanged by this PR|unchanged in behavior/i.test(doc),
    'Document must state the backend route/reader is unchanged by this PR'
  );

  // Backend contract intact
  assert.ok(readerSrc.includes('def fetch_tree_comments'), 'fetch_tree_comments reader must exist');
});

// ─── 17. Companion artifact self-check ──────────────────────────────────────

test('companion contract test path is documented', () => {
  const doc = readDoc();
  assert.ok(
    doc.includes('tests/contracts/tree-comments-read-list-client-contract.test.cjs'),
    'Document must name the companion contract test path'
  );
});

// ─── 18. This test file itself stays source-only ────────────────────────────

test('this contract suite does not import runtime/network/browser/DB clients', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/require\(['"]axios['"]\)|from ['"]axios['"]/i.test(self), 'Contract test must not import axios');
  assert.ok(!/\bglobalThis\.fetch\s*\(|\bwindow\.fetch\s*\(/i.test(self), 'Contract test must not call fetch');
  assert.ok(!/require\(['"]playwright['"]\)/i.test(self), 'Contract test must not import playwright');
  assert.ok(!/require\(['"]puppeteer['"]\)/i.test(self), 'Contract test must not import puppeteer');
  assert.ok(!/require\(['"]postgres-client['"]\)/i.test(self), 'Contract test must not import postgres-client');
});
