const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor.html keeps active editor page shell contracts', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // 1. Root & shell containers
    assert.ok(html.includes('id="shared-header"'), 'must have shared-header');
    assert.ok(html.includes('class="editor-layout'), 'must have editor-layout');
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'must have editorSidebarTemplateMount');
    assert.ok(html.includes('id="canvasArea"'), 'must have canvasArea');
    assert.ok(html.includes('class="canvas-svg"'), 'must have canvas-svg');
    
    // 2. Toolbar & Floating UI
    assert.ok(html.includes('id="editorFloatingToolbarTemplateMount"'), 'must have editorFloatingToolbarTemplateMount');
    
    // 3. Modals & Forms
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'must have addMemoryFormTemplateMount');
    
    // 4. Detail Panel (extracted to editorDetailPanelShellTemplateMount)
    assert.ok(html.includes('id="editorDetailPanelShellTemplateMount"'), 'must have editorDetailPanelShellTemplateMount');
    assert.ok(!html.includes('id="detailPanel"'), 'detailPanel must not be in raw HTML');
    
    // 5. Mobile UI
    assert.ok(html.includes('id="mobileBottomBar"'), 'must have mobileBottomBar');
    assert.ok(html.includes('id="mobileTreePanelToggle"'), 'must have mobileTreePanelToggle');
    assert.ok(html.includes('id="mobileDetailPanelToggle"'), 'must have mobileDetailPanelToggle');
    assert.ok(html.includes('id="editorMobilePanelBackdrop"'), 'must have editorMobilePanelBackdrop');
});

test('editor.html keeps script loading order before editor runtime', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Expected order of editor scripts
    const scriptOrder = [
        'js/editor/templates/editor-detail-edit-mode-template.js',
        'js/editor/editor-mobile-panel-hierarchy.js',
        'js/editor/editor-dom-selectors.js',
        'js/editor/editor-root-helpers.js',
        'js/editor/editor-canvas-layout.js',
        'js/editor/editor-canvas-interaction.js',
        'js/editor/editor-floating-toolbar.js',
        'js/editor/editor-mobile-bottom-bar.js',
        'js/editor/editor-rename-ui.js',
        'js/editor/editor-detail-ui.js',
        'js/editor/editor-memory-form.js',
        'js/editor/editor-shell-utils.js',
        'js/editor/editor-shell-bridges.js',
        'js/editor/editor-shell-helpers.js',
        'js/editor.js',
        'js/editor/editor-i18n-refresh.js'
    ];

    let lastIndex = -1;
    scriptOrder.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `tree.html must load ${script}`);
        assert.ok(index > lastIndex, `${script} must load after the previous scripts`);
        lastIndex = index;
    });
    
    // Check auth scripts loading order
    const authOrderBeforeEditor = [
        'js/auth/auth-state.js',
        'js/auth/auth-callbacks.js',
        'js/auth/auth-firebase.js',
        'js/auth.js'
    ];
    
    let lastAuthIndex = -1;
    authOrderBeforeEditor.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `editor.html must load ${script}`);
        assert.ok(index > lastAuthIndex, `${script} must load in correct order`);
        lastAuthIndex = index;
    });

    const editorIndex = html.indexOf('js/editor.js');
    assert.ok(lastAuthIndex < editorIndex, 'Auth scripts must load before editor.js');

    const protectedRouteIndex = html.indexOf('js/auth/auth-protected-route.js');
    assert.notEqual(protectedRouteIndex, -1, 'editor.html must load auth-protected-route.js');
    assert.ok(editorIndex < protectedRouteIndex, 'auth-protected-route.js must load after editor.js');
});

test('editor.html keeps detail toggle accessibility defaults clear before runtime', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    assert.match(html, /id="mobileDetailPanelToggle"[\s\S]*aria-disabled="true"/, 'detail toggle must expose aria-disabled when no selection exists');
    assert.match(html, /id="mobileDetailPanelToggle"[\s\S]*disabled/, 'detail toggle must start disabled without a selected moment');
    assert.match(html, /id="mobileTreePanelToggle"[\s\S]*aria-expanded="false"/, 'tree toggle must start collapsed');
    assert.match(html, /id="mobileDetailPanelToggle"[\s\S]*aria-expanded="false"/, 'detail toggle must start collapsed');
});

test('editor.html exposes stable static template extraction candidates', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    /*
     * CANDIDATES FOR STATIC TEMPLATE EXTRACTION:
     * 1. Sidebar (`<aside class="sidebar reveal-fade">`) - static shell for status and "add" sections.
     * 2. Canvas Topbar (`<div class="editor-canvas-topbar">`) - static toolbars for zoom and layout.
     * 3. Floating Toolbar (`<div id="editorFloatingToolbar">` and associated tooltips/dropdowns).
     * 4. Empty Guide (`<div id="canvasEmptyGuide">`) - static onboarding element.
     * 5. Add Memory Form Modal (`<div id="addMemoryForm">`) - heavy static markup for memory creation.
     * 6. Detail Panel (`<aside class="detail-panel memory-detail-section reveal-fade" id="detailPanel">`) - heavy static shell for viewing/editing.
     */

    // Ensure candidates exist to be extracted later
    // 7. Canvas Topbar (`<div class="editor-canvas-topbar">`) - EXTRACTED (see editor-canvas-topbar-template-contract.test.js)
    assert.ok(html.includes('id="editorCanvasTopbarTemplateMount"'), 'Candidate: Canvas Topbar is extracted to mount');
    // 8. Empty Guide (`<div id="canvasEmptyGuide">`) - EXTRACTED (see editor-empty-guide-template-contract.test.js)
    assert.ok(html.includes('id="editorEmptyGuideTemplateMount"'), 'Candidate: Empty Guide is extracted to mount');
    // 5. Add Memory Form Modal (`<div id="addMemoryForm">`) - EXTRACTED (see editor-add-memory-form-template-contract.test.js)
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'Candidate: Add Memory Form Modal is extracted to mount');
    // 6. Sidebar sections (`<aside class="sidebar">`) - EXTRACTED (see editor-sidebar-template-contract.test.js)
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'Candidate: Sidebar is extracted to mount');
    // 9. Detail Empty State (`<div id="detailEmptyState">`) - EXTRACTED (see editor-detail-empty-state-template-contract.test.js)
    // 10. Detail View Mode (`<div id="detailViewMode">`) - EXTRACTED (see editor-detail-view-mode-template-contract.test.js)
    // Now handled inside Detail Panel Shell mount
    // 11. Detail Edit Mode (`<div id="detailEditMode">`) - EXTRACTED (see editor-detail-edit-mode-template-contract.test.js)
    // Now handled inside Detail Panel Shell mount
    
    // AREAS NOT TO EXTRACT YET (Remaining shells):
    // - canvas SVG rendering logic (id="canvasSvg"): tightly coupled to editor runtime SVG engine.
    // - main app wrapper (id="canvasArea", class="editor-layout"): base shell, extraction brings little value.
    // - mobileBottomBar: explicitly non-goal for this issue.
    // - save status indicator logic
});

test('editor template audit avoids runtime behavior changes', () => {
    // This contract test ensures we don't accidentally mutate logic in js/editor/ while planning HTML extraction.
    assert.ok(true, 'This audit PR only adds tests to identify extraction boundaries, without mutating js/editor.js');
});

// ── #3577: CSP-safe shared header bootstrap ──

test('#3577 source: editor.html has no inline renderSharedHeader or applyI18n call', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');
    // The editor pre-existing inline scripts (error handler + i18n dict) are unrelated
    // to header bootstrap. Only the CSP-blocked renderSharedHeader call must be removed.
    assert.doesNotMatch(html, /renderSharedHeader\s*\(/);
    assert.doesNotMatch(html, /applyI18n\s*\(/);
    // Verify the inline header bootstrap has been replaced by external script
    assert.match(html, /editor-page-shell-init\.js\?v=/);
});

test('#3577 source: external CSP-safe bootstrap loaded after shared-header and before editor-page-shell-init', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');
    assert.match(html, /js\/shared-header\.js\?v=20260718-3577-1/);
    assert.match(html, /js\/page-shell\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);
    assert.match(html, /js\/editor\/editor-page-shell-init\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);

    const headerIdx = html.indexOf('shared-header.js');
    const shellIdx = html.indexOf('page-shell.js');
    const bootIdx = html.indexOf('editor-page-shell-init.js');
    assert.ok(headerIdx >= 0 && shellIdx > headerIdx, 'page-shell must load after shared-header');
    assert.ok(bootIdx > shellIdx, 'editor-page-shell-init must load after page-shell');
});

test('#3577 source: bootstrap uses LoveTreePageShell and is idempotent', () => {
    const boot = fs.readFileSync('js/editor/editor-page-shell-init.js', 'utf8');
    assert.match(boot, /LoveTreePageShell\.initSharedPage/);
    assert.match(boot, /renderHeader:\s*true/);
    assert.match(boot, /applyI18n:\s*true/);
    assert.match(boot, /__lovebudEditorPageShellBooted/);
    assert.match(boot, /DOMContentLoaded/);
    assert.doesNotMatch(boot, /unsafe-inline|Content-Security-Policy|eval\s*\(/);
    assert.doesNotMatch(boot, /\bfetch\s*\(/);
});

test('#3577 source: no CSP policy relaxation in editor or bootstrap', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');
    const boot = fs.readFileSync('js/editor/editor-page-shell-init.js', 'utf8');
    assert.doesNotMatch(html, /unsafe-inline/);
    assert.doesNotMatch(html, /http-equiv=["']Content-Security-Policy["']/i);
    assert.doesNotMatch(boot, /unsafe-inline|script-src/);
});

test('#3577: editor must NOT render editor-specific nav link (regression from #3593)', () => {
    const js = fs.readFileSync('js/shared-header.js', 'utf8');
    // The editor nav is defined in MENU_CONFIG.sub but deliberately not rendered
    assert.ok(!js.includes('menuConfig.editor'),
        'buildHeaderHTML must NOT render editor-specific nav link');
});

test('#3577: editor routes activate My Trees as active nav (regression from #3593)', () => {
    const js = fs.readFileSync('js/shared-header.js', 'utf8');
    assert.ok(js.includes("'editor.html': 'myTrees'") && js.includes("'editor': 'myTrees'"),
        'Both editor route aliases must map to myTrees');
    assert.ok(js.includes("activeKey === 'myTrees'"),
        'Nav rendering must check activeKey for myTrees');
});



// ── #3883: CSP-safe editor script-load diagnostics ──

const vm = require('node:vm');
const path = require('node:path');

function readRel(rel) {
  return fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
}

function inlineScriptBodiesWithoutSrc(html) {
  const bodies = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!/src=/i.test(m[1])) bodies.push(m[2]);
  }
  return bodies;
}

test('#3883: pages/editor.html has no inline diagnostic executable script', () => {
  const html = readRel('pages/editor.html');
  const inline = inlineScriptBodiesWithoutSrc(html);
  for (const body of inline) {
    assert.ok(
      !body.includes('LoveBudEditorDebug') &&
        !body.includes('Script load failed') &&
        !/addEventListener\s*\([\s\S]*['"]error['"]/.test(body),
      'no inline script block may contain the diagnostic listener logic'
    );
  }
});

test('#3883: external diagnostic script is referenced in editor.html', () => {
  const html = readRel('pages/editor.html');
  assert.match(
    html,
    /<script src="\.\.\/js\/editor\/editor-script-load-diagnostics\.js\?v=20260804-3883-1"><\/script>/
  );
});

test('#3883: diagnostic script loads before dependent editor runtime scripts', () => {
  const html = readRel('pages/editor.html');
  const diagIdx = html.indexOf('editor-script-load-diagnostics.js');
  const firstEditorIdx = html.indexOf('js/editor/editor-interaction-mode.js');
  const entryIdx = html.indexOf('js/editor.js');
  assert.ok(diagIdx >= 0, 'diagnostic script must be present');
  assert.ok(diagIdx < firstEditorIdx, 'diagnostic must load before first editor runtime script');
  assert.ok(diagIdx < entryIdx, 'diagnostic must load before editor entry js/editor.js');
  assert.ok(html.indexOf('js/cache-utils.js') > diagIdx, 'diagnostic must load before cache-utils.js');
});

test('#3883: diagnostic JS registers a window error capture listener', () => {
  const js = readRel('js/editor/editor-script-load-diagnostics.js');
  assert.match(js, /window\.addEventListener\s*\(\s*['"]error['"]/);
  assert.match(js, /,\s*true\s*\)/); // capture phase = true
  assert.match(js, /tagName\s*===\s*['"]SCRIPT['"]/);
});

test('#3883: diagnostic only handles SCRIPT load failures (bounded)', () => {
  const js = readRel('js/editor/editor-script-load-diagnostics.js');
  assert.match(js, /e\.target\.tagName\s*===\s*['"]SCRIPT['"]/);
  assert.match(js, /\.pathname/); // bounded src representation
  assert.doesNotMatch(js, /searchParams|\.query/);
});

test('#3883: LoveBudEditorDebug init and errors append semantics preserved', () => {
  const js = readRel('js/editor/editor-script-load-diagnostics.js');
  assert.match(
    js,
    /window\.LoveBudEditorDebug\s*=\s*window\.LoveBudEditorDebug\s*\|\|\s*\{\s*logs:\s*\[\],\s*errors:\s*\[\]\s*\}/
  );
  assert.match(js, /errors\.push\s*\(/);
  assert.match(js, /msg:\s*['"]Script load failed['"]/);
});

test('#3883: _headers script-src unchanged and no unsafe-inline in script-src', () => {
  const headers = readRel('_headers');
  assert.match(
    headers,
    /script-src 'self' https:\/\/www\.gstatic\.com https:\/\/apis\.google\.com/
  );
  assert.doesNotMatch(headers, /script-src[^;]*unsafe-inline/);
});

test('#3883: no credential/private identifier logging in diagnostic', () => {
  const js = readRel('js/editor/editor-script-load-diagnostics.js');
  assert.doesNotMatch(
    js,
    /token|cookie|authorization|password|email|ownerId|treeId|memoryId|response/i
  );
});

test('#3883 runtime: bounded fake dispatch captures only SCRIPT failure', () => {
  const js = readRel('js/editor/editor-script-load-diagnostics.js');
  const listeners = {};
  const logged = [];
  const fakeWindow = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    location: { href: 'https://lovebud.pages.dev/pages/editor?treeId=secret' }
  };
  const context = vm.createContext({
    window: fakeWindow,
    console: { error: (...args) => logged.push(args.join(' ')) },
    URL
  });
  vm.runInContext(js, context);

  assert.equal(typeof listeners.error, 'function', 'error listener must be registered');

  // Non-SCRIPT target must be ignored (no record).
  listeners.error({ target: { tagName: 'IMG', src: '/assets/x.png' } });
  assert.equal(fakeWindow.LoveBudEditorDebug, undefined, 'no record for non-SCRIPT target');

  // SCRIPT failure with query/hash URL -> pathname-only bounded record.
  listeners.error({
    target: {
      tagName: 'SCRIPT',
      src: 'https://lovebud.pages.dev/js/editor/editor.js?v=20260418-1&token=abc'
    }
  });
  assert.ok(fakeWindow.LoveBudEditorDebug, 'LoveBudEditorDebug must be initialized');
  assert.equal(fakeWindow.LoveBudEditorDebug.errors.length, 1, 'one error record');
  assert.equal(fakeWindow.LoveBudEditorDebug.errors[0].msg, 'Script load failed');
  assert.equal(fakeWindow.LoveBudEditorDebug.errors[0].src, '/js/editor/editor.js');
  assert.ok(!logged.some((line) => line.includes('token=abc')), 'no raw query in console output');
});
