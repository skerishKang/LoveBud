/**
 * Contract tests for self comment deletion lifecycle route.
 *
 * These tests verify that the Cloudflare DELETE proxy and Modal
 * DELETE route exist, require Authorization, delegate to the
 * existing soft_delete_own_comment helper, validate UUID input,
 * and never leak raw exception data.
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
  assert.ok(hasString(content, "method: 'DELETE'"), 'must use DELETE method');
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

// ─── MODAL ROUTE CONTRACT — route-scoped block ─────────────────────────────

test('7. delete_own_comment has @web_app.delete decorator', () => {
  const decorator = extractDecoratorLine(APP_PY, 'delete_own_comment');
  assert.ok(decorator.includes('@web_app.delete'), 'route must have @web_app.delete decorator');
  assert.ok(decorator.includes('/modal/private/comments/{comment_id}'), 'decorator must reference the correct path');
});

test('8. delete_own_comment calls require_firebase_user, validate_required_uuid, and soft_delete_own_comment', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(block.length > 0, 'function block must be extractable');

  assert.ok(hasString(block, 'require_firebase_user'), 'must call require_firebase_user');
  assert.ok(hasString(block, 'validate_required_uuid'), 'must call validate_required_uuid for input safety');
  assert.ok(hasString(block, 'soft_delete_own_comment'), 'must delegate to soft_delete_own_comment');
  assert.ok(hasString(block, 'safe_comment_id'), 'must use safe_comment_id variable');
  assert.ok(hasString(block, 'user["uid"]'), 'must pass actor uid');
});

test('9. delete_own_comment block does not contain hide_comment_by_tree_owner', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'hide_comment_by_tree_owner'), 'must not contain hide_comment_by_tree_owner');
});

test('10. delete_own_comment block does not contain direct DB access', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'get_db_connection'), 'must not contain get_db_connection');
  assert.ok(!hasString(block, '.cursor'), 'must not contain cursor calls');
  assert.ok(!hasString(block, '.execute'), 'must not contain execute calls');
});

test('11. delete_own_comment block does not log or return raw exception data', () => {
  const block = extractPythonFunctionBlock(APP_PY, 'delete_own_comment');
  assert.ok(!hasString(block, 'str(e)'), 'must not log str(e)');
  assert.ok(!hasString(block, 'traceback'), 'must not contain traceback');
});

// ─── PUBLIC COMMENTS READ STILL FILTERS ───────────────────────────────────

test('12. fetch_public_comments still filters status=visible and deleted_at IS NULL', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(hasString(content, 'visible'), 'public comments must filter status = visible');
  assert.ok(hasString(content, 'deleted_at IS NULL'), 'public comments must filter deleted_at IS NULL');
});

// ─── soft_delete_own_comment helper contract ───────────────────────────────

test('13. soft_delete_own_comment has cross-account authority via SocialWriteError(403)', () => {
  const content = readFileContent(COMMENTS_PY);
  assert.ok(hasString(content, 'def soft_delete_own_comment('), 'soft_delete_own_comment must exist');
  assert.ok(hasString(content, 'SocialWriteError'), 'must use SocialWriteError');
  assert.ok(hasString(content, '403'), 'must return 403 for cross-account delete');
  assert.ok(hasString(content, '404'), 'must return 404 when comment not found');
  assert.ok(hasString(content, '"deleted"'), 'must set status to deleted');
});

// ─── URL ROUTE FILE NAMING ───────────────────────────────────────────────

test('14. Cloudflare route file follows [param].js naming convention', () => {
  const filename = path.basename(CF_COMMENTS_ID_JS);
  assert.equal(filename, '[id].js', 'route file must be named [id].js for Cloudflare param binding');
});

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Extract the full body (indented block) of a Python function.
 * Handles multi-line type-annotated signatures by finding the
 * closing paren of the parameter list before looking for the colon.
 */
function extractPythonFunctionBlock(filePath, functionName) {
  const content = readFileContent(filePath);
  const headerIdx = content.indexOf(`def ${functionName}(`);
  if (headerIdx === -1) return '';

  // Find the closing paren that ends the parameter list
  let depth = 1;
  let idx = headerIdx + `def ${functionName}(`.length;
  while (idx < content.length && depth > 0) {
    if (content[idx] === '(') depth++;
    if (content[idx] === ')') depth--;
    idx++;
  }
  if (depth !== 0) return '';

  // Now find the colon that ends the function signature
  const colonIdx = content.indexOf(':', idx);
  if (colonIdx === -1) return '';

  // Start collecting indented body lines
  const afterNewline = content.indexOf('\n', colonIdx);
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

/**
 * Extract the decorator line immediately before a function definition.
 */
function extractDecoratorLine(filePath, functionName) {
  const content = readFileContent(filePath);
  const headerIdx = content.indexOf(`def ${functionName}(`);
  if (headerIdx === -1) return '';

  // Walk backwards from the def line to find the preceding non-blank line
  const beforeDef = content.slice(0, headerIdx).trimEnd();
  const lastNewline = beforeDef.lastIndexOf('\n');
  const decoratorLine = lastNewline === -1 ? beforeDef : beforeDef.slice(lastNewline + 1);
  return decoratorLine.trim();
}
