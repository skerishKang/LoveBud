const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const childProcess = require('child_process');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('mobile panel controller enforces mutual exclusivity and mobile-only lifecycle', () => {
  const script = read('js/editor/editor-mobile-panel-hierarchy.js');

  assert.match(script, /var MOBILE_QUERY = '\(max-width: 768px\)'/, 'controller must activate at 768px and below');
  assert.match(script, /closePanel\(state\.activeKey, \{ restoreFocus: false, preserveReturnFocus: true \}\)/, 'opening one panel must close the other first');
  assert.match(script, /panelRecord\.element\.classList\.add\('is-mobile-panel-open'\)/, 'opened panel must receive is-mobile-panel-open');
  assert.match(script, /record\.element\.classList\.remove\('is-mobile-panel-open'\)/, 'closed panel must clear is-mobile-panel-open');
  assert.match(script, /mediaQuery\.addEventListener\('change', syncViewportState\)/, 'controller must react to viewport changes');
  assert.match(script, /cleanupDesktopState\(\)/, 'controller must clean up mobile state on desktop');
});

test('mobile panel controller preserves focus and closing paths', () => {
  const script = read('js/editor/editor-mobile-panel-hierarchy.js');

  assert.match(script, /preserveReturnFocus: true/, 'controller must preserve return focus during panel switches');
  assert.match(script, /if \(!hadActivePanel \|\| !isConnectedElement\(state\.returnFocusEl\)\)/, 'controller must avoid overwriting the first return focus during panel switches');
  assert.match(script, /focusTarget = isConnectedElement\(state\.returnFocusEl\)/, 'controller must restore focus from the preserved opener when still connected');
  assert.match(script, /isConnectedElement\(document\.activeElement\) \? document\.activeElement : record\.toggle/, 'controller must fall back to activeElement or toggle when preserved focus is detached');
  assert.match(script, /if \(event\.key === 'Escape'\)/, 'controller must close on Escape');
  assert.match(script, /backdrop\.addEventListener\('click'/, 'controller must close on backdrop click');
  assert.match(script, /\[data-mobile-panel-close="true"\]/, 'controller must expose close button route');
  assert.match(script, /trapTabKey\(panel, event\)/, 'controller must trap Tab focus inside panel');
});

test('mobile panel controller manages aria state and selected moment gating', () => {
  const script = read('js/editor/editor-mobile-panel-hierarchy.js');

  assert.match(script, /panelRecord\.toggle\.setAttribute\('aria-expanded', 'true'\)/, 'controller must set aria-expanded=true on open');
  assert.match(script, /record\.toggle\.setAttribute\('aria-expanded', 'false'\)/, 'controller must set aria-expanded=false on close');
  assert.match(script, /record\.element\.setAttribute\('aria-hidden', 'false'\)/, 'controller must expose open panel to accessibility tree');
  assert.match(script, /record\.element\.setAttribute\('aria-hidden', 'true'\)/, 'controller must hide closed panel from accessibility tree');
  assert.match(script, /panelRecord\.element\.setAttribute\('aria-modal', 'true'\)/, 'controller must mark open panel modal');
  assert.match(script, /panelRecord\.element\.setAttribute\('aria-label', panelKey === 'tree' \? '트리 정보' : '선택한 순간'\)/, 'controller must provide an accessible dialog name');
  assert.match(script, /detailToggle\.disabled = !hasSelection/, 'selected memory state must gate detail toggle');
  assert.match(script, /detailToggle\.setAttribute\('aria-disabled', hasSelection \? 'false' : 'true'\)/, 'detail toggle aria-disabled must track selection state');
  assert.match(script, /new MutationObserver\(function \(\) \{\s+setDetailToggleState\(\);/m, 'controller must observe selected memory changes');
});

test('mobile hierarchy css keeps canvas-first off-canvas layout on small screens', () => {
  const css = read('css/editor/editor-mobile-panel-hierarchy.css');

  assert.match(css, /@media \(max-width: 768px\)/, 'css must define mobile breakpoint');
  assert.match(css, /\.editor-layout > \.canvas-area\s*\{[\s\S]*width: 100%;[\s\S]*height: 100%;/m, 'canvas area must stay primary work surface');
  assert.match(css, /\.sidebar,\s*\n\s*\.detail-panel\s*\{[\s\S]*position: absolute;[\s\S]*visibility: hidden;/m, 'sidebar and detail panel must leave normal flow and stay off-canvas');
  assert.match(css, /\.sidebar\.is-mobile-panel-open,\s*\n\s*\.detail-panel\.is-mobile-panel-open\s*\{[\s\S]*transform: translateX\(0\);/m, 'panels must slide in only with is-mobile-panel-open');
  assert.match(css, /\.editor-mobile-panel-controls\s*\{[\s\S]*max-width: calc\(100% - 28px\);[\s\S]*box-sizing: border-box;/m, 'controls must cap width to avoid horizontal overflow');
  assert.match(css, /\.editor-mobile-panel-backdrop\s*\{[\s\S]*position: absolute;[\s\S]*top: 0;[\s\S]*bottom: 0;/m, 'backdrop must stay under header within editor layout');
  assert.match(css, /\.editor-layout\.has-mobile-panel-open #mobileBottomBar\s*\{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/m, 'mobile bottom bar must be blocked while a modal panel is open');
});

test('protected detail template files remain untouched', () => {
  const diffNames = childProcess
    .execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  const protectedFiles = [
    'js/editor/editor-detail-tree-meta.js',
    'js/editor/editor-detail-ui.js',
    'js/editor/templates/editor-detail-view-mode-template.js',
  ];

  protectedFiles.forEach((file) => {
    assert.ok(!diffNames.includes(file), `${file} must remain untouched`);
  });
});
