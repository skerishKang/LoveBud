const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('My Trees Browse Hub Structure Alignment Invariant Tests', async (t) => {
  await t.test('my-trees.html uses shared calm 2-column shell classes', () => {
    const html = read('pages/my-trees.html');
    // Grid ownership belongs to the shared calm page shell (lovetree-calm-two-column-shell).
    assert.ok(/\blovetree-calm-two-column-shell\b/.test(html), 'Must opt into shared .lovetree-calm-two-column-shell');
    assert.ok(/\blovetree-calm-main-column\b/.test(html), 'Must contain .lovetree-calm-main-column for the left column');
    assert.ok(/\blovetree-calm-right-rail\b/.test(html), 'Must contain .lovetree-calm-right-rail for the right column');
    assert.ok(!html.includes('my-trees-dashboard-grid-shell'), 'Old dashboard grid shell must be removed');
    assert.ok(!html.includes('my-trees-with-hub'), 'Obsolete .my-trees-with-hub wrapper must be removed');
  });

  await t.test('Shared 2-column grid rhythm is owned by global calm page-shell CSS, not by hub split file', () => {
    const calmShellCss = read('css/global/lovetree-calm-page-shell.css');
    assert.match(calmShellCss, /\.lovetree-calm-two-column-shell\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(360px,\s*400px\);[^}]*}/s, 'Shared CSS must define the 2-column grid rhythm');
    assert.match(calmShellCss, /\.lovetree-calm-right-rail\s*{[^}]*position:\s*sticky;[^}]*top:\s*133px;[^}]*}/s, 'Shared CSS must define the sticky right rail');
    // Hub split file must NOT redefine the same grid ownership.
    const layoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.ok(!/\.my-trees-with-hub\s*{[^}]*display:\s*grid/.test(layoutCss), 'Hub layout.css must not own the 2-column grid display');
  });

  await t.test('Responsive 2-column collapse is owned by global calm page-shell CSS', () => {
    const calmShellCss = read('css/global/lovetree-calm-page-shell.css');
    assert.match(calmShellCss, /@media\s*\(max-width:\s*1024px\)\s*{[\s\S]*?\.lovetree-calm-two-column-shell\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+340px;[^}]*}/, 'Shared CSS must collapse column at 1024px');
    assert.match(calmShellCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.lovetree-calm-two-column-shell\s*{[^}]*grid-template-columns:\s*1fr;[^}]*}/, 'Shared CSS must collapse to 1fr at 768px');
    assert.match(calmShellCss, /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.lovetree-calm-right-rail\s*{[^}]*position:\s*static;[^}]*top:\s*auto;[^}]*margin-top:\s*20px;[^}]*}/, 'Shared CSS must unstick the right rail at 768px');
  });

  await t.test('Hub split file defines owner-state empty/loaded toggles', () => {
    const layoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.match(layoutCss, /\.my-trees-hub-panel\.is-empty\s+\.my-trees-hub-content/, 'Hub layout.css must hide content when hub is empty');
    assert.match(layoutCss, /\.my-trees-hub-panel:not\(\.is-empty\)\s+\.my-trees-hub-placeholder/, 'Hub layout.css must hide placeholder when hub is loaded');
  });

  await t.test('No 3D/orbit code is present in changed styling', () => {
    const layoutCss = read('css/my-trees/my-trees-preview-hub/layout.css');
    assert.ok(!layoutCss.includes('orbit-viewer'), 'No orbit viewer selectors should be added');
    assert.ok(!layoutCss.includes('threejs'), 'No Three.js style keywords should be added');
  });
});
