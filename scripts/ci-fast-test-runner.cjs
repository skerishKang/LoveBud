'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runSmokeProcess } = require('./ci-smoke-runner.cjs');

const ROOT = path.resolve(__dirname, '..');
const SUITE_DIRS = ['tests/smoke', 'tests/routes'];

function collectTestFiles() {
  const files = [];

  for (const relativeDir of SUITE_DIRS) {
    const absoluteDir = path.join(ROOT, relativeDir);
    if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
      throw new Error(`FAST_TEST_SUITE_DIRECTORY_MISSING: ${relativeDir}`);
    }

    const suiteFiles = fs.readdirSync(absoluteDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.test.cjs'))
      .map((entry) => path.join(relativeDir, entry.name))
      .sort((a, b) => a.localeCompare(b));

    if (suiteFiles.length === 0) {
      throw new Error(`FAST_TEST_SUITE_EMPTY: ${relativeDir}`);
    }

    files.push(...suiteFiles);
  }

  return files;
}

async function main() {
  const files = collectTestFiles();
  console.log(`FAST_TEST_SELECTION suites=${SUITE_DIRS.join(',')} files=${files.length}`);

  // Keep this selector cross-platform: pass explicit file paths to Node rather
  // than relying on shell glob expansion. The existing full CI remains the
  // authority for contracts, Playwright/Chromium, and DB regression coverage.
  const env = { ...process.env, GITHUB_STEP_SUMMARY: '' };
  const { exitCode } = await runSmokeProcess({
    cmd: process.execPath,
    args: ['--test', ...files],
    env,
  });

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(`FAST_TEST_RUNNER_FATAL: ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
