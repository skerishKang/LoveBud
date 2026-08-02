'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const DECISION_DOC_PATH = path.join(REPO_ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_CLEAN_TARGET_ADOPTION_DECISION.md');
const CLASSIFICATION_PATH = path.join(REPO_ROOT, 'tests/test-layer-classification.json');

const MANIFEST_PATHS = {
  canonicalMigrations: path.join(REPO_ROOT, 'db/migration-provenance/canonical-migrations.json'),
  expectedSchema: path.join(REPO_ROOT, 'db/migration-provenance/expected-schema-manifest.json'),
  preconditionRegistry: path.join(REPO_ROOT, 'db/migration-provenance/precondition-registry.json'),
  readonlyCatalog: path.join(REPO_ROOT, 'db/migration-provenance/readonly-query-catalog.json')
};

test('Clean-target adoption decision contract validates document structure and markers (#3840)', () => {
  assert.ok(fs.existsSync(DECISION_DOC_PATH), 'Decision doc must exist');
  const docContent = fs.readFileSync(DECISION_DOC_PATH, 'utf8');

  // Verify status markers
  const requiredMarkers = [
    'CLEAN_TARGET_FIRST_SELECTED',
    'LEGACY_PRODUCTION_ADOPTION_DEFERRED',
    'HISTORICAL_MIGRATION_FABRICATION_PROHIBITED',
    'CANONICAL_STREAM_NOT_YET_CREATED',
    'MANIFEST_ACTIVATION_NOT_AUTHORIZED',
    'DATABASE_MUTATION_NOT_AUTHORIZED',
    'CANONICAL_BOOTSTRAP_DISPOSABLE_REHEARSAL_SELECTED'
  ];

  for (const marker of requiredMarkers) {
    assert.ok(docContent.includes(marker), `Doc must include required marker: ${marker}`);
  }

  // Verify protected issue references
  const requiredIssues = ['#3840', '#3458', '#3425', '#3435', '#3460', '#3461', '#1882'];
  for (const issueRef of requiredIssues) {
    assert.ok(docContent.includes(issueRef), `Doc must reference protected issue: ${issueRef}`);
  }
});

test('Clean-target adoption decision contract confirms authority manifests remain ADOPTION_REQUIRED and empty (#3840)', () => {
  // 1. canonical-migrations.json
  const canonicalContent = JSON.parse(fs.readFileSync(MANIFEST_PATHS.canonicalMigrations, 'utf8'));
  assert.equal(canonicalContent.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(canonicalContent.migrations, []);

  // 2. expected-schema-manifest.json
  const expectedSchemaContent = JSON.parse(fs.readFileSync(MANIFEST_PATHS.expectedSchema, 'utf8'));
  assert.equal(expectedSchemaContent.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(expectedSchemaContent.critical_objects, []);

  // 3. precondition-registry.json
  const preconditionContent = JSON.parse(fs.readFileSync(MANIFEST_PATHS.preconditionRegistry, 'utf8'));
  assert.equal(preconditionContent.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(preconditionContent.entries, []);

  // 4. readonly-query-catalog.json
  const readonlyContent = JSON.parse(fs.readFileSync(MANIFEST_PATHS.readonlyCatalog, 'utf8'));
  assert.equal(readonlyContent.status, 'ADOPTION_REQUIRED');
  assert.deepEqual(readonlyContent.queries, {});
});

test('Clean-target adoption decision contract is registered in test-layer-classification.json under SOURCE_STATIC (#3840)', () => {
  assert.ok(fs.existsSync(CLASSIFICATION_PATH), 'Classification JSON must exist');
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));

  const testRelativePath = 'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs';
  const matchingEntries = classification.entries.filter((entry) => entry.path === testRelativePath);

  assert.equal(matchingEntries.length, 1, `Test contract must be registered exactly once in test-layer-classification.json`);
  assert.equal(matchingEntries[0].layer, 'SOURCE_STATIC');
});
