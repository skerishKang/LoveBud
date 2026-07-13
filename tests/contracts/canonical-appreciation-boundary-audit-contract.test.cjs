/**
 * Contract test for the LoveBud canonical appreciation boundary audit (Issue #3475).
 *
 * Docs-structure contract only. No runtime UI execution, no network, no DB, no Production.
 *
 * Refs: #3475, #3075, #3188, #1882, #3487, #3469 (stale reference only)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_PATH = path.join(
  ROOT,
  'docs/engineering/lovebud-canonical-appreciation-boundary-audit.md'
);

const EXPECTED_MAIN_SHA = '19141b5b9a3c11e79082540f8ba83f540d833017';

function readAudit() {
  assert.ok(fs.existsSync(AUDIT_PATH), `Audit document must exist at ${AUDIT_PATH}`);
  return fs.readFileSync(AUDIT_PATH, 'utf8');
}

/**
 * Extract a heading section up to (but not including) the next heading of
 * equal or higher rank, or a named next heading if provided.
 */
function extractSection(source, startHeading, nextHeading) {
  const startIdx = source.indexOf(startHeading);
  assert.ok(startIdx >= 0, `start heading not found: ${startHeading}`);
  const afterStart = startIdx + startHeading.length;
  let endIdx = source.length;
  if (nextHeading) {
    const n = source.indexOf(nextHeading, afterStart);
    if (n >= 0) endIdx = n;
  } else {
    const rest = source.slice(afterStart);
    const m = rest.match(/\n#{1,3} /);
    if (m && typeof m.index === 'number') endIdx = afterStart + m.index;
  }
  return source.slice(startIdx, endIdx);
}

const REQUIRED_SECTIONS = [
  '## Baseline',
  '## Executive summary',
  '## Evidence and methodology',
  '## A. Canonical appreciation structure',
  '## B. Shared presentation candidate classification',
  '## C. Permission matrix',
  '## D. Route and entry matrix',
  '## E. Access state vs interaction mode',
  '## F. Data parity matrix',
  '## G. Social scope separation',
  '## H. PR #3487 current-state reflection',
  '## I. PR #3469 Viewer findings (reference only)',
  '## J. Recommended architecture',
  '## K. Implementation slices',
  '## L. Non-goals and safety boundaries',
  '## N. Open issue maintenance',
];

test('audit document exists', () => {
  assert.ok(fs.existsSync(AUDIT_PATH));
});

for (const section of REQUIRED_SECTIONS) {
  test(`audit document contains required section "${section}"`, () => {
    const doc = readAudit();
    assert.ok(doc.includes(section), `Required section "${section}" missing`);
  });
}

test('audit records current main SHA', () => {
  const doc = readAudit();
  assert.ok(
    doc.includes(EXPECTED_MAIN_SHA),
    `Audit must record current main SHA ${EXPECTED_MAIN_SHA}`
  );
  assert.ok(doc.includes('Current main SHA'));
});

test('audit forbids whole-merge of stale PR #3469', () => {
  const doc = readAudit();
  assert.ok(doc.includes('#3469'));
  assert.ok(
    /no merge|Forbidden.*merge|whole-merge|cherry-pick/i.test(doc),
    'Audit must forbid merge/cherry-pick of stale PR #3469'
  );
  assert.ok(doc.includes('8c69e62f126d64d0788d11f1fd77f7c27882a5d0'));
});

test('canonical appreciation structure inventory exists', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## A. Canonical appreciation structure'));
  for (const item of [
    'selected moment identity',
    'media / playback',
    'remembered date',
    'emotion tags',
    'connected context / knowledge',
    'emotion memo',
    'moment-level social',
    'selected-node state',
    'loading / empty / error',
  ]) {
    assert.ok(doc.toLowerCase().includes(item.toLowerCase()), `missing structure item: ${item}`);
  }
});

test('shared presentation table headers are present', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## B. Shared presentation candidate classification'));
  for (const header of [
    'component',
    'Editor source',
    'Viewer source',
    'current divergence',
    'safe shared boundary',
    'authority risk',
    'recommended action',
  ]) {
    assert.ok(doc.includes(header), `missing table header: ${header}`);
  }
  for (const cls of [
    'SHARED_PRESENTATION_CANDIDATE',
    'SHARED_RENDER_MODEL_CANDIDATE',
    'ROUTE_SPECIFIC_ADAPTER',
    'EDITOR_AUTHORITY_ONLY',
    'PUBLIC_SAFE_ONLY',
    'DO_NOT_SHARE',
  ]) {
    assert.ok(doc.includes(cls), `missing classification token: ${cls}`);
  }
});

test('permission matrix section exists with actor rows', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## C. Permission matrix'));
  for (const actor of [
    'guest public viewer',
    'authenticated non-owner public viewer',
    'owner public viewer',
    'owner Editor appreciation',
    'owner Editor edit',
    'private tree owner',
    'private tree non-owner',
  ]) {
    assert.ok(doc.includes(actor), `missing actor: ${actor}`);
  }
  for (const cap of [
    'public data read',
    'media play',
    'reaction read',
    'reaction write',
    'comment read',
    'comment write',
    'edit',
    'continue',
    'connect',
    'delete',
    'visibility change',
    'mode switch',
  ]) {
    assert.ok(doc.includes(cap), `missing capability column: ${cap}`);
  }
});

test('route and entry matrix covers required entries', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## D. Route and entry matrix'));
  for (const entry of [
    'Browse card',
    'Browse selected preview share link',
    'My Trees primary card',
    'My Trees hub',
    'My Trees “편집하기”',
    'My Trees mobile card activation',
    'direct shared link',
    'Editor appreciation deep link',
    'Editor edit deep link',
    'browser Back/Forward',
  ]) {
    assert.ok(doc.includes(entry), `missing entry: ${entry}`);
  }
});

test('access state and interaction mode are separated', () => {
  const doc = readAudit();
  assert.ok(doc.includes('Access state:'));
  assert.ok(doc.includes('Interaction mode:'));
  assert.ok(doc.includes('public | private'));
  assert.ok(doc.includes('appreciation | edit'));
  assert.ok(
    /public.*not.*interaction mode|must not be presented as a third interaction mode|not an interaction mode/i.test(
      doc
    ),
    'Audit must state public is not an interaction mode'
  );
});

test('Public Viewer route separation and Editor authority import ban', () => {
  const doc = readAudit();
  assert.ok(
    /Public Viewer route remains separate/i.test(doc),
    'Must state Public Viewer route remains separate'
  );
  assert.ok(
    /Editor authoring runtime is not imported into Public Viewer|Editor authority.*not.*shared|must \*\*not\*\* be shared into Public Viewer/i.test(
      doc
    ),
    'Must ban Editor authority import into Public Viewer'
  );
});

test('shared render model and capability boundary are explicit', () => {
  const doc = readAudit();
  assert.ok(doc.includes('Canonical appreciation render model'));
  assert.ok(doc.includes('capability'));
  assert.ok(doc.includes('canEdit') || doc.includes('capability flags'));
  assert.ok(doc.includes('Fail-closed capability computation') || /fail-closed/i.test(doc));
});

test('raw token and private payload sharing is forbidden', () => {
  const doc = readAudit();
  for (const forbidden of [
    'raw Firebase user',
    'Authorization token',
    'private tree object',
    'DB row',
    'unfiltered API payload',
  ]) {
    assert.ok(doc.includes(forbidden), `must forbid input: ${forbidden}`);
  }
});

test('moment social #3075 and tree social #3188 are separated', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## G. Social scope separation'));
  assert.ok(doc.includes('#3075'));
  assert.ok(doc.includes('#3188'));
  assert.ok(/moment-level/i.test(doc));
  assert.ok(/tree-level/i.test(doc));
  assert.ok(
    /must not activate new social write endpoints/i.test(doc),
    '#3475 must not activate new social write endpoints'
  );
});

test('PR #3487 state is reflected', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## H. PR #3487 current-state reflection'));
  assert.ok(doc.includes('RESOLVED_BY_3487'));
  assert.ok(doc.includes('STILL_OPEN') || doc.includes('VISUAL_VERIFICATION_PENDING'));
  assert.ok(
    /connect.*fail-closed|interactionMode !== 'edit'|감상 모드/i.test(doc),
    'Must reference #3487 fail-closed / mode facts'
  );
});

test('implementation slices exist with required fields', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## K. Implementation slices'));
  const sliceMatches = doc.match(/### Slice \d+/g) || [];
  assert.ok(sliceMatches.length >= 3, `expected >=3 slices, found ${sliceMatches.length}`);
  for (const field of [
    'title',
    'goal',
    'exact expected files',
    'dependencies',
    'non-goals',
    'permission risks',
    'required tests',
    'merge order',
    'issue ownership',
  ]) {
    assert.ok(doc.includes(field), `slice field missing: ${field}`);
  }
});

test('distinguishes five implementation slices from optional visual gate', () => {
  const doc = readAudit();
  const kSection = extractSection(doc, '## K. Implementation slices', '## L. Non-goals');
  assert.ok(
    /five implementation slices/i.test(doc),
    'must state five implementation slices'
  );
  assert.ok(
    /one optional Production visual-verification gate|optional Production visual-verification gate/i.test(
      doc
    ),
    'must state one optional Production visual-verification gate'
  );
  assert.ok(
    /not.*code implementation slice|not a sixth implementation slice|not\*\* a code implementation slice/i.test(
      kSection
    ),
    'Optional Slice 6 must be distinguished from code implementation slices'
  );
  // Ban phrasing the plan as six code implementation slices (allow explicit
  // "not a sixth implementation slice" distinction language).
  const bannedPositive = doc.match(/six implementation slices/gi) || [];
  for (const hit of bannedPositive) {
    const idx = doc.toLowerCase().indexOf(hit.toLowerCase());
    const window = doc.slice(Math.max(0, idx - 40), idx + hit.length + 40);
    assert.ok(
      /not|do not|don't|never|forbidden|ban/i.test(window),
      `must not positively describe the plan as six implementation slices (near: ${window})`
    );
  }
  assert.ok(
    /5 implementation slices/.test(kSection) || /five implementation slices/i.test(kSection),
    'K section must restate five implementation slices'
  );
});

test('Slice 1 requires EXECUTED_FAKE behavior tests and rejects SOURCE_STATIC-only', () => {
  const doc = readAudit();
  const slice1 = extractSection(
    doc,
    '### Slice 1 — Shared canonical appreciation render model',
    '### Slice 2 —'
  );
  assert.ok(
    /EXECUTED_FAKE/i.test(slice1),
    'Slice 1 must require EXECUTED_FAKE tests'
  );
  assert.ok(
    /executed unit\/behavior tests|import or VM|VM-run|actually imported or VM-executed/i.test(
      slice1
    ),
    'Slice 1 must require executed unit/behavior tests of the pure helper'
  );
  assert.ok(
    /SOURCE_STATIC tests are scope guards only/i.test(slice1),
    'Slice 1 must state SOURCE_STATIC tests are scope guards only'
  );
  assert.ok(
    /do not replace executed render-model behavior tests/i.test(slice1),
    'Slice 1 must state SOURCE_STATIC does not replace executed behavior tests'
  );
  // Fail-closed capability defaults as executed requirements
  assert.ok(
    /missing capabilities → all false|capability `undefined`|fail closed/i.test(slice1),
    'Slice 1 must require fail-closed capability default executed tests'
  );
  // Forbidden-field omission as executed requirements
  assert.ok(
    /ownerId/i.test(slice1) && /removed/i.test(slice1),
    'Slice 1 must require ownerId removal from display model'
  );
  assert.ok(
    /Firebase UID|Authorization|token|session/i.test(slice1),
    'Slice 1 must require forbidden credential/private field omission tests'
  );
  assert.ok(
    /must not.*fabricate fake `0`|unknown like\/comment count/i.test(slice1),
    'Slice 1 must ban fabricating zero for unknown counts'
  );
});

test('Slice 2 knowledge payload is fail-closed and public-proof gated', () => {
  const doc = readAudit();
  const slice2 = extractSection(
    doc,
    '### Slice 2 — Public Viewer selected-moment hierarchy convergence',
    '### Slice 3 —'
  );
  assert.ok(
    /Public-safe knowledge\/context payload availability must be proven/i.test(slice2),
    'Slice 2 must require public-safe knowledge payload proof before render'
  );
  assert.ok(
    /omitted or hidden/i.test(slice2),
    'unproven knowledge section must be omitted or hidden'
  );
  assert.ok(
    /no private owner payload fallback|no owner\/private knowledge fallback/i.test(slice2),
    'private owner payload fallback must be forbidden'
  );
  assert.ok(
    /no Editor owner API request/i.test(slice2),
    'Viewer must not call Editor owner API for knowledge'
  );
  assert.ok(
    /no empty fake section/i.test(slice2),
    'empty fake knowledge section must be forbidden'
  );
  assert.ok(
    /public-safe knowledge present/i.test(slice2) &&
      /knowledge field absent → section hidden/i.test(slice2) &&
      /private-only knowledge.*stripped/i.test(slice2),
    'Slice 2 required knowledge-gate tests must be listed'
  );
  assert.ok(
    /must not call owner\/private endpoints/i.test(slice2),
    'Slice 2 tests must forbid owner/private endpoint calls'
  );
});

test('audit states no DB/SQL/migration requirement', () => {
  const doc = readAudit();
  assert.ok(
    /DB \/ SQL \/ migration requirement[\s\S]{0,40}\*\*None\*\*|No.*migration changes|no migration/i.test(
      doc
    ),
    'Must state no DB/SQL/migration requirement for this audit'
  );
});

test('open-issue keep-open language is present', () => {
  const doc = readAudit();
  assert.ok(/Keep \*\*#3475 OPEN\*\*|Keep #3475 OPEN|#3475.*\*\*OPEN\*\*/i.test(doc));
  assert.ok(/#3075.*OPEN|Keep \*\*#3075 OPEN\*\*/i.test(doc));
  assert.ok(/#3188.*OPEN|Keep \*\*#3188 OPEN\*\*/i.test(doc));
  assert.ok(/#1882.*OPEN|Keep \*\*#1882 OPEN\*\*/i.test(doc));
  assert.ok(!/Closes #3475|Fixes #3475|Resolves #3475/.test(doc));
  assert.ok(!/Closes #1882|Fixes #1882|Resolves #1882/.test(doc));
});

test('architecture diagram text mentions adapters and shared presentation', () => {
  const doc = readAudit();
  assert.ok(doc.includes('## J. Recommended architecture'));
  assert.ok(/Editor appreciation adapter/i.test(doc));
  assert.ok(/Public Viewer public-safe adapter/i.test(doc));
  assert.ok(/shared presentation/i.test(doc));
});
