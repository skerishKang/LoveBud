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

function main() {
  const input = fs.readFileSync(0, 'utf8');
  const changedPaths = input.split(/\r?\n/);
  process.stdout.write(shouldRunDbEngine(changedPaths) ? 'true' : 'false');
}

module.exports = {
  SAFE_NON_DB_PREFIXES,
  isExplicitlyNonDbPath,
  normalizePath,
  shouldRunDbEngine,
};

if (require.main === module) {
  main();
}
