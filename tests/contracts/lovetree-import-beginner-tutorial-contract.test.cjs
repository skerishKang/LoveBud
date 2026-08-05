/**
 * Contract test for the LoveTree beginner-first import tutorial (Issue #3903).
 *
 * Docs-structure contract only. No runtime UI execution, no network, no DB,
 * no browser, no Production. Proves both import routes, tutorial steps,
 * privacy statements, unsupported states, user-trial separation, and parent
 * references remain explicit.
 *
 * Refs: #3903, #3897, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(
  ROOT,
  'docs/product/LOVETREE_IMPORT_BEGINNER_TUTORIAL_CONTRACT.md'
);

const EXPECTED_MAIN_SHA = 'e148cb2b3c7a0fd880da64d2db5d442717d75353';

function readDoc() {
  assert.ok(fs.existsSync(DOC_PATH), `Contract document must exist at ${DOC_PATH}`);
  return fs.readFileSync(DOC_PATH, 'utf8');
}

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
  '## 1. Current-main baseline',
  '## 2. Product purpose and non-goals',
  '## 3. Official platform constraints',
  '## 4. Two-route entry model',
  '## 5. Public YouTube playlist tutorial',
  '## 6. Browser bookmark export tutorial',
  '## 7. Normalized preview-state vocabulary',
  '## 8. Desktop and mobile accessibility and focus requirements',
  '## 9. Privacy, retention, and consent copy',
  '## 10. Error and recovery matrix',
  '## 11. Owner real-use acceptance checklist',
  '## 12. Ordered implementation children (maximum 3)',
  '## 13. Explicit non-actions',
];

test('contract document exists', () => {
  assert.ok(fs.existsSync(DOC_PATH));
});

for (const section of REQUIRED_SECTIONS) {
  test(`contract document contains required section "${section}"`, () => {
    const doc = readDoc();
    assert.ok(doc.includes(section), `Required section "${section}" missing`);
  });
}

test('contract records the exact current main SHA', () => {
  const doc = readDoc();
  assert.ok(doc.includes(EXPECTED_MAIN_SHA), `Contract must record current main SHA ${EXPECTED_MAIN_SHA}`);
  assert.ok(/Current main SHA/.test(doc));
});

test('two-route entry model keeps the routes explicit and separate', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 4. Two-route entry model', '## 5. Public YouTube playlist tutorial');
  assert.ok(/YouTube 재생목록 가져오기/.test(section), 'must name the YouTube playlist route');
  assert.ok(/브라우저 북마크 가져오기/.test(section), 'must name the browser bookmark route');
  assert.ok(
    /Do \*\*not\*\* combine both into one ambiguous generic uploader|not\*\* combine both/i.test(section),
    'must forbid combining both routes into one generic uploader'
  );
});

test('YouTube tutorial covers the required step sequence', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 5.1 Beginner flow (step contract)', '### 5.2 Required tutorial elements');
  for (const step of [
    'where to copy the playlist URL',
    'public/unlisted/private explanation',
    'paste URL',
    'validate',
    'preview playlist title and items',
    'show unavailable/private/deleted items explicitly',
    'select or exclude items',
    'review proposed Tree title and visibility',
    'no write in the first preview slice',
  ]) {
    assert.ok(section.includes(step), `missing YouTube step: ${step}`);
  }
});

test('YouTube tutorial elements and copy contract are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 5.2 Required tutorial elements', '### 5.3 Copy contract');
  for (const element of [
    'short inline instructions',
    '재생목록 링크는 어디서 복사하나요',
    'screenshot placeholder specification',
    'error-specific recovery copy',
    'no assumption that the user knows YouTube terminology',
  ]) {
    assert.ok(section.includes(element), `missing tutorial element: ${element}`);
  }
  const copy = extractSection(doc, '### 5.3 Copy contract', '## 6. Browser bookmark export tutorial');
  for (const token of [
    '공개 또는',
    '주소창',
    '재생목록',
    '비공개',
    'unavailable',
    'included/excluded',
    'no write',
  ]) {
    assert.ok(copy.includes(token), `missing YouTube copy token: ${token}`);
  }
});

test('bookmark tutorial covers the required first flow', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 6.1 Beginner flow (first Chrome/Edge desktop flow)', '### 6.2 Required tutorial explanations');
  for (const step of [
    'open Bookmark Manager',
    'choose Export bookmarks',
    'receive an HTML file',
    'return to LoveBud',
    'select or drag the HTML file',
    'local/safe parse boundary',
    'preview folders and supported links',
    'select or exclude items',
    'review proposed grouping',
  ]) {
    assert.ok(section.includes(step), `missing bookmark step: ${step}`);
  }
});

test('bookmark tutorial explains privacy, retention, and scope facts', () => {
  const doc = readDoc();
  const section = extractSection(doc, '### 6.2 Required tutorial explanations', '### 6.3 Copy contract');
  for (const fact of [
    'not** a password/history export',
    'only the bookmark HTML file',
    'original browser bookmarks are **not changed**',
    '**not be retained**',
    'unsupported protocols and unsafe URLs are **excluded**',
    'optional',
    'explicit permission',
  ]) {
    assert.ok(section.includes(fact), `missing bookmark explanation: ${fact}`);
  }
});

test('bookmark copy contract is Korean-first', () => {
  const doc = readDoc();
  const copy = extractSection(doc, '### 6.3 Copy contract (Korean-first)', '## 7. Normalized preview-state vocabulary');
  for (const token of [
    '비밀번호나 방문 기록',
    '북마크 HTML 파일',
    '바뀌지 않아요',
    '보관하지 않아요',
    '제외돼요',
    '확장 프로그램',
  ]) {
    assert.ok(copy.includes(token), `missing bookmark copy token: ${token}`);
  }
});

test('normalized preview vocabulary is shared and complete', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 7. Normalized preview-state vocabulary', '## 8. Desktop and mobile accessibility');
  for (const state of [
    'source collection',
    'proposed Tree',
    'group/folder',
    'proposed Moment',
    'included / excluded',
    'duplicate',
    'unavailable',
    'unsupported',
    'needs review',
  ]) {
    assert.ok(section.includes(state), `missing preview state: ${state}`);
  }
  assert.ok(
    /Playlist order is playback order only|playback order only/.test(section),
    'must state playlist order is playback order only'
  );
  assert.ok(
    /must \*\*not\*\* fabricate emotional\/narrative Connections|not\*\* fabricate/i.test(section),
    'must forbid fabricating emotional/narrative Connections from order'
  );
});

test('accessibility and focus requirements are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 8. Desktop and mobile accessibility and focus requirements', '## 9. Privacy, retention');
  for (const req of [
    'one visible focus target',
    'focus returns to the trigger',
    'Escape closes',
    'keyboard-only flow',
    'aria-expanded',
    'aria-describedby',
    'reduced-motion',
    'color is never the only signal',
    'touch targets',
  ]) {
    assert.ok(section.includes(req), `missing accessibility requirement: ${req}`);
  }
  assert.ok(/desktop and mobile share the same step\/copy contract/.test(section));
});

test('privacy, retention, and consent copy are explicit', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 9. Privacy, retention, and consent copy', '## 10. Error and recovery matrix');
  for (const fact of [
    'what data is provided',
    'must be stated for both routes',
    '**not retained**',
    'logs',
    'private/draft',
    'never makes a Tree public',
  ]) {
    assert.ok(section.includes(fact), `missing privacy/retention fact: ${fact}`);
  }
});

test('error and recovery matrix includes recovery copy and actions', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 10. Error and recovery matrix', '## 11. Owner real-use acceptance checklist');
  for (const state of [
    'invalid/empty playlist URL',
    'private/unlisted',
    'playlist not found',
    'one intentional invalid input',
    'too large',
    'unsupported/unsafe URL',
    'quota',
    'duplicate item',
  ]) {
    assert.ok(section.includes(state), `missing error state: ${state}`);
  }
  assert.ok(/Recovery copy/.test(section) || /Recovery action/.test(section));
  assert.ok(
    /recover from one intentional invalid input/.test(section),
    'must guarantee recovery from one intentional invalid input'
  );
});

test('owner real-use acceptance checklist is reusable and separate from automated tests', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 11. Owner real-use acceptance checklist', '## 12. Ordered implementation children');
  for (const item of [
    'could find the source link/file without outside help',
    'understood what data was being provided',
    'understood public/private implications',
    'could recover from one intentional invalid input',
    'could preview and exclude items',
    'understood Tree versus Moment mapping',
    'understood that Connections are not auto-created',
    'could complete the flow on desktop',
    'could understand the same tutorial on mobile',
  ]) {
    assert.ok(section.includes(item), `missing acceptance checklist item: ${item}`);
  }
  assert.ok(
    /not\*\* product-accepted merely because automated tests pass|merely because automated tests pass/i.test(section),
    'must separate technical validation from owner tutorial/usability acceptance'
  );
});

test('implementation children are ordered and bounded to maximum three', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 12. Ordered implementation children (maximum 3)', '## 13. Explicit non-actions');
  const childRows = section.match(/\| [0-9]+ \|/g) || [];
  assert.ok(childRows.length >= 1, 'must list ordered implementation children');
  assert.ok(childRows.length <= 3, `must not exceed 3 implementation children, found ${childRows.length}`);
  for (const field of ['Child scope', 'Depends on', 'Stop condition']) {
    assert.ok(section.includes(field), `missing child field: ${field}`);
  }
  assert.ok(
    /no Tree write, no schema change/.test(section),
    'child 1 must be read-only preview'
  );
});

test('explicit non-actions are present', () => {
  const doc = readDoc();
  const section = extractSection(doc, '## 13. Explicit non-actions');
  for (const nonAction of [
    'no automatic semantic Connections from playlist adjacency',
    'no OAuth in the first MVP',
    'no browser-extension permission in the first MVP',
    'no video downloading',
    'no bypassing YouTube',
    'no silent retention',
    'no implementation in legacy Vercel/Netlify',
    'no broad plugin/provider framework',
    'no one large cross-repository implementation PR',
  ]) {
    assert.ok(section.includes(nonAction), `missing non-action: ${nonAction}`);
  }
});

test('hard prohibitions are stated in the document', () => {
  const doc = readDoc();
  for (const prohibition of [
    'no runtime import implementation',
    'no YouTube API call',
    'no OAuth',
    'no bookmark file upload or parsing implementation',
    'no browser extension',
    'no DB/schema/API/Auth/provider change',
    'no Production/Preview',
    'no screenshots committed',
    'no modification of Draft PR #3898 branch or worktree',
  ]) {
    assert.ok(doc.includes(prohibition), `missing hard prohibition: ${prohibition}`);
  }
});

test('keep-open references are present and no closure language is used', () => {
  const doc = readDoc();
  assert.ok(/Keep \*\*#3903 OPEN\*\*|Keep #3903 OPEN/i.test(doc));
  assert.ok(/Keep \*\*#3897 OPEN\*\*|Keep #3897 OPEN/i.test(doc));
  assert.ok(/Keep \*\*#1882 OPEN\*\*|Keep #1882 OPEN|#1882.*\*\*OPEN\*\*/i.test(doc));
  assert.ok(!/Closes #3903|Fixes #3903|Resolves #3903/.test(doc));
  assert.ok(!/Closes #3897|Fixes #3897|Resolves #3897/.test(doc));
  assert.ok(!/Closes #1882|Fixes #1882|Resolves #1882/.test(doc));
});
