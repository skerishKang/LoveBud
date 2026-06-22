const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const AUDIT_PATH = path.join(ROOT, 'docs', 'engineering', 'AUTH_FLOW_OWNERSHIP_AUDIT.md');

function readDoc() {
  return fs.readFileSync(AUDIT_PATH, 'utf8');
}

test('auth flow ownership audit document exists', () => {
  assert.ok(fs.existsSync(AUDIT_PATH), 'docs/engineering/AUTH_FLOW_OWNERSHIP_AUDIT.md must exist');
});

test('audit document references core auth files', () => {
  const content = readDoc();
  assert.match(content, /auth\.js/);
  assert.match(content, /auth-state\.js/);
  assert.match(content, /auth-cache\.js/);
  assert.match(content, /auth-firebase\.js/);
  assert.match(content, /auth-session\.js/);
  assert.match(content, /auth-callbacks\.js/);
  assert.match(content, /auth-ui\.js/);
  assert.match(content, /auth-ui-templates\.js/);
  assert.match(content, /auth-login-page\.js/);
  assert.match(content, /auth-protected-route\.js/);
});

test('audit document has required sections', () => {
  const content = readDoc();
  assert.match(content, /Auth entrypoints by page/);
  assert.match(content, /Firebase initialization/);
  assert.match(content, /Cached-session lifecycle/);
  assert.match(content, /Protected-route lifecycle/);
  assert.match(content, /Login-page lifecycle/);
  assert.match(content, /UI rendering ownership/);
  assert.match(content, /Compatibility.*bootstrap/);
  assert.match(content, /Duplicated.*responsibilities/);
  assert.match(content, /Runtime-critical files/);
  assert.match(content, /Staged low-risk refactor plan/);
});

test('audit document declares no behavior changes and keeps #1882 open', () => {
  const content = readDoc();
  assert.match(content, /no behavior changes/i);
  assert.match(content, /no Firebase config changes/i);
  assert.match(content, /no route protection behavior changes/i);
  assert.match(content, /keeps #1882 open/i);
});
