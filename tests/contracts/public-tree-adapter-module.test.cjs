const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadAdapter() {
  const source = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
  const sandbox = { window: {}, console, URL };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.LoveTreePublicTreeAdapter;
}

test('public tree adapter normalizes camelCase tree record', () => {
  const adapter = loadAdapter();
  const tree = adapter.normalizeBrowseTreeRecord({
    id: 't1',
    title: 'Tree',
    visibility: 'public',
    createdAt: '2026-04-20T00:00:00Z',
    ownerId: 'u1',
  });

  assert.equal(tree.id, 't1');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
  assert.equal(tree.ownerId, 'u1');
});

test('transitional compatibility: public tree adapter normalizes legacy wrapped data', () => {
  const adapter = loadAdapter();
  const tree = adapter.normalizeBrowseTreeRecord({
    data: { id: 't1', visibility: 'public', created_at: '2026-04-20T00:00:00Z' }
  });

  assert.equal(tree.id, 't1');
  assert.equal(tree.visibility, 'public');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
});

test('transitional compatibility: public tree adapter normalizes snake_case memory fields', () => {
  const adapter = loadAdapter();
  const memory = adapter.normalizeBrowseMemoryRecord({
    data: {
      id: 'm1',
      tree_id: 't1',
      created_at: '2026-04-20T00:00:00Z',
      emotion_tags: ['legacy']
    }
  });

  assert.equal(memory.treeId, 't1');
  assert.equal(memory.createdAt, '2026-04-20T00:00:00Z');
  assert.deepEqual(memory.emotionTags, ['legacy']);
});

test('public tree adapter builds browse models from camelCase-normalized data', () => {
  const adapter = loadAdapter();
  const result = adapter.buildPublicTreeViewModels(
    [{ id: 't1', title: 'Tree', visibility: 'public' }],
    [{ id: 'm1', treeId: 't1', emotionTags: ['happy'], timestamp: '2024-01' }]
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].memoryCount, 1);
});


test('public tree adapter #3948: external v query never promotes to YouTube', () => {
  const adapter = loadAdapter();
  const cases = [
    'https://example.invalid/watch?v=abcdefghijk',
    'https://youtube.com.example.invalid/watch?v=abcdefghijk',
    'https://notyoutube.com/watch?v=abcdefghijk',
    'https://youtu.be.example.invalid/abcdefghijk'
  ];

  for (const url of cases) {
    assert.equal(adapter.canonicalizeYouTubeSourceUrl(url), url);
    assert.notEqual(adapter.canonicalizeYouTubeSourceUrl(url), 'https://www.youtube.com/embed/abcdefghijk');
  }
});

test('public tree adapter #3948: only exact http and https protocols survive sanitization', () => {
  const adapter = loadAdapter();
  const rejected = [
    'httpx://example.invalid/path',
    'httpsx://example.invalid/path',
    'javascript:alert(1)',
    'data:text/html,boom',
    'file:///tmp/video',
    'custom://example.invalid/path'
  ];

  for (const url of rejected) {
    assert.equal(adapter.sanitizeUrl(url), '');
    assert.equal(adapter.canonicalizeYouTubeSourceUrl(url), '');
  }

  assert.equal(adapter.sanitizeUrl('https://example.com/video'), 'https://example.com/video');
  assert.equal(adapter.sanitizeUrl('example.com/video'), 'https://example.com/video');
});

test('public tree adapter #3948: trusted YouTube source forms canonicalize with strict ids', () => {
  const adapter = loadAdapter();
  const canonical = 'https://www.youtube.com/embed/abcdefghijk';
  const accepted = [
    'https://youtube.com/watch?v=abcdefghijk',
    'https://www.youtube.com/watch?v=abcdefghijk',
    'https://m.youtube.com/watch?v=abcdefghijk',
    'https://music.youtube.com/watch?v=abcdefghijk',
    'https://youtu.be/abcdefghijk',
    'https://www.youtube.com/embed/abcdefghijk',
    'https://www.youtube.com/shorts/abcdefghijk',
    'https://www.youtube.com/live/abcdefghijk',
    'https://www.youtube.com/v/abcdefghijk'
  ];

  for (const url of accepted) {
    assert.equal(adapter.canonicalizeYouTubeSourceUrl(url), canonical, url);
  }

  assert.equal(
    adapter.canonicalizeYouTubeSourceUrl('https://www.youtube.com/watch?v=abcdefghij'),
    'https://www.youtube.com/watch?v=abcdefghij'
  );
  assert.equal(
    adapter.canonicalizeYouTubeSourceUrl('https://www.youtube.com/watch?v=abcdefghijkl'),
    'https://www.youtube.com/watch?v=abcdefghijkl'
  );
});

test('public tree adapter #3948: source and thumbnail host policies stay separate and exact', () => {
  const adapter = loadAdapter();

  assert.equal(adapter.isTrustedYouTubeSourceHost('www.youtube.com'), true);
  assert.equal(adapter.isTrustedYouTubeSourceHost('youtu.be'), true);
  assert.equal(adapter.isTrustedYouTubeSourceHost('i.ytimg.com'), false);
  assert.equal(adapter.isTrustedYouTubeThumbnailHost('i.ytimg.com'), true);
  assert.equal(adapter.isTrustedYouTubeThumbnailHost('img.youtube.com'), true);
  assert.equal(adapter.isTrustedYouTubeThumbnailHost('youtube.com.example.invalid'), false);
  assert.equal(adapter.isTrustedYouTubeThumbnailHost('i.ytimg.com.example.invalid'), false);
  assert.equal(adapter.isYouTubeHost('https://notyoutube.com/watch?v=abcdefghijk'), false);
  assert.equal(adapter.isYouTubeHost('https://youtube.com.example.invalid/watch?v=abcdefghijk'), false);
});

test('public tree adapter #3948: trusted thumbnails canonicalize without trusting lookalikes', () => {
  const adapter = loadAdapter();
  const canonical = 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg';

  assert.equal(adapter.canonicalizeYouTubeThumbnailUrl('https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg'), canonical);
  assert.equal(adapter.canonicalizeYouTubeThumbnailUrl('https://img.youtube.com/vi/abcdefghijk/0.jpg'), canonical);
  assert.equal(adapter.canonicalizeYouTubeThumbnailUrl('', 'https://www.youtube.com/watch?v=abcdefghijk'), canonical);
  assert.equal(
    adapter.canonicalizeYouTubeThumbnailUrl('https://cdn.example.com/thumb.jpg', 'https://www.youtube.com/watch?v=abcdefghijk'),
    canonical
  );
  assert.equal(
    adapter.canonicalizeYouTubeThumbnailUrl('https://i.ytimg.com.example.invalid/vi/abcdefghijk/mqdefault.jpg'),
    'https://i.ytimg.com.example.invalid/vi/abcdefghijk/mqdefault.jpg'
  );
});

test('public tree adapter #3948: ordinary https source remains the sanitized original', () => {
  const adapter = loadAdapter();
  const input = 'https://media.example/video/123?ref=public';
  assert.equal(adapter.canonicalizeYouTubeSourceUrl(input), input);

  const memory = adapter.normalizeBrowseMemoryRecord({
    id: 'm-safe-external',
    treeId: 't1',
    sourceUrl: 'https://example.invalid/watch?v=abcdefghijk',
    thumbnail: 'https://cdn.example/thumb.jpg'
  });
  assert.equal(memory.sourceUrl, 'https://example.invalid/watch?v=abcdefghijk');
});
