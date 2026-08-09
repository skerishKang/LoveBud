const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_JS = path.join(ROOT, 'js/search/search-preview-media-helper.js');
const SECURITY_JS = path.join(ROOT, 'js/utils/security.js');
const DETAIL_UTILS_JS = path.join(ROOT, 'js/detail/detail-utils.js');
const DETAIL_VIDEO_JS = path.join(ROOT, 'js/detail/detail-video.js');

const helperSrc = fs.readFileSync(HELPER_JS, 'utf8');
const securitySrc = fs.readFileSync(SECURITY_JS, 'utf8');
const detailUtilsSrc = fs.readFileSync(DETAIL_UTILS_JS, 'utf8');
const detailVideoSrc = fs.readFileSync(DETAIL_VIDEO_JS, 'utf8');

function loadHelper(withSecurity = true) {
  const mockWindow = {
    location: { origin: 'https://lovebud.pages.dev' }
  };

  if (withSecurity) {
    mockWindow.LoveBudSecurity = {
      sanitizeUrl(url) {
        if (!url) return '';
        const raw = String(url).trim();
        // Canonical sanitize: absolute http or https URLs only
        if (/^https?:\/\//i.test(raw)) {
          return raw;
        }
        return '';
      },
      escapeHtml(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    };
  }

  const mockDocument = {
    documentElement: { lang: 'ko' }
  };

  const context = {
    window: mockWindow,
    document: mockDocument,
    console: console,
    URL: URL
  };

  mockWindow.window = mockWindow;

  vm.runInNewContext(helperSrc, context);
  return mockWindow.LoveBudSearchPreviewMediaHelper;
}

function loadDetailMedia() {
  const mockWindow = {
    location: { origin: 'https://lovebud.pages.dev' },
    t: (key) => key
  };
  mockWindow.window = mockWindow;

  const context = {
    window: mockWindow,
    console,
    URL,
    URLSearchParams
  };

  vm.runInNewContext(securitySrc, context);
  vm.runInNewContext(detailUtilsSrc, context);
  vm.runInNewContext(detailVideoSrc, context);

  const utils = mockWindow.LoveBudDetailUtils.createUtils({ isPagesContext: true });
  const video = mockWindow.LoveBudDetailVideo.createVideoHelpers({
    tText: utils.tText,
    escapeHtml: utils.escapeHtml,
    normalizeVideoSourceUrl: utils.normalizeVideoSourceUrl
  });

  return { utils, video };
}

function assertEmptyDetailMedia(result, label) {
  assert.equal(result && result.embedUrl || '', '', `${label}: embedUrl must be empty`);
  assert.equal(result && result.watchUrl || '', '', `${label}: watchUrl must be empty`);
}

const unsafePayloads = [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'ftp://example.com/video',
  'invalid-url',
  '',
  null,
  undefined
];

test('search-preview-media-helper: sanitizeUrl and toPlayableEmbedUrl reject unsafe protocols (with LoveBudSecurity)', () => {
  const helper = loadHelper(true);

  for (const payload of unsafePayloads) {
    const embed = helper.toPlayableEmbedUrl(payload);
    const iframeSrc = helper.generateIframeSource(payload);
    assert.equal(embed, '', `toPlayableEmbedUrl should reject: ${payload}`);
    assert.equal(iframeSrc, '', `generateIframeSource should reject: ${payload}`);
  }
});

test('search-preview-media-helper: sanitizeUrl and toPlayableEmbedUrl reject unsafe protocols (local fallback path)', () => {
  const helper = loadHelper(false);

  for (const payload of unsafePayloads) {
    const embed = helper.toPlayableEmbedUrl(payload);
    const iframeSrc = helper.generateIframeSource(payload);
    assert.equal(embed, '', `toPlayableEmbedUrl (fallback) should reject: ${payload}`);
    assert.equal(iframeSrc, '', `generateIframeSource (fallback) should reject: ${payload}`);
  }
});

test('search-preview-media-helper: renderPreviewIframe returns empty string for unsafe sourceUrl', () => {
  const helper = loadHelper(true);

  for (const payload of unsafePayloads) {
    const markup = helper.renderPreviewIframe(payload, 'Tree Title', 'Media Title');
    assert.equal(markup, '', `renderPreviewIframe should return empty string for unsafe url: ${payload}`);
    assert.ok(!markup.includes('<iframe'), 'Should not contain iframe tag');
  }
});

test('search-preview-media-helper: getPreviewMediaMemory does not select memory with unsafe sourceUrl and thumbnail', () => {
  const helper = loadHelper(true);

  // 1. Both sourceUrl and thumbnail are unsafe -> should be ignored (returns null)
  const memories1 = [
    { sourceUrl: 'javascript:alert(1)', thumbnail: 'data:image/png;base64,...' }
  ];
  assert.equal(helper.getPreviewMediaMemory(memories1), null);

  // 2. Unsafe sourceUrl but safe thumbnail -> select this memory
  const memories2 = [
    { sourceUrl: 'javascript:alert(1)', thumbnail: 'https://example.com/thumb.jpg' }
  ];
  assert.deepEqual(helper.getPreviewMediaMemory(memories2), memories2[0]);

  // 3. Safe sourceUrl and unsafe thumbnail -> select this memory
  const memories3 = [
    { sourceUrl: 'https://example.com/video.mp4', thumbnail: 'javascript:alert(1)' }
  ];
  assert.deepEqual(helper.getPreviewMediaMemory(memories3), memories3[0]);
});

test('search-preview-media-helper: YouTube URLs are normalized to playable embed URLs', () => {
  const helper = loadHelper(true);

  const ytUrls = [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ];

  const expectedEmbedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&mute=0&controls=0&rel=0&modestbranding=1';

  for (const url of ytUrls) {
    const embed = helper.toPlayableEmbedUrl(url);
    const iframeSrc = helper.generateIframeSource(url);
    assert.equal(embed, expectedEmbedUrl);
    assert.equal(iframeSrc, expectedEmbedUrl);
  }
});

test('detail media #3916: approved YouTube forms canonicalize to HTTPS embed/watch URLs', () => {
  const { utils } = loadDetailMedia();
  const id = 'dQw4w9WgXcQ';
  const sources = [
    `https://youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `http://www.youtube.com/watch?v=${id}`
  ];

  for (const source of sources) {
    const normalized = utils.normalizeVideoSourceUrl(source);
    assert.equal(normalized.embedUrl, `https://www.youtube.com/embed/${id}`, source);
    assert.equal(normalized.watchUrl, `https://www.youtube.com/watch?v=${id}`, source);
  }
});

test('detail media #3916: lookalike hosts are watch-only and never receive iframe authority', () => {
  const { utils } = loadDetailMedia();
  const id = 'dQw4w9WgXcQ';
  const lookalikes = [
    `https://evil-youtube.com/watch?v=${id}`,
    `https://youtube.com.evil.example/watch?v=${id}`,
    `https://notyoutube.com/watch?v=${id}`
  ];

  for (const source of lookalikes) {
    const normalized = utils.normalizeVideoSourceUrl(source);
    assert.equal(normalized.embedUrl, '', source);
    assert.equal(normalized.watchUrl, new URL(source).href, source);
  }

  const general = utils.normalizeVideoSourceUrl('https://example.com/video?id=1');
  assert.equal(general.embedUrl, '');
  assert.equal(general.watchUrl, 'https://example.com/video?id=1');
});

test('detail media #3916: userinfo confusion, unsafe schemes, malformed URLs and invalid IDs fail closed', () => {
  const { utils } = loadDetailMedia();
  const invalid = [
    'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
    'https://attacker@www.youtube.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'custom:payload',
    'relative/path',
    'https://[broken',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQextra',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ%22%20onload%3D%22alert(1)',
    'https://youtu.be/not-valid'
  ];

  for (const source of invalid) {
    assertEmptyDetailMedia(utils.normalizeVideoSourceUrl(source), source);
  }
});

test('detail media #3916: unsafe source values render no iframe and no external link', () => {
  const { video } = loadDetailMedia();
  const unsafe = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'https://[broken'
  ];

  for (const sourceUrl of unsafe) {
    const markup = video.buildVideoMainMarkup({ sourceUrl, title: 'Unsafe source' });
    assert.doesNotMatch(markup, /<iframe\b/, sourceUrl);
    assert.doesNotMatch(markup, /<a\b[^>]*href=/, sourceUrl);
  }
});

test('detail media #3916: approved YouTube still renders canonical iframe and watch CTA', () => {
  const { video } = loadDetailMedia();
  const id = 'dQw4w9WgXcQ';
  const markup = video.buildVideoMainMarkup({
    sourceUrl: `https://youtu.be/${id}`,
    title: 'Approved video'
  });

  assert.match(markup, /<iframe\b/);
  assert.match(markup, new RegExp(`src="https://www\\.youtube\\.com/embed/${id}\\?autoplay=0"`));
  assert.match(markup, new RegExp(`href="https://www\\.youtube\\.com/watch\\?v=${id}"`));
});

test('detail media #3916: unsupported safe source is watch-only and never renders arbitrary iframe', () => {
  const { video } = loadDetailMedia();
  const markup = video.buildVideoMainMarkup({
    sourceUrl: 'https://media.example/video/123',
    title: 'External source'
  });

  assert.doesNotMatch(markup, /<iframe\b/);
  assert.match(markup, /href="https:\/\/media\.example\/video\/123"/);
});

test('detail media #3916: iframe src quote payload is escaped at the final attribute boundary', () => {
  const { video } = loadDetailMedia();
  const markup = video.buildIframeEmbedMarkup({
    iframeSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ" onload="alert(1)',
    watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Title <unsafe>'
  });

  assert.ok(markup.includes('src="https://www.youtube.com/embed/dQw4w9WgXcQ&quot; onload=&quot;alert(1)"'));
  assert.doesNotMatch(markup, /src="[^"]*"\s+onload=/i);
  assert.ok(markup.includes('title="Title &lt;unsafe&gt;"'));
});

// ── Detail CSP-safe thumbnail fallback (#3943) ───────────────────────────────
const DETAIL_CONNECTED_JS_3943 = path.join(ROOT, 'js/detail/detail-connected.js');
const DETAIL_BOOTSTRAP_JS_3943 = path.join(ROOT, 'js/detail.js');
const HEADERS_3943 = path.join(ROOT, '_headers');
const detailConnectedSrc3943 = fs.readFileSync(DETAIL_CONNECTED_JS_3943, 'utf8');
const detailBootstrapSrc3943 = fs.readFileSync(DETAIL_BOOTSTRAP_JS_3943, 'utf8');
const headersSrc3943 = fs.readFileSync(HEADERS_3943, 'utf8');

function createDetailFallbackFakeImage3943(src) {
  const listeners = new Map();
  let currentSrc = src;
  let writeCount = 0;

  return {
    dataset: {},
    get src() { return currentSrc; },
    set src(value) { currentSrc = String(value); writeCount += 1; },
    get currentSrc() { return currentSrc; },
    getAttribute(name) { return name === 'src' ? currentSrc : null; },
    setAttribute(name, value) {
      if (name === 'src') {
        currentSrc = String(value);
        writeCount += 1;
      }
    },
    addEventListener(type, handler) {
      const existing = listeners.get(type) || [];
      existing.push(handler);
      listeners.set(type, existing);
    },
    dispatchError() {
      for (const handler of [...(listeners.get('error') || [])]) {
        handler.call(this, { type: 'error' });
      }
    },
    listenerCount(type) { return (listeners.get(type) || []).length; },
    writeCount() { return writeCount; }
  };
}

function createDetailFallbackRoot3943(images) {
  return {
    querySelectorAll(selector) {
      return selector === '[data-detail-thumbnail-fallback="youtube"]' ? images : [];
    }
  };
}

function loadDetailConnected3943() {
  const mockWindow = { location: { href: 'https://lovebud.pages.dev/pages/detail.html' } };
  mockWindow.window = mockWindow;
  vm.runInNewContext(detailConnectedSrc3943, { window: mockWindow, console });
  return mockWindow.LoveBudDetailConnected;
}

async function loadDetailBootstrapLifecycle3943() {
  let onReady = null;
  let loaderArgs = null;
  const events = [];
  const refs = {
    videoMain: { id: 'videoMain' },
    connectedFragments: { id: 'connectedFragments' }
  };

  const mockDocument = {
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') onReady = handler;
    },
    getElementById(id) {
      return refs[id] || null;
    }
  };

  const noop = () => {};
  const utils = {
    createDetailNavigationHrefs: () => ({
      homeHref: '/',
      searchHref: '/search',
      myTreesHref: '/my-trees',
      buildPageHref: () => '/detail'
    }),
    tText: (key, fallback) => fallback || key,
    escapeHtml: (value) => String(value ?? ''),
    getLocalizedTagLabel: (value) => value,
    normalizeVideoSourceUrl: () => ({ embedUrl: '', watchUrl: '' }),
    resolveTreeMomentCount: () => 0,
    sortTreeMemories: (value) => value || [],
    isStructuralRootMemory: () => false,
    inferTreeContext: () => null
  };
  const video = {
    buildSoftPanelMarkup: () => '',
    buildVideoMainMarkup: () => '',
    bindYouTubeThumbnailFallbacks(root) {
      events.push(`bind:${root && root.id}`);
    }
  };
  const render = {
    renderMemoryBase() { events.push('render:main'); },
    renderTreeContext: noop
  };
  const connected = {
    getConnectedFlowMoments: () => [],
    renderConnectedFragments() { events.push('render:connected'); }
  };
  const mockWindow = {
    location: { pathname: '/pages/detail.html' },
    LoveBudDetailUtils: { createUtils: () => utils },
    LoveBudDetailVideo: { createVideoHelpers: () => video },
    LoveBudDetailRender: { createRenderers: () => render },
    LoveBudDetailConnected: { createConnectedRenderer: () => connected },
    LoveBudDetailCopy: { createCopyHelpers: () => ({ applyViewingPageCopy: noop }) },
    createDetailLoadingErrorBoundary: () => ({ renderMissingMemoryState: noop }),
    LoveBudDetailLoader: {
      createDetailLoader(args) {
        loaderArgs = args;
        return { loadCurrentDetail: async () => {} };
      }
    }
  };
  mockWindow.window = mockWindow;

  vm.runInNewContext(detailBootstrapSrc3943, {
    window: mockWindow,
    document: mockDocument,
    console
  });

  assert.ok(onReady, 'Detail must register a DOMContentLoaded lifecycle');
  await onReady();
  return { loaderArgs, events };
}

test('detail CSP #3943: image-only markup has marker, no inline executable handler, and preserves escaping', () => {
  const { video } = loadDetailMedia();
  const markup = video.buildImageOnlyMomentMarkup({
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg?x="<tag>',
    title: '<b>Title & "quoted"</b>',
    memo: '<script>caption()</script>'
  });

  assert.match(markup, /data-detail-thumbnail-fallback="youtube"/);
  assert.doesNotMatch(markup, /\son[a-z]+\s*=/i);
  assert.ok(markup.includes('x=&quot;&lt;tag&gt;'), 'thumbnail attribute must remain escaped');
  assert.ok(markup.includes('&lt;b&gt;Title &amp; &quot;quoted&quot;&lt;/b&gt;'), 'title must remain escaped');
  assert.ok(markup.includes('&lt;script&gt;caption()&lt;/script&gt;'), 'caption must remain escaped');
});

test('detail CSP #3943: hqdefault failure rewrites to mqdefault exactly once and duplicate bind is prevented', () => {
  const { video } = loadDetailMedia();
  const img = createDetailFallbackFakeImage3943('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  const root = createDetailFallbackRoot3943([img]);

  video.bindYouTubeThumbnailFallbacks(root);
  video.bindYouTubeThumbnailFallbacks(root);
  assert.equal(img.listenerCount('error'), 1, 'duplicate binder calls must not add duplicate listeners');

  img.dispatchError();
  assert.equal(img.src, 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  assert.equal(img.dataset.ytFallback, '1');
  assert.equal(img.writeCount(), 1, 'first hq failure must perform exactly one rewrite');

  img.dispatchError();
  assert.equal(img.src, 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  assert.equal(img.writeCount(), 1, 'mqdefault failure must not loop or rewrite again');
});

test('detail CSP #3943: non-hq image failure never rewrites an arbitrary URL', () => {
  const { video } = loadDetailMedia();
  const img = createDetailFallbackFakeImage3943('https://cdn.example.com/images/cover.jpg');

  video.bindYouTubeThumbnailFallbacks(createDetailFallbackRoot3943([img]));
  img.dispatchError();

  assert.equal(img.src, 'https://cdn.example.com/images/cover.jpg');
  assert.equal(img.writeCount(), 0);
  assert.equal(img.dataset.ytFallback, undefined);
});

test('detail CSP #3943: connected-card markup uses the same non-executable marker', () => {
  const module = loadDetailConnected3943();
  let html = '';
  const classList = { remove() {}, add() {} };
  const connectedFragments = {
    closest() { return { classList }; },
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); },
    querySelectorAll() { return []; }
  };

  const renderer = module.createConnectedRenderer({
    refs: { connectedFragments },
    tText: (key, fallback) => fallback || key,
    escapeHtml: (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
    buildPageHref: () => '/pages/detail.html?id=other',
    sortTreeMemories: (memories, current) => [current, ...(memories || [])],
    isStructuralRootMemory: () => false,
    buildSoftPanelMarkup: () => ''
  });

  renderer.renderConnectedFragments({
    memory: { id: 'current' },
    memories: [{
      id: 'other',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      title: '<unsafe>'
    }],
    treeId: 'tree',
    sourceContext: 'browse',
    degradedReason: null,
    treeMomentCount: 2
  });

  assert.match(html, /data-detail-thumbnail-fallback="youtube"/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.ok(html.includes('&lt;unsafe&gt;'), 'connected title must remain escaped');
});

test('detail CSP #3943: bootstrap binds fallback after both Detail render insertions', async () => {
  const { loaderArgs, events } = await loadDetailBootstrapLifecycle3943();
  assert.ok(loaderArgs, 'Detail loader must receive wrapped render callbacks');

  loaderArgs.renderMemoryBase({ id: 'm1' });
  assert.deepEqual(events.slice(0, 2), ['render:main', 'bind:videoMain']);

  loaderArgs.renderConnectedFragments({ memory: { id: 'm1' } });
  assert.deepEqual(events.slice(2, 4), ['render:connected', 'bind:connectedFragments']);
});

test('detail CSP #3943: root script-src remains strict without unsafe-inline', () => {
  const cspLine = headersSrc3943.split(/\r?\n/)
    .find((line) => line.includes('Content-Security-Policy:')) || '';
  const scriptSrc = cspLine.match(/script-src[^;]*/)?.[0] || '';

  assert.match(scriptSrc, /script-src 'self'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
});
