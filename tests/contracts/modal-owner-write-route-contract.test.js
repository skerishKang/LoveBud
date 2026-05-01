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
  // Handle both regular functions and async functions
  const match = normalizedSource.match(new RegExp(`(?:async\\s+)?def\\s+${functionName}\\s*\\([\\s\\S]*?(?=\\n\\n+(?:async\\s+)?def\\s+|\\n\\n\\n|\\n\\n@|$)`));
  assert.ok(match, `missing ${functionName}`);
  return match[0];
}

function getRouteFunctionBody(source, routeName, method) {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  // For path parameters, escape the curly braces
  const escapedRouteName = routeName.replace(/\{([^}]+)\}/g, '\\{$1\\}');

  // Find the specific route by method and path
  const routePattern = `@web_app\\.${method}\\(["']${escapedRouteName}["'][\\s\\S]*?(?:async\\s+)?def\\s+[\\w_]+\\s*\\([^)]*\\)`;
  const decoratorMatch = normalizedSource.match(new RegExp(routePattern));
  assert.ok(decoratorMatch, `missing route ${method} ${routeName}`);

  // Find the function body starting from the decorator
  const startIndex = normalizedSource.indexOf(decoratorMatch[0]);
  const remaining = normalizedSource.substring(startIndex);

  // Extract the decorator and function body (up to next decorator or end)
  const functionBodyMatch = remaining.match(/(@web_app\.[^(]*\([^)]*\)[\s\S]*?(?:async\s+)?def\s+[\w_]+\s*\([^)]*\)[\s\S]*?)(?=@web_app\.|\n\n\n|\n\n@|$)/);
  assert.ok(functionBodyMatch, `missing function body ${method} ${routeName}`);
  return functionBodyMatch[1];
}

// create_owner_tree helper contracts
test('create_owner_tree uses validate_optional_string for title with max 200', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_optional_string.*title.*200/i,
    'create_owner_tree must validate title with max 200 characters'
  );
});

test('create_owner_tree uses validate_visibility with public fallback', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'create_owner_tree must validate visibility with public fallback'
  );
});

test('create_owner_tree calls require_plus_for_private_storage', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'create_owner_tree must call require_plus_for_private_storage'
  );
});

test('create_owner_tree INSERT targets trees table with correct columns', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /insertinto/i,
    'create_owner_tree must use INSERT'
  );

  assert.match(
    normalized,
    /trees/i,
    'create_owner_tree must target trees table'
  );

  assert.match(
    normalized,
    /id.*owner_id.*title.*visibility.*created_at.*updated_at/i,
    'create_owner_tree must include all required columns'
  );
});

test('create_owner_tree generates uuid and passes owner_id, title, visibility', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /uuid\.uuid4\(\)/i,
    'create_owner_tree must generate uuid'
  );

  assert.match(
    normalized,
    /owner_id.*title.*visibility/i,
    'create_owner_tree must pass owner_id, title, visibility in params'
  );
});

test('create_owner_tree calls normalize_tree_row with memory count 0', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /normalize_tree_row.*row.*0/i,
    'create_owner_tree must call normalize_tree_row with memory count 0'
  );
});

// create_owner_memory helper contracts
test('create_owner_memory uses validate_required_uuid for treeId', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(payload\.get\("treeid"\),"treeid"\)/i,
    'create_owner_memory must validate treeId as required UUID'
  );
});

test('create_owner_memory calls fetch_owner_tree with tree_id and owner_id', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /fetch_owner_tree.*tree_id.*owner_id/i,
    'create_owner_memory must call fetch_owner_tree with tree_id and owner_id'
  );
});

test('create_owner_memory raises 403 when tree not owned', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*tree/i,
    'create_owner_memory must check if tree exists'
  );

  assert.match(
    normalized,
    /httpexception.*403.*access.*denied.*not.*your.*tree/i,
    'create_owner_memory must raise 403 with access denied message'
  );
});

test('create_owner_memory uses tree visibility fallback', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /visibility.*validate_visibility.*visibility.*tree.*visibility/i,
    'create_owner_memory must use tree visibility as fallback'
  );
});

test('create_owner_memory calls require_plus_for_private_storage', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'create_owner_memory must call require_plus_for_private_storage'
  );
});

test('create_owner_memory guards emotionTags max 20 items', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /emotiontags.*isinstance.*list/i,
    'create_owner_memory must check emotionTags is list'
  );

  assert.match(
    normalized,
    /len.*emotiontags.*20/i,
    'create_owner_memory must guard emotionTags max 20 items'
  );

  assert.match(
    normalized,
    /httpexception.*400.*emotiontags.*exceeds.*maximum.*20/i,
    'create_owner_memory must raise 400 for too many emotionTags'
  );
});

test('create_owner_memory INSERT targets memories table', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /insertinto.*memories/i,
    'create_owner_memory must INSERT into memories table'
  );
});

test('create_owner_memory calls normalize_memory_row', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /normalize_memory_row.*row/i,
    'create_owner_memory must call normalize_memory_row'
  );
});

// update_owner_tree helper contracts
test('update_owner_tree uses validate_required_uuid for treeId', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(tree_id,"treeid"\)/i,
    'update_owner_tree must validate treeId as required UUID'
  );
});

test('update_owner_tree calls require_tree_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner.*safe_tree_id.*owner_id/i,
    'update_owner_tree must call require_tree_owner'
  );
});

test('update_owner_tree only allows title and visibility updates', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /title.*in.*payload/i,
    'update_owner_tree must check title in payload'
  );

  assert.match(
    normalized,
    /visibility.*in.*payload/i,
    'update_owner_tree must check visibility in payload'
  );

  assert.match(
    normalized,
    /validate_optional_string.*title.*200/i,
    'update_owner_tree must validate title when updating'
  );
});

test('update_owner_tree validates visibility changes and calls require_plus_for_private_storage', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'update_owner_tree must validate visibility changes'
  );

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'update_owner_tree must call require_plus_for_private_storage on visibility change'
  );
});

test('update_owner_tree returns fetch_owner_tree when no updates', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*updates/i,
    'update_owner_tree must check for no updates'
  );

  assert.match(
    normalized,
    /fetch_owner_tree.*safe_tree_id.*owner_id/i,
    'update_owner_tree must return fetch_owner_tree when no updates'
  );
});

test('update_owner_tree UPDATE includes owner_id guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*trees.*set.*updated_at.*now\(\)/i,
    'update_owner_tree must UPDATE trees with updated_at'
  );

  assert.match(
    normalized,
    /where.*id.*=.*%s.*and.*owner_id.*=.*%s/i,
    'update_owner_tree WHERE clause must include both id and owner_id'
  );
});

test('update_owner_tree raises 404 when no rows affected', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*row/i,
    'update_owner_tree must check if row was updated'
  );

  assert.match(
    normalized,
    /httpexception.*404.*tree.*not.*found/i,
    'update_owner_tree must raise 404 when tree not found'
  );
});

// delete_owner_tree helper contracts
test('delete_owner_tree uses validate_required_uuid for treeId', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(tree_id,"treeid"\)/i,
    'delete_owner_tree must validate treeId as required UUID'
  );
});

test('delete_owner_tree calls require_tree_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner.*safe_tree_id.*owner_id/i,
    'delete_owner_tree must call require_tree_owner'
  );
});

test('delete_owner_tree cleans up child memory parent relationships', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*memories.*set.*parent_id.*null.*where.*tree_id/i,
    'delete_owner_tree must clean up child memory parent relationships'
  );
});

test('delete_owner_tree deletes memories by tree_id', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*memories.*where.*tree_id/i,
    'delete_owner_tree must delete memories by tree_id'
  );
});

test('delete_owner_tree DELETE includes owner_id guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*trees.*where.*id.*=.*%s.*and.*owner_id.*=.*%s/i,
    'delete_owner_tree DELETE WHERE must include both id and owner_id'
  );
});

test('delete_owner_tree raises 404 when tree not found', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*row/i,
    'delete_owner_tree must check if tree was deleted'
  );

  assert.match(
    normalized,
    /httpexception.*404.*tree.*not.*found/i,
    'delete_owner_tree must raise 404 when tree not found'
  );
});

test('delete_owner_tree returns deleted shape with id', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /deleted.*true.*id.*row.*id/i,
    'delete_owner_tree must return {deleted: True, id: ...} shape'
  );
});

// update_owner_memory helper contracts
test('update_owner_memory uses validate_required_uuid for memoryId', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(memory_id,"memoryid"\)/i,
    'update_owner_memory must validate memoryId as required UUID'
  );
});

test('update_owner_memory calls require_memory_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner.*safe_memory_id.*owner_id/i,
    'update_owner_memory must call require_memory_owner'
  );
});

test('update_owner_memory only allows specific update fields', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /title.*in.*payload/i,
    'update_owner_memory must check title in payload'
  );

  assert.match(
    normalized,
    /memo.*in.*payload/i,
    'update_owner_memory must check memo in payload'
  );

  assert.match(
    normalized,
    /emotiontags.*in.*payload/i,
    'update_owner_memory must check emotionTags in payload'
  );

  assert.match(
    normalized,
    /visibility.*in.*payload/i,
    'update_owner_memory must check visibility in payload'
  );
});

test('update_owner_memory guards emotionTags max 20 items', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /emotiontags.*isinstance.*list/i,
    'update_owner_memory must check emotionTags is list'
  );

  assert.match(
    normalized,
    /len.*emotiontags.*20/i,
    'update_owner_memory must guard emotionTags max 20 items'
  );

  assert.match(
    normalized,
    /httpexception.*400.*emotiontags.*exceeds.*maximum.*20/i,
    'update_owner_memory must raise 400 for too many emotionTags'
  );
});

test('update_owner_memory validates visibility changes and calls require_plus_for_private_storage', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'update_owner_memory must validate visibility changes'
  );

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'update_owner_memory must call require_plus_for_private_storage on visibility change'
  );
});

test('update_owner_memory returns require_memory_owner row when no updates', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*updates/i,
    'update_owner_memory must check for no updates'
  );

  assert.match(
    normalized,
    /require_memory_owner.*safe_memory_id.*owner_id/i,
    'update_owner_memory must return require_memory_owner row when no updates'
  );

  assert.match(
    normalized,
    /normalize_memory_row.*memory/i,
    'update_owner_memory must normalize memory row when no updates'
  );
});

test('update_owner_memory UPDATE includes tree owner guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*memories.*set.*updated_at.*now\(\)/i,
    'update_owner_memory must UPDATE memories with updated_at'
  );

  assert.match(
    normalized,
    /where.*id.*=.*%s.*and.*exists.*select.*1.*from.*trees.*t.*where.*t\.id.*=.*memories\.tree_id.*and.*t\.owner_id.*=.*%s/i,
    'update_owner_memory WHERE clause must include tree owner guard'
  );
});

test('update_owner_memory raises 404 when memory not found', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*row/i,
    'update_owner_memory must check if memory was updated'
  );

  assert.match(
    normalized,
    /httpexception.*404.*memory.*not.*found/i,
    'update_owner_memory must raise 404 when memory not found'
  );
});

// delete_owner_memory helper contracts
test('delete_owner_memory uses validate_required_uuid for memoryId', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(memory_id,"memoryid"\)/i,
    'delete_owner_memory must validate memoryId as required UUID'
  );
});

test('delete_owner_memory calls require_memory_owner', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner.*safe_memory_id.*owner_id/i,
    'delete_owner_memory must call require_memory_owner'
  );
});

test('delete_owner_memory cleans up sibling/child parent relationships', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*memories.*set.*parent_id.*null.*where.*tree_id.*and.*parent_id/i,
    'delete_owner_memory must clean up sibling/child parent relationships'
  );
});

test('delete_owner_memory DELETE includes tree owner guard', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*memories.*where.*id.*=.*%s.*and.*exists.*select.*1.*from.*trees.*t.*where.*t\.id.*=.*memories\.tree_id.*and.*t\.owner_id.*=.*%s/i,
    'delete_owner_memory DELETE WHERE clause must include tree owner guard'
  );
});

test('delete_owner_memory raises 404 when memory not found', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /if.*not.*row/i,
    'delete_owner_memory must check if memory was deleted'
  );

  assert.match(
    normalized,
    /httpexception.*404.*memory.*not.*found/i,
    'delete_owner_memory must raise 404 when memory not found'
  );
});

test('delete_owner_memory returns deleted shape with id', () => {
  const source = readModalApp();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /deleted.*true.*id.*row.*id/i,
    'delete_owner_memory must return {deleted: True, id: ...} shape'
  );
});

// Private write route contracts
test('post_private_tree calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'post_private_tree must call require_firebase_user'
  );
});

test('post_private_tree handles invalid JSON body with 400', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /try.*payload.*await.*request\.json\(\)/i,
    'post_private_tree must try to parse JSON body'
  );

  assert.match(
    normalized,
    /except.*jsondecodeerror.*httpexception.*400.*invalid.*json.*body/i,
    'post_private_tree must raise 400 for invalid JSON'
  );
});

test('post_private_tree calls create_owner_tree with user uid and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /create_owner_tree.*user.*uid.*payload.*isinstance.*payload.*dict.*else.*{}/i,
    'post_private_tree must call create_owner_tree with user uid and payload'
  );
});

test('post_private_memory calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'post_private_memory must call require_firebase_user'
  );
});

test('post_private_memory handles invalid JSON body with 400', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /try.*payload.*await.*request\.json\(\)/i,
    'post_private_memory must try to parse JSON body'
  );

  assert.match(
    normalized,
    /except.*jsondecodeerror.*httpexception.*400.*invalid.*json.*body/i,
    'post_private_memory must raise 400 for invalid JSON'
  );
});

test('post_private_memory calls create_owner_memory with user uid and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /create_owner_memory.*user.*uid.*payload.*isinstance.*payload.*dict.*else.*{}/i,
    'post_private_memory must call create_owner_memory with user uid and payload'
  );
});

test('put_private_tree calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'put_private_tree must call require_firebase_user'
  );
});

test('put_private_tree handles invalid JSON body with 400', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /try.*payload.*await.*request\.json\(\)/i,
    'put_private_tree must try to parse JSON body'
  );

  assert.match(
    normalized,
    /except.*jsondecodeerror.*httpexception.*400.*invalid.*json.*body/i,
    'put_private_tree must raise 400 for invalid JSON'
  );
});

test('put_private_tree calls update_owner_tree with user uid, tree_id, and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update_owner_tree.*user.*uid.*tree_id.*payload.*isinstance.*payload.*dict.*else.*{}/i,
    'put_private_tree must call update_owner_tree with user uid, tree_id, and payload'
  );
});

test('delete_private_tree calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'delete');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'delete_private_tree must call require_firebase_user'
  );
});

test('delete_private_tree calls delete_owner_tree with user uid and tree_id', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'delete');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete_owner_tree.*user.*uid.*tree_id/i,
    'delete_private_tree must call delete_owner_tree with user uid and tree_id'
  );
});

test('put_private_memory calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'put_private_memory must call require_firebase_user'
  );
});

test('put_private_memory handles invalid JSON body with 400', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /try.*payload.*await.*request\.json\(\)/i,
    'put_private_memory must try to parse JSON body'
  );

  assert.match(
    normalized,
    /except.*jsondecodeerror.*httpexception.*400.*invalid.*json.*body/i,
    'put_private_memory must raise 400 for invalid JSON'
  );
});

test('put_private_memory calls update_owner_memory with user uid, memory_id, and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update_owner_memory.*user.*uid.*memory_id.*payload.*isinstance.*payload.*dict.*else.*{}/i,
    'put_private_memory must call update_owner_memory with user uid, memory_id, and payload'
  );
});

test('delete_private_memory calls require_firebase_user', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'delete');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_firebase_user.*authorization/i,
    'delete_private_memory must call require_firebase_user'
  );
});

test('delete_private_memory calls delete_owner_memory with user uid and memory_id', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'delete');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete_owner_memory.*user.*uid.*memory_id/i,
    'delete_private_memory must call delete_owner_memory with user uid and memory_id'
  );
});
