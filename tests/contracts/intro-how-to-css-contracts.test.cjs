const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'css/intro/intro-how-to.css');
const PARENT_MANIFEST_PATH = path.join(ROOT, 'css/intro.css');

test('intro-how-to css — manifest is under 20 lines', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 20, `Manifest should be <= 20 lines, but is ${lines} lines`);
});

test('intro-how-to css — manifest contains expected imports', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const expectedImports = [
        './intro-how-to/layout.css',
        './intro-how-to/what-is.css',
        './intro-how-to/cards.css',
        './intro-how-to/visual.css',
        './intro-how-to/animations.css',
        './intro-how-to/responsive.css'
    ];

    for (const file of expectedImports) {
        assert.match(content, new RegExp(`@import url\\(['"]${file}['"]\\);`), `Manifest must import ${file}`);
    }
});

test('intro-how-to css — split files exist and contain core selectors', () => {
    const files = {
        'layout.css': ['.intro-section', '.intro-grid-layout'],
        'what-is.css': ['.intro-what-eyebrow', '.intro-what-list'],
        'cards.css': ['.how-to-grid', '.how-to-card'],
        'visual.css': ['.how-to-visual', '.how-to-scene'],
        'animations.css': ['@keyframes howToPlayPulse', '@keyframes howToLineBreath'],
        'responsive.css': ['@media (max-width: 768px)']
    };

    for (const [filename, selectors] of Object.entries(files)) {
        const filepath = path.join(ROOT, `css/intro/intro-how-to/${filename}`);
        assert.ok(fs.existsSync(filepath), `Split file ${filename} must exist`);
        
        const content = fs.readFileSync(filepath, 'utf8');
        for (const selector of selectors) {
            assert.ok(content.includes(selector), `${filename} must contain selector ${selector}`);
        }
        assert.ok(content.endsWith('\n'), `${filename} must have an EOF newline`);
    }
});

test('intro-how-to css — parent manifest reference is preserved', () => {
    const parentContent = fs.readFileSync(PARENT_MANIFEST_PATH, 'utf8');
    assert.match(parentContent, /@import url\(['"]\.\/intro\/intro-how-to\.css['"]\);/, 'Parent manifest must still import the intro-how-to manifest');
});
