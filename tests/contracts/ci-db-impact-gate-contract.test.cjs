'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CI_PATH = path.join(ROOT, '.github/workflows/ci.yml');
const {
  isExplicitlyNonDbPath,
  shouldRunDbEngine,
} = require('../../scripts/ci-db-impact-classifier.cjs');

const DB_JOBS = [
  'db-engine-tree-comments',
  'db-engine-trees-schema',
  'db-engine-generic-social-a-guard',
  'db-engine-generic-social-a',
  'db-engine-generic-social-b-guard',
  'db-engine-generic-social-b',
  'db-engine-migration-catalog-adapter',
  'db-engine-precondition-composition-root',
  'db-engine-clean-canonical-bootstrap',
  'db-engine-readonly-target-attribution-parity',
  'db-engine-structural-sentinel',
  'db-engine-fork-public-tree-visibility-concurrency',
  'db-engine-tree-social-visibility-concurrency',
  'db-engine-memory-parent-cycle-concurrency',
];

test('classifier skips only explicit non-DB allowlist paths', () => {
  for (const safePath of [
    'README.md',
    'docs/architecture/example.json',
    'docs/ops/example.txt',
    'assets/css/home.css',
    'assets/favicon/favicon.svg',
  ]) {
    assert.equal(isExplicitlyNonDbPath(safePath), true, safePath);
  }

  for (const unsafePath of [
    '.github/workflows/ci.yml',
    'package.json',
    'package-lock.json',
    'functions/api/trees.js',
    'scripts/migration.sql',
    'tests/contracts/example.test.cjs',
    'tests/db-engine/example.test.cjs',
    'assets/js/app.js',
    'unknown/new-surface.txt',
  ]) {
    assert.equal(isExplicitlyNonDbPath(unsafePath), false, unsafePath);
  }
});

test('classifier is fail-open for empty, mixed, and unknown changes', () => {
  assert.equal(shouldRunDbEngine([]), true);
  assert.equal(shouldRunDbEngine(['docs/a.md', 'assets/css/a.css']), false);
  assert.equal(shouldRunDbEngine(['docs/a.md', 'functions/api/a.js']), true);
  assert.equal(shouldRunDbEngine(['assets/js/app.js']), true);
  assert.equal(shouldRunDbEngine(['unknown/file.txt']), true);
});

test('CI keeps all DB jobs behind one fail-open, cancellation-aware impact gate', () => {
  const ci = fs.readFileSync(CI_PATH, 'utf8');

  assert.match(ci, /^\s{2}db-impact:\s*$/m);
  assert.match(ci, /run-db:\s*\$\{\{\s*steps\.classify\.outputs\.run-db\s*\}\}/);
  assert.match(ci, /fetch-depth:\s*0/);
  assert.match(ci, /node scripts\/ci-db-impact-classifier\.cjs/);

  for (const job of DB_JOBS) {
    const escaped = job.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = new RegExp(
      `^  ${escaped}:\\n` +
      `    needs: db-impact\\n` +
      `    if: >-\\n` +
      `      \\${\\{ always\\(\\) && !cancelled\\(\\) && \\(needs\\.db-impact\\.result != 'success' \\|\\| needs\\.db-impact\\.outputs\\.run-db == 'true'\\) \\}\\}`,
      'm'
    );
    assert.match(ci, block, job);
  }
});
