'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('My Trees hub preserves its runtime ids and owner actions', () => {
  const html = read('pages/my-trees.html');
  const requiredIds = [
    'myTreesHubPanel',
    'myTreesHubContent',
    'myTreesHubRep',
    'myTreesHubFlow',
    'myTreesHubSummary',
    'myTreesHubOpenBtn',
    'myTreesHubEditBtn',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `My Trees hub must retain #${id}`);
  }

  assert.match(html, /id=["']myTreesHubOpenBtn["'][^>]*>\s*[\s\S]*?감상하기/, 'primary owner action must remain 감상하기');
  assert.match(html, /id=["']myTreesHubEditBtn["'][^>]*>\s*[\s\S]*?편집하기/, 'secondary owner action must remain 편집하기');
});

test('My Trees continuation flow uses Browse-like two-column desktop rhythm', () => {
  const flow = read('css/my-trees/my-trees-preview-hub/flow.css');

  assert.match(
    flow,
    /\.my-trees-hub-flow-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*\}/,
    'desktop continuation flow must use a compact two-column grid'
  );
  assert.match(flow, /\.my-trees-hub-flow-stage\s*\{[^}]*min-height:\s*42px\s*!important;[^}]*border-radius:\s*12px\s*!important;/, 'flow stages must retain Browse-like compact card density');
});

test('My Trees continuation flow stays one-column at narrow breakpoints', () => {
  const responsive = read('css/my-trees/my-trees-preview-hub/responsive.css');

  assert.match(
    responsive,
    /@media\s*\(max-width:\s*1024px\)\s*\{[\s\S]*?\.my-trees-hub-flow-list\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/,
    '≤1024px continuation flow must collapse to one column'
  );
});

test('My Trees hub keeps its non-media focus surface and shared visual rhythm', () => {
  const content = read('css/my-trees/my-trees-preview-hub/content.css');
  const actions = read('css/my-trees/my-trees-preview-hub/actions.css');
  const cssFiles = [
    'css/my-trees/my-trees-preview-hub/layout.css',
    'css/my-trees/my-trees-preview-hub/content.css',
    'css/my-trees/my-trees-preview-hub/flow.css',
    'css/my-trees/my-trees-preview-hub/states.css',
    'css/my-trees/my-trees-preview-hub/actions.css',
    'css/my-trees/my-trees-preview-hub/responsive.css',
  ];

  assert.match(content, /\.my-trees-hub-rep\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*8px;\s*margin-top:\s*16px;\s*padding:\s*0;\s*border-radius:\s*0;\s*background:\s*transparent;\s*border:\s*none;\s*box-shadow:\s*none;\s*\}/s, 'first-moment block card decorations must be removed for a unified focus surface');
  assert.match(actions, /\.my-trees-hub-open-btn\s*\{[^}]*min-height:\s*54px;[^}]*border-radius:\s*999px;/s, '감상하기 must retain the primary Browse action rhythm');
  assert.match(actions, /\.my-trees-hub-edit-btn\s*\{[^}]*min-height:\s*48px;[^}]*border-radius:\s*999px;/s, '편집하기 must retain the secondary Browse action rhythm');

  for (const file of cssFiles) {
    assert.ok(!read(file).includes('aspect-ratio'), `${file} must not introduce an artificial media frame`);
  }
});
