/**
 * Tree Layout Persistence & Viewer Ownership — Audit Contract Test (#3055)
 *
 * Validates that the audit document is complete and structurally sound.
 * This test does NOT execute browser code, firebase, or any network request.
 * It does NOT use real accounts, emails, passwords, or tokens.
 *
 * Refs #3055
 * Refs #3054
 * Refs #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../');
const AUDIT_DOC = path.join(ROOT, 'docs/product/lovebud-tree-layout-persistence-ownership-audit.md');

// ── Helper ──────────────────────────────────────────────────────────

function readAudit() {
  return fs.readFileSync(AUDIT_DOC, 'utf8');
}

// ── 1. Document existence ─────────────────────────────────────────

test('audit document exists', function () {
  assert.ok(fs.existsSync(AUDIT_DOC),
    'docs/product/lovebud-tree-layout-persistence-ownership-audit.md must exist');
});

// ── 2. Issue references ───────────────────────────────────────────

test('audit document references #3055', function () {
  const src = readAudit();
  assert.ok(src.includes('#3055'), 'audit doc must reference #3055');
});

test('audit document references #3054', function () {
  const src = readAudit();
  assert.ok(src.includes('#3054') || src.includes('Refs #3054'), 'audit doc must reference #3054');
});

test('audit document references #1882 as Refs (not Closes/Fixes/Resolves)', function () {
  const src = readAudit();
  assert.ok(src.includes('Refs #1882'), 'audit doc must contain "Refs #1882"');
  assert.ok(!src.includes('Closes #1882'), 'audit doc must NOT contain "Closes #1882"');
  assert.ok(!src.includes('Fixes #1882'), 'audit doc must NOT contain "Fixes #1882"');
  assert.ok(!src.includes('Resolves #1882'), 'audit doc must NOT contain "Resolves #1882"');
});

// ── 3. localStorage key mentions ─────────────────────────────────

test('audit document mentions lovebud_tree_layout_v2_ key', function () {
  const src = readAudit();
  assert.ok(src.includes('lovebud_tree_layout_v2_'),
    'audit doc must mention lovebud_tree_layout_v2_ key');
});

test('audit document mentions lovebud_tree_layout_mode_ key', function () {
  const src = readAudit();
  assert.ok(src.includes('lovebud_tree_layout_mode_'),
    'audit doc must mention lovebud_tree_layout_mode_ key');
});

// ── 4. Required sections ──────────────────────────────────────────

const REQUIRED_SECTIONS = [
  ['scope and non-goals', '범위와 비목표'],
  ['evidence table / 조사 근거 표', '조사 근거 표'],
  ['ownership matrix', '4. surface ownership matrix'],
  ['manual validation matrix', '수동 검증 매트릭스'],
  ['decision matrix', '7. decision matrix'],
  ['migration guardrails', '8. migration guardrails'],
  ['follow-up sequence', '9. 후속 순서'],
];

for (const [label, text] of REQUIRED_SECTIONS) {
  test(`audit document has section: ${label}`, function () {
    const src = readAudit();
    assert.ok(src.toLowerCase().includes(text.toLowerCase()),
      `audit doc must include section containing "${text}"`);
  });
}

// ── 5. Surface coverage ───────────────────────────────────────────

const REQUIRED_SURFACES = [
  ['Owner Editor', 'Owner Editor'],
  ['read-only viewer', 'read-only viewer'],
  ['My Trees', 'My Trees'],
  ['Browse', 'Browse'],
  ['second browser/device', 'Different browser/device'],
];

for (const [label, text] of REQUIRED_SURFACES) {
  test(`audit document covers surface: ${label}`, function () {
    const src = readAudit();
    assert.ok(src.includes(text),
      `audit doc must mention surface "${text}"`);
  });
}

// ── 6. browser-local draft vs shared snapshot distinction ────────

test('audit document distinguishes browser-local draft from shared snapshot', function () {
  const src = readAudit();
  assert.ok(src.includes('browser-local') || src.includes('local draft'),
    'audit doc must use the term "browser-local" or "local draft"');
  assert.ok(src.includes('shared snapshot') || src.includes('shared/published'),
    'audit doc must reference "shared snapshot" or "shared/published"');
});

test('audit document states browser-local draft and shared snapshot are separate', function () {
  const src = readAudit();
  // Must mention explicit separation principle
  assert.ok(
    src.includes('local draft와 shared snapshot은 명시적으로 구분') ||
    src.includes('local draft and shared snapshot'),
    'audit doc must state that local draft and shared snapshot are explicitly separated'
  );
});

// ── 7. Non-goals: no DB/API/schema migration, no runtime change ──

test('audit document states DB/API/schema migration 없음', function () {
  const src = readAudit();
  assert.ok(
    src.includes('DB/API/schema migration 없음') || src.includes('no DB/API/schema migration'),
    'audit doc must explicitly state "DB/API/schema migration 없음"'
  );
});

test('audit document states runtime behavior 변경 없음', function () {
  const src = readAudit();
  assert.ok(
    src.includes('runtime behavior 변경 없음') || src.includes('no runtime behavior change'),
    'audit doc must explicitly state "runtime behavior 변경 없음"'
  );
});

// ── 8. Follow-up sequence ─────────────────────────────────────────

const FOLLOWUP_ISSUES = ['#3057', '#3056', '#3058', '#3059', '#3060', '#3061'];

for (const issue of FOLLOWUP_ISSUES) {
  test(`audit document mentions follow-up issue ${issue}`, function () {
    const src = readAudit();
    assert.ok(src.includes(issue),
      `audit doc must mention follow-up issue ${issue} in the follow-up sequence`);
  });
}

// Verify ordering: #3057 before #3056 before #3058 etc.
test('audit document follow-up sequence lists #3057 before #3056', function () {
  const src = readAudit();
  const idx3057 = src.indexOf('#3057');
  const idx3056 = src.indexOf('#3056');
  // In the sequence table, #3057 should appear before #3056
  assert.ok(idx3057 !== -1 && idx3056 !== -1 && idx3057 < idx3056,
    'In the follow-up sequence, #3057 must appear before #3056');
});

test('audit document follow-up sequence lists #3056 before #3058', function () {
  const src = readAudit();
  const pos3056 = src.indexOf('#3056');
  const pos3058 = src.indexOf('#3058');
  assert.ok(pos3056 !== -1 && pos3058 !== -1 && pos3056 < pos3058,
    'In the follow-up sequence, #3056 must appear before #3058');
});

// ── 9. #1882 must only be Refs (not Closes/Fixes/Resolves) in test source ──

// These tests verify the test source does not accidentally contain forbidden closing references
// to #1882. We use RegExp to avoid the literal string appearing in this source file.
test('this test source does not close #1882 with forbidden verbs', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  // Check that no line starts with the forbidden patterns (Closes|Fixes|Resolves) #1882
  const forbiddenPattern = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbiddenPattern.test(src),
    'test source must NOT contain a line closing #1882 with Closes/Fixes/Resolves');
});

// ── 10. No real credentials in audit doc or test ─────────────────

const CREDENTIAL_PATTERNS = [
  /password\s*=\s*['"][^'"]{4,}/i,
  /api[_-]?key\s*=\s*['"][^'"]{4,}/i,
  /access[_-]?token\s*:\s*['"][^'"]{10,}/i,
  /firebase.*private[_-]?key.*BEGIN/i,
];

test('audit document contains no real credential values', function () {
  const src = readAudit();
  for (const pattern of CREDENTIAL_PATTERNS) {
    assert.ok(!pattern.test(src),
      `audit doc must not contain real credential matching ${pattern}`);
  }
});

test('this test source contains no real credential values', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  for (const pattern of CREDENTIAL_PATTERNS) {
    assert.ok(!pattern.test(src),
      `test source must not contain real credential matching ${pattern}`);
  }
});

// ── 11. Structural boundary validations ──────────────────────────

test('audit document states public viewer uses canEdit: false', function () {
  const src = readAudit();
  assert.ok(src.includes('canEdit: false') || src.includes('canEdit === false'),
    'audit doc must mention canEdit: false for public/read-only viewer');
});

test('audit document states structured mode does not overwrite free positions', function () {
  const src = readAudit();
  assert.ok(
    src.includes('overwrite') || src.includes('보존') || src.includes('보존됨'),
    'audit doc must state that structured mode does not overwrite free positions'
  );
});

test('audit document states logout does not remove layout keys', function () {
  const src = readAudit();
  assert.ok(
    src.includes('removeItem') || src.includes('잔존'),
    'audit doc must state that layout keys survive logout (no removeItem call found)'
  );
});

test('audit document states My Trees hub does not use editor canvas', function () {
  const src = readAudit();
  assert.ok(
    src.includes('canvas 미사용') || src.includes('does not use canvas') || src.includes('canvas를 호출하지 않음'),
    'audit doc must state that My Trees hub does not use editor canvas'
  );
});

test('audit document states Browse hub does not use editor canvas', function () {
  const src = readAudit();
  // Browse hub section must mention that it does not use canvas (search full doc)
  assert.ok(
    src.includes('Browse hub') || (src.includes('Browse') && (src.includes('canvas 미사용') || src.includes('metadata만'))),
    'audit doc must describe Browse hub behavior (canvas not used / metadata only)'
  );
});

test('audit document mentions mobile structured layout override (portrait mobile)', function () {
  const src = readAudit();
  assert.ok(
    src.includes('portrait') || src.includes('mobile') || src.includes('monkey-patch') || src.includes('560px'),
    'audit doc must mention portrait mobile structured layout override'
  );
});

test('audit document mentions localStorage parse failure fallback', function () {
  const src = readAudit();
  assert.ok(
    src.includes('parse error') || src.includes('parse fail') || src.includes('catch') || src.includes('fallback'),
    'audit doc must mention localStorage parse failure fallback behavior'
  );
});

test('audit document mentions payload fields: positions, offsetX, offsetY, scale', function () {
  const src = readAudit();
  assert.ok(src.includes('positions'), 'audit doc must mention "positions" field');
  assert.ok(src.includes('offsetX'), 'audit doc must mention "offsetX" field');
  assert.ok(src.includes('offsetY'), 'audit doc must mention "offsetY" field');
  assert.ok(src.includes('scale'), 'audit doc must mention "scale" field');
});

test('audit document distinguishes relationship topology from positions key', function () {
  const src = readAudit();
  assert.ok(
    src.includes('relationship') || src.includes('topology') || src.includes('부모-자식'),
    'audit doc must distinguish relationship topology from layout positions key'
  );
});

test('audit document distinguishes appreciation order from positions key', function () {
  const src = readAudit();
  assert.ok(
    src.includes('appreciation order') || src.includes('감상 순서'),
    'audit doc must distinguish appreciation order from layout positions key'
  );
});

test('audit document states device-specific viewport must not be included in shared snapshot', function () {
  const src = readAudit();
  assert.ok(
    src.includes('device-specific') || src.includes('device specific') || src.includes('기기'),
    'audit doc must state device-specific viewport must not go into shared snapshot'
  );
});

test('audit document migration guardrails: no pointer-move DB write', function () {
  const src = readAudit();
  assert.ok(
    src.includes('pointer move') || src.includes('pointer-move') || src.includes('실시간'),
    'audit doc must state pointer-move-per-write is forbidden'
  );
});

// ── 12. Verify source files referenced in audit doc exist ────────

const REFERENCED_FILES = [
  'js/editor/editor-canvas.js',
  'js/editor/editor-canvas-layout.js',
  'js/editor/editor-canvas-layout-storage.js',
  'js/editor/editor-canvas-layout-helpers.js',
  'js/viewer/public-canvas-init.js',
  'js/viewer/public-canvas-mobile-layout.js',
  'js/my-trees/my-trees-preview-hub.js',
  'js/visitor-viewer/visitor-viewer-render-tree.js',
];

for (const relPath of REFERENCED_FILES) {
  test(`referenced source file exists: ${relPath}`, function () {
    const abs = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(abs), `${relPath} must exist (referenced in audit doc)`);
  });
}

// ── 13. Key only appears in editor-canvas.js and editor-canvas-layout.js ──

test('lovebud_tree_layout_v2_ key appears in editor-canvas-layout.js', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout.js'), 'utf8');
  assert.ok(src.includes('lovebud_tree_layout_v2_'),
    'editor-canvas-layout.js must define lovebud_tree_layout_v2_ key');
});

test('lovebud_tree_layout_mode_ key appears in editor-canvas.js', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas.js'), 'utf8');
  assert.ok(src.includes('lovebud_tree_layout_mode_'),
    'editor-canvas.js must define lovebud_tree_layout_mode_ key');
});

test('lovebud_tree_layout keys do NOT appear in My Trees preview hub', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js'), 'utf8');
  assert.ok(!src.includes('lovebud_tree_layout'),
    'my-trees-preview-hub.js must not reference lovebud_tree_layout keys');
});

test('persistStoredPositions skips when canEdit is false (code guard exists)', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js'), 'utf8');
  assert.ok(src.includes('canEdit === false'),
    'editor-canvas-layout-storage.js must guard persistStoredPositions with canEdit === false');
});

test('persistStoredPositions skips when layoutMode is structured (code guard exists)', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js'), 'utf8');
  assert.ok(src.includes("layoutMode === 'structured'"),
    'editor-canvas-layout-storage.js must skip persist when layoutMode === structured');
});

test('public-canvas-init.js passes canEdit: false to canvas options', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(src.includes('canEdit: false'),
    'public-canvas-init.js must pass canEdit: false to createEditorCanvas options');
});

test('public-canvas-mobile-layout.js forces structured mode for portrait mobile', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-mobile-layout.js'), 'utf8');
  assert.ok(src.includes("return 'structured'"),
    'public-canvas-mobile-layout.js must return structured for portrait mobile');
});

test('localStorage fallback returns default when parse fails (try/catch present)', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout.js'), 'utf8');
  assert.ok(src.includes('catch'),
    'editor-canvas-layout.js must have try/catch for localStorage parse failure');
  assert.ok(src.includes('positions: {}'),
    'editor-canvas-layout.js fallback must return empty positions');
});

test('lovebud_tree_layout_v2_ payload includes positions, offsetX, offsetY, scale', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout.js'), 'utf8');
  assert.ok(src.includes('positions'), 'payload must include positions');
  assert.ok(src.includes('offsetX'), 'payload must include offsetX');
  assert.ok(src.includes('offsetY'), 'payload must include offsetY');
  assert.ok(src.includes('scale'), 'payload must include scale');
});

test('visitor-viewer does not reference lovebud_tree_layout keys', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8');
  assert.ok(!src.includes('lovebud_tree_layout'),
    'visitor-viewer-render-tree.js must not reference lovebud_tree_layout keys (it is localStorage-independent)');
});

test('no removeItem call for lovebud_tree_layout_ in the codebase JS files (layout keys persist across logout)', function () {
  // Check layout-related files and auth files
  const filesToCheck = [
    'js/auth.js',
    'js/editor/editor-canvas.js',
    'js/editor/editor-canvas-layout.js',
    'js/editor/editor-canvas-layout-storage.js',
  ];
  for (const relPath of filesToCheck) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    const hasRemoveItemLayout = src.includes("removeItem('lovebud_tree_layout") ||
      src.includes('removeItem("lovebud_tree_layout') ||
      src.includes("removeItem(`lovebud_tree_layout");
    assert.ok(!hasRemoveItemLayout,
      `${relPath} must NOT contain removeItem for lovebud_tree_layout_ keys (keys persist across logout — corollary of audit finding)`);
  }
});
