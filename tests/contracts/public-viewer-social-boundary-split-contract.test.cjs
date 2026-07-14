'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(src) {
  return fs.readFileSync(path.join(ROOT, src), 'utf8');
}

function getScriptSrcs() {
  const html = fs.readFileSync(path.join(ROOT, 'pages/view.html'), 'utf8');
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)]
    .map((match) => String(match[1] || '').split('?')[0]);
}

function loadEnv() {
  const info = { focusCallCount: 0, log: [] };
  const ctx = vm.createContext({
    window: {},
    document: {
      createElement: () => makeEl(info),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      get activeElement() { return null; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: { log: function(m) { info.log.push(m); } },
  });
  ctx.window = ctx;
  return { ctx, info };
}

function makeEl(info) {
  return {
    tagName: 'DIV', textContent: '', children: [],
    style: {}, dataset: {}, attributes: {},
    hidden: false, disabled: false, onclick: null, value: '',
    _disabled: false, _focusCallCount: 0, isConnected: true,
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); },
    },
    parentElement: null, parentNode: null,
    setAttribute(n, v) { this.attributes[n] = v; if (n === 'disabled') this._disabled = true; },
    removeAttribute(n) { delete this.attributes[n]; if (n === 'disabled') this._disabled = false; },
    getAttribute(n) { return this.attributes[n]; },
    appendChild(c) { this.children.push(c); c.parentElement = this; c.parentNode = this; },
    removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; c.parentNode = null; } },
    focus() { this._focusCallCount++; info.focusCallCount++; },
    contains(child) {
      if (!child) return false;
      if (child === this) return true;
      for (const c of this.children) { if (c === child || (c.contains && c.contains(child))) return true; }
      return false;
    },
    closest() { return this.parentElement || this; },
    querySelector() { return null; },
  };
}

function loadAllSocialModules(ctx) {
  const files = [
    'js/viewer/public-viewer-read-only-social-summary.js',
    'js/viewer/public-viewer-authenticated-like.js',
    'js/viewer/public-viewer-authenticated-comment-composer.js',
  ];
  files.forEach(f => vm.runInContext(read(f), ctx));
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('social boundary split contract', () => {

  it('1: three new social boundary files exist', () => {
    const files = [
      'js/viewer/public-viewer-read-only-social-summary.js',
      'js/viewer/public-viewer-authenticated-like.js',
      'js/viewer/public-viewer-authenticated-comment-composer.js',
    ];
    files.forEach(f => {
      assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} must exist`);
    });
  });

  it('2: each file exports the correct factory to its window namespace', () => {
    const { ctx } = loadEnv();
    loadAllSocialModules(ctx);

    assert.equal(typeof ctx.window.LoveBudPublicViewerReadOnlySocialSummary, 'object');
    assert.equal(typeof ctx.window.LoveBudPublicViewerReadOnlySocialSummary.createPublicViewerReadOnlyReactionSummaryBoundary, 'function',
      'read-only social summary namespace must have the factory function');

    assert.equal(typeof ctx.window.LoveBudPublicViewerAuthenticatedLike, 'object');
    assert.equal(typeof ctx.window.LoveBudPublicViewerAuthenticatedLike.createPublicViewerAuthenticatedLikeBoundary, 'function',
      'authenticated like namespace must have the factory function');

    assert.equal(typeof ctx.window.LoveBudPublicViewerAuthenticatedCommentComposer, 'object');
    assert.equal(typeof ctx.window.LoveBudPublicViewerAuthenticatedCommentComposer.createPublicViewerAuthenticatedCommentComposerBoundary, 'function',
      'authenticated comment composer namespace must have the factory function');
  });

  it('3: pages/view.html loads social files before detail-ui', () => {
    const raw = getScriptSrcs();
    const detailIdx = raw.findIndex(s => s.includes('public-viewer-detail-ui.js'));
    assert.ok(detailIdx >= 0, 'detail-ui script must be present');

    const socialScripts = [
      'public-viewer-read-only-social-summary.js',
      'public-viewer-authenticated-like.js',
      'public-viewer-authenticated-comment-composer.js',
    ];
    socialScripts.forEach(name => {
      const idx = raw.findIndex(s => s.includes(name));
      assert.ok(idx >= 0, `${name} must be in view.html`);
      assert.ok(idx < detailIdx, `${name} must be before detail-ui`);
    });
  });

  it('4: detail-ui validates three namespaces at load time and uses them in composition', () => {
    const { ctx } = loadEnv();

    // Load metadata-text (required by detail-ui)
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);
    loadAllSocialModules(ctx);

    // detail-ui should load without throwing
    vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);

    // Verify aliases are accessible on the compatibility namespace
    const ui = ctx.window.LoveBudPublicViewerDetailUI;
    assert.ok(ui, 'LoveBudPublicViewerDetailUI must exist');
    assert.equal(typeof ui.createPublicViewerReadOnlyReactionSummaryBoundary, 'function',
      'compatibility export for read-only summary must be a function');
    assert.equal(typeof ui.createPublicViewerAuthenticatedLikeBoundary, 'function',
      'compatibility export for authenticated like must be a function');

    // Verify createPublicViewerDetailUI uses the factory aliases
    assert.equal(typeof ui.createPublicViewerDetailUI, 'function',
      'createPublicViewerDetailUI must exist');
  });

  it('5: detail-ui has no old social boundary function declarations', () => {
    const source = read('js/viewer/public-viewer-detail-ui.js');
    const forbidden = [
      'function createPublicViewerReadOnlyReactionSummaryBoundary',
      'function createPublicViewerAuthenticatedLikeBoundary',
      'function createPublicViewerAuthenticatedCommentComposerBoundary',
    ];
    forbidden.forEach(name => {
      assert.equal(source.includes(name), false,
        `detail-ui must not contain '${name}' function declaration`);
    });
  });

  it('6: detail-ui compatibility namespace preserves read-only and like factory exports', () => {
    const { ctx } = loadEnv();
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);
    loadAllSocialModules(ctx);
    vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);

    const ns = ctx.window.LoveBudPublicViewerDetailUI;
    assert.equal(typeof ns.createPublicViewerReadOnlyReactionSummaryBoundary, 'function',
      'read-only factory re-export must be present');
    assert.equal(typeof ns.createPublicViewerAuthenticatedLikeBoundary, 'function',
      'like factory re-export must be present');

    // Composer factory should NOT be on the compatibility namespace
    assert.equal(ns.createPublicViewerAuthenticatedCommentComposerBoundary, undefined,
      'composer factory must NOT be on the detail-ui compatibility namespace');
  });

  it('7: read-only social file owns #3239 focus-return code', () => {
    const source = read('js/viewer/public-viewer-read-only-social-summary.js');

    // The focus-return wire is in wireCommentToggle — look for its key pattern
    assert.ok(source.includes('wasFocusInsideCurrentPanel'),
      'read-only file must contain wasFocusInsideCurrentPanel (focus-return capture)');
    assert.ok(source.includes('commentToggleEl.focus'),
      'read-only file must contain commentToggleEl.focus (focus restoration)');

    // Confirm composer file does NOT contain these
    const composerSource = read('js/viewer/public-viewer-authenticated-comment-composer.js');
    assert.equal(composerSource.includes('wasFocusInsideCurrentPanel'), false,
      'composer file must NOT contain focus-return capture');
    assert.equal(/\.focus\s*\(/.test(composerSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')), false,
      'composer file must NOT call .focus()');
    assert.equal(/activeElement/.test(composerSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')), false,
      'composer file must NOT reference activeElement');
  });

  it('8: composer file has no .focus() or activeElement references', () => {
    const source = read('js/viewer/public-viewer-authenticated-comment-composer.js');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.equal(/\.focus\s*\(/.test(codeOnly), false,
      'composer must not call .focus()');
    assert.equal(/activeElement/.test(codeOnly), false,
      'composer must not reference activeElement outside comments');
  });

  it('9: no new hidden mutable cross-module globals introduced', () => {
    const { ctx } = loadEnv();
    loadAllSocialModules(ctx);

    // Each social module sets exactly its own namespace window property
    const socialNamespaces = [
      'LoveBudPublicViewerReadOnlySocialSummary',
      'LoveBudPublicViewerAuthenticatedLike',
      'LoveBudPublicViewerAuthenticatedCommentComposer',
    ];

    socialNamespaces.forEach(ns => {
      assert.ok(ctx.window[ns], `${ns} must be set on window`);
    });

    // Count window keys — should only be these three social namespaces
    // plus any built-in vm context keys
    const socialKeys = Object.keys(ctx.window).filter(k =>
      socialNamespaces.includes(k)
    );
    assert.equal(socialKeys.length, 3,
      'only the three social namespaces should be set (no unexpected globals)');
  });

  it('10: detail-ui top-level evaluation must NOT throw when social modules are missing', () => {
    // Load metadata-text but NOT social modules
    const { ctx } = loadEnv();
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);

    // Must not throw at top level — detail-ui registers itself regardless
    assert.doesNotThrow(() => {
      vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);
    }, 'detail-ui must load without throw when social modules are missing');

    // But must still register createPublicViewerDetailUI
    assert.equal(typeof ctx.window.createPublicViewerDetailUI, 'function',
      'createPublicViewerDetailUI must be registered');
    assert.equal(typeof ctx.window.LoveBudPublicViewerDetailUI, 'object',
      'compatibility namespace must be registered');
  });

  it('11: createPublicViewerDetailUI throws clear dependency error when social modules are missing', () => {
    const { ctx } = loadEnv();
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);
    vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);

    // Provide composer/renderer stubs to reach social validation layer
    ctx.window.LoveBudPublicViewerAppreciationComposer = {
      composePublicViewerAppreciationPresentation: function() { return { slots: [] }; }
    };
    ctx.window.LoveBudPublicViewerAppreciationDomRenderer = {
      createPublicViewerAppreciationDomRenderer: function() {
        return { render: function() {}, reset: function() {} };
      }
    };

    // Prepare enough deps to reach social validation
    var deps = {
      getSelectedNodeId: () => null,
      getTreeMemories: () => [],
      getCurrentTreeData: function() { return {}; },
      getTreeState: function() { return { hasMoments: true }; },
      getLocalSaveMode: function() { return 'view'; },
      i18n: function(k) { return k; },
      detailPanel: null,
      isRootMemory: function() { return false; },
      getCanonicalRootId: function() { return null; },
    };

    assert.throws(() => {
      ctx.window.createPublicViewerDetailUI(deps);
    }, /LoveBudPublicViewerReadOnlySocialSummary/,
      'createPublicViewerDetailUI must throw when read-only social summary namespace is missing');
  });

  it('12: three social modules loaded in order enables factory composition', () => {
    const { ctx } = loadEnv();
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);
    loadAllSocialModules(ctx);
    vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);

    // Verify compatibility exports are functions when modules are loaded
    const ui = ctx.window.LoveBudPublicViewerDetailUI;
    assert.equal(typeof ui.createPublicViewerReadOnlyReactionSummaryBoundary, 'function',
      'read-only factory must be available on compatibility namespace');
    assert.equal(typeof ui.createPublicViewerAuthenticatedLikeBoundary, 'function',
      'like factory must be available on compatibility namespace');

    // Verify createPublicViewerDetailUI exists and can be invoked
    assert.equal(typeof ctx.window.createPublicViewerDetailUI, 'function',
      'createPublicViewerDetailUI must exist');
  });

  it('13: read-only social summary has strict isConnected === true guard (no fallback)', () => {
    const source = read('js/viewer/public-viewer-read-only-social-summary.js');
    // Strict check: must have "commentToggleEl.isConnected === true"
    assert.ok(source.includes('commentToggleEl.isConnected === true'),
      'must use strict commentToggleEl.isConnected === true');
    // Must NOT have the old fallback pattern
    assert.equal(source.includes("typeof commentToggleEl.isConnected === 'undefined'"), false,
      'must NOT have undefined fallback for commentToggleEl.isConnected');
    // Strict check: must have "cardEl.isConnected === true"
    assert.ok(source.includes('cardEl.isConnected === true'),
      'must use strict cardEl.isConnected === true');
    // Must NOT have the old fallback pattern
    assert.equal(source.includes("typeof cardEl.isConnected === 'undefined'"), false,
      'must NOT have undefined fallback for cardEl.isConnected');
  });

  it('14: detail-ui has no old social boundary function declarations', () => {
    const source = read('js/viewer/public-viewer-detail-ui.js');
    const forbidden = [
      'function createPublicViewerReadOnlyReactionSummaryBoundary',
      'function createPublicViewerAuthenticatedLikeBoundary',
      'function createPublicViewerAuthenticatedCommentComposerBoundary',
    ];
    forbidden.forEach(name => {
      assert.equal(source.includes(name), false,
        `detail-ui must not contain '${name}' function declaration`);
    });
  });

  it('15: read-only social file owns #3239 focus-return code', () => {
    const source = read('js/viewer/public-viewer-read-only-social-summary.js');

    assert.ok(source.includes('wasFocusInsideCurrentPanel'),
      'read-only file must contain wasFocusInsideCurrentPanel (focus-return capture)');
    assert.ok(source.includes('commentToggleEl.focus'),
      'read-only file must contain commentToggleEl.focus (focus restoration)');

    const composerSource = read('js/viewer/public-viewer-authenticated-comment-composer.js');
    assert.equal(composerSource.includes('wasFocusInsideCurrentPanel'), false,
      'composer file must NOT contain focus-return capture');
    assert.equal(/\.focus\s*\(/.test(composerSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')), false,
      'composer file must NOT call .focus()');
    assert.equal(/activeElement/.test(composerSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')), false,
      'composer file must NOT reference activeElement');
  });

  it('16: composer file has no .focus() or activeElement references', () => {
    const source = read('js/viewer/public-viewer-authenticated-comment-composer.js');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.equal(/\.focus\s*\(/.test(codeOnly), false,
      'composer must not call .focus()');
    assert.equal(/activeElement/.test(codeOnly), false,
      'composer must not reference activeElement outside comments');
  });

  it('17: detail-ui loaded before social modules — factories resolve at call time, no stale null alias', () => {
    const { ctx } = loadEnv();

    // Load metadata-text first
    vm.runInContext(read('js/viewer/public-viewer-detail-metadata-text.js'), ctx);
    // Load detail-ui BEFORE social modules — must not throw
    assert.doesNotThrow(() => {
      vm.runInContext(read('js/viewer/public-viewer-detail-ui.js'), ctx);
    }, 'detail-ui must load without throw when social modules are not yet loaded');

    // Verify top-level throw is absent and namespace is registered
    assert.equal(typeof ctx.window.createPublicViewerDetailUI, 'function',
      'createPublicViewerDetailUI must be registered');
    assert.equal(typeof ctx.window.LoveBudPublicViewerDetailUI, 'object',
      'compatibility namespace must be registered');

    // Compatibility namespace was already frozen at top-level; these are null here
    // because the aliases were captured before social modules loaded.
    // That's acceptable per spec: "그 상태의 compatibility property가 null인 것은 허용됩니다."
    assert.equal(ctx.window.LoveBudPublicViewerDetailUI.createPublicViewerReadOnlyReactionSummaryBoundary, null,
      'compatibility read-only alias is null (captured before social modules loaded)');

    // Now load social modules in correct order
    loadAllSocialModules(ctx);

    // Provide composer/renderer stubs for canonical appreciation chain
    ctx.window.LoveBudPublicViewerAppreciationComposer = {
      composePublicViewerAppreciationPresentation: function() { return { slots: [] }; }
    };
    ctx.window.LoveBudPublicViewerAppreciationDomRenderer = {
      createPublicViewerAppreciationDomRenderer: function() {
        return { render: function() {}, reset: function() {} };
      }
    };

    // Now call createPublicViewerDetailUI with proper deps — must not throw TypeError (stale null)
    var deps = {
      getSelectedNodeId: function() { return 'mem-1'; },
      getTreeMemories: function() { return [{ id: 'mem-1', treeId: 'tree-1' }]; },
      getCurrentTreeData: function() { return { id: 'tree-1' }; },
      getTreeState: function() { return { hasMoments: true }; },
      getLocalSaveMode: function() { return 'view'; },
      i18n: function(k) { return k; },
      detailPanel: null,
      isRootMemory: function() { return false; },
      getCanonicalRootId: function() { return null; },
    };

    // Must not throw — factories must resolve from current window state, not stale capture
    var detailUI;
    assert.doesNotThrow(() => {
      detailUI = ctx.window.createPublicViewerDetailUI(deps);
    }, 'createPublicViewerDetailUI must succeed when social modules are loaded after detail-ui');

    assert.equal(typeof detailUI, 'object', 'detailUI must be returned');
    assert.equal(typeof detailUI.updateDetailPanel, 'function',
      'updateDetailPanel must be available on detailUI');
  });

});
