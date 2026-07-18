/**
 * Contract test for Merge-First Production Verification governance (Issue #3513).
 *
 * Verifies:
 * - Canonical document exists with required sections
 * - Pre-merge browser verification is OPTIONAL (not mandatory)
 * - Post-merge Production verification is the final confirmation step
 * - No active docs contain contradictory mandatory gate language
 * - Squash merge rules, rollback rules, role definitions
 * - 컴1-브 self-improvement restriction
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_PATH = path.join(ROOT, 'docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md');

// ---------------------------------------------------------------------------
// Historical/exempt files: archived docs that may reference old gates but are
// retained as historical evidence, not active policy.
// ---------------------------------------------------------------------------
const HISTORICAL_ALLOWLIST = new Set([
  path.join(ROOT, 'docs/ops/AGENTS.md'),
  path.join(ROOT, 'docs/ops/API_CONTRACT_MIGRATION.md'),
]);
const ARCHIVE_DIR = path.join(ROOT, 'docs/ops/archive');

// ---------------------------------------------------------------------------
// Forbidden patterns — all use /g flag for matchAll compatibility
// ---------------------------------------------------------------------------
const FORBIDDEN_PATTERNS = [
  { pattern: /\bfixed[-\s]?slot\b.*(?:required|mandatory|must).*before.*merge/ig, label: 'fixed-slot required before merge' },
  { pattern: /\bpreview\b.*(?:required|mandatory|must).*before.*merge/ig, label: 'preview required before merge' },
  { pattern: /browser.*pass.*(?:required|mandatory).*before.*merge/ig, label: 'browser PASS required before merge' },
  { pattern: /pre[-\s]?merge.*(?:authenticated|browser).*verification.*(?:required|mandatory|must)/ig, label: 'pre-merge auth browser verification required' },
  { pattern: /fixed[-\s]?slot.*absence.*(?:BLOCKED|blocked|차단|금지)/ig, label: 'fixed-slot absence blocked' },
  { pattern: /preview.*absence.*(?:BLOCKED|blocked|merge 금지|금지)/ig, label: 'preview absence blocked' },
  { pattern: /fixed[-\s]?slot.*(?:필수|없으면.*merge 금지|없으면.*차단)/ig, label: 'fixed-slot mandatory Korean' },
  { pattern: /(?:Preview|프리뷰).*(?:필수|없으면.*(?:BLOCKED|차단)|없으면.*merge 금지)/ig, label: 'Preview mandatory Korean' },
  { pattern: /(?:브라우저).*PASS.*(?:필수|없으면.*merge 금지)/ig, label: 'browser PASS mandatory Korean' },
  { pattern: /(?:병합 전|merge 전).*(?:Production|프로덕션).*검증/ig, label: 'Production verification before merge Korean' },
  { pattern: /Production.*verification.*(?:required|mandatory|must).*before.*merge/ig, label: 'Production verification before merge English' },
];

const ALLOWED_NEGATIONS = [
  /not required/i, /not mandatory/i, /not a merge blocker/i,
  /not a.*blocker/i,
  /not\b.*(?:required|mandatory|must)/i,
  /OPTIONAL/i, /NON_BLOCKING/i,
  /사용 가능할 때만/i, /부재는 merge blocker가 아니다/i,
  /superseded/i, /NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isHistorical(pathAbs) {
  return HISTORICAL_ALLOWLIST.has(pathAbs) || pathAbs.startsWith(ARCHIVE_DIR);
}

function scanFileForViolations(filePath, content) {
  const violations = [];
  for (const fp of FORBIDDEN_PATTERNS) {
    const matches = content.matchAll(fp.pattern);
    for (const m of matches) {
      if (m.index !== undefined) {
        // Check 200 chars before AND the match text for negation phrases
        const start = Math.max(0, m.index - 200);
        const end = m.index + m[0].length;
        const context = content.slice(start, end);
        let isNegated = false;
        for (const neg of ALLOWED_NEGATIONS) {
          if (neg.test(context)) { isNegated = true; break; }
        }
        if (!isNegated) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          violations.push({ file: filePath, line: lineNum, pattern: fp.label, match: m[0].trim().slice(0, 120) });
        }
      }
    }
  }
  return violations;
}

function getActiveDocFiles() {
  const files = [];
  function addIfExists(p) { if (fs.existsSync(p)) files.push(p); }

  addIfExists(path.join(ROOT, 'AGENTS.md'));
  addIfExists(path.join(ROOT, '.kilocode/rules/00-lovebud-global.md'));

  const opsDir = path.join(ROOT, 'docs/ops');
  if (fs.existsSync(opsDir)) {
    for (const e of fs.readdirSync(opsDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.md')) {
        const p = path.join(opsDir, e.name);
        if (!isHistorical(p)) files.push(p);
      }
    }
  }
  // .github templates
  const ghDir = path.join(ROOT, '.github');
  if (fs.existsSync(ghDir)) {
    addIfExists(path.join(ROOT, '.github/PULL_REQUEST_TEMPLATE.md'));
    addIfExists(path.join(ROOT, '.github/copilot-instructions.md'));
    const issueDir = path.join(ROOT, '.github/ISSUE_TEMPLATE');
    if (fs.existsSync(issueDir)) {
      for (const f of fs.readdirSync(issueDir)) {
        if (f.endsWith('.md')) addIfExists(path.join(issueDir, f));
      }
    }
  }
  addIfExists(path.join(ROOT, 'CLAUDE.md'));
  return files;
}

// ===========================================================================
// TESTS
// ===========================================================================

test('canonical document exists', () => {
  assert.ok(fs.existsSync(CANONICAL_PATH), 'Canonical document missing');
});

const REQUIRED_SECTIONS = [
  'Merge-First Production Verification', 'Purpose', 'Current environment reality',
  'Current operating mode', 'Standard workflow', 'Mandatory pre-merge gates', 'Optional pre-merge gates',
  'Post-merge Production verification', 'Squash merge rules', 'Rollback rules',
  'Issue management', 'Agent role definitions', 'Self-improvement restriction',
];

for (const section of REQUIRED_SECTIONS) {
  test('canonical document contains section: ' + section, () => {
    const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
    assert.ok(doc.includes(section), 'Section "' + section + '" missing');
  });
}

test('canonical doc: pre-merge browser verification is OPTIONAL', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('OPTIONAL') && doc.includes('not a merge blocker'),
    'Must state OPTIONAL + not a merge blocker');
});

test('canonical doc: post-merge Production verification is final', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('post-merge') && doc.includes('Production'),
    'Must reference post-merge Production');
});

test('canonical doc:force-push/reset rollback prohibited', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  const ok = /force.*push.*금지|reset.*hard.*금지|main.*강제.*이동.*금지|force push.*prohibited|dedicated revert PR|force.*push.*used.*NO/i.test(doc);
  assert.ok(ok, 'Must forbid force-push/reset rollback');
});

test('canonical doc defines role separation (컴1/컴1-브/CTO)', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('컴1') || doc.includes('CTO') || doc.includes('컴1-브'),
    'Must define role separation');
});

test('canonical doc requires expected_head_sha squash merge', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('expected_head_sha'), 'Must require expected_head_sha');
});

test('canonical doc requires Production verification after merge', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('Production'), 'Must reference Production verification');
});

test('canonical doc refs #3513', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('#3513'), 'Must reference #3513');
});

test('canonical doc has version info', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('Version') || doc.includes('version'), 'Must have version');
});

test('canonical doc enforces dedicated revert PR rollback', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('revert'), 'Must mention revert PR');
});

test('canonical doc restricts 컴1-브 self-improvement', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(doc.includes('self-improvement') || doc.includes('SKILL.md'),
    'Must restrict self-improvement for 컴1-브');
});

test('AGENTS.md references new workflow', () => {
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md'),
    'AGENTS.md must reference merge-first workflow');
});

test('AGENTS.md marks browser verification as OPTIONAL', () => {
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('OPTIONAL'), 'AGENTS.md must mark browser verification OPTIONAL');
});

test('.kilocode rules reference new workflow', () => {
  const kc = fs.readFileSync(path.join(ROOT, '.kilocode/rules/00-lovebud-global.md'), 'utf8');
  assert.ok(kc.includes('MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md') || kc.includes('OPTIONAL'),
    '.kilocode must reference new workflow');
});

test('canonical doc preserves mandatory pre-merge gates', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(/local.*test/i.test(doc), 'Local tests must be mandatory gate');
  assert.ok(/\bCI\b/i.test(doc), 'CI must be mandatory gate');
  assert.ok(/expected_head_sha/i.test(doc), 'expected_head_sha must be required');
});

// ---------------------------------------------------------------------------
// #3513 clarify: merge-first default + no manual preview/fixed-slot by default
// ---------------------------------------------------------------------------

test('canonical doc: no manual preview/fixed-slot deploy by default', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(/기본적으로 PR Preview.*fixed test slot.*staging 배포를 수행하지 않는다/.test(doc)
    || /not normally performed/.test(doc),
    'Canonical doc must state no manual preview/fixed-slot deploy by default');
});

test('canonical doc: automatic main-to-Production deployment', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(/자동.*반영|automatically.*reflects main to Production|Cloudflare Pages.*automatically/i.test(doc),
    'Canonical doc must state automatic main-to-Production deployment');
});

test('canonical doc: future workflow switch requires explicit owner-approved policy change', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(/owner 승인.*canonical policy 변경|owner-approved policy change/i.test(doc),
    'Canonical doc must require owner-approved policy change before switching workflow');
});

test('canonical doc: failure rollback uses dedicated revert PR', () => {
  const doc = fs.readFileSync(CANONICAL_PATH, 'utf8');
  assert.ok(/실패한 squash merge.*dedicated revert PR|dedicated revert PR/.test(doc),
    'Canonical doc must state failure rollback uses dedicated revert PR');
});

test('kilocode rules: does not call pre-merge PR Preview the usual/default target', () => {
  const kc = fs.readFileSync(path.join(ROOT, '.kilocode/rules/00-lovebud-global.md'), 'utf8');
  assert.ok(!/Pre-merge PR Preview is the usual pre-merge target/i.test(kc),
    'Kilo rules must NOT call pre-merge PR Preview the usual/default target');
  assert.ok(/Merge-first Production verification is the current default/i.test(kc),
    'Kilo rules must state merge-first is the current default');
});

test('AGENTS.md: marks merge-first as current default and no manual preview by default', () => {
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(/Merge-first Production verification is the current default/i.test(agents),
    'AGENTS.md must mark merge-first as current default');
  assert.ok(/기본적으로 수행하지 않는다|not normally performed/i.test(agents),
    'AGENTS.md must state pre-merge preview not normally performed');
});

// ===========================================================================
// CROSS-DOC CONTRADICTION SCANNING
// ===========================================================================

test('scan active docs for contradictory mandatory gate language', () => {
  const activeFiles = getActiveDocFiles();
  assert.ok(activeFiles.length > 0, 'Active doc list must not be empty');

  const allViolations = [];
  for (const filePath of activeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = scanFileForViolations(filePath, content);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    const details = allViolations.map(function(v) {
      return '  ' + v.file + ' (line ' + v.line + '): matched "' + v.pattern + '" => "' + v.match + '"';
    }).join('\n');
    assert.fail('Found ' + allViolations.length + ' violation(s):\n' + details);
  }
});

test('active doc list includes canonical doc', () => {
  assert.ok(getActiveDocFiles().some(function(f) {
    return f.includes('MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md');
  }), 'Active doc list must include canonical document');
});

test('active doc list includes AGENTS.md', () => {
  assert.ok(getActiveDocFiles().some(function(f) {
    return f === path.join(ROOT, 'AGENTS.md');
  }), 'Active doc list must include AGENTS.md');
});

// ===========================================================================
// FIXTURE TESTS
// ===========================================================================

test('fixture: forbidden pattern detected', () => {
  assert.ok(scanFileForViolations('/fake/test.md', 'Fixed-slot PASS is required before merge').length > 0,
    'Forbidden pattern must be detected');
});

test('fixture: negation prevents detection', () => {
  assert.equal(scanFileForViolations('/fake/test.md',
    'Fixed-slot PASS is NOT required before merge. It is OPTIONAL.').length, 0,
    'Negation must prevent detection');
});

test('fixture: Korean forbidden detected', () => {
  assert.ok(scanFileForViolations('/fake/test.md',
    'fixed-slot PASS가 merge 전 필수').length > 0,
    'Korean forbidden must be detected');
});

test('fixture: Korean optional not detected', () => {
  assert.equal(scanFileForViolations('/fake/test.md',
    'fixed-slot의 부재는 merge blocker가 아닙니다. OPTIONAL입니다.').length, 0,
    'Korean optional must not be detected');
});

test('fixture: historical allowlist works', () => {
  assert.ok(isHistorical(path.join(ROOT, 'docs/ops/archive/x.md')), 'Archive must be historical');
  assert.ok(!isHistorical(path.join(ROOT, 'AGENTS.md')), 'AGENTS.md must not be historical');
});
