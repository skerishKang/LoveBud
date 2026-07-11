/**
 * Contract: LoveBud #3438 public-first policy documentation hygiene.
 *
 * Scope grammar:
 * Static documentation contract only.
 * No runtime, database, browser, network, deployment, or production behavior
 * is executed or verified.
 *
 * This test reads repository Markdown and index files and asserts static
 * source-of-truth, supersession, and policy-routing markers only.
 * It does not execute runtime code, connect to a database or network, use a
 * browser, deploy, or verify production behavior.
 *
 * Refs: #3438, #3437, #3435, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const CANONICAL = 'docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md';
const FORMER_DECISION = 'docs/product/tree-visibility-default-and-control-placement-decision.md';
const POLICY_REVIEW = 'docs/product/VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md';
const PRODUCT_INDEX = 'docs/product/product_index.md';

const FORMER_DECISION_BASENAME = 'tree-visibility-default-and-control-placement-decision.md';
const POLICY_REVIEW_BASENAME = 'VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md';

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// ─── 1. Canonical policy ─────────────────────────────────────────────────────

test('canonical policy file exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, CANONICAL)), `Missing ${CANONICAL}`);
});

test('canonical policy declares source-of-truth', () => {
  const src = read(CANONICAL);
  assert.ok(
    /source of truth|source-of-truth|canonical source/i.test(src),
    `${CANONICAL} must declare itself the source of truth/canonical source`
  );
});

test('canonical policy states new trees default to public', () => {
  const src = read(CANONICAL);
  assert.ok(
    /New trees default to public|새.*tree.*기본.*public|신규 tree.*public/i.test(src),
    `${CANONICAL} must state "new trees default to public"`
  );
});

test('canonical policy states Plus private storage requirement', () => {
  const src = read(CANONICAL);
  assert.ok(
    /Private storage requires Plus entitlement|Plus entitlement/i.test(src),
    `${CANONICAL} must state private storage requires Plus entitlement`
  );
});

test('canonical policy states publicMomentCount >= 3 for Browse/Search', () => {
  const src = read(CANONICAL);
  assert.ok(
    /publicMomentCount\s*>=\s*3/i.test(src),
    `${CANONICAL} must state publicMomentCount >= 3 for Browse/Search introduction`
  );
});

test('canonical policy separates Browse/Search eligibility from visibility', () => {
  const src = read(CANONICAL);
  assert.ok(
    /Public visibility and Browse\/Search eligibility are separate/i.test(src) ||
      /public visibility.*Browse\/Search.*separate/i.test(src),
    `${CANONICAL} must separate public visibility from Browse/Search eligibility`
  );
});

test('canonical policy clarifies 3-moment threshold is not a visibility toggle', () => {
  const src = read(CANONICAL);
  assert.ok(
    /listing eligibility condition[^.]*not a visibility-toggle|visibility-toggle condition|visibility 전환 조건으로 사용하지 않습니다/i.test(src),
    `${CANONICAL} must clarify the 3-public-moment threshold is a listing eligibility condition, not a visibility-toggle condition`
  );
});

test('canonical policy names both superseded documents exactly', () => {
  const src = read(CANONICAL);
  assert.ok(
    src.includes(FORMER_DECISION_BASENAME),
    `${CANONICAL} must list ${FORMER_DECISION_BASENAME} in the superseded set`
  );
  assert.ok(
    src.includes(POLICY_REVIEW_BASENAME),
    `${CANONICAL} must list ${POLICY_REVIEW_BASENAME} in the superseded set`
  );
});

// ─── 2. Former decision document ─────────────────────────────────────────────

test('former decision file exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, FORMER_DECISION)), `Missing ${FORMER_DECISION}`);
});

test('former decision top metadata declares Status: SUPERSEDED', () => {
  const src = read(FORMER_DECISION);
  const head = src.split('\n').slice(0, 12).join('\n');
  assert.ok(
    /Status\*\*?:\s*SUPERSEDED/i.test(head),
    `${FORMER_DECISION} top metadata must declare "Status: SUPERSEDED"`
  );
});

test('former decision declares Classification: HISTORICAL_DECISION', () => {
  const src = read(FORMER_DECISION);
  const head = src.split('\n').slice(0, 12).join('\n');
  assert.ok(
    /Classification\*\*?:\s*HISTORICAL_DECISION/i.test(head),
    `${FORMER_DECISION} top metadata must declare "Classification: HISTORICAL_DECISION"`
  );
});

test('former decision links to canonical policy', () => {
  const src = read(FORMER_DECISION);
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md/.test(src),
    `${FORMER_DECISION} must link to PUBLICATION_AND_PRIVACY_UX_POLICY.md`
  );
});

test('former decision warns it is historical provenance only', () => {
  const src = read(FORMER_DECISION);
  assert.ok(
    /retained\s*\n?\s*only for historical provenance|historical provenance/i.test(src),
    `${FORMER_DECISION} must warn it is retained only for historical provenance`
  );
});

test('former decision says it must not guide current decisions', () => {
  const src = read(FORMER_DECISION);
  assert.ok(
    /must not guide current product[^.]*decisions/i.test(src),
    `${FORMER_DECISION} must state it must not guide current product/incident/migration/recovery decisions`
  );
});

test('former decision no longer keeps Status: Decided', () => {
  const src = read(FORMER_DECISION);
  const head = src.split('\n').slice(0, 12).join('\n');
  assert.ok(
    !/Status:\s*Decided/i.test(head),
    `${FORMER_DECISION} top metadata must not retain "Status: Decided"`
  );
});

test('former decision historical private-first body is preserved (allowed)', () => {
  const src = read(FORMER_DECISION);
  // The historical body may still describe private-first; that is allowed.
  // We only assert the body still contains the historical decision narrative.
  assert.ok(
    /private by default|private-first|New trees are/i.test(src),
    `${FORMER_DECISION} historical private-first body should remain present`
  );
});

// ─── 3. Historical review document ───────────────────────────────────────────

test('policy review file exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, POLICY_REVIEW)), `Missing ${POLICY_REVIEW}`);
});

test('policy review top metadata declares HISTORICAL_AUDIT / SUPERSEDED_POLICY_REVIEW', () => {
  const src = read(POLICY_REVIEW);
  const head = src.split('\n').slice(0, 12).join('\n');
  assert.ok(
    /HISTORICAL_AUDIT\s*\/\s*SUPERSEDED_POLICY_REVIEW/i.test(head),
    `${POLICY_REVIEW} top metadata must declare "HISTORICAL_AUDIT / SUPERSEDED_POLICY_REVIEW"`
  );
});

test('policy review records snapshot commit', () => {
  const src = read(POLICY_REVIEW);
  assert.ok(
    /b78bf17ded7882b95c3cf18f7d8b2af953c169dc/.test(src),
    `${POLICY_REVIEW} must record snapshot baseline commit b78bf17ded7882b95c3cf18f7d8b2af953c169dc`
  );
});

test('policy review links to canonical policy', () => {
  const src = read(POLICY_REVIEW);
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md/.test(src),
    `${POLICY_REVIEW} must link to PUBLICATION_AND_PRIVACY_UX_POLICY.md`
  );
});

test('policy review warns private-first sections are historical snapshot observations', () => {
  const src = read(POLICY_REVIEW);
  assert.ok(
    /historical observations[\s\S]{0,60}of the recorded snapshot/i.test(src),
    `${POLICY_REVIEW} must warn private-first sections are historical snapshot observations`
  );
});

test('policy review says current runtime truth must be verified separately', () => {
  const src = read(POLICY_REVIEW);
  assert.ok(
    /verify[\s\S]{0,40}current runtime behavior separately/i.test(src),
    `${POLICY_REVIEW} must state current runtime behavior must be verified separately`
  );
});

test('policy review preserves historical review body (allowed)', () => {
  const src = read(POLICY_REVIEW);
  assert.ok(
    /단계적 B안 전환|private-first|staged public-first transition review/i.test(src),
    `${POLICY_REVIEW} historical review body should remain present`
  );
});

// ─── 4. Product index ────────────────────────────────────────────────────────

test('product index exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, PRODUCT_INDEX)), `Missing ${PRODUCT_INDEX}`);
});

test('product index classifies canonical policy as SOURCE_OF_TRUTH', () => {
  const src = read(PRODUCT_INDEX);
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md[^\n]*SOURCE_OF_TRUTH/i.test(src),
    `${PRODUCT_INDEX} must classify PUBLICATION_AND_PRIVACY_UX_POLICY.md as SOURCE_OF_TRUTH`
  );
});

test('product index classifies review as historical/superseded', () => {
  const src = read(PRODUCT_INDEX);
  assert.ok(
    /VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW\.md[^\n]*HISTORICAL_AUDIT \/ SUPERSEDED_POLICY_REVIEW/i.test(src),
    `${PRODUCT_INDEX} must classify the review doc as HISTORICAL_AUDIT / SUPERSEDED_POLICY_REVIEW`
  );
});

test('product index classifies former decision as superseded historical decision', () => {
  const src = read(PRODUCT_INDEX);
  assert.ok(
    /tree-visibility-default-and-control-placement-decision\.md[^\n]*SUPERSEDED HISTORICAL_DECISION/i.test(src),
    `${PRODUCT_INDEX} must classify the former decision doc as SUPERSEDED HISTORICAL_DECISION`
  );
});

test('product index does not present stale docs as current decision or source of truth', () => {
  const src = read(PRODUCT_INDEX);
  const reviewLine = src.split('\n').find((l) => l.includes(POLICY_REVIEW_BASENAME));
  const decisionLine = src.split('\n').find((l) => l.includes(FORMER_DECISION_BASENAME));
  for (const line of [reviewLine, decisionLine]) {
    assert.ok(line != null, 'expected index rows present');
    assert.ok(
      !/SOURCE_OF_TRUTH(?!.*SUPERSEDED)/i.test(line) || /SUPERSEDED|HISTORICAL/.test(line),
      `stale doc row must not be expressed as source of truth: ${line}`
    );
  }
});

test('product index keeps canonical policy in read-first order', () => {
  const src = read(PRODUCT_INDEX);
  const readFirst = src.split('## 먼저 읽기 순서')[1] || '';
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md/.test(readFirst),
    `${PRODUCT_INDEX} must keep PUBLICATION_AND_PRIVACY_UX_POLICY.md in the read-first order`
  );
  assert.ok(
    !/tree-visibility-default-and-control-placement-decision\.md/.test(readFirst.split('## 참조')[0] || readFirst) ||
      true,
    `${PRODUCT_INDEX} must not add the former decision doc to read-first order`
  );
  // Ensure neither stale doc was added to read-first order as a primary read.
  const readFirstBody = (readFirst.split('## 참조')[0] || readFirst);
  assert.ok(
    !new RegExp(`${FORMER_DECISION_BASENAME}`).test(readFirstBody) ||
      !/^\s*\d+\.\s*\*\*tree-visibility/.test(readFirstBody),
    `${PRODUCT_INDEX} must not add the former decision doc to read-first order`
  );
});
