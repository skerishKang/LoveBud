const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. pages/my-trees.html has no active inline script blocks', () => {
  const html = readRepoFile('pages/my-trees.html');
  const scriptTags = Array.from(html.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gis));
  
  for (const [fullMatch, attrs, content] of scriptTags) {
    if (!attrs.includes('src=')) {
      // Ensure no active inline javascript body
      const trimmed = content.trim();
      assert.ok(trimmed === '', `Found active inline script in pages/my-trees.html: "${trimmed}"`);
    }
  }
});

test('2. my-trees-scroll-bootstrap.js and my-trees-page-bootstrap.js are loaded in pages/my-trees.html', () => {
  const html = readRepoFile('pages/my-trees.html');
  
  assert.ok(
    html.includes('js/my-trees/my-trees-scroll-bootstrap.js'),
    'pages/my-trees.html must load my-trees-scroll-bootstrap.js'
  );
  assert.ok(
    html.includes('js/my-trees/my-trees-page-bootstrap.js'),
    'pages/my-trees.html must load my-trees-page-bootstrap.js'
  );
});

test('3. renderSharedHeader and LoveBudTreeViewModeSwitcher.init are invoked in my-trees-page-bootstrap.js', () => {
  const bootstrap = readRepoFile('js/my-trees/my-trees-page-bootstrap.js');
  
  assert.ok(
    bootstrap.includes('window.renderSharedHeader()'),
    'my-trees-page-bootstrap.js must call window.renderSharedHeader()'
  );
  assert.ok(
    bootstrap.includes('window.LoveBudTreeViewModeSwitcher.init('),
    'my-trees-page-bootstrap.js must call window.LoveBudTreeViewModeSwitcher.init('
  );
});

test('4. LoveBudTreeViewModeSwitcher.init specifies correct mount, target, storageKey, and defaultMode', () => {
  const bootstrap = readRepoFile('js/my-trees/my-trees-page-bootstrap.js');
  
  assert.match(
    bootstrap,
    /mount:\s*['"]#myTreesViewModeMount['"]/,
    'LoveBudTreeViewModeSwitcher.init must use mount: "#myTreesViewModeMount"'
  );
  assert.match(
    bootstrap,
    /target:\s*['"]#trees-grid['"]/,
    'LoveBudTreeViewModeSwitcher.init must use target: "#trees-grid"'
  );
  assert.match(
    bootstrap,
    /storageKey:\s*['"]lovebud:myTrees:viewMode['"]/,
    'LoveBudTreeViewModeSwitcher.init must use correct storageKey'
  );
  assert.match(
    bootstrap,
    /defaultMode:\s*['"]compact['"]/,
    'LoveBudTreeViewModeSwitcher.init must use correct defaultMode'
  );
});

test('5. extracted bootstraps do not touch auth, API, DB, or CSP header behavior', () => {
  const html = readRepoFile('pages/my-trees.html');
  const scrollBootstrap = readRepoFile('js/my-trees/my-trees-scroll-bootstrap.js');
  const pageBootstrap = readRepoFile('js/my-trees/my-trees-page-bootstrap.js');
  const bootstrapSource = `${scrollBootstrap}\n${pageBootstrap}`;

  assert.doesNotMatch(bootstrapSource, /\bfetch\s*\(/, 'My Trees bootstraps must not introduce network fetch.');
  assert.doesNotMatch(bootstrapSource, /\bXMLHttpRequest\b|navigator\.sendBeacon/, 'My Trees bootstraps must not introduce alternate network calls.');
  assert.doesNotMatch(bootstrapSource, /\bfirebase\b|signIn|signOut|auth\s*\(/i, 'My Trees bootstraps must not change auth behavior.');
  assert.doesNotMatch(bootstrapSource, /\bindexedDB\b|\bopenDatabase\b/, 'My Trees bootstraps must not introduce DB behavior.');
  assert.doesNotMatch(bootstrapSource, /Content-Security-Policy|script-src|connect-src|style-src/i, 'My Trees bootstraps must not change CSP policy.');
  assert.doesNotMatch(html, /http-equiv=["']Content-Security-Policy["']/i, 'My Trees page must not add CSP header configuration.');
});
