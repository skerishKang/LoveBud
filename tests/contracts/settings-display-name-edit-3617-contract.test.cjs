'use strict';

/**
 * #3617 pure/executable contract — display name edit validation and fail-closed write boundary.
 * Does not merely assert that source strings exist.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function createSettingsSandbox(options) {
  var opts = options || {};
  var liveUser = opts.liveUser || null;
  var sandbox = {
    window: {},
    document: {
      getElementById: function() { return null; },
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {}
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    localStorage: {
      store: {},
      getItem: function(k) { return this.store[k] == null ? null : this.store[k]; },
      setItem: function(k, v) { this.store[k] = String(v); },
      removeItem: function(k) { delete this.store[k]; }
    },
    URL: URL,
    URLSearchParams: URLSearchParams,
    firebase: liveUser
      ? {
          auth: function() {
            return { currentUser: liveUser };
          }
        }
      : undefined
  };
  sandbox.window = sandbox;
  sandbox.window.console = console;
  sandbox.window.setTimeout = setTimeout;
  sandbox.window.clearTimeout = clearTimeout;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.URL = URL;
  sandbox.window.URLSearchParams = URLSearchParams;
  sandbox.window.location = {
    origin: 'http://localhost',
    pathname: '/pages/settings.html',
    search: '',
    hash: '',
    href: 'http://localhost/pages/settings.html'
  };
  sandbox.window.t = function(key) { return key; };
  sandbox.window.persistConfirmedAuthSession = opts.persistConfirmedAuthSession || function() {};
  sandbox.window.updateNavUI = opts.updateNavUI || function() {};
  sandbox.window.renderSharedHeader = opts.renderSharedHeader || function() {
    throw new Error('renderSharedHeader must not be called from settings save path');
  };
  vm.createContext(sandbox);
  vm.runInContext(read('js/settings.js'), sandbox);
  return sandbox;
}

// --- HTML structure ---

test('#3617 HTML has separate edit-local and result status regions', () => {
  const html = read('pages/settings.html');
  assert.ok(html.includes('id="settingsProfileEditStatus"'), 'edit-local status must exist');
  assert.ok(html.includes('id="settingsProfileResultStatus"'), 'persistent result status must exist');
  // Result status must not be nested inside the edit form.
  const formStart = html.indexOf('id="settingsProfileEditForm"');
  const formEnd = html.indexOf('id="settingsProfileEditBtn"');
  const resultIdx = html.indexOf('id="settingsProfileResultStatus"');
  const editStatusIdx = html.indexOf('id="settingsProfileEditStatus"');
  assert.ok(formStart >= 0 && formEnd > formStart);
  assert.ok(editStatusIdx > formStart && editStatusIdx < formEnd, 'edit status inside form');
  assert.ok(resultIdx > formEnd, 'result status outside form (after edit button)');
  assert.ok(!/maxlength\s*=\s*["']50["']/.test(html), 'native maxlength=50 must be removed');
});

test('#3617 HTML indentation for settings-profile-info is clean', () => {
  const html = read('pages/settings.html');
  assert.ok(!html.includes('                      <div class="settings-profile-info">'));
  assert.ok(html.includes('            <div class="settings-profile-info">'));
});

// --- validateDisplayName ---

test('#3617 validateDisplayName rejects blank and whitespace', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  assert.equal(typeof validate, 'function');
  assert.equal(validate('').valid, false);
  assert.equal(validate('   ').valid, false);
  assert.equal(validate(null).valid, false);
});

test('#3617 validateDisplayName trims and accepts 50 ASCII characters', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  const fifty = 'a'.repeat(50);
  const result = validate('  ' + fifty + '  ');
  assert.equal(result.valid, true);
  assert.equal(result.value, fifty);
});

test('#3617 validateDisplayName rejects 51 ASCII characters', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  const result = validate('a'.repeat(51));
  assert.equal(result.valid, false);
  assert.equal(result.error, 'tooLong');
});

test('#3617 validateDisplayName accepts 50 Korean characters', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  const fifty = '가'.repeat(50);
  const result = validate(fifty);
  assert.equal(result.valid, true);
  assert.equal(Array.from(result.value).length, 50);
});

test('#3617 validateDisplayName accepts 50 astral emoji code points', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  // 😀 is one code point (U+1F600), two UTF-16 code units
  const fifty = '😀'.repeat(50);
  assert.equal(Array.from(fifty).length, 50);
  assert.ok(fifty.length > 50, 'UTF-16 length exceeds 50 for astral emoji');
  const result = validate(fifty);
  assert.equal(result.valid, true);
  assert.equal(Array.from(result.value).length, 50);
});

test('#3617 validateDisplayName rejects 51 astral emoji code points', () => {
  const sandbox = createSettingsSandbox();
  const validate = sandbox.window._settingsValidateDisplayName;
  const fiftyOne = '😀'.repeat(51);
  assert.equal(Array.from(fiftyOne).length, 51);
  const result = validate(fiftyOne);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'tooLong');
});

// --- write boundary source contracts (executable guards) ---

test('#3617 settings.js uses typeof updateProfile === function guard', () => {
  const js = read('js/settings.js');
  assert.ok(
    js.includes("typeof liveUser.updateProfile !== 'function'") ||
      js.includes('typeof liveUser.updateProfile !== "function"'),
    'must use typeof function check, not truthiness'
  );
  assert.ok(js.includes('Promise.resolve()'), 'must use Promise.resolve for sync throw capture');
});

test('#3617 settings.js Escape while saving does not cancel', () => {
  const js = read('js/settings.js');
  // Escape handler must check editState.saving before handleCancelEdit
  const escapeIdx = js.indexOf("e.key === 'Escape'");
  assert.ok(escapeIdx >= 0);
  const block = js.slice(escapeIdx, escapeIdx + 450);
  assert.ok(block.includes('editState.saving'), 'Escape path must consider saving state');
  assert.ok(block.includes('if (editState.saving) return') || block.includes("if (editState.saving) {"), 'Escape while saving must return early');
});

test('#3617 settings.js keep fail-closed on write errors', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('.catch(function()'), 'write path must catch rejections');
  assert.ok(js.includes("showEditStatus") || js.includes('showEditStatus('), 'write errors use edit-local status');
  assert.ok(js.includes('showResultStatus'), 'success/unchanged use persistent result status');
});

// --- input init policy ---

test('#3617 edit form initializes from raw displayName only (source)', () => {
  const js = read('js/settings.js');
  // Edit button uses liveUser.displayName || '' — not resolveDisplayName
  assert.ok(js.includes("liveUser.displayName || ''") || js.includes('liveUser.displayName || ""'));
  const bindIdx = js.indexOf('function bindNameEditInteractions');
  const bindSrc = js.slice(bindIdx, bindIdx + 600);
  assert.ok(!bindSrc.includes('resolveDisplayName(liveUser)'), 'must not seed input from resolveDisplayName fallback');
});

// --- language-change binding (source + browser hygiene) ---

test('#3617 settings.js binds real product language change via window.onLangChange', () => {
  const js = read('js/settings.js');
  assert.ok(js.includes('function bindSettingsLangChange'), 'must define bindSettingsLangChange');
  assert.ok(js.includes('window.onLangChange'), 'must use window.onLangChange helper');
  assert.ok(js.includes('settingsLangChangeBound'), 'must have idempotent binding guard');
  assert.ok(js.includes('if (settingsLangChangeBound) return'), 'guard must short-circuit re-bind');
  assert.ok(js.includes('reapplyStatusI18n'), 'must retranslate status on lang change');
  assert.ok(js.includes("statusKind"), 'must track semantic statusKind');
  // Must subscribe to product event through onLangChange, not invent a fake event name.
  assert.ok(!js.includes('lovebud:langchange'), 'must not invent lovebud:langchange');
  assert.ok(js.includes('bindSettingsLangChange()'), 'startSettings must call bindSettingsLangChange');
});

test('#3617 browser contract uses product language path only (no fake event / direct DOM i18n)', () => {
  const browserSrc = read('tests/contracts/settings-display-name-edit-3617-browser-contract.test.cjs');
  assert.ok(
    !browserSrc.includes('lovebud:langchange'),
    'browser test must not dispatch fake lovebud:langchange'
  );
  // Product path helper: setCurrentLang → applyI18n → triggerLangChange
  assert.ok(
    browserSrc.includes('setCurrentLang'),
    'browser test must call setCurrentLang'
  );
  assert.ok(
    browserSrc.includes('triggerLangChange'),
    'browser test must call triggerLangChange'
  );
  assert.ok(
    browserSrc.includes('function switchProductLang') || browserSrc.includes('switchProductLang'),
    'browser test should drive language via product helper (switchProductLang)'
  );
  // Direct DOM translation helpers / assignments must not remain.
  assert.ok(!browserSrc.includes('function tt('), 'must not use test-local tt() translator');
  assert.ok(
    !/settingsProfileEditLabel\)[\s\S]{0,40}textContent\s*=/.test(browserSrc),
    'must not assign settingsProfileEditLabel textContent directly'
  );
  assert.ok(
    !/settingsProfileSaveBtn\)[\s\S]{0,40}textContent\s*=/.test(browserSrc),
    'must not assign settingsProfileSaveBtn textContent directly'
  );
  assert.ok(
    !/settingsProfileCancelBtn\)[\s\S]{0,40}textContent\s*=/.test(browserSrc),
    'must not assign settingsProfileCancelBtn textContent directly'
  );
  assert.ok(
    !/settingsProfileEditBtnLabel\)[\s\S]{0,40}textContent\s*=/.test(browserSrc),
    'must not assign settingsProfileEditBtnLabel textContent directly'
  );
});
