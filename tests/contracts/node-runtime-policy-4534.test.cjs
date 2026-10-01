'use strict';

/**
 * Contract test for the LoveBud Node runtime policy (Issue #4534).
 *
 * Validates the machine-readable policy (config/node-runtime-policy.json), the
 * fail-closed guard (scripts/check-node-runtime-policy.cjs), the human-readable
 * policy document, and the CI consumption path (npm run verify +
 * package.json check:node-runtime + the default npm test glob).
 *
 * Blocks:
 *   A. guard module surface and the real repository census;
 *   B. policy document shape, scopes, and source-bound exception reasons;
 *   C. drift detection on mutated workflow sources (fail-closed);
 *   D. end-to-end temp repository reads (policy, doc, reason sources, .nvmrc,
 *      package.json#engines, malformed policy);
 *   E. CI consumption and guard source hygiene;
 *   F. registry / classification reconciliation;
 *   G. uses-form coverage: quoted and comment-suffixed setup-node lines.
 *
 * Source-only: reads repository files and mutates only synthetic temp copies.
 * No network, provider, database, browser, git, or Production action. Refs #4534.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARD_REL = 'scripts/check-node-runtime-policy.cjs';
const GUARD_PATH = path.join(REPO_ROOT, GUARD_REL);
const POLICY_REL = 'config/node-runtime-policy.json';
const POLICY_PATH = path.join(REPO_ROOT, POLICY_REL);
const HUMAN_DOC_REL = 'docs/engineering/NODE_RUNTIME_POLICY.md';
const PACKAGE_PATH = path.join(REPO_ROOT, 'package.json');
const PRE_DEPLOY_REL = 'scripts/pre-deploy.cjs';
const CLASSIFICATION_REL = 'tests/test-layer-classification.json';
const GROUP_REGISTRY_REL = 'tests/ci-test-group-registry.json';
const THIS_CONTRACT_REL = 'tests/contracts/node-runtime-policy-4534.test.cjs';

const guard = require(GUARD_PATH);
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

function listWorkflowFiles() {
  return fs
    .readdirSync(path.join(REPO_ROOT, '.github', 'workflows'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => `.github/workflows/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));
}

const WORKFLOW_FILES = listWorkflowFiles();
const WORKFLOW_SOURCES = new Map(
  WORKFLOW_FILES.map((rel) => [rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);
const REGISTERED_WORKFLOWS = new Set(policy.workflow_occurrences.map((entry) => entry.workflow));

function realWorkflows() {
  return WORKFLOW_FILES.map((rel) => ({ workflow: rel, source: WORKFLOW_SOURCES.get(rel) }));
}

function withOverrides(overrides) {
  return realWorkflows().map((entry) =>
    overrides[entry.workflow] ? { workflow: entry.workflow, source: overrides[entry.workflow](entry.source) } : entry
  );
}

function evaluate(overrides, policyOverride) {
  return guard.evaluateNodeRuntimePolicy({
    repoRoot: REPO_ROOT,
    policy: policyOverride || policy,
    workflows: overrides ? withOverrides(overrides) : realWorkflows(),
  });
}

function clonePolicy() {
  return JSON.parse(JSON.stringify(policy));
}

function scopeById(id) {
  return policy.scopes.find((scope) => scope.id === id);
}

const REASON_SOURCE_PATHS = policy.scopes.flatMap((scope) =>
  (scope.reason_sources || []).map((source) => source.path)
);

function lf(source) {
  return source.replace(/\r\n/g, '\n');
}

// ── independent (non-guard) workflow lexer ─────────────────────────────────
// Tests 4 and 44 cross-check the guard with a deliberately different
// implementation: substring key detection plus a quote-aware scalar reader
// instead of the guard's anchored regexes, so both sides cannot share one
// parsing blind spot (for example quoted or comment-suffixed uses values).

function readScalar(raw) {
  let out = '';
  let quote = null;
  for (let index = 0; index < raw.length; index += 1) {
    const ch = raw[index];
    if (quote) {
      if (ch === quote) quote = null;
      else out += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    // A '#' only opens a comment when preceded by whitespace, matching YAML.
    if (ch === '#' && (index === 0 || /\s/.test(raw[index - 1]))) break;
    out += ch;
  }
  return out.trim();
}

function indentationOf(line) {
  return /^[ \t]*/.exec(line)[0].length;
}

function readUsesToken(line) {
  const marker = 'uses:';
  const index = line.indexOf(marker);
  if (index === -1) return null;
  const prefix = line.slice(0, index).trim();
  if (prefix !== '' && prefix !== '-') return null;
  return readScalar(line.slice(index + marker.length)).split(/\s+/)[0] || '';
}

function readSetupNodeVersionFrom(lines, startIndex) {
  const usesIndent = indentationOf(lines[startIndex]);
  for (let cursor = startIndex + 1; cursor < Math.min(lines.length, startIndex + 12); cursor += 1) {
    const candidate = readScalar(lines[cursor]);
    if (candidate === '') continue;
    const indent = indentationOf(lines[cursor]);
    if (indent < usesIndent) break; // dedented to a sibling key: the step ended
    if (candidate.startsWith('- ') && indent <= usesIndent) break; // next step
    if (candidate.startsWith('node-version:')) {
      return readScalar(candidate.slice('node-version:'.length));
    }
  }
  return null;
}

function independentCensus(sources) {
  const perWorkflow = new Map();
  const versions = [];
  for (const [rel, source] of sources) {
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const ref = readUsesToken(lines[index]);
      if (!ref) continue;
      // `actions/setup-node-fork` and similar names are different actions.
      if (!/^actions\/setup-node(?:@|$)/.test(ref)) continue;
      perWorkflow.set(rel, (perWorkflow.get(rel) || 0) + 1);
      versions.push({ workflow: rel, line: index + 1, node_version: readSetupNodeVersionFrom(lines, index) });
    }
  }
  const total = [...perWorkflow.values()].reduce((sum, count) => sum + count, 0);
  return { perWorkflow, total, versions };
}

function copyInto(tmpDir, relativePath) {
  const target = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, relativePath), target);
}

// ── A. guard module surface and real repository census ────────────────────

test('1. guard exports the bounded surface used by CI and this contract', () => {
  for (const name of [
    'DECISION_ENUM',
    'POLICY_RELATIVE_PATH',
    'REPO_ROOT',
    'WORKFLOWS_RELATIVE_DIR',
    'checkNodeRuntimePolicy',
    'collectSetupNodeOccurrences',
    'evaluateNodeRuntimePolicy',
    'listWorkflowFiles',
    'normalizeVersion',
  ]) {
    assert.ok(name in guard, `missing export: ${name}`);
  }
  assert.deepEqual(guard.DECISION_ENUM, ['EXPLICIT_MULTI_VERSION_MATRIX', 'SINGLE_VERSION']);
  assert.equal(guard.POLICY_RELATIVE_PATH, POLICY_REL);
});

test('2. the committed policy and workflows pass the guard', () => {
  const result = guard.checkNodeRuntimePolicy({ repoRoot: REPO_ROOT });
  assert.deepEqual(result.codes, [], `unexpected guard problems: ${result.codes.join(',')}`);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'PASS');
  assert.equal(result.decision, 'EXPLICIT_MULTI_VERSION_MATRIX');
  assert.equal(result.default_node_version, '20');
  assert.equal(result.default_scope_id, 'DEFAULT_PRODUCT_CI');
});

test('3. every active setup-node occurrence is registered (workflow x version x count)', () => {
  const result = guard.checkNodeRuntimePolicy({ repoRoot: REPO_ROOT });
  const observed = new Map();
  for (const entry of result.occurrences) {
    const key = `${entry.workflow}::${entry.node_version}`;
    observed.set(key, (observed.get(key) || 0) + 1);
  }
  const registered = new Map();
  for (const entry of policy.workflow_occurrences) {
    registered.set(`${entry.workflow}::${guard.normalizeVersion(entry.node_version)}`, entry.count);
  }
  assert.deepEqual([...observed.keys()].sort(), [...registered.keys()].sort());
  for (const [key, count] of registered) {
    assert.equal(observed.get(key), count, `occurrence count drift for ${key}`);
  }
});

test('4. independent census matches the guard census (parser blind-spot check)', () => {
  const independent = independentCensus(WORKFLOW_SOURCES);
  assert.equal(
    independent.versions.length,
    independent.total,
    'every independently counted use must carry a version read'
  );
  for (const entry of independent.versions) {
    assert.ok(
      entry.node_version,
      `independent census could not read a node-version at ${entry.workflow}:${entry.line}`
    );
  }

  const guardCounts = new Map();
  const guardVersions = [];
  let guardTotal = 0;
  for (const [rel, source] of WORKFLOW_SOURCES) {
    const scanned = guard.collectSetupNodeOccurrences(source, rel);
    assert.deepEqual(scanned.problems, [], `guard reported problems for ${rel}`);
    guardTotal += scanned.occurrences.length;
    if (scanned.occurrences.length > 0) guardCounts.set(rel, scanned.occurrences.length);
    for (const occurrence of scanned.occurrences) {
      guardVersions.push({ workflow: occurrence.workflow, node_version: occurrence.node_version });
    }
  }

  assert.equal(guardTotal, independent.total, 'guard and independent census must agree on the total');
  assert.equal(independent.total, 20, `expected 20 active actions/setup-node steps, found ${independent.total}`);
  assert.equal(guardCounts.size, 5, `expected 5 workflows with setup-node, found ${guardCounts.size}`);
  assert.deepEqual(
    [...independent.perWorkflow.entries()].sort(),
    [...guardCounts.entries()].sort(),
    'per-workflow counts must agree between the independent lexer and the guard'
  );
  const byWorkflowThenVersion = (a, b) =>
    a.workflow === b.workflow ? a.node_version.localeCompare(b.node_version) : a.workflow.localeCompare(b.workflow);
  assert.deepEqual(
    independent.versions
      .map((entry) => ({ workflow: entry.workflow, node_version: entry.node_version }))
      .sort(byWorkflowThenVersion),
    guardVersions.sort(byWorkflowThenVersion),
    'the independent lexer must read the same workflow/version pairs as the guard'
  );
  assert.deepEqual(
    [...guardCounts.keys()].sort(),
    [...REGISTERED_WORKFLOWS].sort(),
    'the set of workflows with setup-node steps must equal the registered set'
  );
});

test('5. the only non-default runtime is the registered Reliability Preview exception', () => {
  const defaultVersion = guard.normalizeVersion(policy.default_node_version);
  const exceptions = policy.workflow_occurrences.filter(
    (entry) => guard.normalizeVersion(entry.node_version) !== defaultVersion
  );
  assert.equal(exceptions.length, 1, 'exactly one scoped runtime exception is expected');
  assert.equal(exceptions[0].workflow, '.github/workflows/reliability-preview.yml');
  assert.equal(exceptions[0].node_version, '22.13.0');
  assert.equal(exceptions[0].scope_id, 'RELIABILITY_PREVIEW_REHEARSAL');

  const census = guard.checkNodeRuntimePolicy({ repoRoot: REPO_ROOT });
  const exceptionOccurrences = census.occurrences.filter((entry) => entry.node_version !== defaultVersion);
  assert.deepEqual(
    [...new Set(exceptionOccurrences.map((entry) => entry.workflow))],
    ['.github/workflows/reliability-preview.yml']
  );
  assert.equal(exceptionOccurrences.length, 1, 'exactly one non-default setup-node step is expected');
  assert.match(WORKFLOW_SOURCES.get('.github/workflows/reliability-preview.yml'), /node-version: 22\.13\.0/);
});

test('6. no workflow uses node-version-file or an expression for the runtime', () => {
  for (const [rel, source] of WORKFLOW_SOURCES) {
    assert.doesNotMatch(source, /node-version-file:/, `${rel} must not use node-version-file`);
    assert.doesNotMatch(source, /node-version:\s*\$\{\{/, `${rel} must not use a dynamic node-version`);
  }
});

// ── B. policy document shape, scopes, source-bound reasons ────────────────

test('7. policy declares the explicit multi-version decision and a default scope', () => {
  assert.equal(policy.schema_version, '1.0.0');
  assert.equal(policy.decision, 'EXPLICIT_MULTI_VERSION_MATRIX');
  assert.equal(policy.default_scope_id, 'DEFAULT_PRODUCT_CI');
  assert.equal(policy.default_node_version, '20');
  assert.deepEqual(policy.scopes.map((scope) => scope.id), [
    'DEFAULT_PRODUCT_CI',
    'RELIABILITY_PREVIEW_REHEARSAL',
  ]);
  assert.equal(scopeById(policy.default_scope_id).node_version, policy.default_node_version);
  assert.ok(Array.isArray(policy.drift_rules) && policy.drift_rules.length >= 4, 'drift_rules must be documented');
  assert.ok(
    Array.isArray(policy.change_procedure) && policy.change_procedure.length >= 2,
    'change_procedure must be documented'
  );
});

test('8. every scope states a surface, a reason, and at least one reason source', () => {
  for (const scope of policy.scopes) {
    assert.ok(scope.surface && scope.surface.trim().length > 20, `scope ${scope.id} needs a surface`);
    assert.ok(scope.reason && scope.reason.trim().length > 20, `scope ${scope.id} needs a reason`);
    assert.ok(Array.isArray(scope.reason_sources) && scope.reason_sources.length >= 1);
  }
});

test('9. exception reasons are source-bound (files exist and keep their token)', () => {
  for (const scope of policy.scopes) {
    for (const source of scope.reason_sources) {
      const sourcePath = path.join(REPO_ROOT, source.path);
      assert.ok(fs.existsSync(sourcePath), `reason source missing: ${source.path}`);
      const content = fs.readFileSync(sourcePath, 'utf8');
      assert.ok(
        content.includes(source.required_token),
        `reason source ${source.path} no longer contains its required token`
      );
    }
  }
});

test('10. the Reliability Preview exception is bound to node:sqlite / DatabaseSync', () => {
  const scope = scopeById('RELIABILITY_PREVIEW_REHEARSAL');
  assert.equal(scope.node_version, '22.13.0');
  assert.match(scope.reason, /node:sqlite/);
  const rehearsal = fs.readFileSync(
    path.join(REPO_ROOT, 'tests', 'reliability-preview', '4082-nonprod-rehearsal.test.cjs'),
    'utf8'
  );
  assert.match(rehearsal, /require\('node:sqlite'\)/);
  assert.match(rehearsal, /DatabaseSync/);
  assert.deepEqual(scope.reason_sources.map((source) => source.path), [
    'tests/reliability-preview/4082-nonprod-rehearsal.test.cjs',
  ]);
  assert.doesNotMatch(scope.surface, /production|provider|cloudflare/i);
});

test('11. the default runtime reason cites the Node 20 merge gate', () => {
  const scope = scopeById('DEFAULT_PRODUCT_CI');
  const source = scope.reason_sources[0];
  const content = fs.readFileSync(path.join(REPO_ROOT, source.path), 'utf8');
  assert.match(content, /Node 20 GitHub Actions CI remains the merge gate/);
  assert.match(scope.reason_sources[0].required_token, /merge gate/);
  assert.match(scope.surface, /GitHub Actions/);
  assert.match(scope.surface, /DB-engine/);
  assert.match(scope.surface, /contract/);
  // The surface text must not imply the Cloudflare deployed/build runtime is
  // pinned to Node 20; the repository-side scope is stated separately.
  assert.match(scope.surface, /repository-side/i);
  assert.doesNotMatch(
    scope.surface,
    /Cloudflare (?:Pages )?(?:deployed|build) runtime is (?:pinned|Node)/i
  );
  assert.match(policy.runtime_boundary_note, /Cloudflare/);
  assert.match(policy.runtime_boundary_note, /nodejs_compat/);
  assert.match(policy.runtime_boundary_note, /not a Node process-version pin/);
});

test('12. the human document exists and names every scope, version, and the decision', () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, HUMAN_DOC_REL), 'utf8');
  assert.match(doc, /EXPLICIT_MULTI_VERSION_MATRIX/);
  for (const scope of policy.scopes) {
    assert.ok(doc.includes(scope.id), `document must name scope ${scope.id}`);
    assert.ok(doc.includes(scope.node_version), `document must name version ${scope.node_version}`);
  }
  assert.match(doc, /node:sqlite/);
  assert.match(doc, /\.github\/workflows\/reliability-preview\.yml/);
  assert.match(doc, /금지/);
});

test('13. the policy forbids undeclared second runtime authorities', () => {
  const undeclared = policy.undeclared_version_sources.map((entry) => entry.path);
  assert.deepEqual(undeclared, ['.nvmrc', '.node-version', 'package.json#engines']);
  for (const entry of policy.undeclared_version_sources) {
    assert.equal(entry.must_be_absent, true, `${entry.path} must be flagged must_be_absent`);
  }
  assert.equal(fs.existsSync(path.join(REPO_ROOT, '.nvmrc')), false, '.nvmrc must stay absent');
  assert.equal(fs.existsSync(path.join(REPO_ROOT, '.node-version')), false, '.node-version must stay absent');
  assert.equal(
    Object.prototype.hasOwnProperty.call(packageJson, 'engines'),
    false,
    'package.json#engines must stay absent'
  );
});

test('14. every declared workflow occurrence resolves to an existing workflow file', () => {
  for (const entry of policy.workflow_occurrences) {
    assert.ok(WORKFLOW_FILES.includes(entry.workflow), `registered workflow missing: ${entry.workflow}`);
    assert.ok(Number.isInteger(entry.count) && entry.count >= 1, `bad count for ${entry.workflow}`);
    const scope = scopeById(entry.scope_id);
    assert.ok(scope, `unknown scope ${entry.scope_id}`);
    assert.equal(guard.normalizeVersion(entry.node_version), guard.normalizeVersion(scope.node_version));
  }
});

// ── C. drift detection on mutated workflow sources ────────────────────────

test('15. an unregistered workflow with setup-node fails closed', () => {
  const workflows = realWorkflows().concat([
    {
      workflow: '.github/workflows/synthetic-unregistered.yml',
      source: 'jobs:\n  x:\n    steps:\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 20\n',
    },
  ]);
  const result = guard.evaluateNodeRuntimePolicy({ repoRoot: REPO_ROOT, policy, workflows });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), result.codes.join(','));
});

test('16. a changed node-version fails closed with both drift codes', () => {
  const result = evaluate({
    '.github/workflows/ci.yml': (source) => lf(source).replace(/node-version: 20/, 'node-version: 22'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), result.codes.join(','));
  assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), result.codes.join(','));
  assert.ok(result.codes.includes('NODE_VERSION_NOT_DECLARED'), result.codes.join(','));
});

test('17. a removed setup-node step fails closed', () => {
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) => lf(source).replace(/^[ \t]*node-version: 20\n/m, ''),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('SETUP_NODE_WITHOUT_VERSION'), result.codes.join(','));
  assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), result.codes.join(','));
});

test('18. count drift in either direction fails closed', () => {
  const duplicated = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace(
        '      - name: Install\n',
        '      - uses: actions/setup-node@v7\n        with:\n          node-version: 20\n      - name: Install\n'
      ),
  });
  assert.equal(duplicated.ok, false);
  assert.ok(duplicated.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), duplicated.codes.join(','));

  const dropped = evaluate({
    '.github/workflows/ci.yml': (source) =>
      lf(source).replace(
        '      - name: Setup Node\n        uses: actions/setup-node@v7\n        with:\n          node-version: 20\n          cache: npm\n\n',
        ''
      ),
  });
  assert.equal(dropped.ok, false);
  assert.ok(dropped.codes.includes('REGISTERED_OCCURRENCE_MISSING'), dropped.codes.join(','));
});

test('19. node-version-file fails closed', () => {
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace('node-version: 20', 'node-version-file: .nvmrc'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('SETUP_NODE_VERSION_FILE_UNSUPPORTED'), result.codes.join(','));
});

test('20. a ${{ }} expression fails closed without echoing the raw value', () => {
  const unknownValue = 'AKIAIOSFODNN7EXAMPLE';
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace('node-version: 20', `node-version: \${{ secrets.${unknownValue} }}`),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('SETUP_NODE_VERSION_DYNAMIC_UNSUPPORTED'), result.codes.join(','));
  const echoed = JSON.stringify(result.problems);
  assert.ok(!echoed.includes(unknownValue), 'guard must not echo a dynamic node-version value');
});

test('21. an empty node-version fails closed', () => {
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace('node-version: 20', 'node-version:      '),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('SETUP_NODE_VERSION_EMPTY'), result.codes.join(','));
});

test('22. an unparseable node-version shape fails closed as unparsed', () => {
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace(
        '        with:\n          node-version: 20\n',
        '        with: { node-version: 20 }\n'
      ),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('SETUP_NODE_VERSION_UNPARSED'), result.codes.join(','));
});

test('23. quoted versions are accepted (normalization, not a version change)', () => {
  const result = evaluate({
    '.github/workflows/pr-fast-gate.yml': (source) =>
      lf(source).replace('node-version: 20', "node-version: '20'"),
  });
  assert.deepEqual(result.codes, [], `quoting a version must not be drift: ${result.codes.join(',')}`);
  assert.equal(result.ok, true);
  assert.equal(guard.normalizeVersion("'20'"), '20');
  assert.equal(guard.normalizeVersion('"22.13.0"'), '22.13.0');
});

test('24. CRLF workflow sources are parsed identically to LF', () => {
  const source = 'steps:\n  - uses: actions/setup-node@v7\n    with:\n      node-version: 20\n';
  const lf = guard.collectSetupNodeOccurrences(source, 'x.yml');
  const crlf = guard.collectSetupNodeOccurrences(source.replace(/\n/g, '\r\n'), 'x.yml');
  assert.equal(crlf.occurrences.length, 1);
  assert.equal(crlf.occurrences[0].node_version, '20');
  assert.deepEqual(crlf.problems, []);
  assert.equal(lf.occurrences.length, crlf.occurrences.length);
});

test('25. the scanner does not read a neighbouring step as the setup-node version', () => {
  const source = [
    'steps:',
    '  - name: Setup Node',
    '    uses: actions/setup-node@v7',
    '    with:',
    '      cache: npm',
    '  - name: Next',
    '    uses: actions/setup-node@v8',
    '    with:',
    '      node-version: 22.13.0',
    '',
  ].join('\n');
  const scanned = guard.collectSetupNodeOccurrences(source, 'x.yml');
  assert.equal(scanned.problems.length, 1);
  assert.equal(scanned.problems[0].code, 'SETUP_NODE_WITHOUT_VERSION');
  assert.equal(scanned.occurrences.length, 1);
  assert.equal(scanned.occurrences[0].node_version, '22.13.0');
});

test('26. a registration for a missing workflow fails closed', () => {
  const mutated = clonePolicy();
  mutated.workflow_occurrences.push({
    workflow: '.github/workflows/does-not-exist-4534.yml',
    node_version: '20',
    count: 1,
    scope_id: 'DEFAULT_PRODUCT_CI',
  });
  const result = evaluate(null, mutated);
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('REGISTERED_WORKFLOW_MISSING'), result.codes.join(','));
});

test('27. a registration with an unknown scope or mismatched version fails closed', () => {
  const unknownScope = clonePolicy();
  unknownScope.workflow_occurrences[0].scope_id = 'NOT_A_SCOPE';
  assert.ok(
    evaluate(null, unknownScope).codes.includes('REGISTRATION_SCOPE_UNKNOWN'),
    'unknown scope must fail closed'
  );

  const mismatched = clonePolicy();
  mismatched.workflow_occurrences[0].node_version = '22.13.0';
  assert.ok(
    evaluate(null, mismatched).codes.includes('REGISTRATION_VERSION_SCOPE_MISMATCH'),
    'scope/version mismatch must fail closed'
  );
});

test('28. an unreferenced scope and a duplicate scope id fail closed', () => {
  const unreferenced = clonePolicy();
  unreferenced.scopes.push({
    id: 'UNUSED_SCOPE',
    node_version: '24.1.0',
    surface: 'synthetic unreferenced scope for the drift contract',
    reason: 'synthetic reason that no workflow occurrence references',
    reason_sources: [{ path: POLICY_REL, required_token: 'schema_version' }],
  });
  const result = evaluate(null, unreferenced);
  assert.ok(result.codes.includes('SCOPE_UNREFERENCED'), result.codes.join(','));

  const duplicated = clonePolicy();
  duplicated.scopes.push(JSON.parse(JSON.stringify(duplicated.scopes[0])));
  assert.ok(evaluate(null, duplicated).codes.includes('POLICY_SCOPE_DUPLICATE'), 'duplicate scope id must fail');
});

test('29. an exception repeating the default version is rejected, not documented', () => {
  const mutated = clonePolicy();
  mutated.scopes.find((scope) => scope.id === 'RELIABILITY_PREVIEW_REHEARSAL').node_version = '20';
  const result = evaluate(null, mutated);
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('POLICY_SCOPE_NOT_DISTINCT'), result.codes.join(','));
});

test('30. default version, decision, and schema drift fail closed', () => {
  const defaultDrift = clonePolicy();
  defaultDrift.default_node_version = '22.13.0';
  assert.ok(
    evaluate(null, defaultDrift).codes.includes('POLICY_DEFAULT_VERSION_MISMATCH'),
    'default version drift must fail closed'
  );

  const decisionDrift = clonePolicy();
  decisionDrift.decision = 'ONE_NODE_EVERYWHERE';
  assert.ok(evaluate(null, decisionDrift).codes.includes('POLICY_DECISION_UNKNOWN'), 'unknown decision must fail');

  const malformed = clonePolicy();
  malformed.scopes = null;
  const result = evaluate(null, malformed);
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('POLICY_SCHEMA_INVALID'), result.codes.join(','));
  assert.equal(evaluate(null, []).ok, false);
});

test('31. a scope that loses its reason source or token fails closed', () => {
  const missingSource = clonePolicy();
  missingSource.scopes[1].reason_sources = [{ path: 'tests/reliability-preview/does-not-exist.cjs', required_token: 'x' }];
  assert.ok(
    evaluate(null, missingSource).codes.includes('SCOPE_REASON_SOURCE_MISSING'),
    'missing reason source must fail closed'
  );

  const missingToken = clonePolicy();
  missingToken.scopes[1].reason_sources[0].required_token = 'require(\'node:sqlite\')-missing-token';
  assert.ok(
    evaluate(null, missingToken).codes.includes('SCOPE_REASON_TOKEN_MISSING'),
    'missing reason token must fail closed'
  );

  const noSources = clonePolicy();
  noSources.scopes[1].reason_sources = [];
  assert.ok(
    evaluate(null, noSources).codes.includes('SCOPE_REASON_SOURCE_MISSING'),
    'a scope without reason sources must fail closed'
  );
});

test('32. a non-positive registration count fails closed', () => {
  const mutated = clonePolicy();
  mutated.workflow_occurrences[0].count = 0;
  assert.ok(evaluate(null, mutated).codes.includes('POLICY_SCHEMA_INVALID'), 'count 0 must fail closed');
});

// ── D. end-to-end temp repository reads ───────────────────────────────────

test('33. temp repository copy passes, then .nvmrc / .node-version / engines / drift / malformed policy fail', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-node-runtime-4534-'));
  try {
    for (const rel of [...WORKFLOW_FILES, POLICY_REL, HUMAN_DOC_REL, 'package.json', ...REASON_SOURCE_PATHS]) {
      copyInto(tmpDir, rel);
    }

    const pass = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
    assert.deepEqual(pass.codes, [], `temp repository must pass: ${pass.codes.join(',')}`);
    assert.equal(pass.occurrenceCount, 20);

    for (const versionFile of ['.nvmrc', '.node-version']) {
      const filePath = path.join(tmpDir, versionFile);
      fs.writeFileSync(filePath, '22\n');
      const undeclared = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
      assert.ok(
        undeclared.codes.includes('UNDECLARED_VERSION_SOURCE_PRESENT'),
        `${versionFile} must fail closed`
      );
      fs.rmSync(filePath);
    }

    const enginesPackage = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    enginesPackage.engines = { node: '>=20' };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(enginesPackage, null, 2));
    const engines = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
    assert.ok(engines.codes.includes('UNDECLARED_VERSION_SOURCE_PRESENT'), 'package.json#engines must fail closed');
    copyInto(tmpDir, 'package.json');

    fs.rmSync(path.join(tmpDir, HUMAN_DOC_REL));
    assert.ok(
      guard.checkNodeRuntimePolicy({ repoRoot: tmpDir }).codes.includes('HUMAN_DOC_MISSING'),
      'missing human document must fail closed'
    );
    copyInto(tmpDir, HUMAN_DOC_REL);

    const workflowPath = path.join(tmpDir, '.github', 'workflows', 'ci.yml');
    fs.writeFileSync(
      workflowPath,
      fs.readFileSync(workflowPath, 'utf8').replace(/node-version: 20/, 'node-version: 22')
    );
    const drift = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
    assert.ok(drift.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), drift.codes.join(','));
    assert.ok(drift.codes.includes('REGISTERED_OCCURRENCE_MISSING'), drift.codes.join(','));

    fs.writeFileSync(path.join(tmpDir, POLICY_REL), '{ not json');
    assert.deepEqual(guard.checkNodeRuntimePolicy({ repoRoot: tmpDir }).codes, ['POLICY_JSON_MALFORMED']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('34. a temp policy document whose text stops naming a scope fails closed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-node-runtime-doc-4534-'));
  try {
    for (const rel of [...WORKFLOW_FILES, POLICY_REL, HUMAN_DOC_REL, 'package.json', ...REASON_SOURCE_PATHS]) {
      copyInto(tmpDir, rel);
    }
    fs.writeFileSync(
      path.join(tmpDir, HUMAN_DOC_REL),
      'EXPLICIT_MULTI_VERSION_MATRIX\n20\n'
    );
    const result = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
    assert.equal(result.ok, false);
    assert.ok(result.codes.includes('HUMAN_DOC_TOKEN_MISSING'), result.codes.join(','));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('35. listing a missing workflow directory fails closed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-node-runtime-empty-4534-'));
  try {
    const listed = guard.listWorkflowFiles(tmpDir);
    assert.equal(listed.ok, false);
    assert.equal(listed.code, 'WORKFLOW_DIRECTORY_UNREADABLE');
    assert.deepEqual(listed.files, []);
    const result = guard.checkNodeRuntimePolicy({ repoRoot: tmpDir });
    assert.equal(result.ok, false);
    assert.ok(
      result.codes.includes('POLICY_FILE_UNREADABLE') ||
        result.codes.includes('WORKFLOW_DIRECTORY_UNREADABLE'),
      result.codes.join(',')
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('36. guard problems never contain secret-shaped or URL content', () => {
  const result = guard.checkNodeRuntimePolicy({ repoRoot: REPO_ROOT });
  const serialized = JSON.stringify(result.problems);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /Bearer\s/i);
  assert.doesNotMatch(serialized, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const output = result.occurrences.map((entry) => `${entry.workflow} ${entry.node_version}`).join('\n');
  assert.doesNotMatch(output, /password|api[_-]?key|token/i);
});

// ── E. CI consumption and guard source hygiene ────────────────────────────

test('37. package.json exposes the guard as check:node-runtime', () => {
  assert.equal(packageJson.scripts['check:node-runtime'], `node ${GUARD_REL}`);
  assert.match(packageJson.scripts.test, /tests\/contracts\/\*\.test\.cjs/);
});

test('38. npm run verify consumes the policy (pre-deploy wiring)', () => {
  const preDeploy = fs.readFileSync(path.join(REPO_ROOT, PRE_DEPLOY_REL), 'utf8');
  assert.match(preDeploy, /require\('\.\/check-node-runtime-policy\.cjs'\)/);
  assert.match(preDeploy, /guard\.checkNodeRuntimePolicy\(\{ repoRoot: ROOT \}\)/);
  assert.match(preDeploy, /verifyNodeRuntimePolicy\(\);/);
  assert.match(preDeploy, /node runtime policy drift/);
});

test('39. both CI entry workflows run the verify path that enforces the guard', () => {
  const ci = WORKFLOW_SOURCES.get('.github/workflows/ci.yml');
  const fastGate = WORKFLOW_SOURCES.get('.github/workflows/pr-fast-gate.yml');
  assert.match(ci, /- name: Verify\r?\n\s+run: npm run verify/);
  assert.match(fastGate, /- name: Verify\r?\n\s+run: npm run verify/);
  assert.match(ci, /actions\/setup-node@v7/);
  assert.match(fastGate, /actions\/setup-node@v7/);

  // No CI job runs the un-suffixed full `npm test` glob today, so the default-CI
  // contract layer is not the CI enforcement path for this policy. The guard is
  // enforced through `npm run verify` -> scripts/pre-deploy.cjs instead. If a
  // workflow ever starts running the full glob, revisit this assertion.
  const fullGlobRunners = [...WORKFLOW_SOURCES.entries()]
    .filter(([, source]) => /run: npm test\b/.test(source))
    .map(([rel]) => rel);
  assert.deepEqual(fullGlobRunners, [], 'unexpected workflow running the full npm test glob');

  const preDeploy = fs.readFileSync(path.join(REPO_ROOT, PRE_DEPLOY_REL), 'utf8');
  assert.match(preDeploy, /verifyNodeRuntimePolicy\(\);\r?\n\s+await verifyFull\(\);/);
});

test('40. the guard is source-only (no execution, network, or write authority)', () => {
  const source = fs.readFileSync(GUARD_PATH, 'utf8');
  for (const pattern of [
    /require\(\s*['"]node:child_process['"]\s*\)/,
    /\bexecSync\b/,
    /\bspawnSync\b/,
    /(?<![\w.$])spawn\s*\(/,
    /(?<![\w.$])fetch\s*\(/,
    /require\(\s*['"]node:https?['"]\s*\)/,
    /\bcurl\b/,
    /\bgh\s+api\b/,
    /api\.github\.com/i,
    /require\(\s*['"]pg['"]\s*\)/,
    /require\(\s*['"]playwright['"]\s*\)/,
    /\bwriteFileSync\s*\(/,
    /\brmSync\s*\(/,
  ]) {
    assert.ok(!pattern.test(source), `guard must not contain ${pattern}`);
  }
  assert.match(source, /if \(require\.main === module\)/);
});

test('41. the guard CLI entry is excluded from the manual/provider group', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, GROUP_REGISTRY_REL), 'utf8'));
  const manual = registry.groups.find((group) => group.group === 'REMOTE_OR_PROVIDER_MANUAL');
  assert.ok(manual, 'REMOTE_OR_PROVIDER_MANUAL group missing');
  assert.ok(
    !(manual.explicit_paths || []).includes(GUARD_REL),
    'the guard is an active default-CI command and must not be registered as manual'
  );
  for (const path of manual.explicit_paths || []) {
    assert.ok(!path.startsWith('/') && !path.includes('..'), `manual registry path must be repo-relative: ${path}`);
  }
});

// ── F. registry / classification reconciliation ────────────────────────────

test('42. this contract is classified in the layer manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CLASSIFICATION_REL), 'utf8'));
  const entry = manifest.entries.find((candidate) => candidate.path === THIS_CONTRACT_REL);
  assert.ok(entry, `${THIS_CONTRACT_REL} must be classified`);
  assert.ok(['SOURCE_STATIC', 'EXECUTED_FAKE'].includes(entry.layer), `unexpected layer: ${entry.layer}`);
  assert.ok(entry.rationale && entry.rationale.trim().length > 0, 'rationale must not be empty');
  assert.ok(Array.isArray(entry.capabilities), 'capabilities must be an array');
});

test('43. this contract is reachable from the default-CI globs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CLASSIFICATION_REL), 'utf8'));
  assert.deepEqual(manifest.defaultCiGlobs, [
    'tests/smoke/*.test.cjs',
    'tests/routes/*.test.cjs',
    'tests/contracts/*.test.cjs',
  ]);
  assert.ok(THIS_CONTRACT_REL.startsWith('tests/contracts/'));
});

// ── G. uses-form coverage: quoted and comment-suffixed setup-node lines ───

test('44. supported uses forms (quoted and comment-suffixed) are counted, not skipped', () => {
  const single = "'";
  const source = [
    'jobs:',
    '  forms:',
    '    steps:',
    '      - uses: actions/setup-node@v7',
    '        with:',
    '          node-version: 20',
    '      - uses: "actions/setup-node@v7"',
    '        with:',
    '          node-version: 20',
    `      - uses: ${single}actions/setup-node@v7${single}`,
    '        with:',
    '          node-version: 20',
    '      - uses: actions/setup-node@v7 # pinned by the runtime policy',
    '        with:',
    '          node-version: 20',
    '      - uses: "actions/setup-node@v7" # pinned by the runtime policy',
    '        with:',
    '          node-version: 20',
    '',
  ].join('\n');
  const scanned = guard.collectSetupNodeOccurrences(source, 'synthetic-forms.yml');
  assert.deepEqual(scanned.problems, [], `supported forms must not fail: ${JSON.stringify(scanned.problems)}`);
  assert.equal(scanned.occurrences.length, 5, 'every supported uses form must be counted as an occurrence');
  for (const occurrence of scanned.occurrences) {
    assert.equal(occurrence.node_version, '20');
  }
  const independent = independentCensus(new Map([['synthetic-forms.yml', source]]));
  assert.equal(independent.total, 5, 'the independent lexer must agree on the supported forms');
  assert.deepEqual(independent.versions.map((entry) => entry.node_version), ['20', '20', '20', '20', '20']);
});

test('45. a double-quoted setup-node uses with Node 24 drifts and fails closed', () => {
  const rel = '.github/workflows/pr-fast-gate.yml';
  const result = evaluate({
    [rel]: (source) =>
      lf(source)
        .replace('uses: actions/setup-node@v7', 'uses: "actions/setup-node@v7"')
        .replace('node-version: 20', 'node-version: 24'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), result.codes.join(','));
  assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), result.codes.join(','));
  assert.ok(result.codes.includes('NODE_VERSION_NOT_DECLARED'), result.codes.join(','));
  const occurrence = result.occurrences.find((entry) => entry.workflow === rel);
  assert.equal(
    occurrence && occurrence.node_version,
    '24',
    'a double-quoted uses line must be read as an occurrence, not skipped'
  );
});

test('46. a single-quoted setup-node uses with Node 24 drifts and fails closed', () => {
  const rel = '.github/workflows/pr-fast-gate.yml';
  const single = "'";
  const result = evaluate({
    [rel]: (source) =>
      lf(source)
        .replace('uses: actions/setup-node@v7', `uses: ${single}actions/setup-node@v7${single}`)
        .replace('node-version: 20', 'node-version: 24'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), result.codes.join(','));
  assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), result.codes.join(','));
  assert.ok(result.codes.includes('NODE_VERSION_NOT_DECLARED'), result.codes.join(','));
  const occurrence = result.occurrences.find((entry) => entry.workflow === rel);
  assert.equal(
    occurrence && occurrence.node_version,
    '24',
    'a single-quoted uses line must be read as an occurrence, not skipped'
  );
});

test('47. a comment-suffixed setup-node uses with Node 24 drifts and fails closed', () => {
  const rel = '.github/workflows/pr-fast-gate.yml';
  const result = evaluate({
    [rel]: (source) =>
      lf(source)
        .replace(
          'uses: actions/setup-node@v7',
          'uses: actions/setup-node@v7 # pinned by the runtime policy'
        )
        .replace('node-version: 20', 'node-version: 24'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.codes.includes('UNREGISTERED_WORKFLOW_OCCURRENCE'), result.codes.join(','));
  assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), result.codes.join(','));
  assert.ok(result.codes.includes('NODE_VERSION_NOT_DECLARED'), result.codes.join(','));
  const occurrence = result.occurrences.find((entry) => entry.workflow === rel);
  assert.equal(
    occurrence && occurrence.node_version,
    '24',
    'a comment-suffixed uses line must be read as an occurrence, not skipped'
  );
});

test('48. a setup-node uses line outside the supported grammar fails closed as unparsed', () => {
  const rel = '.github/workflows/pr-fast-gate.yml';
  const single = "'";
  const shapes = [
    ['unterminated double quote', 'uses: "actions/setup-node@v7'],
    ['unterminated single quote', `uses: ${single}actions/setup-node@v7`],
    ['extra tokens after the quoted value', 'uses: "actions/setup-node@v7" extra'],
  ];
  for (const [label, replacement] of shapes) {
    const result = evaluate({
      [rel]: (source) => lf(source).replace('uses: actions/setup-node@v7', replacement),
    });
    assert.equal(result.ok, false, `${label} must fail closed`);
    assert.ok(result.codes.includes('UNPARSED_SETUP_NODE_USE'), `${label}: ${result.codes.join(',')}`);
    // The hard fail must not depend on the registered-count drift alone.
    assert.ok(result.codes.includes('REGISTERED_OCCURRENCE_MISSING'), `${label}: ${result.codes.join(',')}`);
  }

  const marker = 'AKIAIOSFODNN7EXAMPLE';
  const scanned = guard.collectSetupNodeOccurrences(
    `steps:\n  - uses: "actions/setup-node@${marker}\n    with:\n      node-version: 20\n`,
    'synthetic-unparsed.yml'
  );
  assert.equal(scanned.occurrences.length, 0, 'an unparsed uses line must not be counted');
  assert.deepEqual(scanned.problems.map((problem) => problem.code), ['UNPARSED_SETUP_NODE_USE']);
  assert.ok(
    !JSON.stringify(scanned.problems).includes(marker),
    'the guard must not echo the raw unparsed uses value'
  );
});
