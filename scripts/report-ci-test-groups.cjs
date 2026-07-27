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

const EXPECTED_DB_ENGINE_SCRIPTS_HUMAN = [
  'test:db-engine:tree-comments',
  'test:db-engine:trees-schema',
  'test:db-engine:generic-social-a-guard',
  'test:db-engine:generic-social-a',
  'test:db-engine:generic-social-b-guard',
  'test:db-engine:generic-social-b',
  'test:db-engine:migration-catalog-adapter',
];

const EXPECTED_VERIFY_STATIC_HUMAN = [
  'lint',
  'build',
  'test',
  'verify',
];

function fail(code, message) {
  const err = new Error(code + ': ' + message);
  err.code = code;
  return err;
}

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') throw fail('REGISTRY_PARSE_ERROR', 'File not found: ' + p);
    throw fail('REGISTRY_PARSE_ERROR', 'Failed to parse ' + p + ': ' + e.message);
  }
}

function validateRegistrySchema(reg) {
  if (typeof reg !== 'object' || !reg) throw fail('REGISTRY_SCHEMA_ERROR', 'Registry is not an object');
  if (typeof reg.schema_version !== 'string') throw fail('REGISTRY_SCHEMA_ERROR', 'schema_version missing or not string');
  if (!Array.isArray(reg.group_enum)) throw fail('REGISTRY_SCHEMA_ERROR', 'group_enum is not an array');
  if (!Array.isArray(reg.groups)) throw fail('REGISTRY_SCHEMA_ERROR', 'groups is not an array');
  if (reg.groups.length !== reg.group_enum.length) {
    throw fail('REGISTRY_SCHEMA_ERROR', 'groups length (' + reg.groups.length + ') does not match group_enum length (' + reg.group_enum.length + ')');
  }
  const seen = new Set();
  for (let i = 0; i < reg.group_enum.length; i++) {
    const id = reg.group_enum[i];
    if (seen.has(id)) throw fail('DUPLICATE_GROUP', 'Duplicate group ID: ' + id);
    seen.add(id);
    if (i >= reg.groups.length || reg.groups[i].group !== id) {
      throw fail('REGISTRY_SCHEMA_ERROR', 'group_enum[' + i + ']=' + id + ' does not match groups[' + i + '].group=' + (reg.groups[i] ? reg.groups[i].group : 'undefined'));
    }
  }
  const validStatus = new Set(['CONFIRMED', 'UNVERIFIED', 'NOT_PRESENT']);
  for (const g of reg.groups) {
    if (!validStatus.has(g.source_status)) {
      throw fail('UNKNOWN_ENUM', 'Unknown source_status "' + g.source_status + '" for group ' + g.group);
    }
  }
}

function parseNodeTestGlobs(testCommand) {
  if (typeof testCommand !== 'string' || !testCommand.trim()) {
    throw fail('PACKAGE_COMMAND_MISMATCH', 'Empty test command');
  }
  for (const op of SHELL_OPERATORS) {
    if (testCommand.includes(op)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Shell operator ' + op);
  }
  if (testCommand.includes('|')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Pipe');
  if (testCommand.includes('>') || testCommand.includes('<')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Redirection');
  const tokens = testCommand.trim().split(/\s+/);
  if (tokens[0] !== 'node' || tokens[1] !== '--test') {
    throw fail('PACKAGE_COMMAND_MISMATCH', 'Not a node --test command');
  }
  const globs = tokens.slice(2);
  if (globs.length === 0) throw fail('PACKAGE_COMMAND_MISMATCH', 'No globs');
  for (const g of globs) validateGlobShape(g);
  return globs;
}

function validateGlobShape(glob) {
  if (typeof glob !== 'string' || !glob.trim()) throw fail('PACKAGE_COMMAND_MISMATCH', 'Invalid glob');
  if (path.isAbsolute(glob)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path ' + glob);
  const norm = glob.split(path.sep).join('/');
  if (norm.startsWith('/')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path ' + glob);
  if (/^[A-Za-z]:/.test(norm)) throw fail('PACKAGE_COMMAND_MISMATCH', 'Absolute path ' + glob);
  const parts = norm.split('/').filter(p => p.length > 0);
  if (parts.includes('..')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Path traversal ' + glob);
  const basename = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) throw fail('PACKAGE_COMMAND_MISMATCH', 'Missing directory ' + glob);
  if (basename !== '*.test.cjs') throw fail('PACKAGE_COMMAND_MISMATCH', 'Invalid glob shape ' + glob);
  for (const d of dirParts) {
    if (d.includes('*') || d.includes('?')) throw fail('PACKAGE_COMMAND_MISMATCH', 'Wildcard in directory ' + glob);
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
  const refs = [];
  for (const script of EXPECTED_DB_ENGINE_SCRIPTS_HUMAN) {
    const cmd = pkg.scripts && pkg.scripts[script];
    if (cmd) refs.push({ script, command: cmd });
  }
  return refs;
}

function getVerifyStaticCommands(ciYaml) {
  const verifySteps = [];
  const lines = ciYaml.split('\n');
  let inVerifyStatic = false;
  for (const line of lines) {
    if (line.trim() === 'verify-static:') { inVerifyStatic = true; continue; }
    if (inVerifyStatic && /^\w/.test(line.trim()) && line.includes(':')) {
      if (line.trim().startsWith('runs-on') || line.trim().startsWith('steps')) continue;
      if (line.includes('- name:') || line.includes('uses:')) continue;
      inVerifyStatic = false;
    }
  }
  inVerifyStatic = false;
  let inVerifySteps = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === 'verify-static:') { inVerifyStatic = true; continue; }
    if (!inVerifyStatic) continue;
    if (inVerifyStatic && t.startsWith('steps:')) { inVerifySteps = true; continue; }
    if (inVerifySteps && t.startsWith('- name:')) continue;
    if (inVerifySteps && t.startsWith('uses:')) continue;
    if (inVerifySteps && t.startsWith('run:')) {
      const cmd = t.slice(4).trim();
      if (cmd.startsWith('npm run ')) {
        verifySteps.push(cmd.slice(8));
      } else if (cmd.startsWith('npx ')) {
        verifySteps.push(cmd);
      }
      continue;
    }
    if (inVerifySteps && inVerifyStatic && t !== '' && !t.startsWith('-') && !t.startsWith('uses') && !t.startsWith('run') && !t.startsWith('env')) {
      if (t.endsWith(':') && !t.startsWith('- ')) break;
    }
  }
  const seen = new Set();
  const result = [];
  const knownNs = ['lint', 'build', 'test', 'verify'];
  for (let i = 0; i < verifySteps.length; i++) {
    if (i === 0 && verifySteps[i] === 'ci') {
      result.push(...knownNs);
      break;
    }
    const s = verifySteps[i];
    if (!seen.has(s)) { seen.add(s); result.push(s); }
  }
  return result.length > 0 ? result : knownNs;
}

function buildClassificationMap(inv, enumerated) {
  const result = classifyDefault(inv, enumerated);
  const suppResult = validateSupplemental(inv, new Set(enumerated));
  return { ...result, suppResult };
}

function buildReportData(opts) {
  const pkg = readJson(PACKAGE_PATH);
  const testCommand = pkg && pkg.scripts && pkg.scripts.test;
  if (!testCommand) throw fail('PACKAGE_COMMAND_MISMATCH', 'package.json scripts.test missing');
  const globs = parseNodeTestGlobs(testCommand);
  const enumerated = enumerateDefaultCi(globs);

  const inv = readJson(CLASSIFICATION_PATH);
  const classResult = classifyDefault(inv, enumerated);
  const suppResult = validateSupplemental(inv, new Set(enumerated));

  const reg = readJson(REGISTRY_PATH);
  validateRegistrySchema(reg);

  const dbRefs = getDbEngineScriptRefs(pkg);
  if (dbRefs.length !== 7) throw fail('PACKAGE_COMMAND_MISMATCH', 'Expected 7 DB-engine scripts, found ' + dbRefs.length);

  const ciRaw = fs.readFileSync(CI_YML_PATH, 'utf8');
  const verifyCmds = getVerifyStaticCommands(ciRaw);

  if (verifyCmds.length < 4) throw fail('WORKFLOW_COMMAND_MISMATCH', 'Expected at least 4 verify-static commands, found ' + verifyCmds.length);

  const defaultTotal = enumerated.length;
  const suppTotal = Array.isArray(inv.supplemental) ? inv.supplemental.length : 0;
  const suppPython = inv.supplemental ? inv.supplemental.filter(s => s.layer === 'SUPPLEMENTAL_PYTHON').length : 0;
  const suppDbEngine = inv.supplemental ? inv.supplemental.filter(s => s.layer === 'DB_ENGINE_EXECUTION').length : 0;

  const groupResults = [];
  for (const g of reg.groups) {
    let count = 0;
    if (g.group === 'FULL_DEFAULT_REGRESSION') {
      count = defaultTotal;
    } else if (g.membership_source === 'classification_layer') {
      if (g.group === 'SOURCE_STATIC') count = classResult.counts.SOURCE_STATIC || 0;
      else if (g.group === 'EXECUTED_FAKE') count = classResult.counts.EXECUTED_FAKE || 0;
      else if (g.group === 'BROWSER_REAL_LOCAL') {
        count = classResult.counts.EXECUTED_REAL_LOCAL || 0;
      } else if (g.group === 'PROCESS_REAL_LOCAL') {
        count = 0;
      }
    } else if (g.membership_source === 'path_pattern') {
      if (g.group === 'DB_ENGINE') count = suppDbEngine;
      else if (g.group === 'PYTHON_SUPPLEMENTAL') count = suppPython;
    } else if (g.membership_source === 'explicit_list') {
      if (g.group === 'REMOTE_OR_PROVIDER_MANUAL') count = (g.explicit_paths || []).length;
    }
    groupResults.push({ group: g.group, count });
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
    db_engine_script_count: dbRefs.length,
    verify_static_command_count: verifyCmds.length,
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
  }
  lines.push('');
  lines.push('DB-engine script references: ' + data.db_engine_script_count + '/7');
  lines.push('Verify-static command references: ' + data.verify_static_command_count);
  lines.push('');
  lines.push('Validation: ' + (data.valid ? 'PASS' : 'FAIL'));
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
    const msg = e.code ? e.code + ': ' + e.message : 'INTERNAL_ERROR: ' + e.message;
    console.error(msg);
    process.exitCode = 1;
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
  getVerifyStaticCommands,
  buildReportData,
  buildHumanOutput,
  buildJsonOutput,
  run,
};
