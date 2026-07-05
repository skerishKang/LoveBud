const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const OWNER_READS = path.join(ROOT, 'modal_compute', 'owner_reads.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function readOwnerReads() {
  return fs.readFileSync(OWNER_READS, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function getTopLevelFunction(source, functionName) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => (
    new RegExp(`^(?:async\\s+)?def\\s+${functionName}\\s*\\(`).test(line)
  ));

  assert.notEqual(start, -1, `missing ${functionName}`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^(?:async\s+)?def\s+\w+\s*\(/.test(lines[index]) || /^class\s+\w+/.test(lines[index]) || /^@\w/.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

function assertAppearsInOrder(body, tokens, label) {
  let previousIndex = -1;
  const normalized = compact(body);

  tokens.forEach((token) => {
    const index = normalized.indexOf(compact(token));
    assert.ok(index > previousIndex, `${label} must include ${token} after the prior contract token`);
    previousIndex = index;
  });
}

test('fetch_user_trees keeps owner boundary, limit, parameter order, and normalization', () => {
  const body = getTopLevelFunction(readOwnerReads(), 'fetch_user_trees');
  const normalized = compact(body);

  assert.match(normalized, /wheret\.owner_id=%s/, 'fetch_user_trees must constrain trees.owner_id');
  assert.match(normalized, /limit%s/, 'fetch_user_trees must use LIMIT %s');
  assert.match(normalized, /cur\.execute\(query,\(owner_id,limit\)\)/, 'fetch_user_trees must pass query params as (owner_id, limit)');
  assert.match(
    normalized,
    /normalize_tree_row\(row,row\.get\("memory_count"\)(?:,[^)]*)?\)/,
    'fetch_user_trees must preserve memory_count tree normalization'
  );
  assert.match(
    normalized,
    /include_owner_metadata=true/,
    'fetch_user_trees must request owner metadata'
  );
});

test('fetch_owner_tree keeps tree and owner boundary, limit, parameter order, and missing-row path', () => {
  const body = getTopLevelFunction(readOwnerReads(), 'fetch_owner_tree');
  const normalized = compact(body);

  assert.match(normalized, /wheret\.id=%sandt\.owner_id=%s/, 'fetch_owner_tree must constrain tree id and owner id');
  assert.match(normalized, /limit1/, 'fetch_owner_tree must use LIMIT 1');
  assert.match(normalized, /cur\.execute\(query,\(tree_id,owner_id\)\)/, 'fetch_owner_tree must pass params as (tree_id, owner_id)');
  assert.match(normalized, /ifrowelsenone/, 'fetch_owner_tree must return None when the row is missing');
});

test('fetch_owner_memories keeps owner boundary, optional tree filter, limit, parameter order, and normalization', () => {
  const body = getTopLevelFunction(readOwnerReads(), 'fetch_owner_memories');
  const normalized = compact(body);

  assert.match(normalized, /innerjointreestont\.id=m\.tree_id/, 'fetch_owner_memories must join memories to trees');
  assert.match(normalized, /filters=\["t\.owner_id=%s"\]/, 'fetch_owner_memories must constrain trees.owner_id');
  assert.match(normalized, /iftree_id:.*filters\.append\("m\.tree_id=%s"\)/, 'fetch_owner_memories must add optional m.tree_id filter');
  assert.match(normalized, /limit%s/, 'fetch_owner_memories must use LIMIT %s');
  assert.match(normalized, /cur\.execute\(query,tuple\(params\)\)/, 'fetch_owner_memories must execute with tuple(params)');
  assert.match(normalized, /normalize_memory_row\(row\)/, 'fetch_owner_memories must preserve memory normalization');

  assertAppearsInOrder(
    body,
    [
      'params: list[Any] = [owner_id]',
      'params.append(tree_id)',
      'params.append(limit)',
      'cur.execute(query, tuple(params))',
    ],
    'fetch_owner_memories parameter order'
  );
});

test('get_private_trees authenticates and reads trees for the Firebase uid', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_trees');
  const normalized = compact(body);

  assert.match(normalized, /require_firebase_user\(authorization\)/, 'get_private_trees must require Firebase auth');
  assert.match(normalized, /fetch_user_trees\(user\["uid"\],limit=limit\)/, 'get_private_trees must fetch trees by user uid');
});

test('get_private_tree_detail authenticates, validates tree id, fetches owner tree, and returns 404 when missing', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_tree_detail');
  const normalized = compact(body);

  assert.match(normalized, /require_firebase_user\(authorization\)/, 'get_private_tree_detail must require Firebase auth');
  assert.match(normalized, /validate_required_uuid\(tree_id,"treeid"\)/, 'get_private_tree_detail must validate required treeId');
  assert.match(normalized, /fetch_owner_tree\(safe_tree_id,user\["uid"\]\)/, 'get_private_tree_detail must fetch owner tree by safe tree id and uid');
  assert.match(
    normalized,
    /httpexception\(status_code=404,detail="treenotfound"\)/,
    'get_private_tree_detail must return 404 when the owner tree is missing'
  );
});

test('get_private_memories authenticates, validates optional tree id, and reads owner memories', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_memories');
  const normalized = compact(body);

  assert.match(normalized, /require_firebase_user\(authorization\)/, 'get_private_memories must require Firebase auth');
  assert.match(normalized, /validate_optional_uuid\(treeid,"treeid"\)/, 'get_private_memories must validate optional treeId');
  assert.match(
    normalized,
    /fetch_owner_memories\(user\["uid"\],tree_id=safe_tree_id,limit=limit\)/,
    'get_private_memories must fetch owner memories by uid, optional safe tree id, and limit'
  );
});
