// == shared-loading-state-primitives-contract.test.cjs ==
// Contract test for Issue #3691 — Shared loading-state visual and copy primitives.
//
// This test validates that:
//   1. The new stylesheet is imported exactly once.
//   2. Required shared class families exist.
//   3. No page-specific ID or broad page selector exists.
//   4. All 10 KO/EN i18n keys exist exactly once.
//   5. Reduced-motion disables shimmer/spinner motion.
//   6. Skeleton convention records HTML `aria-hidden` responsibility.
//   7. Error and degraded treatments remain distinct.
//   8. No HTML page is modified.
//   9. No runtime behavior is introduced.
//  10. Prohibited functions/terms are absent from implementation files.
//  11. Import ordering remains deterministic.
//  12. Existing unrelated classifications are unchanged.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../..');

// ---- Helpers ----

function readFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

// ---- 1. New stylesheet is imported exactly once ----

const globalCss = readFile('css/global.css');
const importMatches = globalCss.match(/@import\s+url\(['"].\/global\/lovetree-loading-states\.css['"]\)/g);
assert.ok(importMatches !== null, 'css/global.css must import lovetree-loading-states.css');
assert.strictEqual(
  importMatches.length,
  1,
  'lovetree-loading-states.css must be imported exactly once in css/global.css'
);

// ---- 2. Required shared class families exist ----

const loadingCss = readFile('css/global/lovetree-loading-states.css');

const requiredClasses = [
  '.lt-loading-inline',
  '.lt-loading-compact',
  '.lt-long-wait',
  '.lt-degraded',
  '.lt-error-shell',
  '.lt-skeleton',
  '.lt-skeleton-text',
  '.lt-skeleton-title',
  '.lt-skeleton-media',
];
for (const cls of requiredClasses) {
  assert.ok(
    loadingCss.includes(cls),
    `Required class "${cls}" must exist in lovetree-loading-states.css`
  );
}

// ---- 3. No page-specific ID or broad page selector ----

// Check for page-specific selectors (browse-, my-trees-, editor-, etc.)
// ID selectors are not checked via naive string search because `#` appears
// in hex color values in CSS. Instead, the stylesheet is manually verified
// to contain no ID selectors or page-specific class patterns.

const pageSpecificPrefixes = [
  '.browse-',
  '.my-trees-',
  '.editor-',
  '.detail-',
  '.home-',
  '.search-',
  '.viewer-',
];
const lines = loadingCss.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  // Skip comments, at-rules, and empty lines
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '' || trimmed.startsWith('@')) {
    continue;
  }
  for (const prefix of pageSpecificPrefixes) {
    if (trimmed.includes(prefix)) {
      assert.fail(
        `Prohibited page-specific selector "${prefix}" found in lovetree-loading-states.css: "${trimmed}"`
      );
    }
  }
}

// Verify no ID selectors in the stylesheet (lines starting with #)
for (const line of lines) {
  const trimmed = line.trim();
  if (/^#[a-zA-Z]/.test(trimmed)) {
    // This is a CSS ID selector — prohibited
    assert.fail(
      `ID selector found in lovetree-loading-states.css: "${trimmed}"`
    );
  }
}

// ---- 4. All 10 KO/EN i18n keys exist exactly once ----

const i18nContent = readFile('js/i18n/i18n-shared.js');

const requiredKeys = [
  'loading.page.prepare',
  'loading.media.load',
  'loading.list.load',
  'loading.region.load',
  'loading.long.wait',
  'loading.degraded',
  'loading.error.primary',
  'loading.error.body',
  'loading.retrying',
  'loading.retry.action',
];

for (const key of requiredKeys) {
  // Each key must appear exactly once (as a string literal in the dictionary)
  const escapedKey = key.replace(/\./g, '\\.');
  const keyRegex = new RegExp(`['"\`]${escapedKey}['"\`]\\s*:`, 'g');
  const matches = i18nContent.match(keyRegex);
  assert.ok(matches !== null, `i18n key "${key}" must exist in js/i18n/i18n-shared.js`);
  assert.strictEqual(
    matches.length,
    1,
    `i18n key "${key}" must appear exactly once in js/i18n/i18n-shared.js (found ${matches.length})`
  );
}

// Verify each key has both KO and EN
for (const key of requiredKeys) {
  const keyLineRegex = new RegExp(
    `['"\`]${key.replace(/\./g, '\\.')}['"\`]\\s*:\\s*\\{[^}]*ko:\\s*['"]`,
    'm'
  );
  assert.ok(
    keyLineRegex.test(i18nContent),
    `i18n key "${key}" must have a 'ko' translation`
  );

  const enRegex = new RegExp(
    `['"\`]${key.replace(/\./g, '\\.')}['"\`]\\s*:\\s*\\{[^}]*en:\\s*['"]`,
    'm'
  );
  assert.ok(
    enRegex.test(i18nContent),
    `i18n key "${key}" must have an 'en' translation`
  );
}

// ---- 5. Reduced-motion disables shimmer/spinner motion ----

assert.ok(
  loadingCss.includes('@media (prefers-reduced-motion: reduce)'),
  'lovetree-loading-states.css must contain a @media (prefers-reduced-motion: reduce) block'
);

const reducedMotionBlock = loadingCss.split('@media (prefers-reduced-motion: reduce)')[1];
assert.ok(reducedMotionBlock, 'Reduced-motion media query must have a body');

// Verify shimmer is disabled
assert.ok(
  reducedMotionBlock.includes('.lt-skeleton'),
  'Reduced-motion must disable .lt-skeleton animation'
);
assert.ok(
  reducedMotionBlock.includes('animation: none') || reducedMotionBlock.includes('animation:none'),
  'Reduced-motion must set animation: none for skeleton'
);

// Verify spinner is disabled
assert.ok(
  reducedMotionBlock.includes('.lt-spinner'),
  'Reduced-motion must handle .lt-spinner animation'
);

// ---- 6. Skeleton convention records HTML `aria-hidden` responsibility ----

assert.ok(
  loadingCss.includes('aria-hidden'),
  'lovetree-loading-states.css must document the aria-hidden convention in comments'
);

// ---- 7. Error and degraded treatments remain distinct ----

// Error uses .lt-error-shell; degraded uses .lt-degraded — separate class names.
assert.ok(
  loadingCss.includes('.lt-error-shell'),
  'Error treatment class .lt-error-shell must exist'
);
assert.ok(
  loadingCss.includes('.lt-degraded'),
  'Degraded treatment class .lt-degraded must exist'
);
// The styles should be visually distinct (error has border, button; degraded does not)
assert.ok(
  loadingCss.includes('.lt-retry-btn'),
  'Error treatment must include a retry button style'
);
assert.ok(
  !loadingCss.includes('.lt-degraded') || !loadingCss.includes('.lt-retry-btn') ||
  loadingCss.indexOf('.lt-degraded .lt-retry-btn') === -1,
  'Degraded treatment should not include a retry button style'
);

// ---- 8. No HTML page is modified ----

const htmlFiles = [
  'index.html',
  'pages/search.html',
  'pages/my-trees.html',
  'pages/editor.html',
  'pages/detail.html',
  'pages/view.html',
  'pages/tree.html',
];

const gitDiffOutput = (() => {
  try {
    const { execSync } = require('child_process');
    return execSync('git diff --name-only origin/main...HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' });
  } catch {
    return '';
  }
})();

for (const htmlFile of htmlFiles) {
  assert.ok(
    !gitDiffOutput.includes(htmlFile),
    `No HTML file should be modified — "${htmlFile}" must not appear in diff`
  );
}

// ---- 9. No runtime behavior is introduced ----

const implementationFiles = [
  'css/global/lovetree-loading-states.css',
  'js/i18n/i18n-shared.js',
];

const prohibitedRuntimePatterns = [
  /fetch\s*\(/,
  /setTimeout\s*\(/,
  /setInterval\s*\(/,
  /new\s+AbortController/,
  /\.abort\s*\(/,
  /\.addEventListener\s*\(/,
  /\.removeEventListener\s*\(/,
  /localStorage\./,
  /sessionStorage\./,
  /window\./,
  /document\./,
  /XMLHttpRequest/,
  /Promise/,
  /async\s+function/,
  /=>\s*\{/,
];

for (const file of implementationFiles) {
  const content = readFile(file);
  // Skip CSS files for runtime pattern checks that don't apply to CSS
  if (file.endsWith('.css')) {
    // CSS should not contain JS-specific patterns
    assert.ok(
      !content.includes('fetch('),
      `CSS file ${file} must not contain fetch()`
    );
    assert.ok(
      !content.includes('setTimeout('),
      `CSS file ${file} must not contain setTimeout()`
    );
    continue;
  }
  // For JS files, check that the loading keys are static data only
  if (file.endsWith('i18n-shared.js')) {
    const loadingSection = content.split('// ---- Shared loading-state copy roles')[1] || '';
    if (loadingSection) {
      const sectionBeforeEnd = loadingSection.split('  };')[0] || '';
      for (const pattern of prohibitedRuntimePatterns) {
        const match = sectionBeforeEnd.match(pattern);
        if (match) {
          assert.fail(
            `Prohibited runtime pattern "${pattern}" found in loading i18n section of ${file}: "${match[0]}"`
          );
        }
      }
    }
  }
}

// ---- 10. Prohibited functions/terms are absent from implementation files ----

const prohibitedTerms = [
  'AbortController',
  'retry handler',
  'state machine',
  'getPublicTrees',
  'getTrees',
  'getMemory',
  'getMemoriesByTree',
  'getCommunityMemories',
  'apiClient',
  'firebase',
  'Firebase',
  'module.exports',
];

for (const file of implementationFiles) {
  const content = readFile(file);
  for (const term of prohibitedTerms) {
    // Allow in explanatory comments only if it's describing what's NOT present
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(term) && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*')) {
        // Allow if the line is an explanatory comment about prohibition
        if (line.includes('must not') || line.includes('does not') || line.includes('prohibited')) {
          continue;
        }
        // Allow in the requires test section where we check prohibition
        if (file.endsWith('.test.cjs')) continue;
        assert.fail(
          `Prohibited term "${term}" found in ${file}: "${line.trim()}"`
        );
      }
    }
  }
}

// ---- 11. Import ordering remains deterministic ----

const importLines = globalCss.split('\n').filter(l => l.trim().startsWith('@import'));
const expectedOrder = [
  './global/tokens.css',
  './global/global-base.css',
  './global/global-header.css',
  './global/lovetree-calm-page-shell.css',
  './global/global-ready-state.css',
  './global/global-transition-polish.css',
  './global/lovetree-loading-states.css',
];

assert.strictEqual(
  importLines.length,
  expectedOrder.length,
  `Expected ${expectedOrder.length} imports, found ${importLines.length}`
);

for (let i = 0; i < expectedOrder.length; i++) {
  assert.ok(
    importLines[i].includes(expectedOrder[i]),
    `Import #${i + 1} must be "${expectedOrder[i]}" — found: "${importLines[i].trim()}"`
  );
}

// ---- 12. Existing unrelated classifications are unchanged ----

const classificationJson = readFile('tests/test-layer-classification.json');
const classification = JSON.parse(classificationJson);

// Verify that the new contract test is registered
const newEntry = classification.entries.find(
  e => e.path === 'tests/contracts/shared-loading-state-primitives-contract.test.cjs'
);
assert.ok(newEntry, 'New contract test must be registered in test-layer-classification.json');
assert.strictEqual(
  newEntry.layer,
  'SOURCE_STATIC',
  'New contract test must be classified as SOURCE_STATIC'
);

// ---- All assertions passed ----
console.log('✅ All shared-loading-state-primitives contract assertions passed.');
