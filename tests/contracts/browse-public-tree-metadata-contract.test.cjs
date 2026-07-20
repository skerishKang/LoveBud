const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. helper is exported to window', () => {
  const source = read('js/search/search-public-metadata-helper.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  
  const helper = context.window.LoveBudSearchPublicMetadataHelper;
  assert.ok(helper, 'window.LoveBudSearchPublicMetadataHelper must be exported');
});

test('2 & 3 & 4 & 5 & 6. helper logic checks', () => {
  const source = read('js/search/search-public-metadata-helper.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  
  const helper = context.window.LoveBudSearchPublicMetadataHelper;

  // 2. description/memo/summary/shortDescription fallback 지원
  assert.equal(helper.getPublicTreeDescription({ description: 'desc1' }), 'desc1');
  assert.equal(helper.getPublicTreeDescription({ memo: 'memo1' }), 'memo1');
  assert.equal(helper.getPublicTreeDescription({ summary: 'sum1' }), 'sum1');
  assert.equal(helper.getPublicTreeDescription({ shortDescription: 'short1' }), 'short1');
  assert.equal(helper.getPublicTreeDescription({ short_description: 'short_s' }), 'short_s');

  // 3. ownerDisplayName/authorName/uploaderName/displayName 등 지원
  assert.equal(helper.getPublicUploaderName({ ownerDisplayName: 'uploader1' }), 'uploader1');
  assert.equal(helper.getPublicUploaderName({ authorName: 'uploader-author' }), 'uploader-author');
  assert.equal(helper.getPublicUploaderName({ uploaderName: 'uploader-n' }), 'uploader-n');
  assert.equal(helper.getPublicUploaderName({ displayName: 'uploader-d' }), 'uploader-d');
  assert.equal(helper.getPublicUploaderName({ owner_name: 'uploader-o' }), 'uploader-o');

  // 4. uploaderName에서 raw id/email 등 internal id 노출 금지
  assert.equal(helper.getPublicUploaderName({ ownerDisplayName: 'test@example.com' }), '');
  assert.equal(helper.getPublicUploaderName({ ownerDisplayName: 'owner_12345678901234567890' }), '');
  assert.equal(helper.getPublicUploaderName({ ownerDisplayName: 'uid:12345678901234567890' }), '');
  assert.equal(helper.getPublicUploaderName({ ownerDisplayName: 'river' }), 'river');

  // 5. artist/topic/subjectName/theme topic fallback 지원
  assert.equal(helper.getPublicTopicLabel({ artist: 'art1' }), 'art1');
  assert.equal(helper.getPublicTopicLabel({ topic: 'top1' }), 'top1');
  assert.equal(helper.getPublicTopicLabel({ subjectName: 'sub1' }), 'sub1');
  assert.equal(helper.getPublicTopicLabel({ theme: 'thm1' }), 'thm1');
  // theme default labels ignored
  assert.equal(helper.getPublicTopicLabel({ theme: 'LoveTree' }), '');
  assert.equal(helper.getPublicTopicLabel({ theme: 'Mixed' }), '');

  // 6. tags safe tag list 변환 및 internal tags 제거
  const mockTree = {
    emotionTags: ['#happy', 'joy', 'uid:123', '__internal'],
    tags: ['smile', 'joy']
  };
  const tags = helper.getPublicTags(mockTree);
  assert.equal(JSON.stringify(tags), JSON.stringify(['happy', 'joy', 'smile']));
});

test('7 & 8 & 12. search-card-renderer, search-preview-renderer and empty fallback', () => {
  const cardRendererSource = read('js/search/search-card-renderer.js');
  const previewRendererSource = read('js/search/search-preview-renderer.js');

  // 7. search-card-renderer.js delegates metadata rendering to shared composition
  assert.ok(cardRendererSource.includes('bodyExtensionNode') || cardRendererSource.includes('metadataNode'),
    'card renderer must pass metadata as bodyExtensionNode to shared composition');

  // 8. search-preview-renderer.js contains hub metadata block rendering markers
  assert.ok(previewRendererSource.includes('hubMetadataHtml'));

  // 12. Missing metadata fallback: no empty tags/by/# elements rendered
  const helperSource = read('js/search/search-public-metadata-helper.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(helperSource, context);
  const helper = context.window.LoveBudSearchPublicMetadataHelper;

  // Render card metadata with completely empty values
  const cardHtmlEmpty = helper.renderCardMetadata({});
  assert.equal(cardHtmlEmpty, '<div class="tree-card-metadata-slot"><div class="tree-public-tags"></div></div>');

  const threeTagsHtml = helper.renderCardMetadata({ tags: ['tag1', 'tag2', 'tag3'] });
  assert.match(threeTagsHtml, /#tag1/);
  assert.match(threeTagsHtml, /#tag2/);
  assert.match(threeTagsHtml, /#tag3/);
  assert.match(threeTagsHtml, /\+1/);

  const hubHtmlEmpty = helper.renderHubMetadata({});
  assert.equal(hubHtmlEmpty, '');
});

test('9. pages/search.html loads helper before renderers', () => {
  const html = read('pages/search.html');
  const helperIndex = html.indexOf('search-public-metadata-helper.js');
  const cardIndex = html.indexOf('search-card-renderer.js');
  const previewIndex = html.indexOf('search-preview-renderer.js');

  assert.ok(helperIndex !== -1, 'helper script must be in search.html');
  assert.ok(cardIndex !== -1, 'card-renderer script must be in search.html');
  assert.ok(previewIndex !== -1, 'preview-renderer script must be in search.html');
  assert.ok(helperIndex < cardIndex, 'helper must load before card-renderer');
  assert.ok(helperIndex < previewIndex, 'helper must load before preview-renderer');
});

test('10. css manifest import check', () => {
  const parentCss = read('css/search/search-tree-card.css');
  assert.match(parentCss, /@import url\(['"]\.\/search-tree-card\/public-metadata\.css['"]\);/);
});

test('11. no DB/API/Scout/AI changes', () => {
  const helperSource = read('js/search/search-public-metadata-helper.js');
  
  assert.doesNotMatch(helperSource, /postgres/i);
  assert.doesNotMatch(helperSource, /apiClient\./);
  assert.doesNotMatch(helperSource, /scout/i);
  assert.doesNotMatch(helperSource, /aiSuggestion/i);
  assert.doesNotMatch(helperSource, /gpt/i);
  assert.doesNotMatch(helperSource, /gemini/i);
});
