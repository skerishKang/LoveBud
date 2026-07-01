const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-tree-workspace-node-keyboard-accessibility-contract.md');

test('Contract Document existence and sections integrity', () => {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist: ${DOC_PATH}`);
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify mandatory sections are present
  const requiredSections = [
    '# LoveBud Tree Workspace Node Keyboard Accessibility Contract',
    '## Status and scope',
    '## Audit method and evidence standard',
    '## Editor node rendering and interaction inventory',
    '## Public Viewer node rendering and interaction inventory',
    '## Existing pointer, selection, and detail-panel paths',
    '## Existing keyboard and focus behavior',
    '## Needs runtime/browser verification',
    '## Recommended semantic host and focus model',
    '## Keyboard interaction contract',
    '## Selection, detail-panel, and focus-return contract',
    '## Privacy-safe accessible-name contract',
    '## Canvas, drag, pan, zoom, and mobile conflict boundaries',
    '## Protected and delegated ownership',
    '## First implementation slice',
    '## Regression coverage and browser-validation plan',
    '## Explicit non-goals',
    '## References'
  ];

  requiredSections.forEach(section => {
    assert.ok(content.includes(section), `Document must contain section: ${section}`);
  });
});

test('Contract contents verification of inventory, paths, model, and rules', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify Editor inventory evidence
  const editorSection = content.substring(content.indexOf('## Editor node rendering'), content.indexOf('## Public Viewer node rendering'));
  assert.ok(editorSection.includes('js/editor/editor-canvas-node.js'), 'Editor inventory must reference correct provider file');
  assert.ok(editorSection.includes('memory-node'), 'Editor inventory must reference memory-node class');

  // Verify Viewer inventory evidence
  const viewerSection = content.substring(content.indexOf('## Public Viewer node rendering'), content.indexOf('## Existing pointer'));
  assert.ok(viewerSection.includes('js/editor/editor-canvas-node.js'), 'Viewer inventory must reference shared provider file');

  // Exact file path / selector / function evidence
  assert.ok(content.includes('exact file path') || content.includes('Exact file path') || content.includes('Exact files'), 'Must document exact file path');
  assert.ok(content.includes('Selector') || content.includes('selector'), 'Must document selector');
  assert.ok(content.includes('Provider') || content.includes('provider'), 'Must document provider evidence');

  // Pointer-selection-detail path
  assert.ok(content.includes('Pointerdown Event') && content.includes('selectionUtils.reapplySelection') && content.includes('updateDetailPanel'), 'Must document pointer-selection-detail panel path');

  // Focus model and roving tab index
  assert.ok(content.includes('roving tabindex') && content.includes('tabindex="0"') && content.includes('tabindex="-1"'), 'Must define roving tabindex model details');

  // Keyboard navigation keys
  const keys = ['initial focus entry', 'Arrow navigation', 'Home/End', 'Enter/Space', 'Escape', 'focus return'];
  keys.forEach(k => {
    assert.ok(content.includes(k), `Must define keyboard action rule: ${k}`);
  });

  // Focus and selection distinction
  assert.ok(content.includes('selection versus focus distinction') || content.includes('focus and selection distinction'), 'Must document distinction between focus and selection');

  // Privacy rules
  const prohibitedMeta = [
    'private memo full text',
    'raw source URLs',
    'owner-only groupName',
    'owner-only keywords',
    'internal IDs',
    'hidden moderation state',
    'private media metadata'
  ];
  prohibitedMeta.forEach(p => {
    assert.ok(content.includes(p), `Must prohibit metadata: ${p}`);
  });

  // Protected issue boundaries
  const issues = ['#3072', '#2960', '#2972', '#2976', '#3121', '#1882'];
  issues.forEach(issue => {
    assert.ok(content.includes(issue), `Must reference protected issue: ${issue}`);
  });

  // First implementation slice and browser validation
  assert.ok(content.includes('First implementation slice') && content.includes('browser-validation plan'), 'Must document first implementation slice and validation plans');
});

test('Document and test do not make active code changes or deployment changes', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(content.includes('Explicit non-goals'), 'Document must list non-goals');
  assert.ok(content.includes('No HTML, JavaScript, CSS') || content.includes('No HTML'), 'Must state no UI/code change in non-goals');
});

test('Prohibited phrases absence in both document and test file', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  const selfContent = fs.readFileSync(__filename, 'utf8');

  // Avoid matching our own source code by splitting or dynamic construction
  const patternStr = '\\b(Closes|Fixes|Resolves)\\s+#1882\\b';
  const forbiddenRegex = new RegExp(patternStr, 'i');

  assert.ok(!forbiddenRegex.test(content), 'Document must not contain prohibited links');
  assert.ok(!forbiddenRegex.test(selfContent), 'Test file itself must not contain prohibited links');
});

test('Test file does not contain local file links', () => {
  const selfContent = fs.readFileSync(__filename, 'utf8');
  // Evade matching this literal string by using split
  const literalUri = ['file', ':', '///'].join('');
  assert.ok(!selfContent.includes(literalUri), 'Test file itself must not contain local file links');
});
