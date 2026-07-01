const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function loadOEmbedHandler(fetchImpl) {
  const context = {
    URL,
    Response,
    Headers,
    TextEncoder,
    fetch: fetchImpl
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(ROOT, 'functions/api/youtube/oembed.js'), 'utf8')
    .replace(/export\s+async\s+function\s+onRequestGet/, 'async function onRequestGet');
  vm.runInContext(`${source}\nwindow = {}; window.onRequestGet = onRequestGet;`, context);
  return context.window.onRequestGet;
}

async function readJsonResponse(response) {
  return {
    status: response.status,
    body: await response.json(),
    cacheControl: response.headers.get('cache-control')
  };
}

test('YouTube oEmbed proxy rejects non-YouTube URLs before upstream fetch', async () => {
  let fetchCalled = false;
  const handler = loadOEmbedHandler(async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  });

  const response = await handler({
    request: new Request('https://example.test/api/youtube/oembed?url=https%3A%2F%2Fexample.com%2Fwatch%3Fv%3DdQw4w9WgXcQ')
  });
  const result = await readJsonResponse(response);

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Invalid YouTube URL');
  assert.equal(fetchCalled, false);
});

test('YouTube oEmbed proxy returns sanitized channel metadata for standard watch URL', async () => {
  let requestedUrl = '';
  const handler = loadOEmbedHandler(async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      author_name: '우아한형제들',
      author_url: 'https://www.youtube.com/@woowayoung?sub_confirmation=1#x'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  const response = await handler({
    request: new Request('https://example.test/api/youtube/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ')
  });
  const result = await readJsonResponse(response);

  assert.equal(result.status, 200);
  assert.match(requestedUrl, /https:\/\/www\.youtube\.com\/oembed/);
  assert.equal(result.body.channelId, '@woowayoung');
  assert.equal(result.body.channelName, '우아한형제들');
  assert.equal(result.body.channelUrl, 'https://www.youtube.com/@woowayoung');
});

test('YouTube oEmbed proxy degrades to null channel fields on upstream failure', async () => {
  const handler = loadOEmbedHandler(async () => new Response('not found', { status: 404 }));

  const response = await handler({
    request: new Request('https://example.test/api/youtube/oembed?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ')
  });
  const result = await readJsonResponse(response);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    channelId: null,
    channelName: null,
    channelUrl: null
  });
});

function createEditorFormContext(apiClient) {
  const noopElement = {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    value: '',
    addEventListener() {},
    removeEventListener() {},
    closest: () => null,
    contains: () => false,
    focus() {},
    getAttribute: () => '',
    setAttribute() {},
    removeAttribute() {}
  };

  const context = {
    console,
    setTimeout,
    window: {
      apiClient,
      LoveBudEditorMemoryFormMode: {},
      LoveBudEditorMemoryFormPreview: {},
      LoveBudEditorMemoryFormTime: {},
      LoveBudEditorMemoryFormPayload: {}
    },
    document: {
      getElementById: () => ({ ...noopElement }),
      querySelector: () => ({ ...noopElement }),
      addEventListener() {},
      removeEventListener() {}
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-save.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form.js'), 'utf8'), context);
  return context;
}

function buildForm(context) {
  return context.window.createEditorMemoryForm({
    i18n: (key) => key,
    treeId: 'tree-1',
    getSelectedNodeId: () => 'root',
    getCanonicalRootId: () => 'root',
    resolveParentIdForCreate: () => 'root',
    updateSaveStatus: () => {},
    showToast: () => {},
    getYouTubeInputErrorMessage: () => 'invalid',
    nextMemoryId: () => 'memory-1',
    normalizeMemory: (memory) => memory,
    getTreeMemories: () => [],
    setTreeMemories: () => {},
    setLocalSaveMode: () => {},
    drawNode: () => {},
    drawBranch: () => {},
    calcPosition: () => ({}),
    updateSidebarStatus: () => {},
    updateFocusSelectedBtn: () => {},
    setDetailEmptyState: () => {},
    selectNode: () => {},
    treeMemories: () => [],
    setCachedMemories: () => {},
    rerenderCanvas: () => {},
    focusNodeById: () => {}
  });
}

test('editor memory form enriches YouTube payload when oEmbed channel metadata is available', async () => {
  const context = createEditorFormContext({
    getYouTubeOEmbedChannel: async () => ({
      channelId: '@woowayoung',
      channelName: '우아한형제들',
      channelUrl: 'https://www.youtube.com/@woowayoung'
    })
  });
  const form = buildForm(context);

  const payload = await form.enrichPayloadChannelMetadata({
    sourceType: 'youtube',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  assert.equal(payload.channelId, '@woowayoung');
  assert.equal(payload.channelName, '우아한형제들');
  assert.equal(payload.channelUrl, 'https://www.youtube.com/@woowayoung');
});

test('editor memory form keeps save payload when oEmbed channel enrichment fails', async () => {
  const context = createEditorFormContext({
    getYouTubeOEmbedChannel: async () => {
      throw new Error('network down');
    }
  });
  const form = buildForm(context);
  const originalPayload = {
    sourceType: 'youtube',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    title: 'Keep me'
  };

  const payload = await form.enrichPayloadChannelMetadata(originalPayload, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  assert.equal(payload, originalPayload);
  assert.equal(payload.channelName, undefined);
  assert.equal(payload.title, 'Keep me');
});
