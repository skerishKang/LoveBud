const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const AUDIT_PATH = path.join(ROOT, 'docs', 'engineering', 'PUBLIC_VIEWER_SHELL_SPLIT_AUDIT.md');

function readDoc() {
  return fs.readFileSync(AUDIT_PATH, 'utf8');
}

test('public viewer shell split audit document exists', () => {
  assert.ok(fs.existsSync(AUDIT_PATH), 'docs/engineering/PUBLIC_VIEWER_SHELL_SPLIT_AUDIT.md must exist');
});

test('audit document references core files', () => {
  const content = readDoc();
  assert.match(content, /public-tree-viewer\.js/);
  assert.match(content, /public-canvas-init\.js/);
  assert.match(content, /public-viewer-detail-ui\.js/);
  assert.match(content, /pages\/view\.html/);
  assert.match(content, /pages\/tree\.html/);
});

test('audit document has required sections', () => {
  const content = readDoc();
  assert.match(content, /Viewer entrypoints by page/);
  assert.match(content, /Shell responsibility/);
  assert.match(content, /Global namespaces \/ public APIs/);
  assert.match(content, /DOM ownership/);
  assert.match(content, /Script loading order/);
  assert.match(content, /Test coverage anchors/);
  assert.match(content, /Low-risk split candidates/);
  assert.match(content, /Risky \/ defer sections/);
  assert.match(content, /One-file-at-a-time follow-up plan/);
});

test('audit document declares no behavior changes', () => {
  const content = readDoc();
  assert.match(content, /no behavior changes/i);
  assert.match(content, /no viewer redesign/i);
  assert.match(content, /no module conversion/i);
});
