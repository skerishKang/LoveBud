'use strict';

const fs = require('node:fs');

const SAFE_NON_DB_PREFIXES = Object.freeze([
  'docs/',
  'assets/css/',
  'assets/favicon/',
]);

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '');
}

function isExplicitlyNonDbPath(value) {
  const filePath = normalizePath(value);
  if (!filePath) return false;
  if (filePath.endsWith('.md')) return true;
  return SAFE_NON_DB_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function shouldRunDbEngine(changedPaths) {
  const paths = Array.from(changedPaths || [], normalizePath).filter(Boolean);
  if (paths.length === 0) return true;
  return !paths.every(isExplicitlyNonDbPath);
}

function assertPolicyInvariants() {
  const safeOnly = [
    'README.md',
    'docs/architecture/example.json',
    'assets/css/home.css',
    'assets/favicon/favicon.svg',
  ];
  const dbRelevant = [
    '.github/workflows/ci.yml',
    'package.json',
    'package-lock.json',
    'functions/api/trees.js',
    'scripts/migration.sql',
    'tests/contracts/example.test.cjs',
    'tests/db-engine/example.test.cjs',
    'assets/js/app.js',
    'unknown/new-surface.txt',
  ];

  if (shouldRunDbEngine(safeOnly) !== false) {
    throw new Error('DB impact classifier invariant failed: safe-only paths must skip DB jobs');
  }
  if (shouldRunDbEngine([]) !== true) {
    throw new Error('DB impact classifier invariant failed: empty input must fail open');
  }
  if (shouldRunDbEngine(['docs/a.md', 'functions/api/a.js']) !== true) {
    throw new Error('DB impact classifier invariant failed: mixed input must run DB jobs');
  }
  for (const filePath of dbRelevant) {
    if (isExplicitlyNonDbPath(filePath)) {
      throw new Error(`DB impact classifier invariant failed: ${filePath} must run DB jobs`);
    }
  }
}

function main() {
  assertPolicyInvariants();
  const input = fs.readFileSync(0, 'utf8');
  const changedPaths = input.split(/\r?\n/);
  process.stdout.write(shouldRunDbEngine(changedPaths) ? 'true' : 'false');
}

module.exports = {
  SAFE_NON_DB_PREFIXES,
  assertPolicyInvariants,
  isExplicitlyNonDbPath,
  normalizePath,
  shouldRunDbEngine,
};

if (require.main === module) {
  main();
}
