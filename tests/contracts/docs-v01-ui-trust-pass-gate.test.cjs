const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs/engineering/V01_UI_TRUST_PASS_RELEASE_GATE_681.md');
const INDEX_PATH = path.join(ROOT, 'docs/engineering/engineering_index.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('v0.1 UI Trust Pass release gate doc keeps required status taxonomy', () => {
  const source = read(DOC_PATH);

  for (const label of [
    'ACTIVE_REVERIFY_REQUIRED',
    'HOLD_CREDENTIAL_VERIFICATION',
    'OPEN_DRAFT_VERIFY_BEFORE_USE',
    'MERGED_OR_SUPERSEDED_VERIFY_FIRST',
  ]) {
    assert.match(source, new RegExp(label), `release gate doc must include status label ${label}`);
  }
});

test('v0.1 UI Trust Pass release gate doc tracks current active PR gates', () => {
  const source = read(DOC_PATH);

  for (const token of ['#878', '#880', '#881', '#870']) {
    assert.match(source, new RegExp(token), `release gate doc must track ${token}`);
  }

  assert.match(source, /Public detail owner identifier strip/);
  assert.match(source, /Private visibility controls/);
  assert.match(source, /Login and Settings auth consistency/);
  assert.match(source, /Visible action readiness policy/);
});

test('v0.1 UI Trust Pass release gate doc stays docs-only and redaction-safe', () => {
  const source = read(DOC_PATH);

  assert.match(source, /Scope: docs and contract only/);
  assert.match(source, /does not authorize runtime, UI, Auth, API, backend, database, deployment, package, workflow, or credential changes/);
  assert.match(source, /Do not copy credential values/);
  assert.match(source, /Refs #681/);
  assert.doesNotMatch(source, /Fixes\s+#|Closes\s+#|Resolves\s+#/i);
});

test('engineering index links v0.1 UI Trust Pass release gate doc', () => {
  const index = read(INDEX_PATH);

  assert.match(index, /V01_UI_TRUST_PASS_RELEASE_GATE_681\.md/);
  assert.match(index, /#681 v0\.1 UI Trust Pass release-gate status taxonomy/);
});
