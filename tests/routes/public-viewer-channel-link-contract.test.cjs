const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-channel-link.js', 'utf8');
const viewHtml = fs.readFileSync('pages/view.html', 'utf8');

test('viewer channel link helper exposes safe url builders', () => {
  assert.ok(source.includes('function normalizeYouTubeHost(hostname)'));
  assert.ok(source.includes('function sanitizeYouTubeChannelUrl(url)'));
  assert.ok(source.includes('function buildChannelUrlFromId(channelId)'));
  assert.ok(source.includes('sanitizeYouTubeChannelUrl:'));
  assert.ok(source.includes('buildChannelUrlFromId'));
});

test('viewer channel link helper restricts youtube channel urls', () => {
  assert.ok(source.includes("parsed.protocol !== 'https:'"));
  assert.ok(source.includes("host !== 'youtube.com'"));
  assert.ok(source.includes('isSafeYouTubeChannelPath'));
  assert.ok(source.includes("parsed.search = ''"));
  assert.ok(source.includes("parsed.hash = ''"));
  assert.ok(source.includes('/^\\/@[0-9A-Za-z._-]{3,100}$/'));
  assert.ok(source.includes('/^\\/channel\\/UC[0-9A-Za-z_-]{10,100}$/'));
});

test('viewer channel link renders DOM nodes without html sinks', () => {
  const start = source.indexOf('function renderDetailChannelLink(data)');
  const end = source.indexOf('function installDetailChannelLinkPatch()');
  const boundary = source.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(boundary.includes('removeExistingChannelRow();'));
  assert.ok(boundary.includes('document.createElement'));
  assert.ok(boundary.includes('link.href = safeUrl'));
  assert.ok(boundary.includes("link.rel = 'noopener noreferrer'"));
  assert.ok(boundary.includes('link.textContent'));
  assert.ok(boundary.includes("titleEl.insertAdjacentElement('afterend', row)"));
  assert.equal(boundary.includes('innerHTML'), false);
  assert.equal(boundary.includes('insertAdjacentHTML'), false);
});

test('viewer channel link patch loads after detail adapter', () => {
  assert.ok(source.includes('window.createEditorDetailUI = patchedFactory'));
  assert.ok(source.includes('originalUpdateDetailPanel(data);'));
  assert.ok(source.includes('renderDetailChannelLink(data);'));
  assert.ok(viewHtml.indexOf('js/viewer/public-viewer-detail-ui.js') < viewHtml.indexOf('js/viewer/public-viewer-detail-channel-link.js'));
});
