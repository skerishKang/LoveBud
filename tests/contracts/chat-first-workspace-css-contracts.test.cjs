const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'chat-first-workspace.css');
const HTML_PATH = path.join(ROOT, 'pages', 'chat-first-workspace.html');

const SPLIT_FILES = [
  'base.css',
  'entry.css',
  'workspace-layout.css',
  'moments-tree.css',
  'chat-panel.css',
  'mobile.css',
  'animations.css',
];

test('css/chat-first-workspace.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/chat-first-workspace\\/${file}['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./chat-first-workspace/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'chat-first-workspace', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('pages/chat-first-workspace.html references the original stylesheet exact path & version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag
  assert.match(
    html,
    /href="\.\.\/css\/chat-first-workspace\.css\?v=20260518-1"/,
    'pages/chat-first-workspace.html must continue to load ../css/chat-first-workspace.css?v=20260518-1'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '.cfw-body', file: 'base.css' },
    { class: '.cfw-entry', file: 'entry.css' },
    { class: '.cfw-workspace', file: 'workspace-layout.css' },
    { class: '.cfw-moment-list', file: 'moments-tree.css' },
    { class: '.cfw-chat-msg', file: 'chat-panel.css' },
    { class: '.cfw-bottom-sheet', file: 'mobile.css' },
    { class: '.cfw-fade-in', file: 'animations.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'chat-first-workspace', mapping.file);
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
