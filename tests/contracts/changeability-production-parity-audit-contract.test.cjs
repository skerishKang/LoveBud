/**
 * Contract test for the LoveBud changeability and production parity audit (Issue #3425).
 *
 * This test verifies that docs/engineering/lovebud-changeability-production-parity-audit.md
 * contains the required audit sections and core safety boundaries. It does NOT assert that any
 * implementation code exists. It is a read-only document-structure contract.
 *
 * All assertions are source-level. No database connection, psql, subprocess, git diff, or git
 * status is used. No raw/private values are asserted.
 *
 * Refs: #3425, #3418, #3419, #3423, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_PATH = path.join(ROOT, 'docs/engineering/lovebud-changeability-production-parity-audit.md');

function readAudit() {
  assert.ok(fs.existsSync(AUDIT_PATH), `Audit document must exist at ${AUDIT_PATH}`);
  return fs.readFileSync(AUDIT_PATH, 'utf8');
}

const REQUIRED_SECTIONS = [
  '## Baseline',
  '## Executive findings',
  '## Evidence and methodology',
  '## Database schema source of truth',
  '## Test-layer map',
  '## Runtime and deployment parity',
  '## CSS and view scoping',
  '## Legacy compatibility registry',
  '## Module and domain boundaries',
  '## Change-risk model',
  '## Prioritized risk register',
  '## Recommended child issues',
  '## Recommended execution order',
  '## Non-goals and safety boundaries',
];

test('audit document exists', () => {
  assert.ok(fs.existsSync(AUDIT_PATH));
});

for (const section of REQUIRED_SECTIONS) {
  test(`audit document contains required section "${section}"`, () => {
    const doc = readAudit();
    assert.ok(
      doc.includes(section),
      `Required section "${section}" missing from audit document`
    );
  });
}

test('audit documents DB schema source-of-truth with evidence', () => {
  const doc = readAudit();
  assert.ok(doc.includes('CREATE TABLE IF NOT EXISTS') || doc.includes('IF NOT EXISTS'));
  assert.ok(
    doc.toLowerCase().includes('no record found') ||
      doc.toLowerCase().includes('no applied-migration ledger') ||
      doc.includes('schema-version table'),
    'DB section should state the absence of an applied-migration ledger / schema-version table'
  );
});

test('audit maps test layers including parser-only migration gaps', () => {
  const doc = readAudit();
  assert.ok(doc.toLowerCase().includes('parser') || doc.toLowerCase().includes('static'));
  assert.ok(doc.toLowerCase().includes('real postgresql') || doc.toLowerCase().includes('no real postgresql'));
});

test('audit addresses runtime/deployment parity gap', () => {
  const doc = readAudit();
  assert.ok(
    doc.toLowerCase().includes('revision manifest') ||
      doc.toLowerCase().includes('deployment revision') ||
      doc.toLowerCase().includes('no deployment revision')
  );
});

test('audit addresses CSS/view scoping risks', () => {
  const doc = readAudit();
  assert.ok(doc.toLowerCase().includes('!important'));
  assert.ok(
    doc.toLowerCase().includes('editor') && doc.toLowerCase().includes('public viewer'),
    'CSS section should discuss editor and public viewer shared scope'
  );
});

test('audit includes a legacy compatibility registry table', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## Legacy compatibility registry'));
  assert.ok(doc.toLowerCase().includes('removal precondition'));
});

test('audit maps module/domain boundaries', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## Module and domain boundaries'));
  assert.ok(
    doc.toLowerCase().includes('editor vs public viewer') ||
      doc.toLowerCase().includes('client vs cloudflare') ||
      doc.toLowerCase().includes('scout vs social')
  );
});

test('audit defines a change-risk model', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## Change-risk model'));
  assert.ok(doc.toLowerCase().includes('schema migration'));
});

test('audit includes a prioritized risk register with severity classes', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## Prioritized risk register'));
  assert.ok(doc.includes('RK-01'));
  assert.ok(doc.toUpperCase().includes('P0') || doc.toUpperCase().includes('P1'));
});

test('audit lists recommended child issues (candidates only)', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## Recommended child issues'));
  assert.ok(
    doc.toLowerCase().includes('candidates only') ||
      doc.toLowerCase().includes('no github issue is created'),
    'Child issues must be described as candidates, not created'
  );
});

test('audit maintains no-rewrite posture', () => {
  const doc = readAudit();
  assert.ok(
    doc.toLowerCase().includes('no repository-wide rewrite') ||
      doc.toLowerCase().includes('no big-bang rewrite') ||
      doc.toLowerCase().includes('avoids a repository-wide rewrite') ||
      doc.toLowerCase().includes('deliberately avoids a repository-wide rewrite')
  );
});

test('audit maintains no production mutation posture', () => {
  const doc = readAudit();
  assert.ok(
    doc.toLowerCase().includes('no production') &&
      (doc.toLowerCase().includes('no db migration') ||
        doc.toLowerCase().includes('no schema mutation') ||
        doc.toLowerCase().includes('no production/staging'))
  );
});

test('audit does not mix Social and Scout implementation', () => {
  const doc = readAudit();
  assert.ok(
    doc.toLowerCase().includes('do not mix social and scout') ||
      doc.toLowerCase().includes('does not mix social') ||
      (doc.toLowerCase().includes('scout') && doc.toLowerCase().includes('separate domain'))
  );
});

test('audit does not close the #3425 parent issue', () => {
  const doc = readAudit();
  assert.ok(doc.includes('#3425'));
  assert.ok(
    doc.toLowerCase().includes('does not close #3425') ||
      doc.toLowerCase().includes('not close #3425') ||
      doc.toLowerCase().includes('#3425 remains open')
  );
  // It must NOT use closing keywords against #3425.
  assert.ok(
    !/closes #3425/i.test(doc) &&
      !/fixes #3425/i.test(doc) &&
      !/resolves #3425/i.test(doc),
    'Audit must not use Closes/Fixes/Resolves for #3425'
  );
});

test('audit does not claim implementation code exists', () => {
  const doc = readAudit();
  // The audit is a foundation; it should not assert that runtime code was changed/added here.
  assert.ok(
    !doc.includes('this PR implements') &&
      !doc.includes('this PR adds the migration execution') &&
      !doc.includes('this PR deploys')
  );
});

// --- Regression guards added for the blocking review (컴2 correction) ---

test('audit does not cite the non-existent nested CSS path', () => {
  const doc = readAudit();
  assert.ok(
    !doc.includes('css/editor/editor.css'),
    'Wrong nested path css/editor/editor.css must not appear as evidence'
  );
  assert.ok(doc.includes('css/editor.css'), 'Correct editor stylesheet path css/editor.css must be referenced');
});

test('audit cites the confirmed editor-overrides.css broad-rule evidence', () => {
  const doc = readAudit();
  assert.ok(
    doc.includes('css/editor/editor-overrides.css'),
    'Confirmed #3419 evidence path css/editor/editor-overrides.css must be present'
  );
  assert.ok(
    doc.toLowerCase().includes('editor-tree-meta-section'),
    'The shared .editor-tree-meta-section cross-surface case should be described'
  );
});

test('audit does not mix Scout #1882 into Social ownership', () => {
  const doc = readAudit().toLowerCase();
  assert.ok(
    !doc.includes('social migration plan (#3188/#3075/#1882)'),
    'Social migration plan must not list Scout #1882'
  );
  assert.ok(
    !doc.includes('owned by #3424/#3188/#3075/#1882'),
    'Ownership string must not mix Scout #1882 with Social issues'
  );
});

test('audit classifies baseline migration tests as source/static/regex with no actual PostgreSQL execution', () => {
  const doc = readAudit().toLowerCase();
  assert.ok(doc.includes('source/static'), 'Baseline classification should include source/static');
  assert.ok(doc.includes('regex'), 'Baseline classification should include regex SQL-text');
  assert.ok(
    doc.includes('no actual postgresql execution'),
    'Baseline classification should state no actual PostgreSQL execution'
  );
});

test('Candidate G reconciles with the closed #3120 global namespace audit', () => {
  const doc = readAudit();
  assert.ok(doc.includes('### G. Editor/public-viewer shared-state cleanup'));
  const lower = doc.toLowerCase();
  assert.ok(
    lower.includes('#3120') && lower.includes('global namespace'),
    'Candidate G must reference the #3120 global namespace bridges audit and its relationship'
  );
});
