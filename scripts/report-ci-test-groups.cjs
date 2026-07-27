'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'tests', 'ci-test-group-registry.json');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests', 'test-layer-classification.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const CI_YML_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');

const VOCABULARY = [
  'SOURCE_STATIC', 'EXECUTED_FAKE', 'EXECUTED_REAL_LOCAL',
  'EXTERNAL_INTEGRATION', 'PRODUCTION_SMOKE', 'DB_ENGINE_EXECUTION',
];

const SUPPLEMENTAL_VOCABULARY = ['SUPPLEMENTAL_PYTHON', 'DB_ENGINE_EXECUTION'];
const SHELL_OPERATORS = ['&&', '||', ';'];

const KNOWN_ERROR_CODES = [
  'REGISTRY_PARSE_ERROR', 'REGISTRY_SCHEMA_ERROR', 'UNKNOWN_ENUM',
  'DUPLICATE_GROUP', 'DUPLICATE_PATH', 'OVERLAPPING_MEMBERSHIP',
  'STALE_PATH', 'UNCLASSIFIED_DEFAULT_PATH', 'UNCLASSIFIED_SUPPLEMENTAL_PATH',
  'DEFAULT_SUPPLEMENTAL_CONFLICT', 'PACKAGE_COMMAND_MISMATCH',
  'WORKFLOW_COMMAND_MISMATCH', 'LAYER_RECONCILIATION_MISMATCH',
  'UNSUPPORTED_ARGUMENT',
];

const EXPECTED_DB_ENGINE_SCRIPTS = [
  { script: 'test:db-engine:tree-comments',          target: 'tests/db-engine/tree-comments-reconcile-postgres.test.cjs' },
  { script: 'test:db-engine:trees-schema',            target: 'tests/db-engine/trees-schema-foothold-postgres.test.cjs' },
  { script: 'test:db-engine:generic-social-a-guard',  target: 'tests/db-engine/generic-social-a-guard-postgres.test.cjs' },
  { script: 'test:db-engine:generic-social-a',        target: 'tests/db-engine/generic-social-a-postgres.test.cjs' },
  { script: 'test:db-engine:generic-social-b-guard',  target: 'tests/db-engine/generic-social-b-guard-postgres.test.cjs' },
  { script: 'test:db-engine:generic-social-b',        target: 'tests/db-engine/generic-social-b-postgres.test.cjs' },
  { script: 'test:db-engine:migration-catalog-adapter', target: 'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs' },
];

const EXPECTED_VERIFY_STATIC_COMMANDS = ['lint', 'build', 'test', 'verify'];

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function sanitizedErrorCode(code, message) {
  if (typeof message !== 'string') message = String(message);
  const clean = message.replace(/\/[^\s]*[/]|[A-Z]:\\[^\s]*/g, '[path]').split('\n')[0];
  return code + ': ' + clean;
}

function readJson(p) {
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    throw fail('REGISTRY_PARSE_ERROR', 'Cannot read required source file');
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw fail('REGISTRY_PARSE_ERROR', 'Malformed JSON in required source file');
  }
}

function validateRegistrySchema(reg) {
  const enums = {
    membership_source: ['classification_layer', 'package_glob', 'path_pattern', 'explicit_list'],
    default_pr_execution_state: ['ALWAYS', 'ON_COMMIT', 'ON_PR', 'MANUAL', 'NOT_EXECUTED'],
    runtime: ['node', 'node_browser', 'python', 'postgresql_ephemeral', 'manual', 'aggregate'],
    platform: ['ubuntu', 'cross_platform', 'manual'],
    source_status: ['CONFIRMED', 'UNVERIFIED', 'NOT_PRESENT'],
  };
  if (typeof reg !== 'object' || !reg) throw fail('REGISTRY_SCHEMA_ERROR', 'Registry is not an object');
  if (typeof reg.schema_version !== 'string') throw fail('REGISTRY_SCHEMA_ERROR', 'schema_version missing or not string');
  if (!Array.isArray(reg.group_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'group_enum is not an array');
  if (!Array.isArray(reg.groups)) throw fail('REGISTRY_SCHEMA_ERROR', 'groups is not an array');
  if (reg.groups.length !== reg.group_enum.length) {
    throw fail('REGISTRY_SCHEMA_ERROR', 'groups length does not match group_enum length');
  }
  if (!Array.isArray(reg.membership_source_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'membership_source_enum missing');
  if (!Array.isArray(reg.execution_state_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'execution_state_enum missing');
  if (!Array.isArray(reg.runtime_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'runtime_enum missing');
  if (!Array.isArray(reg.platform_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'platform_enum missing');
  if (!Array.isArray(reg.capability_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'capability_enum missing');
  if (!Array.isArray(reg.artifact_expectation_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'artifact_expectation_enum missing');
  if (!Array.isArray(reg.risk_gate_eligibility_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'risk_gate_eligibility_enum missing');
  if (!Array.isArray(reg.source_status_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'source_status_enum missing');
  if (!Array.isArray(reg.required_group_fields)) throw fail('REGISTRY_SCHEMA_ERROR', 'required_group_fields missing');

  const seen = new Set();
  for (let i = 0; i < reg.group_enum.length; i++) {
    const id = reg.group_enum[i];
    if (seen.has(id)) throw fail('DUPLICATE_GROUP', 'Duplicate group ID: ' + id);
    seen.add(id);
    if (i >= reg.groups.length || reg.groups[i].group !== id) {
      throw fail('REGISTRY_SCHEMA_ERROR', 'group_enum/groups position mismatch at index ' + i);
    }
  }

  const validCap = new Set(reg.capability_enum);
  const validArtifact = new Set(reg.artifact_expectation_enum);
  const validRisk = new Set(reg.risk_gate_eligibility_enum);
  const ownershipSources = new Set(reg.membership_source_enum);

  for (const g of reg.groups) {
    for (const field of reg.required_group_fields) {
      if (!(field in g)) throw fail('REGISTRY_SCHEMA_ERROR', 'Missing required field "' + field + '" in group ' + g.group);
    }
    const extraFields = Object.keys(g).filter(k => !['group','purpose','membership_source','explicit_paths','command_reference','default_pr_execution_state','runtime','platform','capabilities','comparability','artifact_expectation','risk_gate_eligibility','source_status'].includes(k) && !reg.required_group_fields.includes(k) && !['command_reference_notes'].includes(k));
    if (extraFields.length > 0) throw fail('REGISTRY_SCHEMA_ERROR', 'Extra unsupported field(s) in group ' + g.group + ': ' + extraFields.join(','));
    if (!reg.group_enum.includes(g.group)) throw fail('UNKNOWN_ENUM', 'Unknown group ID: ' + g.group);
    if (!ownershipSources.has(g.membership_source)) throw fail('UNKNOWN_ENUM', 'Unknown membership_source "' + g.membership_source + '" in group ' + g.group);
    if (!reg.execution_state_enum.includes(g.default_pr_execution_state)) throw fail('UNKNOWN_ENUM', 'Unknown default_pr_execution_state "' + g.default_pr_execution_state + '" in group ' + g.group);
    if (!reg.runtime_enum.includes(g.runtime)) throw fail('UNKNOWN_ENUM', 'Unknown runtime "' + g.runtime + '" in group ' + g.group);
    if (!reg.platform_enum.includes(g.platform)) throw fail('UNKNOWN_ENUM', 'Unknown platform "' + g.platform + '" in group ' + g.group);
    if (!reg.source_status_enum.includes(g.source_status)) throw fail('UNKNOWN_ENUM', 'Unknown source_status "' + g.source_status + '" in group ' + g.group);
    if (!validArtifact.has(g.artifact_expectation)) throw fail('UNKNOWN_ENUM', 'Unknown artifact_expectation "' + g.artifact_expectation + '" in group ' + g.group);
    if (!validRisk.has(g.risk_gate_eligibility)) throw fail('UNKNOWN_ENUM', 'Unknown risk_gate_eligibility "' + g.risk_gate_eligibility + '" in group ' + g.group);
    if (!Array.isArray(g.capabilities)) throw fail('REGISTRY_SCHEMA_ERROR', 'capabilities is not an array in group ' + g.group);
    for (const c of g.capabilities) {
      if (!validCap.has(c)) throw fail('UNKNOWN_ENUM', 'Unknown capability "' + c + '" in group ' + g.group);
    }
    if (typeof g.purpose !== 'string' || !g.purpose.trim()) throw fail('REGISTRY_SCHEMA_ERROR', 'Empty purpose in group ' + g.group);
    if (g.membership_source === 'explicit_list') {
      if (!Array.isArray(g.explicit_paths)) throw fail('REGISTRY_SCHEMA_ERROR', 'explicit_list group ' + g.group + ' must have explicit_paths array');
      if (g.explicit_paths.length === 0) throw fail('REGISTRY_SCHEMA_ERROR', 'explicit_list group ' + g.group + ' has empty explicit_paths');
      const epSeen = new Set();
      for (const ep of g.explicit_paths) {
        if (typeof ep !== 'string' || !ep.trim()) throw fail('REGISTRY_SCHEMA_ERROR', 'Invalid explicit_path entry in group ' + g.group);
        if (/\s/.test(ep)) throw fail('REGISTRY_SCHEMA_ERROR', 'explicit_path contains spaces/arguments in group ' + g.group + ': ' + ep);
        if (path.isAbsolute(ep)) throw fail('REGISTRY_SCHEMA_ERROR', 'Absolute explicit_path in group ' + g.group + ': ' + ep);
        const norm = ep.split(path.sep).join('/');
        if (norm.includes('..')) throw fail('REGISTRY_SCHEMA_ERROR', 'Path traversal in explicit_path of group ' + g.group + ': ' + ep);
        if (epSeen.has(ep)) throw fail('DUPLICATE_PATH', 'Duplicate explicit_path in group ' + g.group + ': ' + ep);
        epSeen.add(ep);
        const fp = path.join(ROOT, ep);
        if (!fs.existsSync(fp)) throw fail('STALE_PATH', 'explicit_path does not exist in group ' + g.group + ': ' + ep);
      }
    } else {
      if (g.explicit_paths !== null) throw fail('REGISTRY_SCHEMA_ERROR', 'Non-null explicit_paths in non-explicit_list group ' + g.group);
    }
  }
}

function parseNodeTestGlobs(testCommand) {
  if (typeof testCommand !== 'string' || !testCommand.trim()) {
    throw fail('PACKAGE_COMMAND_MISMATCH', 'Empty test command');
  }
  for (const op of SHELL_OPERATORS) {
    if (testCommand.includes(op)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Shell operator in test command');
  }
  if (testCommand.includes('|')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Pipe in test command');
  if (testCommand.includes('>') || testCommand.includes('<')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Redirection in test command');
  const tokens = testCommand.trim().split(/\s+/);
  if (tokens[0] !== 'node' || tokens[1] !== '--test') {
    throw fail('PACKAGE_COMMAND_MISMATCH', 'Not a node --test command');
  }
  const globs = tokens.slice(2);
  if (globs.length === 0) throw fail('PACKAGE_COMMAND_MISMATCH', 'No globs in test command');
  for (const g of globs) validateGlobShape(g);
  return globs;
}

function validateGlobShape(glob) {
  if (typeof glob !== 'string' || !glob.trim()) throw fail('PACKAGE_COMMAND_MISMATCH', 'Invalid glob');
  if (path.isAbsolute(glob)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path in glob');
  const norm = glob.split(path.sep).join('/');
  if (norm.startsWith('/')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path in glob');
  if (/^[A-Za-z]:/.test(norm)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path in glob');
  const parts = norm.split('/').filter(p => p.length > 0);
  if (parts.includes('..')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Path traversal in glob');
  const basename = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) throw fail('PACKAGE_COMMAND_MISMATCH', 'Missing directory in glob');
  if (basename !== '*.test.cjs') throw fail('PACKAGE_COMMAND_MISMATCH', 'Invalid glob shape');
  for (const d of dirParts) {
    if (d.includes('*') || d.includes('?')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Wildcard in directory');
  }
}

function enumerateDefaultCi(globs) {
  const files = [];
  for (const glob of globs) {
    const dir = path.join(ROOT, path.dirname(glob));
    if (!fs.existsSync(dir)) continue;
    const matched = fs.readdirSync(dir)
      .filter(f => f.endsWith('.test.cjs'))
      .map(f => path.join(path.dirname(glob), f).split(path.sep).join('/'));
    files.push(...matched);
  }
  files.sort();
  return files;
}

function classifyDefault(inv, enumerated) {
  const byPath = new Map();
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(e);
  }
  const vocab = new Set(inv.vocabulary);
  const counts = {};
  for (const v of inv.vocabulary) counts[v] = 0;
  const unclassified = [];
  const conflicts = [];
  const invalidCategory = [];
  const emptyRationale = [];
  for (const f of enumerated) {
    const matches = byPath.get(f) || [];
    if (matches.length === 0) { unclassified.push(f); continue; }
    if (matches.length > 1) { conflicts.push(f); continue; }
    const entry = matches[0];
    if (!vocab.has(entry.layer)) { invalidCategory.push(f); continue; }
    if (!entry.rationale || !String(entry.rationale).trim()) { emptyRationale.push(f); continue; }
    counts[entry.layer] += 1;
  }
  const stale = [];
  const enumeratedSet = new Set(enumerated);
  for (const e of inv.entries) {
    const key = e.path.split(path.sep).join('/');
    if (!enumeratedSet.has(key)) stale.push(key);
  }
  return { counts, unclassified, conflicts, invalidCategory, emptyRationale, stale };
}

function validateSupplemental(inv, enumeratedSet) {
  const suppEntries = Array.isArray(inv.supplemental) ? inv.supplemental : [];
  const stale = [];
  const duplicates = [];
  const inDefaultCi = [];
  const invalid = [];
  const emptyRationale = [];
  const invalidCapabilities = [];
  const seen = new Set();
  for (const s of suppEntries) {
    const sp = s && typeof s.path === 'string' ? s.path.split(path.sep).join('/') : '';
    if (!sp) { invalid.push('<missing-path>'); continue; }
    if (seen.has(sp)) duplicates.push(sp);
    else seen.add(sp);
    if (s.defaultCi !== false) inDefaultCi.push(sp);
    if (!SUPPLEMENTAL_VOCABULARY.includes(s.layer)) {
      invalid.push(sp);
    } else if (s.layer === 'SUPPLEMENTAL_PYTHON') {
      if (!sp.endsWith('.py')) invalid.push(sp);
    } else if (s.layer === 'DB_ENGINE_EXECUTION') {
      if (!sp.endsWith('.cjs')) invalid.push(sp);
      if (!sp.startsWith('tests/db-engine/')) invalid.push(sp);
    }
    if (!s.rationale || !String(s.rationale).trim()) emptyRationale.push(sp);
    if (!Array.isArray(s.capabilities)) invalidCapabilities.push(sp);
    if (enumeratedSet.has(sp)) inDefaultCi.push(sp);
    const fp = path.join(ROOT, sp);
    if (!fs.existsSync(fp)) stale.push(sp);
  }
  return { stale, duplicates, inDefaultCi, invalid, emptyRationale, invalidCapabilities };
}

function getDbEngineScriptRefs(pkg) {
  const errors = [];
  const refs = [];
  for (const entry of EXPECTED_DB_ENGINE_SCRIPTS) {
    const cmd = pkg.scripts && pkg.scripts[entry.script];
    if (!cmd) {
      errors.push('Missing script: ' + entry.script);
      continue;
    }
    const expectedPrefix = 'node --test --test-concurrency=1 ';
    if (!cmd.startsWith(expectedPrefix)) {
      errors.push('Unexpected command format for ' + entry.script);
      continue;
    }
    const targetPath = cmd.slice(expectedPrefix.length).trim();
    const normTarget = targetPath.split(path.sep).join('/');
    if (normTarget !== entry.target) {
      errors.push('Target mismatch for ' + entry.script + ': expected ' + entry.target + ', got ' + normTarget);
    }
    refs.push({ script: entry.script, command: cmd, target: normTarget });
  }
  return { refs, errors };
}

function getVerifyStaticCommands(ciYaml) {
  const lines = ciYaml.split('\n');
  let inVerifyStatic = false;
  let inSteps = false;
  let inBlock = false;
  const runCommands = [];
  const topLevelKey = /^\w[\w-]*:/;
  for (const line of lines) {
    const t = line.trim();
    if (t === 'verify-static:') { inVerifyStatic = true; inSteps = false; inBlock = false; continue; }
    if (!inVerifyStatic) continue;
    if (t === '') continue;
    if (t.startsWith('steps:')) { inSteps = true; inBlock = false; continue; }
    if (inSteps && t.startsWith('env:') || t.startsWith('with:')) { inBlock = true; continue; }
    if (inBlock) {
      if (t.startsWith('- ')) inBlock = false;
      else continue;
    }
    if (inSteps && !t.startsWith('-') && !t.startsWith('uses:') && !t.startsWith('run:') && !t.startsWith('env:') && !t.startsWith('with:') && !t.startsWith('#') && topLevelKey.test(t)) {
      break;
    }
    if (!inSteps) continue;
    if (t.startsWith('uses:')) continue;
    if (t.startsWith('env:') || t.startsWith('with:')) { inBlock = true; continue; }
    if (t.startsWith('run:')) {
      const cmd = t.slice(4).trim();
      runCommands.push(cmd);
      continue;
    }
  }
  const result = [];
  for (const cmd of runCommands) {
    if (cmd === 'npm ci') {
      result.push('ci');
    } else if (cmd === 'npm test') {
      result.push('test');
    } else if (cmd.startsWith('npm run ')) {
      result.push(cmd.slice(8).trim());
    } else if (cmd.startsWith('npx ')) {
      result.push(cmd);
    } else if (cmd.startsWith('npm ')) {
      result.push(cmd);
    }
  }
  return result;
}

function checkRealLocalMembership(reg, inv, enumerated) {
  const errors = [];
  const browserGroup = reg.groups.find(g => g.group === 'BROWSER_REAL_LOCAL');
  const processGroup = reg.groups.find(g => g.group === 'PROCESS_REAL_LOCAL');
  if (!browserGroup || !processGroup) throw fail('REGISTRY_SCHEMA_ERROR', 'BROWSER_REAL_LOCAL or PROCESS_REAL_LOCAL group missing');
  const browserPaths = (browserGroup.explicit_paths || []).map(p => p.split(path.sep).join('/'));
  const processPaths = (processGroup.explicit_paths || []).map(p => p.split(path.sep).join('/'));
  const browserSet = new Set(browserPaths);
  const processSet = new Set(processPaths);
  const overlap = browserPaths.filter(p => processSet.has(p));
  if (overlap.length > 0) throw fail('OVERLAPPING_MEMBERSHIP', 'Browser/process overlap: ' + overlap.join(', '));
  const allRealLocal = new Set(enumerated.filter(f => {
    const entry = inv.entries.find(e => e.path.split(path.sep).join('/') === f);
    return entry && entry.layer === 'EXECUTED_REAL_LOCAL';
  }));
  const union = new Set([...browserPaths, ...processPaths]);
  const missing = [...allRealLocal].filter(p => !union.has(p));
  if (missing.length > 0) throw fail('UNCLASSIFIED_DEFAULT_PATH', 'Real-local path not in browser or process: ' + missing.join(', '));
  const extra = [...union].filter(p => !allRealLocal.has(p));
  if (extra.length > 0) throw fail('OVERLAPPING_MEMBERSHIP', 'Browser/process path is not EXECUTED_REAL_LOCAL: ' + extra.join(', '));
  return { browserCount: browserPaths.length, processCount: processPaths.length, total: allRealLocal.size, unionSize: union.size, overlap: overlap.length };
}

function checkDbCommandsExactly(pkg, suppEntries) {
  const errors = [];
  const suppPaths = new Set(suppEntries
    .filter(s => s.layer === 'DB_ENGINE_EXECUTION')
    .map(s => s.path.split(path.sep).join('/')));
  const { refs, errors: refErrors } = getDbEngineScriptRefs(pkg);
  errors.push(...refErrors);
  const scriptTargets = new Set(refs.map(r => r.target));
  const missingFromSupp = [...scriptTargets].filter(t => !suppPaths.has(t));
  for (const m of missingFromSupp) errors.push('Script target not in supplemental: ' + m);
  const extraInSupp = [...suppPaths].filter(t => !scriptTargets.has(t));
  for (const e of extraInSupp) errors.push('Supplemental path without matching script: ' + e);
  return { errors, scriptCount: refs.length, suppCount: suppPaths.size };
}

function checkVerifyStaticExact(ciRaw) {
  const cmds = getVerifyStaticCommands(ciRaw);
  const activeSet = cmds.filter(c => EXPECTED_VERIFY_STATIC_COMMANDS.includes(c));
  const missing = EXPECTED_VERIFY_STATIC_COMMANDS.filter(c => !activeSet.includes(c));
  const extra = activeSet.filter(c => !EXPECTED_VERIFY_STATIC_COMMANDS.includes(c));
  if (missing.length > 0 || extra.length > 0 || cmds.length === 0) {
    throw fail('WORKFLOW_COMMAND_MISMATCH', 'verify-static active command set mismatch');
  }
}

function buildGroupResult(g, classResult, defaultTotal, suppPython, suppDbEngine, browserCount, processCount) {
  let count = 0;
  let paths = null;
  if (g.group === 'FULL_DEFAULT_REGRESSION') {
    count = defaultTotal;
  } else if (g.membership_source === 'classification_layer') {
    count = classResult[g.group] || 0;
  } else if (g.membership_source === 'explicit_list') {
    if (g.group === 'BROWSER_REAL_LOCAL') count = browserCount;
    else if (g.group === 'PROCESS_REAL_LOCAL') count = processCount;
    else count = (g.explicit_paths || []).length;
  } else if (g.membership_source === 'path_pattern') {
    if (g.group === 'DB_ENGINE') count = suppDbEngine;
    else if (g.group === 'PYTHON_SUPPLEMENTAL') count = suppPython;
  }
  return {
    group: g.group,
    membership_source: g.membership_source,
    count,
    command_reference: g.command_reference,
    default_pr_execution_state: g.default_pr_execution_state,
    runtime: g.runtime,
    platform: g.platform,
    capabilities: g.capabilities,
    comparability: g.comparability,
    artifact_expectation: g.artifact_expectation,
    risk_gate_eligibility: g.risk_gate_eligibility,
    source_status: g.source_status,
  };
}

function buildReportData() {
  const pkg = readJson(PACKAGE_PATH);
  const testCommand = pkg && pkg.scripts && pkg.scripts.test;
  if (!testCommand) throw fail('PACKAGE_COMMAND_MISMATCH', 'package.json scripts.test missing');
  const globs = parseNodeTestGlobs(testCommand);
  const enumerated = enumerateDefaultCi(globs);

  const inv = readJson(CLASSIFICATION_PATH);
  const classResult = classifyDefault(inv, enumerated);
  const suppResult = validateSupplemental(inv, new Set(enumerated));

  const errors = [];

  if (classResult.unclassified.length > 0) errors.push({ code: 'UNCLASSIFIED_DEFAULT_PATH', detail: 'Unclassified default-CI paths: ' + classResult.unclassified.join(', ') });
  if (classResult.conflicts.length > 0) errors.push({ code: 'DUPLICATE_PATH', detail: 'Conflicting classification: ' + classResult.conflicts.join(', ') });
  if (classResult.invalidCategory.length > 0) errors.push({ code: 'UNKNOWN_ENUM', detail: 'Invalid layer: ' + classResult.invalidCategory.join(', ') });
  if (classResult.emptyRationale.length > 0) errors.push({ code: 'LAYER_RECONCILIATION_MISMATCH', detail: 'Empty rationale: ' + classResult.emptyRationale.join(', ') });
  if (classResult.stale.length > 0) errors.push({ code: 'STALE_PATH', detail: 'Stale default entries: ' + classResult.stale.join(', ') });

  if (suppResult.stale.length > 0) errors.push({ code: 'STALE_PATH', detail: 'Stale supplemental: ' + suppResult.stale.join(', ') });
  if (suppResult.duplicates.length > 0) errors.push({ code: 'DUPLICATE_PATH', detail: 'Duplicate supplemental: ' + suppResult.duplicates.join(', ') });
  if (suppResult.inDefaultCi.length > 0) errors.push({ code: 'DEFAULT_SUPPLEMENTAL_CONFLICT', detail: 'Supplemental in default-CI: ' + suppResult.inDefaultCi.join(', ') });
  if (suppResult.invalid.length > 0) errors.push({ code: 'UNKNOWN_ENUM', detail: 'Invalid supplemental: ' + suppResult.invalid.join(', ') });
  if (suppResult.emptyRationale.length > 0) errors.push({ code: 'LAYER_RECONCILIATION_MISMATCH', detail: 'Supplemental empty rationale: ' + suppResult.emptyRationale.join(', ') });
  if (suppResult.invalidCapabilities.length > 0) errors.push({ code: 'LAYER_RECONCILIATION_MISMATCH', detail: 'Supplemental invalid capabilities: ' + suppResult.invalidCapabilities.join(', ') });

  const reg = readJson(REGISTRY_PATH);
  validateRegistrySchema(reg);

  const ciRaw = fs.readFileSync(CI_YML_PATH, 'utf8');

  try {
    checkVerifyStaticExact(ciRaw);
  } catch (e) {
    errors.push({ code: e.code || 'WORKFLOW_COMMAND_MISMATCH', detail: e.message });
  }

  const dbResult = checkDbCommandsExactly(pkg, Array.isArray(inv.supplemental) ? inv.supplemental : []);
  if (dbResult.errors.length > 0) {
    errors.push({ code: 'PACKAGE_COMMAND_MISMATCH', detail: 'DB-engine command mismatch: ' + dbResult.errors.join('; ') });
  }

  let realLocalInfo;
  try {
    realLocalInfo = checkRealLocalMembership(reg, inv, enumerated);
  } catch (e) {
    errors.push({ code: e.code || 'OVERLAPPING_MEMBERSHIP', detail: e.message });
  }

  if (errors.length > 0) {
    const primaryCode = errors[0].code;
    const primaryDetail = errors[0].detail;
    const err = fail(primaryCode, primaryDetail);
    err._allErrors = errors;
    throw err;
  }

  const defaultTotal = enumerated.length;
  const suppTotal = Array.isArray(inv.supplemental) ? inv.supplemental.length : 0;
  const suppPython = inv.supplemental ? inv.supplemental.filter(s => s.layer === 'SUPPLEMENTAL_PYTHON').length : 0;
  const suppDbEngine = inv.supplemental ? inv.supplemental.filter(s => s.layer === 'DB_ENGINE_EXECUTION').length : 0;

  const groupResults = [];
  for (const g of reg.groups) {
    groupResults.push(buildGroupResult(g, classResult.counts, defaultTotal, suppPython, suppDbEngine,
      realLocalInfo ? realLocalInfo.browserCount : 0,
      realLocalInfo ? realLocalInfo.processCount : 0));
  }

  return {
    schema_version: reg.schema_version,
    baseline_sha: reg.baseline_sha,
    default_total: defaultTotal,
    layer_counts: classResult.counts,
    supplemental_total: suppTotal,
    supplemental_python: suppPython,
    supplemental_db_engine: suppDbEngine,
    duplicate_supplemental: suppResult.inDefaultCi.length,
    unclassified_default: classResult.unclassified.length,
    conflicts: classResult.conflicts.length,
    stale_default: classResult.stale.length,
    stale_supplemental: suppResult.stale.length,
    db_engine_script_count: dbResult.scriptCount,
    verify_static_command_count: 4,
    groups: groupResults,
    valid: true,
  };
}

function buildHumanOutput(data) {
  const lines = [];
  lines.push('LoveBud execution-group registry report');
  lines.push('Schema version: ' + data.schema_version);
  lines.push('Baseline SHA: ' + data.baseline_sha);
  lines.push('');
  lines.push('Default-CI summary:');
  lines.push('  Total: ' + data.default_total);
  for (const v of VOCABULARY) {
    const c = data.layer_counts[v] || 0;
    lines.push('  ' + v + ': ' + c);
  }
  lines.push('');
  lines.push('Supplemental summary:');
  lines.push('  Total: ' + data.supplemental_total);
  lines.push('  SUPPLEMENTAL_PYTHON: ' + data.supplemental_python);
  lines.push('  DB_ENGINE_EXECUTION: ' + data.supplemental_db_engine);
  lines.push('  Duplicate (in default-CI): ' + data.duplicate_supplemental);
  lines.push('');
  lines.push('Classification health:');
  lines.push('  Unclassified default: ' + data.unclassified_default);
  lines.push('  Conflicting: ' + data.conflicts);
  lines.push('  Stale default entries: ' + data.stale_default);
  lines.push('  Stale supplemental: ' + data.stale_supplemental);
  lines.push('');
  lines.push('Execution groups (canonical order):');
  for (const g of data.groups) {
    lines.push('  ' + g.group + ': ' + g.count + (g.group === 'FULL_DEFAULT_REGRESSION' ? ' (aggregate)' : ''));
    lines.push('    membership: ' + g.membership_source);
    lines.push('    command: ' + g.command_reference);
    lines.push('    runtime: ' + g.runtime);
    lines.push('    platform: ' + g.platform);
    lines.push('    capabilities: ' + (g.capabilities.length > 0 ? g.capabilities.join(', ') : 'none'));
    lines.push('    default PR state: ' + g.default_pr_execution_state);
    lines.push('    artifact: ' + g.artifact_expectation);
    lines.push('    risk eligibility: ' + g.risk_gate_eligibility);
    lines.push('    source status: ' + g.source_status);
  }
  lines.push('');
  lines.push('DB-engine script references: ' + data.db_engine_script_count + '/7');
  lines.push('Verify-static command references: ' + data.verify_static_command_count);
  lines.push('');
  lines.push('Validation: PASS');
  return lines.join('\n');
}

function buildJsonOutput(data) {
  return JSON.stringify(data, null, 2);
}

function run() {
  const args = process.argv.slice(2);
  let jsonMode = false;
  if (args.length === 0) {
    jsonMode = false;
  } else if (args.length === 1 && args[0] === '--json') {
    jsonMode = true;
  } else {
    console.error('UNSUPPORTED_ARGUMENT: Supported arguments: (none) or --json');
    process.exitCode = 1;
    return;
  }

  try {
    const data = buildReportData();
    if (jsonMode) {
      process.stdout.write(buildJsonOutput(data) + '\n');
    } else {
      process.stdout.write(buildHumanOutput(data) + '\n');
    }
  } catch (e) {
    const msg = sanitizedErrorCode(e.code || 'INTERNAL_ERROR', e.message);
    console.error(msg);
    process.exitCode = 1;
    if (e._allErrors) {
      for (const sub of e._allErrors.slice(1)) {
        console.error(sanitizedErrorCode(sub.code, sub.detail));
      }
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  readJson,
  validateRegistrySchema,
  parseNodeTestGlobs,
  validateGlobShape,
  enumerateDefaultCi,
  classifyDefault,
  validateSupplemental,
  getDbEngineScriptRefs,
  checkDbCommandsExactly,
  getVerifyStaticCommands,
  checkVerifyStaticExact,
  checkRealLocalMembership,
  buildGroupResult,
  buildReportData,
  buildHumanOutput,
  buildJsonOutput,
  run,
  sanitizedErrorCode,
  ROOT,
  REGISTRY_PATH,
  CLASSIFICATION_PATH,
  PACKAGE_PATH,
  CI_YML_PATH,
};
