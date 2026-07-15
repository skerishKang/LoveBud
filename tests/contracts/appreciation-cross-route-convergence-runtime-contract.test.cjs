/**
 * Cross-route appreciation convergence runtime contract.
 * Issue #3519 / parent #3475
 *
 * EXECUTED_FAKE: runs Public Viewer and Editor appreciation chains in node:vm
 * with a shared presentation/slot boundary and fake DOM.
 *
 * Proves:
 * 1) Viewer: public payload → Viewer adapter → shared slots → Viewer DOM
 * 2) Editor: owner selected moment → Editor adapter → shared slots → Editor DOM
 * 3) Viewer does not use Editor globals/owner capabilities
 * 4) Editor does not use Public Viewer adapter/composer
 * 5) Canonical semantic slot order
 * 6) Public Viewer owner controls stay closed
 * 7) Owner knowledge display is not stripped by publicKnowledge-only source shapes
 * 8) Safe textContent rendering for user content
 * 9) Unknown vs authoritative zero social counts
 * 10) Hidden unavailable knowledge sections
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

const EXPECTED_SLOT_ORDER = [
  'identity',
  'media',
  'rememberedDate',
  'emotionTags',
  'connectedKnowledge',
  'emotionMemo',
  'socialSummary',
];

function load(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function createFakeDocument(ids) {
  const elements = Object.create(null);

  function ensure(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        textContent: '',
        hidden: false,
        firstChild: null,
        childNodes: [],
        children: [],
        style: {},
        className: '',
        appendChild(child) {
          this.childNodes.push(child);
          this.children.push(child);
          if (!this.firstChild) this.firstChild = child;
          this.textContent = this.childNodes
            .map((c) => c.textContent || '')
            .join('');
        },
        removeChild(child) {
          const idx = this.childNodes.indexOf(child);
          if (idx >= 0) this.childNodes.splice(idx, 1);
          const cidx = this.children.indexOf(child);
          if (cidx >= 0) this.children.splice(cidx, 1);
          this.firstChild = this.childNodes[0] || null;
          this.textContent = this.childNodes
            .map((c) => c.textContent || '')
            .join('');
        },
      };
    }
    return elements[id];
  }

  for (const id of ids) ensure(id);

  return {
    elements,
    getElementById(id) {
      return ensure(id);
    },
    createElement(tag) {
      return {
        tagName: String(tag || 'div').toUpperCase(),
        textContent: '',
        className: '',
        style: {},
        childNodes: [],
        children: [],
        firstChild: null,
        appendChild(child) {
          this.childNodes.push(child);
          this.children.push(child);
          if (!this.firstChild) this.firstChild = child;
          this.textContent = this.childNodes
            .map((c) => c.textContent || '')
            .join('');
        },
        removeChild(child) {
          const idx = this.childNodes.indexOf(child);
          if (idx >= 0) this.childNodes.splice(idx, 1);
          this.firstChild = this.childNodes[0] || null;
          this.textContent = this.childNodes
            .map((c) => c.textContent || '')
            .join('');
        },
      };
    },
  };
}

function loadViewerChain(doc) {
  const context = {
    window: {},
    document: doc,
  };
  context.window.document = doc;
  vm.createContext(context);
  vm.runInContext(load('js/shared/appreciation-render-model.js'), context);
  vm.runInContext(load('js/shared/appreciation-presentation-slots.js'), context);
  vm.runInContext(load('js/shared/appreciation-slot-dom.js'), context);
  vm.runInContext(
    load('js/viewer/public-viewer-appreciation-model-adapter.js'),
    context
  );
  vm.runInContext(
    load('js/viewer/public-viewer-appreciation-presentation-model.js'),
    context
  );
  vm.runInContext(
    load('js/viewer/public-viewer-appreciation-composer.js'),
    context
  );
  vm.runInContext(
    load('js/viewer/public-viewer-appreciation-dom-renderer.js'),
    context
  );
  return context;
}

function loadEditorChain(doc) {
  const context = {
    window: {},
    document: doc,
  };
  context.window.document = doc;
  vm.createContext(context);
  vm.runInContext(load('js/shared/appreciation-render-model.js'), context);
  vm.runInContext(load('js/shared/appreciation-presentation-slots.js'), context);
  vm.runInContext(load('js/shared/appreciation-slot-dom.js'), context);
  vm.runInContext(
    load('js/editor/editor-appreciation-model-adapter.js'),
    context
  );
  vm.runInContext(load('js/editor/editor-appreciation-composer.js'), context);
  return context;
}

test('public viewer chain uses shared slots and safe DOM without owner controls', () => {
  const doc = createFakeDocument([
    'detailCurrentMomentTitle',
    'detailDateText',
    'detailDateGroup',
    'detailTags',
    'detailTagsGroup',
    'detailPublicKnowledgeList',
    'detailPublicKnowledgeGroup',
    'detailMemo',
    'detailMemoGroup',
  ]);
  const ctx = loadViewerChain(doc);

  assert.equal(
    typeof ctx.window.LoveBudEditorAppreciationModelAdapter,
    'undefined',
    'Viewer chain must not load Editor adapter'
  );
  assert.equal(
    typeof ctx.window.LoveBudEditorAppreciationComposer,
    'undefined',
    'Viewer chain must not load Editor composer'
  );

  const composer = ctx.window.LoveBudPublicViewerAppreciationComposer;
  const domRenderer =
    ctx.window.LoveBudPublicViewerAppreciationDomRenderer.createPublicViewerAppreciationDomRenderer(
      { document: doc }
    );

  const presentation = composer.composePublicViewerAppreciationPresentation(
    {
      id: 'pub-1',
      title: '<script>alert(1)</script>Safe Title',
      timestamp: '2026-07-15',
      emotionTags: ['기쁨'],
      memo: 'memo <img onerror=1>',
      publicKnowledge: [
        { label: 'Knowledge A', type: 'person', secret: 'NOPE' },
      ],
      likeCount: 0,
      commentCount: 0,
      privateToken: 'SECRET',
      knowledge: [{ label: 'OwnerOnlyMustNotLeak' }],
    },
    {
      canEdit: true,
      canContinue: true,
      canConnect: true,
      canDelete: true,
      canSwitchMode: true,
      isOwner: true,
      canReact: true,
      canComment: true,
      isPublicRoute: true,
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(presentation.slots.map((s) => s.key))),
    EXPECTED_SLOT_ORDER
  );
  assert.equal(presentation.capabilities.canEdit, false);
  assert.equal(presentation.capabilities.canContinue, false);
  assert.equal(presentation.capabilities.canConnect, false);
  assert.equal(presentation.capabilities.canDelete, false);
  assert.equal(presentation.capabilities.canSwitchMode, false);
  assert.equal(presentation.capabilities.isOwner, false);
  assert.equal(presentation.capabilities.canReact, true);
  assert.equal(presentation.capabilities.canComment, true);
  assert.equal(presentation.capabilities.isPublicRoute, true);

  const knowledge = presentation.slots.find((s) => s.key === 'connectedKnowledge');
  assert.equal(knowledge.available, true);
  assert.equal(knowledge.items[0].label, 'Knowledge A');
  assert.equal(knowledge.items[0].secret, undefined);
  assert.ok(
    !JSON.stringify(presentation).includes('OwnerOnlyMustNotLeak'),
    'owner knowledge aliases must not pass public adapter'
  );
  assert.ok(
    !JSON.stringify(presentation).includes('SECRET'),
    'private token must not pass public adapter'
  );

  const social = presentation.slots.find((s) => s.key === 'socialSummary');
  assert.equal(social.value.likeCount, 0);
  assert.equal(social.value.likeCountAvailable, true);
  assert.equal(social.value.commentCount, 0);
  assert.equal(social.value.commentCountAvailable, true);

  domRenderer.render(presentation);
  assert.equal(
    doc.getElementById('detailCurrentMomentTitle').textContent,
    '<script>alert(1)</script>Safe Title'
  );
  assert.equal(doc.getElementById('detailDateText').textContent, '2026-07-15');
  assert.equal(doc.getElementById('detailDateGroup').hidden, false);
  assert.match(doc.getElementById('detailTags').textContent, /기쁨/);
  assert.equal(doc.getElementById('detailTagsGroup').hidden, false);
  assert.match(
    doc.getElementById('detailPublicKnowledgeList').textContent,
    /Knowledge A/
  );
  assert.equal(doc.getElementById('detailPublicKnowledgeGroup').hidden, false);
  assert.equal(
    doc.getElementById('detailMemo').textContent,
    'memo <img onerror=1>'
  );
  assert.equal(doc.getElementById('detailMemoGroup').hidden, false);
});

test('editor chain uses editor adapter + shared slots without public viewer adapter', () => {
  const doc = createFakeDocument([
    'detailCurrentMomentTitle',
    'detailDateText',
    'detailDateGroup',
    'detailTags',
    'detailTagsGroup',
    'detailOwnerKnowledgeList',
    'detailOwnerKnowledgeGroup',
    'detailMemo',
    'detailMemoGroup',
  ]);
  const ctx = loadEditorChain(doc);

  assert.equal(
    typeof ctx.window.LoveBudPublicViewerAppreciationModelAdapter,
    'undefined'
  );
  assert.equal(
    typeof ctx.window.LoveBudPublicViewerAppreciationComposer,
    'undefined'
  );
  assert.equal(
    typeof ctx.window.LoveBudPublicViewerAppreciationDomRenderer,
    'undefined'
  );

  const editorSrc = load('js/editor/editor-detail-ui.js');
  assert.doesNotMatch(
    editorSrc,
    /LoveBudPublicViewerAppreciation(Composer|ModelAdapter|DomRenderer)/,
    'editor-detail-ui must not call Public Viewer appreciation globals'
  );

  const presentation =
    ctx.window.LoveBudEditorAppreciationComposer.composeEditorAppreciationPresentation(
      {
        id: 'own-1',
        title: 'Owner Title <b>x</b>',
        timestamp: '2026-01-01',
        emotionTags: ['설렘'],
        memo: 'owner memo',
        knowledgeItems: [
          { label: 'Owner Knowledge', type: 'song', privateId: 'drop-me' },
        ],
        likeCount: 3,
      },
      {
        isOwner: true,
        canEdit: true,
        canSwitchMode: true,
        canReact: true,
        canComment: true,
        canContinue: true,
        canConnect: true,
        canDelete: true,
        isPublicRoute: true,
      }
    );

  assert.deepEqual(
    JSON.parse(JSON.stringify(presentation.slots.map((s) => s.key))),
    EXPECTED_SLOT_ORDER
  );
  assert.equal(presentation.capabilities.isOwner, true);
  assert.equal(presentation.capabilities.canEdit, true);
  assert.equal(presentation.capabilities.canSwitchMode, true);
  assert.equal(presentation.capabilities.canReact, true);
  assert.equal(presentation.capabilities.canComment, true);
  // Authoring flags may be true on the display model; handlers remain controller-owned.
  assert.equal(presentation.capabilities.isPublicRoute, false);

  const knowledge = presentation.slots.find((s) => s.key === 'connectedKnowledge');
  assert.equal(knowledge.available, true);
  assert.equal(knowledge.items[0].label, 'Owner Knowledge');
  assert.equal(knowledge.items[0].privateId, undefined);

  const renderer =
    ctx.window.LoveBudAppreciationSlotDom.createAppreciationSlotDomRenderer({
      document: doc,
      ids: {
        title: 'detailCurrentMomentTitle',
        date: 'detailDateText',
        dateGroup: 'detailDateGroup',
        tags: 'detailTags',
        tagsGroup: 'detailTagsGroup',
        knowledgeList: 'detailOwnerKnowledgeList',
        knowledgeGroup: 'detailOwnerKnowledgeGroup',
        knowledgeItemClass: 'editor-owner-knowledge-item',
        memo: 'detailMemo',
        memoGroup: 'detailMemoGroup',
      },
    });
  renderer.render(presentation);

  assert.equal(
    doc.getElementById('detailCurrentMomentTitle').textContent,
    'Owner Title <b>x</b>'
  );
  assert.match(
    doc.getElementById('detailOwnerKnowledgeList').textContent,
    /Owner Knowledge/
  );
  assert.equal(doc.getElementById('detailOwnerKnowledgeGroup').hidden, false);
  assert.equal(doc.getElementById('detailMemo').textContent, 'owner memo');
});

test('unknown social counts stay unavailable; authoritative zero is preserved', () => {
  const ctx = loadViewerChain(
    createFakeDocument([
      'detailCurrentMomentTitle',
      'detailDateText',
      'detailDateGroup',
      'detailTags',
      'detailTagsGroup',
      'detailPublicKnowledgeList',
      'detailPublicKnowledgeGroup',
      'detailMemo',
      'detailMemoGroup',
    ])
  );

  const unknown =
    ctx.window.LoveBudPublicViewerAppreciationComposer.composePublicViewerAppreciationPresentation(
      {
        id: 'u1',
        title: 't',
      },
      { canReact: true, canComment: true, isPublicRoute: true }
    );
  const unknownSocial = unknown.slots.find((s) => s.key === 'socialSummary');
  assert.equal(unknownSocial.value.likeCount, null);
  assert.equal(unknownSocial.value.likeCountAvailable, false);
  assert.equal(unknownSocial.value.commentCount, null);
  assert.equal(unknownSocial.value.commentCountAvailable, false);

  const zero =
    ctx.window.LoveBudPublicViewerAppreciationComposer.composePublicViewerAppreciationPresentation(
      {
        id: 'z1',
        title: 't',
        likeCount: 0,
        commentCount: 0,
      },
      { canReact: true, canComment: true, isPublicRoute: true }
    );
  const zeroSocial = zero.slots.find((s) => s.key === 'socialSummary');
  assert.equal(zeroSocial.value.likeCount, 0);
  assert.equal(zeroSocial.value.likeCountAvailable, true);
  assert.equal(zeroSocial.value.commentCount, 0);
  assert.equal(zeroSocial.value.commentCountAvailable, true);
});

test('unavailable knowledge and memo sections hide without empty layout', () => {
  const doc = createFakeDocument([
    'detailCurrentMomentTitle',
    'detailDateText',
    'detailDateGroup',
    'detailTags',
    'detailTagsGroup',
    'detailPublicKnowledgeList',
    'detailPublicKnowledgeGroup',
    'detailMemo',
    'detailMemoGroup',
  ]);
  const ctx = loadViewerChain(doc);
  const presentation =
    ctx.window.LoveBudPublicViewerAppreciationComposer.composePublicViewerAppreciationPresentation(
      {
        id: 'h1',
        title: 'only title',
      },
      { isPublicRoute: true }
    );
  ctx.window.LoveBudPublicViewerAppreciationDomRenderer.createPublicViewerAppreciationDomRenderer(
    { document: doc }
  ).render(presentation);

  assert.equal(doc.getElementById('detailPublicKnowledgeGroup').hidden, true);
  assert.equal(doc.getElementById('detailPublicKnowledgeList').childNodes.length, 0);
  assert.equal(doc.getElementById('detailMemoGroup').hidden, true);
  assert.equal(doc.getElementById('detailTagsGroup').hidden, true);
  assert.equal(doc.getElementById('detailDateGroup').hidden, true);
});

test('pages keep route-owned script boundaries and no cross imports', () => {
  const editorHtml = load('pages/editor.html');
  const viewHtml = load('pages/view.html');

  assert.match(editorHtml, /js\/editor\/editor-appreciation-model-adapter\.js/);
  assert.match(editorHtml, /js\/editor\/editor-appreciation-composer\.js/);
  assert.match(editorHtml, /js\/shared\/appreciation-presentation-slots\.js/);
  assert.match(editorHtml, /js\/shared\/appreciation-slot-dom\.js/);
  assert.doesNotMatch(
    editorHtml,
    /public-viewer-appreciation-(model-adapter|composer|dom-renderer)\.js/
  );

  assert.match(viewHtml, /js\/viewer\/public-viewer-appreciation-model-adapter\.js/);
  assert.match(viewHtml, /js\/shared\/appreciation-presentation-slots\.js/);
  assert.match(viewHtml, /js\/shared\/appreciation-slot-dom\.js/);
  assert.doesNotMatch(viewHtml, /editor-appreciation-(model-adapter|composer)\.js/);

  const editorTpl = load('js/editor/templates/editor-detail-view-mode-template.js');
  assert.doesNotMatch(editorTpl, /is-public-readonly/);
  assert.doesNotMatch(editorTpl, /data-read-only-summary/);
  assert.match(editorTpl, /id="editMemoryBtn"/);
  assert.match(editorTpl, /id="momentReactionLikeButton"/);
  assert.match(editorTpl, /id="momentReactionCommentStatus"/);
  assert.match(editorTpl, /id="detailOwnerKnowledgeList"/);
});
