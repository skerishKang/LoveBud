const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('Optional 3D Orbit Prototype Plan Invariant Checks', async (t) => {
  const docPath = 'docs/product/lovebud-optional-3d-orbit-prototype-plan.md';

  await t.test('Plan file exists and is populated', () => {
    assert.ok(fs.existsSync(path.join(ROOT, docPath)), 'Document does not exist');
    const content = read(docPath);
    assert.ok(content.length > 500, 'Document content is too short');
  });

  await t.test('Plan contains Refs #2692 and no auto-closing keywords', () => {
    const content = read(docPath);
    assert.match(content, /Refs #2692/, 'Document must reference issue #2692');

    const forbidden = [
      /Closes #2692/i, /Fixes #2692/i, /Resolves #2692/i,
      /Closes #1882/i, /Fixes #1882/i, /Resolves #1882/i
    ];
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(content), `Document must not contain auto-closing phrase: ${pattern}`);
    }
  });

  await t.test('Plan outlines opt-in, default mode, reduced-motion, and mobile fallback', () => {
    const content = read(docPath);
    assert.match(content, /opt-in/i, 'Must specify opt-in requirement');
    assert.match(content, /default/i, 'Must specify default general mode layout');
    assert.match(content, /reduced[\s-]motion/i, 'Must define reduced motion fallback');
    assert.match(content, /mobile fallback/i, 'Must outline mobile performance fallback');
  });

  await t.test('Plan identifies Home hero and Browse/My Trees read-only viewer target surfaces', () => {
    const content = read(docPath);
    assert.match(content, /Home Hero Banner/i, 'Must reference index.html hero banner');
    assert.match(content, /Browse Read-Only Tree Viewer/i, 'Must reference Browse tree viewer surface');
    assert.match(content, /My Trees Read-Only Tree Viewer/i, 'Must reference My Trees tree viewer surface');
  });

  await t.test('Plan documents editor, Scout, Cloudflare, and Production activation exclusions', () => {
    const content = read(docPath);
    assert.match(content, /Editor & Workbench/i, 'Must exclude Editor changes');
    assert.match(content, /Scout AI Integrations/i, 'Must exclude Scout integration changes');
    assert.match(content, /Cloudflare env/i, 'Must exclude Cloudflare changes');
    assert.match(content, /production activation.*BLOCKED/i, 'Must state production activation is blocked');
  });

  await t.test('Verify no 3D implementation libraries or controllers are committed in code', () => {
    // Assert no implementation patterns exist in files outside documentation
    const filePaths = [
      'js/search.js',
      'js/my-trees.js',
      'js/viewer/tree-viewer.js'
    ];
    for (const filePath of filePaths) {
      if (fs.existsSync(path.join(ROOT, filePath))) {
        const fileContent = read(filePath);
        assert.ok(!fileContent.includes('THREE.WebGLRenderer'), 'WebGLRenderer must not be implemented');
        assert.ok(!fileContent.includes('OrbitControls'), 'OrbitControls must not be implemented');
        assert.ok(!fileContent.includes('orbit-viewer-canvas'), 'orbit-viewer-canvas must not be implemented');
      }
    }
  });
});
