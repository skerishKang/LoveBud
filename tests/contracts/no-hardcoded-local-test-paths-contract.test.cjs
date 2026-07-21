const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const TEST_ROOT = path.join(ROOT, 'tests');

const TEXT_FILE_PATTERN = /\.(?:cjs|mjs|js|ts|tsx|jsx|py|md|txt|json)$/i;
const slash = '/';
const localRootPrefix = `${slash}${'root'}${slash}`;
const localHomePrefix = `${slash}${'home'}${slash}`;
const legacyWorktreeToken = `${'LoveBud'}${'-worktrees'}`;

const FORBIDDEN_LOCAL_PATH_PATTERNS = [
  {
    label: 'developer-specific root absolute path',
    pattern: new RegExp(`(^|[^\\w])${localRootPrefix.replaceAll(slash, '\\/')}`),
  },
  {
    label: 'developer-specific home absolute path',
    pattern: new RegExp(`(^|[^\\w])${localHomePrefix.replaceAll(slash, '\\/')}[A-Za-z0-9._-]+${slash.replace('/', '\\/')}`),
  },
  {
    label: 'LoveBud worktree absolute path',
    pattern: new RegExp(legacyWorktreeToken),
  },
  {
    label: 'Windows drive absolute path',
    pattern: /(^|[^A-Za-z0-9_])(?:[A-Za-z]:\\\\|[A-Za-z]:\/)/,
  },
];

/**
 * Known ephemeral fixtures that parallel tests may create and delete mid-scan.
 * Only these may be skipped on ENOENT. All other missing files rethrow.
 */
function isKnownEphemeralFixture(file) {
  const relative = path.relative(TEST_ROOT, file).split(path.sep).join('/');
  // e.g. contracts/fixtures/migration-provenance/_tmp-catalog-binding.json
  return /(^|\/)_tmp-[^/]+\.json$/i.test(relative);
}

function listTextFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTextFiles(fullPath));
      continue;
    }
    if (entry.isFile() && TEXT_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function readFileForPathAudit(file) {
  // Pre-skip known ephemeral names even when still present is optional;
  // for present files we still inspect. For missing files only known
  // ephemerals are skippable.
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      if (isKnownEphemeralFixture(file)) {
        return null; // skip
      }
      throw err;
    }
    throw err;
  }
}

function auditFiles(files) {
  const violations = [];
  for (const file of files) {
    // Known ephemeral present files are still audited if readable.
    const source = readFileForPathAudit(file);
    if (source == null) continue;
    const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
    for (const { label, pattern } of FORBIDDEN_LOCAL_PATH_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relativePath}: ${label}`);
      }
    }
  }
  return violations;
}

test('test files do not depend on developer-specific local or worktree paths', () => {
  const files = listTextFiles(TEST_ROOT);
  assert.ok(files.length > 0, 'test audit must inspect at least one test file');

  const violations = auditFiles(files);

  assert.deepEqual(
    violations,
    [],
    `Tests must derive repository paths from __dirname/process cwd instead of hard-coded local paths:\n${violations.join('\n')}`,
  );
});

test('#3582 path-audit: known _tmp-*.json ENOENT after enumeration is skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-path-audit-'));
  const ephemeral = path.join(dir, '_tmp-catalog-binding.json');
  fs.writeFileSync(ephemeral, '{"ok":true}\n', 'utf8');
  // Simulate enumeration then delete (parallel race).
  const listed = [ephemeral];
  fs.unlinkSync(ephemeral);
  // Predicate must allow skip
  assert.equal(isKnownEphemeralFixture(path.join(TEST_ROOT, 'contracts/fixtures/migration-provenance/_tmp-catalog-binding.json')), true);
  // readFileForPathAudit against a path under TEST_ROOT pattern
  const underTests = path.join(TEST_ROOT, 'contracts/fixtures/migration-provenance/_tmp-catalog-binding.json');
  // Ensure parent exists for relative path computation; file itself missing is OK
  fs.mkdirSync(path.dirname(underTests), { recursive: true });
  if (fs.existsSync(underTests)) fs.unlinkSync(underTests);
  const source = readFileForPathAudit(underTests);
  assert.equal(source, null, 'known ephemeral missing file must be skipped');
  // listed ephemeral outside TEST_ROOT is not "known" by relative-to-TEST_ROOT predicate —
  // only TEST_ROOT-relative ephemerals are skippable. That is intentional.
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#3582 path-audit: ordinary .json ENOENT after enumeration still throws', () => {
  const ordinary = path.join(TEST_ROOT, 'contracts/fixtures/__ordinary-missing-path-audit__.json');
  fs.mkdirSync(path.dirname(ordinary), { recursive: true });
  // Ensure absent
  try {
    fs.unlinkSync(ordinary);
  } catch (_) {}
  assert.equal(isKnownEphemeralFixture(ordinary), false);
  assert.throws(
    () => readFileForPathAudit(ordinary),
    (err) => err && err.code === 'ENOENT'
  );
});

test('#3582 path-audit: ordinary file with hardcoded local path is still detected', () => {
  const probe = path.join(TEST_ROOT, 'contracts/fixtures/__path-audit-probe__.json');
  fs.mkdirSync(path.dirname(probe), { recursive: true });
  // Build forbidden path at runtime so this source file never embeds a literal root absolute path.
  const forbiddenSample = ['', 'root', 'secret', 'path', 'to', 'thing'].join('/');
  fs.writeFileSync(probe, JSON.stringify({ bad: forbiddenSample }), 'utf8');
  try {
    const violations = auditFiles([probe]);
    assert.ok(
      violations.some((v) => v.includes('developer-specific root absolute path')),
      `expected root absolute path detection, got: ${JSON.stringify(violations)}`
    );
  } finally {
    try {
      fs.unlinkSync(probe);
    } catch (_) {}
  }
});

// Export helpers for potential reuse (not required by runtime).
module.exports = {
  isKnownEphemeralFixture,
  readFileForPathAudit,
  auditFiles,
};
