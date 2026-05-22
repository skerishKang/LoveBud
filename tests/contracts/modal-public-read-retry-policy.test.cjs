const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const MODAL_PUBLIC_READS = path.join(ROOT, 'modal_compute', 'public_reads.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function readModalPublicReads() {
  return fs.readFileSync(MODAL_PUBLIC_READS, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function getFunctionBody(source, functionName) {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  const match = normalizedSource.match(new RegExp(`def\\s+${functionName}\\s*\\([\\s\\S]*?(?=\\n\\n+def\\s+|\\n\\n+class\\s+|\\n\\n+@[a-zA-Z_]|$)`));
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

function assertPublicReadUsesRetry(source, functionName, fetchMethod) {
  const body = getFunctionBody(source, functionName);
  const normalized = compact(body);

  assert.match(
    normalized,
    /defoperation\(\):.*withget_db_connection\(\)asconn:/i,
    `${functionName} must wrap DB access in an operation function`
  );

  assert.match(
    normalized,
    new RegExp(`returncur\\.${fetchMethod}\\(\\)`, 'i'),
    `${functionName} operation must return cur.${fetchMethod}()`
  );

  assert.match(
    normalized,
    /run_db_with_retry\(operation\)/i,
    `${functionName} must call run_db_with_retry(operation)`
  );
}

test('public memory list fetch uses retry wrapper', () => {
  const source = readModalPublicReads();
  assertPublicReadUsesRetry(source, 'fetch_public_memories', 'fetchall');
});

test('public memory detail fetch uses retry wrapper', () => {
  const source = readModalPublicReads();
  assertPublicReadUsesRetry(source, 'fetch_public_memory', 'fetchone');
});

test('public tree detail fetch uses retry wrapper', () => {
  const source = readModalPublicReads();
  assertPublicReadUsesRetry(source, 'fetch_public_tree', 'fetchone');
});
