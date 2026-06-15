const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const cardsCss = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-cards.css'), 'utf8');
const responsiveCss = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-responsive.css'), 'utf8');
const statesCss = fs.readFileSync(path.join(ROOT, 'css/my-trees/my-trees-states.css'), 'utf8');

test('My LoveTree desktop grid uses compact 3-column density by default', () => {
  assert.match(cardsCss, /\.trees-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(cardsCss, /\.tree-card-thumb\s*\{[^}]*height:\s*168px/s);
  assert.match(cardsCss, /\.tree-card-info\s*\{[^}]*min-height:\s*104px/s);
});

test('My LoveTree skeleton grid matches compact desktop density', () => {
  assert.match(statesCss, /\.trees-skeleton-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(statesCss, /\.tree-skeleton-thumb\s*\{[^}]*height:\s*168px/s);
});

test('My LoveTree keeps responsive density safe on tablet and mobile', () => {
  assert.match(responsiveCss, /@media\s*\(max-width:\s*1024px\)\s*\{[\s\S]*\.trees-grid\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(responsiveCss, /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\.trees-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
});
