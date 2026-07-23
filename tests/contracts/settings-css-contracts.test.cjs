const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Verification contracts for Stage 67 settings CSS split
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'settings.css');
const HTML_PATH = path.join(ROOT, 'pages', 'settings.html');

const SPLIT_FILES = [
  'base.css',
  'components.css',
  'sections.css',
  'responsive.css',
];

test('css/settings.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/settings\\/${file}(\\?v=[\\w-]+)?['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./settings/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'settings', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('settings.html references the original settings.css file and version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag
  assert.match(
    html,
    /href="\.\.\/css\/settings\.css\?v=20260724-3635-1"/,
    'settings.html must continue to load css/settings.css?v=20260724-3635-1'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '\\.settings-layout', file: 'base.css' },
    { class: '\\.settings-card', file: 'base.css' },
    { class: '\\.settings-close-btn', file: 'components.css' },
    { class: '\\.logout-btn', file: 'components.css' },
    { class: '\\.settings-scope-note', file: 'sections.css' },
    { class: '\\.settings-intro-card', file: 'sections.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'settings', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = new RegExp(mapping.class);

    assert.match(
      content,
      regex,
      `Class ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});
