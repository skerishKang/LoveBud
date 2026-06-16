const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const REVIEW_JS = 'js/editor/lovebud-ai-editor-review.js';
const REVIEW_CSS = 'css/editor/lovebud-ai-editor-review.css';
const FLOW_TEST = 'tests/contracts/lovebud-ai-editor-review-flow-contract.test.cjs';
const SHELL_TEST = 'tests/contracts/global-ai-side-panel-shell-contract.test.cjs';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readSlice(source, startToken, endToken) {
  var start = source.indexOf(startToken);
  if (start === -1) return '';
  var end = source.indexOf(endToken, start + startToken.length);
  if (end === -1) return source.slice(start);
  return source.slice(start, end + endToken.length);
}

test('1. lovebud-ai-editor-review.js exports window.LoveBudAIEditorReview', () => {
  const src = read(REVIEW_JS);
  assert.ok(src.includes('window.LoveBudAIEditorReview'), 'should export window.LoveBudAIEditorReview');
});

test('2. copy button marker exists: data-lovebud-ai-copy-to-draft-fields', () => {
  const src = read(REVIEW_JS);
  assert.ok(
    src.includes('data-lovebud-ai-copy-to-draft-fields'),
    'should contain data-lovebud-ai-copy-to-draft-fields marker'
  );
});

test('3. copy button text exists: 초안 입력칸에 복사', () => {
  const src = read(REVIEW_JS);
  assert.ok(
    src.includes('초안 입력칸에 복사'),
    'should contain copy button text 초안 입력칸에 복사'
  );
});

test('4. post-copy notice exists with required safety copy', () => {
  const src = read(REVIEW_JS);
  assert.ok(
    src.includes('초안 입력칸에 복사되었습니다. 저장 전 직접 확인해 주세요.'),
    'should contain post-copy notice text'
  );
});

test('5. DRAFT_FIELD_SELECTORS allowlist with title/memo/tags/sourceUrl exists', () => {
  const src = read(REVIEW_JS);
  assert.ok(src.includes('DRAFT_FIELD_SELECTORS'), 'should declare DRAFT_FIELD_SELECTORS');
  ['title', 'memo', 'tags', 'sourceUrl'].forEach((k) => {
    const re = new RegExp('\\b' + k + '\\s*:\\s*\\[', 'm');
    assert.ok(re.test(src), `DRAFT_FIELD_SELECTORS should include key "${k}" with array value`);
  });
});

test('6. implementation does not use broad input/textarea scan', () => {
  const src = read(REVIEW_JS);
  const prohibited = [
    "querySelectorAll('input')",
    'querySelectorAll("input")',
    "querySelectorAll('textarea')",
    'querySelectorAll("textarea")'
  ];
  prohibited.forEach((p) => {
    assert.ok(!src.includes(p), `should not use ${p}`);
  });
});

test('7. copySuggestionToDraftFields method is declared', () => {
  const src = read(REVIEW_JS);
  assert.ok(
    src.includes('copySuggestionToDraftFields'),
    'should declare copySuggestionToDraftFields method'
  );
});

test('8. copy is wired through explicit button click handler', () => {
  const src = read(REVIEW_JS);
  assert.ok(
    src.includes('data-lovebud-ai-copy-to-draft-fields'),
    'copy button marker should exist'
  );
  assert.ok(
    src.includes("addEventListener('click'"),
    "button should use addEventListener('click', ...)"
  );
});

test('9. no automatic copy inside renderSuggestion, handleReviewRequest, or init', () => {
  const src = read(REVIEW_JS);

  // init body
  const initBody = readSlice(src, 'init: function ()', '},');
  assert.ok(
    !initBody.includes('copySuggestionToDraftFields'),
    'init() must not call copySuggestionToDraftFields'
  );

  // handleReviewRequest body
  const handleBody = readSlice(src, 'function handleReviewRequest', 'function ');
  assert.ok(
    !handleBody.includes('copySuggestionToDraftFields'),
    'handleReviewRequest() must not call copySuggestionToDraftFields'
  );

  // renderSuggestion: copySuggestionToDraftFields must not be called BEFORE the
  // copy button is created and its click handler attached.
  const renderStart = src.indexOf('renderSuggestion: function (rawSuggestion)');
  const renderEnd = src.indexOf('clear: function', renderStart);
  assert.ok(renderStart !== -1 && renderEnd !== -1, 'could not locate renderSuggestion body');
  const renderBody = src.slice(renderStart, renderEnd);

  const buttonCreateIdx = renderBody.indexOf('data-lovebud-ai-copy-to-draft-fields');
  const callSites = [];
  let searchFrom = 0;
  while (true) {
    const i = renderBody.indexOf('copySuggestionToDraftFields', searchFrom);
    if (i === -1) break;
    callSites.push(i);
    searchFrom = i + 1;
  }
  assert.ok(buttonCreateIdx !== -1, 'renderSuggestion must create the copy button');
  // Any call site must be after the button creation (so it lives inside the click handler)
  callSites.forEach((i) => {
    assert.ok(
      i > buttonCreateIdx,
      'copySuggestionToDraftFields inside renderSuggestion must be after button creation'
    );
  });
});

test('10. no .submit( in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('.submit('), 'must not use .submit(');
});

test('11. no .click( in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('.click('), 'must not use .click(');
});

test('12. no saveMemory in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('saveMemory'), 'must not call saveMemory');
});

test('13. no createMemory in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('createMemory'), 'must not call createMemory');
});

test('14. no fetch( in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('fetch('), 'must not use fetch(');
});

test('15. no XMLHttpRequest in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('XMLHttpRequest'), 'must not use XMLHttpRequest');
});

test('16. no WebSocket in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('WebSocket'), 'must not use WebSocket');
});

test('17. no process.env in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('process.env'), 'must not use process.env');
});

test('18. no functions/api/scout/suggest in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('functions/api/scout/suggest'), 'must not reference scout endpoint');
});

test('19. no LoveTreeEditor.fillMomentDraft in implementation', () => {
  const src = read(REVIEW_JS);
  assert.ok(!src.includes('LoveTreeEditor.fillMomentDraft'), 'must not call LoveTreeEditor.fillMomentDraft');
});

test('20. existing lovebud-ai-editor-review-flow-contract.test.cjs still passes', () => {
  const testPath = path.join(ROOT, FLOW_TEST);
  assert.ok(fs.existsSync(testPath), 'flow contract test file must exist');
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [testPath], { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    assert.fail('flow contract test failed: ' + (err.stdout || err.message));
  }
  assert.ok(/^# pass /m.test(stdout) || /pass /m.test(stdout), 'flow contract test must report pass');
});

test('21. existing global-ai-side-panel-shell-contract.test.cjs still passes', () => {
  const testPath = path.join(ROOT, SHELL_TEST);
  assert.ok(fs.existsSync(testPath), 'global shell contract test file must exist');
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [testPath], { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    assert.fail('global shell contract test failed: ' + (err.stdout || err.message));
  }
  assert.ok(/^# pass /m.test(stdout) || /pass /m.test(stdout), 'global shell contract test must report pass');
});
