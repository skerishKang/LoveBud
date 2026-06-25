'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sourceContains(file, pattern) {
  const src = readSource(file);
  if (pattern instanceof RegExp) return pattern.test(src);
  return src.indexOf(pattern) !== -1;
}

// ── Shared permission helper ──────────────────────────────────────

test('0. shared helper file exists with correct API', () => {
  const src = readSource('js/shared/tree-workspace-permission.js');
  assert.ok(src.length > 0, 'shared helper must not be empty');
  assert.ok(
    src.indexOf('resolveTreeOwnerId') !== -1,
    'must export resolveTreeOwnerId'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'must export resolveTreeWorkspaceCanEdit'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'must attach to window.LoveBudTreeWorkspacePermission'
  );
});

test('0b. shared helper supports ownerId and owner_id fields', () => {
  const src = readSource('js/shared/tree-workspace-permission.js');
  assert.ok(
    src.indexOf('tree.ownerId') !== -1 || src.indexOf("tree['ownerId']") !== -1,
    'must read tree.ownerId'
  );
  assert.ok(
    src.indexOf('tree.owner_id') !== -1,
    'must read tree.owner_id for API shape compatibility'
  );
});

// ── editor.js: effectiveCanEdit via shared helper ─────────────────

test('1. editor.js computes effectiveCanEdit after tree load', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.indexOf('effectiveCanEdit') !== -1,
    'editor.js must define effectiveCanEdit'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'editor.js must use shared permission helper'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'editor.js must call resolveTreeWorkspaceCanEdit'
  );
});

test('2. editor.js defaults to readonly (canEdit: false) before tree load', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    src.indexOf("canEdit: false") !== -1,
    'editor.js must pass canEdit: false to shell applier (default readonly)'
  );
  assert.ok(
    !sourceContains('js/editor.js', 'canEdit,\n                log\n            });'),
    'must NOT pass raw URL canEdit to shell applier'
  );
});

test('3. mode toggle injection uses effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  assert.ok(
    /if\s*\(effectiveCanEdit\s*&&/.test(src),
    'Desktop mode toggle injection must use effectiveCanEdit'
  );
});

test('4. createEditorCanvas receives effectiveCanEdit', () => {
  assert.ok(
    sourceContains('js/editor.js', "canEdit: effectiveCanEdit"),
    'createEditorCanvas options must use effectiveCanEdit'
  );
});

test('5. createEditorMemoryActions receives effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  const matches = src.match(/canEdit:\s*effectiveCanEdit/g);
  assert.ok(
    matches && matches.length >= 3,
    'At least 3 downstream consumers must use effectiveCanEdit (got ' + (matches ? matches.length : 0) + ')'
  );
});

// ── mode=edit activation gated by effectiveCanEdit ────────────────

test('5b. mode=edit activation is gated by effectiveCanEdit', () => {
  const src = readSource('js/editor.js');
  // mode=edit must be gated on effectiveCanEdit, not raw canEdit
  assert.ok(
    src.indexOf("mode === 'edit' && effectiveCanEdit") !== -1,
    'mode=edit activation must require effectiveCanEdit'
  );
});

// ── Public viewer topbar ─────────────────────────────────────────

test('6. public viewer topbar has 보기|편집 mode group', () => {
  const src = readSource('js/viewer/public-viewer-canvas-topbar-template.js');
  assert.ok(
    src.indexOf('viewerModeGroup') !== -1,
    'Topbar must have viewerModeGroup container'
  );
  assert.ok(
    src.indexOf('viewerModeViewBtn') !== -1,
    'Topbar must have view mode button'
  );
  assert.ok(
    src.indexOf('viewerModeEditBtn') !== -1,
    'Topbar must have edit mode CTA button'
  );
});

// ── public-canvas-init: shared helper integration ────────────────

test('7. public-canvas-init uses shared permission helper', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('updateOwnerModeUI') !== -1,
    'Must have updateOwnerModeUI'
  );
  assert.ok(
    src.indexOf('viewerModeGroup') !== -1,
    'Must reference viewerModeGroup'
  );
  assert.ok(
    src.indexOf('LoveBudTreeWorkspacePermission') !== -1,
    'Must use shared helper LoveBudTreeWorkspacePermission'
  );
  assert.ok(
    src.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'Must call resolveTreeWorkspaceCanEdit'
  );
});

// ── Viewer sidebar ───────────────────────────────────────────────

test('8. viewer sidebar populates rich flow summary', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('viewerSidebarSummary') !== -1,
    'Must reference viewerSidebarSummary element'
  );
  assert.ok(
    src.indexOf('preview-summary-line') !== -1,
    'Must render rich summary with preview-summary-line class'
  );
  assert.ok(
    src.indexOf('treeData.description') !== -1 || src.indexOf('description || treeData.summary') !== -1,
    'Must use description/summary fallback chain'
  );
  assert.ok(
    src.indexOf("style.display = 'none'") !== -1,
    'Must hide summary element when no description available'
  );
});

test('8b. sidebar moment count excludes canonical root', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('nonRootMemories = allMemories.filter') !== -1,
    'Must filter memories for non-root count'
  );
  assert.ok(
    src.indexOf('isRootMemory(m, canonicalRootId)') !== -1,
    'Must use isRootMemory with canonicalRootId to exclude root'
  );
});

// ── Detail tree meta: edit CTAs removed ──────────────────────────

test('9. detail tree meta has no edit CTA buttons', () => {
  const src = readSource('js/viewer/public-viewer-detail-tree-meta.js');
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'editBtn'),
    'Must NOT create editBtn in buildTreeMetaRenderModel'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'vv-edit-btn-dynamic'),
    'Must NOT have dynamic edit button class'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'registerOnAuthReady'),
    'Must NOT register auth callback for edit CTA injection'
  );
  assert.ok(
    !sourceContains('js/viewer/public-viewer-detail-tree-meta.js', 'apiFetch(\'/trees/'),
    'Must NOT re-fetch tree for edit CTA injection'
  );
});

// ── Editor startup context ───────────────────────────────────────

test('10. editor-startup-context preserves URL source for canEdit hint', () => {
  const src = readSource('js/editor/editor-startup-context.js');
  assert.ok(
    src.indexOf("params.get('readonly')") !== -1,
    'Startup context still reads readonly from URL'
  );
  assert.ok(
    src.indexOf("params.get('mode')") !== -1,
    'Startup context still reads mode from URL'
  );
});

// ── Autoplay and reactions guard preservation ────────────────────

test('11. viewer detail UI preserves autoplay and reactions guards', () => {
  const src = readSource('js/viewer/public-viewer-detail-ui.js');
  // Verify existing guardrail patterns are still present
  assert.ok(
    src.indexOf('createPublicViewerReadOnlyReactionSummaryBoundary') !== -1,
    'Must preserve read-only reaction summary boundary'
  );
  assert.ok(
    src.indexOf('applyReadOnlyReactionFallback') !== -1,
    'Must preserve read-only reaction fallback function'
  );
  assert.ok(
    src.indexOf('is-public-readonly') !== -1,
    'Must preserve is-public-readonly CSS class'
  );
  assert.ok(
    src.indexOf('buildYouTubeEmbedUrl') !== -1,
    'Must preserve YouTube embed URL builder'
  );
  assert.ok(
    src.indexOf('data-editor-detail-player') !== -1,
    'Must preserve inline player guard attribute'
  );
});

// ── Page script load order ────────────────────────────────────────

test('12. editor.html loads tree-workspace-permission in correct order', () => {
  const src = readSource('pages/editor.html');
  const authPolicyIdx = src.indexOf('auth-policy.js');
  const permissionIdx = src.indexOf('tree-workspace-permission.js');
  const editorJsIdx = src.indexOf('js/editor.js');
  assert.ok(authPolicyIdx !== -1, 'editor.html must load auth-policy.js');
  assert.ok(permissionIdx !== -1, 'editor.html must load tree-workspace-permission.js');
  assert.ok(editorJsIdx !== -1, 'editor.html must load editor.js');
  assert.ok(
    authPolicyIdx < permissionIdx,
    'auth-policy.js must load BEFORE tree-workspace-permission.js'
  );
  assert.ok(
    permissionIdx < editorJsIdx,
    'tree-workspace-permission.js must load BEFORE editor.js'
  );
});

test('13. view.html loads tree-workspace-permission in correct order', () => {
  const src = readSource('pages/view.html');
  const authPolicyIdx = src.indexOf('auth-policy.js');
  const permissionIdx = src.indexOf('tree-workspace-permission.js');
  const initJsIdx = src.indexOf('public-canvas-init.js');
  assert.ok(authPolicyIdx !== -1, 'view.html must load auth-policy.js');
  assert.ok(permissionIdx !== -1, 'view.html must load tree-workspace-permission.js');
  assert.ok(initJsIdx !== -1, 'view.html must load public-canvas-init.js');
  assert.ok(
    authPolicyIdx < permissionIdx,
    'auth-policy.js must load BEFORE tree-workspace-permission.js'
  );
  assert.ok(
    permissionIdx < initJsIdx,
    'tree-workspace-permission.js must load BEFORE public-canvas-init.js'
  );
});

// ── updateOwnerModeUI runtime contract ────────────────────────────

test('14. public-canvas-init calls updateOwnerModeUI with selectionState and normalized treeData', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('updateOwnerModeUI(selectionState, normalized.treeData)') !== -1,
    'startCanvas must call updateOwnerModeUI with selectionState and normalized.treeData'
  );
  assert.ok(
    src.indexOf('function updateOwnerModeUI(selectionState, providedTreeData)') !== -1,
    'updateOwnerModeUI must accept selectionState and providedTreeData args'
  );
  assert.ok(
    src.indexOf('var treeData = providedTreeData || window.currentTreeData || null;') !== -1,
    'helper must use provided treeData arg before falling back to global'
  );
});

test('15. public-canvas-init updateOwnerModeUI handles view button as current state', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('viewBtn.disabled = true') !== -1,
    'View button must be disabled in current View state'
  );
  assert.ok(
    src.indexOf("viewBtn.setAttribute('aria-current', 'true')") !== -1,
    'View button must have aria-current=true'
  );
  assert.ok(
    src.indexOf("editBtn.removeAttribute('aria-current')") !== -1,
    'Edit button must not have aria-current'
  );
});

test('16. public-canvas-init updateOwnerModeUI hides mode group for guest/non-owner', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf("modeGroup.style.display = 'none'") !== -1,
    'Guest/non-owner must hide mode group'
  );
});

test('17. public-canvas-init updateOwnerModeUI edit button includes treeId, mode=edit, memoryId', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf("params = 'treeId=' + encodeURIComponent(currentTreeId) + '&mode=edit'") !== -1,
    'Edit button URL must include treeId and mode=edit params'
  );
  assert.ok(
    src.indexOf("params += '&memoryId=' + encodeURIComponent(selectedMemoryId)") !== -1,
    'Edit button URL must include memoryId when selected'
  );
});

// ── Owner mode deferred reconciliation ────────────────────────────

test('18. deferred auth poller re-evaluates owner mode when auth confirms late', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('pollOwnerAuth') !== -1,
    'Must have a deferred auth poller function'
  );
  assert.ok(
    /if\s*\(\s*conf\s*\)\s*\{/.test(src),
    'Poller must call updateOwnerModeUI when auth is confirmed'
  );
  assert.ok(
    src.indexOf('window.LoveBudPublicCanvasInit.updateOwnerModeUI()') !== -1,
    'Poller must invoke updateOwnerModeUI when auth confirms'
  );
  assert.ok(
    src.indexOf('ap.hasConfirmedAuthSession()') !== -1,
    'Poller must check hasConfirmedAuthSession'
  );
});

test('19. deferred auth poller exits without mode group when guest is settled', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('window.__lovebudAuthReady === true') !== -1,
    'Poller must check __lovebudAuthReady to detect settled guest state'
  );
  // The poller must call updateOwnerModeUI then return for both confirmed and guest-settled paths
  var confReeval = src.indexOf('if (conf)');
  var guestSettled = src.indexOf('window.__lovebudAuthReady === true');
  assert.ok(
    confReeval < guestSettled,
    'Auth confirmation check must come before guest settled check in poller'
  );
  // After guest settled, no more setTimeout(..., 200) should follow in the same block
  var guestReturnIndex = src.indexOf('return;', guestSettled);
  var setTimeoutAfterGuest = src.indexOf('setTimeout(pollOwnerAuth, 200)', guestSettled);
  assert.ok(
    guestReturnIndex !== -1,
    'Guest settled path must return to stop polling'
  );
  assert.ok(
    setTimeoutAfterGuest === -1 || setTimeoutAfterGuest > guestReturnIndex,
    'No setTimeout should follow the guest-settled return in the poller'
  );
});

test('20. updateOwnerModeUI does not read mode=edit from URL to grant permission', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  // The owner mode decision must come only from resolveTreeWorkspaceCanEdit,
  // never from URL params.get('mode')
  var fnStart = src.indexOf('function updateOwnerModeUI');
  var fnEnd = src.indexOf('function installPublicCanvasToolbarCompactMode', fnStart);
  var fnBody = src.slice(fnStart, fnEnd);
  assert.ok(
    fnBody.indexOf('params.get(\'mode\')') === -1,
    'updateOwnerModeUI must not read mode from URL via params.get'
  );
  assert.ok(
    fnBody.indexOf('resolveTreeWorkspaceCanEdit') !== -1,
    'updateOwnerModeUI must base decision on resolveTreeWorkspaceCanEdit'
  );
  // mode=edit appears in the edit button URL builder (navigating to editor)
  // but never as a permission check conditional
  var modeEditCount = (fnBody.match(/mode=edit/g) || []).length;
  assert.ok(
    modeEditCount <= 1,
    'mode=edit must appear at most once in updateOwnerModeUI (URL builder only): got ' + modeEditCount
  );
});

test('21. owner mode click handler is registered at most once', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  assert.ok(
    src.indexOf('if (!editBtn[handlerKey])') !== -1,
    'Must guard against duplicate click handler registration with editBtn[handlerKey]'
  );
  assert.ok(
    src.indexOf("editBtn.addEventListener('click', editBtn[handlerKey])") !== -1,
    'Click handler must be added via addEventListener'
  );
  // The addEventListener should only appear once (guarded by the if check)
  var handlerRegistrations = src.match(/addEventListener\('click', editBtn\[handlerKey\]\)/g);
  assert.ok(
    handlerRegistrations && handlerRegistrations.length === 1,
    'Click handler must be registered exactly once in updateOwnerModeUI'
  );
});

test('22. deferred poller starts only after initial owner mode evaluation', () => {
  const src = readSource('js/viewer/public-canvas-init.js');
  // The poller is defined and started after the initial updateOwnerModeUI call
  var initialUpdate = src.indexOf('updateOwnerModeUI(selectionState, normalized.treeData)');
  var pollerDefinition = src.indexOf('normalized.treeData._ownerCapabilityPollerStarted');
  assert.ok(
    initialUpdate !== -1,
    'Initial owner mode evaluation must be present'
  );
  assert.ok(
    pollerDefinition !== -1,
    'Deferred poller definition must be present'
  );
  assert.ok(
    initialUpdate < pollerDefinition,
    'Initial updateOwnerModeUI must be called before deferred poller starts'
  );
});

test('23. editor auth-late reconciliation contracts and dynamic VM assertions', async () => {
  const editorHtml = readSource('pages/editor.html');
  assert.ok(editorHtml.includes('tree-workspace-permission.js?v=20260625-2874-auth-hotfix-1'), 'tree-workspace-permission.js version must be updated');
  assert.ok(editorHtml.includes('editor.js?v=20260625-2874-auth-hotfix-1'), 'editor.js version must be updated');

  const editorJsSrc = readSource('js/editor.js');
  assert.ok(editorJsSrc.includes('_editorAuthEditabilityCallbackRegistered'), 'Must have editor auth callback registration guard');
  assert.ok(editorJsSrc.includes('registerOnAuthReady'), 'Must register auth ready callback');

  const registeredCallbacks = [];
  let applyEditorEditabilityCalls = [];

  const sandbox = {
    document: {
      addEventListener: (event, handler) => {
        if (event === 'DOMContentLoaded') {
          handler();
        }
      }
    },
    URLSearchParams: class {
      get() {
        return 'test-tree-id';
      }
    },
    window: {
      LoveBudEditorEntryDependencies: {
        resolveEditorEntryDependencies: () => ({
          status: 'ready',
          deps: {
            applyEditorShellCopy: () => {},
            safeI18nText: () => '',
            i18n: {},
            getMyTreesHref: () => '',
            createPrepareEditorShell: () => () => {},
            createEditorDebugReporter: () => ({ log: () => {}, reportError: () => {} }),
            bindEditorPageEvents: () => {},
            runEditorInitialLoadFlow: (options) => {
              const tree = { id: 'test-tree-id', viewerCanEdit: false, _viewerCapabilityAuthUid: 'user123' };
              if (options && typeof options.syncCurrentTreeData === 'function') {
                options.syncCurrentTreeData(tree);
              }
              return Promise.resolve({
                status: 'success',
                treeId: 'test-tree-id',
                tree: tree,
                treeMemories: () => []
              });
            },
            createEditorRefreshSaveRuntime: () => ({
              status: 'success',
              saveStatusData: {},
              updateSaveStatus: () => {}
            }),
            createEditorStartupContext: () => ({
              canvas: {},
              svg: {},
              detailPanel: {},
              addBtn: {},
              urlTreeId: 'test-tree-id',
              canEdit: false,
              mode: 'edit',
              memoryId: null
            }),
            shellHelpers: {
              createEditorStartDependencyGuard: () => () => true,
              createEditorStartDependencyChecker: () => () => true,
              createEditorRequiredGlobalWaiter: () => async () => true,
              createEditorStartupShellApplier: () => () => {},
              createEditorCanvasEmptyGuideUpdater: () => () => {},
              createEditorSelectNodeHandler: () => () => {},
              createEditorSidebarStatusUpdater: () => () => {},
              createEditorInitialMemoryProvider: () => () => {},
              createEditorNextMemoryIdProvider: () => () => {},
              createEditorInitialSelectionApplier: () => () => {},
              createEditorReadyFinalizer: () => () => {}
            },
            createEditorStartupDependencyWaiter: () => async () => true,
            markEditorReady: () => {},
            applyEditorEditabilityState: (state) => {
              applyEditorEditabilityCalls.push(state);
            },
            createEditorDomRefs: () => ({}),
            exposeCanvasEmptyGuideUpdater: () => {},
            exposeDetailPanelUpdater: () => {},
            createSidebarTreeActionsUpdater: () => () => {},
            createMemoryActionsReadinessWrapper: () => () => {},
            createCurrentMomentDetailOpener: () => () => {},
            createSelectedMomentFocusHandler: () => () => {},
            editorTreeHelpers: {
              createInitialMemory: () => {},
              createTreeVisibilityUpdater: () => () => {}
            },
            nextMemoryIdFromMemories: () => {},
            getCanonicalRootId: () => 'root-id',
            editorSelectionUI: {},
            editorSaveStatus: {},
            editorPageHelpers: {},
            editorDataLoader: {},
            getMyTreesHref: () => 'my-trees-mocked-href',
            getConfirmedSessionUser: () => ({}),
            redirectToEditorLogin: () => {},
            buildTreeLoadErrorCopy: () => {},
            renderTreeLoadError: () => {},
            syncCurrentTreeData: (tree) => {
              sandbox.window.currentTreeData = tree;
            },
            escapeHtml: () => '',
            findRootMemory: () => {},
            resolveTreeTitleText: () => '',
            resolveHintText: () => '',
            resolveInfoText: () => '',
            resolveMemoryThumbnail: () => '',
            isRootMemory: () => false,
            resolveParentIdForCreate: () => {},
            getYouTubeInputErrorMessage: () => '',
            getHttpStatus: () => 200,
            editorBindings: {},
            getEditorBasePath: () => '',
            readConfirmedAuthCache: () => null,
            registerEditorAuthStart: (options) => {
              options.startEditor();
            }
          }
        })
      },
      createEditorDetailUI: () => ({
        setDetailEmptyState: () => {},
        updateFocusSelectedBtn: () => {},
        updateSidebarStatus: () => {},
        updateDetailPanel: () => {}
      }),
      createEditorCanvas: () => ({
        initCanvas: () => {}
      }),
      createEditorMemoryActions: () => ({}),
      createEditorMemoryForm: () => ({}),
      registerOnAuthReady: (callback) => {
        registeredCallbacks.push(callback);
      },
      LoveBudTreeWorkspacePermission: {
        resolveTreeWorkspaceCanEdit: (tree) => {
          return !!tree.viewerCanEdit;
        }
      }
    }
  };

  sandbox.window.window = sandbox.window;
  const vm = require('node:vm');
  vm.createContext(sandbox);
  vm.runInContext(editorJsSrc, sandbox);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(registeredCallbacks.length, 1, 'registerOnAuthReady must be called to register late auth callback');
  const callback = registeredCallbacks[0];

  const loadedTree = sandbox.window.currentTreeData;
  assert.ok(loadedTree, 'loaded tree must exist');
  assert.equal(loadedTree._editorAuthEditabilityCallbackRegistered, true, 'marker must be set on tree');

  // When canEdit remains true (switch/login retains edit), no redirection happens
  loadedTree.viewerCanEdit = true;
  let redirected = false;
  sandbox.window.location = {
    pathname: '/pages/editor.html',
    origin: 'http://localhost',
    search: '?treeId=test-tree-id',
    set href(val) {
      if (val.includes('my-trees')) {
        redirected = true;
      }
    },
    get href() { return ''; }
  };
  callback();
  assert.equal(redirected, false, 'callback must not exit if user still has edit permissions');

  // When user is logout (viewerCanEdit = false), it MUST redirect/exit to my-trees
  loadedTree.viewerCanEdit = false;
  let targetHref = '';
  sandbox.window.location = {
    pathname: '/pages/editor.html',
    origin: 'http://localhost',
    search: '?treeId=test-tree-id',
    set href(val) {
      targetHref = val;
      if (val.includes('my-trees')) {
        redirected = true;
      }
    },
    get href() { return ''; }
  };
  callback();
  assert.equal(redirected, true, 'callback must trigger exit to my-trees on auth logout');
  assert.equal(targetHref, 'my-trees-mocked-href', 'Must redirect exactly to deps.getMyTreesHref() result');
  assert.ok(!targetHref.startsWith('http'), 'Must be a relative/context-safe path without origin prefix');
});
