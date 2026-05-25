const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const FLOATING_TOOLBAR_SCRIPTS = [
  'js/editor/editor-floating-toolbar-actions.js',
  'js/editor/editor-floating-toolbar-keyboard.js',
  'js/editor/editor-floating-toolbar-tooltip.js',
  'js/editor/editor-floating-toolbar-dropdown.js',
  'js/editor/editor-floating-toolbar-positioning.js',
  'js/editor/editor-floating-toolbar-affordance.js',
  'js/editor/editor-floating-toolbar-visibility.js',
  'js/editor/editor-floating-toolbar-events.js',
  'js/editor/editor-floating-toolbar-selection.js',
  'js/editor/editor-floating-toolbar-elements.js',
  'js/editor/editor-floating-toolbar.js',
];

const PUBLIC_VIEWER_BOOTSTRAP_FILES = [
  'js/viewer/public-canvas-bridge.js',
  'js/viewer/public-canvas-init.js',
  'js/viewer/public-canvas-mobile-layout.js',
  'js/viewer/public-canvas-mobile-profile.js',
  'js/viewer/public-viewer-copy-helper.js',
  'js/viewer/public-viewer-copy-polish.js',
];

function getViewHtml() {
  return fs.readFileSync('pages/view.html', 'utf8');
}

function getScriptSrcs() {
  const html = getViewHtml();
  return [...html.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => match[1]);
}

function stripVersion(src) {
  return String(src || '').split('?')[0];
}

function scriptIncludes(scripts, needle) {
  return scripts.some((src) => stripVersion(src).includes(needle));
}

function fileIncludes(filePath, needle) {
  return fs.readFileSync(filePath, 'utf8').includes(needle);
}

test('public viewer still loads the floating toolbar stack only as a documented removal candidate', () => {
  const html = getViewHtml();
  const scripts = getScriptSrcs();

  assert.ok(
    html.includes('id="editorFloatingToolbarTemplateMount"'),
    'view.html still carries the floating toolbar mount until a viewer-only shell removes it intentionally'
  );
  assert.ok(
    scriptIncludes(scripts, 'js/editor/templates/editor-floating-toolbar-template.js'),
    'view.html still loads the floating toolbar template as a removal candidate'
  );

  FLOATING_TOOLBAR_SCRIPTS.forEach((needle) => {
    assert.ok(
      scriptIncludes(scripts, needle),
      `view.html still loads floating toolbar candidate ${needle}; update this contract when removing it intentionally`
    );
  });
});

test('public viewer bootstrap files do not depend on floating toolbar namespaces or script paths', () => {
  PUBLIC_VIEWER_BOOTSTRAP_FILES.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.equal(source.includes('editor-floating-toolbar'), false, `${filePath} must not reference floating toolbar script paths`);
    assert.equal(source.includes('FloatingToolbar'), false, `${filePath} must not reference floating toolbar namespaces`);
    assert.equal(source.includes('floatingToolbar'), false, `${filePath} must not reference floating toolbar instances`);
    assert.equal(source.includes('editorFloatingToolbar'), false, `${filePath} must not reference floating toolbar mount ids`);
  });
});

test('public canvas init only references the canvas topbar toolbar, not the floating toolbar stack', () => {
  const initSource = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');

  assert.ok(
    initSource.includes('.editor-canvas-toolbar'),
    'public canvas init currently adjusts the canvas topbar compact class on small screens'
  );
  assert.equal(
    initSource.includes('.editor-floating-toolbar'),
    false,
    'public canvas init must not depend on the floating toolbar DOM class'
  );
  assert.equal(
    initSource.includes('editorFloatingToolbarTemplateMount'),
    false,
    'public canvas init must not depend on the floating toolbar mount'
  );
});

test('floating toolbar scripts are not part of the viewer bootstrap order contract', () => {
  const dependencyContract = fs.readFileSync('tests/routes/public-canvas-route-dependency-contract.test.cjs', 'utf8');

  assert.ok(
    dependencyContract.includes('editor-only candidate'),
    'route dependency contract should classify editor-only candidates separately from required viewer bootstrap scripts'
  );
  FLOATING_TOOLBAR_SCRIPTS.forEach((needle) => {
    assert.ok(
      dependencyContract.includes(needle),
      `route dependency contract should keep documenting floating toolbar candidate ${needle}`
    );
  });
  assert.equal(
    dependencyContract.includes("assertScriptOrder(scripts, 'js/editor/editor-floating-toolbar"),
    false,
    'floating toolbar scripts must not be locked as required load-order dependencies for public viewer bootstrap'
  );
});
