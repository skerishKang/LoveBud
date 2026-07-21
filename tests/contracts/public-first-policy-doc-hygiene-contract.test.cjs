/**
 * Contract: LoveBud #3438 public-first policy documentation hygiene,
 * Issue #3484 visibility / Plus user-facing claim alignment,
 * and Issue #3558 Intro CSP duplicate inline shared-header bootstrap cleanup.
 *
 * Scope grammar:
 * Static documentation and active surface copy contract only.
 * No runtime, database, browser, network, deployment, or production behavior
 * is executed or verified.
 *
 * This test reads repository Markdown, index files, and active Intro/settings
 * copy sources and asserts static source-of-truth, supersession, policy-routing
 * markers, #3484 Option B claim alignment, and Intro header bootstrap hygiene.
 * It does not execute runtime code, connect to a database or network, use a
 * browser, deploy, or verify production behavior.
 *
 * Refs: #3438, #3437, #3435, #3484, #3558, #1882
 * Keep #1882 OPEN.
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
const INTRO_HTML = 'pages/intro.html';
const INTRO_I18N = 'js/i18n/i18n-intro.js';
const SETTINGS_HTML = 'pages/settings.html';
const SETTINGS_I18N = 'js/i18n/i18n-shared.js';

const FORMER_DECISION_BASENAME = 'tree-visibility-default-and-control-placement-decision.md';
const POLICY_REVIEW_BASENAME = 'VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md';

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// Bounded H2 section extraction: from `heading` to the next H2 or EOF.
function extractH2Section(source, heading) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  assert.notEqual(start, -1, `Missing section: ${heading}`);
  const remaining = lines.slice(start + 1);
  const nextHeading = remaining.findIndex((line) => /^##\s+/.test(line));
  return nextHeading === -1
    ? remaining.join('\n')
    : remaining.slice(0, nextHeading).join('\n');
}

// Locate the single markdown index table row that references a basename.
function findIndexRow(source, basename) {
  const line = source.split(/\r?\n/).find((l) => l.includes(basename));
  assert.notEqual(line, undefined, `Expected index row for ${basename}`);
  return line;
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
    /Status\*\*:?\s*SUPERSEDED/i.test(head),
    `${FORMER_DECISION} top metadata must declare "Status: SUPERSEDED"`
  );
});

test('former decision declares Classification: HISTORICAL_DECISION', () => {
  const src = read(FORMER_DECISION);
  const head = src.split('\n').slice(0, 12).join('\n');
  assert.ok(
    /Classification\*\*:?\s*HISTORICAL_DECISION/i.test(head),
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

// ─── 4. Product index — index-row contract (strengthened) ────────────────────

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

test('former decision index row carries required markers and no forbidden markers', () => {
  const src = read(PRODUCT_INDEX);
  const row = findIndexRow(src, FORMER_DECISION_BASENAME);
  assert.ok(/SUPERSEDED/.test(row), `${FORMER_DECISION_BASENAME} row must include SUPERSEDED`);
  assert.ok(/HISTORICAL_DECISION/.test(row), `${FORMER_DECISION_BASENAME} row must include HISTORICAL_DECISION`);
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md|current policy/i.test(row),
    `${FORMER_DECISION_BASENAME} row must point to the canonical policy`
  );
  // Stale rows must never be expressed as source of truth, active, or current.
  assert.ok(!/SOURCE_OF_TRUTH/i.test(row), `${FORMER_DECISION_BASENAME} row must not be SOURCE_OF_TRUTH`);
  assert.ok(!/active decision/i.test(row), `${FORMER_DECISION_BASENAME} row must not be an active decision`);
  assert.ok(!/current decision/i.test(row), `${FORMER_DECISION_BASENAME} row must not be a current decision`);
  assert.ok(!/current policy source/i.test(row), `${FORMER_DECISION_BASENAME} row must not be the current policy source`);
});

test('policy review index row carries required markers and no forbidden markers', () => {
  const src = read(PRODUCT_INDEX);
  const row = findIndexRow(src, POLICY_REVIEW_BASENAME);
  assert.ok(/HISTORICAL_AUDIT/.test(row), `${POLICY_REVIEW_BASENAME} row must include HISTORICAL_AUDIT`);
  assert.ok(/SUPERSEDED_POLICY_REVIEW/.test(row), `${POLICY_REVIEW_BASENAME} row must include SUPERSEDED_POLICY_REVIEW`);
  assert.ok(
    /current authority is PUBLICATION_AND_PRIVACY_UX_POLICY\.md/i.test(row),
    `${POLICY_REVIEW_BASENAME} row must state current authority is PUBLICATION_AND_PRIVACY_UX_POLICY.md`
  );
  assert.ok(!/SOURCE_OF_TRUTH/i.test(row), `${POLICY_REVIEW_BASENAME} row must not be SOURCE_OF_TRUTH`);
  assert.ok(!/active decision/i.test(row), `${POLICY_REVIEW_BASENAME} row must not be an active decision`);
  assert.ok(!/current decision/i.test(row), `${POLICY_REVIEW_BASENAME} row must not be a current decision`);
});

// ─── 5. Product index — read-first order (bounded section) ───────────────────

test('canonical policy is present in read-first order', () => {
  const src = read(PRODUCT_INDEX);
  const section = extractH2Section(src, '## 먼저 읽기 순서');
  assert.ok(
    /PUBLICATION_AND_PRIVACY_UX_POLICY\.md/.test(section),
    `${PRODUCT_INDEX} must keep PUBLICATION_AND_PRIVACY_UX_POLICY.md in the read-first order`
  );
});

test('former decision must not appear in read-first order', () => {
  const src = read(PRODUCT_INDEX);
  const section = extractH2Section(src, '## 먼저 읽기 순서');
  assert.ok(
    !section.includes(FORMER_DECISION_BASENAME),
    `${FORMER_DECISION_BASENAME} must not appear in read-first order`
  );
});

test('policy review must not appear in read-first order', () => {
  const src = read(PRODUCT_INDEX);
  const section = extractH2Section(src, '## 먼저 읽기 순서');
  assert.ok(
    !section.includes(POLICY_REVIEW_BASENAME),
    `${POLICY_REVIEW_BASENAME} must not appear in read-first order`
  );
});

// ─── 6. Canonical supersession — bounded section ─────────────────────────────

test('canonical supersession section names both stale documents', () => {
  const src = read(CANONICAL);
  const section = extractH2Section(src, '## Supersession and precedence');
  assert.ok(
    section.includes(FORMER_DECISION_BASENAME),
    `${CANONICAL} supersession section must name ${FORMER_DECISION_BASENAME}`
  );
  assert.ok(
    section.includes(POLICY_REVIEW_BASENAME),
    `${CANONICAL} supersession section must name ${POLICY_REVIEW_BASENAME}`
  );
});

// ─── 7. Issue #3484 Option B — policy record + active copy ───────────────────

test('#3484 canonical policy records Option B explicitly', () => {
  const src = read(CANONICAL);
  assert.ok(
    /Selected option:\s*Option B|Option B — Public-first without a shippable Plus promise/i.test(src),
    `${CANONICAL} must record Issue #3484 Option B explicitly`
  );
  assert.ok(
    /Issue #3484 decision/i.test(src),
    `${CANONICAL} must include an Issue #3484 decision section`
  );
});

test('#3484 Option A is rejected for missing shippable Plus path', () => {
  const src = read(CANONICAL);
  assert.ok(
    /A — Public-first with shipped Plus private storage[\s\S]{0,200}Rejected/i.test(src),
    `${CANONICAL} must reject Option A when Plus acquisition is not shippable`
  );
});

test('#3484 distinguishes tree default from moment inheritance', () => {
  const src = read(CANONICAL);
  assert.ok(
    /New trees default to public|신규 tree.*public/i.test(src),
    `${CANONICAL} must keep tree default public`
  );
  assert.ok(
    /Memory visibility omitted inherits parent tree visibility|omitted[\s\S]{0,40}inherits parent/i.test(src),
    `${CANONICAL} must keep moment/memory inheritance separate from tree default`
  );
  assert.ok(
    /merge tree visibility and moment visibility/i.test(src),
    `${CANONICAL} must forbid falsely merging tree and moment policies in user claims`
  );
});

test('#3484 active Intro HTML uses public-first Option B copy', () => {
  const src = read(INTRO_HTML);
  assert.ok(
    /공개로 시작해요/.test(src),
    `${INTRO_HTML} must claim public-first start`
  );
  assert.ok(
    /새 러브트리는 공개로 시작하며,\s*공개 여부는 편집 화면에서 확인할 수 있어요/.test(src),
    `${INTRO_HTML} must include approved Option B body copy`
  );
  assert.ok(
    !/비공개로 시작해요/.test(src),
    `${INTRO_HTML} must not claim private-first start`
  );
  assert.ok(
    !/Plus에서 비공개/.test(src),
    `${INTRO_HTML} must not promise Plus private storage`
  );
});

test('#3484 active Intro i18n aligns Korean and English Option B copy', () => {
  const src = read(INTRO_I18N);
  assert.ok(
    /'intro\.whatItem3Title'/.test(src) || /"intro\.whatItem3Title"/.test(src),
    `${INTRO_I18N} must define intro.whatItem3Title`
  );
  assert.ok(
    /ko:\s*'공개로 시작해요'/.test(src),
    `${INTRO_I18N} Korean title must be 공개로 시작해요`
  );
  assert.ok(
    /en:\s*'Start in public'/.test(src),
    `${INTRO_I18N} English title must be Start in public`
  );
  assert.ok(
    /ko:\s*'새 러브트리는 공개로 시작하며, 공개 여부는 편집 화면에서 확인할 수 있어요\.'/.test(src),
    `${INTRO_I18N} Korean description must match approved Option B copy`
  );
  assert.ok(
    /en:\s*'New LoveTrees start public\. You can check visibility on the edit screen\.'/.test(src),
    `${INTRO_I18N} English description must match approved Option B copy`
  );
  assert.ok(
    !/Plus에서 비공개로 보관/.test(src),
    `${INTRO_I18N} must not promise Plus private storage`
  );
});

test('#3484 Settings active copy keeps Plus as not-yet-shipped (준비 중)', () => {
  const html = read(SETTINGS_HTML);
  const i18n = read(SETTINGS_I18N);
  // Plus note was removed from settings.html in #3583 follow-up.
  // The i18n keys are retained for reference but no longer rendered.
  assert.ok(
    !/Plus에서 준비 중/.test(html) && !/준비 중이에요/.test(html),
    `${SETTINGS_HTML} must no longer display Plus not-yet-shipped note (removed in #3583)`
  );
  assert.ok(
    /Plus에서 준비 중/.test(i18n),
    `${SETTINGS_I18N} Korean private storage copy must remain 준비 중`
  );
  assert.ok(
    /being prepared for Plus/i.test(i18n),
    `${SETTINGS_I18N} English private storage copy must remain prepared/not shipped`
  );
  assert.ok(
    !/Plus에서 비공개로 보관할 수 있어요/.test(html + i18n),
    'Settings must not claim users can already store privately via Plus'
  );
});

test('#3484 historical private-first provenance is not blindly rewritten', () => {
  const former = read(FORMER_DECISION);
  const review = read(POLICY_REVIEW);
  assert.ok(
    /private by default|private-first|New trees are/i.test(former),
    `${FORMER_DECISION} historical private-first narrative must remain`
  );
  assert.ok(
    /단계적 B안 전환|private-first|staged public-first transition review/i.test(review),
    `${POLICY_REVIEW} historical review body must remain`
  );
});

test('#3484 does not introduce billing or entitlement implementation paths', () => {
  // Scope guard for this contract-only PR surface set: policy + active copy only.
  const changedSurfaces = [CANONICAL, INTRO_HTML, INTRO_I18N, SETTINGS_HTML, SETTINGS_I18N];
  for (const rel of changedSurfaces) {
    const src = read(rel);
    assert.ok(
      !/stripe\.com|paypal\.com|createCheckoutSession|billingPortal|subscription_create/i.test(src),
      `${rel} must not introduce billing/checkout implementation`
    );
  }
});

// ─── 8. Issue #3558 — Intro CSP: no duplicate inline shared-header bootstrap ─

const INTRO_INIT = 'js/intro/intro-page-init.js';

function collectExecutableInlineScripts(html) {
  const blocks = [];
  const scriptTags = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  for (const [, attrs, content] of scriptTags) {
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/\btype\s*=\s*["']?(?:application|text)\/(?:ld\+)?json["']?/i.test(attrs)) continue;
    const trimmed = content.trim();
    if (trimmed !== '') blocks.push(trimmed);
  }
  return blocks;
}

function scriptSrcPositions(html, fragment) {
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const hits = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[1].includes(fragment)) hits.push({ index: match.index, src: match[1] });
  }
  return hits;
}

test('#3558 Intro HTML has no executable inline script blocks', () => {
  const html = read(INTRO_HTML);
  const inline = collectExecutableInlineScripts(html);
  assert.deepEqual(
    inline,
    [],
    `${INTRO_HTML} must not contain executable inline <script>...</script> blocks; found: ${JSON.stringify(inline)}`
  );
});

test('#3558 Intro still loads shared-header.js before intro-page-init.js', () => {
  const html = read(INTRO_HTML);
  const headerHits = scriptSrcPositions(html, 'js/shared-header.js');
  const initHits = scriptSrcPositions(html, 'js/intro/intro-page-init.js');
  assert.equal(headerHits.length, 1, `${INTRO_HTML} must load js/shared-header.js exactly once`);
  assert.equal(initHits.length, 1, `${INTRO_HTML} must load js/intro/intro-page-init.js exactly once`);
  assert.ok(
    headerHits[0].index < initHits[0].index,
    'shared-header.js must appear before intro-page-init.js in script order'
  );
});

test('#3558 intro-page-init.js remains the sole renderSharedHeader initializer', () => {
  const init = read(INTRO_INIT);
  const html = read(INTRO_HTML);
  assert.ok(
    /renderSharedHeader\s*\(/.test(init),
    `${INTRO_INIT} must call renderSharedHeader()`
  );
  assert.ok(
    /DOMContentLoaded/.test(init),
    `${INTRO_INIT} must invoke header init from its DOMContentLoaded path`
  );
  assert.ok(
    !/renderSharedHeader\s*\(/.test(html),
    `${INTRO_HTML} must not call renderSharedHeader() (external initializer owns it)`
  );
  // Exactly one active Intro initialization source for shared header.
  const introJsFiles = [
    INTRO_INIT,
    'js/i18n/i18n-intro.js',
  ];
  let callSites = 0;
  for (const rel of introJsFiles) {
    const src = read(rel);
    const matches = src.match(/renderSharedHeader\s*\(/g) || [];
    callSites += matches.length;
  }
  assert.equal(
    callSites,
    1,
    'Exactly one active Intro renderSharedHeader() call site must remain (intro-page-init.js)'
  );
});

test('#3558 public-first KO/EN copy remains unchanged and private-first stays absent', () => {
  const html = read(INTRO_HTML);
  const i18n = read(INTRO_I18N);
  assert.ok(/공개로 시작해요/.test(html), `${INTRO_HTML} KO title must remain`);
  assert.ok(
    /새 러브트리는 공개로 시작하며,\s*공개 여부는 편집 화면에서 확인할 수 있어요/.test(html),
    `${INTRO_HTML} KO body must remain`
  );
  assert.ok(/ko:\s*'공개로 시작해요'/.test(i18n), `${INTRO_I18N} KO title must remain`);
  assert.ok(/en:\s*'Start in public'/.test(i18n), `${INTRO_I18N} EN title must remain`);
  assert.ok(
    /ko:\s*'새 러브트리는 공개로 시작하며, 공개 여부는 편집 화면에서 확인할 수 있어요\.'/.test(i18n),
    `${INTRO_I18N} KO body must remain`
  );
  assert.ok(
    /en:\s*'New LoveTrees start public\. You can check visibility on the edit screen\.'/.test(i18n),
    `${INTRO_I18N} EN body must remain`
  );
  assert.ok(!/비공개로 시작해요/.test(html + i18n), 'private-first start copy must remain absent');
  assert.ok(
    !/Plus에서 비공개|Plus private storage|private storage availability/i.test(html + i18n),
    'Intro must not add a Plus private-storage availability promise'
  );
});
