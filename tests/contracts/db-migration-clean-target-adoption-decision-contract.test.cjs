'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');

const PATHS = {
  decisionDoc: path.join(REPO_ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md'),
  nextChildDoc: path.join(REPO_ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md'),
  operatorChecklistDoc: path.join(REPO_ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md'),
  classificationJson: path.join(REPO_ROOT, 'tests/test-layer-classification.json'),
  canonicalMigrationsJson: path.join(REPO_ROOT, 'db/migration-provenance/canonical-migrations.json'),
  expectedSchemaJson: path.join(REPO_ROOT, 'db/migration-provenance/expected-schema-manifest.json'),
  preconditionRegistryJson: path.join(REPO_ROOT, 'db/migration-provenance/precondition-registry.json'),
  readonlyCatalogJson: path.join(REPO_ROOT, 'db/migration-provenance/readonly-query-catalog.json')
};

/**
 * Pure validation helper for Clean-Target Adoption Decision and related architecture state.
 * Throws an Error if any required marker, boundary, or assertion rule is violated.
 */
function validateCleanTargetAdoptionState(inputs) {
  const {
    decisionDocText,
    nextChildDocText,
    operatorChecklistText,
    classificationData,
    canonicalMigrationsData,
    expectedSchemaData,
    preconditionRegistryData,
    readonlyCatalogData
  } = inputs;

  // Rule 1: Decision text must be exactly CLEAN_TARGET_FIRST_SELECTED and contain all required markers
  if (!decisionDocText.includes('Current status: `CLEAN_TARGET_FIRST_SELECTED`')) {
    throw new Error('NC1 Failure: Decision status is not CLEAN_TARGET_FIRST_SELECTED');
  }

  const requiredMarkers = [
    'CLEAN_TARGET_FIRST_SELECTED',
    'LEGACY_PRODUCTION_ADOPTION_DEFERRED',
    'HISTORICAL_MIGRATION_FABRICATION_PROHIBITED',
    'CANONICAL_STREAM_NOT_YET_CREATED',
    'MANIFEST_ACTIVATION_NOT_AUTHORIZED',
    'DATABASE_MUTATION_NOT_AUTHORIZED',
    'RECOVERY_GATE_REQUIRED_BEFORE_TARGET_MUTATION',
    'CANONICAL_BOOTSTRAP_DISPOSABLE_REHEARSAL_SELECTED'
  ];

  for (const marker of requiredMarkers) {
    if (!decisionDocText.includes(marker)) {
      throw new Error(`Missing required decision marker: ${marker}`);
    }
  }

  // Required key values
  if (!decisionDocText.includes('legacy Production adoption: DEFERRED_NOT_REJECTED')) {
    throw new Error('NC9 Failure: Legacy Production adoption key value is not DEFERRED_NOT_REJECTED');
  }
  if (!decisionDocText.includes('canonical stream state: NOT_YET_CREATED')) {
    throw new Error('Decision value canonical stream state must be NOT_YET_CREATED');
  }
  if (!decisionDocText.includes('manifest activation: NOT_AUTHORIZED')) {
    throw new Error('Decision value manifest activation must be NOT_AUTHORIZED');
  }
  if (!decisionDocText.includes('database mutation: NOT_AUTHORIZED')) {
    throw new Error('Decision value database mutation must be NOT_AUTHORIZED');
  }

  // Rule 2: Three target classes must be explicitly defined
  const requiredTargetClasses = [
    'LEGACY_PRODUCTION_TARGET',
    'CLEAN_CANONICAL_CANDIDATE',
    'DISPOSABLE_POSTGRES_REHEARSAL_TARGET'
  ];
  for (const targetClass of requiredTargetClasses) {
    if (!decisionDocText.includes(targetClass)) {
      throw new Error(`Missing target class definition: ${targetClass}`);
    }
  }

  // Rule 3: Child 2 implementation identity pre-determination is prohibited (NC10 check)
  if (/db\/migrations\/[^\s\n`]+\.sql/.test(decisionDocText)) {
    throw new Error('NC10 Failure: Exact or example migration file path detected in decision document');
  }
  if (decisionDocText.includes('creating schema_migration_ledger and baseline schema')) {
    throw new Error('NC10 Failure: Over-scoped DDL details detected in decision document');
  }

  // Rule 4: Non-fabrication prohibitions (NC2 check)
  if (decisionDocText.includes('past scripts were applied') || decisionDocText.includes('retroactively recorded as applied')) {
    if (!decisionDocText.includes('HISTORICAL_MIGRATION_FABRICATION_PROHIBITED')) {
      throw new Error('NC2 Failure: Historical migration fabrication protection missing');
    }
  }
  if (decisionDocText.includes('were applied') && !decisionDocText.includes('shall never be retroactively recorded as applied')) {
    throw new Error('NC2 Failure: Unverified past script application claim detected');
  }

  // Rule 5: Child 3 / Child 4 early authorization check (NC6 check)
  if (decisionDocText.includes('Child 3 authorized') || decisionDocText.includes('Child 4 authorized')) {
    throw new Error('NC6 Failure: Child 3 or Child 4 early authorization detected');
  }

  // Rule 6: DB/Provider/Secret/Deployment mutation check (NC7 check)
  if (decisionDocText.includes('database mutation authorized') || decisionDocText.includes('secret inspection authorized')) {
    throw new Error('NC7 Failure: Unauthorized DB, provider, or secret mutation detected');
  }

  // Rule 7: Recovery dependency (#3460 waits for #3458 completion) (NC8 check)
  if (!decisionDocText.includes('Issue #3460 implementation waits until #3458 completion')) {
    throw new Error('NC8 Failure: Recovery dependency (#3460 waits for #3458 completion) missing');
  }
  if (decisionDocText.includes('#3460 implemented before #3458')) {
    throw new Error('NC8 Failure: Premature #3460 implementation detected');
  }

  // Rule 8: 5-File Authorized Boundary recorded and parsed in decision document (NC11 check)
  const boundarySectionMatch = decisionDocText.match(/## Exact Child 1 Source Boundary([\s\S]*?)(?=\n## |$)/);
  if (!boundarySectionMatch) {
    throw new Error('NC11 Failure: Missing "## Exact Child 1 Source Boundary" section in decision document');
  }
  const boundarySectionText = boundarySectionMatch[1];

  if (!boundarySectionText.includes('No sixth file is authorized') && !boundarySectionText.includes('no sixth file is authorized')) {
    throw new Error('NC11 Failure: "No sixth file is authorized" sentinel missing');
  }

  const boundaryLines = boundarySectionText
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[AM]\s+\S+/.test(l));

  const parsedPaths = boundaryLines.map(l => l.replace(/^[AM]\s+/, '').trim());

  if (parsedPaths.length !== 5) {
    throw new Error(`NC11 Failure: Exact boundary section must contain exactly 5 paths (found ${parsedPaths.length})`);
  }

  const requiredBoundaryFiles = [
    'docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md',
    'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs',
    'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
    'docs/architecture/DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md',
    'tests/test-layer-classification.json'
  ];

  for (const reqPath of requiredBoundaryFiles) {
    const count = parsedPaths.filter(p => p === reqPath).length;
    if (count === 0) {
      throw new Error(`NC11 Failure: Missing required path in boundary section: ${reqPath}`);
    }
    if (count > 1) {
      throw new Error(`NC11 Failure: Duplicate path detected in boundary section: ${reqPath}`);
    }
  }

  for (const pPath of parsedPaths) {
    if (!requiredBoundaryFiles.includes(pPath)) {
      throw new Error(`NC11 Failure: Unauthorized sixth path detected in boundary section: ${pPath}`);
    }
  }

  const registeredEntries = classificationData.entries.filter(e => requiredBoundaryFiles.includes(e.path));
  if (registeredEntries.length !== 1 || registeredEntries[0].path !== 'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs') {
    throw new Error('NC11 Failure: Contract test must be registered in test-layer-classification.json as the only classified file of the 5 boundary paths');
  }

  // Rule 9: Check four provenance JSON authorities (NC3 & NC4 checks)
  if (canonicalMigrationsData.status !== 'ADOPTION_REQUIRED') {
    throw new Error('NC3 Failure: canonical-migrations.json status is not ADOPTION_REQUIRED');
  }
  if (!Array.isArray(canonicalMigrationsData.migrations) || canonicalMigrationsData.migrations.length !== 0) {
    throw new Error('NC4 Failure: canonical-migrations.json migrations collection is not empty');
  }

  if (expectedSchemaData.status !== 'ADOPTION_REQUIRED') {
    throw new Error('NC3 Failure: expected-schema-manifest.json status is not ADOPTION_REQUIRED');
  }
  if (!Array.isArray(expectedSchemaData.critical_objects) || expectedSchemaData.critical_objects.length !== 0) {
    throw new Error('NC4 Failure: expected-schema-manifest.json critical_objects collection is not empty');
  }

  if (preconditionRegistryData.status !== 'ADOPTION_REQUIRED') {
    throw new Error('NC3 Failure: precondition-registry.json status is not ADOPTION_REQUIRED');
  }
  if (!Array.isArray(preconditionRegistryData.entries) || preconditionRegistryData.entries.length !== 0) {
    throw new Error('NC4 Failure: precondition-registry.json entries collection is not empty');
  }

  if (readonlyCatalogData.status !== 'ADOPTION_REQUIRED') {
    throw new Error('NC3 Failure: readonly-query-catalog.json status is not ADOPTION_REQUIRED');
  }
  if (typeof readonlyCatalogData.queries !== 'object' || Object.keys(readonlyCatalogData.queries).length !== 0) {
    throw new Error('NC4 Failure: readonly-query-catalog.json queries collection is not empty');
  }

  // Rule 10: Operator checklist privacy, read-only transaction, credential, role mapping, and approval boundary checks (NC5 check)
  if (!operatorChecklistText.includes('LEGACY_PRODUCTION_TARGET')) {
    throw new Error('NC5 Failure: Checklist target class LEGACY_PRODUCTION_TARGET missing');
  }
  if (!operatorChecklistText.includes('DEFERRED_NOT_AUTHORIZED')) {
    throw new Error('NC5 Failure: Checklist status DEFERRED_NOT_AUTHORIZED missing');
  }
  if (!operatorChecklistText.includes('dedicated read-only credential boundary')) {
    throw new Error('NC5 Failure: Operator checklist dedicated read-only credential boundary missing');
  }
  if (!operatorChecklistText.includes('strict privacy allowlist and redaction boundary')) {
    throw new Error('NC5 Failure: Operator checklist strict privacy allowlist and redaction boundary missing');
  }
  if (!operatorChecklistText.includes('explicit read-only transaction boundary')) {
    throw new Error('NC5 Failure: Operator checklist explicit read-only transaction boundary missing');
  }
  if (!operatorChecklistText.includes('abstract role mapping verification')) {
    throw new Error('NC5 Failure: Operator checklist abstract role mapping verification missing');
  }
  if (!operatorChecklistText.includes('explicit owner approval event')) {
    throw new Error('NC5 Failure: Operator checklist explicit owner approval event missing');
  }

  // Rule 11: Forbidden issue closure phrases and #3425 posture checks
  const allDocs = decisionDocText + '\n' + nextChildDocText + '\n' + operatorChecklistText;
  const forbiddenPhrases = [
    'Closes #3458', 'Fixes #3458', 'Resolves #3458',
    'Closes #3435', 'Fixes #3435', 'Resolves #3435',
    'Closes #3460', 'Fixes #3460', 'Resolves #3460',
    'Closes #1882', 'Fixes #1882', 'Resolves #1882'
  ];
  for (const phrase of forbiddenPhrases) {
    if (allDocs.includes(phrase)) {
      throw new Error(`Forbidden issue closure phrase detected: "${phrase}"`);
    }
  }

  if (decisionDocText.includes('Keep #3425 OPEN')) {
    throw new Error('Forbidden phrase detected in decision document: "Keep #3425 OPEN" (#3425 is a completed parent)');
  }

  // Rule 12: Contract test registered under SOURCE_STATIC exactly once
  const targetPath = 'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs';
  const matches = classificationData.entries.filter(e => e.path === targetPath);
  if (matches.length !== 1) {
    throw new Error(`Contract test must be registered exactly once in test-layer-classification.json (found ${matches.length})`);
  }
  if (matches[0].layer !== 'SOURCE_STATIC') {
    throw new Error(`Contract test layer must be SOURCE_STATIC (found ${matches[0].layer})`);
  }

  return true;
}

// -----------------------------------------------------------------------------
// 14 Required Assertions Suite
// -----------------------------------------------------------------------------

test('Assertion 1: Exact 5-file authorized boundary is recorded and classified (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  const classification = JSON.parse(fs.readFileSync(PATHS.classificationJson, 'utf8'));

  const requiredBoundaryFiles = [
    'docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md',
    'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs',
    'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
    'docs/architecture/DB_MIGRATION_PROVENANCE_ADOPTION_OPERATOR_CHECKLIST.md',
    'tests/test-layer-classification.json'
  ];

  for (const path of requiredBoundaryFiles) {
    assert.ok(docText.includes(path), `Decision document must list exact path ${path}`);
  }

  const inputs = getValidInputs();
  assert.equal(validateCleanTargetAdoptionState(inputs), true, 'Validator must pass exact boundary');

  const testPath = 'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs';
  const matches = classification.entries.filter(e => e.path === testPath);
  assert.equal(matches.length, 1, 'Contract test must be registered exactly once');
  assert.equal(matches[0].layer, 'SOURCE_STATIC');
});

test('Assertion 2: Decision status is exactly CLEAN_TARGET_FIRST_SELECTED (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('Current status: `CLEAN_TARGET_FIRST_SELECTED`'));
  assert.ok(docText.includes('CLEAN_TARGET_FIRST_SELECTED'));
});

test('Assertion 3: Legacy Production adoption is DEFERRED_NOT_REJECTED (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('LEGACY_PRODUCTION_ADOPTION_DEFERRED'));
  assert.ok(docText.includes('legacy Production adoption: DEFERRED_NOT_REJECTED'));
});

test('Assertion 4: Historical migration fabrication is strictly prohibited (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('HISTORICAL_MIGRATION_FABRICATION_PROHIBITED'));
  assert.ok(docText.includes('shall never be retroactively recorded as applied'));
});

test('Assertion 5: Child 2 selected but not implemented; exact migration identity pre-determination prohibited (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('CANONICAL_BOOTSTRAP_DISPOSABLE_REHEARSAL_SELECTED'));
  assert.ok(docText.includes('Child 2 will define:'));
  assert.equal(/db\/migrations\/[^\s\n`]+\.sql/.test(docText), false);
});

test('Assertion 6: Child 3 / Child 4 are unauthorized (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  const nextChildText = fs.readFileSync(PATHS.nextChildDoc, 'utf8');
  assert.ok(nextChildText.includes('Step 8 Child 3 target attribution & read-only catalog parity preflight not authorized'));
  assert.ok(nextChildText.includes('Step 8 Child 4 fail-closed deploy gate & canonical target activation boundary not authorized'));
});

test('Assertion 7: Manifest activation is unauthorized (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('MANIFEST_ACTIVATION_NOT_AUTHORIZED'));
  assert.ok(docText.includes('manifest activation: NOT_AUTHORIZED'));
});

test('Assertion 8: Environment binding is unauthorized (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('Has no provider, project, branch, database, host, account, or environment binding yet'));
});

test('Assertion 9: Deploy integration is unauthorized (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('deployment pipeline mutation authority'));
});

test('Assertion 10: Provider / secret / database mutation is unauthorized (#3840)', () => {
  const docText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  assert.ok(docText.includes('DATABASE_MUTATION_NOT_AUTHORIZED'));
  assert.ok(docText.includes('database mutation: NOT_AUTHORIZED'));
});

test('Assertion 11: Four provenance JSON authorities remain ADOPTION_REQUIRED with empty collections (#3840)', () => {
  const canonical = JSON.parse(fs.readFileSync(PATHS.canonicalMigrationsJson, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(PATHS.expectedSchemaJson, 'utf8'));
  const precondition = JSON.parse(fs.readFileSync(PATHS.preconditionRegistryJson, 'utf8'));
  const readonlyCatalog = JSON.parse(fs.readFileSync(PATHS.readonlyCatalogJson, 'utf8'));

  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(canonical.migrations, []);

  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(expected.critical_objects, []);

  assert.equal(precondition.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(precondition.entries, []);

  assert.equal(readonlyCatalog.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(readonlyCatalog.queries, {});
});

test('Assertion 12: Legacy checklist maintains target class, execution status, and 5 protection boundaries (#3840)', () => {
  const checklistText = fs.readFileSync(PATHS.operatorChecklistDoc, 'utf8');
  assert.ok(checklistText.includes('checklist target class:\nLEGACY_PRODUCTION_TARGET'));
  assert.ok(checklistText.includes('current execution status:\nDEFERRED_NOT_AUTHORIZED'));
  assert.ok(checklistText.includes('dedicated read-only credential boundary'));
  assert.ok(checklistText.includes('strict privacy allowlist and redaction boundary'));
  assert.ok(checklistText.includes('explicit read-only transaction boundary'));
  assert.ok(checklistText.includes('abstract role mapping verification'));
  assert.ok(checklistText.includes('explicit owner approval event'));
});

test('Assertion 13: Empty manifest is not treated as evidence of empty live schema (#3840)', () => {
  const checklistText = fs.readFileSync(PATHS.operatorChecklistDoc, 'utf8');
  assert.ok(checklistText.includes('Do not interpret an empty manifest as an empty production schema'));
});

test('Assertion 14: Sequencing & Issue posture (#3458 OPEN, #3435 deferred, #3460 waits, #3425 completed parent) (#3840)', () => {
  const decisionText = fs.readFileSync(PATHS.decisionDoc, 'utf8');
  const nextChildText = fs.readFileSync(PATHS.nextChildDoc, 'utf8');
  const checklistText = fs.readFileSync(PATHS.operatorChecklistDoc, 'utf8');

  assert.ok(decisionText.includes('Issue #3460 implementation waits until #3458 completion'));
  assert.ok(decisionText.includes('Keep #3458 OPEN'));
  assert.ok(decisionText.includes('Keep #3435 OPEN'));
  assert.ok(decisionText.includes('Keep #3460 OPEN'));
  assert.ok(decisionText.includes('Keep #3461 OPEN'));
  assert.ok(decisionText.includes('Keep #1882 OPEN'));

  assert.equal(decisionText.includes('Keep #3425 OPEN'), false);
  assert.ok(decisionText.includes('Refs #3425 — completed architecture-quality parent.'));
});

// -----------------------------------------------------------------------------
// Negative Controls Suite (NC1 – NC11)
// -----------------------------------------------------------------------------

function getValidInputs() {
  return {
    decisionDocText: fs.readFileSync(PATHS.decisionDoc, 'utf8'),
    nextChildDocText: fs.readFileSync(PATHS.nextChildDoc, 'utf8'),
    operatorChecklistText: fs.readFileSync(PATHS.operatorChecklistDoc, 'utf8'),
    classificationData: JSON.parse(fs.readFileSync(PATHS.classificationJson, 'utf8')),
    canonicalMigrationsData: JSON.parse(fs.readFileSync(PATHS.canonicalMigrationsJson, 'utf8')),
    expectedSchemaData: JSON.parse(fs.readFileSync(PATHS.expectedSchemaJson, 'utf8')),
    preconditionRegistryData: JSON.parse(fs.readFileSync(PATHS.preconditionRegistryJson, 'utf8')),
    readonlyCatalogData: JSON.parse(fs.readFileSync(PATHS.readonlyCatalogJson, 'utf8'))
  };
}

test('NC1: Changing CLEAN_TARGET_FIRST_SELECTED to legacy Production baseline is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace('Current status: `CLEAN_TARGET_FIRST_SELECTED`', 'Current status: `LEGACY_PRODUCTION_BASELINE_SELECTED`');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC1 Failure/);
});

test('NC2: Declaring past scripts were applied without execution evidence is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace('shall never be retroactively recorded as applied', 'were applied in historical baseline');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC2 Failure/);
});

test('NC3: Manifest status set to ACTIVE is detected', () => {
  const inputs = getValidInputs();
  inputs.canonicalMigrationsData.status = 'ACTIVE';
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC3 Failure/);
});

test('NC4: Inserting fake migration entry into manifest is detected', () => {
  const inputs = getValidInputs();
  inputs.canonicalMigrationsData.migrations = [{ id: '001', checksum: 'fake' }];
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC4 Failure/);
});

test('NC5-A: Removing privacy allowlist/redaction boundary from operator checklist is detected', () => {
  const inputs = getValidInputs();
  inputs.operatorChecklistText = inputs.operatorChecklistText.replace('strict privacy allowlist and redaction boundary', 'unrestricted privacy collection');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC5 Failure/);
});

test('NC5-B: Removing read-only transaction boundary from operator checklist is detected', () => {
  const inputs = getValidInputs();
  inputs.operatorChecklistText = inputs.operatorChecklistText.replace('explicit read-only transaction boundary', 'read-write transaction boundary');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC5 Failure/);
});

test('NC5-C: Removing dedicated read-only credential boundary from operator checklist is detected', () => {
  const inputs = getValidInputs();
  inputs.operatorChecklistText = inputs.operatorChecklistText.replace('dedicated read-only credential boundary', 'shared admin credential');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC5 Failure/);
});

test('NC5-D: Removing explicit owner approval event requirement from operator checklist is detected', () => {
  const inputs = getValidInputs();
  inputs.operatorChecklistText = inputs.operatorChecklistText.replace('explicit owner approval event', 'automatic implicit approval');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC5 Failure/);
});

test('NC6: Early approval of Child 3 or Child 4 is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText += '\nChild 3 authorized by this decision.';
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC6 Failure/);
});

test('NC7: Approving DB/provider/secret/deployment actions is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText += '\ndatabase mutation authorized for bootstrap';
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC7 Failure/);
});

test('NC8: Allowing #3460 implementation before #3458 completion is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace(
    'Issue #3460 implementation waits until #3458 completion',
    '#3460 implemented before #3458'
  );
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC8 Failure/);
});

test('NC9: Changing legacy adoption key value from DEFERRED_NOT_REJECTED is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace('legacy Production adoption: DEFERRED_NOT_REJECTED', 'legacy Production adoption: OBSOLETE_REJECTED');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC9 Failure/);
});

test('NC10: Pre-determining exact migration filename or over-scoped DDL details is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText += '\nChild 2 will add file db/migrations/20260802000000_bootstrap_ledger.sql';
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC10 Failure/);
});

test('NC11-A: Removing a path from 5-file boundary section in decision document is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace('M tests/test-layer-classification.json', '');
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC11 Failure/);
});

test('NC11-B: Adding an unauthorized 6th path to boundary section in decision document is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace(
    'M tests/test-layer-classification.json',
    'M tests/test-layer-classification.json\nA package.json'
  );
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC11 Failure/);
});

test('NC11-C: Duplicate path in boundary section of decision document is detected', () => {
  const inputs = getValidInputs();
  inputs.decisionDocText = inputs.decisionDocText.replace(
    'M tests/test-layer-classification.json',
    'M tests/test-layer-classification.json\nM tests/test-layer-classification.json'
  );
  assert.throws(() => validateCleanTargetAdoptionState(inputs), /NC11 Failure/);
});

test('Full Baseline Validation: Pristine repository inputs pass validateCleanTargetAdoptionState', () => {
  const inputs = getValidInputs();
  assert.equal(validateCleanTargetAdoptionState(inputs), true);
});
