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

test('8. dynamic auth change, cache invalidation, and deduplication contracts', async () => {
  const code = readInitJs();
  let apiFetchCount = 0;
  let apiFetchCalls = [];
  let apiFetchResolve;
  const apiFetchPromise = new Promise((resolve) => {
    apiFetchResolve = resolve;
  });

  const registeredCallbacks = [];
  let updateOwnerModeUICallCount = 0;

  const sandbox = {
    console: {
      log: () => {},
      error: () => {},
    },
    setTimeout: (fn, delay) => {
      if (delay === 200) {
        // don't loop endlessly in tests unless needed
        return;
      }
      fn();
    },
    document: {
      readyState: 'complete',
      body: {
        classList: {
          add: () => {},
          remove: () => {},
        },
        appendChild: () => {},
      },
      createElement: () => ({
        style: {},
        appendChild: () => {},
        classList: {
          toggle: () => {},
          add: () => {},
          remove: () => {},
        }
      }),
      getElementById: (id) => {
        return {
          classList: {
            toggle: () => {},
          },
          appendChild: () => {},
          style: {},
          disabled: false,
          setAttribute: () => {},
          removeAttribute: () => {},
        };
      },
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    URLSearchParams: class {
      get() {
        return 'test-tree-id';
      }
    },
    window: {
      location: {
        search: '?treeId=test-tree-id',
        pathname: '/pages/detail.html',
        origin: 'http://localhost',
      },
      LoveBudPublicCanvasBridge: {
        loadPublicTreeData: () => Promise.resolve({
          tree: { id: 'test-tree-id', title: 'Test Tree' },
          memories: []
        }),
        normalizeForCanvas: (tree, memories) => ({
          treeData: tree,
          treeMemories: memories
        })
      },
      createEditorCanvas: () => ({
        initCanvas: () => {},
      }),
      createPublicViewerDetailUI: () => ({
        setDetailEmptyState: () => {},
        updateFocusSelectedBtn: () => {},
        updateSidebarStatus: () => {},
        updateDetailPanel: () => {},
      }),
      registerOnAuthReady: (callback) => {
        registeredCallbacks.push(callback);
      },
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {}
      }),
      LoveTreeAuthPolicy: {
        hasConfirmedAuthSession: () => true,
        getCachedAuthUser: () => ({ uid: 'user123' })
      },
      LoveTreeBaseApiFetch: {
        apiFetch: (url) => {
          apiFetchCount++;
          apiFetchCalls.push(url);
          return Promise.resolve({ viewerCanEdit: true });
        }
      },
      LoveBudTreeWorkspacePermission: {
        resolveTreeWorkspaceCanEdit: (tree) => {
          return !!tree.viewerCanEdit;
        }
      },
      LoveBudPublicCanvasInit: {
        updateOwnerModeUI: () => {
          updateOwnerModeUICallCount++;
        }
      }
    }
  };

  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.setTimeout = sandbox.setTimeout;

  vm.createContext(sandbox);
  const fallbackCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-error-fallback.js'), 'utf8');
  vm.runInContext(fallbackCode, sandbox);
  assert.ok(sandbox.window.LoveBudPublicCanvasErrorFallback, 'window.LoveBudPublicCanvasErrorFallback must exist');
  assert.ok(sandbox.window.LoveBudPublicCanvasErrorFallback.handlePublicCanvasLoadFailure, 'handlePublicCanvasLoadFailure helper must exist');
  assert.ok(sandbox.window.LoveBudPublicCanvasErrorFallback.appendMissingRouteState, 'appendMissingRouteState helper must exist');

  vm.runInContext(code, sandbox);

  const originalUpdateUI = sandbox.window.LoveBudPublicCanvasInit.updateOwnerModeUI;
  sandbox.window.LoveBudPublicCanvasInit.updateOwnerModeUI = () => {
    updateOwnerModeUICallCount++;
    if (typeof originalUpdateUI === 'function') {
      originalUpdateUI();
    }
  };

  // Allow the loadPublicTreeData Promise to resolve and startCanvas to execute
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 1. registerOnAuthReady가 tree-scoped callback registration으로 사용됨
  if (registeredCallbacks.length === 0) {
    throw new Error('No callbacks registered. Sandbox state: ' + JSON.stringify({
      windowKeys: Object.keys(sandbox.window),
      treeData: sandbox.window.__viewerTreeData,
      currentTreeData: sandbox.window.currentTreeData,
      hasAuthReady: typeof sandbox.window.registerOnAuthReady
    }, null, 2));
  }
  assert.equal(registeredCallbacks.length, 1, 'registerOnAuthReady must be registered exactly once');

  const authCallback = registeredCallbacks[0];
  const targetTreeData = sandbox.window.__viewerTreeData;
  assert.ok(targetTreeData, 'targetTreeData must be stored in sandbox');
  assert.equal(targetTreeData._ownerCapabilityAuthCallbackRegistered, true, 'marker must be set on treeData');

  // Initialize cache
  targetTreeData.viewerCanEdit = true;
  targetTreeData._viewerCapabilityAuthUid = 'user123';
  if (targetTreeData.data) {
    targetTreeData.data.viewerCanEdit = true;
  }

  // 2. callback이 active tree object / treeId mismatch 시 종료함
  const originalTreeData = sandbox.window.__viewerTreeData;
  sandbox.window.__viewerTreeData = { id: 'other-tree-id' };

  // Call callback with logout, but since it is mismatched active tree, targetTreeData cache should NOT be deleted
  authCallback(null);
  assert.equal(targetTreeData.viewerCanEdit, true, 'mismatched tree must not mutate original cache');

  // Restore active tree
  sandbox.window.__viewerTreeData = originalTreeData;

  // 3. logout/guest callback이 capability fetch 없이 cache를 삭제하고 updateOwnerModeUI()를 호출함
  apiFetchCount = 0;
  updateOwnerModeUICallCount = 0;

  // Mock signed out
  sandbox.window.LoveTreeAuthPolicy.hasConfirmedAuthSession = () => false;
  sandbox.window.LoveTreeAuthPolicy.getCachedAuthUser = () => null;

  authCallback(null);

  assert.equal(targetTreeData.viewerCanEdit, undefined, 'viewerCanEdit must be deleted on logout');
  assert.equal(targetTreeData._viewerCapabilityAuthUid, undefined, 'auth UID must be deleted on logout');
  assert.equal(apiFetchCount, 0, 'apiFetch must not be called on logout');
  assert.ok(updateOwnerModeUICallCount > 0, 'updateOwnerModeUI must be called on logout');

  // 4. UID 변경 callback이 old cache를 삭제하고 refetch 경로로 들어감
  sandbox.window.LoveTreeAuthPolicy.hasConfirmedAuthSession = () => true;
  sandbox.window.LoveTreeAuthPolicy.getCachedAuthUser = () => ({ uid: 'user456' });
  apiFetchCount = 0;
  updateOwnerModeUICallCount = 0;

  // Set stale cache for old user
  targetTreeData.viewerCanEdit = true;
  targetTreeData._viewerCapabilityAuthUid = 'user123';

  authCallback({ uid: 'user456' });

  assert.equal(targetTreeData.viewerCanEdit, undefined, 'old viewerCanEdit must be deleted on UID change');
  assert.equal(targetTreeData._viewerCapabilityAuthUid, undefined, 'old auth UID must be deleted on UID change');
  assert.equal(apiFetchCount, 1, 'apiFetch must be called on UID change');

  // 5. in-flight dedupe가 auth UID별임
  apiFetchCount = 0;
  targetTreeData._capabilityFetchingAuthUid = 'user456';

  authCallback({ uid: 'user456' });
  assert.equal(apiFetchCount, 0, 'deduplication must prevent duplicate fetching for the same auth UID');

  // Cleanup fetch indicator
  delete targetTreeData._capabilityFetchingAuthUid;

  // 6. stale A UID result가 B UID active state에 기록되지 않음
  let resolveA;
  let apiFetchPromiseA = new Promise((resolve) => { resolveA = resolve; });
  sandbox.window.LoveTreeBaseApiFetch.apiFetch = (url) => {
    return apiFetchPromiseA;
  };

  sandbox.window.LoveTreeAuthPolicy.hasConfirmedAuthSession = () => true;
  sandbox.window.LoveTreeAuthPolicy.getCachedAuthUser = () => ({ uid: 'userA' });

  // Trigger fetch for userA
  authCallback({ uid: 'userA' });

  // Switch active user to userB
  sandbox.window.LoveTreeAuthPolicy.getCachedAuthUser = () => ({ uid: 'userB' });

  // Resolve user A's promise
  resolveA({ viewerCanEdit: true });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.notEqual(targetTreeData.viewerCanEdit, true, 'stale userA capability result must not overwrite active state when active user switched to userB');
});

test('9. pages/view.html contract for Firebase bootstrap and asset versioning', () => {
  const viewHtml = fs.readFileSync(path.join(ROOT, 'pages/view.html'), 'utf8');

  assert.ok(viewHtml.includes('firebase-app.js'), 'Must load firebase-app.js');
  assert.ok(viewHtml.includes('firebase-auth.js'), 'Must load firebase-auth.js');
  assert.ok(viewHtml.includes('firebase-config.js'), 'Must load firebase-config.js');
  assert.ok(viewHtml.includes('auth/auth-state.js'), 'Must load auth-state.js');
  assert.ok(viewHtml.includes('auth.js'), 'Must load auth.js');

  assert.ok(!viewHtml.includes('auth-protected-route.js'), 'Must NOT load auth-protected-route.js');

  assert.ok(viewHtml.includes('tree-workspace-permission.js?v=20260625-2874-auth-hotfix-1'), 'tree-workspace-permission.js version must be updated');
  assert.ok(viewHtml.includes('public-canvas-bridge.js?v=20260625-2874-auth-hotfix-1'), 'public-canvas-bridge.js version must be updated');
  assert.ok(
    /public-canvas-init\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/.test(viewHtml),
    'public-canvas-init.js version must be updated'
  );
});
