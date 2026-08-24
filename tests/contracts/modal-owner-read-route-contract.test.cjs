const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_AUTH = path.join(ROOT, 'modal_compute', 'auth.py');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const OWNER_READS = path.join(ROOT, 'modal_compute', 'owner_reads.py');

function readModalAuth() {
  return fs.readFileSync(MODAL_AUTH, 'utf8');
}

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
    /normalize_tree_row\(row,row\.get\("memory_count"\),include_owner_metadata=true,include_owner_social_counts=true,_owner_like_available=has_like_count,_owner_view_available=has_view_count,?\)/,
    'fetch_user_trees must preserve memory_count tree normalization with owner social counts'
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

test('canonical Modal principal projects only the verified Firebase uid owner semantics', () => {
  const body = getTopLevelFunction(readModalAuth(), 'require_authenticated_principal');
  const normalized = compact(body);
  const returnStart = normalized.indexOf('return{');

  assert.match(normalized, /user=require_firebase_user\(authorization\)/, 'principal must delegate to the existing Firebase verifier');
  assert.match(normalized, /uid=user\["uid"\]/, 'principal authority must come from the verified Firebase uid');
  assert.ok(returnStart >= 0, 'principal must return an explicit projection');

  const projection = normalized.slice(returnStart);
  assert.match(projection, /"provider":"firebase"/, 'provider must be fixed to firebase');
  assert.match(projection, /"providersubject":uid/, 'providerSubject must equal the verified Firebase uid');
  assert.match(projection, /"legacyownerid":uid/, 'legacyOwnerId must equal the verified Firebase uid');
  assert.doesNotMatch(projection, /accountid|email|decoded|token|neon/, 'principal projection must not expose unresolved/private/provider-alternate fields');
  assert.doesNotMatch(normalized, /\btry:/, 'principal projection must preserve verifier HTTPException behavior without remapping it');
});

test('existing Firebase verifier keeps current missing-invalid and dependency-unavailable HTTP behavior', () => {
  const body = getTopLevelFunction(readModalAuth(), 'require_firebase_user');
  const normalized = compact(body);

  assert.match(normalized, /status_code=401,detail="authenticationrequired"/, 'missing Firebase auth must remain 401');
  assert.match(normalized, /status_code=401,detail="invalididtoken"/, 'invalid Firebase ID token must remain 401');
  assert.match(
    normalized,
    /status_code=503,detail="authenticationservicetemporarilyunavailable"/,
    'Firebase certificate dependency failure must remain sanitized 503'
  );
  assert.doesNotMatch(normalized, /neon/, 'Modal verifier must remain Firebase-only');
});

test('get_private_trees authenticates through the canonical principal and keeps the same Firebase uid owner authority', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_trees');
  const normalized = compact(body);

  assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, 'get_private_trees must require canonical authenticated principal');
  assert.match(
    normalized,
    /page_user_trees\(principal\["legacyownerid"\],limit=limit,cursor=cursor\)/,
    'cursor Tree list must use principal.legacyOwnerId'
  );
  assert.match(
    normalized,
    /fetch_user_trees\(principal\["legacyownerid"\],limit=limit\)/,
    'Tree list must use principal.legacyOwnerId'
  );
  assert.doesNotMatch(normalized, /user\["uid"\]/, 'Tree list must not bypass principal owner authority');
  assert.match(normalized, /auth_dependency_unavailable/, 'existing auth dependency error category must remain');
  assert.match(normalized, /auth_failed/, 'existing auth failure error category must remain');
});

test('get_private_tree_detail authenticates through the canonical principal and preserves leak-safe owner lookup', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_tree_detail');
  const normalized = compact(body);

  assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, 'get_private_tree_detail must require canonical authenticated principal');
  assert.match(normalized, /validate_required_uuid\(tree_id,"treeid"\)/, 'get_private_tree_detail must validate required treeId');
  assert.match(
    normalized,
    /fetch_owner_tree\(safe_tree_id,principal\["legacyownerid"\]\)/,
    'get_private_tree_detail must fetch owner tree by safe tree id and principal.legacyOwnerId'
  );
  assert.match(
    normalized,
    /httpexception\(status_code=404,detail="treenotfound"\)/,
    'get_private_tree_detail must return 404 when the owner tree is missing'
  );
  assert.doesNotMatch(normalized, /user\["uid"\]/, 'Tree detail must not bypass principal owner authority');
});

test('get_private_memories authenticates through the canonical principal and keeps list/cursor owner authority', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_memories');
  const normalized = compact(body);

  assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, 'get_private_memories must require canonical authenticated principal');
  assert.match(normalized, /validate_optional_uuid\(treeid,"treeid"\)/, 'get_private_memories must validate optional treeId');
  assert.match(
    normalized,
    /page_owner_memories\(principal\["legacyownerid"\],safe_tree_id,limit=limit,cursor=cursor\)/,
    'cursor Memory list must use principal.legacyOwnerId'
  );
  assert.match(
    normalized,
    /fetch_owner_memories\(principal\["legacyownerid"\],tree_id=safe_tree_id,limit=limit\)/,
    'Memory list must use principal.legacyOwnerId, optional safe tree id, and limit'
  );
  assert.doesNotMatch(normalized, /user\["uid"\]/, 'Memory list must not bypass principal owner authority');
});

test('get_private_memory_detail uses the canonical principal owner id and preserves normalization', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_memory_detail');
  const normalized = compact(body);

  assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, 'get_private_memory_detail must require canonical authenticated principal');
  assert.match(normalized, /validate_required_id\(memory_id,"memoryid"\)/, 'get_private_memory_detail must validate memoryId');
  assert.match(
    normalized,
    /require_memory_owner\(safe_memory_id,principal\["legacyownerid"\]\)/,
    'Memory detail ownership check must use principal.legacyOwnerId'
  );
  assert.match(normalized, /returnnormalize_memory_row\(memory\)/, 'Memory detail must preserve normalization');
  assert.doesNotMatch(normalized, /user\["uid"\]/, 'Memory detail must not bypass principal owner authority');
});

test('Tree create keeps the existing Firebase user contract because verified email metadata is still required', () => {
  const body = getTopLevelFunction(readModalApp(), 'post_private_tree');
  const normalized = compact(body);

  assert.match(normalized, /user=require_firebase_user\(authorization\)/, 'post_private_tree must preserve existing Firebase user auth');
  assert.match(normalized, /owner_email=user\.get\("email"\)or""/, 'post_private_tree must preserve verified email metadata forwarding');
  assert.doesNotMatch(normalized, /require_authenticated_principal/, 'Tree create remains outside #4202 until its email metadata boundary is redesigned');
});

test('Tree update/delete writes route through the authenticated principal boundary (#4202)', () => {
  const source = readModalApp();
  const treePrincipalWriteFunctions = [
    'put_private_tree',
    'delete_private_tree',
  ];

  for (const functionName of treePrincipalWriteFunctions) {
    const body = getTopLevelFunction(source, functionName);
    const normalized = compact(body);
    assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, `${functionName} must use the authenticated principal boundary (#4202)`);
    assert.match(normalized, /principal\["legacyownerid"\]/, `${functionName} must pass principal.legacyOwnerId as the owner authority`);
    assert.doesNotMatch(normalized, /user=require_firebase_user\(authorization\)/, `${functionName} must not call require_firebase_user directly (#4202)`);
    assert.doesNotMatch(normalized, /user\["uid"\]/, `${functionName} must not use the raw uid owner shape`);
  }
});

test('memory write routes route through the authenticated principal boundary (#4181)', () => {
  const source = readModalApp();
  const memoryWriteFunctions = [
    'post_private_memory',
    'put_private_memory',
    'delete_private_memory',
  ];

  for (const functionName of memoryWriteFunctions) {
    const body = getTopLevelFunction(source, functionName);
    const normalized = compact(body);
    assert.match(normalized, /principal=require_authenticated_principal\(authorization\)/, `${functionName} must use the authenticated principal boundary (#4181)`);
    assert.match(normalized, /principal\["legacyownerid"\]/, `${functionName} must pass principal.legacyOwnerId as the owner authority`);
    assert.doesNotMatch(normalized, /user=require_firebase_user\(authorization\)/, `${functionName} must not call require_firebase_user directly (#4181)`);
    assert.doesNotMatch(normalized, /user\["uid"\]/, `${functionName} must not use the raw uid owner shape`);
  }
});

test('non-core owner capability route remains outside the bounded owner-read migration', () => {
  const body = getTopLevelFunction(readModalApp(), 'get_private_tree_capability');
  const normalized = compact(body);

  assert.match(normalized, /user=require_firebase_user\(authorization\)/, 'capability route must preserve existing Firebase auth behavior');
  assert.match(normalized, /fetch_owner_tree\(safe_tree_id,user\["uid"\]\)/, 'capability route must preserve current Firebase uid behavior');
  assert.doesNotMatch(normalized, /require_authenticated_principal/, 'capability route must stay outside #4096 exact owner-read scope');
});
