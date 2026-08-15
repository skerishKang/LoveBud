/**
 * Contract tests for CI verify-static failure evidence preservation (Issue #4014).
 *
 * Verifies that when `npm test` fails in `verify-static`:
 * 1. The exit code is strictly preserved as non-zero (zero failure swallowing).
 * 2. Failing test file(s), test/subtest name(s), assertion errors, and locations are captured.
 * 3. A sanitized, bounded GitHub Step Summary is written to $GITHUB_STEP_SUMMARY.
 * 4. A high-visibility failure summary is output to stderr.
 * 5. Passing tests exit with 0 without degradation.
 * 6. Sensitive tokens / database URLs are redacted.
 * 7. Workflow step ordering (Lint -> Build -> Smoke -> Verify) is preserved.
 *
 * Refs: #4014, #3994, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNNER_PATH = path.join(ROOT, 'scripts', 'ci-smoke-runner.cjs');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');

const {
  parseTestOutput,
  formatMarkdownSummary,
  formatConsoleSummary,
  sanitizeEvidence,
  runSmokeProcess,
} = require(RUNNER_PATH);

function createMockStream() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  stream.getContent = () => Buffer.concat(chunks).toString('utf8');
  return stream;
}

// ─── 1. Helper Existence & Export Contract ──────────────────────────────────

test('scripts/ci-smoke-runner.cjs exists and exports required helper functions', () => {
  assert.ok(fs.existsSync(RUNNER_PATH), 'ci-smoke-runner.cjs must exist');
  assert.equal(typeof parseTestOutput, 'function', 'parseTestOutput must be exported');
  assert.equal(typeof formatMarkdownSummary, 'function', 'formatMarkdownSummary must be exported');
  assert.equal(typeof formatConsoleSummary, 'function', 'formatConsoleSummary must be exported');
  assert.equal(typeof sanitizeEvidence, 'function', 'sanitizeEvidence must be exported');
  assert.equal(typeof runSmokeProcess, 'function', 'runSmokeProcess must be exported');
});

// ─── 2. Workflow Definition & Ordering ──────────────────────────────────────

test('.github/workflows/ci.yml integrates ci-smoke-runner with preserved step sequence', () => {
  assert.ok(fs.existsSync(WORKFLOW_PATH), 'ci.yml must exist');
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  // Verify Smoke test step
  assert.ok(
    content.includes('node scripts/ci-smoke-runner.cjs'),
    'ci.yml verify-static Smoke test step must invoke ci-smoke-runner.cjs'
  );

  // Verify step ordering in verify-static
  const lintIdx = content.indexOf('name: Lint');
  const buildIdx = content.indexOf('name: Build check');
  const smokeIdx = content.indexOf('name: Smoke test');
  const verifyIdx = content.indexOf('name: Verify');

  assert.ok(lintIdx !== -1, 'Lint step must exist');
  assert.ok(buildIdx !== -1, 'Build check step must exist');
  assert.ok(smokeIdx !== -1, 'Smoke test step must exist');
  assert.ok(verifyIdx !== -1, 'Verify step must exist');

  assert.ok(lintIdx < buildIdx, 'Lint must precede Build check');
  assert.ok(buildIdx < smokeIdx, 'Build check must precede Smoke test');
  assert.ok(smokeIdx < verifyIdx, 'Smoke test must precede Verify');

  // Verify zero failure swallowing in workflow
  const smokeBlock = content.slice(smokeIdx, verifyIdx);
  assert.ok(!smokeBlock.includes('|| true'), 'Smoke test step must not swallow errors with || true');
  assert.ok(!smokeBlock.includes('continue-on-error: true'), 'Smoke test step must not have continue-on-error: true');
});

// ─── 3. TAP Parser Unit Tests ───────────────────────────────────────────────

test('parseTestOutput correctly extracts failures from Node TAP output', () => {
  const sampleTap = `
TAP version 13
# Subtest: tests/contracts/comments-reactions-access-contract.test.cjs
    # Subtest: fetch_comments accepts requester_uid parameter
    not ok 1325 - fetch_comments accepts requester_uid parameter
      ---
      duration_ms: 2.329865
      location: 'tests/contracts/comments-reactions-access-contract.test.cjs:340:10'
      failureType: 'subtestFailed'
      error: 'AssertionError [ERR_ASSERTION]: fetch_comments should accept requester_uid parameter'
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: true
      actual: false
      operator: '=='
      stack: |-
        TestContext.<anonymous> (tests/contracts/comments-reactions-access-contract.test.cjs:340:10)
      ...
    1..1
not ok 1 - tests/contracts/comments-reactions-access-contract.test.cjs
`;

  const failures = parseTestOutput(sampleTap, ROOT);
  assert.ok(failures.length >= 1, 'Should extract at least 1 failure');

  const f = failures[0];
  assert.equal(f.testName, 'fetch_comments accepts requester_uid parameter');
  assert.equal(f.file, 'tests/contracts/comments-reactions-access-contract.test.cjs');
  assert.equal(f.line, 340);
  assert.equal(f.errorCode, 'ERR_ASSERTION');
  assert.ok(f.errorMessage.includes('fetch_comments should accept requester_uid parameter'));
});

// ─── 4. Spec Output Parser Unit Tests ───────────────────────────────────────

test('parseTestOutput correctly extracts failures from Node Spec output', () => {
  const sampleSpec = [
    '✖ malformed comments DTO renders unavailable (432.757441ms)',
    '  AssertionError [ERR_ASSERTION]: like shows unavailable for malformed comments',
    '',
    "  '1' !== '—'",
    '',
    '      at TestContext.<anonymous> (tests/contracts/public-viewer-read-only-social-summary-contract.test.cjs:354:12)',
  ].join('\n');

  const failures = parseTestOutput(sampleSpec, ROOT);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].testName, 'malformed comments DTO renders unavailable');
  assert.equal(failures[0].file, 'tests/contracts/public-viewer-read-only-social-summary-contract.test.cjs');
  assert.equal(failures[0].errorCode, 'ERR_ASSERTION');
  assert.ok(failures[0].errorMessage.includes('like shows unavailable for malformed comments'));
});

// ─── 5. Secret / Sensitive Value Sanitization ───────────────────────────────

test('sanitizeEvidence redacts connection strings and auth tokens', () => {
  const raw = 'Failed to connect: postgresql://admin:supersecret@db.neon.tech:5432/lovebud?ssl=true with Authorization: Bearer eyJhbGciOi...';
  const sanitized = sanitizeEvidence(raw);

  assert.ok(!sanitized.includes('supersecret'), 'Must redact postgres password');
  assert.ok(!sanitized.includes('db.neon.tech'), 'Must redact connection host');
  assert.ok(!sanitized.includes('eyJhbGciOi'), 'Must redact bearer token');
  assert.ok(sanitized.includes('[REDACTED]'), 'Must replace with [REDACTED]');
});

// ─── 6. Deterministic Synthetic Passing Proof ───────────────────────────────

test('runSmokeProcess preserves exit 0 for passing command', async () => {
  const mockStdout = createMockStream();
  const mockStderr = createMockStream();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-smoke-pass-'));
  const stepSummaryFile = path.join(tempDir, 'step_summary.md');

  try {
    const result = await runSmokeProcess({
      cmd: process.execPath,
      args: ['-e', 'console.log("All tests passed"); process.exit(0);'],
      stepSummaryFile,
      stdout: mockStdout,
      stderr: mockStderr,
      cwd: tempDir,
    });

    assert.equal(result.exitCode, 0, 'Exit code must be exactly 0 for passing command');
    assert.equal(result.failures.length, 0, 'Must have 0 failures for passing command');
    assert.ok(mockStdout.getContent().includes('All tests passed'), 'Stdout must be streamed');

    // Check Step Summary written for passing state
    assert.ok(fs.existsSync(stepSummaryFile), 'Step summary file should be written');
    const summary = fs.readFileSync(stepSummaryFile, 'utf8');
    assert.ok(summary.includes('Smoke Test Passed'), 'Summary should record pass');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── 7. Deterministic Synthetic Failing Proof (Zero-Swallowing Verification) ──

test('runSmokeProcess strictly preserves non-zero exit code and extracts failure evidence', async () => {
  const mockStdout = createMockStream();
  const mockStderr = createMockStream();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-smoke-fail-'));
  const stepSummaryFile = path.join(tempDir, 'step_summary.md');

  // Create a synthetic failing test file
  const testFilePath = path.join(tempDir, 'synthetic-failure.test.cjs');
  fs.writeFileSync(
    testFilePath,
    `
    const test = require('node:test');
    const assert = require('node:assert/strict');

    test('synthetic passing subtest', () => {
      assert.equal(1, 1);
    });

    test('synthetic intentional failing subtest', () => {
      assert.equal(1, 2, 'intentional synthetic mismatch for #4014 proof');
    });
    `,
    'utf8'
  );

  try {
    const result = await runSmokeProcess({
      cmd: process.execPath,
      args: ['--test', testFilePath],
      stepSummaryFile,
      stdout: mockStdout,
      stderr: mockStderr,
      cwd: tempDir,
    });

    // 1. Strict non-zero exit code preservation
    assert.notEqual(result.exitCode, 0, 'Exit code must be non-zero for failing test');
    assert.equal(result.exitCode, 1, 'Node test runner exits with 1 on test failure');

    // 2. Failure extraction
    assert.ok(result.failures.length >= 1, 'Must extract the failing subtest');
    const f = result.failures.find(x => x.testName.includes('synthetic intentional failing subtest'));
    assert.ok(f, 'Must identify the exact failing subtest name');
    assert.ok(f.errorMessage.includes('intentional synthetic mismatch for #4014 proof'), 'Must capture assertion message');

    // 3. Stderr console highlight
    const errContent = mockStderr.getContent();
    assert.ok(errContent.includes('SMOKE TEST FAILURE SUMMARY'), 'Must print failure summary block to stderr');
    assert.ok(errContent.includes('synthetic intentional failing subtest'), 'Stderr must contain subtest name');

    // 4. Step Summary table verification
    assert.ok(fs.existsSync(stepSummaryFile), 'Step summary file must exist');
    const summary = fs.readFileSync(stepSummaryFile, 'utf8');
    assert.ok(summary.includes('## ❌ Smoke Test Failed'), 'Summary must have failure header');
    assert.ok(summary.includes('synthetic intentional failing subtest'), 'Summary table must contain failing subtest');
    assert.ok(summary.includes('intentional synthetic mismatch for #4014 proof'), 'Summary table must contain assertion message');
    assert.ok(summary.includes('ci-smoke-runner.cjs'), 'Summary must credit runner');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── 8. Format Markdown Summary Boundaries ──────────────────────────────────

test('formatMarkdownSummary creates well-formed bounded table', () => {
  const mockFailures = [
    {
      file: 'tests/contracts/foo.test.cjs',
      testName: 'foo_test',
      subtestName: 'foo_test',
      location: 'tests/contracts/foo.test.cjs:42:5',
      errorCode: 'ERR_ASSERTION',
      errorMessage: 'Expected a to equal b',
    },
  ];

  const md = formatMarkdownSummary(mockFailures, 1, 'raw output');
  assert.ok(md.includes('| # | Test File | Test / Subtest Name | Location | Assertion / Error Message |'));
  assert.ok(md.includes('`tests/contracts/foo.test.cjs`'));
  assert.ok(md.includes('`foo_test`'));
  assert.ok(md.includes('`tests/contracts/foo.test.cjs:42:5`'));
  assert.ok(md.includes('Expected a to equal b'));
});
