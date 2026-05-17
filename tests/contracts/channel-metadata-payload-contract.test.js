const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function createPayloadContext(url) {
  const context = {
    console,
    URL,
    URLSearchParams,
    Date,
    window: {
      LoveBudEditorMemoryFormTime: {
        resolveStartSeconds: () => null,
        validateEndTime: () => ({ ok: true, endSeconds: null })
      },
      LoveBudEditorUtils: {
        getCanonicalRootId: () => 'root-1'
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/utils/media.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/editor/editor-memory-form-payload.js'), 'utf8'), context);

  return context.window.LoveBudEditorMemoryFormPayload.buildMemoryPayload({
    refs: {
      urlInput: { value: url },
      titleInput: { value: 'Channel moment' },
      memoInput: { value: 'Captured from a channel URL' },
      startTimeInput: { value: '' },
      endTimeInput: { value: '' }
    },
    currentInputMode: 'link',
    userHasEditedStartTime: false,
    i18n: (key) => key,
    treeId: 'tree-1',
    getYouTubeInputErrorMessage: () => 'invalid youtube url',
    getTreeMemories: () => [],
    resolveParentIdForCreate: () => 'root-1',
    getSelectedNodeId: () => 'root-1',
    getCanonicalRootId: () => 'root-1'
  });
}

test('YouTube handle URL populates optional channel fields in memory payload', () => {
  const result = createPayloadContext('https://www.youtube.com/@woowayoung/shorts/dQw4w9WgXcQ');

  assert.equal(result.ok, true);
  assert.equal(result.data.sourceType, 'youtube');
  assert.equal(result.data.sourceUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(result.data.channelId, '@woowayoung');
  assert.equal(result.data.channelName, '@woowayoung');
  assert.equal(result.data.channelUrl, 'https://www.youtube.com/@woowayoung');
});

test('YouTube channel ID URL populates channel id and URL without guessing a display name', () => {
  const result = createPayloadContext('https://youtube.com/channel/UC1234567890abcdefghi/videos/dQw4w9WgXcQ');

  assert.equal(result.ok, true);
  assert.equal(result.data.channelId, 'UC1234567890abcdefghi');
  assert.equal(result.data.channelName, null);
  assert.equal(result.data.channelUrl, 'https://www.youtube.com/channel/UC1234567890abcdefghi');
});

test('standard YouTube watch URL does not invent channel fields without oEmbed data', () => {
  const result = createPayloadContext('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'channelId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'channelName'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'channelUrl'), false);
});
