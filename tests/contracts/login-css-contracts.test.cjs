const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'login.css');
const HTML_PATH = path.join(ROOT, 'pages', 'login.html');

const SPLIT_FILES = [
  'base.css',
  'layout.css',
  'components.css',
  'forms.css',
  'sections.css',
  'responsive.css',
];

test('css/login.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/login\\/${file}['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./login/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'login', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('login.html references the original login.css file and version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag
  assert.match(
    html,
    /href="\.\.\/css\/login\.css\?v=20260504-642"/,
    'login.html must continue to load css/login.css?v=20260504-642'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: 'input\\[type="text"\\]', file: 'base.css' },
    { class: '\\.login-shell', file: 'layout.css' },
    { class: '\\.login-card', file: 'layout.css' },
    { class: '\\.login-btn-google', file: 'components.css' },
    { class: '\\.user-dropdown', file: 'components.css' },
    { class: '\\.login-form', file: 'forms.css' },
    { class: '\\.login-email-modal', file: 'forms.css' },
    { class: '\\.login-redirect-notice', file: 'sections.css' },
    { class: '\\.login-signup-section', file: 'sections.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'login', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = new RegExp(mapping.class);

    assert.match(
      content,
      regex,
      `Class ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});
