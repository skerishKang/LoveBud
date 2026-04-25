const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function getFunctionBody(source, functionName) {
  const match = source.match(new RegExp(`def\\s+${functionName}\\s*\\([\\s\\S]*?(?=\\n\\ndef\\s+)`));
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

test('modal public memory list excludes memories under private parent trees', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'fetch_public_memories');
  const normalized = compact(body);

  assert.match(
    normalized,
    /frommemoriesminnerjointreestont\.id=m\.tree_id/,
    'fetch_public_memories must join parent trees'
  );

  assert.match(
    normalized,
    /m\.visibility=['"]public['"]/,
    'fetch_public_memories must still require public memories'
  );

  assert.match(
    normalized,
    /t\.visibility=['"]public['"]/,
    'fetch_public_memories must require public parent trees'
  );

  assert.match(
    normalized,
    /m\.tree_id=%s/,
    'treeId filter must apply to the memories alias'
  );
});

test('modal public memory detail excludes memories under private parent trees', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'fetch_public_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /frommemoriesminnerjointreestont\.id=m\.tree_id/,
    'fetch_public_memory must join parent trees'
  );

  assert.match(
    normalized,
    /m\.id=%s/,
    'fetch_public_memory must filter by the memory id'
  );

  assert.match(
    normalized,
    /m\.visibility=['"]public['"]/,
    'fetch_public_memory must still require public memories'
  );

  assert.match(
    normalized,
    /t\.visibility=['"]public['"]/,
    'fetch_public_memory must require public parent trees'
  );
});
