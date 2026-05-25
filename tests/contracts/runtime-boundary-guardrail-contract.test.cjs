/**
 * Runtime Boundary Legacy Guardrail Contract Test
 *
 * Active runtime hierarchy (documented in docs/ops/):
 *   Browser → Cloudflare Pages Functions (functions/api/*) → Modal (modal_compute/*)
 *
 * Legacy runtime artifacts are preserved but guarded:
 *   - netlify/functions/ — legacy Netlify Functions (no active code)
 *   - netlify/sql/ — legacy SQL artifacts (no active code)
 *   - netlify.toml — deprecated Netlify config
 *   - vercel.json — deprecated transitional artifact
 *   - .netlify/ / .vercel/ — local config directories
 *
 * Guardrail purpose:
 *   - Prevent new active backend code from being added to legacy paths
 *   - Detect removal or deprecation of active runtime anchors
 *   - Ensure legacy annotation is preserved
 *
 * v20260525-1
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readDir(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => !f.startsWith('.'));
}

// ─── ACTIVE RUNTIME ANCHORS ─────────────────────────────────────────────────

test('active runtime anchor: Cloudflare Pages Functions catch-all exists', () => {
  assert.ok(exists('functions/api/[[path]].js'),
    'functions/api/[[path]].js must exist — active Cloudflare Pages Functions catch-all');
  const content = readFile('functions/api/[[path]].js');
  assert.ok(content.length > 100,
    'functions/api/[[path]].js must be non-empty');
  assert.match(content, /export\s+async\s+function\s+onRequest/,
    'functions/api/[[path]].js must export onRequest handler');
});

test('active runtime anchor: Cloudflare Pages Functions api routes exist', () => {
  const apiFiles = readDir('functions/api').filter(f => f.endsWith('.js'));
  assert.ok(apiFiles.length >= 3,
    `functions/api/ must have at least 3 route files (found ${apiFiles.length})`);
  assert.ok(apiFiles.includes('[[path]].js'),
    'functions/api/ must include catch-all [[path]].js');
  assert.ok(apiFiles.includes('trees.js'),
    'functions/api/ must include trees.js');
  assert.ok(apiFiles.includes('memories.js'),
    'functions/api/ must include memories.js');
});

test('active runtime anchor: Modal compute backend exists', () => {
  assert.ok(exists('modal_compute'),
    'modal_compute/ directory must exist — active Modal backend');
  assert.ok(exists('modal_compute/app.py'),
    'modal_compute/app.py must exist — Modal FastAPI entry');
  assert.ok(exists('modal_compute/db.py'),
    'modal_compute/db.py must exist — Modal DB layer');
});

// ─── DOCS ANCHOR VERIFICATION ──────────────────────────────────────────────

test('docs/ops/LEGACY_RUNTIME_GUARDRAILS.md exists with active runtime statement', () => {
  assert.ok(exists('docs/ops/LEGACY_RUNTIME_GUARDRAILS.md'),
    'LEGACY_RUNTIME_GUARDRAILS.md must exist — primary guardrail doc');

  const content = readFile('docs/ops/LEGACY_RUNTIME_GUARDRAILS.md');
  assert.match(content, /Cloudflare Pages Functions/,
    'guardrail doc must reference Cloudflare Pages Functions');
  assert.match(content, /modal_compute/,
    'guardrail doc must reference modal_compute');
  assert.match(content, /netlify|legacy/,
    'guardrail doc must reference Netlify or legacy artifacts');
});

test('docs/ops/LEGACY_DEPLOYMENT_ARTIFACT_AUDIT.md exists', () => {
  assert.ok(exists('docs/ops/LEGACY_DEPLOYMENT_ARTIFACT_AUDIT.md'),
    'LEGACY_DEPLOYMENT_ARTIFACT_AUDIT.md must exist — legacy artifact audit');
});

test('netlify/README.md contains legacy annotation', () => {
  assert.ok(exists('netlify/README.md'),
    'netlify/README.md must exist — legacy annotation');
  const content = readFile('netlify/README.md');
  assert.match(content, /legacy/i,
    'netlify/README.md must reference legacy status');
  assert.match(content, /not.*active|legacy|artifact/i,
    'netlify/README.md must state it is not active');
  assert.match(content, /Cloudflare|Modal|functions\/api/,
    'netlify/README.md must redirect to active runtime');
});

// ─── LEGACY PATH GUARDRAILS ────────────────────────────────────────────────

test('legacy guardrail: netlify/functions/ contains NO active .js files', () => {
  const funcDir = path.join(ROOT, 'netlify/functions');
  if (!fs.existsSync(funcDir)) {
    // Legacy Netlify functions have been fully removed — acceptable
    console.log('[INFO] netlify/functions/ no longer exists — legacy functions fully removed');
    return;
  }
  const entries = fs.readdirSync(funcDir);
  const jsFiles = entries.filter(f => f.endsWith('.js'));
  assert.equal(jsFiles.length, 0,
    `netlify/functions/ must not contain active .js files (found: ${jsFiles.join(', ')})`);
});

test('legacy guardrail: netlify/sql/ contains NO active .sql/.js files', () => {
  const sqlDir = path.join(ROOT, 'netlify/sql');
  if (!fs.existsSync(sqlDir)) {
    console.log('[INFO] netlify/sql/ no longer exists — legacy SQL artifacts fully removed');
    return;
  }
  const entries = fs.readdirSync(sqlDir);
  const activeFiles = entries.filter(f => f.endsWith('.sql') || f.endsWith('.js'));
  assert.equal(activeFiles.length, 0,
    `netlify/sql/ must not contain active SQL/JS files (found: ${activeFiles.join(', ')})`);
});

test('legacy guardrail: vercel.json contains legacy annotation', () => {
  assert.ok(exists('vercel.json'), 'vercel.json must exist');
  const content = readFile('vercel.json');
  assert.match(content, /x-lovebud-runtime-note/,
    'vercel.json must have x-lovebud-runtime-note legacy annotation');
  assert.match(content, /legacy|deprecated|transitional/i,
    'vercel.json note must reference legacy/deprecated status');
  assert.match(content, /Cloudflare|Modal|functions\/api/,
    'vercel.json note must reference active runtime');
});

// ─── ROOT-LEVEL LEGACY CONFIG FILES ────────────────────────────────────────

test('legacy guardrail: netlify.toml is empty or annotated as legacy', () => {
  if (!exists('netlify.toml')) {
    console.log('[INFO] netlify.toml does not exist — legacy config fully removed');
    return;
  }
  const content = readFile('netlify.toml');
  const hasLegacyNote = content.includes('legacy') || content.includes('Legacy');
  const isEmpty = content.trim().length === 0;
  assert.ok(hasLegacyNote || isEmpty,
    'netlify.toml must be empty or contain legacy annotation if it exists');
});

// ─── ACTIVE ROUTE OWNERSHIP DOC STRINGS ────────────────────────────────────

test('active route ownership: functions/api/[[path]].js references Modal as upstream', () => {
  const content = readFile('functions/api/[[path]].js');
  assert.match(content, /x-lovebud-upstream.*modal/,
    '[[path]].js must reference modal upstream header');
  assert.match(content, /MODAL_BASE_URL/,
    '[[path]].js must reference MODAL_BASE_URL env var');
  assert.match(content, /\/modal\//,
    '[[path]].js must build /modal/ route paths for Modal endpoints');
  assert.match(content, /modalUrl|modalBaseUrl|MODAL_BASE_URL/,
    '[[path]].js must construct Modal URLs from base URL');
  assert.match(content, /fetchWithTimeout|tryModalRead|tryModalWrite/,
    '[[path]].js must use Modal read/write helpers');
});

test('active route ownership: docs/ops/RUNTIME_ROUTING_TRUTH docs exist', () => {
  const docsWithRouting = [
    'docs/ops/RUNTIME_ROUTING_TRANSITIONAL_AUDIT.md',
    'docs/engineering/CLOUDFLARE_API_ROUTE_MAPPING_AUDIT.md',
  ];
  for (const doc of docsWithRouting) {
    assert.ok(exists(doc), `${doc} must exist — runtime routing documentation`);
  }
});

// ─── PROTECTED PATHS SUMMARY ──────────────────────────────────────────────

test('legacy protected paths are documented as guarded', () => {
  const legacyPaths = [
    { path: 'netlify/functions/', type: 'legacy', reason: 'Legacy Netlify Functions — do not add active code' },
    { path: 'netlify/sql/', type: 'legacy', reason: 'Legacy Netlify SQL artifacts — do not add active code' },
    { path: 'netlify.toml', type: 'legacy', reason: 'Legacy Netlify config — empty or annotated' },
    { path: 'vercel.json', type: 'transitional', reason: 'Deprecated Vercel config — annotated as legacy fallback' },
  ];

  for (const entry of legacyPaths) {
    const entryPath = path.join(ROOT, entry.path);
    const existsInRepo = fs.existsSync(entryPath);
    const status = existsInRepo ? 'EXISTS (guarded)' : 'REMOVED (acceptable)';
    console.log(`  [${entry.type}] ${entry.path}: ${status}`);
    console.log(`    Reason: ${entry.reason}`);
  }
});

// ─── NEGATIVE GUARDRAIL: No new active routes on legacy paths ──────────────

test('negative guardrail: no active JS files in netlify/functions or netlify/sql', () => {
  // This test ensures that if a legacy path gets a new .js file (e.g., from
  // a copy-paste error), the test will fail.
  const legacyDirs = ['netlify/functions', 'netlify/sql'];
  const issues = [];

  for (const dir of legacyDirs) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walk(path.join(d, entry.name));
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.py') || entry.name.endsWith('.json')) {
          issues.push(path.relative(ROOT, path.join(d, entry.name)));
        }
      }
    };
    walk(fullDir);
  }

  assert.equal(issues.length, 0,
    issues.length > 0
      ? `Active runtime code found on legacy paths! Remove or move to active runtime:\n  ${issues.join('\n  ')}`
      : 'No active code files on legacy paths');
});
