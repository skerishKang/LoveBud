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

// VM-based dynamic tests for resolveTreeWorkspaceCanEdit
test('5a. resolveTreeWorkspaceCanEdit: viewerCanEdit true is verified with active confirmed user', () => {
  const tree = { id: 't1', viewerCanEdit: true };
  const user = { uid: 'u123' };
  
  const canEditOwner = runPermissionInSandbox(tree, user, true);
  assert.equal(canEditOwner, true, 'should be true with valid logged in user');

  const canEditSignedOut = runPermissionInSandbox(tree, null, false);
  assert.equal(canEditSignedOut, false, 'should be false if guest/signed out');

  const canEditNoUid = runPermissionInSandbox(tree, {}, true);
  assert.equal(canEditNoUid, false, 'should be false if user has no uid');
});

test('5b. resolveTreeWorkspaceCanEdit: viewerCanEdit false is always false', () => {
  const tree = { id: 't1', viewerCanEdit: false, ownerId: 'u123' };
  const user = { uid: 'u123' };
  const canEdit = runPermissionInSandbox(tree, user, true);
  assert.equal(canEdit, false, 'should return false immediately when viewerCanEdit is false');
});

test('5c. resolveTreeWorkspaceCanEdit: requestedReadOnly is respected first', () => {
  const tree = { id: 't1', viewerCanEdit: true };
  const user = { uid: 'u123' };
  const canEdit = runPermissionInSandbox(tree, user, true, true);
  assert.equal(canEdit, false, 'should return false if read only is requested');
});

test('6. public-canvas-init poller, confirmed auth, capability call, UI update, and stale prevention existence', () => {
  const src = readInitJs();
  const compactSrc = compact(src);

  // Assert poller exists and handles confirmed auth
  assert.match(compactSrc, /pollownerauth/, 'must have a deferred poller function');
  assert.match(compactSrc, /ap\.hasconfirmedauthsession\(\)/, 'poller must check for confirmed auth');

  // Assert request snapshotting & active tree comparison
  assert.match(compactSrc, /targettreedata=window\.__viewertreedata/, 'must snapshot active treeData');
  assert.match(compactSrc, /targettreeid=targettreedata&&targettreedata\.id/, 'must snapshot treeId');
  assert.match(compactSrc, /activetreedata!==targettreedata/, 'must compare active treeData to snapshot on resolution');

  // Assert lifecycle deduplication guard
  assert.match(compactSrc, /targettreedata\._capabilityfetching/, 'must use in-flight marker on treeData lifecycle object');

  // Assert updateUI call
  assert.match(compactSrc, /updateownermodeui\(\)/, 'must trigger UI update upon capability resolution');
});

test('7. mode=edit URL query parameter does not grant viewer capability', () => {
  const src = readInitJs();
  const fn = getTopLevelFunction(src, 'updateOwnerModeUI');
  assert.ok(fn.length > 0, 'updateOwnerModeUI must exist');
  assert.ok(!fn.includes("params.get('mode')"), 'mode URL parameter must not be used to grant capability');
});
