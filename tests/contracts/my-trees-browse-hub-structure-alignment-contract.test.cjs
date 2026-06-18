const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('My Trees Browse Hub Structure Alignment Invariant Tests', async (t) => {
  await t.test('my-trees.html wraps left column in .my-trees-main-section and uses .my-trees-with-hub', () => {
    const html = read('pages/my-trees.html');
    assert.ok(html.includes('class="my-trees-with-hub"'), 'Must contain my-trees-with-hub container');
    assert.ok(html.includes('class="my-trees-main-section"'), 'Must contain my-trees-main-section for the left column');
    assert.ok(!html.includes('class="my-trees-dashboard-grid-shell"'), 'Old dashboard grid shell must be removed');
  });

  await t.test('Layout alignment CSS mirrors Browse rhythm', () => {
    const layoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.match(layoutCss, /\.my-trees-with-hub\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\);[^}]*gap:\s*28px;[^}]*align-items:\s*start;[^}]*}/s);
    assert.match(layoutCss, /\.my-trees-hub-panel\s*{[^}]*position:\s*sticky;[^}]*top:\s*133px;[^}]*}/s);
  });

  await t.test('Responsive styles collapse column correctly but preserve mobile overrides', () => {
    const responsiveCss = read('css/my-trees/my-trees-preview-hub/responsive.css');
    assert.match(responsiveCss, /@media\s*\(max-width:\s*1024px\)\s*{[\s\S]*?\.my-trees-with-hub\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+340px;[^}]*gap:\s*24px;[^}]*}/);
    assert.match(responsiveCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-with-hub\s*{[^}]*grid-template-columns:\s*1fr;[^}]*}/);
    assert.match(responsiveCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.my-trees-hub-panel\s*{[^}]*position:\s*static;[^}]*top:\s*auto;[^}]*margin-top:\s*20px;[^}]*}/);
  });

  await t.test('No 3D/orbit code is present in changed styling', () => {
    const layoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.ok(!layoutCss.includes('orbit-viewer'), 'No orbit viewer selectors should be added');
    assert.ok(!layoutCss.includes('threejs'), 'No Three.js style keywords should be added');
  });
});
