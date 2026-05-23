const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const HERO_MANIFEST_PATH = path.join(ROOT, 'css', 'intro', 'intro-hero.css');
const INTRO_CSS_PATH = path.join(ROOT, 'css', 'intro.css');
const HTML_PATH = path.join(ROOT, 'pages', 'intro.html');

const SPLIT_FILES = [
  'base.css',
  'layout.css',
  'tree-visual.css',
  'moments.css',
  'animations.css',
  'responsive.css',
];

test('css/intro/intro-hero.css is an import manifest (<= 20 lines)', () => {
  const content = fs.readFileSync(HERO_MANIFEST_PATH, 'utf8');
  const lines = content.split('\n');

  // Verify line count <= 20
  assert.ok(lines.length <= 20, `Manifest must be <= 20 lines, currently: ${lines.length}`);

  // Verify all @import lines are present
  SPLIT_FILES.forEach(file => {
    const importRegex = new RegExp(`@import\\s+url\\(['"]\\.\\/hero\\/${file}['"]\\);`);
    assert.match(content, importRegex, `Manifest must import ./hero/${file}`);
  });
});

test('all split CSS files exist in the file system', () => {
  SPLIT_FILES.forEach(file => {
    const filePath = path.join(ROOT, 'css', 'intro', 'hero', file);
    assert.ok(fs.existsSync(filePath), `Split file must exist: ${filePath}`);
  });
});

test('pages/intro.html and css/intro.css preserve their expected links/imports', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const introCss = fs.readFileSync(INTRO_CSS_PATH, 'utf8');

  // Verify intro.html links intro.css
  assert.match(
    html,
    /href="\.\.\/css\/intro\.css\?v=20260426-1"/,
    'pages/intro.html must continue to link ../css/intro.css?v=20260426-1'
  );

  // Verify intro.css imports intro-hero.css
  assert.match(
    introCss,
    /@import\s+url\((['"])\.\/intro\/intro-hero\.css\1\);/,
    'css/intro.css must continue to import ./intro/intro-hero.css'
  );
});

test('representative classes exist in their respective split files', () => {
  const classMappings = [
    { class: '.intro-hero', file: 'base.css' },
    { class: '.intro-hero h1', file: 'layout.css' },
    { class: '.intro-hero-visual', file: 'tree-visual.css' },
    { class: '.intro-tree-scene', file: 'tree-visual.css' },
    { class: '.intro-tree-stem', file: 'moments.css' },
    { class: '.intro-tree-branch', file: 'moments.css' },
    { class: '.intro-tree-node', file: 'moments.css' },
    { class: '.intro-tree-moment', file: 'moments.css' },
  ];

  classMappings.forEach(mapping => {
    const filePath = path.join(ROOT, 'css', 'intro', 'hero', mapping.file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Escape special characters in class name for regex matching
    const escapedClass = mapping.class.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`${escapedClass}\\b`);

    assert.match(
      content,
      regex,
      `Class/selector ${mapping.class} must be defined in ${mapping.file}`
    );
  });
});
