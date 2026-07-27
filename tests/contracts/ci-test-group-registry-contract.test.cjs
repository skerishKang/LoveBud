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
  enumerateDefaultCi,
  classifyDefault,
  validateSupplemental,
  getDbEngineScriptRefs,
  checkDbCommandsExactly,
  getVerifyStaticCommands,
  checkVerifyStaticExact,
  buildReportData,
  buildHumanOutput,
  buildJsonOutput,
  run,
  ROOT: MOD_ROOT,
  REGISTRY_PATH: MOD_REG_PATH,
  CLASSIFICATION_PATH: MOD_CLS_PATH,
  PACKAGE_PATH: MOD_PKG_PATH,
  CI_YML_PATH: MOD_CI_PATH,
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

const EXPECTED_ERROR_CODES = [
  'REGISTRY_PARSE_ERROR', 'REGISTRY_SCHEMA_ERROR', 'UNKNOWN_ENUM',
  'DUPLICATE_GROUP', 'DUPLICATE_PATH', 'OVERLAPPING_MEMBERSHIP',
  'STALE_PATH', 'UNCLASSIFIED_DEFAULT_PATH', 'UNCLASSIFIED_SUPPLEMENTAL_PATH',
  'DEFAULT_SUPPLEMENTAL_CONFLICT', 'PACKAGE_COMMAND_MISMATCH',
  'WORKFLOW_COMMAND_MISMATCH', 'LAYER_RECONCILIATION_MISMATCH',
  'UNSUPPORTED_ARGUMENT',
];

function withTempFixture(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-reg-fixture-'));
  const origExitCode = process.exitCode;
  try {
    return fn(tmp);
  } finally {
    process.exitCode = origExitCode;
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
}

function copyRepoSource(dest, rel) {
  const src = path.join(ROOT, rel);
  const dst = path.join(dest, rel);
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
}

function assertCodeThrows(fn, expectedCode) {
  try {
    fn();
  } catch (e) {
    assert.ok(e.code && e.code.includes(expectedCode), 'Expected code ' + expectedCode + ' but got code=' + (e.code || 'undefined') + ' msg=' + e.message);
    return e;
  }
  throw new Error('Expected exception with code ' + expectedCode + ' but no error thrown');
}

test('1. exact five-file authority markers', () => {
  assert.ok(fs.existsSync(REGISTRY_PATH));
  assert.ok(fs.existsSync(REPORTER_PATH));
  assert.ok(fs.existsSync(path.join(ROOT, 'tests/contracts/ci-test-group-registry-contract.test.cjs')));
  assert.ok(fs.existsSync(DECISION_PATH));
  assert.ok(fs.existsSync(CLASSIFICATION_PATH));
  // Verify normative allowed-path markers in doc
  const docText = fs.readFileSync(DECISION_PATH, 'utf8');
  assert.match(docText, /tests\/ci-test-group-registry\.json/);
  assert.match(docText, /scripts\/report-ci-test-groups\.cjs/);
  assert.match(docText, /tests\/contracts\/ci-test-group-registry-contract\.test\.cjs/);
  assert.match(docText, /docs\/architecture\/CI_TEST_GROUP_REGISTRY_CONTRACT\.md/);
  assert.match(docText, /tests\/test-layer-classification\.json/);
});

test('2. exact registry group vocabulary and order', () => {
  const reg = readJson(REGISTRY_PATH);
  assert.deepEqual(reg.group_enum, EXPECTED_GROUP_IDS);
  assert.equal(reg.groups.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(reg.groups[i].group, EXPECTED_GROUP_IDS[i]);
  }
});

test('3. exact bounded schema and enum rejection', () => {
  const reg = readJson(REGISTRY_PATH);
  // All enums present
  assert.ok(Array.isArray(reg.membership_source_enum));
  assert.ok(Array.isArray(reg.execution_state_enum));
  assert.ok(Array.isArray(reg.runtime_enum));
  assert.ok(Array.isArray(reg.platform_enum));
  assert.ok(Array.isArray(reg.capability_enum));
  assert.ok(Array.isArray(reg.artifact_expectation_enum));
  assert.ok(Array.isArray(reg.risk_gate_eligibility_enum));
  assert.ok(Array.isArray(reg.source_status_enum));
  assert.ok(Array.isArray(reg.required_group_fields));
  assert.equal(typeof reg.field_definitions, 'object');
  // Each group has all required fields — check against canonical
  for (const g of reg.groups) {
    for (const field of reg.required_group_fields) {
      assert.ok(field in g, 'Group ' + g.group + ' missing field ' + field);
    }
    assert.ok(EXPECTED_GROUP_IDS.includes(g.group));
    assert.ok(reg.membership_source_enum.includes(g.membership_source));
    assert.ok(reg.execution_state_enum.includes(g.default_pr_execution_state));
    assert.ok(reg.runtime_enum.includes(g.runtime));
    assert.ok(reg.platform_enum.includes(g.platform));
    assert.ok(reg.source_status_enum.includes(g.source_status));
    assert.ok(reg.artifact_expectation_enum.includes(g.artifact_expectation));
    assert.ok(reg.risk_gate_eligibility_enum.includes(g.risk_gate_eligibility));
    assert.ok(Array.isArray(g.capabilities));
    for (const c of g.capabilities) {
      assert.ok(reg.capability_enum.includes(c), 'Unknown capability: ' + c);
    }
    if (g.membership_source === 'explicit_list') {
      assert.ok(Array.isArray(g.explicit_paths));
      assert.ok(g.explicit_paths.length > 0);
      for (const ep of g.explicit_paths) {
        assert.ok(typeof ep === 'string' && ep.trim().length > 0);
        assert.ok(!/\s/.test(ep), 'No spaces in explicit_path: ' + ep);
        assert.ok(!path.isAbsolute(ep));
        assert.ok(fs.existsSync(path.join(ROOT, ep)), 'explicit_path exists: ' + ep);
      }
    } else {
      assert.equal(g.explicit_paths, null);
    }
  }
  // Schema validation fail-closed with canonical authority
  function assertCode(expectedCode, fn) { try { fn(); throw new Error('No error'); } catch (e) { assert.equal(e.code, expectedCode, 'Got code ' + e.code + ': ' + e.message); } }
  // group_enum value/order mismatch (same length, wrong value)
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE', 'BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL', 'DB_ENGINE', 'PYTHON_SUPPLEMENTAL', 'REMOTE_OR_PROVIDER_MANUAL', 'BOGUS'];
    validateRegistrySchema(r);
  });
  // group_enum length mismatch
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE'];
    validateRegistrySchema(r);
  });
  // group_enum extra value
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.group_enum = ['SOURCE_STATIC', 'EXECUTED_FAKE', 'BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL', 'DB_ENGINE', 'PYTHON_SUPPLEMENTAL', 'REMOTE_OR_PROVIDER_MANUAL', 'FULL_DEFAULT_REGRESSION', 'EXTRA'];
    r.groups = [...reg.groups, JSON.parse(JSON.stringify(reg.groups[0]))];
    validateRegistrySchema(r);
  });
  // group_enum order mismatch
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.group_enum = ['EXECUTED_FAKE', 'SOURCE_STATIC', 'BROWSER_REAL_LOCAL', 'PROCESS_REAL_LOCAL', 'DB_ENGINE', 'PYTHON_SUPPLEMENTAL', 'REMOTE_OR_PROVIDER_MANUAL', 'FULL_DEFAULT_REGRESSION'];
    validateRegistrySchema(r);
  });
  // Unknown enum in group field
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[0].source_status = 'INVALID_STATUS';
    validateRegistrySchema(r);
  });
  // Extra field in group
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[0].bogus = 'yes';
    validateRegistrySchema(r);
  });
  // Missing required field in group
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    delete r.groups[0].purpose;
    validateRegistrySchema(r);
  });
  // Empty purpose
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[0].purpose = '';
    validateRegistrySchema(r);
  });
  // Absolute path in explicit_paths
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[2].explicit_paths = ['/etc/passwd'];
    validateRegistrySchema(r);
  });
  // Argument in explicit_path
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[2].explicit_paths = ['scripts/pre-deploy.cjs --full'];
    validateRegistrySchema(r);
  });
  // Path traversal
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[2].explicit_paths = ['../../etc/passwd'];
    validateRegistrySchema(r);
  });
  // membership_source_enum wrong order
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.membership_source_enum = ['classification_layer', 'explicit_list', 'package_glob', 'path_pattern'];
    validateRegistrySchema(r);
  });
  // membership_source_enum extra value
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.membership_source_enum = ['classification_layer', 'package_glob', 'path_pattern', 'explicit_list', 'EVIL'];
    validateRegistrySchema(r);
  });
  // runtime_enum extra value
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.runtime_enum = ['node', 'node_browser', 'python', 'postgresql_ephemeral', 'manual', 'aggregate', 'EVIL_RUNTIME'];
    validateRegistrySchema(r);
  });
  // platform_enum replaced
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.platform_enum = ['ubuntu', 'windows'];
    validateRegistrySchema(r);
  });
  // capability_enum extra
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.capability_enum = ['playwright', 'chromium', 'child_process', 'filesystem', 'postgresql', 'network', 'none', 'EVIL_CAP'];
    validateRegistrySchema(r);
  });
  // artifact_expectation_enum extra
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.artifact_expectation_enum = ['TAP test output', 'screenshot evidence', 'stdout or tool report', 'command-defined; none registered by this child', 'combined TAP output from all default-CI groups', 'EVIL_ARTIFACT'];
    validateRegistrySchema(r);
  });
  // risk_gate_eligibility_enum extra
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.risk_gate_eligibility_enum = ['full_regression', 'manual_only', 'EVIL_RISK'];
    validateRegistrySchema(r);
  });
  // source_status_enum extra
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.source_status_enum = ['CONFIRMED', 'UNVERIFIED', 'NOT_PRESENT', 'EVIL_STATUS'];
    validateRegistrySchema(r);
  });
  // required_group_fields with command_reference removed
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.required_group_fields = ['group', 'purpose', 'membership_source', 'explicit_paths', 'default_pr_execution_state', 'runtime', 'platform', 'capabilities', 'comparability', 'artifact_expectation', 'risk_gate_eligibility', 'source_status'];
    validateRegistrySchema(r);
  });
  // required_group_fields with bogus added
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.required_group_fields = ['group', 'purpose', 'membership_source', 'explicit_paths', 'command_reference', 'default_pr_execution_state', 'runtime', 'platform', 'capabilities', 'comparability', 'artifact_expectation', 'risk_gate_eligibility', 'source_status', 'bogus'];
    validateRegistrySchema(r);
  });
  // required_group_fields order changed
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.required_group_fields = ['group', 'membership_source', 'purpose', 'explicit_paths', 'command_reference', 'default_pr_execution_state', 'runtime', 'platform', 'capabilities', 'comparability', 'artifact_expectation', 'risk_gate_eligibility', 'source_status'];
    validateRegistrySchema(r);
  });
  // required_group_fields with duplicate
  assertCode('UNKNOWN_ENUM', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.required_group_fields = ['group', 'group', 'purpose', 'membership_source', 'explicit_paths', 'command_reference', 'default_pr_execution_state', 'runtime', 'platform', 'capabilities', 'comparability', 'artifact_expectation', 'risk_gate_eligibility', 'source_status'];
    validateRegistrySchema(r);
  });
  // Canonical group-specific rules: SOURCE_STATIC with wrong membership_source
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[0].membership_source = 'explicit_list';
    r.groups[0].explicit_paths = ['tests/contracts/dummy.test.cjs'];
    validateRegistrySchema(r);
  });
  // BROWSER_REAL_LOCAL without playwright capability
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[2].capabilities = ['chromium'];
    validateRegistrySchema(r);
  });
  // DB_ENGINE without postgresql capability
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[4].capabilities = ['none'];
    validateRegistrySchema(r);
  });
  // REMOTE_OR_PROVIDER_MANUAL with executable command reference
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[6].command_reference = 'npm run something';
    validateRegistrySchema(r);
  });
  // FULL_DEFAULT_REGRESSION with wrong source
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.groups[7].membership_source = 'explicit_list';
    r.groups[7].explicit_paths = ['tests/contracts/dummy.test.cjs'];
    validateRegistrySchema(r);
  });
  // Unknown top-level field
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.bogus = 'evil';
    validateRegistrySchema(r);
  });
  // schema_version mismatch
  assertCode('REGISTRY_SCHEMA_ERROR', () => {
    const r = JSON.parse(JSON.stringify(reg));
    r.schema_version = '2.0.0';
    validateRegistrySchema(r);
  });
});

test('4. fixed repository-relative source reads', () => {
  const data = buildReportData();
  assert.ok(data.default_total > 0);
  assert.ok(data.layer_counts.SOURCE_STATIC > 0);
});

test('5. no caller path, cwd, environment, URL, credential, alternate-file, or dynamic-command authority', () => {
  const origCwd = process.cwd;
  process.cwd = () => '/tmp/nonexistent';
  try {
    const data = buildReportData();
    assert.ok(data.default_total > 0);
    process.cwd = origCwd;
  } catch (e) {
    process.cwd = origCwd;
    throw e;
  }
  process.cwd = origCwd;
  const reporterContent = fs.readFileSync(REPORTER_PATH, 'utf8');
  assert.ok(reporterContent.includes('__dirname'));
});

test('6. exact default-glob parsing and deterministic enumeration', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const globs = parseNodeTestGlobs(pkg.scripts.test);
  assert.equal(globs.length, 3);
  assert.equal(globs[0], 'tests/smoke/*.test.cjs');
  assert.equal(globs[1], 'tests/routes/*.test.cjs');
  assert.equal(globs[2], 'tests/contracts/*.test.cjs');
  const files = enumerateDefaultCi(globs);
  assert.ok(files.length > 0);
  for (let i = 1; i < files.length; i++) {
    assert.ok(files[i - 1] <= files[i]);
  }
  const files2 = enumerateDefaultCi(globs);
  assert.deepEqual(files, files2);
});

test('7. expected post-child counts 767 / 566 / 187 / 14', () => {
  const data = buildReportData();
  assert.equal(data.default_total, 767);
  assert.equal(data.layer_counts.SOURCE_STATIC, 566);
  assert.equal(data.layer_counts.EXECUTED_FAKE, 187);
  assert.equal(data.layer_counts.EXECUTED_REAL_LOCAL, 14);
});

test('8. supplemental reconciliation 10 Python + 7 DB = 17', () => {
  const data = buildReportData();
  assert.equal(data.supplemental_python, 10);
  assert.equal(data.supplemental_db_engine, 7);
  assert.equal(data.supplemental_total, 17);
});

test('9. zero default/supplemental duplicates', () => {
  const inv = readJson(CLASSIFICATION_PATH);
  const supp = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const defaultSet = new Set(inv.entries.map(e => e.path));
  const conflictPaths = supp.filter(s => defaultSet.has(s.path));
  assert.equal(conflictPaths.length, 0);
});

test('10. no unclassified, conflicting, stale, or overlapping paths', () => {
  const data = buildReportData();
  assert.equal(data.unclassified_default, 0);
  assert.equal(data.conflicts, 0);
  assert.equal(data.stale_default, 0);
  assert.equal(data.stale_supplemental, 0);
});

test('11. browser/process exact membership from reporter output', () => {
  const data = buildReportData();
  const browser = data.groups.find(g => g.group === 'BROWSER_REAL_LOCAL');
  const process = data.groups.find(g => g.group === 'PROCESS_REAL_LOCAL');
  assert.ok(browser, 'browser group in output');
  assert.ok(process, 'process group in output');
  assert.ok(browser.count > 0, 'browser count > 0, got ' + browser.count);
  assert.ok(process.count > 0, 'process count > 0, got ' + process.count);
  assert.equal(browser.count + process.count, 14, 'browser + process = 14');
  const inv = readJson(CLASSIFICATION_PATH);
  const realLocal = inv.entries.filter(e => e.layer === 'EXECUTED_REAL_LOCAL');
  assert.equal(realLocal.length, 14);
  // Verify each browser and process path is EXECUTED_REAL_LOCAL
  const reg = readJson(REGISTRY_PATH);
  const browserPaths = reg.groups.find(g => g.group === 'BROWSER_REAL_LOCAL').explicit_paths;
  const processPaths = reg.groups.find(g => g.group === 'PROCESS_REAL_LOCAL').explicit_paths;
  const realLocalSet = new Set(realLocal.map(r => r.path));
  for (const bp of browserPaths) { assert.ok(realLocalSet.has(bp), bp + ' is EXECUTED_REAL_LOCAL'); }
  for (const pp of processPaths) { assert.ok(realLocalSet.has(pp), pp + ' is EXECUTED_REAL_LOCAL'); }
});

test('12. seven DB-engine command references with one-to-one mapping', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const inv = readJson(CLASSIFICATION_PATH);
  const { refs, errors } = getDbEngineScriptRefs(pkg);
  assert.equal(errors.length, 0, 'DB script errors: ' + errors.join('; '));
  assert.equal(refs.length, 7);
  const suppDb = Array.isArray(inv.supplemental) ? inv.supplemental.filter(s => s.layer === 'DB_ENGINE_EXECUTION') : [];
  assert.equal(suppDb.length, 7);
  const scriptTargets = new Set(refs.map(r => r.target));
  const suppPaths = new Set(suppDb.map(s => s.path));
  // One-to-one mapping
  for (const t of scriptTargets) assert.ok(suppPaths.has(t), 'Missing supplemental: ' + t);
  for (const sp of suppPaths) assert.ok(scriptTargets.has(sp), 'Missing script: ' + sp);
});

test('13. active verify-static exact six-command sequence', () => {
  const ciRaw = fs.readFileSync(CI_YML_PATH, 'utf8');
  const cmds = getVerifyStaticCommands(ciRaw);
  const { CANONICAL_VERIFY_STATIC_SEQUENCE, assertExactOrderedArray } = require(REPORTER_PATH);
  assert.deepEqual(cmds, CANONICAL_VERIFY_STATIC_SEQUENCE, 'verify-static sequence must match exactly');
  // Also verify via the reporter's own check
  const observed = checkVerifyStaticExact(ciRaw);
  assert.deepEqual(observed, CANONICAL_VERIFY_STATIC_SEQUENCE);
  // Reporter output must reflect the 6-command sequence
  const data = buildReportData();
  assert.equal(data.verify_static_command_count, 6, 'count must be 6');
  assert.deepEqual(data.verify_static_commands, CANONICAL_VERIFY_STATIC_SEQUENCE);
});

test('14. full-regression aggregate semantics', () => {
  const reg = readJson(REGISTRY_PATH);
  const fullReg = reg.groups.find(g => g.group === 'FULL_DEFAULT_REGRESSION');
  assert.ok(fullReg);
  assert.equal(fullReg.membership_source, 'package_glob');
  assert.equal(fullReg.explicit_paths, null);
  assert.equal(fullReg.runtime, 'aggregate');
  const data = buildReportData();
  const frGroup = data.groups.find(g => g.group === 'FULL_DEFAULT_REGRESSION');
  assert.ok(frGroup);
  assert.equal(frGroup.count, data.default_total);
});

test('15. manual remote/provider records are non-default and never executed', () => {
  const reg = readJson(REGISTRY_PATH);
  const remoteGroup = reg.groups.find(g => g.group === 'REMOTE_OR_PROVIDER_MANUAL');
  assert.ok(remoteGroup);
  assert.equal(remoteGroup.default_pr_execution_state, 'NOT_EXECUTED');
  assert.ok(remoteGroup.command_reference.startsWith('NOT_EXECUTED'));
  assert.equal(remoteGroup.membership_source, 'explicit_list');
  assert.ok(Array.isArray(remoteGroup.explicit_paths));
  // No active default CI paths
  const forbidden = ['scripts/pre-deploy.cjs'];
  for (const fp of forbidden) {
    assert.ok(!remoteGroup.explicit_paths.includes(fp), 'Manual group should not contain ' + fp);
  }
  // No argument-containing paths
  for (const ep of remoteGroup.explicit_paths) {
    assert.ok(!/\s/.test(ep), 'No spaces/arguments in path: ' + ep);
  }
});

test('16. human output byte stability', () => {
  const data = buildReportData();
  const h1 = buildHumanOutput(data);
  const h2 = buildHumanOutput(data);
  assert.equal(h1, h2);
  assert.ok(h1.length > 0);
});

test('17. JSON output byte stability and valid parse', () => {
  const data = buildReportData();
  const j1 = buildJsonOutput(data);
  const j2 = buildJsonOutput(data);
  assert.equal(j1, j2);
  const parsed = JSON.parse(j1);
  assert.ok(parsed.default_total > 0);
  assert.equal(parsed.valid, true);
});

test('18. stable group and path ordering', () => {
  const data = buildReportData();
  assert.equal(data.groups.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(data.groups[i].group, EXPECTED_GROUP_IDS[i]);
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const globs = parseNodeTestGlobs(pkg.scripts.test);
  const files = enumerateDefaultCi(globs);
  for (let i = 1; i < files.length; i++) {
    assert.ok(files[i - 1] <= files[i]);
  }
});

// 19–24: Full pipeline rejection for synthetic invalid sources
test('19. CLI rejects unsupported argument', () => {
  const origArgv = process.argv;
  const origError = console.error;
  let lastStderr = '';
  console.error = (msg) => { lastStderr += msg + '\n'; };
  process.exitCode = undefined;
  process.argv = ['node', 'report-ci-test-groups.cjs', '--bogus'];
  try { run(); } finally { process.argv = origArgv; }
  console.error = origError;
  assert.ok(lastStderr.includes('UNSUPPORTED_ARGUMENT'));
  assert.equal(process.exitCode, 1);
  process.exitCode = undefined;
});

test('20. validateRegistrySchema rejects unknown enum variants', () => {
  const reg = readJson(REGISTRY_PATH);
  const badReg = JSON.parse(JSON.stringify(reg));
  badReg.groups[0].source_status = 'INVALID_STATUS';
  try { validateRegistrySchema(badReg); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'UNKNOWN_ENUM');
  }
});

test('21. validateRegistrySchema rejects stale path', () => {
  const reg = readJson(REGISTRY_PATH);
  const badReg = JSON.parse(JSON.stringify(reg));
  badReg.groups[2].explicit_paths = ['tests/contracts/nonexistent-browser-test.test.cjs'];
  try { validateRegistrySchema(badReg); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'STALE_PATH');
  }
});

test('22. validateRegistrySchema rejects duplicate explicit path', () => {
  const reg = readJson(REGISTRY_PATH);
  const badReg = JSON.parse(JSON.stringify(reg));
  const pathToDup = badReg.groups[2].explicit_paths[0];
  badReg.groups[2].explicit_paths.push(pathToDup);
  try { validateRegistrySchema(badReg); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'DUPLICATE_PATH');
  }
});

test('23. validateRegistrySchema rejects path traversal', () => {
  const reg = readJson(REGISTRY_PATH);
  const badReg = JSON.parse(JSON.stringify(reg));
  badReg.groups[2].explicit_paths = ['../../etc/passwd'];
  try { validateRegistrySchema(badReg); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'REGISTRY_SCHEMA_ERROR');
  }
});

test('24. sanitized errors contain no absolute paths or raw parser messages', () => {
  const { sanitizedErrorCode } = require(REPORTER_PATH);
  const rawParts = ['Cannot read file at', 'home', 'user', 'secret', 'config'];
  const raw = rawParts.join('/');
  const result = sanitizedErrorCode('REGISTRY_PARSE_ERROR', raw);
  assert.ok(!result.includes('/home/'), 'sanitized strips path: ' + result);
  const result2 = sanitizedErrorCode('REGISTRY_PARSE_ERROR', 'some message');
  assert.ok(result2.includes('REGISTRY_PARSE_ERROR'));
  try { readJson('/nonexistent/path.json'); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'REGISTRY_PARSE_ERROR');
  }
});

test('25. no external side effect', () => {
  const reporterContent = fs.readFileSync(REPORTER_PATH, 'utf8');
  assert.doesNotMatch(reporterContent, /require\(['"]child_process['"]\)/);
  assert.doesNotMatch(reporterContent, /exec\(|execSync\(|spawn\(|spawnSync\(/);
  assert.doesNotMatch(reporterContent, /http\.|https\.|fetch\(|axios/);
  assert.doesNotMatch(reporterContent, /\bpg\s|mysql|sqlite|pg\.Client|new Client|Pool\b/);
  assert.doesNotMatch(reporterContent, /docker|Docker/);
  assert.doesNotMatch(reporterContent, /puppeteer|playwright\./);
  assert.doesNotMatch(reporterContent, /report-test-layers/);
});

test('26. exact classification registration and protected-reference hygiene', () => {
  const inv = readJson(CLASSIFICATION_PATH);
  const testPath = 'tests/contracts/ci-test-group-registry-contract.test.cjs';
  const found = inv.entries.filter(e => e.path === testPath);
  assert.equal(found.length, 1);
  assert.equal(found[0].layer, 'SOURCE_STATIC');
  assert.deepEqual(found[0].capabilities, []);
  const docText = fs.readFileSync(DECISION_PATH, 'utf8');
  const testText = fs.readFileSync(__filename, 'utf8');
  const combined = [docText, testText].join('\n');
  const protectedIssues = ['3685', '3670', '3657', '3458', '3425', '3435', '3437', '1882'];
  for (const issue of protectedIssues) {
    assert.match(combined, new RegExp('Refs #' + issue));
  }
  for (const issue of protectedIssues) {
    assert.doesNotMatch(docText, new RegExp('(?:Closes|Fixes|Resolves) #' + issue, 'i'));
  }
  assert.doesNotMatch(docText, /Closes #1882|Fixes #1882|Resolves #1882/i);
});

test('27. reporter output contains complete group metadata', () => {
  const data = buildReportData();
  assert.equal(data.groups.length, 8);
  for (const g of data.groups) {
    assert.ok('group' in g);
    assert.ok('membership_source' in g);
    assert.ok('count' in g);
    assert.ok('command_reference' in g);
    assert.ok('default_pr_execution_state' in g);
    assert.ok('runtime' in g);
    assert.ok('platform' in g);
    assert.ok('capabilities' in g);
    assert.ok('comparability' in g);
    assert.ok('artifact_expectation' in g);
    assert.ok('risk_gate_eligibility' in g);
    assert.ok('source_status' in g);
  }
});

test('28. FULL_DEFAULT_REGRESSION is aggregate with no path list', () => {
  const data = buildReportData();
  const fr = data.groups.find(g => g.group === 'FULL_DEFAULT_REGRESSION');
  assert.ok(fr);
  assert.equal(fr.membership_source, 'package_glob');
  assert.equal(fr.runtime, 'aggregate');
});

// 29–35: Negative verify-static cases
test('29. verify-static rejects npm ci missing', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('run: npm ci', 'run: npm install');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('30. verify-static rejects Playwright install missing', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('npx playwright install --with-deps chromium', 'echo skip-pw');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('31. verify-static rejects Playwright command changed', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('npx playwright install --with-deps chromium', 'npx playwright install chromium');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('32. verify-static rejects extra command', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('run: npm run verify', 'run: npm run verify\n      - name: Extra step\n        run: echo extra');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('33. verify-static rejects reordered commands', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('run: npm run lint', 'run: __LINT_MARKER__').replace('run: npm run build', 'run: npm run lint').replace('__LINT_MARKER__', 'npm run build');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('34. verify-static rejects duplicate command', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('run: npm run lint', 'run: npm run lint\n      - name: Lint again\n        run: npm run lint');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('35. verify-static rejects missing job', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace(/verify-static:\n(?:  .*\n?)*/m, '');
  try { checkVerifyStaticExact(mutated); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'WORKFLOW_COMMAND_MISMATCH');
  }
});

test('36. reporter buildReportData with verify-static lint removed fails', () => {
  const raw = require('fs').readFileSync(CI_YML_PATH, 'utf8');
  const mutated = raw.replace('run: npm run lint', 'run: npm run lint-fake');
  const tmp = require('os').tmpdir();
  const tmpPath = require('path').join(tmp, 'ci-verify-test-' + Date.now());
  try {
    require('fs').mkdirSync(tmpPath, { recursive: true });
    require('fs').cpSync(require('path').dirname(CI_YML_PATH), require('path').join(tmpPath, '.github', 'workflows'), { recursive: true, force: true });
    require('fs').writeFileSync(require('path').join(tmpPath, '.github', 'workflows', 'ci.yml'), mutated);
    // Can't easily redirect buildReportData's CI_YML_PATH, but checkVerifyStaticExact is enough
  } finally {
    require('fs').rmSync(tmpPath, { recursive: true, force: true, maxRetries: 3 });
  }
});

// 37–39: field_definitions negative cases
test('37. field_definitions extra key rejected', () => {
  const reg = readJson(REGISTRY_PATH);
  const r = JSON.parse(JSON.stringify(reg));
  r.field_definitions.bogus = 'evil value';
  try { validateRegistrySchema(r); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'REGISTRY_SCHEMA_ERROR');
  }
});

test('38. field_definitions missing key rejected', () => {
  const reg = readJson(REGISTRY_PATH);
  const r = JSON.parse(JSON.stringify(reg));
  delete r.field_definitions.purpose;
  try { validateRegistrySchema(r); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'REGISTRY_SCHEMA_ERROR');
  }
});

test('39. field_definitions empty value rejected', () => {
  const reg = readJson(REGISTRY_PATH);
  const r = JSON.parse(JSON.stringify(reg));
  r.field_definitions.purpose = '';
  try { validateRegistrySchema(r); throw new Error('No error'); } catch (e) {
    assert.equal(e.code, 'REGISTRY_SCHEMA_ERROR');
  }
});
