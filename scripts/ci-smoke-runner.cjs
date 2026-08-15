/**
 * LoveBud — CI Smoke Test Runner & Failure Evidence Preserver (#4014)
 *
 * Runs `npm test` (or a supplied test command) in CI, streams real-time stdout/stderr,
 * and on any non-zero exit:
 * 1. Preserves the exact non-zero exit code (never swallows failures).
 * 2. Parses Node test runner output (TAP / spec formats) to extract:
 *    - failing test file(s)
 *    - failing test/subtest name(s)
 *    - assertion/error messages and codes
 *    - repository file and line locations
 * 3. Writes a sanitized, bounded Markdown failure table to $GITHUB_STEP_SUMMARY (if set).
 * 4. Emits a high-visibility failure summary block to stderr.
 * 5. Writes raw failure log to a local file for inspection or artifact upload.
 *
 * Refs: #4014, #3994, #1882
 */

'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ─── 1. Sanitization & Safety ───────────────────────────────────────────────

const SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/[^\s'"]+/gi,
  /(?:authorization:\s*bearer\s+)[^\s'"]+/gi,
  /(?:api[_-]?key|auth[_-]?token|secret|password|private[_-]?key)\s*[:=]\s*['"]?[^\s'",;]+['"]?/gi,
];

function sanitizeEvidence(text) {
  if (typeof text !== 'string') return '';
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function truncateString(str, maxLen = 500) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 3) + '...';
}

function normalizeRepoPath(filePath, root = REPO_ROOT) {
  if (!filePath) return '';
  let normalized = filePath.trim().replace(/^['"]|['"]$/g, '');
  if (path.isAbsolute(normalized)) {
    try {
      normalized = path.relative(root, normalized);
    } catch {
      // keep normalized
    }
  }
  return normalized.replace(/\\/g, '/');
}

// ─── 2. Node Test Runner Output Parser ──────────────────────────────────────

/**
 * Parses TAP or Spec output from Node.js `--test` runner.
 * Extracts structured failure objects.
 *
 * @param {string} rawOutput
 * @param {string} repoRoot
 * @returns {Array<Object>}
 */
function parseTestOutput(rawOutput, repoRoot = REPO_ROOT) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];
  const lines = rawOutput.split(/\r?\n/);
  const failures = [];
  const seenKeys = new Set();

  function addFailure(f) {
    const key = `${f.file || ''}::${f.subtestName || f.testName || ''}::${f.line || ''}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    failures.push(f);
  }

  // Pass 1: Parse TAP 'not ok' blocks
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const notOkMatch = line.match(/^(\s*)not ok\s+\d+\s+-\s+(.+)$/);
    if (notOkMatch) {
      const indent = notOkMatch[1];
      const testName = notOkMatch[2].trim();
      let location = '';
      let error = '';
      let code = '';
      let operator = '';
      let expected = '';
      let actual = '';
      let stack = '';

      i++;
      if (i < lines.length && lines[i].trim() === '---') {
        i++;
        while (i < lines.length && lines[i].trim() !== '...') {
          const subLine = lines[i];
          const locMatch = subLine.match(/^\s*location:\s*['"]?([^'"]+)['"]?/);
          if (locMatch) location = locMatch[1];

          const errMatch = subLine.match(/^\s*error:\s*(?:\|-)?\s*['"]?([^'"]*)['"]?/);
          if (errMatch) {
            if (subLine.includes('|-')) {
              i++;
              const errLines = [];
              while (i < lines.length && lines[i].match(/^\s{4,}/)) {
                errLines.push(lines[i].trim());
                i++;
              }
              error = errLines.join('\n');
              continue;
            } else {
              error = errMatch[1];
            }
          }

          const codeMatch = subLine.match(/^\s*code:\s*['"]?([^'"]+)['"]?/);
          if (codeMatch) code = codeMatch[1];

          const opMatch = subLine.match(/^\s*operator:\s*['"]?([^'"]+)['"]?/);
          if (opMatch) operator = opMatch[1];

          const expMatch = subLine.match(/^\s*expected:\s*(.+)$/);
          if (expMatch) expected = expMatch[1].trim();

          const actMatch = subLine.match(/^\s*actual:\s*(.+)$/);
          if (actMatch) actual = actMatch[1].trim();

          if (subLine.match(/^\s*stack:\s*\|-/)) {
            i++;
            const stackLines = [];
            while (i < lines.length && lines[i].match(/^\s{4,}/)) {
              stackLines.push(lines[i].trim());
              i++;
            }
            stack = stackLines.join('\n');
            continue;
          }
          i++;
        }
      }

      // Parse file and line from location or stack
      let file = '';
      let lineNum = null;
      let colNum = null;
      if (location) {
        const parts = location.match(/^(.*?):(\d+)(?::(\d+))?$/);
        if (parts) {
          file = normalizeRepoPath(parts[1], repoRoot);
          lineNum = parseInt(parts[2], 10);
          colNum = parts[3] ? parseInt(parts[3], 10) : null;
        } else {
          file = normalizeRepoPath(location, repoRoot);
        }
      } else if (stack) {
        const stackMatch = stack.match(/at (?:.+?\s+\()?([^():\s]+):(\d+):(\d+)\)?/) || stack.match(/\((.*?):(\d+):(\d+)\)/);
        if (stackMatch) {
          file = normalizeRepoPath(stackMatch[1], repoRoot);
          lineNum = parseInt(stackMatch[2], 10);
          colNum = parseInt(stackMatch[3], 10);
        }
      }

      addFailure({
        testName,
        subtestName: testName,
        location: location ? normalizeRepoPath(location, repoRoot) : (file && lineNum ? `${file}:${lineNum}` : ''),
        file,
        line: lineNum,
        column: colNum,
        errorCode: code || (error.includes('ERR_ASSERTION') ? 'ERR_ASSERTION' : ''),
        errorMessage: sanitizeEvidence(truncateString(error || stack || 'Test failed without explicit error message')),
        operator,
        expected: truncateString(expected, 100),
        actual: truncateString(actual, 100),
      });
      continue;
    }
    i++;
  }

  // Pass 2: Parse Spec '✖ <test>' / 'test at <file>:<line>' blocks if TAP yielded nothing
  if (failures.length === 0) {
    let currentTestFile = '';
    let currentFileLine = null;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const testAtMatch = line.match(/^test at\s+(.*?):(\d+)(?::(\d+))?$/);
      if (testAtMatch) {
        currentTestFile = normalizeRepoPath(testAtMatch[1], repoRoot);
        currentFileLine = parseInt(testAtMatch[2], 10);
        continue;
      }

      const failMatch = line.match(/^[✖x]\s+(.+?)(?:\s+\([\d.]+m?s\))?$/);
      if (failMatch) {
        const testName = failMatch[1].trim();
        let errSnippet = '';
        let stackLoc = '';

        // Read next lines for assertion message and stack
        let k = j + 1;
        const errLines = [];
        while (k < lines.length && k < j + 15) {
          const next = lines[k];
          if (next.match(/^[✖x]\s+/) || next.match(/^test at\s+/) || next.match(/^ℹ\s+/)) break;
          if (next.trim()) errLines.push(next.trim());
          const atMatch = next.match(/at (?:.+?\s+\()?([^\s():]+):(\d+):(\d+)\)?/);
          if (atMatch && !stackLoc && atMatch[1].includes('tests/')) {
            stackLoc = `${normalizeRepoPath(atMatch[1], repoRoot)}:${atMatch[2]}:${atMatch[3]}`;
          }
          k++;
        }
        errSnippet = errLines.join('\n');

        const file = currentTestFile || (stackLoc ? stackLoc.split(':')[0] : '');
        const loc = stackLoc || (currentTestFile && currentFileLine ? `${currentTestFile}:${currentFileLine}` : '');

        addFailure({
          testName,
          subtestName: testName,
          location: loc,
          file,
          line: currentFileLine,
          column: null,
          errorCode: errSnippet.includes('ERR_ASSERTION') ? 'ERR_ASSERTION' : '',
          errorMessage: sanitizeEvidence(truncateString(errSnippet || 'Test failed')),
          operator: '',
          expected: '',
          actual: '',
        });
      }
    }
  }

  return failures;
}

// ─── 3. Formatting Failure Summaries ───────────────────────────────────────

function formatMarkdownSummary(failures, exitCode, rawOutput = '') {
  const lines = [];
  lines.push(`## ❌ Smoke Test Failed (Exit Code: ${exitCode})`);
  lines.push('');
  lines.push(`> **CI Failure Observability (#4014):** Preserving exact failure location, test/subtest name, and assertion evidence.`);
  lines.push('');

  if (failures.length > 0) {
    lines.push(`### ⚠️ Detected Failures (${failures.length})`);
    lines.push('');
    lines.push('| # | Test File | Test / Subtest Name | Location | Assertion / Error Message |');
    lines.push('|---|---|---|---|---|');

    const maxToShow = 50;
    failures.slice(0, maxToShow).forEach((f, idx) => {
      const fileCol = f.file ? `\`${f.file}\`` : '—';
      const nameCol = f.subtestName || f.testName ? `\`${f.subtestName || f.testName}\`` : '—';
      const locCol = f.location ? `\`${f.location}\`` : (f.file && f.line ? `\`${f.file}:${f.line}\`` : '—');
      const errCol = f.errorMessage ? f.errorMessage.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') : 'Failed';
      lines.push(`| ${idx + 1} | ${fileCol} | ${nameCol} | ${locCol} | ${errCol} |`);
    });

    if (failures.length > maxToShow) {
      lines.push('');
      lines.push(`*... and ${failures.length - maxToShow} more failure(s).*`);
    }
  } else {
    lines.push('### ⚠️ Failure Summary');
    lines.push('No individual subtest assertion lines could be parsed from TAP/Spec output.');
    lines.push('See the detailed failure log below.');
  }

  if (rawOutput) {
    const sanitizedRaw = sanitizeEvidence(rawOutput);
    const boundedRaw = sanitizedRaw.length > 40000 ? sanitizedRaw.slice(-40000) : sanitizedRaw;
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>📋 Tail Output (Last 40 KB)</summary>');
    lines.push('');
    lines.push('```text');
    lines.push(boundedRaw.trim());
    lines.push('```');
    lines.push('</details>');
  }

  lines.push('');
  lines.push('---');
  lines.push('*Preserved by LoveBud CI Smoke Runner (`scripts/ci-smoke-runner.cjs`). Refs #4014, #1882.*');
  lines.push('');

  return lines.join('\n');
}

function formatConsoleSummary(failures, exitCode) {
  const lines = [];
  lines.push('\n================================================================================');
  lines.push(`❌ SMOKE TEST FAILURE SUMMARY (Exit Code: ${exitCode})`);
  lines.push('================================================================================');

  if (failures.length > 0) {
    lines.push(`Found ${failures.length} failing test(s):\n`);
    failures.slice(0, 30).forEach((f, idx) => {
      lines.push(`${idx + 1}. File: ${f.file || 'unknown'}`);
      if (f.location) lines.push(`   Location: ${f.location}`);
      lines.push(`   Test:     ${f.subtestName || f.testName || 'unnamed'}`);
      if (f.errorCode) lines.push(`   Code:     ${f.errorCode}`);
      if (f.errorMessage) lines.push(`   Error:    ${f.errorMessage.split('\n')[0]}`);
      lines.push('');
    });
    if (failures.length > 30) {
      lines.push(`... and ${failures.length - 30} more failure(s).\n`);
    }
  } else {
    lines.push('Command failed with non-zero exit code. Please review the output above.\n');
  }

  lines.push('================================================================================\n');
  return lines.join('\n');
}

// ─── 4. Main Process Runner ────────────────────────────────────────────────

/**
 * Spawns the test suite command, streams output in real time, and handles failure evidence.
 *
 * @param {Object} opts
 * @returns {Promise<{ exitCode: number, failures: Array, rawOutput: string }>}
 */
function runSmokeProcess(opts = {}) {
  const cwd = opts.cwd || REPO_ROOT;
  const env = opts.env || process.env;
  const customCmd = opts.cmd || null;
  const customArgs = opts.args || null;
  const stepSummaryFile = opts.stepSummaryFile || env.GITHUB_STEP_SUMMARY || null;
  const outStream = opts.stdout || process.stdout;
  const errStream = opts.stderr || process.stderr;

  let command;
  let cmdArgs;

  if (customCmd) {
    command = customCmd;
    cmdArgs = customArgs || [];
  } else {
    // Default: use npm test
    command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    cmdArgs = ['test'];
  }

  const childEnv = { ...env };
  delete childEnv.NODE_TEST_CONTEXT;

  return new Promise((resolve) => {
    let capturedChunks = [];
    let totalBytes = 0;
    const MAX_CAPTURE_BYTES = 10 * 1024 * 1024; // 10 MB in-memory buffer

    const child = spawn(command, cmdArgs, {
      cwd,
      env: childEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (chunk) => {
      outStream.write(chunk);
      if (totalBytes < MAX_CAPTURE_BYTES) {
        capturedChunks.push(chunk);
        totalBytes += chunk.length;
      }
    });

    child.stderr.on('data', (chunk) => {
      errStream.write(chunk);
      if (totalBytes < MAX_CAPTURE_BYTES) {
        capturedChunks.push(chunk);
        totalBytes += chunk.length;
      }
    });

    child.on('error', (err) => {
      const errMsg = `Failed to spawn test runner process: ${err.message}\n`;
      errStream.write(errMsg);
      resolve({
        exitCode: 1,
        failures: [{
          testName: 'spawn_error',
          subtestName: 'spawn_error',
          location: 'scripts/ci-smoke-runner.cjs',
          file: 'scripts/ci-smoke-runner.cjs',
          errorMessage: sanitizeEvidence(err.message),
        }],
        rawOutput: errMsg,
      });
    });

    child.on('close', (code, signal) => {
      const exitCode = code !== null ? code : (signal ? 128 : 1);
      const rawOutput = Buffer.concat(capturedChunks).toString('utf8');
      const failures = parseTestOutput(rawOutput, cwd);

      if (exitCode !== 0) {
        // 1. Print formatted console summary to stderr
        const consoleSummary = formatConsoleSummary(failures, exitCode);
        errStream.write(consoleSummary);

        // 2. Write to GITHUB_STEP_SUMMARY if available
        if (stepSummaryFile) {
          try {
            const md = formatMarkdownSummary(failures, exitCode, rawOutput);
            fs.appendFileSync(stepSummaryFile, md + '\n', 'utf8');
          } catch (writeErr) {
            errStream.write(`Warning: Failed to write to GITHUB_STEP_SUMMARY: ${writeErr.message}\n`);
          }
        }

        // 3. Save failure log to .tmp/ci-smoke-failure.log if .tmp or root is writable
        try {
          const tmpDir = path.join(cwd, '.tmp');
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }
          const failureLogPath = path.join(tmpDir, 'ci-smoke-failure.log');
          fs.writeFileSync(failureLogPath, sanitizeEvidence(rawOutput), 'utf8');
        } catch {
          // ignore local write failure
        }
      } else {
        // Success case: write passing summary if in GitHub Actions
        if (stepSummaryFile) {
          try {
            const passMd = '## ✅ Smoke Test Passed\n\nAll smoke, route, and contract suites passed successfully.\n';
            fs.appendFileSync(stepSummaryFile, passMd, 'utf8');
          } catch {
            // ignore
          }
        }
      }

      resolve({
        exitCode,
        failures,
        rawOutput,
      });
    });
  });
}

// ─── 5. CLI Invocation ─────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let customCmd = null;
  let customArgs = null;

  if (args.length > 0) {
    customCmd = args[0];
    customArgs = args.slice(1);
  }

  runSmokeProcess({
    cmd: customCmd,
    args: customArgs,
  })
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error('Fatal error in ci-smoke-runner:', err);
      process.exit(1);
    });
}

module.exports = {
  parseTestOutput,
  formatMarkdownSummary,
  formatConsoleSummary,
  sanitizeEvidence,
  normalizeRepoPath,
  runSmokeProcess,
};
