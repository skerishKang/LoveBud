'use strict';

// #4546 — PR guardrails enforced in pull-request CI.
//
// Scope: source, workflow, and test only. This contract never contacts a network,
// database, browser, deployment target, or Production, and never reads or writes
// repository history. Git is exercised only through an injected fake runner.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const GUARD_REL = 'scripts/check-pr-guardrails.cjs';
const WORKFLOW_REL = '.github/workflows/pr-fast-gate.yml';
const GOVERNANCE_REL = 'docs/ops/MVP_AGENT_GOVERNANCE.md';
const REGISTRY_REL = 'tests/ci-test-group-registry.json';

const guard = require(path.join(ROOT, GUARD_REL));

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');
}

function writeTempFixture(contents, extension) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-guardrails-4546-'));
  const file = path.join(dir, `event${extension || '.json'}`);
  fs.writeFileSync(file, contents, 'utf8');
  return { dir, file };
}

function stepBlock(workflowText, stepName) {
  const lines = workflowText.split('\n');
  const start = lines.findIndex(line => line.trim() === `- name: ${stepName}`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {6}- name: /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function runLines(block) {
  return block
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('run:'))
    .map(line => line.slice('run:'.length).trim());
}

function derivedFrom(options) {
  return guard.loadProtectedIssueIds(options);
}

// ---------------------------------------------------------------------------
// A. Protected-Issue authority is derived from canonical governance
// ---------------------------------------------------------------------------

test('A1 canonical governance document is the declared authority source', () => {
  assert.equal(
    guard.CANONICAL_GOVERNANCE_PATH,
    GOVERNANCE_REL,
    'guard must name the canonical governance document as its authority source'
  );

  const governance = read(GOVERNANCE_REL);
  assert.match(
    governance,
    /Never close #1882; use `Refs #1882` only\./,
    'canonical governance must still carry the #1882 hard standing rule'
  );
});

test('A2 protected issue ids are derived from the current canonical document', () => {
  const ids = derivedFrom();
  assert.deepEqual(ids, [1882], 'derived protected set must be exactly [1882]');
  assert.ok(
    ids.includes(1882),
    '#1882 must be derived as protected from the canonical governance document'
  );
});

test('A3 derivation does not invent unrelated protected issues', () => {
  const ids = derivedFrom();
  for (const unrelated of [999, 1234, 3461, 4545, 4546]) {
    assert.ok(
      !ids.includes(unrelated),
      `unrelated issue #${unrelated} must not be invented as protected`
    );
  }
});

test('A4 advisory "Keep OPEN" phrasings are not protected authority', () => {
  // Advisory footer phrasings such as "Refs #1882 — Keep OPEN." must never grant
  // protected status; only the canonical `Never close #<number>` rule does.
  assert.throws(
    () => derivedFrom({ governanceText: 'Refs #1882 — Keep OPEN.\n' }),
    /no "Never close #<number>" rule/,
    'advisory Keep OPEN phrasing must not become protected authority'
  );
  assert.deepEqual(
    derivedFrom({ governanceText: '8. Never close #1882; use `Refs #1882` only.' }),
    [1882],
    'canonical rule form must still parse'
  );
});

test('A5 missing or unparseable canonical authority fails closed', () => {
  assert.throws(
    () => derivedFrom({ governancePath: path.join(ROOT, 'docs', 'ops', '__no_such_governance__.md') }),
    /could not be read/,
    'missing canonical authority document must fail closed'
  );
  assert.throws(
    () => derivedFrom({ governanceText: '   ' }),
    /empty or unreadable/,
    'empty canonical authority document must fail closed'
  );

  const result = guard.checkGuardrails(['docs/x.md'], 'Refs #1882', false, {
    governancePath: path.join(ROOT, 'docs', 'ops', '__no_such_governance__.md'),
  });
  assert.equal(result.status, 'FAIL', 'guard must FAIL when authority cannot be loaded');
  assert.ok(
    result.failures.some(f => /authority could not be loaded/.test(f)),
    'guard must report the fail-closed authority error'
  );
});

// ---------------------------------------------------------------------------
// B. Protected closing syntax fails
// ---------------------------------------------------------------------------

const PROTECTED_CLOSING_FAILURES = [
  'Closes #1882',
  'Close #1882',
  'Closed #1882',
  'Fixes #1882',
  'Fix #1882',
  'Fixed #1882',
  'Resolves #1882',
  'Resolve #1882',
  'Resolved #1882',
  'CLOSES #1882',
  'closed #1882',
  'FIXES #1882',
  'fix #1882',
  'FiXeD #1882',
  'RESOLVES #1882',
  'resolve #1882',
  'ReSoLvEd #1882',
  'Closes skerishKang/LoveBud#1882',
  'Closes https://github.com/skerishKang/LoveBud/issues/1882',
  'Summary line\n\nFixes https://github.com/skerishKang/LoveBud/issues/1882\n',
];

for (const body of PROTECTED_CLOSING_FAILURES) {
  test(`B protected closing directive fails: ${JSON.stringify(body).slice(0, 60)}`, () => {
    const result = guard.checkGuardrails(['docs/x.md'], body, false);
    assert.equal(result.status, 'FAIL', 'protected closing directive must fail');
    assert.ok(
      result.failures.some(f =>
        f.includes('Protected Issue #1882 cannot be closed from a PR body; use Refs #1882.')
      ),
      'failure must state the protected-Issue rule with bounded text'
    );
  });
}

test('B2 protected closing failure output never echoes the PR body', () => {
  const body = 'Closes #1882 super-secret-attacker-controlled-token-value';
  const result = guard.checkGuardrails(['docs/x.md'], body, false);
  assert.equal(result.status, 'FAIL');
  const joined = result.failures.join('\n');
  assert.ok(
    !joined.includes('super-secret-attacker-controlled-token-value'),
    'failure output must not echo user-controlled PR body text'
  );
});

test('B3 findProtectedClosingReferences reports only protected ids', () => {
  assert.deepEqual(guard.findProtectedClosingReferences('Closes #1882', [1882]), [1882]);
  assert.deepEqual(guard.findProtectedClosingReferences('Closes #4546', [1882]), []);
  assert.deepEqual(guard.findProtectedClosingReferences('Closes #1882', [999]), []);
});

// ---------------------------------------------------------------------------
// C. Ordinary issue closure is not globally banned
// ---------------------------------------------------------------------------

const ALLOWED_BODIES = [
  'Refs #1882',
  'refs #1882',
  'Refs #1882\nCloses #4546',
  'Refs #1882\n\nFixes #999',
  'Fixes #999',
  'Resolves #1234',
  'Closes #4546',
  'This change closes a parser gap. Refs #1882.',
  'This closes an implementation gap. Refs #1882.',
  'Refactors the close helper. Refs #1882.',
  'Fixes a typo in the fixed-width column docs. Refs #1882.',
];

for (const body of ALLOWED_BODIES) {
  test(`C allowed body passes: ${JSON.stringify(body).slice(0, 60)}`, () => {
    const result = guard.checkGuardrails(['docs/x.md'], body, false);
    assert.equal(
      result.status,
      'PASS',
      `allowed body must pass, got ${result.status} ${JSON.stringify(result.failures)}`
    );
  });
}

test('C2 generic close keyword warning is removed', () => {
  // The removed rule warned on any close/fix/resolve word anywhere in the body.
  const result = guard.checkGuardrails(
    ['docs/x.md'],
    'This closes a parser gap. Fixes the resolve ordering. Refs #1882.',
    false
  );
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.warnings, [], 'no generic close-keyword warning may remain');

  const source = read(GUARD_REL);
  assert.ok(
    !/CLOSE_KEYWORDS_REGEX/.test(source),
    'the generic close-keyword warning must be removed from the guard'
  );
});

// ---------------------------------------------------------------------------
// D. Markdown code examples are not closing directives
// ---------------------------------------------------------------------------

const MARKDOWN_CODE_ALLOWED = [
  'Do not use `Closes #1882`.',
  'Guardrail example: `Closes #1882` is rejected.',
  'Never write `Closes #1882` in a PR body.\n\nRefs #1882.',
  'Inline: `Fixes #1882` and `Resolves #1882` are both blocked.',
];

for (const body of MARKDOWN_CODE_ALLOWED) {
  test(`D inline code example passes: ${JSON.stringify(body).slice(0, 60)}`, () => {
    const result = guard.checkGuardrails(['docs/x.md'], body, false);
    assert.equal(
      result.status,
      'PASS',
      `inline code example must pass, got ${JSON.stringify(result.failures)}`
    );
  });
}

const MARKDOWN_FENCE_ALLOWED = [
  'Example:\n\n```\nCloses #1882\n```\n\nRefs #1882.',
  'Example:\n\n```text\nFixes #1882\nResolves #1882\n```\n',
  'Example:\n\n~~~\nCloses #1882\n~~~\n',
];

for (const body of MARKDOWN_FENCE_ALLOWED) {
  test(`D fenced code example passes: ${JSON.stringify(body).slice(0, 50)}`, () => {
    const result = guard.checkGuardrails(['docs/x.md'], body, false);
    assert.equal(
      result.status,
      'PASS',
      `fenced code example must pass, got ${JSON.stringify(result.failures)}`
    );
  });
}

test('D2 bare prose closing directive still fails after code stripping', () => {
  const body = 'Example block:\n\n```\nRefs #1882\n```\n\nCloses #1882';
  const result = guard.checkGuardrails(['docs/x.md'], body, false);
  assert.equal(result.status, 'FAIL', 'bare prose outside code must still fail');
});

test('D3 stripMarkdownCode removes fenced blocks and inline spans deterministically', () => {
  const stripped = guard.stripMarkdownCode('a `Closes #1882` b\n```\nCloses #1882\n```\nc');
  assert.ok(!stripped.includes('Closes #1882'), 'protected directive must be stripped');
  assert.equal(guard.stripMarkdownCode(''), '');
  assert.equal(guard.stripMarkdownCode(undefined), '');
  assert.equal(guard.stripMarkdownCode('Refs #1882'), 'Refs #1882');
});

// ---------------------------------------------------------------------------
// E. Existing path guard severities are preserved
// ---------------------------------------------------------------------------

test('E1 forbidden paths still FAIL', () => {
  const result = guard.checkGuardrails(['prototype/app.js'], '', false);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.failures.some(f => /Forbidden path detected/.test(f)));
});

test('E2 legacy paths remain WARN only', () => {
  for (const legacy of ['netlify/functions/api.js', 'netlify.toml', 'vercel.json', '_redirects']) {
    const result = guard.checkGuardrails([legacy], 'Refs #1882', false);
    assert.equal(result.status, 'WARN', `${legacy} must remain WARN`);
    assert.deepEqual(result.failures, [], `${legacy} must not fail`);
  }
});

test('E3 docs-only mode still rejects runtime paths', () => {
  const result = guard.checkGuardrails(['js/app.js'], 'Refs #1882', true);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.failures.some(f => /Runtime file changed in docs-only mode/.test(f)));
});

test('E4 clean docs-only change passes', () => {
  const result = guard.checkGuardrails(['docs/ops/example.md'], 'Refs #4546\nRefs #1882', true);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.failures, []);
});

// ---------------------------------------------------------------------------
// F. GitHub event ingestion fails closed
// ---------------------------------------------------------------------------

test('F1 synthetic pull_request event parses without shell interpolation', () => {
  const event = {
    pull_request: {
      number: 4546,
      base: { sha: 'a'.repeat(40) },
      head: { sha: 'b'.repeat(40) },
      body: 'Refs #4546\nRefs #1882',
    },
  };
  const { dir, file } = writeTempFixture(JSON.stringify(event), '.json');
  try {
    const parsed = guard.parseGithubEvent(file);
    assert.equal(parsed.baseSha, 'a'.repeat(40));
    assert.equal(parsed.headSha, 'b'.repeat(40));
    assert.equal(parsed.body, 'Refs #4546\nRefs #1882');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('F2 malformed or incomplete events fail closed', () => {
  const cases = [
    ['{ not json', /malformed/],
    [JSON.stringify({}), /pull_request/],
    [JSON.stringify({ pull_request: 'nope' }), /pull_request/],
    [JSON.stringify({ pull_request: { body: 'Refs #1882' } }), /base\.sha|head\.sha/],
    [JSON.stringify({ pull_request: { base: { sha: 'a' }, body: 'x' } }), /base\.sha|head\.sha/],
    [JSON.stringify({ pull_request: { base: { sha: '' }, head: { sha: 'b' } } }), /base\.sha|head\.sha/],
  ];

  for (const [contents, pattern] of cases) {
    const { dir, file } = writeTempFixture(contents, '.json');
    try {
      assert.throws(() => guard.parseGithubEvent(file), pattern);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  assert.throws(() => guard.parseGithubEvent(''), /event path is required/);
  assert.throws(
    () => guard.parseGithubEvent(path.join(ROOT, 'tests', '__no_such_event__.json')),
    /could not be read/
  );
});

test('F3 changed files are derived through argv-array git and fail closed', () => {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    if (args[0] === 'merge-base') return 'mergebasesha\n';
    return 'docs/a.md\0scripts/b.cjs\0';
  };

  const derived = guard.deriveChangedFiles('basesha', 'headsha', { runGit });
  assert.deepEqual(derived, { mergeBase: 'mergebasesha', files: ['docs/a.md', 'scripts/b.cjs'] });
  assert.deepEqual(calls[0], ['merge-base', 'basesha', 'headsha']);
  assert.deepEqual(calls[1], ['diff', '--name-only', '-z', 'mergebasesha', 'headsha']);
  for (const args of calls) {
    assert.ok(Array.isArray(args), 'git must be invoked with an argv array');
  }
});

test('F4 git merge-base and git diff failures fail closed', () => {
  assert.throws(
    () =>
      guard.deriveChangedFiles('a', 'b', {
        runGit: () => {
          throw new Error('merge-base failure');
        },
      }),
    /merge-base failed/
  );

  assert.throws(
    () =>
      guard.deriveChangedFiles('a', 'b', {
        runGit: (args) => {
          if (args[0] === 'merge-base') return 'mb\n';
          throw new Error('diff failure');
        },
      }),
    /git diff failed/
  );

  assert.throws(
    () => guard.deriveChangedFiles('a', 'b', { runGit: () => '   \n' }),
    /no merge base/
  );
});

test('F5 CLI parses the --github-event mode without a body flag', () => {
  const parsed = guard.parseArgs(['--github-event', '/tmp/event.json']);
  assert.equal(parsed.githubEventPath, '/tmp/event.json');
  assert.equal(parsed.docsOnlyMode, false);
  assert.deepEqual(parsed.files, []);

  const legacy = guard.parseArgs(['--files', 'docs/a.md, docs/b.md', '--body', 'Refs #1882', '--docs-only']);
  assert.deepEqual(legacy.files, ['docs/a.md', 'docs/b.md']);
  assert.equal(legacy.body, 'Refs #1882');
  assert.equal(legacy.docsOnlyMode, true);
  assert.equal(legacy.githubEventPath, null);
});

// ---------------------------------------------------------------------------
// G. PR Fast Gate wiring and workflow injection negative controls
// ---------------------------------------------------------------------------

test('G1 PR Fast Gate is the authoritative pull_request entrypoint', () => {
  const workflow = read(WORKFLOW_REL);
  assert.match(workflow, /^on:\s*$/m, 'workflow must declare an on: block');
  assert.match(workflow, /^ {2}pull_request:\s*$/m, 'workflow must trigger on pull_request');
});

test('G2 checkout uses fetch-depth 0 for merge-base resolution', () => {
  const block = stepBlock(read(WORKFLOW_REL), 'Checkout');
  assert.ok(block, 'Checkout step must exist');
  assert.match(block, /fetch-depth:\s*0/, 'checkout must use fetch-depth: 0');
});

test('G3 PR guardrails step invokes the guard through GITHUB_EVENT_PATH', () => {
  const block = stepBlock(read(WORKFLOW_REL), 'PR guardrails');
  assert.ok(block, 'PR guardrails step must exist');
  assert.match(
    block,
    /if:\s*github\.event_name\s*==\s*'pull_request'/,
    'guard step must be pull_request-only so workflow_dispatch skips it'
  );

  const runs = runLines(block);
  assert.equal(runs.length, 1, 'guard step must have exactly one run command');
  assert.match(runs[0], /npm run check:pr-guardrails/, 'guard step must run the guard script');
  assert.match(runs[0], /--github-event/, 'guard step must pass --github-event');
  assert.match(runs[0], /"\$GITHUB_EVENT_PATH"/, 'guard step must read GITHUB_EVENT_PATH');
});

test('G4 guard runs before dependency install for fail-fast', () => {
  const lines = read(WORKFLOW_REL)
    .split('\n')
    .map(line => line.trim());
  const guardIndex = lines.findIndex(line => line === '- name: PR guardrails');
  const installIndex = lines.findIndex(line => line === '- name: Install');
  assert.ok(guardIndex !== -1 && installIndex !== -1);
  assert.ok(
    guardIndex < installIndex,
    'guard step must precede npm ci so it fails fast without dependencies'
  );
});

test('G5 guardrail run command rejects dangerous user-controlled shell forms', () => {
  const runs = runLines(stepBlock(read(WORKFLOW_REL), 'PR guardrails'));
  for (const run of runs) {
    assert.ok(!run.includes('${{'), 'no GitHub expression may be interpolated into the guard command');
    assert.ok(
      !/github\.event\.pull_request\.(body|title)/.test(run),
      'PR body/title must never be interpolated into the guard command'
    );
    assert.ok(!/\beval\b/.test(run), 'guard command must not use eval');
    assert.ok(!/\b(sh|bash)\s+-c\b/.test(run), 'guard command must not use sh -c/bash -c');
    assert.ok(!/\|\s*(sh|bash)\b/.test(run), 'guard command must not pipe to a shell');
    assert.ok(!/--body\b/.test(run), 'guard command must not pass a body flag');
  }
});

test('G6 no workflow interpolates PR body or title into a run command', () => {
  const dir = path.join(ROOT, '.github', 'workflows');
  for (const name of fs.readdirSync(dir)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const text = read(path.join('.github', 'workflows', name));
    assert.ok(
      !/pull_request\.(body|title)/.test(text),
      `${name} must not reference pull_request.body or pull_request.title`
    );
  }
});

test('G7 guard source uses argv git and JSON file reads, never shell execution', () => {
  const source = read(GUARD_REL);

  assert.match(source, /execFileSync\(\s*'git'/, 'git must be invoked via execFileSync argv array');

  // `(?<![\w.$])` excludes RegExp/String method calls such as `ruleRegex.exec(...)`,
  // which are not child_process shell execution.
  for (const [call, message] of [
    ['exec', 'child_process.exec'],
    ['execSync', 'child_process.execSync'],
    ['spawn', 'child_process.spawn'],
    ['spawnSync', 'child_process.spawnSync'],
  ]) {
    const shellCall = new RegExp(`(?<![\\w.$])${call}\\s*\\(`);
    assert.ok(!shellCall.test(source), `${message} must not be used`);
  }

  assert.ok(!/\bfetch\s*\(/.test(source), 'no network fetch is allowed in the guard');
  assert.match(
    source,
    /require\(\s*['"]node:child_process['"]\s*\)/,
    'node:child_process must be imported for argv-array git'
  );
  assert.match(
    source,
    /const\s*\{\s*execFileSync\s*\}\s*=\s*require\(\s*['"]node:child_process['"]\s*\)/,
    'only execFileSync may be imported from node:child_process'
  );
  assert.ok(
    !/\{\s*exec\s*,/.test(source) && !/\{\s*exec\s*\}/.test(source),
    'child_process must not be destructured for shell execution'
  );

  assert.match(source, /fs\.readFileSync/, 'event JSON must be read from disk');
  assert.match(source, /JSON\.parse/, 'event JSON must be parsed with JSON.parse');

  for (const forbidden of [
    /require\(\s*['"]node:https?['"]\s*\)/,
    /require\(\s*['"]https?['"]\s*\)/,
    /api\.github\.com/,
    /\bcurl\b/,
    /\bgh\s+pr\b/,
    /XMLHttpRequest/,
  ]) {
    assert.ok(!forbidden.test(source), `guard must not contain ${forbidden}`);
  }
});

test('G8 guard module exports the testable helper surface and keeps the CLI entrypoint', () => {
  for (const name of [
    'checkGuardrails',
    'loadProtectedIssueIds',
    'findProtectedClosingReferences',
    'parseGithubEvent',
    'deriveChangedFiles',
    'stripMarkdownCode',
  ]) {
    assert.equal(typeof guard[name], 'function', `guard must export ${name}`);
  }
  assert.match(read(GUARD_REL), /if \(require\.main === module\)/, 'CLI entrypoint must remain guarded');
});

test('G9 registry no longer classifies the guard as manual/provider-only', () => {
  const registry = JSON.parse(read(REGISTRY_REL));
  const group = registry.groups.find(g => g.group === 'REMOTE_OR_PROVIDER_MANUAL');
  assert.ok(group, 'REMOTE_OR_PROVIDER_MANUAL group must still exist');
  assert.ok(
    !group.explicit_paths.includes(GUARD_REL),
    'the guard must not be classified as manual/provider-only now that PR CI runs it'
  );
  assert.ok(
    group.explicit_paths.length > 0,
    'the group must remain a non-empty inventory; no registry schema expansion is required'
  );
  assert.equal(
    registry.groups.length,
    8,
    'no new CI test group enum may be introduced for the guard'
  );
  assert.ok(
    !registry.group_enum.includes('PR_GOVERNANCE'),
    'no PR_GOVERNANCE group enum may be introduced'
  );
  assert.ok(!read(REGISTRY_REL).includes('scripts/check-pr-guardrails.cjs'));
});
