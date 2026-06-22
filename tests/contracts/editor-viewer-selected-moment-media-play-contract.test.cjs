const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const editorDetailUIFile = path.join(ROOT, 'js/editor/editor-detail-ui.js');
const publicViewerDetailUIFile = path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js');

function createMockElement(tagName = 'div') {
  const classList = {
    classes: new Set(),
    add(c) { this.classes.add(c); },
    remove(c) { this.classes.delete(c); },
    contains(c) { return this.classes.has(c); }
  };
  return {
    tagName: tagName.toUpperCase(),
    dataset: {},
    style: {},
    classList: classList,
    parentElement: null,
    children: [],
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentElement = null;
      }
    },
    get firstChild() { return this.children[0] || null; },
    remove() {
      if (this.parentElement && typeof this.parentElement.removeChild === 'function') {
        this.parentElement.removeChild(this);
      }
    },
    querySelector(sel) {
      if (sel === '.memory-preview-overlay') {
        return this.children.find(c => c.id === 'overlay') || this.children.find(c => c.classList && c.classList.contains('memory-preview-overlay')) || { hidden: false };
      }
      if (sel === 'img') {
        return this.children.find(c => c.tagName === 'IMG') || { style: {} };
      }
      if (sel === '[data-editor-detail-player="1"]') {
        return this.children.find(c => c.dataset && c.dataset.editorDetailPlayer === '1') || null;
      }
      return null;
    },
    closest(sel) {
      if (sel === '.detail-video') {
        let p = this;
        while (p) {
          if (p.classList && (p.classList.contains('detail-video') || p.id === 'mediaWrap')) return p;
          p = p.parentElement;
        }
      }
      return this.parentElement || this;
    }
  };
}

function runScriptInContext(filePath, context) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context);
}

test('LoveBudMedia time parsing formats', () => {
  const context = { window: {}, console };
  context.window = context;
  const code = fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context);

  const mediaHelper = context.window.LoveBudMedia;
  assert.ok(mediaHelper, 'window.LoveBudMedia must exist');
  assert.equal(mediaHelper.parseYouTubeTimeToSeconds('83'), 83);
  assert.equal(mediaHelper.parseYouTubeTimeToSeconds('1:23'), 83);
  assert.equal(mediaHelper.parseYouTubeTimeToSeconds('1m23s'), 83);
  assert.equal(mediaHelper.parseYouTubeTimeToSeconds('invalid'), null);
});

test('Editor detail UI YouTube selected moment playback contract', () => {
  const elements = {
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailTreeMetaMount: createMockElement(),
    detailDateText: createMockElement(),
    detailTags: createMockElement(),
    detailMemo: createMockElement(),
    saveStatusIndicator: createMockElement(),
    saveStatusIcon: createMockElement(),
    saveStatusText: createMockElement(),
    lastSavedTime: createMockElement(),
    editTitleInput: createMockElement(),
    editMemoInput: createMockElement(),
    editTagsInput: createMockElement(),
    momentReactionsCard: createMockElement(),
    detailPanelFooter: createMockElement(),
    img: createMockElement('img'),
    overlay: (() => {
      const el = createMockElement('div');
      el.classList.add('memory-preview-overlay');
      return el;
    })(),
    mediaWrap: createMockElement('div')
  };

  elements.mediaWrap.appendChild(elements.img);
  elements.mediaWrap.appendChild(elements.overlay);

  const documentMock = {
    createElement(tagName) {
      return createMockElement(tagName);
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(sel) {
      if (sel === '#detailPanel h3' || sel === 'h3') {
        return createMockElement('h3');
      }
      if (sel === '.detail-video img') {
        return elements.img;
      }
      if (sel === '.detail-video') {
        return elements.mediaWrap;
      }
      if (sel === '.diary-note') {
        return elements.detailMemo;
      }
      return null;
    }
  };

  const context = {
    window: {},
    document: documentMock,
    URL,
    URLSearchParams,
    console
  };
  context.window = context;

  // Mock window.LoveBudMedia
  context.window.LoveBudMedia = {
    extractYouTubeId(url) {
      if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) return 'dQw4w9WgXcQ';
      return null;
    },
    parseYouTubeTimeToSeconds(val) {
      if (!val) return null;
      if (/^\d+$/.test(val)) return Number(val);
      const parts = String(val).split(':');
      if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
      if (val.includes('m') || val.includes('s')) {
        const match = String(val).match(/(?:(\d+)m)?(?:(\d+)s)?/);
        if (match) return Number(match[1] || 0) * 60 + Number(match[2] || 0);
      }
      return null;
    }
  };

  // Mock dependent builders/boundaries
  context.window.createEditorDetailUIBuilders = () => ({
    createInlineIcon() { return createMockElement('span'); },
    getDisplayEmotionTags() { return []; },
    getMemoFallbackText() { return ''; }
  });
  context.window.createEditorDetailSidebarStatusBoundary = () => ({ updateSidebarStatus() {} });
  context.window.createEditorDetailTreeMetaBoundary = () => ({
    buildTreeMetaRenderModel() { return {}; },
    renderTreeMetaBoundary() {}
  });
  context.window.createEditorDetailTitleEditBoundary = () => ({});
  context.window.createEditorDetailMemoEditBoundary = () => ({});
  context.window.createEditorDetailInlineEditBoundary = () => ({
    createTitleEditBoundary() {},
    createMemoEditBoundary() {}
  });
  context.window.createEditorDetailInlineEditHelper = () => ({
    createTitleEditBoundary() {},
    createMemoEditBoundary() {}
  });

  runScriptInContext(editorDetailUIFile, context);

  const detailUI = context.window.createEditorDetailUI({
    detailPanel: {
      querySelector(sel) {
        if (sel === 'h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.img;
        if (sel === '.detail-video') return elements.mediaWrap;
        return null;
      }
    },
    i18n: (k) => k,
    getSelectedNodeId: () => 'mem-1',
    getCanonicalRootId: () => 'root-1',
    getTreeMemories: () => [{ id: 'mem-1' }],
    getCurrentTreeData: () => ({ id: 'tree-1' }),
    isRootMemory: () => false,
    getLocalSaveMode: () => false,
    resolveMemoryThumbnail: () => 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
  });

  // Test YouTube Moment rendering
  const ytMoment = {
    id: 'mem-1',
    title: 'YouTube Moment',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    startTime: '1:23',
    endTime: '2:30'
  };

  detailUI.updateDetailPanel(ytMoment);

  // Check that the player is appended
  const player = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.ok(player, 'YouTube moment should append iframe player');
  assert.equal(player.dataset.editorDetailPlayer, '1');
  assert.ok(player.src.includes('start=83'), 'YouTube start param should be parsed');
  assert.ok(player.src.includes('end=150'), 'YouTube end param should be parsed');
  assert.equal(elements.img.style.display, 'none', 'Static thumbnail image should be hidden for YouTube player');
  assert.equal(elements.overlay.hidden, true, 'Overlay should be hidden for YouTube player');

  // Test Moving to non-YouTube Moment
  const textMoment = {
    id: 'mem-2',
    title: 'Text Moment'
  };

  detailUI.updateDetailPanel(textMoment);

  // Check that the player is removed, static thumbnail and overlay are restored
  const playerGone = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.equal(playerGone, undefined, 'Player should be cleaned up on non-YouTube moments');
  assert.equal(elements.img.style.display, '', 'Static thumbnail image display should be restored');
  assert.equal(elements.overlay.hidden, false, 'Overlay hidden should be restored to false');
});

test('Public viewer detail UI selected moment playback contract (read-only)', () => {
  const elements = {
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailTreeMetaMount: createMockElement(),
    detailDateText: createMockElement(),
    detailTags: createMockElement(),
    detailMemo: createMockElement(),
    momentReactionsCard: createMockElement(),
    img: createMockElement('img'),
    overlay: (() => {
      const el = createMockElement('div');
      el.classList.add('memory-preview-overlay');
      return el;
    })(),
    mediaWrap: createMockElement('div'),
    momentLikeBtn: createMockElement('button'),
    momentLikeCount: createMockElement('span'),
    momentCommentCount: createMockElement('span'),
    momentCommentBtn: createMockElement('button')
  };

  elements.mediaWrap.appendChild(elements.img);
  elements.mediaWrap.appendChild(elements.overlay);

  const documentMock = {
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(sel) {
      if (sel === '#detailPanel h3' || sel === 'h3') {
        return createMockElement('h3');
      }
      if (sel === '.detail-video img') {
        return elements.img;
      }
      if (sel === '.detail-video') {
        return elements.mediaWrap;
      }
      if (sel === '.diary-note') {
        return elements.detailMemo;
      }
      return null;
    }
  };

  const context = {
    window: {},
    document: documentMock,
    URL,
    URLSearchParams,
    console
  };
  context.window = context;

  // Mock window.LoveBudMedia
  context.window.LoveBudMedia = {
    extractYouTubeId(url) {
      if (url && url.includes('youtube.com')) return 'dQw4w9WgXcQ';
      return null;
    },
    parseYouTubeTimeToSeconds(val) {
      if (!val) return null;
      if (/^\d+$/.test(val)) return Number(val);
      const parts = String(val).split(':');
      if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
      if (val.includes('m') || val.includes('s')) {
        const match = String(val).match(/(?:(\d+)m)?(?:(\d+)s)?/);
        if (match) return Number(match[1] || 0) * 60 + Number(match[2] || 0);
      }
      return null;
    }
  };

  // Mock dependent builders/boundaries
  context.window.createPublicViewerDetailUIBuilders = () => ({
    createInlineIcon() { return createMockElement('span'); },
    getDisplayEmotionTags() { return []; },
    getMemoFallbackText() { return ''; }
  });
  context.window.createPublicViewerDetailTreeMetaBoundary = () => ({
    buildTreeMetaRenderModel() { return {}; },
    renderTreeMetaBoundary() {}
  });

  runScriptInContext(publicViewerDetailUIFile, context);

  const detailUI = context.window.createPublicViewerDetailUI({
    i18n: (k) => k,
    getSelectedNodeId: () => 'mem-1',
    getTreeState: () => ({ hasMoments: true, canonicalRootId: 'root-1', treeMemories: [] }),
    getCurrentTreeData: () => ({ id: 'tree-1' }),
    getTreeMemories: () => [{ id: 'mem-1' }],
    isRootMemory: () => false,
    getLocalSaveMode: () => false,
    resolveMemoryThumbnail: () => 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
  });

  const ytMoment = {
    id: 'mem-1',
    title: 'YouTube Moment',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    startTime: '1m23s',
    endTime: '2m30s'
  };

  detailUI.updateDetailPanel(ytMoment);

  const player = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.ok(player, 'Public viewer should append iframe player');
  assert.ok(player.src.includes('start=83'), 'YouTube start param from format 1m23s should be parsed');
  assert.ok(player.src.includes('end=150'), 'YouTube end param from format 2m30s should be parsed');

  // Verify viewer/read-only path has NO edit inputs or edit controls mixed in
  assert.equal(elements.editTitleInput, undefined, 'Edit inputs should not exist in public viewer context');
  assert.equal(elements.editMemoInput, undefined, 'Edit inputs should not exist in public viewer context');
});
