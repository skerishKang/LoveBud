const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createTreeViewerContext() {
  const context = {
    URL,
    console,
    window: {
      __LOVE_BUD_TREE_VIEWER_TEST_HOOKS__: true,
      __LOVE_BUD_TREE_VIEWER_SKIP_INIT__: true
    },
    document: {
      readyState: 'loading',
      addEventListener: () => {},
      querySelector: () => null,
      getElementById: () => null
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/viewer/tree-viewer.js'), 'utf8'), context);
  return context;
}

function createPanelContext() {
  const context = {
    URL,
    window: {
      LoveBudVisitorViewerData: {
        palette: {
          rose: { soft: '#fff1f3', stroke: '#e99aac', text: '#be123c' }
        },
        momentComments: {}
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/visitor-viewer/visitor-viewer-panels.js'), 'utf8'), context);
  return context;
}

test('tree viewer maps channel metadata from public memories into visitor moments', () => {
  const context = createTreeViewerContext();
  const viewerData = context.window.LoveBudTreeViewerTestHooks.buildBranches([
    {
      id: 'mem-1',
      visibility: 'public',
      title: 'With Channel Mem',
      emotionMemo: 'memo',
      emotionTags: ['tag'],
      channelId: '@woowayoung',
      channelName: '@woowayoung',
      channelUrl: 'https://www.youtube.com/@woowayoung'
    }
  ]);

  const moment = viewerData.branches[0].moments[0];
  assert.equal(moment.channelId, '@woowayoung');
  assert.equal(moment.channelName, '@woowayoung');
  assert.equal(moment.channelUrl, 'https://www.youtube.com/@woowayoung');
});

test('visitor moment panel renders safe channel link for selected public moment', () => {
  const context = createPanelContext();
  const html = context.window.LoveBudVisitorViewerPanels.renderPanel({
    activePanel: 'moment',
    selectedMoment: {
      id: 'moment-1',
      title: 'With Channel Mem',
      caption: 'caption',
      emoji: '✦',
      channelId: '@woowayoung',
      channelName: '@woowayoung',
      channelUrl: 'https://www.youtube.com/@woowayoung'
    },
    panelBranch: { id: 'main', name: 'Main', color: 'rose' }
  }, {});

  assert.match(html, /vv-moment-channel/);
  assert.match(html, /from <a/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/@woowayoung"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, />@woowayoung<\/a>/);
});

test('visitor moment panel does not render stale channel link without channel metadata', () => {
  const context = createPanelContext();
  const html = context.window.LoveBudVisitorViewerPanels.renderPanel({
    activePanel: 'moment',
    selectedMoment: {
      id: 'moment-2',
      title: 'No Channel Mem',
      caption: 'caption',
      emoji: '✦'
    },
    panelBranch: { id: 'main', name: 'Main', color: 'rose' }
  }, {});

  assert.doesNotMatch(html, /vv-moment-channel/);
  assert.doesNotMatch(html, /@woowayoung/);
});

test('visitor moment panel escapes channel label and rejects unsafe explicit URL', () => {
  const context = createPanelContext();
  const html = context.window.LoveBudVisitorViewerPanels.renderPanel({
    activePanel: 'moment',
    selectedMoment: {
      id: 'moment-3',
      title: 'Unsafe Channel Mem',
      caption: 'caption',
      emoji: '✦',
      channelId: '@woowayoung',
      channelName: '<img src=x onerror=alert(1)>',
      channelUrl: 'javascript:alert(1)'
    },
    panelBranch: { id: 'main', name: 'Main', color: 'rose' }
  }, {});

  assert.match(html, /href="https:\/\/www\.youtube\.com\/@woowayoung"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /<img/i);
});
