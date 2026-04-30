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
  const normalizedSource = source.replace(/\r\n/g, '\n');
  const match = normalizedSource.match(new RegExp(`def\\s+${functionName}\\s*\\([\\s\\S]*?(?=\\n\\n+def\\s+)`));
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

function assertMemoryWriteOwnerGuard(body, label) {
  const normalized = compact(body);

  assert.match(
    normalized,
    /exists\(\s*select1fromtreest/i,
    `${label} must guard the write with a trees EXISTS subquery`
  );

  assert.match(
    normalized,
    /t\.id=memories\.tree_id/i,
    `${label} owner guard must join trees to the target memory tree_id`
  );

  assert.match(
    normalized,
    /t\.owner_id=%s/i,
    `${label} owner guard must constrain trees.owner_id`
  );

  assert.match(
    normalized,
    /safe_memory_id,owner_id/i,
    `${label} write query parameters must include owner_id`
  );
}

test('create_owner_memory calls fetch_owner_tree with tree_id and owner_id', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /fetch_owner_tree\(/,
    'create_owner_memory must call fetch_owner_tree'
  );

  assert.match(
    normalized,
    /tree_id.*owner_id/,
    'create_owner_memory must pass tree_id and owner_id to fetch_owner_tree'
  );
});

test('create_owner_memory raises 403 when owner tree not found', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*tree/,
    'create_owner_memory must check if tree exists'
  );

  assert.match(
    normalized,
    /httpexception.*403/i,
    'create_owner_memory must raise HTTPException with 403 when tree not found'
  );

  assert.match(
    normalized,
    /access.*denied/i,
    'create_owner_memory error message must indicate access denied'
  );
});

test('require_tree_owner raises 403 on owner mismatch', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'require_tree_owner');
  const normalized = compact(body);

  assert.match(
    normalized,
    /owner_id.*!=.*owner_id/i,
    'require_tree_owner must compare owner_id'
  );

  assert.match(
    normalized,
    /httpexception.*403/i,
    'require_tree_owner must raise HTTPException with 403 on mismatch'
  );

  assert.match(
    normalized,
    /not.*your.*tree/i,
    'require_tree_owner error message must indicate not your tree'
  );
});

test('require_memory_owner raises 403 on owner mismatch', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'require_memory_owner');
  const normalized = compact(body);

  assert.match(
    normalized,
    /tree_owner_id.*!=.*owner_id/i,
    'require_memory_owner must compare tree_owner_id'
  );

  assert.match(
    normalized,
    /httpexception.*403/i,
    'require_memory_owner must raise HTTPException with 403 on mismatch'
  );

  assert.match(
    normalized,
    /not.*your.*memory/i,
    'require_memory_owner error message must indicate not your memory'
  );
});

test('update_owner_tree calls require_tree_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner\(/,
    'update_owner_tree must call require_tree_owner'
  );
});

test('update_owner_tree includes owner_id in WHERE clause', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*trees.*set/i,
    'update_owner_tree must update trees table'
  );

  assert.match(
    normalized,
    /where.*id.*=.*%s.*and.*owner_id.*=.*%s/i,
    'update_owner_tree WHERE clause must include both id and owner_id'
  );
});

test('delete_owner_tree calls require_tree_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner\(/,
    'delete_owner_tree must call require_tree_owner'
  );
});

test('delete_owner_tree includes owner_id in DELETE WHERE clause', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*trees.*where.*id.*=.*%s.*and.*owner_id.*=.*%s/i,
    'delete_owner_tree DELETE WHERE clause must include both id and owner_id'
  );
});

test('update_owner_memory calls require_memory_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner\(/,
    'update_owner_memory must call require_memory_owner'
  );
});

test('update_owner_memory SQL write includes tree owner guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /updatememoriesset/i,
    'update_owner_memory must update memories table'
  );

  assertMemoryWriteOwnerGuard(body, 'update_owner_memory');
});

test('delete_owner_memory calls require_memory_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner\(/,
    'delete_owner_memory must call require_memory_owner'
  );
});

test('delete_owner_memory SQL write includes tree owner guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /deletefrommemorieswhere/i,
    'delete_owner_memory must delete from memories table'
  );

  assertMemoryWriteOwnerGuard(body, 'delete_owner_memory');
});
