const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const HELPER_JS = path.join(ROOT, 'js/search/search-preview-media-helper.js');

const helperSrc = fs.readFileSync(HELPER_JS, 'utf8');

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
