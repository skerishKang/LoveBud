const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const editorDetailUIFile = path.join(ROOT, 'js/editor/editor-detail-ui.js');
const publicViewerDetailUIFile = path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js');

// ── Dead code guard: no player.play() in either file ──

test('editor-detail-ui must not contain player.play() dead code', () => {
  const source = fs.readFileSync(editorDetailUIFile, 'utf8');
  assert.doesNotMatch(source, /player\.play\s*\(/, 'player.play() is dead code — appending iframe with autoplay=1 starts playback');
});

test('public-viewer-detail-ui must not contain player.play() dead code', () => {
  const source = fs.readFileSync(publicViewerDetailUIFile, 'utf8');
  assert.doesNotMatch(source, /player\.play\s*\(/, 'player.play() is dead code — appending iframe with autoplay=1 starts playback');
});

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
      if (sel === '.play-btn') {
        return this.children.find(c => c.classList && c.classList.contains('play-btn')) || null;
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

  const metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(metadataCode, context);
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText, 'window.LoveBudPublicViewerDetailMetadataText must exist');

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

  // #2817 regression follow-up: editor must NOT auto-play YouTube on selection.
  // After updateDetailPanel(ytMoment), there should be NO iframe yet — only the
  // static thumbnail + play button. The iframe is built only when the user
  // explicitly clicks the play button (handled inside bindDetailMediaPlayback).
  let player = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.equal(player, undefined, 'Editor selection alone must NOT append iframe player (regression #2817)');
  assert.equal(elements.img.style.display, '', 'Static thumbnail should remain visible until play action');
  assert.equal(elements.overlay.hidden, false, 'Overlay should remain visible until play action');

  // Simulate the explicit play action: the .play-btn inside mediaWrap is
  // shown by bindDetailMediaPlayback() — invoking its onclick should build
  // and append the iframe, and start/end params must be preserved.
  const playBtn = createMockElement('button');
  playBtn.classList.add('play-btn');
  elements.mediaWrap.appendChild(playBtn);
  // Re-render so bindDetailMediaPlayback wires the handler on the new play-btn.
  detailUI.updateDetailPanel(ytMoment);
  const playBtnAfter = elements.mediaWrap.querySelector('.play-btn') || playBtn;
  assert.ok(playBtnAfter.onclick, 'Play button onclick must be bound after selection');
  // Invoke the play action.
  const evt = { preventDefault() {}, stopPropagation() {} };
  playBtnAfter.onclick(evt);

  player = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.ok(player, 'Editor play action must append iframe player');
  assert.equal(player.dataset.editorDetailPlayer, '1');
  assert.ok(player.src.includes('start=83'), 'YouTube start param should be parsed (1:23 -> 83)');
  assert.ok(player.src.includes('end=150'), 'YouTube end param should be parsed (2:30 -> 150)');
  assert.equal(elements.img.style.display, 'none', 'Static thumbnail image should be hidden after play action');
  assert.equal(elements.overlay.hidden, true, 'Overlay should be hidden after play action');

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

  const metadataCode2 = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(metadataCode2, context);
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText, 'window.LoveBudPublicViewerDetailMetadataText must exist');

  // Load social split modules before detail-ui (required for dependency validation)
  var socialModuleFiles = [
    path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'),
    path.join(ROOT, 'js/viewer/public-viewer-authenticated-like.js'),
    path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'),
  ];
  socialModuleFiles.forEach(function(sf) {
    vm.runInContext(fs.readFileSync(sf, 'utf8'), context);
  });

  // Provide composer/renderer stubs for canonical appreciation chain
  context.window.LoveBudPublicViewerAppreciationComposer = {
    composePublicViewerAppreciationPresentation: function() { return { slots: [] }; }
  };
  context.window.LoveBudPublicViewerAppreciationDomRenderer = {
    createPublicViewerAppreciationDomRenderer: function() {
      return { render: function() {}, reset: function() {} };
    }
  };

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
  assert.equal(player, undefined, 'Public viewer selection must NOT autoplay — no iframe on selection');
  assert.equal(elements.img.style.display, '', 'Static thumbnail should remain visible until play action');
  assert.equal(elements.overlay.hidden, false, 'Overlay should remain visible until play action');

  // Verify play button is bound for explicit play
  const playBtn = createMockElement('button');
  playBtn.classList.add('play-btn');
  elements.mediaWrap.appendChild(playBtn);
  // Use a different ID to bypass the 150ms debounce on same memoryId
  var ytMoment2 = Object.assign({}, ytMoment, { id: 'mem-1-play' });
  detailUI.updateDetailPanel(ytMoment2);
  const playBtnAfter = elements.mediaWrap.querySelector('.play-btn') || playBtn;
  assert.ok(playBtnAfter.onclick, 'Play button onclick must be bound after selection');
  const evt = { preventDefault() {}, stopPropagation() {} };
  playBtnAfter.onclick(evt);

  const player2 = elements.mediaWrap.children.find(c => c.tagName === 'IFRAME');
  assert.ok(player2, 'Public viewer explicit play action must append iframe player');
  assert.ok(player2.src.includes('start=83'), 'YouTube start param from format 1m23s should be parsed');
  assert.ok(player2.src.includes('end=150'), 'YouTube end param from format 2m30s should be parsed');

  // Verify viewer/read-only path has NO edit inputs or edit controls mixed in
  assert.equal(elements.editTitleInput, undefined, 'Edit inputs should not exist in public viewer context');
  assert.equal(elements.editMemoInput, undefined, 'Edit inputs should not exist in public viewer context');
});

// ── Play overlay CSS guard (regression: button had no CSS so it was clipped) ──

const detailInfoCssFile = path.join(ROOT, 'css/editor/editor-detail-content/detail-info.css');

test('.memory-preview-overlay CSS exists and is positioned over the image (editor click-to-play regression)', () => {
  const css = fs.readFileSync(detailInfoCssFile, 'utf8');
  const overlayRule = (css.match(/\.memory-preview-overlay\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(overlayRule.length > 0, '.memory-preview-overlay rule must exist in editor detail CSS');
  assert.match(overlayRule, /position\s*:\s*absolute/,
    '.memory-preview-overlay must be position: absolute to overlay over the image');
  assert.match(overlayRule, /inset\s*:\s*0/,
    '.memory-preview-overlay must cover the full .detail-video (inset: 0)');
  assert.match(overlayRule, /pointer-events\s*:\s*auto/,
    '.memory-preview-overlay must be clickable (pointer-events: auto)');
  assert.match(overlayRule, /z-index\s*:\s*[1-9]/,
    '.memory-preview-overlay must sit above the image (z-index >= 1)');
});

test('.memory-preview-overlay .play-btn CSS exists with visible tap target (regression: button was invisible)', () => {
  const css = fs.readFileSync(detailInfoCssFile, 'utf8');
  const playBtnRule = (css.match(/\.memory-preview-overlay\s+\.play-btn\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(playBtnRule.length > 0, '.memory-preview-overlay .play-btn rule must exist');
  assert.match(playBtnRule, /border-radius\s*:\s*50%/,
    'play button must be circular (border-radius: 50%)');
  assert.match(playBtnRule, /width\s*:\s*\d+px/,
    'play button must have an explicit pixel width so it is visible');
  assert.match(playBtnRule, /pointer-events\s*:\s*auto/,
    'play button must receive pointer events (no overlay eating the click)');
  // Triangle play glyph via ::before
  const beforeRule = (css.match(/\.memory-preview-overlay\s+\.play-btn::before\s*\{([^}]*)\}/) || ['', ''])[1];
  assert.ok(beforeRule.length > 0, '.play-btn::before must exist to draw the play triangle');
  assert.match(beforeRule, /border-style\s*:\s*solid/,
    'play triangle must use border-style: solid');
});
