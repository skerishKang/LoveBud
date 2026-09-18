/**
 * Contract: canonical Node test file format under tests/.
 *
 * Refs #4450
 *
 * `package.json` runs the default Node test layer as
 *
 *   node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs
 *
 * while the repository is declared `"type": "module"`. A `tests/**\/*.test.js`
 * file is therefore parsed as an ES module AND sits outside every default-CI
 * glob: it is executed by neither the default CI nor `verify-static`.
 *
 * 17 such files had accumulated as frozen pre-CJS-migration snapshots. Six had
 * silently diverged from their `.cjs` twin - up to 63 changed lines, roughly 20%
 * of the file - and asserted behavior that the `.cjs` authority had since
 * corrected, so they read as enforced contracts while enforcing nothing. They
 * were removed under #4450.
 *
 * Extension convention:
 *   - `.test.cjs` -> default-CI layer (tests/smoke, tests/routes, tests/contracts)
 *   - `.test.mjs` -> dedicated workflow lane (concurrency / idempotency), and is
 *     intentionally not selected by the default-CI globs
 *   - `.test.js`  -> not a supported test extension anywhere under tests/
 *
 * This guard previously covered only `tests/contracts/`, which is exactly why
 * orphans survived in `tests/`, `tests/routes/`, and `tests/smoke/`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Directories that hold data/markup fixtures rather than executable test files.
const NON_EXECUTABLE_DIRS = new Set(['node_modules', '__pycache__', 'fixtures']);

const DEFAULT_CI_GLOBS = [
  'tests/smoke/*.test.cjs',
  'tests/routes/*.test.cjs',
  'tests/contracts/*.test.cjs',
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (NON_EXECUTABLE_DIRS.has(entry.name)) continue;
      out.push(...walk(abs));
    } else {
      out.push(abs);
    }
  }
  return out;
}

test('canonical test format: no .test.js files anywhere under tests/', () => {
  const orphans = walk(TESTS_DIR)
    .map((abs) => path.relative(ROOT, abs).split(path.sep).join('/'))
    .filter((rel) => rel.endsWith('.test.js'))
    .sort();

  assert.deepEqual(
    orphans,
    [],
    'Expected 0 .test.js files under tests/, found '
      + `${orphans.length}: ${orphans.join(', ')}. `
      + 'Canonical test extensions are .test.cjs (default CI) and .test.mjs (dedicated lane). '
      + 'A .test.js file is never executed by the default-CI globs, so it enforces nothing. '
      + 'Reintroduction of .test.js files requires a deliberate repository-wide ESM migration.'
  );
});

test('canonical test format: default-CI globs remain the .test.cjs convention', () => {
  const testScript = PKG.scripts && PKG.scripts.test;
  assert.ok(
    typeof testScript === 'string' && testScript.length > 0,
    'package.json must define scripts.test'
  );

  for (const glob of DEFAULT_CI_GLOBS) {
    assert.ok(
      testScript.includes(glob),
      `scripts.test must select ${glob} so that layer is not silently skipped`
    );
  }
});
