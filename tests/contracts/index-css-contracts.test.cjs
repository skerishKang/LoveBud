const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'index.css');
const HTML_PATH = path.join(ROOT, 'index.html');

const SPLIT_FILES = [
  'base.css',
  'layout.css',
  'components.css',
  'sections.css',
  'responsive.css',
];

test('css/index.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/index\\/${file}['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./index/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'index', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('index.html references the original index.css file and version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag
  assert.match(
    html,
    /href="css\/index\.css\?v=20260618-2700-1"/,
    'index.html must continue to load css/index.css?v=20260618-2700-1'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '.home-v3-shell', file: 'base.css' },
    { class: '.home-v3-hero', file: 'layout.css' },
    { class: '.home-v3-actions', file: 'components.css' },
    { class: '.home-v3-feature', file: 'sections.css' },
    { class: '.home-intro-entry', file: 'components.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'index', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Escape special characters in class name for regex matching
    const escapedClass = mapping.class.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`${escapedClass}\\b`);

    assert.match(
      content,
      regex,
      `Class ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});
