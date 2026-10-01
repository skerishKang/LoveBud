#!/usr/bin/env node

'use strict';

/**
 * LoveBud Node runtime policy guard (Issue #4534).
 *
 * Reads the machine-readable Node runtime policy in
 * config/node-runtime-policy.json and fails closed when:
 *   - an active `actions/setup-node` occurrence in .github/workflows/*.yml is
 *     unregistered, or its node-version / count drifted from the policy;
 *   - a registered occurrence no longer exists in the workflows;
 *   - a setup-node step has no literal node-version (missing, node-version-file,
 *     or a ${{ }} expression);
 *   - a uses line names actions/setup-node in a shape outside the supported
 *     grammar (unparseable quoting or extra tokens) - never a silent skip;
 *     the supported shapes are plain, single-quoted and double-quoted values,
 *     each with an optional trailing `# comment`;
 *   - a uses line uses YAML anchors/aliases in a shape the guard cannot
 *     resolve to a single action reference (an unresolved alias could point at
 *     actions/setup-node), which fails closed as INDIRECT_USES_UNRESOLVED;
 *   - a scope reason source is missing or lost its required token;
 *   - the human-readable policy document is missing or stops naming the scopes;
 *   - .nvmrc, .node-version, or package.json#engines appears as an undeclared
 *     second runtime authority.
 *
 * Source-only: filesystem reads of repository-owned files. No network, provider,
 * database, browser, git, or Production access, and no mutation. Error messages
 * never echo raw YAML line content.
 *
 * Refs #4534.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const POLICY_RELATIVE_PATH = 'config/node-runtime-policy.json';
const WORKFLOWS_RELATIVE_DIR = '.github/workflows';
const PACKAGE_JSON_RELATIVE_PATH = 'package.json';

const DECISION_ENUM = ['EXPLICIT_MULTI_VERSION_MATRIX', 'SINGLE_VERSION'];
const WORKFLOW_FILE_REGEX = /\.ya?ml$/i;
// A `uses:` mapping key. Its value is read by parseUsesValue below, which
// accepts the supported actions/setup-node shapes (plain, single-quoted,
// double-quoted, optional inline comment) and classifies any other
// setup-node-like shape as unparsed instead of skipping the line.
const USES_LINE_REGEX = /^[ \t]*(?:-\s*)?uses:[ \t]*(.*)$/;
const SETUP_NODE_MENTION_REGEX = /^["']?actions\/setup-node(?![\w-])/;
const SETUP_NODE_TARGET_REGEX = /^actions\/setup-node(?:@[A-Za-z0-9._/-]+)?$/;
const INLINE_COMMENT_REGEX = /[ \t]#/;
// YAML anchor/alias forms on a uses line. A definition with a readable action
// value and an alias that resolves to one are parsed; any other indirect shape
// fails closed, because an unresolved alias could point at actions/setup-node.
const ANCHOR_DEFINITION_REGEX = /^&([A-Za-z0-9_-]+)(?:[ \t]+([\s\S]*))?$/;
const ALIAS_USE_REGEX = /^\*([A-Za-z0-9_-]+)$/;
const INDIRECT_TOKEN_REGEX = /[&*][A-Za-z0-9_-]/;
const STEP_KEY_REGEX = /^[ \t]*([A-Za-z_][A-Za-z0-9_-]*):/;
const NEW_LIST_ITEM_REGEX = /^[ \t]*-\s/;
const NODE_VERSION_FILE_REGEX = /^[ \t]*node-version-file:[ \t]*(.*)$/;
const NODE_VERSION_REGEX = /^[ \t]*node-version:[ \t]*(.*)$/;
// Loose fallback hint, only consulted after the strict key scans above fail: a
// line that mentions node-version at all but in a shape the guard cannot read
// (e.g. flow mapping) must fail closed as unparsed rather than as absent.
const NODE_VERSION_HINT_REGEX = /node-version(-file)?[ \t]*:/;
const VERSION_SHAPE_REGEX = /^\d+(?:\.\d+){0,2}$/;
const DYNAMIC_EXPRESSION_REGEX = /\$\{\{/;
const SCAN_WINDOW_LINES = 12;
const SPACES_REGEX = /^[ \t]*/;

function normalizeVersion(raw) {
  const trimmed = String(raw == null ? '' : raw).trim();
  if (
    trimmed.length >= 2 &&
    (trimmed.startsWith("'") || trimmed.startsWith('"')) &&
    trimmed.endsWith(trimmed[0])
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readJsonFile(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { ok: false, code: 'POLICY_FILE_UNREADABLE', value: null };
  }
  try {
    return { ok: true, code: null, value: JSON.parse(source) };
  } catch (error) {
    return { ok: false, code: 'POLICY_JSON_MALFORMED', value: null };
  }
}

function listWorkflowFiles(repoRoot) {
  const dir = path.join(repoRoot, WORKFLOWS_RELATIVE_DIR);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return { ok: false, files: [], code: 'WORKFLOW_DIRECTORY_UNREADABLE' };
  }
  const files = entries
    .filter((entry) => entry.isFile() && WORKFLOW_FILE_REGEX.test(entry.name))
    .map((entry) => `${WORKFLOWS_RELATIVE_DIR}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));
  return { ok: true, files, code: null };
}

/**
 * Parse the value of a `uses:` line into { kind, value }.
 *
 * Supported shapes: plain `actions/setup-node@v7`, double-quoted and
 * single-quoted values, each with an optional trailing `# comment`. A `#` only
 * starts an inline comment when preceded by whitespace, matching YAML.
 * Recognized but unsupported shapes are classified (malformed / unterminated /
 * empty) so the caller can fail closed instead of skipping the line.
 */
function parseUsesValue(rawValue) {
  const trimmed = String(rawValue == null ? '' : rawValue).trim();
  if (trimmed === '') return { kind: 'empty', value: '' };

  const quote = trimmed[0];
  if (quote === '"' || quote === "'") {
    const closeIndex = trimmed.indexOf(quote, 1);
    if (closeIndex === -1) return { kind: 'unterminated', value: trimmed.slice(1) };
    const value = trimmed.slice(1, closeIndex);
    const tail = trimmed.slice(closeIndex + 1).trim();
    if (tail !== '' && !tail.startsWith('#')) return { kind: 'malformed', value };
    return { kind: 'quoted', value };
  }

  const commentIndex = trimmed.search(INLINE_COMMENT_REGEX);
  const value = (commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex)).trim();
  if (value === '') return { kind: 'empty', value: '' };
  return { kind: 'plain', value };
}

/**
 * Classify a parsed uses value against actions/setup-node.
 *   'absent'    - the line does not name actions/setup-node;
 *   'supported' - exactly the action, with an optional @ref;
 *   'unparsed'  - the action is visible but outside the supported grammar.
 * 'unparsed' must fail closed: a shape the guard cannot prove is never skipped.
 */
function classifySetupNodeUse(parsed) {
  const value = parsed && typeof parsed.value === 'string' ? parsed.value : '';
  if (!SETUP_NODE_MENTION_REGEX.test(value)) return 'absent';
  if (parsed.kind !== 'plain' && parsed.kind !== 'quoted') return 'unparsed';
  if (!SETUP_NODE_TARGET_REGEX.test(value)) return 'unparsed';
  return 'supported';
}

/**
 * Reduce one parsed `uses:` value to a scanner outcome.
 *
 * Outcomes: { kind: 'occurrence' } for a supported actions/setup-node use (the
 * caller then reads its node-version), { kind: 'absent' } for a value that
 * provably is not actions/setup-node, or { kind: 'problem', code, detail }.
 *
 * Anchor definitions on a uses line (`&name actions/setup-node@vN`) are parsed
 * and remembered in `anchorActions`; aliases (`*name`) resolve against that
 * table and are counted as occurrences with their own node-version. Any other
 * anchor/alias shape fails closed instead of being skipped.
 */
function resolveUsesValue(parsed, anchorActions) {
  const value = parsed && typeof parsed.value === 'string' ? parsed.value : '';
  const reducible = Boolean(parsed) && (parsed.kind === 'plain' || parsed.kind === 'quoted');

  const anchorMatch = reducible ? ANCHOR_DEFINITION_REGEX.exec(value) : null;
  if (anchorMatch) {
    const name = anchorMatch[1];
    const remainder = anchorMatch[2];
    if (remainder == null || remainder.trim() === '') {
      anchorActions.set(name, 'unreadable');
      return {
        kind: 'problem',
        code: 'INDIRECT_USES_UNRESOLVED',
        detail: 'uses defines a YAML anchor with no readable action value',
      };
    }
    const inner = parseUsesValue(remainder);
    if (inner.kind !== 'plain' && inner.kind !== 'quoted') {
      anchorActions.set(name, 'unreadable');
      if (SETUP_NODE_MENTION_REGEX.test(inner.value)) {
        return {
          kind: 'problem',
          code: 'UNPARSED_SETUP_NODE_USE',
          detail: 'uses defines an anchor for actions/setup-node in a form the guard cannot parse',
        };
      }
      return {
        kind: 'problem',
        code: 'INDIRECT_USES_UNRESOLVED',
        detail: 'uses defines a YAML anchor whose action value cannot be read',
      };
    }
    if (SETUP_NODE_TARGET_REGEX.test(inner.value)) {
      anchorActions.set(name, 'setup-node');
      return { kind: 'occurrence' };
    }
    if (SETUP_NODE_MENTION_REGEX.test(inner.value)) {
      anchorActions.set(name, 'unreadable');
      return {
        kind: 'problem',
        code: 'UNPARSED_SETUP_NODE_USE',
        detail: 'uses defines an anchor for actions/setup-node in a form the guard cannot parse',
      };
    }
    if (INDIRECT_TOKEN_REGEX.test(inner.value)) {
      anchorActions.set(name, 'unreadable');
      return {
        kind: 'problem',
        code: 'INDIRECT_USES_UNRESOLVED',
        detail: 'uses defines a nested anchor/alias the guard cannot resolve',
      };
    }
    anchorActions.set(name, 'other');
    return { kind: 'absent' };
  }

  const aliasMatch = reducible ? ALIAS_USE_REGEX.exec(value) : null;
  if (aliasMatch) {
    const resolved = anchorActions.get(aliasMatch[1]);
    if (resolved === 'setup-node') return { kind: 'occurrence' };
    if (resolved === 'other') return { kind: 'absent' };
    return {
      kind: 'problem',
      code: 'INDIRECT_USES_UNRESOLVED',
      detail: 'uses aliases a YAML anchor the guard cannot resolve to a single action',
    };
  }

  const classification = classifySetupNodeUse(parsed);
  if (classification === 'supported') return { kind: 'occurrence' };
  if (classification === 'unparsed') {
    return {
      kind: 'problem',
      code: 'UNPARSED_SETUP_NODE_USE',
      detail:
        'uses names actions/setup-node in a form the guard cannot parse; write actions/setup-node@vN, optionally quoted, without extra tokens',
    };
  }
  if (INDIRECT_TOKEN_REGEX.test(value)) {
    return {
      kind: 'problem',
      code: 'INDIRECT_USES_UNRESOLVED',
      detail: 'uses uses an anchor/alias shape the guard cannot resolve; write the action inline',
    };
  }
  return { kind: 'absent' };
}

/**
 * Pure scanner: every `actions/setup-node` occurrence in one workflow source.
 * Accepts plain, single-quoted and double-quoted `uses:` values with optional
 * trailing comments, plus anchor definitions and aliases that resolve to a
 * single action value. Returns { occurrences, problems } and never throws on
 * malformed YAML; a shape it cannot prove is reported as a problem (including
 * UNPARSED_SETUP_NODE_USE and INDIRECT_USES_UNRESOLVED) instead of being
 * ignored.
 */
function collectSetupNodeOccurrences(source, workflowPath) {
  const lines = String(source == null ? '' : source).split(/\r?\n/);
  const occurrences = [];
  const problems = [];
  const anchorActions = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const usesMatch = USES_LINE_REGEX.exec(line);
    if (!usesMatch) continue;

    const usesIndent = line.match(SPACES_REGEX)[0].length;
    const lineNumber = index + 1;
    const resolution = resolveUsesValue(parseUsesValue(usesMatch[1]), anchorActions);

    // Only a value that provably is not actions/setup-node is skipped here.
    if (resolution.kind === 'absent') continue;
    if (resolution.kind === 'problem') {
      problems.push({
        code: resolution.code,
        workflow: workflowPath,
        line: lineNumber,
        detail: resolution.detail,
      });
      continue;
    }

    let nodeVersion = null;
    let versionFile = null;
    let versionHint = false;

    const windowEnd = Math.min(lines.length, index + 1 + SCAN_WINDOW_LINES);
    for (let cursor = index + 1; cursor < windowEnd; cursor += 1) {
      const candidate = lines[cursor];
      const trimmed = candidate.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      if (NEW_LIST_ITEM_REGEX.test(candidate)) break;

      const indent = candidate.match(SPACES_REGEX)[0].length;
      const keyMatch = STEP_KEY_REGEX.exec(candidate);
      const key = keyMatch ? keyMatch[1] : null;
      if (indent <= usesIndent && key && key !== 'with') break;

      const versionFileMatch = NODE_VERSION_FILE_REGEX.exec(candidate);
      if (versionFileMatch) {
        versionFile = normalizeVersion(versionFileMatch[1]);
        break;
      }

      const versionMatch = NODE_VERSION_REGEX.exec(candidate);
      if (versionMatch) {
        nodeVersion = normalizeVersion(versionMatch[1]);
        break;
      }

      if (NODE_VERSION_HINT_REGEX.test(candidate)) {
        versionHint = true;
      }
    }

    if (versionFile !== null) {
      problems.push({
        code: 'SETUP_NODE_VERSION_FILE_UNSUPPORTED',
        workflow: workflowPath,
        line: lineNumber,
        detail: 'actions/setup-node must use a literal node-version, not node-version-file',
      });
      continue;
    }

    if (nodeVersion === null) {
      problems.push({
        code: versionHint ? 'SETUP_NODE_VERSION_UNPARSED' : 'SETUP_NODE_WITHOUT_VERSION',
        workflow: workflowPath,
        line: lineNumber,
        detail: 'actions/setup-node step has no readable literal node-version',
      });
      continue;
    }

    if (nodeVersion === '') {
      problems.push({
        code: 'SETUP_NODE_VERSION_EMPTY',
        workflow: workflowPath,
        line: lineNumber,
        detail: 'actions/setup-node node-version is empty',
      });
      continue;
    }

    if (DYNAMIC_EXPRESSION_REGEX.test(nodeVersion) || !VERSION_SHAPE_REGEX.test(nodeVersion)) {
      problems.push({
        code: 'SETUP_NODE_VERSION_DYNAMIC_UNSUPPORTED',
        workflow: workflowPath,
        line: lineNumber,
        detail: 'actions/setup-node node-version must be a literal numeric version',
      });
      continue;
    }

    occurrences.push({
      workflow: workflowPath,
      node_version: nodeVersion,
      line: lineNumber,
    });
  }

  return { occurrences, problems };
}

function countByKey(entries, keyOf) {
  const counts = new Map();
  for (const entry of entries) {
    const key = keyOf(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function readOptionalFile(repoRoot, relativePath) {
  try {
    return { exists: true, source: fs.readFileSync(path.join(repoRoot, relativePath), 'utf8') };
  } catch (error) {
    return { exists: false, source: '' };
  }
}

function evaluatePolicyShape(policy, problems) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'policy root must be an object' });
    return false;
  }
  if (typeof policy.schema_version !== 'string' || policy.schema_version.trim() === '') {
    problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'schema_version must be a non-empty string' });
  }
  if (!DECISION_ENUM.includes(policy.decision)) {
    problems.push({
      code: 'POLICY_DECISION_UNKNOWN',
      detail: `decision must be one of ${DECISION_ENUM.join(', ')}`,
    });
  }
  if (!Array.isArray(policy.scopes) || policy.scopes.length === 0) {
    problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'scopes must be a non-empty array' });
    return false;
  }
  if (!Array.isArray(policy.workflow_occurrences)) {
    problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'workflow_occurrences must be an array' });
    return false;
  }
  for (const scope of policy.scopes) {
    if (!scope || typeof scope.id !== 'string' || scope.id.trim() === '') {
      problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'every scope needs a non-empty id' });
      continue;
    }
    const version = normalizeVersion(scope.node_version);
    if (!VERSION_SHAPE_REGEX.test(version)) {
      problems.push({
        code: 'POLICY_SCHEMA_INVALID',
        detail: `scope ${scope.id} node_version must be a literal numeric version`,
      });
    }
  }
  return true;
}

function evaluateScopes(policy, problems) {
  const scopeById = new Map();
  for (const scope of policy.scopes) {
    if (scopeById.has(scope.id)) {
      problems.push({ code: 'POLICY_SCOPE_DUPLICATE', detail: `scope ${scope.id} is declared twice` });
      continue;
    }
    scopeById.set(scope.id, scope);
  }

  const defaultScope = scopeById.get(policy.default_scope_id);
  if (!defaultScope) {
    problems.push({
      code: 'POLICY_DEFAULT_SCOPE_UNKNOWN',
      detail: 'default_scope_id must reference a declared scope',
    });
  } else if (normalizeVersion(defaultScope.node_version) !== normalizeVersion(policy.default_node_version)) {
    problems.push({
      code: 'POLICY_DEFAULT_VERSION_MISMATCH',
      detail: 'default_node_version must equal the default scope node_version',
    });
  }

  const defaultVersion = normalizeVersion(policy.default_node_version);
  for (const scope of policy.scopes) {
    const version = normalizeVersion(scope.node_version);
    if (scope.id !== policy.default_scope_id && version === defaultVersion) {
      problems.push({
        code: 'POLICY_SCOPE_NOT_DISTINCT',
        detail: `scope ${scope.id} repeats the default runtime and is not a scoped exception`,
      });
    }
  }

  const versionsById = new Map();
  for (const scope of policy.scopes) {
    versionsById.set(scope.id, normalizeVersion(scope.node_version));
  }
  return { scopeById, versionsById, defaultScope };
}

function evaluateReasonSources(repoRoot, policy, problems) {
  for (const scope of policy.scopes) {
    const sources = Array.isArray(scope.reason_sources) ? scope.reason_sources : [];
    if (sources.length === 0) {
      problems.push({
        code: 'SCOPE_REASON_SOURCE_MISSING',
        detail: `scope ${scope.id} must name at least one reason source`,
      });
      continue;
    }
    for (const source of sources) {
      const relativePath = source && typeof source.path === 'string' ? source.path : '';
      if (relativePath === '') {
        problems.push({
          code: 'SCOPE_REASON_SOURCE_MISSING',
          detail: `scope ${scope.id} has a reason source without a path`,
        });
        continue;
      }
      const read = readOptionalFile(repoRoot, relativePath);
      if (!read.exists) {
        problems.push({
          code: 'SCOPE_REASON_SOURCE_MISSING',
          detail: `scope ${scope.id} reason source does not exist: ${relativePath}`,
        });
        continue;
      }
      const token = source && typeof source.required_token === 'string' ? source.required_token : '';
      if (token === '' || !read.source.includes(token)) {
        problems.push({
          code: 'SCOPE_REASON_TOKEN_MISSING',
          detail: `scope ${scope.id} reason source no longer contains its required token: ${relativePath}`,
        });
      }
    }
  }
}

function evaluateHumanDoc(repoRoot, policy, problems) {
  if (typeof policy.human_doc !== 'string' || policy.human_doc.trim() === '') {
    problems.push({ code: 'HUMAN_DOC_MISSING', detail: 'policy must name a human_doc path' });
    return;
  }
  const read = readOptionalFile(repoRoot, policy.human_doc);
  if (!read.exists) {
    problems.push({ code: 'HUMAN_DOC_MISSING', detail: `human document is missing: ${policy.human_doc}` });
    return;
  }
  const requiredTokens = [String(policy.decision)];
  for (const scope of policy.scopes) {
    requiredTokens.push(String(scope.id));
    requiredTokens.push(normalizeVersion(scope.node_version));
  }
  for (const token of requiredTokens) {
    if (!read.source.includes(token)) {
      problems.push({
        code: 'HUMAN_DOC_TOKEN_MISSING',
        detail: `human document must mention ${token}`,
      });
    }
  }
}

function evaluateUndeclaredVersionSources(repoRoot, policy, problems) {
  const declared = Array.isArray(policy.undeclared_version_sources)
    ? policy.undeclared_version_sources
    : [];
  for (const entry of declared) {
    const relativePath = entry && typeof entry.path === 'string' ? entry.path : '';
    if (relativePath === '') {
      problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'undeclared_version_sources entry needs a path' });
      continue;
    }
    if (entry.must_be_absent !== true) continue;
    if (relativePath === `${PACKAGE_JSON_RELATIVE_PATH}#engines`) {
      const parsed = readJsonFile(path.join(repoRoot, PACKAGE_JSON_RELATIVE_PATH));
      if (!parsed.ok) {
        problems.push({
          code: 'UNDECLARED_VERSION_SOURCE_UNREADABLE',
          detail: `${PACKAGE_JSON_RELATIVE_PATH} could not be parsed`,
        });
        continue;
      }
      if (parsed.value && Object.prototype.hasOwnProperty.call(parsed.value, 'engines')) {
        problems.push({
          code: 'UNDECLARED_VERSION_SOURCE_PRESENT',
          detail: 'package.json#engines must stay absent while the policy declares it undeclared',
        });
      }
      continue;
    }
    const read = readOptionalFile(repoRoot, relativePath);
    if (read.exists) {
      problems.push({
        code: 'UNDECLARED_VERSION_SOURCE_PRESENT',
        detail: `undeclared runtime version source present: ${relativePath}`,
      });
    }
  }
}

function evaluateOccurrences(policy, observed, problems, workflowFiles) {
  const registered = Array.isArray(policy.workflow_occurrences) ? policy.workflow_occurrences : [];
  const { scopeById, versionsById } = evaluateScopes(policy, problems);
  const declaredVersions = new Set(versionsById.values());
  const workflowFileSet = new Set(workflowFiles || []);

  for (const registration of registered) {
    const workflow = registration && typeof registration.workflow === 'string' ? registration.workflow : '';
    if (workflow === '') {
      problems.push({ code: 'POLICY_SCHEMA_INVALID', detail: 'every registration needs a workflow path' });
      continue;
    }
    if (workflowFileSet.size > 0 && !workflowFileSet.has(workflow)) {
      problems.push({
        code: 'REGISTERED_WORKFLOW_MISSING',
        detail: `registered workflow does not exist: ${workflow}`,
      });
    }
    const scope = scopeById.get(registration.scope_id);
    if (!scope) {
      problems.push({
        code: 'REGISTRATION_SCOPE_UNKNOWN',
        detail: `registration for ${workflow} references an unknown scope`,
      });
      continue;
    }
    const version = normalizeVersion(registration.node_version);
    if (versionsById.get(scope.id) !== version) {
      problems.push({
        code: 'REGISTRATION_VERSION_SCOPE_MISMATCH',
        detail: `registration for ${workflow} version does not match scope ${scope.id}`,
      });
    }
    if (!Number.isInteger(registration.count) || registration.count < 1) {
      problems.push({
        code: 'POLICY_SCHEMA_INVALID',
        detail: `registration for ${workflow} needs a positive integer count`,
      });
    }
    if (!declaredVersions.has(version)) {
      problems.push({
        code: 'NODE_VERSION_NOT_DECLARED',
        detail: `registration for ${workflow} uses an undeclared Node version`,
      });
    }
  }

  const observedCounts = countByKey(observed, (entry) => `${entry.workflow}::${entry.node_version}`);
  const registeredCounts = new Map();
  for (const registration of registered) {
    if (!registration || typeof registration.workflow !== 'string') continue;
    const key = `${registration.workflow}::${normalizeVersion(registration.node_version)}`;
    registeredCounts.set(key, registration.count);
  }

  const keys = [...new Set([...observedCounts.keys(), ...registeredCounts.keys()])].sort();
  for (const key of keys) {
    const seen = observedCounts.get(key) || 0;
    const expected = registeredCounts.get(key) || 0;
    if (seen === expected) continue;
    const [workflow, version] = key.split('::');
    // Direction matters: more occurrences than registered is an unregistered
    // drift; fewer than registered is a disappeared registration.
    problems.push({
      code: seen > expected ? 'UNREGISTERED_WORKFLOW_OCCURRENCE' : 'REGISTERED_OCCURRENCE_MISSING',
      detail:
        expected === 0
          ? `unregistered setup-node occurrence: ${workflow} Node ${version} (${seen} seen)`
          : `registration/${workflow} Node ${version} expects ${expected}, found ${seen}`,
    });
  }

  for (const observedEntry of observed) {
    if (!declaredVersions.has(observedEntry.node_version)) {
      problems.push({
        code: 'NODE_VERSION_NOT_DECLARED',
        detail: `active workflow uses an undeclared Node version: ${observedEntry.workflow}`,
      });
    }
  }

  const referencedScopes = new Set(
    registered.map((registration) => registration && registration.scope_id).filter(Boolean)
  );
  for (const scope of policy.scopes) {
    if (!referencedScopes.has(scope.id)) {
      problems.push({
        code: 'SCOPE_UNREFERENCED',
        detail: `scope ${scope.id} is not referenced by any workflow occurrence`,
      });
    }
  }
}

/**
 * Evaluate the policy against workflow sources.
 * options: { repoRoot, policy, workflows: [{ workflow, source }] }
 * When `workflows` is omitted the real .github/workflows directory is read.
 */
function evaluateNodeRuntimePolicy(options) {
  const settings = options || {};
  const repoRoot = settings.repoRoot || REPO_ROOT;
  const policy = settings.policy;
  const problems = [];
  const occurrences = [];

  if (!evaluatePolicyShape(policy, problems)) {
    return {
      ok: false,
      status: 'FAIL',
      codes: [...new Set(problems.map((problem) => problem.code))].sort(),
      problems,
      occurrences,
      workflowCount: 0,
      occurrenceCount: 0,
      scopes: [],
    };
  }

  if (Array.isArray(settings.workflows)) {
    for (const entry of settings.workflows) {
      const scanned = collectSetupNodeOccurrences(entry.source, entry.workflow);
      occurrences.push(...scanned.occurrences);
      problems.push(...scanned.problems);
    }
    evaluateOccurrences(policy, occurrences, problems, settings.workflows.map((entry) => entry.workflow));
  } else {
    const listed = listWorkflowFiles(repoRoot);
    if (!listed.ok) {
      problems.push({ code: listed.code, detail: 'workflow directory could not be enumerated' });
      evaluateOccurrences(policy, occurrences, problems, []);
    } else {
      for (const workflow of listed.files) {
        const read = readOptionalFile(repoRoot, workflow);
        if (!read.exists) {
          problems.push({ code: 'WORKFLOW_FILE_UNREADABLE', detail: `workflow could not be read: ${workflow}` });
          continue;
        }
        const scanned = collectSetupNodeOccurrences(read.source, workflow);
        occurrences.push(...scanned.occurrences);
        problems.push(...scanned.problems);
      }
      evaluateOccurrences(policy, occurrences, problems, listed.files);
    }
  }

  evaluateReasonSources(repoRoot, policy, problems);
  evaluateHumanDoc(repoRoot, policy, problems);
  evaluateUndeclaredVersionSources(repoRoot, policy, problems);

  occurrences.sort((a, b) =>
    a.workflow === b.workflow ? a.line - b.line : a.workflow.localeCompare(b.workflow)
  );

  return {
    ok: problems.length === 0,
    status: problems.length === 0 ? 'PASS' : 'FAIL',
    codes: [...new Set(problems.map((problem) => problem.code))].sort(),
    problems,
    occurrences,
    workflowCount: new Set(occurrences.map((entry) => entry.workflow)).size,
    occurrenceCount: occurrences.length,
    scopes: policy.scopes.map((scope) => ({
      id: scope.id,
      node_version: normalizeVersion(scope.node_version),
    })),
    decision: policy.decision,
    default_node_version: normalizeVersion(policy.default_node_version),
    default_scope_id: policy.default_scope_id,
  };
}

/**
 * Convenience entry point: load the policy from disk (policy_path or
 * repoRoot/config/node-runtime-policy.json) and evaluate it.
 */
function checkNodeRuntimePolicy(options) {
  const settings = options || {};
  const repoRoot = settings.repoRoot || REPO_ROOT;
  const policyPath = settings.policyPath || path.join(repoRoot, POLICY_RELATIVE_PATH);
  const parsed = readJsonFile(policyPath);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 'FAIL',
      codes: [parsed.code],
      problems: [{ code: parsed.code, detail: `${POLICY_RELATIVE_PATH} could not be loaded` }],
      occurrences: [],
      workflowCount: 0,
      occurrenceCount: 0,
      scopes: [],
    };
  }
  return evaluateNodeRuntimePolicy({ ...settings, repoRoot, policy: parsed.value });
}

function main() {
  const result = checkNodeRuntimePolicy({});
  console.log('LoveBud Node runtime policy guard (#4534)');
  console.log(`policy: ${POLICY_RELATIVE_PATH}`);
  if (result.decision) console.log(`decision: ${result.decision}`);
  if (result.default_node_version) {
    console.log(`default runtime: Node ${result.default_node_version} (${result.default_scope_id})`);
  }
  console.log(
    `occurrences: ${result.workflowCount} workflow file(s), ${result.occurrenceCount} actions/setup-node step(s)`
  );
  for (const occurrence of result.occurrences) {
    console.log(`  - ${occurrence.workflow}: Node ${occurrence.node_version} (line ${occurrence.line})`);
  }
  if (result.ok) {
    console.log('NODE_RUNTIME_POLICY_STATUS: PASS');
    return true;
  }
  console.log('NODE_RUNTIME_POLICY_STATUS: FAIL');
  for (const problem of result.problems) {
    console.log(`  - ${problem.code}: ${problem.detail}`);
  }
  return false;
}

if (require.main === module) {
  try {
    process.exitCode = main() ? 0 : 1;
  } catch (error) {
    console.error('NODE_RUNTIME_POLICY_STATUS: FAIL');
    console.error(`  - NODE_RUNTIME_POLICY_GUARD_FATAL: ${error && error.name ? error.name : 'Error'}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DECISION_ENUM,
  PACKAGE_JSON_RELATIVE_PATH,
  POLICY_RELATIVE_PATH,
  REPO_ROOT,
  WORKFLOWS_RELATIVE_DIR,
  checkNodeRuntimePolicy,
  collectSetupNodeOccurrences,
  evaluateNodeRuntimePolicy,
  listWorkflowFiles,
  normalizeVersion,
};
