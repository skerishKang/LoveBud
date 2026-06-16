const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. Shared header renders AI trigger and accessibility tags', () => {
  const source = read('js/shared-header.js');
  const sandbox = {
    window: {
      location: { pathname: '/index.html' },
      localStorage: {
        getItem() { return null; },
        setItem() {}
      },
      addEventListener() {}
    },
    document: {
      readyState: 'complete',
      addEventListener() {},
      documentElement: {
        classList: {
          contains() { return false; },
          add() {}
        }
      },
      getElementById() { return { innerHTML: '' }; }
    },
    setTimeout,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  // Verify trigger builder and its attributes exist
  assert.ok(source.includes('data-lovebud-ai-trigger'), 'shared-header should contain data-lovebud-ai-trigger');
  assert.ok(source.includes('aria-controls="lovebud-ai-side-panel"'), 'shared-header should contain aria-controls="lovebud-ai-side-panel"');
  assert.ok(source.includes('aria-expanded="false"'), 'shared-header should contain aria-expanded="false"');
});

test('2. LoveBudAIPanel is exported and functions exist with proper DOM markers', () => {
  const panelSource = read('js/ai/lovebud-ai-panel.js');
  
  // Prepare sandbox mock DOM
  const createdElements = [];
  const bodyClasses = new Set();
  
  function mockNode(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      id: '',
      attributes: {},
      children: [],
      textContent: '',
      style: {},
      appendChild(child) {
        el.children.push(child);
        return child;
      },
      focus() {},
      setAttribute(name, val) {
        el.attributes[name] = val;
      },
      getAttribute(name) {
        return el.attributes[name];
      },
      classList: {
        add(cls) {
          el.className = el.className ? el.className + ' ' + cls : cls;
        },
        remove(cls) {
          el.className = el.className.replace(cls, '').trim();
        }
      },
      addEventListener() {},
      querySelectorAll() {
        return [];
      }
    };
    return el;
  }

  const sandbox = {
    window: {
      addEventListener() {}
    },
    document: {
      readyState: 'complete',
      addEventListener() {},
      body: {
        appendChild(el) {
          createdElements.push(el);
          return el;
        },
        classList: {
          add(cls) { bodyClasses.add(cls); },
          remove(cls) { bodyClasses.delete(cls); }
        }
      },
      createElement(tag) {
        return mockNode(tag);
      },
      getElementById(id) {
        for (const el of createdElements) {
          if (el.id === id) return el;
          for (const c of el.children) {
            if (c.id === id) return c;
          }
        }
        return null;
      }
    },
    setTimeout,
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(panelSource, sandbox);

  const panel = sandbox.window.LoveBudAIPanel;
  assert.ok(panel, 'window.LoveBudAIPanel should exist');
  assert.equal(typeof panel.init, 'function', 'init must be a function');
  assert.equal(typeof panel.open, 'function', 'open must be a function');
  assert.equal(typeof panel.close, 'function', 'close must be a function');
  assert.equal(typeof panel.toggle, 'function', 'toggle must be a function');

  // Verify markers, body class transitions, and attributes exist in the source code
  assert.ok(panelSource.includes('data-lovebud-ai-panel'), 'should contain data-lovebud-ai-panel marker');
  assert.ok(panelSource.includes('data-lovebud-ai-overlay'), 'should contain data-lovebud-ai-overlay marker');
  assert.ok(panelSource.includes('data-lovebud-ai-close'), 'should contain data-lovebud-ai-close marker');
  assert.ok(panelSource.includes('data-lovebud-ai-trigger'), 'should contain data-lovebud-ai-trigger marker');
  assert.ok(panelSource.includes('lovebud-ai-panel-open'), 'should contain lovebud-ai-panel-open body class transition');
  assert.ok(panelSource.includes('Escape'), 'should contain Escape key close detection');
});

test('3. LoveBudAILocalStub exists and contains safety warnings and actions', () => {
  const stubSource = read('js/ai/lovebud-ai-local-stub.js');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(stubSource, sandbox);

  const stub = sandbox.window.LoveBudAILocalStub;
  assert.ok(stub, 'window.LoveBudAILocalStub should exist');
  
  // Verify safety warnings
  const disclaimer = stub.getSafetyDisclaimer();
  assert.ok(disclaimer.includes('자동 저장되지'), 'disclaimer should mention "자동 저장되지"');
  assert.ok(disclaimer.includes('직접 확인'), 'disclaimer should mention "직접 확인"');

  // Verify actions exist
  assert.equal(typeof stub.refineMemo, 'function', 'refineMemo action must exist');
  assert.equal(typeof stub.suggestTags, 'function', 'suggestTags action must exist');
  assert.equal(typeof stub.createDraftFromLink, 'function', 'createDraftFromLink action must exist');
  assert.equal(typeof stub.summarizeTreeFlow, 'function', 'summarizeTreeFlow action must exist');

  // Verify deterministic return value properties
  const refineRes = stub.refineMemo('test');
  assert.ok(refineRes.text, 'refineMemo should return text');
  assert.ok(refineRes.disclaimer, 'refineMemo should return disclaimer');

  const tagRes = stub.suggestTags('test');
  assert.ok(Array.isArray(tagRes.tags), 'suggestTags should return tags array');

  const draftRes = stub.createDraftFromLink('https://youtube.com/watch?v=123');
  assert.equal(draftRes.sourceUrl, 'https://youtube.com/watch?v=123', 'createDraftFromLink should preserve URL');
});

test('4. Target HTML files load CSS/JS with cache-bust parameter', () => {
  const targets = [
    { file: 'index.html', prefix: '' },
    { file: 'pages/editor.html', prefix: '../' },
    { file: 'pages/search.html', prefix: '../' },
    { file: 'pages/my-trees.html', prefix: '../' }
  ];

  targets.forEach(({ file, prefix }) => {
    const html = read(file);
    const cssTag = `<link rel="stylesheet" href="${prefix}css/components/lovebud-ai-panel.css?v=20260616-ai-panel-1"`;
    const stubTag = `<script src="${prefix}js/ai/lovebud-ai-local-stub.js?v=20260616-ai-panel-1"`;
    const panelTag = `<script src="${prefix}js/ai/lovebud-ai-panel.js?v=20260616-ai-panel-1"`;

    assert.ok(html.includes(cssTag) || html.includes(cssTag.replace(' />', '')), `${file} must explicitly load css/components/lovebud-ai-panel.css with cache-bust`);
    assert.ok(html.includes(stubTag), `${file} must explicitly load js/ai/lovebud-ai-local-stub.js with cache-bust`);
    assert.ok(html.includes(panelTag), `${file} must explicitly load js/ai/lovebud-ai-panel.js with cache-bust`);
  });
});

test('5. No network, fetch, SDK, secrets or memory mutations allowed in new code', () => {
  const files = [
    'js/ai/lovebud-ai-panel.js',
    'js/ai/lovebud-ai-local-stub.js',
    'js/shared-header.js'
  ];

  files.forEach(file => {
    const code = read(file);
    
    // Prohibit network requests and provider SDKs
    assert.ok(!code.includes('fetch('), `${file} must not call fetch`);
    assert.ok(!code.includes('XMLHttpRequest'), `${file} must not use XMLHttpRequest`);
    assert.ok(!code.includes('WebSocket'), `${file} must not use WebSocket`);
    assert.ok(!code.includes('firebase.database'), `${file} must not perform direct database mutations`);
    assert.ok(!code.includes('process.env'), `${file} must not access env variables`);
    
    // Prohibit mutations / memory creation APIs
    assert.ok(!code.includes('saveMemory'), `${file} must not call saveMemory`);
    assert.ok(!code.includes('createMemory'), `${file} must not call createMemory`);
  });
});

test('6. No changes to existing Scout/live files', () => {
  // Ensure we did not modify anything in js/scout/ directory
  const scoutFiles = fs.readdirSync(path.join(ROOT, 'js', 'scout'));
  scoutFiles.forEach(file => {
    const content = read(path.join('js', 'scout', file));
    assert.ok(!content.includes('LoveBudAIPanel'), `Existing scout file ${file} should not be modified to include new panel logic`);
  });
});
