const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createViewerContext() {
  const context = {
    URL,
    console,
    window: {
      LoveBudSecurity: {
        escapeHtml(value) {
          return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }
      }
    },
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      querySelector: () => null
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/viewer/public-tree-viewer.js'), 'utf8'), context);
  return context;
}

test('public viewer channel meta renders safe YouTube handle link', () => {
  const context = createViewerContext();
  const html = context.window.LoveBudPublicViewerChannelLink.buildChannelMetaHtml({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'https://www.youtube.com/@woowayoung'
  });

  assert.match(html, /viewer-channel-meta/);
  assert.match(html, /from <a/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/@woowayoung"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, />@woowayoung<\/a>/);
});

test('public viewer channel meta falls back to safe channelId URL when explicit URL is unsafe', () => {
  const context = createViewerContext();
  const html = context.window.LoveBudPublicViewerChannelLink.buildChannelMetaHtml({
    channelId: '@woowayoung',
    channelName: '@woowayoung',
    channelUrl: 'javascript:alert(1)'
  });

  assert.match(html, /href="https:\/\/www\.youtube\.com\/@woowayoung"/);
  assert.doesNotMatch(html, /javascript:/i);
});

test('public viewer channel meta escapes channel label text', () => {
  const context = createViewerContext();
  const html = context.window.LoveBudPublicViewerChannelLink.buildChannelMetaHtml({
    channelId: '@woowayoung',
    channelName: '<img src=x onerror=alert(1)>',
    channelUrl: 'https://www.youtube.com/@woowayoung'
  });

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/i);
});

test('public viewer channel meta does not render without safe URL', () => {
  const context = createViewerContext();
  const html = context.window.LoveBudPublicViewerChannelLink.buildChannelMetaHtml({
    channelName: '@woowayoung',
    channelUrl: 'http://www.youtube.com/@woowayoung'
  });

  assert.equal(html, '');
});

test('public viewer channel meta supports canonical channel ID URLs', () => {
  const context = createViewerContext();
  const html = context.window.LoveBudPublicViewerChannelLink.buildChannelMetaHtml({
    channelId: 'UC1234567890abcdefghi',
    channelUrl: 'https://youtube.com/channel/UC1234567890abcdefghi'
  });

  assert.match(html, /href="https:\/\/www\.youtube\.com\/channel\/UC1234567890abcdefghi"/);
  assert.match(html, />UC1234567890abcdefghi<\/a>/);
});
