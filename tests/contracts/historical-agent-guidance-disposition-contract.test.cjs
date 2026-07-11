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

test('inventory tranche counts: >=6 NOW and >=13 DEFER', () => {
  const data = JSON.parse(read(INVENTORY));
  const now = data.inventory.filter((i) => i.tranche === 'NOW');
  const defer = data.inventory.filter((i) => i.tranche === 'DEFER');
  assert.ok(now.length >= 6, `expected >=6 NOW items, found ${now.length}`);
  assert.ok(defer.length >= 13, `expected >=13 DEFER items, found ${defer.length}`);
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

// ─── 9. This contract is source-static (no runtime/browser/network/DB/deploy)

test('contract is source-static: only reads files, no runtime execution', () => {
  // Sanity: referenced files exist; no child_process / network modules imported.
  for (const rel of [CANONICAL, INVENTORY, ...NOW_DOCS.map((d) => d.rel)]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `referenced file must exist: ${rel}`);
  }
  const self = read('tests/contracts/historical-agent-guidance-disposition-contract.test.cjs');
  assert.ok(!/require\(['"]child_process|require\(['"]http|require\(['"]https|require\(['"]playwright|require\(['"]puppeteer/i.test(self), 'contract must not import runtime/browser/network modules');
});
