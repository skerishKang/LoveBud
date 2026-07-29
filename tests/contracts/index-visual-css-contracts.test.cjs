const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css', 'index-visual.css');
const HTML_PATH = path.join(ROOT, 'index.html');

const SPLIT_FILES = [
  'base.css',
  'branch.css',
  'decorations.css',
  'growth-stage.css',
  'animations.css',
  'responsive.css',
];

test('css/index-visual.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present with exact version policy (#3700):
  //   - Unaffected files import EXACTLY unversioned (no ?v=)
  //   - growth-stage.css imports with EXACT version ?v=20260729-3700-1
  assert.match(content,
    /@import url\("\.\/index\/visual\/base\.css"\);/,
    'Manifest must import ./index/visual/base.css (exact, unversioned)');
  assert.match(content,
    /@import url\("\.\/index\/visual\/branch\.css"\);/,
    'Manifest must import ./index/visual/branch.css (exact, unversioned)');
  assert.match(content,
    /@import url\("\.\/index\/visual\/decorations\.css"\);/,
    'Manifest must import ./index/visual/decorations.css (exact, unversioned)');
  assert.match(content,
    /@import url\("\.\/index\/visual\/growth-stage\.css\?v=20260729-3700-1"\);/,
    'Manifest must import ./index/visual/growth-stage.css?v=20260729-3700-1');
  assert.match(content,
    /@import url\("\.\/index\/visual\/animations\.css"\);/,
    'Manifest must import ./index/visual/animations.css (exact, unversioned)');
  assert.match(content,
    /@import url\("\.\/index\/visual\/responsive\.css"\);/,
    'Manifest must import ./index/visual/responsive.css (exact, unversioned)');
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'index', 'visual', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('index.html references the original index-visual.css file and version query parameter', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Check exact link reference tag for this issue's version
  assert.match(
    html,
    /href="css\/index-visual\.css\?v=20260729-3700-1"/,
    'index.html must load css/index-visual.css?v=20260729-3700-1'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '.home-v3-collage', file: 'base.css' },
    { class: '.home-v3-halo', file: 'base.css' },
    { class: '.home-v3-branch', file: 'branch.css' },
    { class: '.home-v3-word', file: 'decorations.css' },
    { class: '.home-v3-growth-stage', file: 'growth-stage.css' },
    { class: '.growth-stage-network-core', file: 'growth-stage.css' },
    { class: '.growth-stage-card', file: 'growth-stage.css' },
    { class: '.growth-stage-card.featured', file: 'growth-stage.css' },
    { class: '.growth-stage-card.supporting', file: 'growth-stage.css' },
    { class: '.growth-stage-card-media', file: 'growth-stage.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'index', 'visual', mapping.file);
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
