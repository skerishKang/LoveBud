// == shared-loading-state-primitives-contract.test.cjs ==
// Contract test for Issue #3691 — Shared loading-state visual and copy primitives.
//
// This test validates that shared primitives exist as presentation-only assets
// and have NOT been adopted by any canonical page in this child.
//
// Classification: SOURCE_STATIC (reads source files and asserts on structure,
// class names, selectors, i18n keys, and ARIA conventions; does not execute
// the asserted target runtime behavior).

const assert = require('node:assert');
const { describe, it } = require('node:test');
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

/**
 * Extract the content inside a @media (prefers-reduced-motion: reduce) block
 * using balanced-brace matching.
 */
function extractReducedMotionBlock(css) {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const startIdx = css.indexOf(marker);
  if (startIdx === -1) return null;

  const openIdx = css.indexOf('{', startIdx);
  if (openIdx === -1) return null;

  let depth = 1;
  let i = openIdx + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.substring(openIdx + 1, i - 1);
}

/**
 * Extract the full content of a CSS rule block given a selector string.
 * Returns the text between the first { after selector and its matching }.
 */
function extractRuleBlock(css, selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) return null;

  const openIdx = css.indexOf('{', idx);
  if (openIdx === -1) return null;

  let depth = 1;
  let i = openIdx + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return { block: css.substring(openIdx + 1, i - 1), start: openIdx, end: i };
}

// ---- Shared files ----

const loadingCss = readFile('css/global/lovetree-loading-states.css');
const globalCss = readFile('css/global.css');
const i18nContent = readFile('js/i18n/i18n-shared.js');
const classificationJson = readFile('tests/test-layer-classification.json');
const classification = JSON.parse(classificationJson);

// ---- 1. Exact global import ----

describe('1. exact global import', () => {
  it('must import lovetree-loading-states.css exactly once', () => {
    const matches = globalCss.match(
      /@import\s+url\(['"]\.\/global\/lovetree-loading-states\.css['"]\)/g
    );
    assert.ok(matches !== null, 'Import statement must exist');
    assert.strictEqual(matches.length, 1);
  });
});

// ---- 2. Required shared classes ----

describe('2. required shared classes', () => {
  const required = [
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

  for (const cls of required) {
    it(`class "${cls}" must exist`, () => {
      assert.ok(loadingCss.includes(cls));
    });
  }
});

// ---- 3. No page-specific or broad selectors ----

describe('3. no page-specific or broad selectors', () => {
  const lines = loadingCss.split('\n');

  const prohibitedPrefixes = [
    '.browse-',
    '.my-trees-',
    '.editor-',
    '.detail-',
    '.home-',
    '.search-',
    '.viewer-',
  ];

  for (const prefix of prohibitedPrefixes) {
    it(`must not contain "${prefix}" selector`, () => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') continue;
        if (trimmed.includes(prefix)) {
          assert.fail(`Found prohibited page-specific selector "${prefix}" in: "${trimmed}"`);
        }
      }
    });
  }

  it('must not contain ID selectors (lines starting with # followed by letter)', () => {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '' ||
          trimmed.startsWith('@') || trimmed.includes(':')) continue;
      if (/^#[a-zA-Z]/.test(trimmed)) {
        assert.fail(`ID selector found: "${trimmed}"`);
      }
    }
  });

  const broadSelectors = ['html', 'body', ':root', '*'];
  for (const sel of broadSelectors) {
    it(`must not contain broad selector "${sel}"`, () => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '' ||
            trimmed.startsWith('@') || trimmed.startsWith('}')) continue;
        // Check only selector prelude lines (lines that start with a selector)
        if (/^[.#a-zA-Z]/.test(trimmed)) {
          const selector = trimmed.split(/\s*\{/)[0] || trimmed;
          if (selector === sel || selector.startsWith(sel + ',') || selector.startsWith(sel + ' ')) {
            assert.fail(`Broad selector "${sel}" found in: "${trimmed}"`);
          }
        }
      }
    });
  }
});

// ---- 4. Exact KO/EN i18n keys ----

describe('4. exact KO/EN i18n keys', () => {
  const keys = [
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

  for (const key of keys) {
    it(`key "${key}" must exist with ko and en`, () => {
      const escaped = key.replace(/\./g, '\\.');
      // Key definition line
      const keyRegex = new RegExp(`['"\`]${escaped}['"\`]\\s*:`);
      assert.ok(keyRegex.test(i18nContent), `Key "${key}" not found`);
      // KO translation
      const koRegex = new RegExp(
        `['"\`]${escaped}['"\`]\\s*:\\s*\\{[^}]*ko:\\s*['"]`
      );
      assert.ok(koRegex.test(i18nContent), `Key "${key}" missing ko translation`);
      // EN translation
      const enRegex = new RegExp(
        `['"\`]${escaped}['"\`]\\s*:\\s*\\{[^}]*en:\\s*['"]`
      );
      assert.ok(enRegex.test(i18nContent), `Key "${key}" missing en translation`);
    });
  }
});

// ---- 5. Skeleton reduced motion ----

describe('5. skeleton reduced motion', () => {
  const reducedBlock = extractReducedMotionBlock(loadingCss);

  it('@media (prefers-reduced-motion: reduce) block must exist', () => {
    assert.ok(reducedBlock !== null, 'Reduced-motion media query block not found');
  });

  it('.lt-skeleton must have animation: none inside reduced-motion block', () => {
    const skeletonBlock = extractRuleBlock(reducedBlock, '.lt-skeleton');
    assert.ok(skeletonBlock !== null, '.lt-skeleton block not found in reduced-motion');
    assert.ok(
      skeletonBlock.block.includes('animation: none') ||
      skeletonBlock.block.includes('animation:none'),
      '.lt-skeleton must have animation: none in reduced-motion'
    );
    // Static visible fallback
    assert.ok(
      skeletonBlock.block.includes('background'),
      '.lt-skeleton must have a static background fallback'
    );
  });
});

// ---- 6. Spinner reduced motion ----

describe('6. spinner reduced motion', () => {
  const reducedBlock = extractReducedMotionBlock(loadingCss);

  it('@media (prefers-reduced-motion: reduce) block must exist', () => {
    assert.ok(reducedBlock !== null);
  });

  it('.lt-loading-inline .lt-spinner must have animation: none inside reduced-motion block', () => {
    const spinnerBlock = extractRuleBlock(reducedBlock, '.lt-loading-inline .lt-spinner');
    assert.ok(spinnerBlock !== null, '.lt-loading-inline .lt-spinner block not found in reduced-motion');
    assert.ok(
      spinnerBlock.block.includes('animation: none') ||
      spinnerBlock.block.includes('animation:none'),
      'Spinner must have animation: none in reduced-motion'
    );
    // Static visible fallback (border/opacity)
    assert.ok(
      spinnerBlock.block.includes('opacity') || spinnerBlock.block.includes('border'),
      'Spinner must have static border/opacity fallback'
    );
  });

  it('.lt-loading-compact .lt-spinner must also have animation: none', () => {
    const compactSpinnerBlock = extractRuleBlock(reducedBlock, '.lt-loading-compact .lt-spinner');
    assert.ok(compactSpinnerBlock !== null, 'Compact spinner block not found in reduced-motion');
    assert.ok(
      compactSpinnerBlock.block.includes('animation: none') ||
      compactSpinnerBlock.block.includes('animation:none')
    );
  });
});

// ---- 7. Skeleton ARIA responsibility ----

describe('7. skeleton ARIA responsibility', () => {
  it('CSS must document aria-hidden convention in comments', () => {
    assert.ok(
      loadingCss.includes('aria-hidden'),
      'CSS must document that skeleton elements need aria-hidden="true" in HTML'
    );
  });

  it('CSS must not set aria-hidden (aria is HTML only)', () => {
    // CSS cannot set ARIA attributes per spec — verify we don't try
    assert.ok(
      !loadingCss.includes('[aria-hidden]'),
      'CSS must not set ARIA attributes via CSS'
    );
  });
});

// ---- 8. Error / degraded distinction ----

describe('8. error / degraded distinction', () => {
  it('.lt-error-shell must exist as a distinct class', () => {
    assert.ok(loadingCss.includes('.lt-error-shell'));
  });

  it('.lt-degraded must exist as a distinct class', () => {
    assert.ok(loadingCss.includes('.lt-degraded'));
  });

  it('.lt-error-shell must have a distinguishing property (border or primary color)', () => {
    const shellBlock = extractRuleBlock(loadingCss, '.lt-error-shell');
    assert.ok(shellBlock !== null, '.lt-error-shell block not found');
    const hasBorder = shellBlock.block.includes('border');
    const hasPrimary = shellBlock.block.includes('var(--primary');
    assert.ok(hasBorder || hasPrimary, '.lt-error-shell must have border or primary color');
  });

  it('.lt-error-shell must contain .lt-retry-btn style', () => {
    assert.ok(
      loadingCss.includes('.lt-retry-btn'),
      'Error treatment must include a retry button style'
    );
  });

  it('.lt-degraded must be a separate block from error', () => {
    const degradedBlock = extractRuleBlock(loadingCss, '.lt-degraded');
    assert.ok(degradedBlock !== null, '.lt-degraded block not found');
  });

  it('.lt-degraded must not contain .lt-retry-btn selector', () => {
    // Check that .lt-degraded block does not contain a nested .lt-retry-btn
    const degradedBlock = extractRuleBlock(loadingCss, '.lt-degraded');
    if (degradedBlock) {
      assert.ok(
        !degradedBlock.block.includes('lt-retry-btn'),
        'Degraded block must not contain retry button style'
      );
    }
  });
});

// ---- 9. Bounded HTML page adoption (Issue #3693) ----

describe('9. bounded HTML page adoption', () => {
  const adoptedPages = ['pages/search.html', 'pages/my-trees.html'];
  const prohibitedPages = [
    'index.html',
    'pages/editor.html',
    'pages/detail.html',
    'pages/view.html',
    'pages/tree.html',
  ];

  const primitiveClasses = [
    'lt-loading-inline',
    'lt-loading-compact',
    'lt-spinner',
    'lt-long-wait',
    'lt-degraded',
    'lt-error-shell',
    'lt-retry-btn',
    'lt-skeleton',
    'lt-skeleton-text',
    'lt-skeleton-title',
    'lt-skeleton-media',
  ];

  const i18nKeys = [
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

  it('pages/search.html adopts required shared primitives', () => {
    const content = readFile('pages/search.html');
    assert.ok(content.includes('lt-loading-inline'), 'search.html must adopt lt-loading-inline');
    assert.ok(content.includes('lt-spinner'), 'search.html must adopt lt-spinner');
    assert.ok(content.includes('lt-retry-btn'), 'search.html must adopt lt-retry-btn');
  });

  it('pages/my-trees.html adopts required shared primitives', () => {
    const content = readFile('pages/my-trees.html');
    assert.ok(
      content.includes('lt-loading-compact') || content.includes('lt-loading-inline'),
      'my-trees.html must adopt lt-loading-compact or lt-loading-inline'
    );
    assert.ok(content.includes('lt-spinner'), 'my-trees.html must adopt lt-spinner');
    assert.ok(content.includes('lt-error-shell'), 'my-trees.html must adopt lt-error-shell');
    assert.ok(content.includes('lt-retry-btn'), 'my-trees.html must adopt lt-retry-btn');
  });

  for (const htmlFile of prohibitedPages) {
    it(`canonical page "${htmlFile}" must not adopt any shared primitive class`, () => {
      const content = readFile(htmlFile);
      for (const cls of primitiveClasses) {
        if (content.includes(cls)) {
          assert.fail(`HTML file "${htmlFile}" contains primitive class "${cls}"`);
        }
      }
    });
  }

  const allPages = [...adoptedPages, ...prohibitedPages];
  for (const htmlFile of allPages) {
    it(`canonical page "${htmlFile}" must not use any shared loading i18n key directly in HTML`, () => {
      const content = readFile(htmlFile);
      for (const key of i18nKeys) {
        if (content.includes(key)) {
          assert.fail(`HTML file "${htmlFile}" contains shared i18n key "${key}"`);
        }
      }
    });
  }
});

// ---- 10. Zero runtime behavior ----

describe('10. zero runtime behavior', () => {
  it('CSS file must not contain fetch()', () => {
    assert.ok(!loadingCss.includes('fetch('));
  });
  it('CSS file must not contain setTimeout()', () => {
    assert.ok(!loadingCss.includes('setTimeout('));
  });
  it('CSS file must not contain setInterval()', () => {
    assert.ok(!loadingCss.includes('setInterval('));
  });

  // i18n loading section must be static data only
  const loadingSection = i18nContent.split("// ---- Shared loading-state copy roles (Issue #3691) ----")[1];
  if (loadingSection) {
    const dataSection = loadingSection.split('  };')[0] || '';
    const prohibitedInI18n = [
      'fetch(',
      'setTimeout(',
      'setInterval(',
      'AbortController',
      '.addEventListener(',
      '.removeEventListener(',
      'XMLHttpRequest',
      'module.exports',
      'require(',
    ];
    for (const term of prohibitedInI18n) {
      it(`i18n loading section must not contain "${term}"`, () => {
        if (dataSection.includes(term)) {
          assert.fail(`Prohibited term "${term}" found in loading i18n section`);
        }
      });
    }
  }
});

// ---- 11. Deterministic import order ----

describe('11. deterministic import order', () => {
  it('imports must be in expected order', () => {
    const importLines = globalCss.split('\n').filter(l => l.trim().startsWith('@import'));
    const expected = [
      './global/tokens.css',
      './global/global-base.css',
      './global/global-header.css',
      './global/lovetree-calm-page-shell.css',
      './global/global-ready-state.css',
      './global/global-transition-polish.css',
      './global/lovetree-loading-states.css',
    ];
    assert.strictEqual(importLines.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.ok(importLines[i].includes(expected[i]),
        `Import #${i + 1} must be "${expected[i]}" — found: "${importLines[i].trim()}"`
      );
    }
  });
});

// ---- 12. SOURCE_STATIC classification ----

describe('12. SOURCE_STATIC classification', () => {
  it('contract test must be registered in test-layer-classification.json', () => {
    const entry = classification.entries.find(
      e => e.path === 'tests/contracts/shared-loading-state-primitives-contract.test.cjs'
    );
    assert.ok(entry, 'New contract test must be registered');
  });

  it('must be classified as SOURCE_STATIC', () => {
    const entry = classification.entries.find(
      e => e.path === 'tests/contracts/shared-loading-state-primitives-contract.test.cjs'
    );
    assert.strictEqual(entry.layer, 'SOURCE_STATIC');
  });

  it('must have empty capabilities', () => {
    const entry = classification.entries.find(
      e => e.path === 'tests/contracts/shared-loading-state-primitives-contract.test.cjs'
    );
    assert.deepStrictEqual(entry.capabilities, []);
  });
});

// ---- All assertions registered as named tests ----
console.log('✅ All shared-loading-state-primitives contract assertions registered.');
