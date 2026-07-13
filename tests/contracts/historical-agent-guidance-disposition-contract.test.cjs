'use strict';

/**
 * Contract: historical agent-restriction disposition (Issue #3445, authorized by
 * #3442 comment `4947327550`).
 *
 * This is a SOURCE_STATIC contract: it reads repository governance Markdown,
 * the historical-agent-restriction inventory JSON, and the agent-guidance index
 * files, and asserts on disposition markers, canonical links, preserved
 * historical body text, and the absence of re-introduced unconditional blockers.
 * It does NOT execute runtime code, launch a browser, connect to a database or
 * network, deploy, or mutate production.
 *
 * Refs: #3445, #3442, #3441, #3437, #3435, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const CANONICAL = 'docs/ops/MVP_AGENT_GOVERNANCE.md';
const INVENTORY = 'docs/audits/lovebud-historical-agent-restriction-inventory.json';

const DISPOSITION_MARKERS = [
  'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
  'SUPERSEDED_BY_MVP_AGENT_GOVERNANCE',
];

const REQUIRED_FIELDS = [
  'path',
  'heading',
  'line_start',
  'line_end',
  'summary',
  'current_reachability',
  'classification',
  'blocks',
  'owner_approval_reference',
  'recommended_disposition',
  'tranche',
  'reason',
];

const CLASSIFICATION_ALLOW = [
  'USER_APPROVED_STANDING_RULE',
  'HARD_SECURITY_OR_DATA_SAFETY',
  'CONTEXT_SPECIFIC_GUARDRAIL',
  'RECOMMENDATION_ONLY',
  'OVER_RESTRICTIVE_MVP_BLOCKER',
  'STALE_OR_SUPERSEDED',
  'DUPLICATE_OR_CONFLICTING',
];

const REACHABILITY_ALLOW = [
  'READ_FIRST',
  'INDEX_LINKED',
  'REFERENCED',
  'HISTORICAL_ONLY',
  'UNROUTED',
];

// NOW-tranche documents corrected in this work, with the historical body text
// that must be preserved (proving we did NOT delete/rewrite the body).
const NOW_DOCS = [
  {
    rel: 'docs/ops/EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'BLOCKED_SLOT_DECISION_MISSING',
  },
  {
    rel: 'docs/ops/ACTIVE_WORK_BOARD_POLICY.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'git status --short',
  },
  {
    rel: 'docs/ops/GITHUB_AUTH_TOKEN_USAGE.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'Merge is forbidden unless the CTO explicitly approves',
  },
  {
    rel: 'docs/ops/CLOUDFLARE_PREVIEW_PROVENANCE_RUNBOOK.md',
    marker: 'NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT',
    preserved: 'production URL used as pre-merge PR proof',
  },
  {
    // Index: no NON_NORMATIVE marker, but must carry canonical link + authority note.
    rel: 'docs/ops/ops_index.md',
    marker: null,
    preserved: 'MVP_AGENT_GOVERNANCE.md',
  },
  {
    rel: 'docs/doc_index.md',
    marker: null,
    preserved: 'MVP_AGENT_GOVERNANCE.md',
  },
];

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// ─── 1. Inventory JSON parses and carries required fields ──────────────────

test('inventory JSON parses and every entry has required fields', () => {
  const raw = read(INVENTORY);
  let data;
  assert.doesNotThrow(() => { data = JSON.parse(raw); }, 'inventory must be valid JSON');
  assert.ok(Array.isArray(data.inventory), 'inventory must have an items array');
  assert.ok(data.inventory.length >= 6, `expected at least 6 inventory items, found ${data.inventory.length}`);
  for (const item of data.inventory) {
    for (const f of REQUIRED_FIELDS) {
      assert.ok(f in item, `inventory item ${item.path || '?'} missing field ${f}`);
    }
    assert.ok(typeof item.line_start === 'number', `${item.path}.line_start must be number`);
    assert.ok(typeof item.line_end === 'number', `${item.path}.line_end must be number`);
    assert.ok(Array.isArray(item.blocks), `${item.path}.blocks must be array`);
    assert.ok(CLASSIFICATION_ALLOW.includes(item.classification), `${item.path}.classification ${item.classification} not allowed`);
    assert.ok(REACHABILITY_ALLOW.includes(item.current_reachability), `${item.path}.current_reachability ${item.current_reachability} not allowed`);
    assert.ok(['NOW', 'DEFER'].includes(item.tranche), `${item.path}.tranche ${item.tranche} not allowed`);
  }
});

// ─── 2. Tranche counts ─────────────────────────────────────────────────────

test('inventory exact tranche counts: 19 total, 6 NOW, 13 DEFER', () => {
  const data = JSON.parse(read(INVENTORY));
  const now = data.inventory.filter((i) => i.tranche === 'NOW');
  const defer = data.inventory.filter((i) => i.tranche === 'DEFER');
  assert.equal(data.inventory.length, 19, `expected exactly 19 inventory items, found ${data.inventory.length}`);
  assert.equal(now.length, 6, `expected exactly 6 NOW items, found ${now.length}`);
  assert.equal(defer.length, 13, `expected exactly 13 DEFER items, found ${defer.length}`);
  assert.equal(data.inventory.length, now.length + defer.length, 'total must equal NOW + DEFER');
});

// ─── 3. NOW items match the corrected documents ───────────────────────────

test('every NOW inventory item maps to a corrected document', () => {
  const data = JSON.parse(read(INVENTORY));
  const nowPaths = new Set(data.inventory.filter((i) => i.tranche === 'NOW').map((i) => i.path));
  for (const d of NOW_DOCS) {
    assert.ok(nowPaths.has(d.rel), `NOW inventory must include corrected doc ${d.rel}`);
  }
});

// ─── 4. Corrected docs carry disposition marker + canonical link ───────────

for (const d of NOW_DOCS) {
  test(`corrected doc carries canonical link and disposition marker: ${d.rel}`, () => {
    const src = read(d.rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${d.rel} must link canonical governance`);
    if (d.marker) {
      assert.ok(
        src.includes(d.marker),
        `${d.rel} must carry disposition marker ${d.marker}`
      );
    } else {
      // Index docs: must declare canonical authority explicitly.
      assert.ok(
        /Agent-governance authority/i.test(src),
        `${d.rel} must declare canonical agent-governance authority`
      );
    }
  });
}

// ─── 5. Historical body text is preserved (no destructive rewrite) ─────────

for (const d of NOW_DOCS) {
  test(`historical body preserved in corrected doc: ${d.rel}`, () => {
    const src = read(d.rel);
    assert.ok(
      src.includes(d.preserved),
      `${d.rel} must still contain historical body text "${d.preserved}" (body must not be deleted/rewritten)`
    );
  });
}

// ─── 6. Index/read-first lists do NOT present superseded docs as active authority

test('index/read-first lists declare canonical authority (no silent superseded authority)', () => {
  for (const idx of ['docs/ops/ops_index.md', 'docs/doc_index.md']) {
    const src = read(idx);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${idx} must reference canonical governance`);
    assert.ok(/Agent-governance authority/i.test(src), `${idx} must state canonical authority explicitly`);
    assert.ok(/not.*repo-wide automatic-blocker authority|superseded by/i.test(src), `${idx} must clarify de-escalated items are not repo-wide authority`);
  }
});

// ─── 7. Corrected docs do not re-introduce unconditional blockers ──────────
// They keep the historical text (preserved) but now under a non-normative
// marker; the contract asserts the disposition marker governs that text.

test('corrected substantive docs classify stale blocker language as non-normative', () => {
  for (const d of NOW_DOCS) {
    if (!d.marker) continue;
    const src = read(d.rel);
    // The preserved conflicting text and the disposition marker both exist in
    // the same document, i.e. the conflicting text is now explicitly scoped.
    assert.ok(src.includes(d.marker), `${d.rel} must scope conflicting text via ${d.marker}`);
    assert.ok(src.includes(d.preserved), `${d.rel} must preserve the conflicting text as historical record`);
  }
});

// ─── 8. Security / destructive-production hard rules retained ──────────────

test('secret-handling hard rule retained in GITHUB_AUTH_TOKEN_USAGE.md', () => {
  const src = read('docs/ops/GITHUB_AUTH_TOKEN_USAGE.md');
  assert.ok(/never print.*secret values/i.test(src), 'GITHUB_AUTH_TOKEN_USAGE must retain secret-handling prohibition');
  assert.ok(src.includes('SECURITY_INCIDENT_SECRET_EXPOSURE'), 'GITHUB_AUTH_TOKEN_USAGE must retain security-incident reporting');
});

test('destructive production mutation approval protection retained in canonical governance', () => {
  const src = read(CANONICAL);
  assert.ok(/destructive\s+production[\s\S]*?approval/i.test(src), 'canonical document must retain destructive production approval protection');
});

// ─── 10. Strengthened assertions (CTO correction #4948036193) ────────────
// Exact counts, path existence, valid line ranges, README survey coverage,
// NOW-set equality, and no self-referential approval provenance.

test('every inventory path exists on disk', () => {
  const data = JSON.parse(read(INVENTORY));
  for (const item of data.inventory) {
    assert.ok(fs.existsSync(path.join(ROOT, item.path)), `inventory path must exist: ${item.path}`);
  }
});

test('every inventory line range is valid against the real file', () => {
  const data = JSON.parse(read(INVENTORY));
  for (const item of data.inventory) {
    assert.ok(item.line_start >= 1, `${item.path}.line_start must be >= 1`);
    assert.ok(item.line_end >= item.line_start, `${item.path}.line_end must be >= line_start`);
    const abs = path.join(ROOT, item.path);
    const total = fs.readFileSync(abs, 'utf8').split('\n').length;
    assert.ok(item.line_end <= total, `${item.path}.line_end ${item.line_end} exceeds file total ${total}`);
  }
});

test('surveyMethod records root/subdirectory README coverage', () => {
  const data = JSON.parse(read(INVENTORY));
  assert.ok(/README\.md/i.test(data.surveyMethod), 'surveyMethod must mention README scanning');
  assert.ok(/no additional qualifying/i.test(data.surveyMethod), 'surveyMethod must record README scan result');
});

test('NOW path set exactly matches the corrected-document set', () => {
  const data = JSON.parse(read(INVENTORY));
  const nowPaths = new Set(data.inventory.filter((i) => i.tranche === 'NOW').map((i) => i.path));
  const expected = new Set(NOW_DOCS.map((d) => d.rel));
  assert.equal(nowPaths.size, expected.size, `NOW path set size mismatch: ${nowPaths.size} vs ${expected.size}`);
  for (const p of expected) {
    assert.ok(nowPaths.has(p), `NOW set must include ${p}`);
  }
});

test('no self-referential approval provenance (named in doc) remains', () => {
  const data = JSON.parse(read(INVENTORY));
  for (const item of data.inventory) {
    assert.ok(
      !/named in doc/i.test(item.owner_approval_reference || ''),
      `${item.path} must not use self-referential approval provenance, found: ${item.owner_approval_reference}`
    );
  }
});

// ─── 9. This contract is source-static (no runtime/browser/network/DB/deploy)

// ─── 11. Issue #3448 follow-up: de-escalated verification-target blockers ───
// These checks extend (not replace) the minimal first tranche. They must NOT
// change the 19/6/13 tranche counts (the two target entries remain DEFER).

const FOLLOWUP_DOCS = [
  'docs/ops/TEST_PREVIEW_SLOTS.md',
  'docs/ops/VERIFICATION_TARGET_ALLOWLIST.md',
];

test('Issue #3448: both target docs link canonical governance', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(src.includes('MVP_AGENT_GOVERNANCE.md'), `${rel} must link canonical governance`);
  }
});

test('Issue #3448: fixed-slot absence is not a whole-work automatic blocker', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    const deEscalated = /does not (make|block)[^.]{0,60}(whole task|whole project|unrelated work)|not a project-wide blocker|does not by itself (make|block)[^.]{0,40}(whole project|unrelated work)/i.test(src);
    assert.ok(deEscalated, `${rel} must state fixed-slot absence is not a whole-work blocker`);
  }
});

test('Issue #3448: production / PR Preview / localhost are not blanket-banned environments', () => {
  const blanketBanRE = /production (URL|site)[^.]{0,80}(must not (be )?used|prohibited|forbidden|금지)|PR Preview URL\(s\)\?[^.]{0,80}(prohibited|forbidden|must not)|localhost[^.]{0,60}(prohibited|forbidden|not valid|invalid for)/i;
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(!blanketBanRE.test(src), `${rel} must not blanket-ban production/PR Preview/localhost as environments`);
  }
});

test('Issue #3448: provenance/SHA uncertainty lowers claim status', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    const status = /NOT_VERIFIED|INVALID_FOR_TARGET_CLAIM|PARTIAL|FIXED_SLOT_NOT_ASSIGNED|NOT_VERIFIED_ON_FIXED_SLOT/i.test(src);
    assert.ok(status, `${rel} must lower claim status on provenance/SHA uncertainty`);
  }
});

test('Issue #3448: Netlify/lovebudold remains invalid for current Cloudflare runtime proof', () => {
  const src = read('docs/ops/VERIFICATION_TARGET_ALLOWLIST.md');
  assert.ok(/Netlify/.test(src) && /lovebudold/.test(src), 'allowlist must still reference Netlify/lovebudold');
  assert.ok(/Cloudflare \+ Modal active runtime/i.test(src), 'allowlist must still state Netlify cannot prove current runtime');
  assert.ok(/must not be presented as current-runtime proof/i.test(src), 'allowlist must forbid presenting Netlify as current-runtime proof');
});

test('Issue #3448: secret/token/cookie/private payload protection retained', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(/secret|token|cookie|private payload/i.test(src), `${rel} must retain secret/token/cookie/private-payload protection`);
  }
});

test('Issue #3448: production write/delete approval protection retained', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(/production[^.]{0,80}(write\/delete|mutation)[^.]{0,60}(prohibited|approval|without separate)/i.test(src), `${rel} must retain production write/delete approval protection`);
  }
});

test('Issue #3448: no permanent global PR #7 protection remains in target docs', () => {
  for (const rel of FOLLOWUP_DOCS) {
    const src = read(rel);
    assert.ok(!src.includes('PR #7'), `${rel} must not retain a permanent global PR #7 protection`);
  }
});

test('Issue #3448: inventory target entries carry #3448 follow-up disposition', () => {
  const data = JSON.parse(read(INVENTORY));
  const targets = data.inventory.filter(
    (i) => i.path === 'docs/ops/TEST_PREVIEW_SLOTS.md' || i.path === 'docs/ops/VERIFICATION_TARGET_ALLOWLIST.md'
  );
  assert.equal(targets.length, 2, 'expected exactly two #3448 target entries');
  for (const item of targets) {
    assert.equal(item.followup_issue, 3448, `${item.path} must carry followup_issue 3448`);
    assert.equal(item.followup_status, 'APPLIED', `${item.path} must carry followup_status APPLIED`);
    assert.equal(item.followup_disposition, 'PRESERVE_AS_EVIDENCE_QUALITY_GUIDANCE', `${item.path} must carry followup_disposition`);
    assert.equal(item.tranche, 'DEFER', `${item.path} must remain DEFER (snapshot meaning preserved)`);
  }
});

test('Issue #3448: this contract extension is source-static (no runtime/browser/network/DB/deploy)', () => {
  const self = read('tests/contracts/historical-agent-guidance-disposition-contract.test.cjs');
  assert.ok(!/require\(['"]child_process|require\(['"]http|require\(['"]https|require\(['"]playwright|require\(['"]puppeteer/i.test(self), 'contract must not import runtime/browser/network modules');
});

test('contract is source-static: only reads files, no runtime execution', () => {
  // Sanity: referenced files exist; no child_process / network modules imported.
  for (const rel of [CANONICAL, INVENTORY, ...NOW_DOCS.map((d) => d.rel)]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `referenced file must exist: ${rel}`);
  }
  const self = read('tests/contracts/historical-agent-guidance-disposition-contract.test.cjs');
  assert.ok(!/require\(['"]child_process|require\(['"]http|require\(['"]https|require\(['"]playwright|require\(['"]puppeteer/i.test(self), 'contract must not import runtime/browser/network modules');
});
