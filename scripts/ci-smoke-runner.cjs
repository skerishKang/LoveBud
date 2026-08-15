/**
 * LoveBud — CI Smoke Test Runner & Failure Evidence Preserver (#4014)
 *
 * Runs `npm test` (or a supplied test command) in CI, streams real-time stdout/stderr,
 * and on any non-zero exit:
 * 1. Preserves the exact non-zero exit code (never swallows failures).
 * 2. Incrementally parses streaming Node test runner output (TAP / spec formats) in real time
 *    so failures occurring at any byte offset (even after >10 MiB of prior output) are preserved:
 *    - failing test file(s)
 *    - failing test/subtest name(s)
 *    - assertion/error messages and codes
 *    - repository file and line locations
 * 3. Maintains a bounded rolling ring buffer of the tail raw output (default 10 MiB)
 *    so memory remains bounded while the latest failure context is always retained.
 * 4. Writes a sanitized, bounded Markdown failure table to $GITHUB_STEP_SUMMARY (if set).
 * 5. Emits a high-visibility failure summary block to stderr.
 * 6. Writes raw failure log to a local file for inspection or artifact upload.
 *
 * Refs: #4014, #3994, #1882
 */

'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');

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

// ─── 2. Streaming Node Test Output Parser & Ring Buffer ─────────────────────

class StreamingTestCollector {
  constructor(repoRoot = REPO_ROOT, maxTailBytes = 10 * 1024 * 1024, maxFailures = 100) {
    this.repoRoot = repoRoot;
    this.maxTailBytes = maxTailBytes;
    this.maxFailures = maxFailures;
    this.failures = [];
    this.seenKeys = new Set();

    // Bounded rolling ring buffer for raw tail output
    this.tailChunks = [];
    this.tailBytes = 0;

    // UTF-8 Decoders and line buffers
    this.stdoutDecoder = new StringDecoder('utf8');
    this.stderrDecoder = new StringDecoder('utf8');
    this.stdoutLineBuffer = '';
    this.stderrLineBuffer = '';

    // TAP parser state
    this.inYaml = false;
    this.currentTap = null;
    this.yamlMultilineKey = null;
    this.yamlMultilineLines = [];

    // Spec parser state
    this.currentSpecFile = '';
    this.currentSpecLine = null;
    this.currentSpec = null;
    this.specLines = [];
  }

  addStdoutChunk(chunk) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this._appendTail(buf);
    const text = this.stdoutDecoder.write(buf);
    this._consumeText(text, false);
  }

  addStderrChunk(chunk) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this._appendTail(buf);
    const text = this.stderrDecoder.write(buf);
    this._consumeText(text, true);
  }

  _appendTail(buf) {
    this.tailChunks.push(buf);
    this.tailBytes += buf.length;
    while (this.tailBytes > this.maxTailBytes && this.tailChunks.length > 1) {
      const removed = this.tailChunks.shift();
      this.tailBytes -= removed.length;
    }
  }

  _consumeText(text, isStderr) {
    const combined = (isStderr ? this.stderrLineBuffer : this.stdoutLineBuffer) + text;
    const lines = combined.split(/\r?\n/);
    const remainder = lines.pop();
    if (isStderr) {
      this.stderrLineBuffer = remainder;
    } else {
      this.stdoutLineBuffer = remainder;
    }
    for (const line of lines) {
      this._processLine(line);
    }
  }

  _processLine(line) {
    // 1. Check for Spec "test at <file>:<line>"
    const testAtMatch = line.match(/^test at\s+(.*?):(\d+)(?::(\d+))?$/);
    if (testAtMatch) {
      this._finalizeSpec();
      this.currentSpecFile = normalizeRepoPath(testAtMatch[1], this.repoRoot);
      this.currentSpecLine = parseInt(testAtMatch[2], 10);
      return;
    }

    // 2. Check for Spec "✖ <testName>"
    const specFailMatch = line.match(/^[✖x]\s+(.+?)(?:\s+\([\d.]+m?s\))?$/);
    if (specFailMatch && !line.includes('failing tests:')) {
      this._finalizeSpec();
      this.currentSpec = {
        testName: specFailMatch[1].trim(),
        file: this.currentSpecFile,
        line: this.currentSpecLine,
      };
      this.specLines = [];
      return;
    }

    if (this.currentSpec) {
      if (line.match(/^ℹ\s+/) || line.match(/^#/) || line.match(/^TAP version/)) {
        this._finalizeSpec();
      } else {
        this.specLines.push(line);
        if (this.specLines.length >= 20) {
          this._finalizeSpec();
        }
      }
    }

    // 3. Check for TAP "not ok <num> - <name>"
    const notOkMatch = line.match(/^(\s*)not ok\s+\d+\s+-\s+(.+)$/);
    if (notOkMatch) {
      this._finalizeTap();
      this.currentTap = {
        testName: notOkMatch[2].trim(),
        location: '',
        error: '',
        code: '',
        operator: '',
        expected: '',
        actual: '',
        stack: '',
      };
      this.inYaml = false;
      this.yamlMultilineKey = null;
      this.yamlMultilineLines = [];
      return;
    }

    if (this.currentTap) {
      const trimmed = line.trim();
      if (trimmed === '---') {
        this.inYaml = true;
        return;
      }
      if (trimmed === '...') {
        this._flushYamlMultiline();
        this.inYaml = false;
        this._finalizeTap();
        return;
      }
      if (this.inYaml) {
        if (this.yamlMultilineKey) {
          if (line.match(/^\s{4,}/)) {
            this.yamlMultilineLines.push(trimmed);
            return;
          } else {
            this._flushYamlMultiline();
          }
        }

        const locMatch = line.match(/^\s*location:\s*['"]?([^'"]+)['"]?/);
        if (locMatch) { this.currentTap.location = locMatch[1]; return; }

        const codeMatch = line.match(/^\s*code:\s*['"]?([^'"]+)['"]?/);
        if (codeMatch) { this.currentTap.code = codeMatch[1]; return; }

        const opMatch = line.match(/^\s*operator:\s*['"]?([^'"]+)['"]?/);
        if (opMatch) { this.currentTap.operator = opMatch[1]; return; }

        const expMatch = line.match(/^\s*expected:\s*(.+)$/);
        if (expMatch) { this.currentTap.expected = expMatch[1].trim(); return; }

        const actMatch = line.match(/^\s*actual:\s*(.+)$/);
        if (actMatch) { this.currentTap.actual = actMatch[1].trim(); return; }

        const errMatch = line.match(/^\s*error:\s*(?:\|-)?\s*['"]?([^'"]*)['"]?/);
        if (errMatch) {
          if (line.includes('|-')) {
            this.yamlMultilineKey = 'error';
            this.yamlMultilineLines = [];
          } else {
            this.currentTap.error = errMatch[1];
          }
          return;
        }

        if (line.match(/^\s*stack:\s*\|-/)) {
          this.yamlMultilineKey = 'stack';
          this.yamlMultilineLines = [];
          return;
        }
      }
    }
  }

  _flushYamlMultiline() {
    if (!this.currentTap || !this.yamlMultilineKey) return;
    const content = this.yamlMultilineLines.join('\n');
    if (this.yamlMultilineKey === 'error') {
      this.currentTap.error = content;
    } else if (this.yamlMultilineKey === 'stack') {
      this.currentTap.stack = content;
    }
    this.yamlMultilineKey = null;
    this.yamlMultilineLines = [];
  }

  _finalizeTap() {
    if (!this.currentTap) return;
    this._flushYamlMultiline();
    const tap = this.currentTap;
    this.currentTap = null;
    this.inYaml = false;

    let file = '';
    let lineNum = null;
    let colNum = null;
    if (tap.location) {
      const parts = tap.location.match(/^(.*?):(\d+)(?::(\d+))?$/);
      if (parts) {
        file = normalizeRepoPath(parts[1], this.repoRoot);
        lineNum = parseInt(parts[2], 10);
        colNum = parts[3] ? parseInt(parts[3], 10) : null;
      } else {
        file = normalizeRepoPath(tap.location, this.repoRoot);
      }
    } else if (tap.stack) {
      const stackMatch = tap.stack.match(/at (?:.+?\s+\()?([^():\s]+):(\d+):(\d+)\)?/) || tap.stack.match(/\((.*?):(\d+):(\d+)\)/);
      if (stackMatch) {
        file = normalizeRepoPath(stackMatch[1], this.repoRoot);
        lineNum = parseInt(stackMatch[2], 10);
        colNum = parseInt(stackMatch[3], 10);
      }
    }

    this._addFailure({
      testName: tap.testName,
      subtestName: tap.testName,
      location: tap.location ? normalizeRepoPath(tap.location, this.repoRoot) : (file && lineNum ? `${file}:${lineNum}` : ''),
      file,
      line: lineNum,
      column: colNum,
      errorCode: tap.code || (tap.error && tap.error.includes('ERR_ASSERTION') ? 'ERR_ASSERTION' : ''),
      errorMessage: sanitizeEvidence(truncateString(tap.error || tap.stack || 'Test failed')),
      operator: tap.operator || '',
      expected: truncateString(tap.expected, 100),
      actual: truncateString(tap.actual, 100),
    });
  }

  _finalizeSpec() {
    if (!this.currentSpec) return;
    const spec = this.currentSpec;
    this.currentSpec = null;
    const errSnippet = this.specLines.join('\n');
    this.specLines = [];

    let stackLoc = '';
    for (const l of errSnippet.split('\n')) {
      const atMatch = l.match(/at (?:.+?\s+\()?([^\s():]+):(\d+):(\d+)\)?/);
      if (atMatch && !stackLoc && (atMatch[1].includes('tests/') || atMatch[1].includes('.test.'))) {
        stackLoc = `${normalizeRepoPath(atMatch[1], this.repoRoot)}:${atMatch[2]}:${atMatch[3]}`;
      }
    }

    const file = spec.file || (stackLoc ? stackLoc.split(':')[0] : '');
    const loc = stackLoc || (spec.file && spec.line ? `${spec.file}:${spec.line}` : '');

    this._addFailure({
      testName: spec.testName,
      subtestName: spec.testName,
      location: loc,
      file,
      line: spec.line || null,
      column: null,
      errorCode: errSnippet.includes('ERR_ASSERTION') ? 'ERR_ASSERTION' : '',
      errorMessage: sanitizeEvidence(truncateString(errSnippet || 'Test failed')),
      operator: '',
      expected: '',
      actual: '',
    });
  }

  _addFailure(f) {
    if (this.failures.length >= this.maxFailures) return;
    const key = `${f.file || ''}::${f.subtestName || f.testName || ''}::${f.line || ''}`;
    if (this.seenKeys.has(key)) return;
    this.seenKeys.add(key);
    this.failures.push(f);
  }

  flush() {
    const remOut = this.stdoutDecoder.end();
    if (remOut) this._consumeText(remOut, false);
    const remErr = this.stderrDecoder.end();
    if (remErr) this._consumeText(remErr, true);

    if (this.stdoutLineBuffer) {
      this._processLine(this.stdoutLineBuffer);
      this.stdoutLineBuffer = '';
    }
    if (this.stderrLineBuffer) {
      this._processLine(this.stderrLineBuffer);
      this.stderrLineBuffer = '';
    }
    this._finalizeTap();
    this._finalizeSpec();
  }

  getFailures() {
    return this.failures;
  }

  getTailOutput() {
    return Buffer.concat(this.tailChunks).toString('utf8');
  }
}

/**
 * Parses TAP or Spec output from a string.
 *
 * @param {string} rawOutput
 * @param {string} repoRoot
 * @returns {Array<Object>}
 */
function parseTestOutput(rawOutput, repoRoot = REPO_ROOT) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];
  const collector = new StreamingTestCollector(repoRoot, rawOutput.length + 1024, 100);
  collector.addStdoutChunk(Buffer.from(rawOutput, 'utf8'));
  collector.flush();
  return collector.getFailures();
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
  const maxTailBytes = opts.maxTailBytes || 10 * 1024 * 1024;
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

  const collector = new StreamingTestCollector(cwd, maxTailBytes, 100);

  return new Promise((resolve) => {
    const child = spawn(command, cmdArgs, {
      cwd,
      env: childEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (chunk) => {
      outStream.write(chunk);
      collector.addStdoutChunk(chunk);
    });

    child.stderr.on('data', (chunk) => {
      errStream.write(chunk);
      collector.addStderrChunk(chunk);
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
      collector.flush();
      const exitCode = code !== null ? code : (signal ? 128 : 1);
      const rawOutput = collector.getTailOutput();
      const failures = collector.getFailures();

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
  StreamingTestCollector,
  parseTestOutput,
  formatMarkdownSummary,
  formatConsoleSummary,
  sanitizeEvidence,
  normalizeRepoPath,
  runSmokeProcess,
};
