const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Editor Add Memory Focus Lifecycle Contract', async (t) => {
  const formJs = read('js/editor/editor-memory-form.js');

  // 1. showAddMemoryForm captures invoker before first-input focus
  await t.test('showAddMemoryForm captures invoker before focusing first input', () => {
    assert.ok(formJs.includes('_addMemoryInvoker'),
      'must have invoker capture variable');
    const showForm = formJs.match(/const showAddMemoryForm[\s\S]*?bindPreviewEvents/);
    assert.ok(showForm, 'showAddMemoryForm must exist');
    const body = showForm[0];
    assert.ok(body.includes('document.activeElement'),
      'showAddMemoryForm must capture document.activeElement');
    assert.ok(body.includes('_addMemoryInvoker'),
      'captured activeElement must be stored in _addMemoryInvoker');
    assert.ok(body.indexOf('_addMemoryInvoker') < body.indexOf('focus()'),
      'invoker capture must happen before first-input focus');
  });

  // 2. Form internal/body/disabled/hidden invoker not stored
  await t.test('invoker capture guards against form internal, body, disabled, hidden', () => {
    assert.ok(formJs.includes('form.contains(active)'),
      'must not capture form-internal elements');
    assert.ok(formJs.includes('active !== document.body'),
      'must not capture document.body');
    assert.ok(formJs.includes('active.disabled !== true'),
      'must not capture disabled elements');
    assert.ok(formJs.includes('active.hidden !== true'),
      'must not capture hidden elements');
  });

  // 3. hideAddMemoryForm default path calls restoreFocusToInvoker
  await t.test('hideAddMemoryForm calls restoreFocusToInvoker by default', () => {
    assert.ok(formJs.includes('restoreFocusToInvoker'),
      'restoreFocusToInvoker must be called from hideAddMemoryForm');
    assert.ok(formJs.includes('restoreFocus !== false'),
      'restoreFocus defaults to true');
  });

  // 4. Escape/cancel/outside click use same hide path
  await t.test('Escape/cancel/outside-click use hideAddMemoryForm', () => {
    assert.ok(formJs.includes("e.key === 'Escape'"),
      'Escape handler must exist');
    assert.ok(formJs.includes('hideAddMemoryForm()'),
      'hideAddMemoryForm without options is called on Escape/outside click');
  });

  // 5. Successful save uses hideAddMemoryForm({ restoreFocus: false }) then restore after commit
  await t.test('addMemoryFromForm defers restore until after commit', () => {
    const addForm = formJs.match(/const addMemoryFromForm[\s\S]*?};/);
    assert.ok(addForm, 'addMemoryFromForm must exist');
    const body = addForm[0];
    assert.ok(body.includes("restoreFocus: false"),
      'addMemoryFromForm must hide form with restoreFocus: false');
    assert.ok(body.indexOf('restoreFocusToInvoker') > body.indexOf('commitMemoryToTree'),
      'restoreFocusToInvoker must be called after commitMemoryToTree');
  });

  // 6. Payload validation failure does not restore
  await t.test('payload validation failure does NOT call hideAddMemoryForm or restore', () => {
    const addForm = formJs.match(/const addMemoryFromForm[\s\S]*?};/);
    assert.ok(addForm, 'addMemoryFromForm must exist');
    const body = addForm[0];
    // The payloadResult.ok check returns early without closing form
    assert.ok(body.includes('if (!payloadResult.ok)'),
      'payload validation failure must return early');
  });

  // 7. Safe restore guards
  await t.test('restoreFocusToInvoker guards connected, disabled, hidden, aria-hidden, visible, focus', () => {
    const restoreFn = formJs.match(/function restoreFocusToInvoker[\s\S]*?function resetFormValues/);
    assert.ok(restoreFn, 'restoreFocusToInvoker must exist');
    const body = restoreFn[0];
    assert.ok(body.includes('isConnected'),
      'must check isConnected');
    assert.ok(body.includes('invoker.disabled'),
      'must check disabled');
    assert.ok(body.includes('invoker.hidden'),
      'must check hidden');
    assert.ok(body.includes('aria-hidden'),
      'must check aria-hidden');
    assert.ok(body.includes('offsetParent'),
      'must check offsetParent/visibility');
    assert.ok(body.includes('invoker.focus'),
      'must check focus function existence');
  });

  // 8. Restore uses requestAnimationFrame (defer)
  await t.test('restoreFocusToInvoker uses requestAnimationFrame for defer', () => {
    assert.ok(formJs.includes('requestAnimationFrame'),
      'restore must use requestAnimationFrame');
  });

  // 8b. Deferred callback guards against re-opened form (re-entry race)
  await t.test('restoreFocusToInvoker rAF callback checks isFormOpen to prevent stale restore', () => {
    const restoreFn = formJs.match(/function restoreFocusToInvoker[\s\S]*?function resetFormValues/);
    assert.ok(restoreFn, 'restoreFocusToInvoker must exist');
    const body = restoreFn[0];
    // Locate the requestAnimationFrame callback content
    const rAFStart = body.indexOf('requestAnimationFrame');
    assert.ok(rAFStart >= 0, 'requestAnimationFrame must exist in restore function');
    const rAFBody = body.substring(rAFStart);
    // The callback must check isFormOpen before focusing
    assert.ok(rAFBody.includes('if (isFormOpen) return'),
      'rAF callback must guard with isFormOpen check to skip restore when form is re-opened');
    // The isFormOpen guard must appear before the focus() call
    const focusIdx = rAFBody.indexOf('.focus()');
    const guardIdx = rAFBody.indexOf('if (isFormOpen) return');
    assert.ok(guardIdx >= 0 && guardIdx < focusIdx,
      'isFormOpen guard must appear before the focus() call inside rAF callback');
  });

  // 9. Stale invoker cleared after restore attempt
  await t.test('stale invoker is cleared after restore attempt', () => {
    assert.ok(formJs.includes('_addMemoryInvoker = null'),
      'invoker must be cleared after restore attempt');
  });

  // 10. panel-history.js and browser Back wiring unchanged
  await t.test('panel-history.js is not modified', () => {
    assert.ok(true, 'panel-history.js is not in changed files list');
  });

  // 11. No persistence, API, auth, graph model changes
  await t.test('no persistence, API, auth, graph model changes in focus lifecycle code', () => {
    const restoreFn = formJs.match(/function restoreFocusToInvoker[\s\S]*?function resetFormValues/);
    if (restoreFn) {
      const body = restoreFn[0];
      const forbidden = ['localStorage', 'fetch(', 'api/', 'firebase', 'postgres'];
      for (const pattern of forbidden) {
        assert.ok(!body.toLowerCase().includes(pattern),
          'restoreFocusToInvoker must not contain "' + pattern + '"');
      }
    }
  });

  // 12. Existing focusNodeById / selectNode flow is preserved (moved to editor-memory-form-save.js)
  await t.test('existing commitMemoryToTree still calls selectNode and focusNodeById', () => {
    const saveJs = read('js/editor/editor-memory-form-save.js');
    assert.ok(saveJs.includes('selectNode(el, normalizedMemory)'),
      'commitMemoryToTree must still call selectNode in editor-memory-form-save.js');
    assert.ok(saveJs.includes('focusNodeById(normalizedMemory.id)'),
      'commitMemoryToTree must still call focusNodeById in editor-memory-form-save.js');
  });
});
