/**
 * Contract test: editor video-focus view module.
 *
 * Verifies that the editor-video-focus-view module:
 *  1. Loads correctly from pages/editor.html.
 *  2. Uses [data-editor-detail-player="1"] presence as CTA criteria (not .is-playing).
 *  3. Has a sync path for dynamically created detail panel/player.
 *  4. Focus CSS contains real position:fixed, centered surface, size/ratio/z-index declarations.
 *  5. Backdrop and close button are created as real DOM elements.
 *  6. Backdrop click and close button click trigger close.
 *  7. Player/wrapper detachment triggers auto-close via isConnected/contains check.
 *  8. Does NOT recreate, move, or replace the player iframe.
 *  9. Does NOT use fetch, apiClient, localStorage, or DB.
 * 10. Does NOT use keydown, Escape, or focus-trap.
 * 11. Does NOT modify protected files.
 * 12. Does NOT refer to closed #1882.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const jsPath = path.join(ROOT, 'js/editor/editor-video-focus-view.js');
const cssPath = path.join(ROOT, 'css/editor/editor-video-focus-view.css');
const htmlPath = path.join(ROOT, 'pages/editor.html');
const source = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

// ---------------------------------------------------------------------------
// 1. Module loads in pages/editor.html
// ---------------------------------------------------------------------------

test('pages/editor.html loads editor-video-focus-view CSS', () => {
  assert.match(html, /editor-video-focus-view\.css/, 'CSS must be loaded in editor.html');
});

test('pages/editor.html loads editor-video-focus-view JS', () => {
  assert.match(html, /editor-video-focus-view\.js/, 'JS must be loaded in editor.html');
});

test('module exposes window.LoveBudEditorVideoFocus', () => {
  assert.match(source, /LoveBudEditorVideoFocus/, 'must be exposed globally');
});

test('window.LoveBudEditorVideoFocus contains open/close/isOpen', () => {
  assert.match(source, /open\s*:\s*openFocusView/, 'must expose open');
  assert.match(source, /close\s*:\s*closeFocusView/, 'must expose close');
  assert.match(source, /isOpen\s*:\s*function/, 'must expose isOpen');
});

// ---------------------------------------------------------------------------
// 2. Player detection — based on [data-editor-detail-player="1"], not .is-playing
// ---------------------------------------------------------------------------

test('module queries [data-editor-detail-player="1"]', () => {
  assert.match(source, /PLAYER_SELECTOR/, 'must define player selector constant');
  assert.match(source, /data-editor-detail-player/, 'must query by data attribute');
});

test('module queries .detail-video wrapper', () => {
  assert.match(source, /VIDEO_WRAPPER_SELECTOR/, 'must define wrapper selector constant');
  assert.match(source, /\.detail-video/, 'must query .detail-video');
});

test('CTA visibility depends on [data-editor-detail-player] presence (not .is-playing)', () => {
  assert.match(source, /getActivePlayerInWrapper/, 'must check player presence');
  assert.doesNotMatch(source, /getIsPlayingState/, 'must not use getIsPlayingState');
  assert.doesNotMatch(source, /\.is-playing/, 'must not depend on .is-playing class');
});

test('player presence check uses querySelector with PLAYER_SELECTOR', () => {
  assert.match(source, /querySelector\(PLAYER_SELECTOR/, 'must query player selector');
});

// ---------------------------------------------------------------------------
// 3. Dynamic panel sync path
// ---------------------------------------------------------------------------

test('module uses MutationObserver on document.body for dynamic sync', () => {
  assert.match(source, /MutationObserver/, 'must create MutationObserver');
  assert.match(source, /observe\(document\.body/, 'must observe document.body');
  assert.match(source, /subtree:\s*true/, 'must use subtree:true');
});

test('handleSync ensures toggle exists when .detail-video appears', () => {
  assert.match(source, /ensureFocusToggle/, 'must ensure toggle button');
  assert.match(source, /handleSync/, 'must have sync handler');
});

test('ensureFocusToggle returns early if toggle already exists', () => {
  assert.match(source, /querySelector.*FOCUS_TOGGLE_BTN_CLASS/, 'must check for existing toggle');
  assert.match(source, /if \(existingToggle\) return/, 'must return early if toggle exists');
});

// ---------------------------------------------------------------------------
// 4. Focus CSS has real declarations (not empty selectors)
// ---------------------------------------------------------------------------

test('CSS backdrop has position:fixed and z-index', () => {
  assert.match(css, /\.editor-video-focus-backdrop\s*\{/, 'backdrop selector must exist');
  assert.match(css, /position:\s*fixed/, 'backdrop must be fixed position');
  assert.match(css, /z-index:\s*400/, 'backdrop z-index must be 400');
});

test('CSS focus surface has position:fixed, centered, aspect-ratio, z-index', () => {
  assert.match(css, /body\.editor-video-focus-open\s*\.detail-video\.is-editor-video-focused/, 'focus selector must exist');
  assert.match(css, /position:\s*fixed/, 'must be fixed position');
  assert.match(css, /transform:\s*translate/, 'must be centered via translate');
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/, 'must use 16:9 aspect ratio');
  assert.match(css, /z-index:\s*401/, 'focus surface z-index must be 401');
  assert.match(css, /width:\s*min/, 'must use min() for responsive width');
});

test('CSS close button has position:fixed and z-index above focus surface', () => {
  assert.match(css, /\.editor-video-focus-close/, 'close button selector must exist');
  assert.match(css, /z-index:\s*402/, 'close button z-index must be 402');
});

// ---------------------------------------------------------------------------
// 5. Backdrop and close button are created as real DOM elements
// ---------------------------------------------------------------------------

test('openFocusView creates backdrop element with className', () => {
  assert.match(source, /createElement.*div/, 'must create div element for backdrop');
  assert.match(source, /FOCUS_BACKDROP_CLASS/, 'must use backdrop class constant');
  assert.match(source, /document\.body\.appendChild/, 'must append backdrop to body');
});

test('openFocusView creates close button element', () => {
  assert.match(source, /createElement.*button/, 'must create button element for close');
  assert.match(source, /FOCUS_CLOSE_BTN_CLASS/, 'must use close button class constant');
  assert.match(source, /videoWrapper\.appendChild\(/, 'must append close btn to wrapper');
});

test('closeFocusView removes backdrop and close button', () => {
  assert.match(source, /removeChild\(currentBackdrop\)/, 'must remove backdrop on close');
  assert.match(source, /removeChild\(currentCloseBtn\)/, 'must remove close button on close');
});

// ---------------------------------------------------------------------------
// 6. Close path via click
// ---------------------------------------------------------------------------

test('backdrop click triggers closeFocusView', () => {
  assert.match(source, /backdrop\.addEventListener\(.click., closeFocusView/, 'backdrop click must call close');
});

test('close button click triggers closeFocusView', () => {
  assert.match(source, /closeBtn\.addEventListener\(.click., closeFocusView/, 'close button click must call close');
});

// ---------------------------------------------------------------------------
// 7. Player/wrapper detachment triggers auto-close
// ---------------------------------------------------------------------------

test('auto-close checks isConnected on player', () => {
  assert.match(source, /isConnected/, 'must check isConnected');
  assert.match(source, /currentPlayer\.isConnected/, 'must check player connection');
});

test('auto-close checks wrapper contains player', () => {
  assert.match(source, /currentVideoWrapper\.contains\(/, 'must check wrapper contains player');
});

test('handleSync runs auto-close check when focus is open', () => {
  assert.match(source, /if \(isFocusOpen\)/, 'must check focus state in sync');
  assert.match(source, /closeFocusView/, 'must call close in auto-close path');
});

// ---------------------------------------------------------------------------
// 8. No iframe mutation
// ---------------------------------------------------------------------------

test('module does NOT set iframe.src', () => {
  assert.doesNotMatch(source, /iframe\.src\s*=\s*/, 'must not set iframe.src');
});

test('module does NOT cloneNode', () => {
  assert.doesNotMatch(source, /\.cloneNode\(/, 'must not call .cloneNode()');
});

test('module does NOT replaceWith', () => {
  assert.doesNotMatch(source, /\.replaceWith\(/, 'must not call .replaceWith()');
});

test('module does NOT appendChild to player', () => {
  assert.doesNotMatch(source, /player\.appendChild/, 'must not append to player');
  assert.doesNotMatch(source, /currentPlayer\.appendChild/, 'must not append to currentPlayer');
});

test('module does NOT remove player', () => {
  assert.doesNotMatch(source, /player\.remove\(\)/, 'must not remove player');
  assert.doesNotMatch(source, /currentPlayer\.remove\(\)/, 'must not remove currentPlayer');
});

test('CSS does NOT change iframe position via transform on iframe', () => {
  assert.doesNotMatch(css, /iframe\s*\{[^}]*transform/, 'must not transform the iframe element directly');
});

// ---------------------------------------------------------------------------
// 9. No fetch/apiClient/localStorage/DB
// ---------------------------------------------------------------------------

test('module does NOT call fetch()', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/, 'must not call fetch()');
});

test('module does NOT use localStorage', () => {
  assert.doesNotMatch(source, /localStorage\./, 'must not use localStorage');
});

test('module does NOT reference database, apiClient, or provider in code', () => {
  assert.doesNotMatch(source, /\bapiClient\b/, 'must not reference apiClient');
  assert.doesNotMatch(source, /\.firestore/, 'must not reference firestore');
  assert.doesNotMatch(source, /\bprovider\b/, 'must not reference provider');
});

// ---------------------------------------------------------------------------
// 10. No keyboard/navigation code
// ---------------------------------------------------------------------------

test('module does NOT use keydown event listener', () => {
  assert.doesNotMatch(source, /addEventListener\(.*keydown/, 'must not add keydown listener');
});

test('module does NOT use Escape key handling', () => {
  assert.doesNotMatch(source, /'Escape'/, 'must not use Escape string literal');
});

test('module does NOT use focusTrap', () => {
  assert.doesNotMatch(source, /focusTrap/, 'must not use focusTrap');
  assert.doesNotMatch(source, /focus\.trap/, 'must not use focus.trap');
  assert.doesNotMatch(source, /focus_trap/, 'must not use focus_trap');
});

// ---------------------------------------------------------------------------
// 11. Protected file check
// ---------------------------------------------------------------------------

const PROTECTED_FILES = [
  'js/editor/editor-detail-ui.js',
  'js/editor/editor-detail-tree-meta.js',
  'js/editor/templates/editor-detail-view-mode-template.js',
  'css/editor/editor-detail-content/section-cards.css',
  'css/editor/editor-canvas-affordance.css',
  'js/editor/editor-canvas-growth-affordance.js',
];

const ALLOWED_FILES = [
  'pages/editor.html',
  'css/editor/editor-video-focus-view.css',
  'js/editor/editor-video-focus-view.js',
  'tests/contracts/editor-video-focus-view-contract.test.cjs',
  'tests/contracts/public-canvas-error-fallback-contract.test.cjs',
];

test('source does not reference protected files', () => {
  PROTECTED_FILES.forEach(function (f) {
    assert.ok(source.indexOf(f) === -1, 'must not reference ' + f);
  });
});

// ---------------------------------------------------------------------------
// 12. #1882 close reference check — must use Refers only
// ---------------------------------------------------------------------------

test('module does not use Closes, Fixes, or Resolves with #1882', () => {
  assert.doesNotMatch(source, /Closes\s*#1882/, 'must not close #1882');
  assert.doesNotMatch(source, /Fixes\s*#1882/, 'must not fix #1882');
  assert.doesNotMatch(source, /Resolves\s*#1882/, 'must not resolve #1882');
});
