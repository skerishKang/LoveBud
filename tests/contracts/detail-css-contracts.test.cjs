const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'detail.css');
const HTML_PATH = path.join(ROOT, 'pages', 'detail.html');

const SPLIT_FILES = [
  'base.css',
  'layout.css',
  'components.css',
  'sections.css',
  'responsive.css',
];

test('css/detail.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/detail\\/${file}['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./detail/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'detail', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('detail.html references the original detail.css file and version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag
  assert.match(
    html,
    /href="\.\.\/css\/detail\.css\?v=20260505-646"/,
    'detail.html must continue to load css/detail.css?v=20260505-646'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '\\.detail-page-shell', file: 'base.css' },
    { class: '\\.detail-layout', file: 'layout.css' },
    { class: '\\.video-main', file: 'components.css' },
    { class: '\\.moment-card', file: 'components.css' },
    { class: '\\.detail-hero', file: 'sections.css' },
    { class: '\\.diary-container', file: 'sections.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'detail', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = new RegExp(mapping.class);

    assert.match(
      content,
      regex,
      `Class ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});
