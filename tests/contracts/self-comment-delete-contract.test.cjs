/**
 * Contract tests for self comment deletion lifecycle route.
 *
 * These tests verify that the Cloudflare DELETE proxy and Modal
 * DELETE route exist, require Authorization, delegate to the
 * existing soft_delete_own_comment helper, and never leak raw
 * exception data.
 *
 * Refs: #3195
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFileContent(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hasString(content, pattern) {
  return content.includes(pattern);
}

// ─── FILE PATHS ────────────────────────────────────────────────────────────

const APP_PY = path.join(ROOT, 'modal_compute', 'app.py');
const COMMENTS_PY = path.join(ROOT, 'modal_compute', 'comments.py');
const CF_COMMENTS_ID_JS = path.join(ROOT, 'functions/api/comments/[id].js');
const PUBLIC_COMMENTS_CF_JS = path.join(ROOT, 'functions/api/trees/[tree_id]/memories/[memory_id]/comments.js');

// ─── FILE EXISTENCE ────────────────────────────────────────────────────────

test('1. Cloudflare DELETE /api/comments/{id} route exists', () => {
  assert.ok(fs.existsSync(CF_COMMENTS_ID_JS), 'functions/api/comments/[id].js must exist');
});

test('2. Modal DELETE /modal/private/comments/{comment_id} route exists', () => {
  const content = readFileContent(APP_PY);
  assert.ok(hasString(content, '/modal/private/comments/{comment_id}'), 'Modal DELETE route must be defined');
});

// ─── CLOUDFLARE PROXY CONTRACT ────────────────────────────────────────────

test('3. Cloudflare DELETE route requires Authorization', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'onRequestDelete'), 'must export onRequestDelete');
  assert.ok(hasString(content, 'authorization'), 'must reference authorization header');
  assert.ok(hasString(content, 'build401Response'), 'must have 401 response for missing auth');
  assert.ok(hasString(content, '!authHeader'), 'must check for absent auth header');
});

test('4. Cloudflare DELETE route forwards Authorization to Modal', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'authorization: authHeader'), 'must forward Authorization header to Modal');
  assert.ok(hasString(content, 'method: \'DELETE\''), 'must use DELETE method');
  assert.ok(hasString(content, '/modal/private/comments/'), 'must target Modal private comments route');
});

test('5. Cloudflare DELETE route handles Modal timeout and unavailability', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'build504Response'), 'must build 504 on timeout');
  assert.ok(hasString(content, 'build503Response'), 'must build 503 on unavailable');
  assert.ok(hasString(content, 'x-lovebud-degraded'), 'must set degraded header on 503');
});

test('6. Cloudflare DELETE route preserves request ID pattern', () => {
  const content = readFileContent(CF_COMMENTS_ID_JS);
  assert.ok(hasString(content, 'getOrCreateRequestId'), 'must use existing request ID pattern');
  assert.ok(hasString(content, 'withUpstreamHeaders'), 'must forward request ID in response');
  assert.ok(hasString(content, 'x-lovebud-request-id'), 'must reference request ID header');
});

// ─── MODAL ROUTE CONTRACT ──────────────────────────────────────────────────

test('7. Modal DELETE route requires Firebase Authorization', () => {
  const content = readFileContent(APP_PY);

  assert.ok(hasString(content, 'def delete_own_comment('), 'delete_own_comment function must exist');
  assert.ok(hasString(content, 'require_firebase_user'), 'must call require_firebase_user');
});

test('8. Modal DELETE route calls soft_delete_own_comment only', () => {
  const content = readFileContent(APP_PY);

  assert.ok(hasString(content, 'soft_delete_own_comment'), 'must delegate to soft_delete_own_comment');
  assert.ok(hasString(content, 'user["uid"]'), 'must pass actor uid from Firebase user');
});

test('9. soft_delete_own_comment has cross-account authority via SocialWriteError(403)', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(hasString(content, 'def soft_delete_own_comment('), 'soft_delete_own_comment must exist');
  assert.ok(hasString(content, 'SocialWriteError'), 'must use SocialWriteError');
  assert.ok(hasString(content, '403'), 'must return 403 for cross-account delete');
  assert.ok(hasString(content, '404'), 'must return 404 when comment not found');
  assert.ok(hasString(content, '\"deleted\"'), 'must set status to deleted');
});

test('10. Modal route does not log or return raw exception/secret data', () => {
  const content = readFileContent(APP_PY);
  const routeBlock = extractPythonFunctionBlock(content, 'delete_own_comment');

  assert.ok(!hasString(routeBlock, 'str(e)'), 'must not log str(e)');
  assert.ok(!hasString(routeBlock, 'str(error)'), 'must not log str(error)');
  assert.ok(!hasString(routeBlock, 'traceback'), 'must not contain traceback');
});

// ─── PUBLIC COMMENTS READ STILL FILTERS ───────────────────────────────────

test('11. fetch_public_comments still filters status=visible and deleted_at IS NULL', () => {
  const content = readFileContent(COMMENTS_PY);

  assert.ok(hasString(content, 'visible'), 'public comments must filter status = visible');
  assert.ok(hasString(content, 'deleted_at IS NULL'), 'public comments must filter deleted_at IS NULL');
});

// ─── NO UNRELATED FILES MODIFIED ──────────────────────────────────────────

test('12. Only expected files are modified', () => {
  const allowlisted = [
    'modal_compute/app.py',
    'functions/api/comments/[id].js',
    'tests/contracts/self-comment-delete-contract.test.cjs',
  ];

  const { execSync } = require('node:child_process');
  const gitOutput = execSync('git diff --name-only HEAD', { encoding: 'utf8', cwd: ROOT });
  const modifiedFiles = gitOutput.split('\n').filter(Boolean);

  for (const file of modifiedFiles) {
    const isAllowlisted = allowlisted.some(a => file.endsWith(a) || file === a);
    assert.ok(
      isAllowlisted,
      `Modified file "${file}" is not in the allowlist`
    );
  }
});

// ─── URL ROUTE FILE NAMING ───────────────────────────────────────────────

test('13. Cloudflare route file follows [param].js naming convention', () => {
  const filename = path.basename(CF_COMMENTS_ID_JS);
  assert.equal(filename, '[id].js', 'route file must be named [id].js for Cloudflare param binding');
});

// ─── HELPER ───────────────────────────────────────────────────────────────

function extractPythonFunctionBlock(content, functionName) {
  const headerIdx = content.indexOf(`def ${functionName}(`);
  if (headerIdx === -1) return '';
  const afterNewline = content.indexOf('\n', headerIdx);
  if (afterNewline === -1) return '';
  const lines = content.slice(afterNewline + 1).split('\n');
  let result = '';
  for (const line of lines) {
    if (line.length === 0 || line[0] === ' ' || line[0] === '\t') {
      result += line + '\n';
    } else if (line.trim().length === 0) {
      result += '\n';
    } else {
      break;
    }
  }
  return result;
}
