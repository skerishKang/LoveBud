'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const MODAL_APP = path.join(ROOT, 'modal_compute', 'app.py');
const PUBLIC_READS = path.join(ROOT, 'modal_compute', 'public_reads.py');
const PERMISSION_JS = path.join(ROOT, 'js/shared/tree-workspace-permission.js');
const INIT_JS = path.join(ROOT, 'js/viewer/public-canvas-init.js');

function readModalApp() {
  return fs.readFileSync(MODAL_APP, 'utf8');
}

function readPublicReads() {
  return fs.readFileSync(PUBLIC_READS, 'utf8');
}

function readPermissionJs() {
  return fs.readFileSync(PERMISSION_JS, 'utf8');
}

function readInitJs() {
  return fs.readFileSync(INIT_JS, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function getTopLevelFunction(source, functionName) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => (
    new RegExp(`^\\s*(?:async\\s+)?function\\s+${functionName}\\b`).test(line)
  ));
  if (start === -1) return '';
  let braceCount = 0;
  let started = false;
  let end = start;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('{')) {
      braceCount += (line.match(/{/g) || []).length;
      started = true;
    }
    if (line.includes('}')) {
      braceCount -= (line.match(/}/g) || []).length;
    }
    if (started && braceCount <= 0) {
      end = index + 1;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function getPythonFunction(source, functionName) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => (
    new RegExp(`^(?:async\\s+)?def\\s+${functionName}\\s*\\(`).test(line)
  ));
  if (start === -1) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^(?:async\s+)?def\s+\w+\s*\(/.test(lines[index]) || /^class\s+\w+/.test(lines[index]) || /^@\w/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

// VM Sandbox helper
function runPermissionInSandbox(tree, mockUser, mockHasConfirmed = true, requestedReadOnly = false) {
  const code = readPermissionJs();
  const sandbox = {
    window: {
      LoveTreeAuthPolicy: {
        hasConfirmedAuthSession: () => mockHasConfirmed,
        getCachedAuthUser: () => mockUser
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const helper = sandbox.window.LoveBudTreeWorkspacePermission;
  return helper.resolveTreeWorkspaceCanEdit(tree, { requestedReadOnly });
}

// 1. public tree content path is secure (raw ownerId is hidden by include_owner=False)
test('1. fetch_public_tree normalizes response with include_owner=False', () => {
  const src = readPublicReads();
  const fn = getPythonFunction(src, 'fetch_public_tree');
  assert.ok(fn.length > 0, 'fetch_public_tree must exist');
  assert.match(
    compact(fn),
    /normalize_tree_row\(row,row\.get\("memory_count"\),include_owner=false\)/,
    'public read tree fetch must exclude ownerId'
  );
});

// 2. authenticated owner capability route handles lookup and returns boolean
test('2. authenticated owner capability route lookup structure', () => {
  const src = readModalApp();
  const fn = getPythonFunction(src, 'get_private_tree_capability');
  assert.ok(fn.length > 0, 'get_private_tree_capability must exist');
  const norm = compact(fn);
  assert.match(norm, /require_firebase_user\(authorization\)/, 'must authenticate firebase token');
  assert.match(norm, /fetch_owner_tree\(safe_tree_id,user\["uid"\]\)/, 'must perform owner database query');
  assert.match(norm, /"viewercanedit":treeisnotnone/, 'must return viewerCanEdit boolean');
});

// 3. authenticated non-owner capability route is false
test('3. authenticated non-owner capability returns false via fetch_owner_tree miss', () => {
  const src = readModalApp();
  const fn = getPythonFunction(src, 'get_private_tree_capability');
  const norm = compact(fn);
  assert.match(norm, /fetch_owner_tree/, 'must depend on owner tree existence check');
});

// 4. guest capability path returns false safely
test('4. guest returns viewerCanEdit=false on HTTP 401/403 or exception', () => {
  const src = readModalApp();
  const fn = getPythonFunction(src, 'get_private_tree_capability');
  const norm = compact(fn);
  assert.match(norm, /excepthttpexceptionase/, 'must handle HTTP exceptions');
  assert.match(norm, /if\s*e\.status_code\s*in\s*\{401,403\}:/, 'must capture auth failure codes');
  assert.match(norm, /"viewercanedit":false/, 'must fall back to false');
});

// VM-based dynamic tests for resolveTreeWorkspaceCanEdit (Permission helper VM dynamic tests)
test('5a. resolveTreeWorkspaceCanEdit: viewerCanEdit true is verified with matching UID', () => {
  const tree = { id: 't1', viewerCanEdit: true, _viewerCapabilityAuthUid: 'u123' };
  
  const canEditOwner = runPermissionInSandbox(tree, { uid: 'u123' }, true);
  assert.equal(canEditOwner, true, '1. true with matching _viewerCapabilityAuthUid');

  const canEditDiffOwner = runPermissionInSandbox(tree, { uid: 'u456' }, true);
  assert.equal(canEditDiffOwner, false, '2. false with different user UID');

  const canEditSignedOut = runPermissionInSandbox(tree, null, false);
  assert.equal(canEditSignedOut, false, '3. false if signed-out / no user');
});

test('5b. resolveTreeWorkspaceCanEdit: viewerCanEdit false is always false', () => {
  const tree = { id: 't1', viewerCanEdit: false, _viewerCapabilityAuthUid: 'u123' };
  const user = { uid: 'u123' };
  const canEdit = runPermissionInSandbox(tree, user, true);
  assert.equal(canEdit, false, '4. false with viewerCanEdit false');
});

test('5c. resolveTreeWorkspaceCanEdit: requestedReadOnly is respected first', () => {
  const tree = { id: 't1', viewerCanEdit: true, _viewerCapabilityAuthUid: 'u123' };
  const user = { uid: 'u123' };
  const canEdit = runPermissionInSandbox(tree, user, true, true);
  assert.equal(canEdit, false, '5. false if requestedReadOnly is true');
});

// Lifecycle static contract tests for public-canvas-init poller
test('6. public-canvas-init lifecycle checks for stale fetch and UID verification', () => {
  const src = readInitJs();
  const compactSrc = compact(src);

  // Assert targetAuthUid snapshot exist
  assert.match(compactSrc, /targetauthuid=/, 'poller must snapshot targetAuthUid');

  // Assert active tree object comparisons on resolve/reject
  assert.match(compactSrc, /checkactivetree!==targettreedata/, 'must check active tree object equivalence');

  // Assert active UID comparison on resolve/reject
  assert.match(compactSrc, /currentconfirmeduser\.uid!==targetauthuid/, 'must check active authenticated user UID matches targetAuthUid');

  // Assert _viewerCapabilityAuthUid is recorded on success and failure
  assert.match(compactSrc, /targettreedata\._viewercapabilityauthuid=targetauthuid;/, 'must save _viewerCapabilityAuthUid on success');

  // Assert treeData-scoped poller marker exist
  assert.match(compactSrc, /normalized\.treedata\&\&\!normalized\.treedata\._ownercapabilitypollerstarted/, 'must guard poller initialization on normalized.treeData scope');

  // Assert no global one-shot ownerAuthPoller guard blocks refetch
  assert.ok(!compactSrc.includes('window.lovebudpubliccanvasinit._ownerauthpoller=true'), 'global poller guard must be removed');

  // Assert cached capability UID mismatch invalidates cache
  assert.match(compactSrc, /targettreedata\._viewercapabilityauthuid!==targetauthuid/, 'must detect auth UID mismatch on cached data');
  assert.match(compactSrc, /deletetargettreedata\.viewercanedit/, 'must delete viewerCanEdit on UID mismatch');
  assert.match(compactSrc, /deletetargettreedata\._viewercapabilityauthuid/, 'must delete _viewerCapabilityAuthUid on UID mismatch');

  // Assert mode=edit query parameter is not query-granted
  assert.match(compactSrc, /updateownermodeui\(/, 'must evaluate UI correctly');
});

test('7. mode=edit URL query parameter does not grant viewer capability', () => {
  const src = readInitJs();
  const fn = getTopLevelFunction(src, 'updateOwnerModeUI');
  assert.ok(fn.length > 0, 'updateOwnerModeUI must exist');
  assert.ok(!fn.includes("params.get('mode')"), 'mode URL parameter must not be used to grant capability');
});
