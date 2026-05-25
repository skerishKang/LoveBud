const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_FILE = path.join(ROOT, 'js/viewer/public-tree-viewer.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('This is a static and behavioral contract for public tree viewer media URL sanitization', () => {
  const source = readFile(TARGET_FILE);

  // 1. Source code check: prohibit raw thumb in img src
  const renderPreviewMemoryStart = source.indexOf('function renderPreviewMemory(');
  const renderPreviewMemoryEnd = source.indexOf('function setupRetry()', renderPreviewMemoryStart);
  assert.ok(renderPreviewMemoryStart !== -1, 'renderPreviewMemory must exist');
  assert.ok(renderPreviewMemoryEnd !== -1, 'setupRetry must exist');
  const renderPreviewMemorySlice = source.substring(renderPreviewMemoryStart, renderPreviewMemoryEnd);

  // Prohibit unescaped/direct `thumb` assignments to innerHTML
  // Must use `safeThumb` instead of `thumb`
  assert.doesNotMatch(renderPreviewMemorySlice, /mediaContainer\.innerHTML\s*=\s*.*escapeHtml\(thumb\)/, 'Prohibit raw thumb usage in innerHTML');
  assert.match(renderPreviewMemorySlice, /mediaContainer\.innerHTML\s*=\s*.*escapeHtml\(safeThumb\)/, 'Require safeThumb usage in innerHTML');

  // Verify safeSourceUrl is defined and passed to extractYouTubeVideoId
  assert.match(renderPreviewMemorySlice, /const safeSourceUrl\s*=\s*sanitizeUrl\(sourceUrl\);/, 'safeSourceUrl must be defined');
  assert.match(renderPreviewMemorySlice, /const ytVideoId\s*=\s*extractYouTubeVideoId\(safeSourceUrl\);/, 'extractYouTubeVideoId must use safeSourceUrl');

  // Verify safeEmbedUrl is defined and assigned to iframe src
  assert.match(renderPreviewMemorySlice, /var safeEmbedUrl\s*=\s*sanitizeUrl\(embedUrl\);/, 'safeEmbedUrl must sanitize the embed URL');
  assert.match(renderPreviewMemorySlice, /iframe src=["'].*escapeHtml\(safeEmbedUrl\)/, 'iframe src must assign to safeEmbedUrl');

  // 2. Behavioral verification of sanitizeUrl
  // Extract and evaluate the sanitizeUrl helper
  const sanitizeUrlStart = source.indexOf('function sanitizeUrl(value) {');
  assert.ok(sanitizeUrlStart !== -1, 'sanitizeUrl helper must be defined');
  
  // Find closing brace of sanitizeUrl
  let braceCount = 1;
  let index = sanitizeUrlStart + 'function sanitizeUrl(value) {'.length;
  while (braceCount > 0 && index < source.length) {
    if (source[index] === '{') braceCount++;
    else if (source[index] === '}') braceCount--;
    index++;
  }
  const sanitizeUrlFuncBody = source.substring(sanitizeUrlStart, index);

  // Create local sandbox function
  const sandboxSanitizeUrl = new Function('value', 'window', `
    ${sanitizeUrlFuncBody}
    return sanitizeUrl(value);
  `);

  // Test cases for unsafe payloads
  const unsafePayloads = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    'ftp://example.com/image.jpg',
    'invalid-url',
    '/relative/path.jpg',
    '   ',
    null,
    undefined
  ];

  const mockWindow = { LoveBudSecurity: {} };

  for (const payload of unsafePayloads) {
    const result = sandboxSanitizeUrl(payload, mockWindow);
    assert.equal(result, '', `Unsafe payload "${payload}" must be rejected and return empty string`);
  }

  // Test cases for safe URLs
  const safePayloads = [
    'http://example.com/image.jpg',
    'https://example.com/image.jpg',
    'HTTPS://YOUTUBE.COM/watch?v=12345678901',
    'https://youtube.com/embed/12345678901'
  ];

  for (const payload of safePayloads) {
    const result = sandboxSanitizeUrl(payload, mockWindow);
    assert.ok(result.startsWith('http://') || result.startsWith('https://'), `Safe payload "${payload}" must be accepted`);
  }

  // Test delegation to window.LoveBudSecurity.sanitizeUrl
  const delegatingWindow = {
    LoveBudSecurity: {
      sanitizeUrl: (val) => `delegated:${val}`
    }
  };
  const delegatedResult = sandboxSanitizeUrl('https://example.com', delegatingWindow);
  assert.equal(delegatedResult, 'delegated:https://example.com', 'Should delegate to window.LoveBudSecurity.sanitizeUrl when available');
});
