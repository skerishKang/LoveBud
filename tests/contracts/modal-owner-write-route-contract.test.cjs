const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const OWNER_WRITES = path.join(ROOT, 'modal_compute', 'owner_writes.py');
const TREE_WRITES = path.join(ROOT, 'modal_compute', 'tree_writes.py');
const MEMORY_WRITES = path.join(ROOT, 'modal_compute', 'memory_writes.py');
const API_RESPONSE_HELPERS = path.join(ROOT, 'modal_compute', 'api_response_helpers.py');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function readOwnerWrites() {
  const dir = path.join(ROOT, 'modal_compute');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.py'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
}

function readApiResponseHelpers() {
  return fs.readFileSync(API_RESPONSE_HELPERS, 'utf8');
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

function assertParseJsonBodyHelperContract() {
  const source = readApiResponseHelpers();
  const body = getFunctionBody(source, 'parse_json_body');
  const normalized = compact(body);

  assert.match(
    normalized,
    /json\.loads\(body\)/i,
    'parse_json_body must parse request JSON'
  );

  assert.match(
    normalized,
    /exceptjson\.jsondecodeerror.*httpexception.*status_code=400.*invalidjsonbody/i,
    'parse_json_body must map JSONDecodeError to HTTP 400 Invalid JSON body'
  );

  assert.match(
    normalized,
    /ifnotisinstance\(payload,\s*dict\)\s*:.?\s*raise.*json_object_required/i,
    'parse_json_body must reject non-dict JSON with JSON_OBJECT_REQUIRED'
  );

  assert.match(
    normalized,
    /returnpayload/i,
    'parse_json_body must return parsed dict payload'
  );

  // Physical empty body still returns {}
  assert.match(
    normalized,
    /ifnotbody:.*return\{\}/i,
    'parse_json_body must return {} for physically empty body'
  );
}

function assertRouteParsesJsonViaHelper(normalized, routeLabel) {
  assert.match(
    normalized,
    /payload=awaitparse_json_body\(request\)/i,
    `${routeLabel} must parse JSON body through parse_json_body`
  );
  assertParseJsonBodyHelperContract();
}

function assertRoutePassesPayload(normalized, callee, argsPattern, routeLabel) {
  assert.match(
    normalized,
    new RegExp(`${callee}.*${argsPattern}.*payload`, 'i'),
    `${routeLabel} must call ${callee} with authenticated owner arguments and helper payload`
  );
}

// create_owner_tree helper contracts
test('create_owner_tree uses validate_optional_string for title with max 200', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_optional_string.*title.*200/i,
    'create_owner_tree must validate title with max 200 characters'
  );
});

test('create_owner_tree uses validate_visibility with public fallback', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'create_owner_tree must validate visibility with public fallback'
  );
});

test('create_owner_tree calls require_plus_for_private_storage', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'create_owner_tree must call require_plus_for_private_storage'
  );
});

test('create_owner_tree INSERT targets trees table with correct columns', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(payload\.get\("treeid"\),"treeid"\)/i,
    'create_owner_memory must validate treeId as required UUID'
  );
});

test('create_owner_memory calls fetch_owner_tree with tree_id and owner_id', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /fetch_owner_tree.*tree_id.*owner_id/i,
    'create_owner_memory must call fetch_owner_tree with tree_id and owner_id'
  );
});

test('create_owner_memory raises 403 when tree not owned', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /visibility.*validate_visibility.*visibility.*tree.*visibility/i,
    'create_owner_memory must use tree visibility as fallback'
  );
});

test('create_owner_memory calls require_plus_for_private_storage', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'create_owner_memory must call require_plus_for_private_storage'
  );
});

test('create_owner_memory guards emotionTags via strict helper', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /emotion_tags=validate_emotion_tags\(payload\["emotiontags"\]\)if"emotiontags"inpayloadelse\[\]/,
    'create_owner_memory must validate emotionTags through validate_emotion_tags with empty default'
  );

  // The strict validation contract lives in the shared helper (#3937).
  const helper = getFunctionBody(source, 'validate_emotion_tags');
  const helperNorm = compact(helper);
  assert.match(
    helperNorm,
    /isinstance\(value,list\)/,
    'validate_emotion_tags must check emotionTags is list'
  );
  assert.match(
    helperNorm,
    /len\(value\)>20/,
    'validate_emotion_tags must guard emotionTags max 20 items'
  );
  assert.match(
    helperNorm,
    /httpexception\(status_code=400,detail="emotiontagsexceedsmaximumof20items"\)/,
    'validate_emotion_tags must raise 400 for too many emotionTags'
  );
});

test('create_owner_memory INSERT targets memories table', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'create_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /insertinto.*memories/i,
    'create_owner_memory must INSERT into memories table'
  );
});

test('create_owner_memory calls normalize_memory_row', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(tree_id,"treeid"\)/i,
    'update_owner_tree must validate treeId as required UUID'
  );
});

test('update_owner_tree calls require_tree_owner', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner.*safe_tree_id.*owner_id/i,
    'update_owner_tree must call require_tree_owner'
  );
});

test('update_owner_tree only allows title and visibility updates', () => {
  const source = readOwnerWrites();
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

test('update_owner_tree validates the strict visibility update contract (3936)', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_explicit_visibility.*visibility/i,
    'update_owner_tree must validate visibility via the strict explicit validator'
  );

  assert.doesNotMatch(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'update_owner_tree must not fall back to validate_visibility(..., "public")'
  );

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'update_owner_tree must call require_plus_for_private_storage on visibility change'
  );
});

test('update_owner_tree returns fetch_owner_tree when no updates', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(tree_id,"treeid"\)/i,
    'delete_owner_tree must validate treeId as required UUID'
  );
});

test('delete_owner_tree calls require_tree_owner', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_tree_owner.*safe_tree_id.*owner_id/i,
    'delete_owner_tree must call require_tree_owner'
  );
});

test('delete_owner_tree cleans up child memory parent relationships', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*memories.*set.*parent_id.*null.*where.*tree_id/i,
    'delete_owner_tree must clean up child memory parent relationships'
  );
});

test('delete_owner_tree deletes memories by tree_id', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*memories.*where.*tree_id/i,
    'delete_owner_tree must delete memories by tree_id'
  );
});

test('delete_owner_tree DELETE includes owner_id guard', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*trees.*where.*id.*=.*%s.*and.*owner_id.*=.*%s/i,
    'delete_owner_tree DELETE WHERE must include both id and owner_id'
  );
});

test('delete_owner_tree raises 404 when tree not found', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(memory_id,"memoryid"\)/i,
    'update_owner_memory must validate memoryId as required UUID'
  );
});

test('update_owner_memory calls require_memory_owner', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner.*safe_memory_id.*owner_id/i,
    'update_owner_memory must call require_memory_owner'
  );
});

test('update_owner_memory only allows specific update fields', () => {
  const source = readOwnerWrites();
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
    /source.*in.*payload/i,
    'update_owner_memory must check source in payload'
  );

  assert.match(
    normalized,
    /sourceurl.*in.*payload/i,
    'update_owner_memory must check sourceUrl in payload'
  );

  assert.match(
    normalized,
    /sourcetype.*in.*payload/i,
    'update_owner_memory must check sourceType in payload'
  );

  assert.match(
    normalized,
    /thumbnail.*in.*payload/i,
    'update_owner_memory must check thumbnail in payload'
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

test('update_owner_memory maps source URL payload fields to DB columns', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /updates\.append\("source_url=%s"\).*validate_optional_memory_string\(payload\.get\("sourceurl"\),"sourceurl",1000\)/i,
    'update_owner_memory must map sourceUrl to source_url with the source URL limit'
  );

  assert.match(
    normalized,
    /updates\.append\("source_type=%s"\).*validate_optional_memory_string\(payload\.get\("sourcetype"\),"sourcetype",50\)/i,
    'update_owner_memory must map sourceType to source_type with the source type limit'
  );

  assert.match(
    normalized,
    /updates\.append\("thumbnail=%s"\).*validate_optional_memory_string\(payload\.get\("thumbnail"\),"thumbnail",500\)/i,
    'update_owner_memory must map thumbnail with the thumbnail limit'
  );
});

test('update_owner_memory guards emotionTags via strict helper', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_emotion_tags\(payload\["emotiontags"\]\)/,
    'update_owner_memory must validate emotionTags through validate_emotion_tags'
  );
  assert.match(
    normalized,
    /emotion_tags=%s/,
    'update_owner_memory must persist emotion_tags only when supplied'
  );

  // The strict validation contract lives in the shared helper (#3937).
  const helper = getFunctionBody(source, 'validate_emotion_tags');
  const helperNorm = compact(helper);
  assert.match(
    helperNorm,
    /isinstance\(value,list\)/,
    'validate_emotion_tags must check emotionTags is list'
  );
  assert.match(
    helperNorm,
    /len\(value\)>20/,
    'validate_emotion_tags must guard emotionTags max 20 items'
  );
  assert.match(
    helperNorm,
    /httpexception\(status_code=400,detail="emotiontagsexceedsmaximumof20items"\)/,
    'validate_emotion_tags must raise 400 for too many emotionTags'
  );
});

test('update_owner_memory validates visibility changes via strict update contract (3936)', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'update_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_explicit_visibility.*visibility/i,
    'update_owner_memory must validate visibility via the strict explicit validator'
  );

  assert.doesNotMatch(
    normalized,
    /validate_visibility.*visibility.*public/i,
    'update_owner_memory must not fall back to validate_visibility(..., "public")'
  );

  assert.match(
    normalized,
    /require_plus_for_private_storage.*owner_id.*visibility/i,
    'update_owner_memory must call require_plus_for_private_storage on visibility change'
  );
});

test('update_owner_memory returns require_memory_owner row when no updates', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /validate_required_uuid\(memory_id,"memoryid"\)/i,
    'delete_owner_memory must validate memoryId as required UUID'
  );
});

test('delete_owner_memory calls require_memory_owner', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /require_memory_owner.*safe_memory_id.*owner_id/i,
    'delete_owner_memory must call require_memory_owner'
  );
});

test('delete_owner_memory cleans up sibling/child parent relationships', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /update.*memories.*set.*parent_id.*null.*where.*tree_id.*and.*parent_id/i,
    'delete_owner_memory must clean up sibling/child parent relationships'
  );
});

test('delete_owner_memory DELETE includes tree owner guard', () => {
  const source = readOwnerWrites();
  const body = getFunctionBody(source, 'delete_owner_memory');
  const normalized = compact(body);

  assert.match(
    normalized,
    /delete.*from.*memories.*where.*id.*=.*%s.*and.*exists.*select.*1.*from.*trees.*t.*where.*t\.id.*=.*memories\.tree_id.*and.*t\.owner_id.*=.*%s/i,
    'delete_owner_memory DELETE WHERE clause must include tree owner guard'
  );
});

test('delete_owner_memory raises 404 when memory not found', () => {
  const source = readOwnerWrites();
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
  const source = readOwnerWrites();
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

  assertRouteParsesJsonViaHelper(normalized, 'post_private_tree');
});

test('post_private_tree calls create_owner_tree with user uid and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees', 'post');
  const normalized = compact(body);

  assertRoutePassesPayload(normalized, 'create_owner_tree', 'user.*uid', 'post_private_tree');
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

  assertRouteParsesJsonViaHelper(normalized, 'post_private_memory');
});

test('post_private_memory calls create_owner_memory with user uid and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories', 'post');
  const normalized = compact(body);

  assertRoutePassesPayload(normalized, 'create_owner_memory', 'user.*uid', 'post_private_memory');
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

  assertRouteParsesJsonViaHelper(normalized, 'put_private_tree');
});

test('put_private_tree calls update_owner_tree with user uid, tree_id, and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees/{tree_id}', 'put');
  const normalized = compact(body);

  assertRoutePassesPayload(normalized, 'update_owner_tree', 'user.*uid.*tree_id', 'put_private_tree');
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

  assertRouteParsesJsonViaHelper(normalized, 'put_private_memory');
});

test('put_private_memory calls update_owner_memory with user uid, memory_id, and payload', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/memories/{memory_id}', 'put');
  const normalized = compact(body);

  assertRoutePassesPayload(normalized, 'update_owner_memory', 'user.*uid.*memory_id', 'put_private_memory');
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
// --- #3481 owner binding fail-closed contracts ---

const AUTH_PY = path.join(ROOT, 'modal_compute', 'auth.py');
const TREES_PROXY = path.join(ROOT, 'functions', 'api', 'trees.js');

function readAuthPy() {
  return fs.readFileSync(AUTH_PY, 'utf8');
}

function readTreesProxy() {
  return fs.readFileSync(TREES_PROXY, 'utf8');
}

test('require_firebase_user derives identity from uid or sub only', () => {
  const source = readAuthPy();
  const body = getFunctionBody(source, 'require_firebase_user');
  const normalized = compact(body);

  assert.match(
    normalized,
    /uid=decoded\.get\("uid"\)ordecoded\.get\("sub"\)/i,
    'require_firebase_user must resolve identity from decoded.uid or decoded.sub'
  );

  assert.match(
    normalized,
    /ifnotuid:raisehttpexception\(status_code=401/i,
    'require_firebase_user must reject missing UID with 401'
  );

  assert.doesNotMatch(
    body,
    /@lovebud\.local|@test\.com|@example\.com/i,
    'require_firebase_user must not branch ownership by email domain'
  );
  assert.doesNotMatch(
    normalized,
    /email.*split|local.?part|domain.*allow|domain.*deny/i,
    'require_firebase_user must not derive UID from email local-part or domain lists'
  );
});

test('auth and tree write sources have no email-domain ownership branches', () => {
  const sources = [
    readAuthPy(),
    fs.readFileSync(TREE_WRITES, 'utf8'),
    readModalApp(),
    readTreesProxy(),
  ].join('\n');

  assert.doesNotMatch(
    sources,
    /@lovebud\.local|@test\.com|@example\.com/i,
    'runtime ownership path must not hard-code lovebud.local / test.com / example.com'
  );
});

test('post_private_tree passes verified email only as optional owner_email metadata', () => {
  const source = readModalApp();
  const body = getRouteFunctionBody(source, '/modal/private/trees', 'post');
  const normalized = compact(body);

  assert.match(
    normalized,
    /create_owner_tree\(user\["uid"\],payload,owner_email=user\.get\("email"\)or"",?\)/i,
    'post_private_tree must pass verified UID as owner and email only as owner_email metadata'
  );

  assert.doesNotMatch(
    normalized,
    /create_owner_tree\(\s*user\.get\("email"\)|create_owner_tree\(\s*user\["email"\]/i,
    'post_private_tree must not use email as the ownership identity argument'
  );
});

test('create_owner_tree rejects blank authenticated owner before mutation', () => {
  const source = fs.readFileSync(TREE_WRITES, 'utf8');
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /owner_id=str\(owner_idor""\)\.strip\(\)/i,
    'create_owner_tree must normalize owner_id'
  );

  assert.match(
    normalized,
    /ifnotowner_id:raisehttpexception\(status_code=401/i,
    'create_owner_tree must reject blank owner_id with 401'
  );

  const blankRejectIndex = normalized.search(/ifnotowner_id:raisehttpexception\(status_code=401/i);
  const insertIndex = normalized.search(/insertinto/i);
  const ensureIndex = normalized.search(/ensure_owner_user_exists/i);

  assert.ok(blankRejectIndex >= 0, 'blank owner reject must exist');
  assert.ok(insertIndex > blankRejectIndex, 'blank UID reject must run before INSERT');
  assert.ok(ensureIndex > blankRejectIndex, 'blank UID reject must run before ensure_owner_user_exists');
});

test('create_owner_tree INSERT includes owner_id bound to authenticated UID', () => {
  const source = fs.readFileSync(TREE_WRITES, 'utf8');
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /insertinto.*trees.*\(id,owner_id,/i,
    'create_owner_tree INSERT must include owner_id column'
  );

  assert.match(
    normalized,
    /cur\.execute\(\s*query,\s*\(\s*str\(uuid\.uuid4\(\)\),\s*owner_id,/i,
    'create_owner_tree INSERT params must bind authenticated owner_id'
  );
});

test('create_owner_tree passes verified email only to ensure_owner_user_exists metadata', () => {
  const source = fs.readFileSync(TREE_WRITES, 'utf8');
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /ensure_owner_user_exists\(owner_id,owner_email\)/i,
    'create_owner_tree must pass owner_email only as users metadata bootstrap'
  );

  assert.doesNotMatch(
    normalized,
    /owner_id\s*=\s*owner_email|owner_id\s*=\s*email/i,
    'create_owner_tree must never assign email to owner_id'
  );
});

test('create_owner_tree verifies returned owner_id before commit and rolls back on mismatch', () => {
  const source = fs.readFileSync(TREE_WRITES, 'utf8');
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /returned_owner_id=str\(\(rowor\{\}\)\.get\("owner_id"\)or""\)\.strip\(\)/i,
    'create_owner_tree must read returned owner_id from INSERT row'
  );

  assert.match(
    normalized,
    /ifnotroworreturned_owner_id!=owner_id/i,
    'create_owner_tree must reject missing/blank/mismatched returned owner_id'
  );

  assert.match(
    normalized,
    /conn\.rollback\(\)/i,
    'create_owner_tree must rollback on owner binding failure'
  );

  assert.match(
    normalized,
    /treeownerbindingfailed/i,
    'create_owner_tree must use a safe Tree owner binding failed error'
  );

  const verifyIndex = normalized.search(/ifnotroworreturned_owner_id!=owner_id/i);
  const rollbackIndex = normalized.search(/conn\.rollback\(\)/i);
  const commitIndex = normalized.search(/conn\.commit\(\)/i);

  assert.ok(verifyIndex >= 0, 'owner verification must exist');
  assert.ok(rollbackIndex > verifyIndex, 'rollback must follow failed verification');
  assert.ok(commitIndex > verifyIndex, 'commit must come after verification');
  // commit must not appear before the mismatch branch ends with rollback+raise
  const mismatchBlock = normalized.slice(verifyIndex, commitIndex);
  assert.match(
    mismatchBlock,
    /conn\.rollback\(\).*raisehttpexception/i,
    'mismatch path must rollback and raise before any commit'
  );

  assert.doesNotMatch(
    body,
    /Tree owner binding failed.*\{|detail=f["'].*owner|detail=.*owner_id|detail=.*email|detail=.*token/i,
    'owner binding failure must not interpolate UID, email, or token into the error'
  );
});

test('create_owner_tree success path still normalizes row with owner metadata', () => {
  const source = fs.readFileSync(TREE_WRITES, 'utf8');
  const body = getFunctionBody(source, 'create_owner_tree');
  const normalized = compact(body);

  assert.match(
    normalized,
    /normalize_tree_row\(row,0,include_owner_metadata=true\)/i,
    'successful create must still return normalized tree with owner metadata'
  );
});

test('cloudflare trees proxy forwards Authorization without ownerId injection or domain routing', () => {
  const source = readTreesProxy();
  const normalized = compact(source);

  assert.match(
    normalized,
    /authorization:request\.headers\.get\('authorization'\)/i,
    'trees.js must forward Authorization header to Modal upstream'
  );

  assert.doesNotMatch(
    source,
    /@lovebud\.local|@test\.com|@example\.com/i,
    'trees.js must not route by email domain'
  );

  assert.doesNotMatch(
    normalized,
    /ownerid\s*[:=]|body\.ownerid|payload\.ownerid/i,
    'trees.js must not inject or trust client ownerId into the request body'
  );
});
