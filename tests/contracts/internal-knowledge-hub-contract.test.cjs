/**
 * LoveBud Internal Knowledge Hub Contract Test (#3068)
 *
 * Validates that the product contract documentation is complete and structurally sound.
 * This test does NOT execute browser code, database migrations, or any network requests.
 * It does NOT contain real credentials.
 *
 * Refs #3068
 * Refs #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../');
const CONTRACT_DOC = path.join(ROOT, 'docs/product/lovebud-internal-knowledge-hub-contract.md');

// ── Helper ──────────────────────────────────────────────────────────

function readContract() {
  return fs.readFileSync(CONTRACT_DOC, 'utf8');
}

// ── 1. Document existence ─────────────────────────────────────────

test('knowledge hub contract document exists', function () {
  assert.ok(fs.existsSync(CONTRACT_DOC),
    'docs/product/lovebud-internal-knowledge-hub-contract.md must exist');
});

// ── 2. Structural Narrative vs Fact Separation ────────────────────

test('contract document enforces narrative and fact separation', function () {
  const src = readContract();
  // Check separation terms
  assert.ok(src.includes('Narrative') || src.includes('내러티브'), 'Must discuss narrative data type');
  assert.ok(src.includes('Fact') || src.includes('지식 데이터') || src.includes('객관적'), 'Must discuss factual data type');
  assert.ok(src.includes('덮어쓰거나') || src.includes('승격') || src.includes('Separation of Narrative and Fact'),
    'Must state emotional narrative does not auto-promote to factual entity and factual entity does not overwrite user interpretation');
});

// ── 3. 7 Entity Types definition ──────────────────────────────────

const REQUIRED_ENTITY_TYPES = [
  'person',
  'group_or_organization',
  'work',
  'video_or_source',
  'place',
  'event',
  'concept'
];

for (const type of REQUIRED_ENTITY_TYPES) {
  test(`contract document defines entity type: ${type}`, function () {
    const src = readContract();
    assert.ok(src.includes(type), `Must define entity type "${type}"`);
  });
}

// ── 4. Moment -> Entity Relation Types ────────────────────────────

const MOMENT_TO_ENTITY_RELATIONS = [
  'about',
  'references',
  'inspired_by',
  'appears_in',
  'visited_at',
  'learned_from'
];

for (const rel of MOMENT_TO_ENTITY_RELATIONS) {
  test(`contract document defines Moment to Entity relation: ${rel}`, function () {
    const src = readContract();
    assert.ok(src.includes(rel), `Must define Moment-to-Entity relation "${rel}"`);
  });
}

// ── 5. Entity -> Entity Relation Types ────────────────────────────

const ENTITY_TO_ENTITY_RELATIONS = [
  'member_of',
  'part_of',
  'created_by',
  'released_on',
  'related_to'
];

for (const rel of ENTITY_TO_ENTITY_RELATIONS) {
  test(`contract document defines Entity to Entity relation: ${rel}`, function () {
    const src = readContract();
    assert.ok(src.includes(rel), `Must define Entity-to-Entity relation "${rel}"`);
  });
}

// ── 6. Visibility Matrix ──────────────────────────────────────────

test('contract document has visibility matrix table', function () {
  const src = readContract();
  assert.ok(src.includes('public tree') || src.includes('Public Tree'), 'Visibility matrix must mention public tree');
  assert.ok(src.includes('private tree') || src.includes('Private Tree'), 'Visibility matrix must mention private tree');
  assert.ok(src.includes('published moment') || src.includes('Published Moment'), 'Visibility matrix must mention published moment');
  assert.ok(src.includes('draft moment') || src.includes('Draft Moment'), 'Visibility matrix must mention draft moment');
  assert.ok(src.includes('public entity') || src.includes('Public Entity'), 'Visibility matrix must mention public entity');
  assert.ok(src.includes('private-only') || src.includes('Private-only'), 'Visibility matrix must mention private-only reference');
});

// ── 7. Privacy Core Guarantees ───────────────────────────────────

test('contract document enforces non-discovery of private/draft contents', function () {
  const src = readContract();
  assert.ok(src.includes('Private/Draft Non-Discovery') || src.includes('절대 노출 금지') || src.includes('격리'),
    'Must state private/draft trees or moments can never be discovered through entities/graphs');
});

test('contract document enforces non-exposure of user identifiers', function () {
  const src = readContract();
  assert.ok(src.includes('Account Identifier Non-Exposure') || src.includes('이메일') || src.includes('식별자') || src.includes('UID'),
    'Must forbid account email, UID or owner-local metadata from exposure inside the knowledge hub');
});

// ── 8. Provenance & Editorial Rules ──────────────────────────────

test('contract document defines source provenance rules', function () {
  const src = readContract();
  assert.ok(src.includes('Factual Claim') || src.includes('sourceRef') || src.includes('출처'),
    'Must mention factual claims require source refs or editorial verification status');
  assert.ok(src.includes('감상') || src.includes('주관적'),
    'Must state user emotional narrative is exempt from sourceRef requirement');
});

test('contract document defines governance rules for aliases, merges and deprecations', function () {
  const src = readContract();
  assert.ok(src.includes('merge') || src.includes('병합'), 'Must define merge strategy for duplicate entities');
  assert.ok(src.includes('aliases') || src.includes('별칭'), 'Must define aliases handling');
  assert.ok(src.includes('broken') || src.includes('Broken') || src.includes('깨지거나'), 'Must define broken links policy');
  assert.ok(src.includes('deprecation') || src.includes('폐기'), 'Must define deprecation process');
});

// ── 9. Graph visualization deferred principle ─────────────────────

test('contract document states graph visualization is deferred', function () {
  const src = readContract();
  assert.ok(src.includes('Graph') || src.includes('그래프'), 'Must mention graph visualization');
  assert.ok(src.includes('비대상') || src.includes('deferred') || src.includes('보류'),
    'Must state global uncontrolled graph is a non-goal for v1 and neighborhood navigation is deferred');
});

// ── 10. Automated processes non-goal validation ───────────────────

test('contract document lists automation as non-goals', function () {
  const src = readContract();
  assert.ok(src.includes('automatic') || src.includes('자동'), 'Must address automation non-goals');
  assert.ok(src.includes('scraping') || src.includes('크롤링'), 'Must mention scraping/crawling as non-goal');
  assert.ok(src.includes('AI') || src.includes('generation'), 'Must mention automated AI generation/merge as non-goal');
});

// ── 11. Rollout Sequence ──────────────────────────────────────────

test('contract document defines rollout sequence phases', function () {
  const src = readContract();
  assert.ok(src.includes('Rollout') || src.includes('배포'), 'Must mention rollout phases');
  assert.ok(src.includes('Phase 1') || src.includes('1단계'), 'Must mention Phase 1');
  assert.ok(src.includes('Phase 2') || src.includes('2단계'), 'Must mention Phase 2');
  assert.ok(src.includes('Phase 3') || src.includes('3단계'), 'Must mention Phase 3');
});

// ── 12. Non-goals section existence ───────────────────────────────

test('contract document has non-goals section', function () {
  const src = readContract();
  assert.ok(src.includes('Non-Goals') || src.includes('비목표'), 'Must have non-goals section');
});

// ── 13. Closing keyword verification (avoid closing verbs with #1882 in doc and test) ──

test('contract document and test source do not contain forbidden closing keywords for #1882', function () {
  const docSrc = readContract();
  const testSrc = fs.readFileSync(__filename, 'utf8');

  // Build pattern programmatically to avoid matching this test file source code itself
  const parts = ['(', 'Closes', '|', 'Fixes', '|', 'Resolves', ')\\s+#1882'];
  const pattern = new RegExp(parts.join(''), 'i');

  assert.ok(!pattern.test(docSrc),
    'contract document must NOT contain forbidden closing keywords (like Clo' + 'ses #1882)');
  assert.ok(!pattern.test(testSrc),
    'contract test source must NOT contain forbidden closing keywords (like Clo' + 'ses #1882)');
});



