'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/product/lovebud-scout-provider-real-adapter-readiness-audit.md';
const TEST_PATH = 'tests/contracts/scout-provider-real-adapter-readiness-audit-contract.test.cjs';
const EXPECTED_CHANGED_FILES = [DOC_PATH, TEST_PATH];

function readDoc() {
  return fs.readFileSync(path.join(ROOT, DOC_PATH), 'utf8');
}

function requirePhrase(doc, phrase, message) {
  assert.ok(doc.includes(phrase), message || `document must include: ${phrase}`);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitQuiet(args) {
  try {
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function ghPrFiles() {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token || !eventPath) {
    return [];
  }
  let event;
  try {
    event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch {
    return [];
  }
  const owner = event && event.repository && event.repository.owner && event.repository.owner.login;
  const repoName = event && event.repository && event.repository.name;
  const prNumber = event && event.number;
  if (!owner || !repoName || !prNumber) {
    return [];
  }
  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/files?per_page=100`;
  try {
    const output = execFileSync(
      'curl',
      [
        '-sSL',
        '-H',
        `Authorization: token ${token}`,
        '-H',
        'Accept: application/vnd.github+json',
        url,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const data = JSON.parse(output);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((entry) => entry.filename).filter(Boolean);
  } catch {
    return [];
  }
}

function ghPrBaseSha() {
  try {
    const prNumber = execFileSync(
      'gh',
      ['pr', 'view', '--json', 'number', '-q', '.number'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    if (!prNumber) {
      return '';
    }
    const repo = execFileSync(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    if (!repo) {
      return '';
    }
    const data = JSON.parse(
      execFileSync(
        'gh',
        ['api', `repos/${repo}/pulls/${prNumber}`],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      )
    );
    return (data && data.base && data.base.sha) || '';
  } catch {
    return '';
  }
}

function githubEventBaseSha() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return '';
  }
  try {
    const raw = fs.readFileSync(eventPath, 'utf8');
    const ev = JSON.parse(raw);
    return (ev && ev.pull_request && ev.pull_request.base && ev.pull_request.base.sha) || '';
  } catch {
    return '';
  }
}

function revExists(rev) {
  return gitQuiet(['rev-parse', '--verify', rev]);
}

function splitGitList(output) {
  return output.split('\0').map((line) => line.trim()).filter(Boolean);
}

function currentCommitChangedFiles() {
  return splitGitList(git(['show', '--name-only', '--pretty=format:', '-z', 'HEAD']));
}

function mergeCommitBranchDiffFiles() {
  const parents = splitGitList(git(['show', '-s', '--format=%P', 'HEAD']));
  if (parents.length !== 2) {
    return [];
  }

  let best = [];
  for (const parent of parents) {
    try {
      const changed = splitGitList(git(['diff', '--name-only', '-z', `${parent}..HEAD`]));
      if (changed.includes(DOC_PATH) && changed.includes(TEST_PATH)) {
        if (best.length === 0 || changed.length < best.length) {
          best = changed;
        }
      }
    } catch {
      // Try the other merge parent.
    }
  }

  return best;
}

function committedChangedFiles() {
  const apiFiles = ghPrFiles();
  if (apiFiles.length > 0) {
    return apiFiles;
  }

  const mergeCommitChanged = mergeCommitBranchDiffFiles();
  if (mergeCommitChanged.length > 0) {
    return mergeCommitChanged;
  }

  const ranges = [];

  const prBaseSha = ghPrBaseSha();
  const eventBaseSha = githubEventBaseSha();
  const candidateBase = prBaseSha || eventBaseSha;
  if (candidateBase && !revExists(candidateBase)) {
    try {
      git(['fetch', 'origin', candidateBase]);
    } catch {
      // Best-effort fetch; the range lookup below will fall back if it fails.
    }
  }
  if (candidateBase && revExists(candidateBase)) {
    ranges.push(`${candidateBase}...HEAD`);
  }

  if (!revExists('origin/main')) {
    try {
      git(['fetch', 'origin', 'main']);
    } catch {
      // Best-effort fetch; the range lookup below will fall back if it fails.
    }
  }
  if (revExists('origin/main')) {
    ranges.push('origin/main...HEAD');
  }

  if (revExists('main')) {
    ranges.push('main...HEAD');
  }
  if (revExists('HEAD~1')) {
    ranges.push('HEAD~1..HEAD');
  }

  for (const range of ranges) {
    try {
      return splitGitList(git(['diff', '--name-only', '-z', range]));
    } catch {
      // Fall through to the next available range.
    }
  }

  return currentCommitChangedFiles();
}

function trackedUncommittedChangedFiles() {
  const refs = [];

  if (revExists('origin/main')) {
    refs.push('origin/main');
  }
  if (revExists('main')) {
    refs.push('main');
  }
  if (revExists('HEAD~1')) {
    refs.push('HEAD~1');
  }

  for (const ref of refs) {
    try {
      return splitGitList(git(['diff', '--name-only', '-z', ref, '--']));
    } catch {
      // Fall through to the next available ref.
    }
  }

  return [];
}

function untrackedFiles() {
  return splitGitList(git(['ls-files', '--others', '--exclude-standard']));
}

function changedFilesForPrShape() {
  const committed = committedChangedFiles();
  if (committed.length > 0) {
    return committed;
  }

  const tracked = trackedUncommittedChangedFiles();
  const untrackedExpected = untrackedFiles().filter((file) => EXPECTED_CHANGED_FILES.includes(file));
  return [...tracked, ...untrackedExpected];
}

test('document file exists with the required title', () => {
  const doc = readDoc();

  assert.ok(fs.existsSync(path.join(ROOT, DOC_PATH)), 'readiness audit document must exist');
  assert.match(doc, /^# LoveBud Scout Provider Real Adapter Readiness Audit$/m, 'document title must match exactly');
});

test('document states docs/contracts-only scope and single blocker boundary', () => {
  const doc = readDoc();

  requirePhrase(doc, 'This is a docs/contracts-only readiness audit');
  requirePhrase(doc, 'This issue audits only the `provider-specific real adapter` blocker');
  requirePhrase(doc, 'This issue does not implement a provider adapter');
  requirePhrase(doc, 'Closing this issue does not authorize live execution');
  requirePhrase(doc, 'This issue does not authorize provider-specific implementation work');
});

test('document keeps the parent and dependency map explicit', () => {
  const doc = readDoc();

  requirePhrase(doc, '#1882 remains open');
  requirePhrase(doc, '#2522 blocker map is the parent blocker inventory');
  requirePhrase(doc, '#2524 already covered `runtime Firebase auth enforcement`');
  requirePhrase(doc, '#2526 already covered `persistent rate-limit storage`');
  requirePhrase(doc, '#2528 already covered `runtime cost/quota monitor`');
  requirePhrase(doc, '#2530 already covered `runtime abuse reporting`');
  requirePhrase(doc, '#2538 covers only `provider-specific real adapter`');
});

test('document locks current safe defaults', () => {
  const doc = readDoc();

  requirePhrase(doc, 'Endpoint default remains `stub`');
  requirePhrase(doc, 'Frontend default remains `local_stub`');
  requirePhrase(doc, 'Live endpoint client remains disabled');
  requirePhrase(doc, 'No live provider execution is enabled');
  requirePhrase(doc, 'No provider SDK is added');
  requirePhrase(doc, 'No fetch/network call is added');
  requirePhrase(doc, 'No provider credentials are read');
  requirePhrase(doc, 'No API key/env secret usage is added');
  requirePhrase(doc, 'No DB/API/schema changes are made');
});

test('document lists future provider adapter prerequisites', () => {
  const doc = readDoc();
  const prerequisites = [
    'explicit provider mode gate',
    'provider selection allowlist',
    'provider credential source policy',
    'timeout policy',
    'retry policy',
    'streaming policy or explicit no-streaming policy',
    'prompt construction policy',
    'response parsing policy',
    'provider error taxonomy',
    'quota/cost accounting integration',
    'abuse reporting integration',
    'rate-limit storage dependency',
    'Firebase auth enforcement dependency',
    'observability/log redaction policy',
    'kill switch / rollback policy',
    'test strategy with network-free unit tests and opt-in integration tests only',
    'no frontend secret exposure',
  ];

  for (const prerequisite of prerequisites) {
    requirePhrase(doc, prerequisite, `future prerequisite checklist must include: ${prerequisite}`);
  }
});

test('document lists runtime non-goals', () => {
  const doc = readDoc();
  const nonGoals = [
    'no provider adapter implementation',
    'no provider SDK',
    'no fetch/network',
    'no prompt construction runtime',
    'no retry runtime',
    'no timeout runtime',
    'no streaming runtime',
    'no model selection runtime',
    'no response parsing runtime',
    'no credential access',
    'no cost accounting runtime',
    'no endpoint behavior change',
    'no frontend live endpoint enablement',
    'no database/schema changes',
    'no Browse/Search/#1661 work',
  ];

  for (const nonGoal of nonGoals) {
    requirePhrase(doc, nonGoal, `runtime non-goal must include: ${nonGoal}`);
  }
});

test('document recommends smaller future implementation issues first', () => {
  const doc = readDoc();
  const futureIssues = [
    'provider adapter contract interface',
    'provider mode gate and config validation',
    'provider error taxonomy mapping',
    'provider secret deployment checklist',
    'opt-in integration test harness',
    'Only after those are closed, provider-specific implementation may be considered',
  ];

  for (const futureIssue of futureIssues) {
    requirePhrase(doc, futureIssue, `future issue recommendation must include: ${futureIssue}`);
  }
});

test('closure policy does not authorize live execution', () => {
  const doc = readDoc();

  requirePhrase(doc, '#2538 may close when this readiness audit document and its companion contract test are merged');
  requirePhrase(doc, 'Closing #2538 does not authorize live execution');
  requirePhrase(doc, '#1882 remains open until the real-live Scout blockers are satisfied or an explicit not-planned decision is made');
});

test('repo changed files are docs/contracts-only', () => {
  const changed = changedFilesForPrShape();

  assert.deepEqual(changed.sort(), [...EXPECTED_CHANGED_FILES].sort(), 'changed files must be only the readiness audit doc and contract test');

  const runtimeOrProductChanged = changed.filter((file) => {
    return file.startsWith('js/') ||
      file.startsWith('functions/') ||
      file.startsWith('pages/') ||
      file.startsWith('css/') ||
      file.startsWith('public/') ||
      file.startsWith('scripts/');
  });

  assert.deepEqual(runtimeOrProductChanged, [], 'no runtime/product code files may change in this docs/contracts-only slice');

  const unexpectedUntrackedDocsOrTests = untrackedFiles()
    .filter((file) => file.startsWith('docs/product/') || file.startsWith('tests/contracts/'))
    .filter((file) => !EXPECTED_CHANGED_FILES.includes(file));

  assert.deepEqual(unexpectedUntrackedDocsOrTests, [], 'no unexpected untracked docs/product or tests/contracts files may exist');
});

test('existing Scout runtime files are unchanged from origin/main', () => {
  const scoutRuntimeChanged = committedChangedFiles().filter((file) => {
    return file.startsWith('js/scout/') ||
      file.startsWith('functions/api/scout/') ||
      file.startsWith('js/api/scout/');
  });

  assert.deepEqual(scoutRuntimeChanged, [], 'existing Scout runtime files must remain unchanged');
});

test('no forbidden runtime provider/network patterns are introduced in runtime JS changes', () => {
  const runtimeChangedFiles = committedChangedFiles().filter((file) => {
    return file.startsWith('js/') ||
      file.startsWith('functions/') ||
      file.startsWith('pages/') ||
      file.startsWith('css/');
  });
  const forbidden = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'openai',
    'anthropic',
    'gemini',
    'process.env',
    'LLM_API_KEY',
    'SCOUT_SUGGEST_PROVIDER_MODE',
    'LIVE_ADAPTER_ENABLED',
    'provider.fetch',
    'stream',
    'retry',
    'timeout',
    'model',
  ];

  for (const file of runtimeChangedFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!source.includes(token), `${file} must not contain forbidden runtime token: ${token}`);
    }
  }
});
