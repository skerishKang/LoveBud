'use strict';

// Workflow-aware test reachability guard (Issue #4450, Slice E).
// Evidence layer: SOURCE_STATIC.
//
// Problem this contract closes
// ---------------------------
// A `tests/**/*.test.cjs` file that no runner ever invokes is structurally
// invisible: it can rot, fail, or assert nothing, and no CI job will ever
// notice. Slice C closed one instance of this by MOVING a file into a
// default-CI glob directory. Slice E adds the general, fail-closed invariant:
//
//   every tests/**/*.test.cjs must be reachable from at least one
//   execution authority:
//     (a) a package-owned `node --test ...` command in package.json scripts, or
//     (b) a repository-owned `node --test ...` command in a GitHub Actions
//         workflow `run:` step.
//
// It deliberately does NOT change execution topology. `package.json`,
// `.github/workflows/**`, `tests/ci-test-group-registry.json` and `scripts/**`
// are read-only authority for this contract. The 18 tests outside the
// default-CI globs are already wired by existing `test:db-engine:*` scripts and
// by the moment-social / reliability-preview workflows; this contract only
// observes and enforces that, so nothing is double-registered.
//
// Parser scope
// ------------
// This is a minimal, fail-closed extractor for the repository-owned source
// shapes actually in use - not a general YAML or shell parser. Only real
// execution authority is collected:
//   * package.json script command bodies
//   * GitHub Actions `run:` step bodies
// Never collected, because they would be false positives:
//   * workflow `paths:` trigger filters (they name test paths but run nothing)
//   * step `name:` values
//   * shell `#` comments inside a run body
//   * quoted mentions such as `echo "node --test x.test.cjs"`
//   * prose in docs/
//
// Refs: #4450

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');

const SELF_PATH = 'tests/contracts/test-runner-reachability-contract.test.cjs';

const WORKFLOW_EXTENSIONS = ['.yml', '.yaml'];

// Shell tokens that may legally precede `node` when it starts a command.
const COMMAND_SEPARATORS = new Set(['&&', '||', ';', '|']);

// Files the default-CI globs cannot reach. They are NOT orphans: each one is
// wired by a package `test:db-engine:*` script or by a dedicated workflow.
// This list is a deliberate snapshot - if a new test appears outside the
// default-CI globs, this contract fails until it is consciously wired and
// listed here.
const EXPECTED_OUTSIDE_DEFAULT_CI = [
  'tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs',
  'tests/db-engine/fork-public-tree-visibility-concurrency-postgres.test.cjs',
  'tests/db-engine/generic-social-a-guard-postgres.test.cjs',
  'tests/db-engine/generic-social-a-postgres.test.cjs',
  'tests/db-engine/generic-social-b-guard-postgres.test.cjs',
  'tests/db-engine/generic-social-b-postgres.test.cjs',
  'tests/db-engine/memory-parent-cycle-concurrency-postgres.test.cjs',
  'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs',
  'tests/db-engine/moment-social-visibility-concurrency-postgres.test.cjs',
  'tests/db-engine/precondition-composition-root-postgres.test.cjs',
  'tests/db-engine/readonly-target-attribution-parity-postgres.test.cjs',
  'tests/db-engine/schema-orphan-structural-sentinel-postgres.test.cjs',
  'tests/db-engine/tree-comments-reconcile-postgres.test.cjs',
  'tests/db-engine/tree-social-visibility-concurrency-postgres.test.cjs',
  'tests/db-engine/trees-schema-foothold-postgres.test.cjs',
  'tests/reliability-preview/4082-nonprod-rehearsal.test.cjs',
  'tests/reliability-preview/4187-disabled-sentinel-pre-do-gate.test.cjs',
  'tests/reliability-preview/4225-provider-preview-choreography-contract.test.cjs',
];

const MOMENT_SOCIAL_WORKFLOW = '.github/workflows/moment-social-visibility-concurrency-3954.yml';
const RELIABILITY_WORKFLOW = '.github/workflows/reliability-preview.yml';
const MOMENT_SOCIAL_TEST = 'tests/db-engine/moment-social-visibility-concurrency-postgres.test.cjs';
const RELIABILITY_GLOB = 'tests/reliability-preview/*.test.cjs';
const CONTRACTS_GLOB = 'tests/contracts/*.test.cjs';

// ── inventory ─────────────────────────────────────────────────────────────

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listTestFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTestFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith('.test.cjs')) {
      out.push(toPosix(path.relative(ROOT, abs)));
    }
  }
  return out.sort();
}

function listWorkflowSources(dir) {
  const sources = {};
  for (const name of fs.readdirSync(dir).sort()) {
    if (!WORKFLOW_EXTENSIONS.some((ext) => name.endsWith(ext))) continue;
    sources[toPosix(path.join('.github', 'workflows', name))] = fs.readFileSync(
      path.join(dir, name),
      'utf8'
    );
  }
  return sources;
}

// ── minimal fail-closed parsers ───────────────────────────────────────────

function unquote(token) {
  if (token.length >= 2) {
    const first = token[0];
    if ((first === '\'' || first === '"') && token[token.length - 1] === first) {
      return token.slice(1, -1);
    }
  }
  return token;
}

// A `#` only opens a comment at the start of a shell word, and never inside
// quotes. Stripping comments is what keeps a commented-out runner from being
// counted as authority.
function stripShellComment(line) {
  let quote = null;
  let atWordStart = true;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      atWordStart = false;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      quote = ch;
      atWordStart = false;
      continue;
    }
    if (ch === '#' && atWordStart) return line.slice(0, i);
    atWordStart = ch === ' ' || ch === '\t';
  }
  return line;
}

// Extract the file/glob arguments of every `node --test ...` invocation in a
// shell command body. Returns [] when the body is not such an invocation.
function extractNodeTestTargets(commandBody) {
  const joined = String(commandBody).replace(/\\\r?\n/g, ' ');
  const targets = [];
  for (const rawLine of joined.split(/\r?\n/)) {
    const tokens = stripShellComment(rawLine).trim().split(/\s+/).filter(Boolean);
    for (let start = 0; start < tokens.length; start += 1) {
      // `node` must begin a command, and must be the bare word - a quoted
      // "node" inside echo is not an invocation.
      if (tokens[start] !== 'node') continue;
      if (start !== 0 && !COMMAND_SEPARATORS.has(tokens[start - 1])) continue;
      let sawTestFlag = false;
      const found = [];
      for (let i = start + 1; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token === '--test') {
          sawTestFlag = true;
          continue;
        }
        if (token.startsWith('-')) continue;
        const candidate = unquote(token);
        if (candidate.endsWith('.test.cjs')) found.push(candidate);
      }
      if (sawTestFlag) targets.push(...found);
    }
  }
  return targets;
}

// Collect the command bodies of every `run:` step in a workflow source.
// Only the `run:` key is execution authority; `paths:` filters, `name:`,
// `env:` and `with:` values are skipped by construction.
function collectWorkflowRunCommands(source) {
  const lines = String(source).split(/\r?\n/);
  const runKey = /^(\s*(?:-\s+)?)run:(\s*)(.*)$/;
  const commands = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = runKey.exec(lines[i]);
    if (!match) continue;
    const keyColumn = match[1].length;
    const inline = match[3].trim();
    if (inline !== '' && !/^[|>][-+]?\d*$/.test(inline)) {
      commands.push(inline);
      continue;
    }
    const folded = inline.startsWith('>');
    const block = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') {
        block.push('');
        continue;
      }
      const indent = line.length - line.replace(/^\s*/, '').length;
      if (indent <= keyColumn) break;
      block.push(line);
    }
    const indents = block
      .filter((line) => line.trim() !== '')
      .map((line) => line.length - line.replace(/^\s*/, '').length);
    const baseIndent = indents.length ? Math.min(...indents) : 0;
    const body = block.map((line) => line.slice(baseIndent)).join('\n');
    commands.push(folded ? body.replace(/\n/g, ' ') : body);
    i = j - 1;
  }
  return commands;
}

// ── matching ──────────────────────────────────────────────────────────────

function normalizeTarget(value) {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

// Supports the repository's canonical target vocabulary: exact paths and
// single-segment `dir/*.test.cjs` globs. `*` never crosses a `/`.
function targetToRegExp(target) {
  const value = normalizeTarget(target);
  let source = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '*') {
      if (value[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

// ── pure analysis ─────────────────────────────────────────────────────────

function collectAuthorities(packageJson, workflowSources) {
  const authorities = [];
  const scripts = (packageJson && packageJson.scripts) || {};
  for (const name of Object.keys(scripts).sort()) {
    for (const target of extractNodeTestTargets(scripts[name])) {
      authorities.push({
        kind: 'package-script',
        source: `package.json#scripts.${name}`,
        target: normalizeTarget(target),
      });
    }
  }
  for (const workflow of Object.keys(workflowSources).sort()) {
    for (const body of collectWorkflowRunCommands(workflowSources[workflow])) {
      for (const target of extractNodeTestTargets(body)) {
        authorities.push({ kind: 'workflow-run', source: workflow, target: normalizeTarget(target) });
      }
    }
  }
  return authorities;
}

function analyze(input) {
  const testFiles = [...input.testFiles].sort();
  const authorities = collectAuthorities(input.packageJson, input.workflowSources);
  const compiled = authorities.map((authority) => ({
    ...authority,
    matcher: targetToRegExp(authority.target),
  }));

  const wired = new Map();
  const notWired = [];
  for (const file of testFiles) {
    const hits = compiled
      .filter((authority) => authority.matcher.test(file))
      .map(({ kind, source, target }) => ({ kind, source, target }));
    if (hits.length) wired.set(file, hits);
    else notWired.push(file);
  }

  const defaultTargets = extractNodeTestTargets(
    ((input.packageJson.scripts || {}).test) || ''
  )
    .map(normalizeTarget)
    .map(targetToRegExp);
  const inDefault = (file) => defaultTargets.some((matcher) => matcher.test(file));

  return {
    testFiles,
    authorities,
    wired,
    notWired,
    defaultCi: testFiles.filter(inDefault),
    outsideDefault: testFiles.filter((file) => !inDefault(file)),
  };
}

const REAL_INPUTS = {
  testFiles: listTestFiles(TESTS_DIR),
  packageJson: JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')),
  workflowSources: listWorkflowSources(WORKFLOWS_DIR),
};

const REAL = analyze(REAL_INPUTS);

function describe(file) {
  return `\n  - ${file}`;
}

// ── inventory and default-CI partition ────────────────────────────────────

test('1. enumerates every tests/**/*.test.cjs recursively, without duplicates', () => {
  assert.equal(
    REAL.testFiles.length,
    899,
    `expected 899 tests/**/*.test.cjs files (898 at main plus this contract), found ${REAL.testFiles.length}`
  );
  assert.equal(
    new Set(REAL.testFiles).size,
    REAL.testFiles.length,
    'enumeration must not yield duplicate paths'
  );
  for (const file of REAL.testFiles) {
    assert.ok(file.endsWith('.test.cjs'), `only .test.cjs files may be enumerated: ${file}`);
    assert.ok(!file.startsWith('/'), `paths must be repository-relative: ${file}`);
  }
  assert.deepEqual(
    REAL.testFiles,
    [...REAL.testFiles].sort(),
    'enumeration must be deterministically sorted'
  );
});

test('2. the default-CI globs reach exactly the package-owned default layer', () => {
  const manifest = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const packageDefaultTargets = extractNodeTestTargets(REAL_INPUTS.packageJson.scripts.test).map(
    normalizeTarget
  );
  assert.deepEqual(
    packageDefaultTargets,
    manifest.defaultCiGlobs,
    'scripts.test targets must equal the manifest defaultCiGlobs, in order'
  );
  assert.equal(
    REAL.defaultCi.length,
    881,
    `expected 881 default-CI reachable files, found ${REAL.defaultCi.length}`
  );
  assert.equal(
    REAL.outsideDefault.length,
    18,
    `expected 18 files outside default-CI, found ${REAL.outsideDefault.length}`
  );
  assert.equal(
    REAL.defaultCi.length + REAL.outsideDefault.length,
    REAL.testFiles.length,
    'default-CI and outside-default partitions must cover the inventory exactly once'
  );
});

test('3. every enumerated test file is reachable from at least one execution authority', () => {
  assert.deepEqual(
    REAL.notWired,
    [],
    `every tests/**/*.test.cjs must be wired by a package or workflow node --test runner.`
      + ` Unreachable (${REAL.notWired.length}):${REAL.notWired.map(describe).join('')}`
  );
});

test('4. the outside-default-CI inventory is exactly the known script/workflow-owned set', () => {
  assert.deepEqual(
    REAL.outsideDefault,
    EXPECTED_OUTSIDE_DEFAULT_CI,
    'the set of tests outside the default-CI globs changed. Either wire the new file '
      + 'into a package script or a workflow run step, or update this deliberate snapshot.'
  );
});

test('5. no authority target is dangling', () => {
  for (const authority of REAL.authorities) {
    const matcher = targetToRegExp(authority.target);
    const matched = REAL.testFiles.filter((file) => matcher.test(file));
    assert.ok(
      matched.length > 0,
      `authority target matches no test file: ${authority.target} (from ${authority.source})`
    );
  }
});

// ── the two workflow-owned lanes ──────────────────────────────────────────

test('6. the moment-social DB test is reachable through its workflow-owned direct runner', () => {
  const hits = REAL.wired.get(MOMENT_SOCIAL_TEST);
  assert.ok(hits, `${MOMENT_SOCIAL_TEST} must be wired`);
  assert.ok(
    hits.some(
      (hit) =>
        hit.kind === 'workflow-run'
        && hit.source === MOMENT_SOCIAL_WORKFLOW
        && hit.target === MOMENT_SOCIAL_TEST
    ),
    `${MOMENT_SOCIAL_TEST} must be wired by ${MOMENT_SOCIAL_WORKFLOW} with an exact path target`
  );
  assert.equal(
    hits.some((hit) => hit.kind === 'package-script'),
    false,
    'this DB test is workflow-owned and must not be double-registered as a package script'
  );
});

test('7. the reliability-preview tests are reachable through the workflow-owned glob', () => {
  const expected = EXPECTED_OUTSIDE_DEFAULT_CI.filter((file) =>
    file.startsWith('tests/reliability-preview/')
  );
  assert.equal(expected.length, 3, 'the reliability-preview lane owns exactly three test files');
  for (const file of expected) {
    const hits = REAL.wired.get(file);
    assert.ok(hits, `${file} must be wired`);
    assert.ok(
      hits.some(
        (hit) =>
          hit.kind === 'workflow-run'
          && hit.source === RELIABILITY_WORKFLOW
          && hit.target === RELIABILITY_GLOB
      ),
      `${file} must be wired by ${RELIABILITY_WORKFLOW} via ${RELIABILITY_GLOB}`
    );
    assert.equal(
      hits.some((hit) => hit.kind === 'package-script'),
      false,
      `${file} must not be pulled into the default npm test layer`
    );
  }
});

test('8. every package-owned db-engine script targets one distinct existing test file', () => {
  const dbEngineAuthorities = REAL.authorities.filter(
    (authority) =>
      authority.kind === 'package-script' && authority.source.startsWith('package.json#scripts.test:db-engine:')
  );
  assert.equal(
    dbEngineAuthorities.length,
    14,
    `expected 14 package-owned db-engine runners, found ${dbEngineAuthorities.length}`
  );
  const targeted = new Set();
  for (const authority of dbEngineAuthorities) {
    const matcher = targetToRegExp(authority.target);
    const matched = REAL.testFiles.filter((file) => matcher.test(file));
    assert.equal(
      matched.length,
      1,
      `${authority.source} must target exactly one existing test file, matched ${matched.length}`
    );
    assert.equal(
      targeted.has(matched[0]),
      false,
      `${matched[0]} is targeted by more than one db-engine runner`
    );
    targeted.add(matched[0]);
  }
  assert.equal(targeted.size, 14, 'the 14 db-engine runners must cover 14 distinct files');
});

// ── determinism ───────────────────────────────────────────────────────────

test('9. analysis is deterministic and independent of input order', () => {
  const shuffled = {
    testFiles: [...REAL_INPUTS.testFiles].reverse(),
    packageJson: {
      ...REAL_INPUTS.packageJson,
      scripts: Object.fromEntries(Object.entries(REAL_INPUTS.packageJson.scripts).reverse()),
    },
    workflowSources: Object.fromEntries(Object.entries(REAL_INPUTS.workflowSources).reverse()),
  };
  const other = analyze(shuffled);
  assert.deepEqual(other.notWired, REAL.notWired);
  assert.deepEqual(other.outsideDefault, REAL.outsideDefault);
  assert.deepEqual([...other.wired.keys()], [...REAL.wired.keys()]);
  assert.deepEqual(
    other.authorities.map((authority) => `${authority.kind}|${authority.source}|${authority.target}`),
    REAL.authorities.map((authority) => `${authority.kind}|${authority.source}|${authority.target}`)
  );
});

// ── negative controls (in-memory source mutation only) ────────────────────

function withWorkflowSource(workflow, source, extraSources) {
  return {
    ...REAL_INPUTS,
    workflowSources: {
      ...REAL_INPUTS.workflowSources,
      ...extraSources,
      [workflow]: source,
    },
  };
}

function stripTarget(command, target) {
  return command
    .split(/\s+/)
    .filter((token) => token !== target)
    .join(' ');
}

const RUNNER_REMOVED = 'echo "runner removed in memory"';

test('NC1. removing the moment-social workflow direct runner un-wires that test', () => {
  assert.ok(REAL.wired.has(MOMENT_SOCIAL_TEST), 'precondition: wired on the real tree');
  const mutated = REAL_INPUTS.workflowSources[MOMENT_SOCIAL_WORKFLOW].replace(
    `node --test ${MOMENT_SOCIAL_TEST}`,
    RUNNER_REMOVED
  );
  assert.notEqual(
    mutated,
    REAL_INPUTS.workflowSources[MOMENT_SOCIAL_WORKFLOW],
    'precondition: the mutation must actually change the source'
  );
  const result = analyze(withWorkflowSource(MOMENT_SOCIAL_WORKFLOW, mutated));
  assert.equal(
    result.wired.has(MOMENT_SOCIAL_TEST),
    false,
    `${MOMENT_SOCIAL_TEST} must become NOT_WIRED once its only runner is removed`
  );
  assert.ok(result.notWired.includes(MOMENT_SOCIAL_TEST));
});

test('NC2. removing the reliability-preview workflow glob un-wires all three tests', () => {
  const expected = EXPECTED_OUTSIDE_DEFAULT_CI.filter((file) =>
    file.startsWith('tests/reliability-preview/')
  );
  for (const file of expected) {
    assert.ok(REAL.wired.has(file), `precondition: ${file} wired on the real tree`);
  }
  const mutated = REAL_INPUTS.workflowSources[RELIABILITY_WORKFLOW].replace(
    `node --test ${RELIABILITY_GLOB}`,
    RUNNER_REMOVED
  );
  assert.notEqual(
    mutated,
    REAL_INPUTS.workflowSources[RELIABILITY_WORKFLOW],
    'precondition: the mutation must actually change the source'
  );
  const result = analyze(withWorkflowSource(RELIABILITY_WORKFLOW, mutated));
  for (const file of expected) {
    assert.equal(result.wired.has(file), false, `${file} must become NOT_WIRED`);
    assert.ok(result.notWired.includes(file));
  }
});

test('NC3. removing the package contracts glob un-wires representative contracts', () => {
  const representative = 'tests/contracts/api-contract-transitional.test.cjs';
  assert.notEqual(
    representative,
    SELF_PATH,
    'the representative must not be this contract, so the assertion is not self-referential'
  );
  assert.ok(REAL.wired.has(representative), 'precondition: wired on the real tree');
  // Every package-owned script is execution authority (see collectAuthorities), so the
  // mutation must strip the glob from ALL of them - not just `test`. Stripping only
  // `scripts.test` leaves any second glob-bearing script (for example a serialized CI
  // variant) still wiring these files, and this negative control then silently stops
  // testing what it claims to test.
  const originalScripts = REAL_INPUTS.packageJson.scripts;
  assert.ok(
    Object.values(originalScripts).some(
      (command) => typeof command === 'string' && command.includes(CONTRACTS_GLOB)
    ),
    `precondition: at least one package script must carry ${CONTRACTS_GLOB}`
  );
  const mutatedScripts = {};
  for (const [name, command] of Object.entries(originalScripts)) {
    mutatedScripts[name] =
      typeof command === 'string' ? stripTarget(command, CONTRACTS_GLOB) : command;
  }
  assert.ok(
    Object.values(mutatedScripts).every(
      (command) => typeof command !== 'string' || !command.includes(CONTRACTS_GLOB)
    ),
    `precondition: the mutation must remove ${CONTRACTS_GLOB} from every package script`
  );
  const mutatedPackage = { ...REAL_INPUTS.packageJson, scripts: mutatedScripts };
  const result = analyze({ ...REAL_INPUTS, packageJson: mutatedPackage });
  assert.equal(
    result.wired.has(representative),
    false,
    `${representative} must become NOT_WIRED once ${CONTRACTS_GLOB} leaves every package script`
  );
  // Exactly the files that ONLY the contracts glob reached must lose reachability.
  const contractsGlobMatcher = targetToRegExp(CONTRACTS_GLOB);
  const expectedUnwired = REAL.testFiles
    .filter((file) => contractsGlobMatcher.test(file))
    .filter((file) => !REAL.wired.get(file).some((hit) => hit.target !== CONTRACTS_GLOB));
  assert.ok(
    expectedUnwired.length > 0,
    `precondition: ${CONTRACTS_GLOB} must be the sole authority for some files`
  );
  assert.deepEqual(
    result.notWired,
    expectedUnwired,
    `removing ${CONTRACTS_GLOB} must un-wire exactly the ${expectedUnwired.length} files that `
      + `depended solely on it, un-wired ${result.notWired.length}`
  );
});

test('NC4. removing a package db-engine runner un-wires that exact file', () => {
  const scriptName = 'test:db-engine:tree-comments';
  const target = 'tests/db-engine/tree-comments-reconcile-postgres.test.cjs';
  const original = REAL_INPUTS.packageJson.scripts[scriptName];
  assert.ok(
    typeof original === 'string' && original.includes(target),
    `precondition: ${scriptName} must target ${target}`
  );
  const mutatedPackage = {
    ...REAL_INPUTS.packageJson,
    scripts: {
      ...REAL_INPUTS.packageJson.scripts,
      [scriptName]: stripTarget(original, target),
    },
  };
  const result = analyze({ ...REAL_INPUTS, packageJson: mutatedPackage });
  assert.equal(
    result.wired.has(target),
    false,
    'a surviving script NAME (and the ci.yml `npm run` that calls it) must not count as '
      + 'execution authority - only a real `node --test <target>` command does'
  );
  assert.ok(result.notWired.includes(target));
});

test('NC5. paths:/name:/comment/quoted mentions are never execution authority', () => {
  // Break the real runner so the file is unwired...
  const mutated = REAL_INPUTS.workflowSources[MOMENT_SOCIAL_WORKFLOW].replace(
    `node --test ${MOMENT_SOCIAL_TEST}`,
    RUNNER_REMOVED
  );
  // ...then add a synthetic workflow that names the path in every
  // NON-authority position a naive scanner might pick up.
  const synthetic = [
    `name: node --test ${MOMENT_SOCIAL_TEST}`,
    'on:',
    '  pull_request:',
    '    paths:',
    `      - '${MOMENT_SOCIAL_TEST}'`,
    'jobs:',
    '  probe:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    `      - name: node --test ${MOMENT_SOCIAL_TEST}`,
    '        run: |',
    `          # node --test ${MOMENT_SOCIAL_TEST}`,
    `          echo "node --test ${MOMENT_SOCIAL_TEST}"`,
  ].join('\n');

  const result = analyze(
    withWorkflowSource(MOMENT_SOCIAL_WORKFLOW, mutated, {
      '.github/workflows/zz-in-memory-not-authority.yml': synthetic,
    })
  );

  assert.equal(
    result.wired.has(MOMENT_SOCIAL_TEST),
    false,
    'a `paths:` filter, a step `name:`, a shell comment or a quoted echo must never '
      + 'be mistaken for a runner'
  );
  assert.ok(result.notWired.includes(MOMENT_SOCIAL_TEST));
  assert.equal(
    result.authorities.some(
      (authority) => authority.source === '.github/workflows/zz-in-memory-not-authority.yml'
    ),
    false,
    'the synthetic non-authority workflow must contribute zero execution authority'
  );
});

test('NC6. an unsupported node invocation is not treated as a test runner', () => {
  const synthetic = [
    'name: probe',
    'on:',
    '  push:',
    'jobs:',
    '  probe:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: not a test runner',
    '        run: node scripts/lint-static.js',
    '      - name: no target',
    '        run: node --test',
    '      - name: shell separator still works',
    `        run: npm ci && node --test ${MOMENT_SOCIAL_TEST}`,
  ].join('\n');

  const result = analyze(
    withWorkflowSource(MOMENT_SOCIAL_WORKFLOW, RUNNER_REMOVED, {
      '.github/workflows/zz-in-memory-probe.yml': synthetic,
    })
  );

  assert.equal(
    result.wired.has(MOMENT_SOCIAL_TEST),
    true,
    '`npm ci && node --test <path>` must still be recognised as a runner'
  );
  assert.equal(
    result.authorities.some((authority) => authority.target === 'scripts/lint-static.js'),
    false,
    'a plain `node <script>` invocation is not a test runner'
  );
});

// ── CI fidelity ───────────────────────────────────────────────────────────

test('10. analysis is line-ending agnostic so it cannot pass locally and fail in CI', () => {
  // This worktree may be checked out with CRLF (core.autocrlf=true) while CI
  // runs on LF. The verdict must be identical either way.
  const toLf = (value) => String(value).replace(/\r\n/g, '\n');
  const toCrlf = (value) => toLf(value).replace(/\n/g, '\r\n');
  const build = (convert) => ({
    testFiles: REAL_INPUTS.testFiles,
    packageJson: JSON.parse(convert(fs.readFileSync(PACKAGE_PATH, 'utf8'))),
    workflowSources: Object.fromEntries(
      Object.entries(REAL_INPUTS.workflowSources).map(([name, source]) => [name, convert(source)])
    ),
  });

  const lf = analyze(build(toLf));
  const crlf = analyze(build(toCrlf));

  for (const [label, result] of [['LF', lf], ['CRLF', crlf]]) {
    assert.deepEqual(result.notWired, [], `${label}: every test must stay wired`);
    assert.deepEqual(result.outsideDefault, EXPECTED_OUTSIDE_DEFAULT_CI, `${label}: inventory drift`);
    assert.equal(
      result.authorities.length,
      REAL.authorities.length,
      `${label}: authority count must not depend on line endings`
    );
    assert.deepEqual(
      result.authorities.map((authority) => `${authority.source}|${authority.target}`),
      REAL.authorities.map((authority) => `${authority.source}|${authority.target}`),
      `${label}: authority set must not depend on line endings`
    );
  }
  assert.deepEqual(lf.notWired, crlf.notWired);
});

// ── self-registration ─────────────────────────────────────────────────────

test('11. this contract is registered SOURCE_STATIC with no side-effect imports', () => {
  const classification = JSON.parse(fs.readFileSync(CLASSIFICATION_PATH, 'utf8'));
  const entry = classification.entries.find((candidate) => candidate.path === SELF_PATH);
  assert.ok(entry, 'classification entry must exist for this contract test');
  assert.equal(entry.layer, 'SOURCE_STATIC');
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(
    source,
    /require\s*\(\s*['"](?:http|node:http|https|node:https|node:net|child_process|node:child_process|node:fs\/promises)['"]/
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(/);
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\bprocess\.env\b/);
});
