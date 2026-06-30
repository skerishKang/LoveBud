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

// ── 8. Follow-up sequence section scope validation ───────────────

test('audit document follow-up sequence lists issues in correct order inside the section scope', function () {
  const src = readAudit();
  const sectionTitle = '## 9. 후속 순서';
  const startIdx = src.indexOf(sectionTitle);
  assert.ok(startIdx !== -1, 'audit document must contain "## 9. 후속 순서"');

  // Extract content after the section title until the next major section or end
  let sectionContent = src.substring(startIdx);
  const nextSectionIdx = sectionContent.indexOf('## 10.');
  if (nextSectionIdx !== -1) {
    sectionContent = sectionContent.substring(0, nextSectionIdx);
  }

  const idx3057 = sectionContent.indexOf('#3057');
  const idx3056 = sectionContent.indexOf('#3056');
  const idx3058 = sectionContent.indexOf('#3058');
  const idx3059 = sectionContent.indexOf('#3059');
  const idx3060 = sectionContent.indexOf('#3060');
  const idx3061 = sectionContent.indexOf('#3061');

  assert.ok(idx3057 !== -1, '#3057 must be in follow-up sequence');
  assert.ok(idx3056 !== -1, '#3056 must be in follow-up sequence');
  assert.ok(idx3058 !== -1, '#3058 must be in follow-up sequence');
  assert.ok(idx3059 !== -1, '#3059 must be in follow-up sequence');
  assert.ok(idx3060 !== -1, '#3060 must be in follow-up sequence');
  assert.ok(idx3061 !== -1, '#3061 must be in follow-up sequence');

  assert.ok(idx3057 < idx3056, '#3057 must precede #3056');
  assert.ok(idx3056 < idx3058, '#3056 must precede #3058');
  assert.ok(idx3058 < idx3059, '#3058 must precede #3059');
  assert.ok(idx3059 < idx3060, '#3059 must precede #3060');
  assert.ok(idx3060 < idx3061, '#3060 must precede #3061');
});

// ── 9. #1882 must only be Refs (not Closes/Fixes/Resolves) in test source ──

test('this test source does not close #1882 with forbidden verbs', function () {
  const src = fs.readFileSync(__filename, 'utf8');
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

// ── 11. Source-derived regression validations ─────────────────────

test('js/viewer/public-canvas-mobile-layout.js only overrides loadLayoutMode', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-mobile-layout.js'), 'utf8');
  // It monkey-patches loadLayoutMode
  assert.ok(src.includes('storage.loadLayoutMode ='), 'must override loadLayoutMode');
  // It should NOT override loadStoredLayout
  assert.ok(!src.includes('loadStoredLayout ='), 'must NOT override loadStoredLayout');
});

test('js/editor/editor-canvas.js executes loadStoredLayout before loadLayoutMode', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas.js'), 'utf8');
  const idxLoadLayout = src.indexOf('loadStoredLayout()');
  const idxModeLayout = src.indexOf('loadLayoutMode()');
  assert.ok(idxLoadLayout !== -1 && idxModeLayout !== -1, 'both calls must exist');
  assert.ok(idxLoadLayout < idxModeLayout, 'loadStoredLayout must be evaluated before loadLayoutMode');
});

test('js/editor/editor-canvas-layout.js loadStoredLayout reads positions, offsetX, offsetY, scale', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-layout.js'), 'utf8');
  assert.ok(src.includes('positions'), 'must read positions');
  assert.ok(src.includes('offsetX'), 'must read offsetX');
  assert.ok(src.includes('offsetY'), 'must read offsetY');
  assert.ok(src.includes('scale'), 'must read scale');
});

test('js/editor/editor-canvas-utils.js passes viewportState to projection in structured mode', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/editor/editor-canvas-utils.js'), 'utf8');
  // calcPosition calls projectWorldPosition (or fallback) with viewportState
  assert.ok(src.includes('viewportState'), 'calcPosition must reference viewportState');
  assert.ok(src.includes('projectWorldPosition(world, viewportState)') || src.includes('viewportState.offsetX'),
    'viewportState must be passed to projectWorldPosition or direct fallback rendering');
});

// ── 12. Audit doc mobile portrait boundary text assertions ────────

test('audit document correctly describes portrait mobile boundary facts', function () {
  const src = readAudit();

  // Must state that portrait mobile only overrides loadLayoutMode or mode result
  assert.ok(src.includes('forces the layout-mode result to structured') ||
            src.includes('loadLayoutMode() 만 monkey-patch하여') ||
            src.includes("loadLayoutMode만 monkey-patch"),
    'audit doc must describe mode override on portrait mobile');

  // Must state that loadStoredLayout is not bypassed
  assert.ok(src.includes('does not bypass loadStoredLayout') ||
            src.includes('loadStoredLayout()은 바이패스하지 않고') ||
            src.includes('loadStoredLayout는 바이패스하지 않고'),
    'audit doc must state loadStoredLayout is not bypassed on portrait mobile');

  // Must state positions are not used for structured world positions, but offset/scale still affect projection
  assert.ok(src.includes('Stored free positions are not used for structured node world positions') ||
            src.includes('월드 좌표 자체는 structured에 의해 무시되나') ||
            src.includes('positions는 사용하지 않고'),
    'audit doc must explain positions are ignored in structured world coordinate calculation');

  assert.ok(src.includes('stored viewport offset and scale can still affect projected rendering') ||
            src.includes('viewport offset/scale 및 zoom 정보가 투영(projection) 시점에 결합') ||
            src.includes('viewport offset/scale이 반영'),
    'audit doc must state stored offset/scale still affect projected rendering');

  // Must state portrait mobile is inside #3057 scope
  assert.ok(src.includes('#3057') && (src.includes('portrait mobile도') || src.includes('portrait mobile도 반드시 포함')),
    'audit doc must mention portrait mobile is in #3057 local isolation scope');
});
