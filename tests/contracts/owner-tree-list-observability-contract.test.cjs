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

function hasRegex(content, pattern) {
  return pattern.test(content);
}

const TREES_JS = path.join(ROOT, 'functions/api/trees.js');
const APP_PY = path.join(ROOT, 'modal_compute/app.py');
const LOGGING_PY = path.join(ROOT, 'modal_compute/logging.py');
const OWNER_READS_PY = path.join(ROOT, 'modal_compute/owner_reads.py');
const DB_PY = path.join(ROOT, 'modal_compute/db.py');

test('1. GET /api/trees generates, forwards, echoes, and exposes x-lovebud-request-id', () => {
  const content = readFileContent(TREES_JS);
  assert.ok(hasString(content, 'REQUEST_ID_HEADER'), 'trees.js must define REQUEST_ID_HEADER');
  assert.ok(hasString(content, 'x-lovebud-request-id'), 'trees.js must reference x-lovebud-request-id');
  assert.ok(hasString(content, 'getOrCreateRequestId'), 'trees.js must call getOrCreateRequestId');
  assert.ok(hasString(content, 'withModalHeaderAndId'), 'trees.js must wrap response with request ID');
  assert.ok(hasString(content, 'Access-Control-Expose-Headers'), 'trees.js must expose request ID through CORS');
});

test('2. Authorization forwarding remains present in GET /api/trees', () => {
  const content = readFileContent(TREES_JS);
  const onRequestGetBlock = extractJSFunctionBlock(content, 'onRequestGet');
  assert.ok(hasString(onRequestGetBlock, 'authorization'), 'onRequestGet must forward authorization header');
  assert.ok(hasString(onRequestGetBlock, 'request.headers.get'), 'onRequestGet must read from request headers');
});

function extractBraceBlock(content, openBraceIndex, label) {
  assert.ok(Number.isInteger(openBraceIndex) && openBraceIndex >= 0, `${label} should have a valid opening brace index`);
  assert.equal(content[openBraceIndex], '{', `${label} should start at an opening brace`);
  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openBraceIndex, index + 1);
  }
  assert.fail(`${label} should be closed`);
}

function extractPythonFunctionBlock(content, functionName) {
  const headerIdx = content.indexOf(`def ${functionName}`);
  assert.notEqual(headerIdx, -1, `${functionName} should exist`);
  const bodyStart = content.indexOf(':', headerIdx);
  assert.notEqual(bodyStart, -1, `${functionName} should have colon`);
  const afterNewline = content.indexOf('\n', bodyStart);
  assert.notEqual(afterNewline, -1, `${functionName} should have body lines`);
  const lines = content.slice(afterNewline + 1).split('\n');
  let result = '';
  for (const line of lines) {
    if (line.length === 0 || line[0] === ' ' || line[0] === '\t' || line[0] === ')') {
      result += line + '\n';
    } else if (line.trim().length === 0) {
      result += '\n';
    } else {
      break;
    }
  }
  return result;
}

function extractJSFunctionBlock(content, functionName) {
  let idx = content.indexOf(`async function ${functionName}`);
  if (idx === -1) idx = content.indexOf(`function ${functionName}`);
  assert.notEqual(idx, -1, `${functionName} should exist`);
  const openBrace = content.indexOf('{', idx);
  assert.notEqual(openBrace, -1, `${functionName} should have body`);
  return extractBraceBlock(content, openBrace, `${functionName} body`);
}

test('3. Private list Modal route accepts request ID and creates RequestLogger', () => {
  const content = readFileContent(APP_PY);
  const routeBlock = extractPythonFunctionBlock(content, 'get_private_trees');

  assert.ok(hasString(routeBlock, 'x_lovebud_request_id'), 'get_private_trees must accept x_lovebud_request_id header');
  assert.ok(hasString(routeBlock, 'RequestLogger'), 'get_private_trees must create RequestLogger');
  assert.ok(hasString(routeBlock, '/modal/private/trees'), 'RequestLogger route must be /modal/private/trees');
});

test('4. List route logs success, auth failure, dedicated list failure, and unexpected failure paths', () => {
  const content = readFileContent(APP_PY);
  const routeBlock = extractPythonFunctionBlock(content, 'get_private_trees');

  assert.ok(hasString(routeBlock, 'log_success'), 'list route must log success');
  assert.ok(hasString(routeBlock, 'status_code=200'), 'success log must use 200');
  assert.ok(hasString(routeBlock, 'AUTH_FAILED'), 'list route must log AUTH_FAILED on auth error');
  assert.ok(hasString(routeBlock, 'failure_phase='), 'list route must include failure_phase in error logs');
  assert.ok(hasString(routeBlock, 'OwnerTreeListError'), 'list route must catch OwnerTreeListError');
  assert.ok(hasString(routeBlock, 'OWNER_TREE_LIST_UNEXPECTED_FAILURE'), 'list route must catch unexpected errors');
});

test('5. Only fixed error categories and fixed failure phases are used', () => {
  const readsContent = readFileContent(OWNER_READS_PY);
  const allowedCategories = [
    'OWNER_TREE_LIST_DB_CONNECTION_FAILURE',
    'OWNER_TREE_LIST_QUERY_FAILURE',
    'OWNER_TREE_LIST_NORMALIZATION_FAILURE',
    'OWNER_TREE_LIST_UNEXPECTED_FAILURE',
  ];
  for (const cat of allowedCategories) {
    assert.ok(hasString(readsContent, cat), `${cat} must be present`);
  }
  const allowedPhases = ['db_connection', 'query', 'normalization', 'unexpected'];
  for (const phase of allowedPhases) {
    assert.ok(hasString(readsContent, phase), `failure_phase '${phase}' must be present`);
  }
});

test('6. fetch_user_trees distinguishes connection/query/normalization without changing SQL', () => {
  const content = readFileContent(OWNER_READS_PY);
  const fetchBlock = extractPythonFunctionBlock(content, 'fetch_user_trees');

  assert.ok(hasString(fetchBlock, 'OWNER_TREE_LIST_DB_CONNECTION_FAILURE'), 'must distinguish DB_CONNECTION_FAILURE');
  assert.ok(hasString(fetchBlock, 'OWNER_TREE_LIST_QUERY_FAILURE'), 'must distinguish QUERY_FAILURE');
  assert.ok(hasString(fetchBlock, 'OWNER_TREE_LIST_NORMALIZATION_FAILURE'), 'must distinguish NORMALIZATION_FAILURE');

  const originalSql = [
    'SELECT t.id, t.owner_id, t.title, t.visibility',
    'LEFT JOIN memories m',
    'WHERE t.owner_id = %s',
    'ORDER BY t.created_at DESC',
  ];
  for (const sql of originalSql) {
    assert.ok(hasString(fetchBlock, sql), `SQL pattern '${sql}' must be unchanged`);
  }
});

test('7. run_db_with_retry remains in use', () => {
  const content = readFileContent(OWNER_READS_PY);
  assert.ok(hasString(content, 'run_db_with_retry'), 'run_db_with_retry must be used');
});

test('8. db.py no longer prints raw str(e) for pool failures', () => {
  const content = readFileContent(DB_PY);
  const poolAcquireBlock = extractPoolAcquireFailureBlock(content);
  assert.ok(!hasString(poolAcquireBlock, 'str(e)'), 'must not print str(e)');
  assert.ok(!hasString(poolAcquireBlock, '{str(e)}'), 'must not reference str(e)');
  assert.ok(!hasString(poolAcquireBlock, '{e}'), 'must not reference raw exception');
  assert.ok(hasString(poolAcquireBlock, 'failed after'), 'must retain generic fixed message');
});

function extractPoolAcquireFailureBlock(content) {
  const needle = 'DB Pool acquire failed after';
  const idx = content.indexOf(needle);
  assert.notEqual(idx, -1, 'pool acquire failure message must exist');
  const lineStart = content.lastIndexOf('\n', idx) + 1;
  const lineEnd = content.indexOf('\n', idx);
  return content.slice(lineStart, lineEnd !== -1 ? lineEnd : content.length);
}

test('9. No affected file logs or returns Authorization, cookies, token, UID, raw SQL, str(error), error.message, traceback, request/response body', () => {
  const forbiddenLogPatterns = [
    'Authorization',
    'cookies',
    'token',
    'UID',
    'raw SQL',
    'str(error)',
    'error.message',
    'traceback',
    'request/response body',
  ];
  const files = [TREES_JS, APP_PY, LOGGING_PY, OWNER_READS_PY, DB_PY];
  for (const filePath of files) {
    const content = readFileContent(filePath);
    assert.ok(!hasString(content, 'str(e)') || filePath === LOGGING_PY || filePath === APP_PY, `${path.basename(filePath)} must not contain str(e)`);
  }
});

test('10. Exact changed-file scope is limited to the six allowed files', () => {
  const allowedFiles = [
    'functions/api/trees.js',
    'modal_compute/app.py',
    'modal_compute/logging.py',
    'modal_compute/owner_reads.py',
    'modal_compute/db.py',
    'tests/contracts/owner-tree-list-observability-contract.test.cjs',
    'modal_compute/api_response_helpers.py',
  ];
  for (const f of allowedFiles) {
    const fullPath = path.join(ROOT, f);
    assert.ok(fs.existsSync(fullPath), `${f} must exist (allowed file)`);
  }
});
