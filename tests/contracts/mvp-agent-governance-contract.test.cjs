'use strict';

/**
 * Contract: canonical MVP agent governance (Issue #3443, authorized by
 * #3442 comment `4947327550`).
 *
 * This is a SOURCE_STATIC contract: it reads repository governance Markdown
 * and agent-guidance files and asserts on structure, canonical markers, and
 * the absence of de-escalated automatic-blocker mandates. It does not execute
 * runtime code, launch a browser, connect to a database or network, deploy, or
 * mutate production.
 *
 * Validation strategy (bounded-section / canonical-marker based, not a single
 * naive string scan):
 *  - The canonical document must declare authority, the 6 hard rules, the
 *    allowed-by-default list, the evidence model, and the new-restriction
 *    protocol.
 *  - Each active entrypoint must link the canonical document and must NOT
 *    retain any of the specific automatic-blocker mandates that were
 *    de-escalated. NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT / SUPERSEDED markers
 *    are stripped before the banned-mandate check so historical quotes do not
 *    false-positive.
 *  - New restriction protocol: any paragraph in active normative guidance that
 *    asserts an unconditional mandatory blocker/approval/stop requirement must
 *    carry an escape marker (traceable owner-approval provenance, named
 *    destructive/secret/security/other-worker context, RECOMMENDATION_ONLY,
 *    NON_NORMATIVE/SUPERSEDED, or clear advisory wording).
 *  - Regression: active guidance must not contain repeated general merge
 *    approval requirements (e.g., "Merge requires CTO approval").
 *  - Regression: no blanket prohibition of all production test-data mutation,
 *    while destructive production mutation approval protection is retained.
 *
 * Refs: #3443, #3442, #3441, #3437, #3435, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const CANONICAL = 'docs/ops/MVP_AGENT_GOVERNANCE.md';

// All 11 active guidance entrypoints from Issue #3443
const ACTIVE_DOCS = [
  'AGENTS.md',
  '.kilocode/rules/00-lovebud-global.md',
  'docs/ops/AGENT_INSTRUCTION_POLICY.md',
  'docs/ops/WORK_RISK_TIER_POLICY.md',
  'docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md',
  'docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md',
  'docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md',
  'docs/ops/BROWSER_VERIFICATION_URL_POLICY.md',
  'docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md',
  'docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md',
  'docs/project/AGENT_OPERATION_GUARDRAILS.md',
];

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// Strip paragraphs that are explicitly classified as non-normative so that
// historical quotes inside them do not count as current active rules.
function normative(text) {
  const paras = text.split(/\n\n+/);
  const kept = paras.filter(
    (p) =>
      !/NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT|SUPERSEDED_BY_MVP_AGENT_GOVERNANCE/.test(p)
  );
  return kept.join('\n\n');
}

// ─── Marker and trigger helpers for B.2 (new restriction protocol) ───────────

// Mandate verbs that indicate an unconditional requirement
const MANDATE_VERB_RE = /\b(must not|must|do not|don't|shall not|required|requires|may not|prohibited|forbidden|금지|禁止|cannot)\b/i;

// Escalation terms that indicate an approval/blocker/stop gate
const ESCALATION_RE = /\b(requires?\s+(explicit\s+)?(CTO\s+|owner\s+)?approval|approval\s+(is\s+)?required|without\s+(explicit\s+)?approval|permission\s+gate|must\s+(stop|halt|cease)|stop\s+(and\s+report|work|immediately)|is\s+(BLOCKED|blocked)|are\s+(BLOCKED|blocked)|not\s+allowed\s+to\s+proceed)\b/i;

// Escape markers that legitimize a new restriction
const MARKERS = [
  // M1: traceable owner-approval provenance/reference
  /#3442|4947327550|owner[- ]approved|approval\s+comment|provenance|refs\s+#344/i,
  // M2: explicitly named destructive production context
  /destructive\s+production|production\s+(data|schema|security)[\s-]?(deletion|change|mutation|write|delete)|production\s+security[- ]policy/i,
  // M3: secret/private-data context
  /secret|token|cookie|credential|password|private\s+(data|payload|content)|firebase|authorization\s+header/i,
  // M4: security-policy context
  /security[- ]policy|security\s+rule|csrf|cors|security[- ]control/i,
  // M5: destructive other-worker-work context
  /another\s+worker|other\s+worker|other\s+PR|main\s+(branch|direct)|git\s+(clean|reset|stash)|slot\s+(branch|custodian)|occupied\s+slot|uncommitted\s+work|destructively|--force|force[- ]push/i,
  // M6: RECOMMENDATION_ONLY
  /RECOMMENDATION_ONLY/,
  // M7: NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT
  /NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT/,
  // M8: SUPERSEDED_BY_MVP_AGENT_GOVERNANCE
  /SUPERSEDED_BY_MVP_AGENT_GOVERNANCE/,
  // M9: clear advisory / not-an-automatic-blocker wording
  /not\s+an\s+automatic\s+(blocker|permission\s+gate|mandatory)|not\s+a\s+(blocker|permission\s+gate)|advisory|allowed\s+by\s+default|by\s+default|not\s+mandatory|not\s+an\s+automatic\s+BLOCKED/i,
];

function hasNewRestriction(paragraph) {
  return MANDATE_VERB_RE.test(paragraph) && ESCALATION_RE.test(paragraph);
}

function hasMarker(paragraph) {
  return MARKERS.some((m) => m.test(paragraph));
}

// ─── 1. Canonical document: authority & approval ───────────────────────────

test('canonical document exists and declares owner approval provenance', () => {
  const src = read(CANONICAL);
  assert.ok(src.includes('4947327550'), 'must cite owner approval comment 4947327550');
  assert.ok(/canonical source of truth/i.test(src), 'must declare itself canonical source of truth');
  assert.ok(/Authority/i.test(src), 'must have an Authority section');
});

// ─── 2. Canonical document: hard standing rules ─────────────────────────────

test('canonical document lists the six approved hard standing rules', () => {
  const src = read(CANONICAL);
  const rules = src;
  assert.ok(/raw secrets|secret[s]?, tokens|private payloads/i.test(rules), 'hard rule: secret/private-data protection');
  assert.ok(/another worker|other worker/i.test(rules), 'hard rule: other-worker work preservation');
  assert.ok(/destructive production|production .*approval/i.test(rules), 'hard rule: destructive production mutation approval');
  assert.ok(/CI is red|CI red|expected PR head SHA/i.test(rules), 'hard rule: CI / expected-head merge safety');
  assert.ok(/#1882/.test(rules), 'hard rule: #1882 protection');
  // count enumerated hard rules (lines starting with a digit in the Hard section)
  const hardSection = src.split('## Hard standing rules')[1].split('## Allowed by default')[0];
  const numbered = (hardSection.match(/^\d+\./gm) || []).length;
  assert.equal(numbered, 6, `expected exactly 6 enumerated hard rules, found ${numbered}`);
});

// ─── 3. Canonical document: allowed by default ────────────────────────────────

test('canonical document allows normal browser/development by default', () => {
  const src = read(CANONICAL);
  assert.ok(/Allowed by default/i.test(src), 'must have Allowed by default section');
  const allowed = src.split('## Allowed by default')[1].split('## Advisory')[0];
  for (const term of ['browser', 'login', 'production', 'PR preview', 'localhost', 'Playwright', 'DevTools']) {
    assert.ok(new RegExp(term, 'i').test(allowed), `allowed-by-default must mention ${term}`);
  }
});

// ─── 4. Canonical document: de-escalated items are NOT automatic blockers ───

test('canonical document states de-escalated items are not automatic blockers', () => {
  const src = read(CANONICAL);
  const adv = src.split('## Advisory, not blockers')[1].split('## Evidence model')[0];
  for (const term of [
    'one task per branch',
    'draft PR by default',
    'fixed slot',
    'Browser verification entrypoint',
    'CTO-assigned URL',
  ]) {
    assert.ok(new RegExp(term, 'i').test(adv), `advisory section must mention ${term}`);
  }
  // explicit negative statements
  assert.ok(/dirty worktree[^.]*not an automatic/i.test(src), 'dirty worktree must be stated non-automatic blocker');
  assert.ok(/fixed slot[^.]*not an automatic|evidence option/i.test(src), 'fixed slot must be stated non-automatic blocker');
  assert.ok(/entrypoint comment[^.]*not an automatic/i.test(src), 'entrypoint comment must be stated non-automatic blocker');
  assert.ok(/draft[^.]*not an automatic/i.test(src), 'draft must be stated non-automatic blocker');
  assert.ok(/one task per branch[^.]*not an automatic/i.test(src), 'one-task-per-branch must be stated non-automatic blocker');
});

// ─── 5. Canonical document: evidence model ────────────────────────────────────

test('canonical document defines the three evidence labels', () => {
  const src = read(CANONICAL);
  for (const label of ['LOCAL_EVIDENCE', 'PRE_MERGE_EVIDENCE', 'PRODUCTION_EVIDENCE']) {
    assert.ok(src.includes(label), `must define evidence label ${label}`);
  }
  assert.ok(/Evidence model/i.test(src), 'must have Evidence model section');
});

// ─── 6. Canonical document: new restriction protocol ──────────────────────────

test('canonical document defines the new-restriction approval protocol', () => {
  const src = read(CANONICAL);
  assert.ok(/New restriction protocol/i.test(src), 'must have New restriction protocol section');
  assert.ok(/traceable owner approval reference/i.test(src), 'must require traceable owner approval reference');
  assert.ok(src.includes('RECOMMENDATION_ONLY'), 'must define RECOMMENDATION_ONLY for unapproved restrictions');
});

// ─── 7. Active entrypoints link canonical and defer ──────────────────────────

for (const rel of ACTIVE_DOCS) {
  test(`active entrypoint links canonical governance: ${rel}`, () => {
    const src = read(rel);
    assert.ok(
      src.includes('MVP_AGENT_GOVERNANCE.md'),
      `${rel} must link docs/ops/MVP_AGENT_GOVERNANCE.md`
    );
    assert.ok(/canonical/i.test(src), `${rel} must reference canonical precedence`);
  });
}

// ─── 8. De-escalated automatic-blocker regression (bounded, stripped) ─────────

// Doc-specific mandates that were de-escalated. None of these may survive in
// the active (normative) layer of the corresponding document.
const BANNED = {
  'AGENTS.md': [
    '한 작업은 하나의 브랜치에서 수행합니다.',
    'PR은 기본적으로 draft로 생성합니다.',
    '최종 browser PASS는 실제 Cloudflare Preview URL 또는 할당된 test slot에서만 수행합니다.',
    'dirty worktree 상태에서는 작업을 중단하고 clean 환경을 준비합니다.',
  ],
  '.kilocode/rules/00-lovebud-global.md': [
    'One task per branch.\n',
    'Create PRs as draft by default.\n',
    'Production site `https://lovebud.pages.dev/` must not be used for pre-merge verification.\n',
    'Final browser PASS only on actual Cloudflare Preview URL or assigned test slot.\n',
    'Stop work in a dirty worktree and prepare a clean environment.\n',
  ],
  'docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md': [
    'If a required value is missing, the result is `BLOCKED`, not guessed.',
    'Final status: BLOCKED — missing Browser verification entrypoint comment',
    '- production URL before merge\n',
    '- missing Browser verification entrypoint comment\n',
  ],
  'docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md': [
    '- Do not use a fixed test slot unless CTO assigns that slot to the current PR/task.\n',
    'If a local working tree is dirty before the task begins, stop and report `BLOCKED`.',
    '1. A URL explicitly provided by CTO in the task prompt.\n',
    '- production URL unless CTO requests production verification;\n',
    '- Draft to ready transition requires CTO instruction or explicit task authorization.\n',
  ],
  'docs/ops/BROWSER_VERIFICATION_URL_POLICY.md': [
    'URL provenance가 불명확하면 browser verification은 PASS가 아니라 BLOCKED 또는 not run이다.',
    'If no CTO-provided URL or confirmed current PR Preview URL is available, report browser verification as `not run` or `BLOCKED`, not PASS.',
  ],
  'docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md': [
    'Final status: BLOCKED_SLOT_DECISION_MISSING',
    '5. If no slot was assigned, stop with BLOCKED_SLOT_DECISION_MISSING.',
  ],
  'docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md': [
    '15. If no fixed slot, browser result status:',
    'If dirty, STOP performed:',
    'STOP immediately.\n- Do not commit.',
    'Merge requires CTO approval acknowledged:',
  ],
  'docs/ops/AGENT_INSTRUCTION_POLICY.md': [],
  'docs/project/AGENT_OPERATION_GUARDRAILS.md': [
    'final PASS requires the required fixed-slot/SHA-match evidence unless a user or CTO explicitly downgrades',
  ],
  'docs/ops/WORK_RISK_TIER_POLICY.md': [
    'If uncertain, choose the higher tier. Do not ask for confirmation unless the issue scope is genuinely ambiguous or blocked.',
  ],
  'docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md': [],
};

for (const rel of Object.keys(BANNED)) {
  test(`de-escalated automatic-blocker mandate removed from active layer: ${rel}`, () => {
    const norm = normative(read(rel));
    for (const banned of BANNED[rel]) {
      assert.ok(
        !norm.includes(banned),
        `${rel} still contains de-escalated mandate in active layer: ${JSON.stringify(banned).slice(0, 80)}`
      );
    }
  });
}

// ─── 9. Cross-cutting: no active doc blanket-bans browser tooling ────────────

test('no active doc blanket-bans browser tab/window/navigation/login', () => {
  for (const rel of ACTIVE_DOCS.concat([
    'docs/ops/BROWSER_VERIFICATION_URL_POLICY.md',
    'docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md',
    'docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md',
    'docs/project/AGENT_OPERATION_GUARDRAILS.md',
    'docs/ops/WORK_RISK_TIER_POLICY.md',
  ])) {
    const norm = normative(read(rel));
    assert.ok(
      !/must not (start|open|use) a browser|browser .*prohibited|opening a (new )?tab.*forbidden|login.*is forbidden|navigation.*forbidden/i.test(norm),
      `${rel} contains a blanket browser/tab/window/navigation/login ban in active layer`
    );
  }
});

test('no active doc blanket-bans production URL usage', () => {
  for (const rel of [
    'AGENTS.md',
    '.kilocode/rules/00-lovebud-global.md',
    'docs/ops/BROWSER_VERIFICATION_URL_POLICY.md',
    'docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md',
    'docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md',
  ]) {
    const norm = normative(read(rel));
    assert.ok(
      !/production (URL|site).{0,80}(must not be used|prohibited|forbidden|금지|not be used as)/i.test(norm),
      `${rel} still blanket-bans production URL usage in active layer`
    );
  }
});

// ─── 10. B.2: New restriction protocol — bounded active-layer contract ────────

function getHardRule3() {
  const src = read(CANONICAL);
  // Get the full Hard standing rules section
  const hardSection = src.split('## Hard standing rules')[1].split('## Allowed by default')[0];
  // Rule 3 spans two lines; join them
  const lines = hardSection.split('\n');
  const rule3Lines = [];
  let inRule3 = false;
  for (const line of lines) {
    if (/^\s*3\./.test(line)) {
      inRule3 = true;
    }
    if (inRule3) {
      rule3Lines.push(line.trim());
      if (/requires owner approval/.test(line)) break;
    }
  }
  return rule3Lines.join(' ');
}

test('new restriction protocol: canonical hard rule #3 has marker (sanity check)', () => {
  const rule3 = getHardRule3();
  assert.ok(rule3, 'canonical hard rule #3 should exist');
  assert.ok(hasNewRestriction(rule3), 'canonical hard rule #3 should trigger new-restriction detector');
  assert.ok(hasMarker(rule3), 'canonical hard rule #3 should carry M2 (destructive production) marker');
});

// ─── 11. B.3: Merge approval regression (focused) ────────────────────────────

test('no active guidance contains repeated general merge approval requirement', () => {
  const mergeApprovalRE = /merge\s+requires\s+(explicit\s+)?(CTO\s+|owner\s+)?approval|repeated\s+(owner|CTO)\s+approval\s+required\s+for\s+routine\s+merge|repeated\s+CTO\s+approval\s+required/i;
  for (const rel of ACTIVE_DOCS) {
    const norm = normative(read(rel));
    assert.ok(
      !mergeApprovalRE.test(norm),
      `${rel} contains a repeated general merge approval requirement in active layer`
    );
  }
});

// ─── 12. B.4: Production test-data mutation blanket prohibition regression ─────

test('active guidance does not blanket-prohibit all production test-data mutation', () => {
  const blanketProdBanRE = /do\s+not\s+mutate\s+production\s+data\.?|prohibit(s)?\s+(all\s+)?production\s+(test\s+)?data|production\s+data\s+mutation\s+is\s+(prohibited|forbidden)/i;
  for (const rel of ACTIVE_DOCS) {
    const norm = normative(read(rel));
    assert.ok(
      !blanketProdBanRE.test(norm),
      `${rel} contains a blanket prohibition of all production test-data mutation in active layer`
    );
  }
});

test('destructive production mutation approval protection is retained in canonical document', () => {
  const src = read(CANONICAL);
  // Search in full text (rule 3 spans two lines)
  assert.ok(
    /destructive\s+production\s+(data|schema|security)[\s\S]*?(requires|approval)/i.test(src),
    'canonical document must retain destructive production mutation approval protection (Hard rule #3)'
  );
});

test('LOCAL_BROWSER_VERIFICATION_STARTUP.md distinguishes destructive production mutation from ordinary task-scoped test data', () => {
  const src = read('docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md');
  // Must have owner-approval requirement for destructive/out-of-scope production mutation
  assert.ok(
    /destructive|out-of-scope|out of scope|owner\s+approval|approval\s+required/i.test(src),
    'LOCAL_BROWSER must require owner approval for destructive/out-of-scope production mutation'
  );
  // Must explicitly allow ordinary task-scoped test-data create/edit/delete
  assert.ok(
    /ordinary\s+task-scoped\s+test-data|task-scoped\s+test\s+data|test-data\s+create\/edit\/delete|test\s+data.*allowed|ordinary\s+test\s+data/i.test(src),
    'LOCAL_BROWSER must explicitly allow ordinary task-scoped test-data mutation'
  );
});