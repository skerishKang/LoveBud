const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// ============================================================
// Helper: extract function body
// ============================================================
function extractFunctionBody(source, functionName) {
  const patterns = [
    `export function ${functionName}(`,
    `function ${functionName}(`
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const idx = source.indexOf(pattern);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) {
    return null;
  }

  let braceCount = 0;
  let bodyStart = -1;
  let i = startIdx;

  while (i < source.length) {
    if (source[i] === '{') {
      braceCount++;
      if (braceCount === 1) {
        bodyStart = i + 1;
      }
    } else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0 && bodyStart !== -1) {
        return source.slice(bodyStart, i);
      }
    }
    i++;
  }

  return null;
}

// ============================================================
// Helper: mock DOM
// ============================================================
function createMockDocument() {
  const mockChildren = new Map();
  const mockElements = new Map();
  const eventListeners = new Map();

  const mockDoc = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        children: [],
        className: '',
        dataset: {},
        style: {},
        textContent: '',
        innerHTML: '',
        classList: {
          list: [],
          add: function(cls) { this.list.push(cls); },
          remove: function(cls) { this.list = this.list.filter(c => c !== cls); },
          contains: function(cls) { return this.list.includes(cls); }
        },
        appendChild: function(child) { this.children.push(child); },
        setAttribute: function(name, value) { this[name] = value; },
        addEventListener: function(type, handler) {
          const key = `${this.tagName}:${type}`;
          if (!eventListeners.has(key)) {
            eventListeners.set(key, []);
          }
          eventListeners.get(key).push(handler);
        }
      };
      mockElements.set(el, el);
      return el;
    },
    getElementById: (id) => {
      if (id === 'canvasArea') {
        return {
          tagName: 'MAIN',
          children: [],
          appendChild: function(child) { this.children.push(child); }
        };
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector.includes('editor-moment-list-item')) {
        return Array.from(mockElements.values()).filter(el => 
          el.className && el.className.includes('editor-moment-list-item')
        );
      }
      return [];
    }
  };

  return { document: mockDoc, elements: mockElements, listeners: eventListeners };
}

// ============================================================
// String-based tests (module existence, structure)
// ============================================================

test('dedicated list module editor-moment-list.js exists', () => {
  const modulePath = path.join(ROOT, 'js/editor/editor-moment-list.js');
  assert.ok(fs.existsSync(modulePath), 'editor-moment-list.js should exist');
});

test('dedicated CSS editor-moment-list.css exists', () => {
  const cssPath = path.join(ROOT, 'css/editor/editor-moment-list.css');
  assert.ok(fs.existsSync(cssPath), 'editor-moment-list.css should exist');
});

test('module uses IIFE pattern not import/require', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]/);
  assert.doesNotMatch(source, /require\s*\(/);
  assert.match(source, /function\s*\(\)\s*{/);
});

test('module has getText helper for i18n fallback', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.match(source, /function getText/);
  assert.match(source, /translated.*!==.*key/);
  assert.match(source, /fallback/);
});

test('module has getSourceLabel using sourceType and sourceUrl', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'getSourceLabel');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /sourceType|source_type/);
  assert.match(functionBody, /sourceUrl|source_url/);
  assert.match(functionBody, /youtube/);
  assert.match(functionBody, /YouTube/);
});

test('module does not use innerHTML', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test('module does not import Browse, My Trees, or Scout', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.doesNotMatch(source, /search\/|my-trees\/|scout\//);
});

test('module does not use API, Firebase, fetch, or localStorage', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|apiClient|Firebase|firebase|localStorage|\.setItem\s*\(|\.getItem\s*\(/);
});

// ============================================================
// Behavioral tests with DOM mock
// ============================================================

test('createEditorMomentList factory returns API methods', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.match(source, /return\s*{/);
  assert.match(source, /show:/);
  assert.match(source, /hide:/);
  assert.match(source, /toggle:/);
  assert.match(source, /refresh:/);
});

test('createEditorMomentList uses all required dependencies', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /getTreeMemories/);
  assert.match(functionBody, /getSelectedNodeId/);
  assert.match(functionBody, /setSelectedNodeId/);
  assert.match(functionBody, /updateDetailPanel/);
  assert.match(functionBody, /rerenderCanvas/);
  assert.match(functionBody, /isRootMemory/);
  assert.match(functionBody, /getCanonicalRootId/);
});

test('panel has correct i18n fallback text when i18n returns key', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.match(source, /getText\s*\(\s*['"]editor_moment_list_title['"]/);
  assert.match(source, /getText\s*\(\s*['"]editor_moment_list_title['"],\s*['"]순간 목록['"]/);
  assert.match(source, /getText\s*\(\s*['"]editor_moment_list_close['"],\s*['"]목록 닫기['"]/);
  assert.match(source, /getText\s*\(\s*['"]editor_untitled_memory['"],\s*['"]제목 없음['"]/);
  assert.match(source, /getText\s*\(\s*['"]editor_start_moment['"],\s*['"]시작 순간['"]/);
});

test('getSourceLabel handles sourceType youtube', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'getSourceLabel');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /sourceType.*youtube/);
  assert.match(functionBody, /sourceUrl.*youtube\.com/);
});

test('getSourceLabel handles sourceUrl fallback', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'getSourceLabel');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /sourceUrl|source_url/);
  assert.match(functionBody, /_link|링크/);
});

test('source label uses getText for link', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'getSourceLabel');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /getText\s*\(\s*['"]editor_source_link['"]/);
});

test('items are rendered in getTreeMemories order with index+1', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'renderList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /getTreeMemories\s*\(\)/);
  assert.match(functionBody, /forEach/);
  assert.match(functionBody, /index\s*\+\s*1/);
});

test('root memory shows start moment badge using getText', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /isRootMemory/);
  assert.match(functionBody, /getText\s*\(\s*['"]editor_start_moment['"]/);
});

test('untitled memory shows title fallback using getText', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /mem\.title/);
  assert.match(functionBody, /getText\s*\(\s*['"]editor_untitled_memory['"]/);
});

test('selected memory has active CSS class', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /getSelectedNodeId/);
  assert.match(functionBody, /classList\.add.*--selected/);
});

test('click handler calls setSelectedNodeId, updateDetailPanel, rerenderCanvas', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /setSelectedNodeId\s*\(mem\.id\)/);
  assert.match(functionBody, /updateDetailPanel\s*\(mem\)/);
  assert.match(functionBody, /rerenderCanvas\s*\(\)/);
});

test('click handler updates selected CSS class on items', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  const functionBody = extractFunctionBody(source, 'createEditorMomentList');
  assert.notEqual(functionBody, null);
  assert.match(functionBody, /querySelectorAll/);
  assert.match(functionBody, /CSS_PREFIX.*-item/);
  assert.match(functionBody, /classList\.remove/);
  assert.match(functionBody, /classList\.add/);
});

test('close button uses getText for aria-label', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.match(source, /getText\s*\(\s*['"]editor_moment_list_close['"]/);
});

test('panel aria-label uses getText', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/editor/editor-moment-list.js'), 'utf8');
  assert.match(source, /getText\s*\(\s*['"]editor_moment_list_title['"]/);
});

test('CSS file defines all required classes', () => {
  const source = fs.readFileSync(path.join(ROOT, 'css/editor/editor-moment-list.css'), 'utf8');
  assert.match(source, /\.editor-moment-list-panel/);
  assert.match(source, /\.editor-moment-list-header/);
  assert.match(source, /\.editor-moment-list-title/);
  assert.match(source, /\.editor-moment-list-close/);
  assert.match(source, /\.editor-moment-list-items/);
  assert.match(source, /\.editor-moment-list-item/);
  assert.match(source, /\.editor-moment-list-item--selected/);
  assert.match(source, /\.editor-moment-list-item-order/);
  assert.match(source, /\.editor-moment-list-item-content/);
  assert.match(source, /\.editor-moment-list-item-title/);
  assert.match(source, /\.editor-moment-list-item-badge/);
  assert.match(source, /\.editor-moment-list-item-meta/);
  assert.match(source, /\.editor-moment-list-item-date/);
  assert.match(source, /\.editor-moment-list-item-source/);
});
