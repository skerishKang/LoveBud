const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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

test('test files do not depend on developer-specific local or worktree paths', () => {
  const files = listTextFiles(TEST_ROOT);
  assert.ok(files.length > 0, 'test audit must inspect at least one test file');

  const violations = [];

  for (const file of files) {
    const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
    const source = fs.readFileSync(file, 'utf8');

    for (const { label, pattern } of FORBIDDEN_LOCAL_PATH_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relativePath}: ${label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Tests must derive repository paths from __dirname/process cwd instead of hard-coded local paths:\n${violations.join('\n')}`,
  );
});
