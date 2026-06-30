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

// ── 1. Document existence & basic issues ──────────────────────────

test('audit document exists', function () {
  assert.ok(fs.existsSync(AUDIT_DOC),
    'docs/product/lovebud-tree-layout-persistence-ownership-audit.md must exist');
});

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

// ── 2. localStorage key mentions ─────────────────────────────────

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

// ── 3. Required sections ──────────────────────────────────────────

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

// ── 4. Surface coverage ───────────────────────────────────────────

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

// ── 5. browser-local draft vs shared snapshot distinction ────────

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

// ── 6. Non-goals: no DB/API/schema migration, no runtime change ──

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

// ── 7. Follow-up sequence section scope validation ───────────────

test('audit document follow-up sequence lists issues in correct order inside the section scope', function () {
  const src = readAudit();
  const sectionTitle = '## 9. 후속 순서';
  const startIdx = src.indexOf(sectionTitle);
  assert.ok(startIdx !== -1, 'audit document must contain "## 9. 후속 순서"');

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

// ── 8. #1882 must only be Refs (not Closes/Fixes/Resolves) in test source ──

test('this test source does not close #1882 with forbidden verbs', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  const forbiddenPattern = /^\s*(Closes|Fixes|Resolves)\s+#1882/m;
  assert.ok(!forbiddenPattern.test(src),
    'test source must NOT contain a line closing #1882 with Closes/Fixes/Resolves');
});

// ── 9. No real credentials in audit doc or test ─────────────────

const CREDENTIAL_PATTERNS = [
  /password\s*=\s*['"][^'"]{4,}/i,
  /api[_-]?key\s*=\s*['"][^'"]{4,}/i,
  /access[_-]?token\s*:\s*['"][^'"]{10,}/i,
  /firebase.*private[_-]?key.*BEGIN/i,
];

test('audit document contains no real password credentials', function () {
  const src = readAudit();
  assert.ok(!/password\s*=\s*['"][^'"]{4,}/i.test(src), 'audit doc must not contain password credentials');
});

test('audit document contains no real api key credentials', function () {
  const src = readAudit();
  assert.ok(!/api[_-]?key\s*=\s*['"][^'"]{4,}/i.test(src), 'audit doc must not contain api key credentials');
});

test('audit document contains no real access token credentials', function () {
  const src = readAudit();
  assert.ok(!/access[_-]?token\s*:\s*['"][^'"]{10,}/i.test(src), 'audit doc must not contain access token credentials');
});

test('audit document contains no real private key credentials', function () {
  const src = readAudit();
  assert.ok(!/firebase.*private[_-]?key.*BEGIN/i.test(src), 'audit doc must not contain private key credentials');
});

test('this test source contains no real password credentials', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/password\s*=\s*['"][^'"]{4,}/i.test(src), 'test source must not contain password credentials');
});

test('this test source contains no real api key credentials', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/api[_-]?key\s*=\s*['"][^'"]{4,}/i.test(src), 'test source must not contain api key credentials');
});

test('this test source contains no real access token credentials', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/access[_-]?token\s*:\s*['"][^'"]{10,}/i.test(src), 'test source must not contain access token credentials');
});

test('this test source contains no real private key credentials', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(!/firebase.*private[_-]?key.*BEGIN/i.test(src), 'test source must not contain private key credentials');
});

// ── 10. Source-derived mobile regression validations ───────────────

test('js/viewer/public-canvas-mobile-layout.js only overrides loadLayoutMode', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-mobile-layout.js'), 'utf8');
  assert.ok(src.includes('storage.loadLayoutMode ='), 'must override loadLayoutMode');
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
  assert.ok(src.includes('viewportState'), 'calcPosition must reference viewportState');
  assert.ok(src.includes('projectWorldPosition(world, viewportState)') || src.includes('viewportState.offsetX'),
    'viewportState must be passed to projectWorldPosition or direct fallback rendering');
});

test('audit document correctly describes portrait mobile boundary facts', function () {
  const src = readAudit();

  assert.ok(src.includes('forces the layout-mode result to structured') ||
            src.includes('loadLayoutMode() 만 monkey-patch하여') ||
            src.includes("loadLayoutMode만 monkey-patch"),
    'audit doc must describe mode override on portrait mobile');

  assert.ok(src.includes('does not bypass loadStoredLayout') ||
            src.includes('loadStoredLayout()은 바이패스하지 않고') ||
            src.includes('loadStoredLayout는 바이패스하지 않고'),
    'audit doc must state loadStoredLayout is not bypassed on portrait mobile');

  assert.ok(src.includes('Stored free positions are not used for structured node world positions') ||
            src.includes('월드 좌표 자체는 structured에 의해 무시되나') ||
            src.includes('positions는 사용하지 않고'),
    'audit doc must explain positions are ignored in structured world coordinate calculation');

  assert.ok(src.includes('stored viewport offset and scale can still affect projected rendering') ||
            src.includes('viewport offset/scale 및 zoom 정보가 투영(projection) 시점에 결합') ||
            src.includes('viewport offset/scale이 반영'),
    'audit doc must state stored offset/scale still affect projected rendering');

  assert.ok(src.includes('#3057') && (src.includes('portrait mobile도') || src.includes('portrait mobile도 반드시 포함')),
    'audit doc must mention portrait mobile is in #3057 local isolation scope');
});

// ── 11. Document-structure & boundary claims checks (from previous contract) ──

test('audit document states public/read-only viewer uses canEdit: false', function () {
  const src = readAudit();
  assert.ok(src.includes('canEdit: false') || src.includes('canEdit === false'),
    'audit doc must mention canEdit: false for public/read-only viewer');
});

test('audit document states structured mode does not overwrite free positions', function () {
  const src = readAudit();
  assert.ok(
    src.includes('overwrite') || src.includes('보존') || src.includes('보존됨'),
    'audit doc must state structured mode does not overwrite free positions'
  );
});

test('audit document states logout does not remove layout keys', function () {
  const src = readAudit();
  assert.ok(
    src.includes('removeItem') || src.includes('잔존') || src.includes('지워지지 않는'),
    'audit doc must state layout keys survive logout (no removeItem call found)'
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
  assert.ok(
    src.includes('Browse hub') || (src.includes('Browse') && (src.includes('canvas 미사용') || src.includes('metadata만'))),
    'audit doc must describe Browse hub behavior (canvas not used / metadata only)'
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

// ── 12. Referenced source files existence checks ─────────────────

test('referenced source file exists: js/editor/editor-canvas.js', function () {
  const abs = path.join(ROOT, 'js/editor/editor-canvas.js');
  assert.ok(fs.existsSync(abs), 'js/editor/editor-canvas.js must exist');
});

test('referenced source file exists: js/editor/editor-canvas-layout.js', function () {
  const abs = path.join(ROOT, 'js/editor/editor-canvas-layout.js');
  assert.ok(fs.existsSync(abs), 'js/editor/editor-canvas-layout.js must exist');
});

test('referenced source file exists: js/editor/editor-canvas-layout-storage.js', function () {
  const abs = path.join(ROOT, 'js/editor/editor-canvas-layout-storage.js');
  assert.ok(fs.existsSync(abs), 'js/editor/editor-canvas-layout-storage.js must exist');
});

test('referenced source file exists: js/editor/editor-canvas-layout-helpers.js', function () {
  const abs = path.join(ROOT, 'js/editor/editor-canvas-layout-helpers.js');
  assert.ok(fs.existsSync(abs), 'js/editor/editor-canvas-layout-helpers.js must exist');
});

test('referenced source file exists: js/viewer/public-canvas-init.js', function () {
  const abs = path.join(ROOT, 'js/viewer/public-canvas-init.js');
  assert.ok(fs.existsSync(abs), 'js/viewer/public-canvas-init.js must exist');
});

test('referenced source file exists: js/viewer/public-canvas-mobile-layout.js', function () {
  const abs = path.join(ROOT, 'js/viewer/public-canvas-mobile-layout.js');
  assert.ok(fs.existsSync(abs), 'js/viewer/public-canvas-mobile-layout.js must exist');
});

test('referenced source file exists: js/my-trees/my-trees-preview-hub.js', function () {
  const abs = path.join(ROOT, 'js/my-trees/my-trees-preview-hub.js');
  assert.ok(fs.existsSync(abs), 'js/my-trees/my-trees-preview-hub.js must exist');
});

test('referenced source file exists: js/visitor-viewer/visitor-viewer-render-tree.js', function () {
  const abs = path.join(ROOT, 'js/visitor-viewer/visitor-viewer-render-tree.js');
  assert.ok(fs.existsSync(abs), 'js/visitor-viewer/visitor-viewer-render-tree.js must exist');
});


// ── 13. Source code guards and keys validation ────────────────────

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
  assert.ok(src.includes('positions: {}') || src.includes('positions:parsed.positions'),
    'editor-canvas-layout.js fallback must return empty positions');
});

test('visitor-viewer does not reference lovebud_tree_layout keys', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js/visitor-viewer/visitor-viewer-render-tree.js'), 'utf8');
  assert.ok(!src.includes('lovebud_tree_layout'),
    'visitor-viewer-render-tree.js must not reference lovebud_tree_layout keys');
});

test('no removeItem call for lovebud_tree_layout_ in the codebase JS files (layout keys persist across logout)', function () {
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
      `${relPath} must NOT contain removeItem for lovebud_tree_layout_ keys`);
  }
});
