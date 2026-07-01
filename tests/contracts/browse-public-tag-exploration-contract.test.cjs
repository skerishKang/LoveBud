const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-browse-public-tag-exploration-contract.md');

test('Contract Document existence and sections integrity', () => {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist: ${DOC_PATH}`);
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify mandatory sections are present
  const requiredSections = [
    '# LoveBud Browse Public Tag Exploration Contract',
    '## Status and scope',
    '## Current public tag source audit',
    '## Explicit owner-only metadata exclusion',
    '## Public eligibility and privacy boundary',
    '## Canonical URL contract',
    '## Tag normalization contract',
    '## Search, sort, clear, back/forward behavior',
    '## Accessibility and keyboard behavior',
    '## Empty, loading, and failure states',
    '## API and pagination feasibility',
    '## Explicit non-goals',
    '## Narrow follow-up implementation slice',
    '## Test and production-validation plan',
    '## References'
  ];

  requiredSections.forEach(section => {
    assert.ok(content.includes(section), `Document must contain section: ${section}`);
  });
});

test('Contract contents verification with portable references', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');

  // Verify key audits, exclusions, patterns, parameters, boundaries, non-goals
  assert.ok(content.includes('emotionTags') && content.includes('getPublicTags'), 'Must document current public tag source evidence');
  assert.ok(content.includes('groupName') && content.includes('keywords') && content.includes('owner-only'), 'Must explicitly exclude owner metadata');
  assert.ok(content.includes('?tag=') || content.includes('tag='), 'Must define canonical URL query parameters');
  assert.ok(content.includes('Unicode') && content.includes('NFC') && content.includes('maximum length'), 'Must define normalization details and length');
  assert.ok(content.includes('clear') && content.includes('back') && content.includes('forward') && content.includes('loading') && content.includes('keyboard') && content.includes('accessible name'), 'Must define UX interaction contracts');
  assert.ok(content.includes('privacy') && content.includes('pagination'), 'Must document pagination and privacy guardrails');
  assert.ok(content.includes('non-goal') || content.includes('Non-Goals'), 'Must explicitly list non-goals');
  assert.ok(content.includes('follow-up') && content.includes('validation'), 'Must include follow-up plans and validation plans');
  
  // Refs links presence check
  assert.ok(content.includes('Refs #3123'), 'Refs #3123 must be present');
  assert.ok(content.includes('Refs #2981'), 'Refs #2981 must be present');
  assert.ok(content.includes('Refs #3121'), 'Refs #3121 must be present');
  assert.ok(content.includes('Refs #2882'), 'Refs #2882 must be present');
  assert.ok(content.includes('Refs #1882'), 'Refs #1882 must be present');

  // Portable code evidence paths presence
  const expectedPaths = [
    'js/search/search-public-metadata-helper.js',
    'js/api/public-tree-adapter.js',
    'js/search/search-url-state.js',
    'modal_compute/public_reads.py'
  ];
  expectedPaths.forEach(p => {
    assert.ok(content.includes(p), `Document must contain portable path: ${p}`);
  });

  // Server-side eligibility-first and filter-before-pagination guardrail presence
  assert.ok(content.includes('eligibility') && content.includes('before') && content.includes('pagination'), 'Must specify eligibility-first and filter-before-pagination logic');
});

test('Document does not contain local file URI links', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  const literalUri = ['file', ':', '///'].join('');
  assert.ok(!content.includes(literalUri), 'Document must not contain local file URI links');
});

test('Document does not contain incorrect issue descriptions', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(!content.includes('Public metadata helpers'), 'Document must not contain Public metadata helpers reference description');
  assert.ok(!content.includes('Tree summary API contract'), 'Document must not contain Tree summary API contract reference description');
  assert.ok(!content.includes('Browse page URL state management'), 'Document must not contain Browse page URL state management reference description');
});

test('Document does not contain unsupported sort features', () => {
  const content = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(!content.includes('sort=views'), 'Document must not contain sort=views');
  assert.ok(!content.includes('sort=likes'), 'Document must not contain sort=likes');
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
