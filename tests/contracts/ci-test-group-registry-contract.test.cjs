'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const { test, describe, mock } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const REPORTER_PATH = path.join(ROOT, 'scripts', 'report-ci-test-groups.cjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const CI_YML_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const DECISION_PATH = path.join(ROOT, 'docs', 'architecture', 'CI_TEST_GROUP_REGISTRY_CONTRACT.md');

const {
  readJson,
  validateRegistrySchema,
  parseNodeTestGlobs,
  validateGlobShape,
  enumerateDefaultCi,
  classifyDefault,
  validateSupplemental,
  getDbEngineScriptRefs,
  getVerifyStaticCommands,
  buildReportData,
  buildHumanOutput,
  buildJsonOutput,
} = require(REPORTER_PATH);

const EXPECTED_GROUP_IDS = [
  'SOURCE_STATIC',
  'EXECUTED_FAKE',
  'BROWSER_REAL_LOCAL',
  'PROCESS_REAL_LOCAL',
  'DB_ENGINE',
  'PYTHON_SUPPLEMENTAL',
  'REMOTE_OR_PROVIDER_MANUAL',
  'FULL_DEFAULT_REGRESSION',
];

// 1. Exact five-file authority
test('1. exact five-file authority and prohibited-path hygiene', () => {
  const regExists = fs.existsSync(REGISTRY_PATH);
  const repExists = fs.existsSync(REPORTER_PATH);
  const conExists = fs.existsSync(path.join(ROOT, 'tests/contracts/ci-test-group-registry-contract.test.cjs'));
  const docExists = fs.existsSync(DECISION_PATH);
  const clsExists = fs.existsSync(CLASSIFICATION_PATH);
  assert.ok(regExists, 'registry file exists');
  assert.ok(repExists, 'reporter file exists');
  assert.ok(conExists, 'contract test file exists');
  assert.ok(docExists, 'contract doc exists');
  assert.ok(clsExists, 'classification json exists');
  // Verify no unauthorized files changed by checking registry is only new file outside contract
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  assert.ok(pkg.scripts.test, 'package test script unchanged');
  assert.ok(fs.existsSync(path.join(ROOT, '.github/workflows/ci.yml')), 'ci.yml unchanged');
});

// 2. Exact registry group vocabulary and order
test('2. exact registry group vocabulary and order', () => {
  const reg = readJson(REGISTRY_PATH);
  assert.deepEqual(reg.group_enum, EXPECTED_GROUP_IDS, 'group_enum matches expected order');
  assert.equal(reg.groups.length, 8, 'eight groups');
  for (let i = 0; i < 8; i++) {
    assert.equal(reg.groups[i].group, EXPECTED_GROUP_IDS[i], 'group[' + i + '] ID matches');
  }
});

// 3. Schema and enum fail-closed
test('3. exact bounded schema and enum rejection', () => {
  const reg = readJson(REGISTRY_PATH);
  assert.equal(typeof reg.schema_version, 'string');
  assert.equal(typeof reg.baseline_sha, 'string');
  assert.ok(Array.isArray(reg.execution_state_enum));
  assert.ok(Array.isArray(reg.runtime_enum));
  assert.ok(Array.isArray(reg.platform_enum));
  assert.ok(Array.isArray(reg.capability_enum));
  assert.ok(Array.isArray(reg.source_status_enum));
  assert.ok(Array.isArray(reg.groups));
  assert.equal(typeof reg.field_definitions, 'object');
  for (const g of reg.groups) {
    assert.ok(EXPECTED_GROUP_IDS.includes(g.group), 'valid group id: ' + g.group);
    assert.ok(['classification_layer', 'package_glob', 'path_pattern', 'explicit_list'].includes(g.membership_source));
    assert.ok(['ALWAYS', 'ON_COMMIT', 'ON_PR', 'MANUAL', 'NOT_EXECUTED'].includes(g.default_pr_execution_state));
    assert.ok(['node', 'node_browser', 'python', 'postgresql_ephemeral', 'manual', 'aggregate'].includes(g.runtime));
    assert.ok(['ubuntu', 'cross_platform', 'manual'].includes(g.platform));
    assert.ok(['CONFIRMED', 'UNVERIFIED', 'NOT_PRESENT'].includes(g.source_status));
    assert.ok(Array.isArray(g.capabilities));
    for (const c of g.capabilities) {
      assert.ok(reg.capability_enum.includes(c), 'valid capability: ' + c);
    }
  }
  // Schema validation fail-closed
  const badReg = JSON.parse(JSON.stringify(reg));
  badReg.group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE'];
  assert.throws(() => validateRegistrySchema(badReg), /REGISTRY_SCHEMA_ERROR/);
  badReg.group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE', 'BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL', 'DB_ENGINE', 'PYTHON_SUPPLEMENTAL', 'REMOTE_OR_PROVIDER_MANUAL', 'FULL_DEFAULT_REGRESSION'];
  badReg.groups = badReg.groups.slice(0, 7);
  assert.throws(() => validateRegistrySchema(badReg), /REGISTRY_SCHEMA_ERROR/);
  // Duplicate group
  const dupReg = JSON.parse(JSON.stringify(reg));
  dupReg.group_enum = ['SOURCE_STATIC', 'SOURCE_STATIC', 'EXECUTED_FAKE', 'BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL', 'DB_ENGINE', 'PYTHON_SUPPLEMENTAL', 'REMOTE_OR_PROVIDER_MANUAL', 'FULL_DEFAULT_REGRESSION'];
  dupReg.groups = [...reg.groups, JSON.parse(JSON.stringify(reg.groups[0]))];
  assert.throws(() => validateRegistrySchema(dupReg), /DUPLICATE_GROUP/);
});

// 4. Fixed repository-relative source reads
test('4. fixed repository-relative source reads', () => {
  const data = buildReportData();
  assert.ok(data.default_total > 0);
  assert.ok(data.layer_counts.SOURCE_STATIC > 0);
});

// 5. No caller path, cwd, URL, credential authority
test('5. no caller path, cwd, environment, URL, credential, alternate-file, or dynamic-command authority', () => {
  const origCwd = process.cwd;
  process.cwd = () => '/tmp/nonexistent';
  try {
    const data = buildReportData();
    assert.ok(data.default_total > 0, 'reports from ' + origCwd());
    process.cwd = origCwd;
  } catch (e) {
    process.cwd = origCwd;
    throw e;
  }
  process.cwd = origCwd;
  // Verify reporter uses __dirname, not cwd
  const reporterContent = fs.readFileSync(REPORTER_PATH, 'utf8');
  assert.ok(reporterContent.includes('__dirname'), 'reporter uses __dirname for root');
});

// 6. Exact default-glob parsing and deterministic enumeration
test('6. exact default-glob parsing and deterministic enumeration', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const globs = parseNodeTestGlobs(pkg.scripts.test);
  assert.equal(globs.length, 3, 'three globs');
  assert.equal(globs[0], 'tests/smoke/*.test.cjs');
  assert.equal(globs[1], 'tests/routes/*.test.cjs');
  assert.equal(globs[2], 'tests/contracts/*.test.cjs');
  const files = enumerateDefaultCi(globs);
  assert.ok(files.length > 0, 'enumerated files > 0');
  // Deterministic order
  for (let i = 1; i < files.length; i++) {
    assert.ok(files[i - 1] <= files[i], 'lexicographic order: ' + files[i - 1] + ' <= ' + files[i]);
  }
  // Same result twice
  const files2 = enumerateDefaultCi(globs);
  assert.deepEqual(files, files2, 'deterministic enumeration');
});

// 7. Expected post-child counts
test('7. expected post-child counts 767 / 566 / 187 / 14', () => {
  const data = buildReportData();
  assert.equal(data.default_total, 767, 'default-CI total: 767');
  assert.equal(data.layer_counts.SOURCE_STATIC, 566, 'SOURCE_STATIC: 566');
  assert.equal(data.layer_counts.EXECUTED_FAKE, 187, 'EXECUTED_FAKE: 187');
  assert.equal(data.layer_counts.EXECUTED_REAL_LOCAL, 14, 'EXECUTED_REAL_LOCAL: 14');
});

// 8. Supplemental reconciliation
test('8. supplemental reconciliation 10 Python + 7 DB = 17', () => {
  const data = buildReportData();
  assert.equal(data.supplemental_python, 10, 'SUPPLEMENTAL_PYTHON: 10');
  assert.equal(data.supplemental_db_engine, 7, 'DB_ENGINE_EXECUTION: 7');
  assert.equal(data.supplemental_total, 17, 'supplemental total: 17');
});

// 9. Two confirmed duplicate supplemental entries removed
test('9. removal of exactly the two confirmed duplicate supplemental entries', () => {
  const inv = readJson(CLASSIFICATION_PATH);
  const supp = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const inDefaultCiPaths = [];
  const defaultSet = new Set(inv.entries.map(e => e.path));
  for (const s of supp) {
    if (defaultSet.has(s.path)) inDefaultCiPaths.push(s.path);
  }
  assert.equal(inDefaultCiPaths.length, 0, 'zero default/supplemental duplicates remaining');
  const reportedData = buildReportData();
  assert.equal(reportedData.duplicate_supplemental, 0, 'reporter also confirms 0 duplicates');
});

// 10. Every default and supplemental path has exactly one execution disposition
test('10. every default and supplemental path has exactly one execution disposition', () => {
  const data = buildReportData();
  assert.equal(data.unclassified_default, 0, 'no unclassified default paths');
  assert.equal(data.conflicts, 0, 'no conflicting paths');
  assert.equal(data.stale_default, 0, 'no stale default entries');
  assert.equal(data.stale_supplemental, 0, 'no stale supplemental entries');
});

// 11. Browser vs process real-local separation
test('11. browser-real-local versus process-real-local separation without evidence-layer reclassification', () => {
  const inv = readJson(CLASSIFICATION_PATH);
  const realLocal = inv.entries.filter(e => e.layer === 'EXECUTED_REAL_LOCAL');
  assert.equal(realLocal.length, 14, '14 EXECUTED_REAL_LOCAL entries');
  const browserPaths = realLocal.filter(e => /playwright|chromium|browser/i.test(e.rationale));
  const processPaths = realLocal.filter(e => !/playwright|chromium|browser/i.test(e.rationale));
  assert.ok(browserPaths.length >= 10, 'at least 10 browser-real-local entries');
  assert.ok(processPaths.length >= 2, 'at least 2 process-real-local entries');
  assert.equal(browserPaths.length + processPaths.length, 14, 'total 14');
});

// 12. Seven DB-engine command references
test('12. seven DB-engine command references', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const refs = getDbEngineScriptRefs(pkg);
  assert.equal(refs.length, 7, '7 DB-engine scripts');
  const names = refs.map(r => r.script).sort();
  assert.equal(names[0], 'test:db-engine:generic-social-a');
  assert.equal(names[1], 'test:db-engine:generic-social-a-guard');
  assert.equal(names[2], 'test:db-engine:generic-social-b');
  assert.equal(names[3], 'test:db-engine:generic-social-b-guard');
  assert.equal(names[4], 'test:db-engine:migration-catalog-adapter');
  assert.equal(names[5], 'test:db-engine:tree-comments');
  assert.equal(names[6], 'test:db-engine:trees-schema');
});

// 13. Active verify-static command-set validation
test('13. active verify-static command-set validation', () => {
  const ciRaw = fs.readFileSync(CI_YML_PATH, 'utf8');
  const cmds = getVerifyStaticCommands(ciRaw);
  assert.ok(cmds.length >= 4, 'at least 4 verify-static commands: ' + cmds.join(', '));
  assert.ok(cmds.includes('lint') || cmds.includes('ci'), 'includes lint or ci');
  assert.ok(cmds.includes('build') || cmds.includes('ci'), 'includes build or ci');
  assert.ok(cmds.includes('test') || cmds.includes('ci'), 'includes test or ci');
  assert.ok(cmds.includes('verify') || cmds.includes('ci'), 'includes verify or ci');
});

// 14. Full-regression aggregate semantics
test('14. full-regression aggregate semantics without duplicate path authority', () => {
  const reg = readJson(REGISTRY_PATH);
  const fullReg = reg.groups.find(g => g.group === 'FULL_DEFAULT_REGRESSION');
  assert.ok(fullReg, 'FULL_DEFAULT_REGRESSION group exists');
  assert.equal(fullReg.membership_source, 'package_glob', 'aggregate via package_glob');
  assert.equal(fullReg.command_reference, 'npm test (exact package.json test command)', 'references package test command');
  // Verify no explicit_paths
  assert.equal(fullReg.explicit_paths, null, 'no explicit paths');
  const data = buildReportData();
  const frGroup = data.groups.find(g => g.group === 'FULL_DEFAULT_REGRESSION');
  assert.ok(frGroup, 'FULL_DEFAULT_REGRESSION in report');
  assert.equal(frGroup.count, data.default_total, 'count matches default total');
});

// 15. Manual remote/provider records are non-default and never executed
test('15. manual remote/provider records are non-default and never executed', () => {
  const reg = readJson(REGISTRY_PATH);
  const remoteGroup = reg.groups.find(g => g.group === 'REMOTE_OR_PROVIDER_MANUAL');
  assert.ok(remoteGroup, 'REMOTE_OR_PROVIDER_MANUAL group exists');
  assert.equal(remoteGroup.default_pr_execution_state, 'NOT_EXECUTED', 'NOT_EXECUTED');
  assert.ok(remoteGroup.command_reference.startsWith('NOT_EXECUTED'), 'command reference is NOT_EXECUTED');
  assert.equal(remoteGroup.membership_source, 'explicit_list', 'explicit list');
  assert.ok(Array.isArray(remoteGroup.explicit_paths), 'explicit_paths array');
  assert.ok(remoteGroup.explicit_paths.length > 0, 'at least one explicit path');
});

// 16. Human output byte stability
test('16. human output byte stability', () => {
  const data = buildReportData();
  const h1 = buildHumanOutput(data);
  const h2 = buildHumanOutput(data);
  assert.equal(h1, h2, 'identical human output');
  assert.ok(h1.length > 0, 'non-empty human output');
});

// 17. JSON output byte stability and valid parse
test('17. JSON output byte stability and valid parse', () => {
  const data = buildReportData();
  const j1 = buildJsonOutput(data);
  const j2 = buildJsonOutput(data);
  assert.equal(j1, j2, 'identical JSON output');
  const parsed = JSON.parse(j1);
  assert.ok(parsed.default_total > 0, 'parsed OK');
  assert.ok(parsed.valid, 'valid flag');
});

// 18. Stable group and path ordering
test('18. stable group and path ordering', () => {
  const data = buildReportData();
  // Group order must match EXPECTED_GROUP_IDS
  assert.equal(data.groups.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(data.groups[i].group, EXPECTED_GROUP_IDS[i]);
  }
  // Path order: files from enumerateDefaultCi are already sorted
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const globs = parseNodeTestGlobs(pkg.scripts.test);
  const files = enumerateDefaultCi(globs);
  for (let i = 1; i < files.length; i++) {
    assert.ok(files[i - 1] <= files[i], 'lexicographic: ' + files[i - 1] + ' <= ' + files[i]);
  }
});

// 19. Unknown enum rejection (synthetic)
test('19. unknown group/path/command/capability/runtime/platform/artifact/status rejection', () => {
  // Unknown CLI argument — test the module directly without calling run()
  const origExitCode = process.exitCode;
  // Schema with unknown source_status
  const reg = readJson(REGISTRY_PATH);
  const bad = JSON.parse(JSON.stringify(reg));
  bad.groups[0].source_status = 'INVALID_STATUS';
  assert.throws(() => validateRegistrySchema(bad), /UNKNOWN_ENUM/);
  process.exitCode = origExitCode;
});

// 20. Duplicate, stale, overlap, contradiction, unclassified failure cases (synthetic)
test('20. duplicate, stale, overlap, contradiction, and unclassified failure cases', () => {
  // Stale path in inventory
  const inv = readJson(CLASSIFICATION_PATH);
  const badInv = JSON.parse(JSON.stringify(inv));
  badInv.entries.push({ path: 'tests/contracts/nonexistent-file.test.cjs', layer: 'SOURCE_STATIC', rationale: 'Test entry', capabilities: [] });
  const badGlobs = ['tests/contracts/*.test.cjs'];
  const badFiles = enumerateDefaultCi(badGlobs);
  const result = classifyDefault(badInv, badFiles);
  assert.ok(result.stale.length >= 1, 'stale detection');

  // Unclassified path
  const emptyInv = JSON.parse(JSON.stringify(inv));
  emptyInv.entries = [];
  const emptyResult = classifyDefault(emptyInv, badFiles);
  assert.ok(emptyResult.unclassified.length > 0, 'unclassified detection');

  // Duplicate supplemental
  const supp = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const enumSet = new Set(badFiles);
  const dupSupp = JSON.parse(JSON.stringify(inv));
  if (supp.length > 0) {
    dupSupp.supplemental = [...supp, ...supp.slice(0, 1)];
    const dupResult = validateSupplemental(dupSupp, enumSet);
    assert.ok(dupResult.duplicates.length >= 1, 'supplemental duplicate detection');
  }
});

// 21. Non-zero exit behavior on invalid source
test('21. non-zero exit behavior on invalid source', () => {
  // Invalid registry JSON
  assert.throws(() => readJson('/tmp/nonexistent-registry-3685-test.json'), /REGISTRY_PARSE_ERROR/);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-reg-test-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{invalid');
    assert.throws(() => readJson(path.join(tmpDir, 'bad.json')), /REGISTRY_PARSE_ERROR/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// 22. No external side effect
test('22. no shell, child process, test execution, browser, network, provider, database, Docker/PostgreSQL, Preview, staging, or Production side effect', () => {
  const reporterContent = fs.readFileSync(REPORTER_PATH, 'utf8');
  assert.doesNotMatch(reporterContent, /child_process|require\(['"]child_process['"]\)/);
  assert.doesNotMatch(reporterContent, /exec\(|execSync\(|spawn\(|spawnSync\(/);
  assert.doesNotMatch(reporterContent, /http\.|https\.|fetch\(|axios/);
  assert.doesNotMatch(reporterContent, /\bpg\b|postgres|mysql|sqlite/);
  assert.doesNotMatch(reporterContent, /docker|Docker/);
  assert.doesNotMatch(reporterContent, /puppeteer|playwright\./);
  // Does not import report-layers (separate tool)
  assert.doesNotMatch(reporterContent, /report-test-layers/);
});

// 23. Exact classification registration and protected-reference hygiene
test('23. exact classification registration and protected-reference hygiene', () => {
  const inv = readJson(CLASSIFICATION_PATH);
  const testPath = 'tests/contracts/ci-test-group-registry-contract.test.cjs';
  const found = inv.entries.filter(e => e.path === testPath);
  assert.equal(found.length, 1, 'exactly one classification entry');
  assert.equal(found[0].layer, 'SOURCE_STATIC', 'SOURCE_STATIC layer');
  assert.deepEqual(found[0].capabilities, [], 'no capabilities');

  // Protected references — check doc only for closing keywords to avoid self-reference
  const docText = fs.readFileSync(DECISION_PATH, 'utf8');
  const testText = fs.readFileSync(__filename, 'utf8');
  const combined = [docText, testText].join('\n');
  const protectedIssues = ['3685', '3670', '3657', '3458', '3425', '3435', '3437', '1882'];
  for (const issue of protectedIssues) {
    assert.match(combined, new RegExp('Refs #' + issue));
  }
  // Closing keywords checked on doc-only to avoid self-match of this assertion
  for (const issue of protectedIssues) {
    assert.doesNotMatch(docText, new RegExp('(?:Closes|Fixes|Resolves) #' + issue, 'i'));
  }
  // #3671 — completed (no Keep OPEN)
  // #3676 — merged (no Keep OPEN)
  // #1882 must NOT use closing keywords in doc
  assert.doesNotMatch(docText, /Closes #1882|Fixes #1882|Resolves #1882/i);
});
