const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. LoveBudAIPanel keeps window.LoveBudAIPanel and contains editor-review trigger markers/events', () => {
  const panelSource = read('js/ai/lovebud-ai-panel.js');
  
  assert.ok(panelSource.includes('LoveBudAIPanel'), 'should export LoveBudAIPanel');
  assert.ok(panelSource.includes('data-lovebud-ai-send-to-editor-review'), 'should contain send-to-editor-review marker');
  assert.ok(panelSource.includes('lovebud-ai-local-draft-review-requested'), 'should reference custom event name');
  assert.ok(panelSource.includes('CustomEvent'), 'should use CustomEvent constructor');
});

test('2. Event detail allowlist and safety rules', () => {
  const panelSource = read('js/ai/lovebud-ai-panel.js');

  // Verify allowlisted properties
  const keys = ['title', 'memo', 'tags', 'sourceUrl', 'disclaimer', 'kind'];
  keys.forEach(k => {
    assert.ok(panelSource.includes(k), `should reference allowlist key: ${k}`);
  });

  // Verify prohibited authentication / identity keys are not generated in the event detail
  const prohibited = ['email', 'uid', 'userId', 'auth', 'token', 'session'];
  prohibited.forEach(p => {
    const pattern = new RegExp(`detail\\s*:\\s*\\{[^}]*\\b${p}\\b`, 'i');
    assert.ok(!pattern.test(panelSource), `should not contain prohibited key "${p}" in event detail`);
  });
});

test('3. LoveBudAIEditorReview exists, is exported, and sets up listener', () => {
  const reviewSource = read('js/editor/lovebud-ai-editor-review.js');
  
  const sandbox = {
    window: {
      addEventListener(event, handler) {
        this.listeners = this.listeners || {};
        this.listeners[event] = handler;
      },
      removeEventListener() {}
    },
    document: {
      readyState: 'complete',
      addEventListener() {}
    },
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(reviewSource, sandbox);

  const review = sandbox.window.LoveBudAIEditorReview;
  assert.ok(review, 'window.LoveBudAIEditorReview should exist');
  assert.equal(typeof review.init, 'function', 'init must be a function');
  assert.equal(typeof review.renderSuggestion, 'function', 'renderSuggestion must be a function');
  assert.equal(typeof review.clear, 'function', 'clear must be a function');
  assert.equal(typeof review.normalizeSuggestion, 'function', 'normalizeSuggestion must be a function');

  assert.ok(reviewSource.includes('lovebud-ai-local-draft-review-requested'), 'should listen to review request event');
});

test('4. Review tray, card, dismiss markers and safety copy', () => {
  const reviewSource = read('js/editor/lovebud-ai-editor-review.js');

  assert.ok(reviewSource.includes('data-lovebud-ai-draft-review-tray'), 'should contain review tray marker');
  assert.ok(reviewSource.includes('data-lovebud-ai-draft-review-card'), 'should contain review card marker');
  assert.ok(reviewSource.includes('data-lovebud-ai-draft-review-dismiss'), 'should contain review card dismiss marker');

  // Verify safety copy strings are present in review script
  const safetyTexts = ['AI 제안 검토', 'local_stub', '자동 저장되지 않음', '저장 전 직접 확인 필요'];
  safetyTexts.forEach(txt => {
    assert.ok(reviewSource.includes(txt), `should contain safety text: ${txt}`);
  });
});

test('5. pages/editor.html loads new editor review assets with cache-bust', () => {
  const html = read('pages/editor.html');
  const scriptTag = '<script src="../js/editor/lovebud-ai-editor-review.js?v=20260616-ai-editor-review-2"';
  const cssTag = '<link rel="stylesheet" href="../css/editor/lovebud-ai-editor-review.css?v=20260616-ai-editor-review-2"';

  assert.ok(html.includes(scriptTag) || html.includes(scriptTag + '>'), 'editor.html must load lovebud-ai-editor-review.js with cache-bust');
  assert.ok(html.includes(cssTag) || html.includes(cssTag + '>'), 'editor.html must load lovebud-ai-editor-review.css with cache-bust');
});

test('6. Strictly no network, fetch, DB mutations, or automatic submit/click based save behavior', () => {
  const files = [
    'js/ai/lovebud-ai-panel.js',
    'js/editor/lovebud-ai-editor-review.js'
  ];

  files.forEach(file => {
    const code = read(file);

    // Network / Live APIs
    assert.ok(!code.includes('fetch('), `${file} must not call fetch`);
    assert.ok(!code.includes('XMLHttpRequest'), `${file} must not use XMLHttpRequest`);
    assert.ok(!code.includes('WebSocket'), `${file} must not use WebSocket`);
    assert.ok(!code.includes('process.env'), `${file} must not access env variables`);
    assert.ok(!code.includes('functions/api/scout/suggest'), `${file} must not reference scout suggestion endpoint`);

    // Memory mutations
    assert.ok(!code.includes('saveMemory'), `${file} must not call saveMemory`);
    assert.ok(!code.includes('createMemory'), `${file} must not call createMemory`);
    assert.ok(!code.includes('LoveTreeEditor.fillMomentDraft'), `${file} must not call LoveTreeEditor.fillMomentDraft`);

    // Automatic submit or click behavior
    assert.ok(!code.includes('.submit('), `${file} must not perform automatic form submission`);
    assert.ok(!code.includes('.click('), `${file} must not perform automatic click save`);
  });
});

test('7. No changes to existing js/scout/ files to reference review flow', () => {
  const scoutFiles = fs.readdirSync(path.join(ROOT, 'js', 'scout'));
  scoutFiles.forEach(file => {
    const content = read(path.join('js', 'scout', file));
    assert.ok(!content.includes('LoveBudAIEditorReview'), `${file} should not be modified to reference review flow`);
  });
});
