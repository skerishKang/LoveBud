// #4181 Modal Memory owner-write principal boundary contract.
//
// Bounded source-structure contract for the source-only refactor that routes
// EXACTLY the three Modal Memory owner-write routes through the existing
// authenticated-principal boundary:
//
//   post_private_memory    -> create_owner_memory(principal["legacyOwnerId"], payload)
//   put_private_memory     -> update_owner_memory(principal["legacyOwnerId"], memory_id, payload)
//   delete_private_memory  -> delete_owner_memory(principal["legacyOwnerId"], memory_id)
//
// Proves, on the real production sources:
//   - all three routes call require_authenticated_principal(authorization);
//   - none of the three calls require_firebase_user directly anymore;
//   - the first owner argument of each owner-write call is
//     principal["legacyOwnerId"] — never uid, email, providerSubject,
//     or accountId;
//   - authentication precedes body parsing (post/put) and precedes the
//     mutation call in every route body;
//   - the Firebase-only verifier boundary is preserved verbatim:
//     require_authenticated_principal still delegates to require_firebase_user,
//     projects provider "firebase", and returns legacyOwnerId === providerSubject
//     === verified UID with no email/accountId in the principal;
//   - every OTHER route that previously called require_firebase_user still does
//     (exact expected caller set pinned), so no unrelated route drifted;
//   - auth failure status/detail parity is carried by the unchanged
//     require_firebase_user error contract inside modal_compute/auth.py.
//
// Pure static source-read (SOURCE_STATIC): no Python execution, no network,
// no DB, no provider/Production resource is touched.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const MODAL_AUTH = path.join(ROOT, 'modal_compute', 'auth.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function readModalAuth() {
  return fs.readFileSync(MODAL_AUTH, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function compactCode(value) {
  // Strip Python docstrings so prose mentions (e.g. "email ... never copied")
  // do not trip code-level negative assertions.
  return compact(value.replace(/"""[\s\S]*?"""/g, ''));
}

function getRouteFunctionBody(source, routeName, method) {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  const escapedRouteName = routeName.replace(/\{([^}]+)\}/g, '\\{$1\\}');
  const routePattern = `@web_app\\.${method}\\(["']${escapedRouteName}["'][\\s\\S]*?(?:async\\s+)?def\\s+[\\w_]+\\s*\\([^)]*\\)`;
  const decoratorMatch = normalizedSource.match(new RegExp(routePattern));
  assert.ok(decoratorMatch, `missing route ${method} ${routeName}`);

  const startIndex = normalizedSource.indexOf(decoratorMatch[0]);
  const remaining = normalizedSource.substring(startIndex);
  const functionBodyMatch = remaining.match(/(@web_app\.[^(]*\([^)]*\)[\s\S]*?(?:async\s+)?def\s+[\w_]+\s*\([^)]*\)[\s\S]*?)(?=@web_app\.|\n\n\n|\n\n@|$)/);
  assert.ok(functionBodyMatch, `missing function body ${method} ${routeName}`);
  return functionBodyMatch[1];
}

function getFunctionBody(source, functionName) {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  const match = normalizedSource.match(new RegExp(`(?:async\\s+)?def\\s+${functionName}\\s*\\([\\s\\S]*?(?=\\n\\n+(?:async\\s+)?def\\s+|\\n\\n\\n|\\n\\n@|$)`));
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

const MEMORY_WRITE_ROUTES = [
  { name: 'post_private_memory', method: 'post', route: '/modal/private/memories' },
  { name: 'put_private_memory', method: 'put', route: '/modal/private/memories/{memory_id}' },
  { name: 'delete_private_memory', method: 'delete', route: '/modal/private/memories/{memory_id}' }
];

// Exact set of other routes that must KEEP calling require_firebase_user
// directly (pinned so the refactor cannot silently drift other surfaces).
const OTHER_FIREBASE_USER_ROUTES = [
  ['post_private_tree', 'post', '/modal/private/trees'],
  ['get_private_tree_capability', 'get', '/modal/private/trees/{tree_id}/capability'],
  ['post_fork_tree', 'post', '/modal/private/trees/{tree_id}/fork'],
  ['put_private_tree', 'put', '/modal/private/trees/{tree_id}'],
  ['delete_private_tree', 'delete', '/modal/private/trees/{tree_id}'],
  ['post_tree_like', 'post', '/modal/private/trees/{tree_id}/likes'],
  ['get_tree_likes', 'get', '/modal/private/trees/{tree_id}/likes'],
  ['post_tree_comment', 'post', '/modal/private/trees/{tree_id}/comments'],
  ['post_memory_reaction', 'post', '/modal/private/memories/{memory_id}/reactions'],
  ['get_memory_reactions', 'get', '/modal/private/memories/{memory_id}/reactions'],
  ['post_memory_comment', 'post', '/modal/private/memories/{memory_id}/comments'],
  ['get_memory_comments', 'get', '/modal/private/memories/{memory_id}/comments'],
  ['delete_own_comment', 'delete', '/modal/private/comments/{comment_id}'],
  ['post_appreciation_order', 'post', '/modal/private/trees/{tree_id}/appreciation-order'],
  ['get_appreciation_order', 'get', '/modal/private/trees/{tree_id}/appreciation-order'],
  ['post_hub_layout', 'post', '/modal/private/trees/{tree_id}/hub-layout'],
  ['get_hub_layout', 'get', '/modal/private/trees/{tree_id}/hub-layout'],
  ['post_youtube_playlist_preview', 'post', '/modal/private/import/youtube/playlist/preview']
];

test('1. all three Memory write routes use require_authenticated_principal and not require_firebase_user', () => {
  const source = readModalApp();
  for (const { name, method, route } of MEMORY_WRITE_ROUTES) {
    const normalized = compact(getRouteFunctionBody(source, route, method));
    assert.match(
      normalized,
      /principal=require_authenticated_principal\(authorization\)/,
      `${name} must call principal = require_authenticated_principal(authorization)`
    );
    assert.doesNotMatch(
      normalized,
      /require_firebase_user/,
      `${name} must not call require_firebase_user directly (#4181)`
    );
  }
});

test('2. create_owner_memory first owner argument is principal legacyOwnerId', () => {
  const source = readModalApp();
  const normalized = compact(getRouteFunctionBody(source, '/modal/private/memories', 'post'));
  assert.match(
    normalized,
    /returncreate_owner_memory\(principal\["legacyownerid"\],payload\)/,
    'post_private_memory must pass principal["legacyOwnerId"] to create_owner_memory'
  );
});

test('3. update_owner_memory first owner argument is principal legacyOwnerId', () => {
  const source = readModalApp();
  const normalized = compact(getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put'));
  assert.match(
    normalized,
    /returnupdate_owner_memory\(principal\["legacyownerid"\],memory_id,payload\)/,
    'put_private_memory must pass principal["legacyOwnerId"] to update_owner_memory'
  );
});

test('4. delete_owner_memory first owner argument is principal legacyOwnerId', () => {
  const source = readModalApp();
  const normalized = compact(getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'delete'));
  assert.match(
    normalized,
    /returndelete_owner_memory\(principal\["legacyownerid"\],memory_id\)/,
    'delete_private_memory must pass principal["legacyOwnerId"] to delete_owner_memory'
  );
});

test('5. providerSubject/email/accountId are never passed as owner arguments', () => {
  const source = readModalApp();
  const forbidden = [
    /providersubject/i,
    /\["email"\]/,
    /\baccountid\b/i,
    /user\["uid"\]/
  ];
  for (const { name, method, route } of MEMORY_WRITE_ROUTES) {
    const normalized = compact(getRouteFunctionBody(source, route, method));
    for (const pattern of forbidden) {
      assert.doesNotMatch(normalized, pattern, `${name} must not use non-legacy owner authority (${pattern})`);
    }
  }
});

test('6. authentication precedes body parse and mutation in post/put; precedes mutation in delete', () => {
  const source = readModalApp();

  const postBody = getRouteFunctionBody(source, '/modal/private/memories', 'post');
  const postNormalized = compact(postBody);
  const postAuthIdx = postNormalized.indexOf('require_authenticated_principal(authorization)');
  const postParseIdx = postNormalized.indexOf('awaitparse_json_body(request)');
  assert.ok(postAuthIdx !== -1 && postParseIdx !== -1, 'post route shape present');
  assert.ok(postAuthIdx < postParseIdx, 'authentication must precede body parse in post_private_memory');
  assert.ok(postParseIdx < postNormalized.indexOf('create_owner_memory('), 'body parse must precede create mutation');

  const putBody = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put');
  const putNormalized = compact(putBody);
  const putAuthIdx = putNormalized.indexOf('require_authenticated_principal(authorization)');
  const putParseIdx = putNormalized.indexOf('awaitparse_json_body(request)');
  assert.ok(putAuthIdx !== -1 && putParseIdx !== -1, 'put route shape present');
  assert.ok(putAuthIdx < putParseIdx, 'authentication must precede body parse in put_private_memory');
  assert.ok(putParseIdx < putNormalized.indexOf('update_owner_memory('), 'body parse must precede update mutation');

  const deleteNormalized = compact(getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'delete'));
  const deleteAuthIdx = deleteNormalized.indexOf('require_authenticated_principal(authorization)');
  assert.ok(deleteAuthIdx !== -1, 'delete route authenticates');
  assert.ok(
    deleteAuthIdx < deleteNormalized.indexOf('delete_owner_memory('),
    'authentication must precede the delete mutation'
  );
});

test('7. Firebase-only verifier boundary is preserved verbatim in modal_compute/auth.py', () => {
  const source = readModalAuth();
  const normalized = compactCode(getFunctionBody(source, 'require_authenticated_principal'));

  // Delegates to the unchanged Firebase verifier — same token, same errors.
  assert.match(
    normalized,
    /user=require_firebase_user\(authorization\)/,
    'require_authenticated_principal must delegate to require_firebase_user'
  );

  // Firebase remains the only accepted issuer; legacyOwnerId is the verified UID.
  assert.match(normalized, /"provider":"firebase"/);
  assert.match(normalized, /"providersubject":uid/);
  assert.match(normalized, /"legacyownerid":uid/);

  // No email-based identity, account linking surface, or accountId invention
  // inside the principal projection.
  assert.doesNotMatch(normalized, /email/);
  assert.doesNotMatch(normalized, /accountid/i);

  // The underlying verifier error contract is untouched: 401 Authentication
  // required / Invalid ID token and 503 cert-fetch unavailable remain in auth.py.
  const firebaseUserNormalized = compact(getFunctionBody(source, 'require_firebase_user'));
  assert.match(firebaseUserNormalized, /status_code=401,detail="authenticationrequired"/);
  assert.match(firebaseUserNormalized, /detail="invalididtoken"/);
  assert.match(firebaseUserNormalized, /status_code=503,detail="authenticationservicetemporarilyunavailable"/);
});

test('8. every other previously-Firebase-user route keeps its direct call (no drift)', () => {
  const source = readModalApp();
  for (const [name, method, route] of OTHER_FIREBASE_USER_ROUTES) {
    const normalized = compact(getRouteFunctionBody(source, route, method));
    assert.match(
      normalized,
      /require_firebase_user/,
      `${name} must keep its direct require_firebase_user call (outside #4181 scope)`
    );
  }
});

test('9. exactly three require_firebase_user callers were removed from app.py', () => {
  const source = readModalApp();
  const callerPattern = /@web_app\.(get|post|put|delete)\("([^"]+)"[\s\S]*?(?:async\s+)?def\s+(\w+)\s*\([^)]*\)[\s\S]*?(?=@web_app\.|$)/g;
  const callers = [];
  let match;
  while ((match = callerPattern.exec(source)) !== null) {
    if (/require_firebase_user/.test(match[0])) callers.push(match[3]);
  }
  const expectedCallers = OTHER_FIREBASE_USER_ROUTES.map(([name]) => name).sort();
  assert.deepEqual(callers.sort(), expectedCallers,
    'the exact require_firebase_user caller set must be previous set minus the three Memory write routes');
});
