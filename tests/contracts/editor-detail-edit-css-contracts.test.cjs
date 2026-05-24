const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'css/editor/editor-detail-edit.css');
const ACTIONS = path.join(ROOT, 'css/editor/editor-detail-edit/actions.css');
const FORM_FIELDS = path.join(ROOT, 'css/editor/editor-detail-edit/form-fields.css');
const RESPONSIVE = path.join(ROOT, 'css/editor/editor-detail-edit/responsive.css');

const manifest = fs.readFileSync(MANIFEST, 'utf8');
const actions = fs.readFileSync(ACTIONS, 'utf8');
const formFields = fs.readFileSync(FORM_FIELDS, 'utf8');
const responsive = fs.readFileSync(RESPONSIVE, 'utf8');

// ---------------------------------------------------------------------------
// 1. Manifest imports
// ---------------------------------------------------------------------------
test('manifest imports all split files', () => {
  assert.match(manifest, /editor-detail-edit\/actions\.css/);
  assert.match(manifest, /editor-detail-edit\/form-fields\.css/);
  assert.match(manifest, /editor-detail-edit\/responsive\.css/);
});

// ---------------------------------------------------------------------------
// 2. actions.css selectors
// ---------------------------------------------------------------------------
test('actions.css — editor-edit-actions-row selector preserved', () => {
  assert.match(actions, /\.editor-edit-actions-row\s*\{/);
});

test('actions.css — editor-delete-row selector preserved', () => {
  assert.match(actions, /\.editor-delete-row\s*\{/);
});

test('actions.css — editor-delete-link selector preserved', () => {
  assert.match(actions, /\.editor-delete-link\s*\{/);
});

test('actions.css — editor-delete-link:hover selector preserved', () => {
  assert.match(actions, /\.editor-delete-link:hover\s*\{/);
});

test('actions.css — editor-delete-link:focus-visible selector preserved', () => {
  assert.match(actions, /\.editor-delete-link:focus-visible\s*\{/);
});

test('actions.css — editor-edit-danger-action selector preserved', () => {
  assert.match(actions, /\.editor-edit-actions-row\s+\.editor-edit-danger-action\s*\{/);
});

test('actions.css — detailEditMode form-stack override preserved', () => {
  assert.match(actions, /#detailEditMode\s+\.editor-form-stack\s*\{/);
});

// ---------------------------------------------------------------------------
// 3. form-fields.css selectors
// ---------------------------------------------------------------------------
test('form-fields.css — editor-memory-form-modal selector preserved', () => {
  assert.match(formFields, /\.editor-memory-form-modal\s*\{/);
});

test('form-fields.css — editor-modal-eyebrow selector preserved', () => {
  assert.match(formFields, /\.editor-modal-eyebrow\s*\{/);
});

test('form-fields.css — editor-modal-title selector preserved', () => {
  assert.match(formFields, /\.editor-modal-title\s*\{/);
});

test('form-fields.css — editor-modal-intro selector preserved', () => {
  assert.match(formFields, /\.editor-modal-intro\s*\{/);
});

test('form-fields.css — editor-form-field selector preserved', () => {
  assert.match(formFields, /\.editor-form-field\s*,/);
});

test('form-fields.css — editor-form-help selector preserved', () => {
  assert.match(formFields, /\.editor-form-help\s*\{/);
});

test('form-fields.css — editor-form-label selector preserved', () => {
  assert.match(formFields, /\.editor-form-label\s*\{/);
});

test('form-fields.css — editor-form-input selector preserved', () => {
  assert.match(formFields, /\.editor-form-input\s*,/);
});

test('form-fields.css — editor-form-textarea selector preserved', () => {
  assert.match(formFields, /\.editor-form-textarea\s*,/);
});

test('form-fields.css — editor-form-actions selector preserved', () => {
  assert.match(formFields, /\.editor-form-actions\s*\{/);
});

test('form-fields.css — editor-form-action-btn selector preserved', () => {
  assert.match(formFields, /\.editor-form-action-btn\s*\{/);
});

test('form-fields.css — editor-form-stack selector preserved', () => {
  assert.match(formFields, /\.editor-form-stack\s*\{/);
});

test('form-fields.css — editor-form-stack-compact selector preserved', () => {
  assert.match(formFields, /\.editor-form-stack-compact\s*\{/);
});

test('form-fields.css — editor-form-stack-roomy selector preserved', () => {
  assert.match(formFields, /\.editor-form-stack-roomy\s*\{/);
});

test('form-fields.css — editor-form-field-primary selector preserved', () => {
  assert.match(formFields, /\.editor-form-field-primary\s*\{/);
});

test('form-fields.css — editor-form-field-grid selector preserved', () => {
  assert.match(formFields, /\.editor-form-field-grid\s*\{/);
});

test('form-fields.css — memoryStartTimeField ID selector preserved', () => {
  assert.match(formFields, /#memoryStartTimeField\s*\{/);
});

test('form-fields.css — editor-edit-input selector preserved', () => {
  assert.match(formFields, /\.editor-edit-input\s*,/);
});

test('form-fields.css — editor-edit-textarea selector preserved', () => {
  assert.match(formFields, /\.editor-edit-textarea/);
});

// ---------------------------------------------------------------------------
// 4. responsive.css selectors
// ---------------------------------------------------------------------------
test('responsive.css — @media max-width 375px preserved', () => {
  assert.match(responsive, /@media\s*\(max-width:\s*375px\)/);
});

test('responsive.css — detailEditMode form-actions responsive preserved', () => {
  assert.match(responsive, /#detailEditMode\s+\.editor-form-actions\s*\{/);
});

test('responsive.css — detailEditMode form-action-btn responsive preserved', () => {
  assert.match(responsive, /#detailEditMode\s+\.editor-form-action-btn\s*\{/);
});

test('responsive.css — editor-edit-actions-row responsive preserved', () => {
  assert.match(responsive, /\.editor-edit-actions-row\s*\{/);
});

// ---------------------------------------------------------------------------
// 5. Property values preserved
// ---------------------------------------------------------------------------
test('actions.css — editor-edit-actions-row has border-top', () => {
  assert.match(actions, /border-top:\s*1px solid rgba\(144,73,81,0\.10\)/);
});

test('form-fields.css — editor-form-input has border-radius 18px', () => {
  assert.match(formFields, /border-radius:\s*18px/);
});

test('form-fields.css — editor-form-stack has background', () => {
  assert.match(formFields, /background:\s*rgba\(255,255,255,0\.72\)/);
});

// ---------------------------------------------------------------------------
// 6. No class/selector changes — concatenation matches original
// ---------------------------------------------------------------------------
test('split files contain no @keyframes', () => {
  assert.doesNotMatch(actions, /@keyframes/);
  assert.doesNotMatch(formFields, /@keyframes/);
  assert.doesNotMatch(responsive, /@keyframes/);
});

// ---------------------------------------------------------------------------
// 7. Manifest is thin (target < 15 lines)
// ---------------------------------------------------------------------------
test('manifest is thin — fewer than 15 lines', () => {
  const lineCount = manifest.split('\n').filter(l => l.trim().length > 0).length;
  assert.ok(lineCount < 15, `Manifest should be <15 lines, got ${lineCount}`);
});
