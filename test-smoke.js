const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Script load order validation (static check on pages/editor.html)
const editorHtml = fs.readFileSync(path.join(__dirname, 'pages', 'editor.html'), 'utf8');
const scriptRegex = /<script src="\.\.\/js\/editor\/editor-floating-toolbar([^"]+)"><\/script>/g;
let match;
const scripts = [];
while ((match = scriptRegex.exec(editorHtml)) !== null) {
  scripts.push(match[0]);
}

assert.ok(editorHtml.indexOf('editor-floating-toolbar-actions.js') < editorHtml.indexOf('editor-floating-toolbar-keyboard.js'), 'actions should be before keyboard');
assert.ok(editorHtml.indexOf('editor-floating-toolbar-keyboard.js') < editorHtml.indexOf('editor-floating-toolbar.js'), 'keyboard should be before main toolbar');
console.log('Script order verified.');

// 2. Load the script in an isolated namespace
const sandbox = { window: {}, document: { addEventListener: () => {} }, console: { log: () => {} } };
const scriptContent = fs.readFileSync(path.join(__dirname, 'js', 'editor', 'editor-floating-toolbar-keyboard.js'), 'utf8');
const runInContext = new Function('window', 'document', 'console', scriptContent);
runInContext(sandbox.window, sandbox.document, sandbox.console);

const keyboardModule = sandbox.window.LoveBudFloatingToolbarKeyboard;
assert.ok(keyboardModule, 'LoveBudFloatingToolbarKeyboard module loaded');
assert.ok(typeof keyboardModule.handleShortcut === 'function', 'handleShortcut is a function');
console.log('LoveBudFloatingToolbarKeyboard object verified.');

// 3. Test behavior dispatch
let actionCalled = null;
sandbox.window.LoveBudFloatingToolbarActions = {
  edit: () => { actionCalled = 'edit'; },
  continue: () => { actionCalled = 'continue'; },
  view: () => { actionCalled = 'view'; }
};

const mockContext = {
  isVisible: true,
  deleteAction: { click: () => { actionCalled = 'delete-action'; } },
  flashButton: () => {}
};

function testKey(key, expectedAction, targetTag = 'BODY') {
  actionCalled = null;
  const mockEvent = {
    key: key,
    target: { tagName: targetTag },
    preventDefault: () => {},
    stopPropagation: () => {},
    ctrlKey: false, metaKey: false, altKey: false
  };
  keyboardModule.handleShortcut(mockEvent, mockContext);
  assert.strictEqual(actionCalled, expectedAction, `Key ${key} on ${targetTag} should trigger ${expectedAction}, got ${actionCalled}`);
}

// E -> edit
testKey('e', 'edit');
testKey('E', 'edit');

// C -> continue
testKey('c', 'continue');
testKey('C', 'continue');

// V -> view
testKey('v', 'view');
testKey('V', 'view');

// Delete/Backspace -> delete-action
testKey('Delete', 'delete-action');
testKey('Backspace', 'delete-action');
console.log('Shortcut dispatch verified.');

// 4. Input guard verification
testKey('e', null, 'INPUT');
testKey('e', null, 'TEXTAREA');
testKey('e', null, 'SELECT');
testKey('Delete', null, 'INPUT');
console.log('Input/textarea/select guards verified.');

// 5. contenteditable guard verification
// No explicit guard for contenteditable in current code (as described in PR body)
testKey('e', 'edit', 'DIV'); // A contenteditable is usually a DIV. It triggers edit because there's no guard.
console.log('contenteditable behavior unchanged verified.');

console.log('All smoke tests passed successfully!');
