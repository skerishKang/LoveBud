/**
 * Contract: active scripts/docs must not treat Netlify as production (#3348).
 *
 * Scope:
 * - Active scripts and active ops/security docs must not use lovebud.netlify.app
 *   as a default remote, production target, CORS origin, or Authorized Domain.
 * - lovebud.pages.dev remains the current production host.
 * - Historical docs/conversation/full/* are excluded from the ban.
 * - netlify/ legacy directory is preserved (not deleted / not treated as active).
 * - functions/ is preserved as Cloudflare Pages Functions.
 *
 * Refs: #3348, #3343, #3341, #3342, #3264, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// The `.js` twins of these scripts were removed under #4450. The repository is
// declared `"type": "module"`, so a CommonJS script written with
// `require()`/`module.exports` and a `.js` extension cannot execute at all
// (`ReferenceError: require is not defined in ES module scope`). Listing such a
// file as an ACTIVE script asserted against a file that could never run, and
// left two copies of each script for a reader to pick from. `.cjs` is the
// authority extension, matching `scripts.test` in package.json.
const ACTIVE_SCRIPTS = [
  'scripts/verify-env.cjs',
  'scripts/pre-deploy.cjs',
  'scripts/fix-tree-visibility.cjs',
];

const ACTIVE_DOCS = [
  'docs/ops/ENV_DEPENDENCY.md',
  'docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md',
  'docs/ops/OPERATIONS.md',
  'docs/ops/NETLIFY_STALE_HOST_POLICY.md',
];

const CURRENT_RUNTIME_DOCS = [
  'AGENTS.md',
  'docs/doc_index.md',
  'functions/README.md',
  'modal_compute/README.md',
  'docs/backend/backend.md',
  'docs/engineering/API_CONTRACT.md',
];

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

// ─── 1. Active scripts do not default to Netlify ─────────────────────────────

test('active scripts do not use lovebud.netlify.app as default/remote production target', () => {
  for (const rel of ACTIVE_SCRIPTS) {
    const src = read(rel);
    // Allow comments that explicitly classify Netlify as stale/legacy, but ban
    // default URL values and active curl/remote targets.
    assert.ok(
      !/['"`]https:\/\/lovebud\.netlify\.app['"`]/.test(src),
      `${rel} must not hard-code lovebud.netlify.app as a URL literal`
    );
    assert.ok(
      !/\|\|\s*['"]https:\/\/lovebud\.netlify\.app['"]/.test(src),
      `${rel} must not default --remote to lovebud.netlify.app`
    );
  }
});

test('active scripts default remote/examples use lovebud.pages.dev', () => {
  // verify-env and pre-deploy must default to pages.dev when --remote is set without value
  for (const rel of ['scripts/verify-env.cjs', 'scripts/pre-deploy.cjs']) {
    const src = read(rel);
    assert.ok(
      src.includes('https://lovebud.pages.dev'),
      `${rel} must reference lovebud.pages.dev as the current production host`
    );
  }
});

// ─── 2. Active docs do not recommend Netlify as Authorized Domain / CORS ─────

test('active docs do not recommend *.netlify.app as Firebase Authorized Domain', () => {
  const policy = read('docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md');
  // Must not list netlify as an allowed authorized domain in checklist form
  assert.ok(
    !/Authorized Domains[^.\n]*`lovebud\.netlify\.app`/i.test(policy) ||
      /Do not list `lovebud\.netlify\.app`/i.test(policy),
    'FIREBASE_CLIENT_CONFIG_POLICY must not recommend lovebud.netlify.app as authorized'
  );
  assert.ok(
    /Do not list `lovebud\.netlify\.app`|stale\/legacy/i.test(policy),
    'FIREBASE_CLIENT_CONFIG_POLICY must explicitly ban Netlify authorized domains'
  );
});

test('active ops docs do not list Netlify as active CORS origin default', () => {
  const envDep = read('docs/ops/ENV_DEPENDENCY.md');
  // The default CORS list must not include lovebud.netlify.app as an allowed value
  assert.ok(
    !/기본값[\s\S]{0,200}lovebud\.netlify\.app/.test(envDep) ||
      /must not be listed as active CORS/i.test(envDep),
    'ENV_DEPENDENCY default CORS must not include lovebud.netlify.app as active'
  );
  assert.ok(
    envDep.includes('https://lovebud.pages.dev'),
    'ENV_DEPENDENCY must keep lovebud.pages.dev as production host'
  );
});

// ─── 3. Production host preserved ────────────────────────────────────────────

test('active ops policy keeps Cloudflare Pages as current production', () => {
  const policy = read('docs/ops/NETLIFY_STALE_HOST_POLICY.md');
  assert.ok(
    policy.includes('lovebud.pages.dev'),
    'NETLIFY_STALE_HOST_POLICY must name lovebud.pages.dev as current production'
  );
  assert.ok(
    /stale|legacy|quarantine/i.test(policy),
    'NETLIFY_STALE_HOST_POLICY must classify Netlify as stale/legacy'
  );
});

// ─── 4. Historical conversation records excluded from ban ────────────────────

test('docs/conversation/full historical records are outside the active-reference ban', () => {
  // This test documents the exclusion: historical files may still mention Netlify.
  // We only assert the directory exists and is not required to be clean.
  const histDir = path.join(ROOT, 'docs', 'conversation', 'full');
  assert.ok(fs.existsSync(histDir), 'docs/conversation/full must remain (historical archive)');
  // No assertion that Netlify strings are absent there.
});

// ─── 5. netlify/ legacy directory preserved ──────────────────────────────────

test('netlify/ legacy directory is preserved (not deleted, not treated as active production)', () => {
  const netlifyDir = path.join(ROOT, 'netlify');
  assert.ok(fs.existsSync(netlifyDir), 'netlify/ directory must remain as legacy artifact');
  const readme = path.join(netlifyDir, 'README.md');
  assert.ok(fs.existsSync(readme), 'netlify/README.md must exist');
  const text = fs.readFileSync(readme, 'utf8');
  assert.ok(
    /legacy|NOT Active Production|not.*active production/i.test(text),
    'netlify/README.md must classify the tree as legacy/not active production'
  );
});

// ─── 6. functions/ preserved as Cloudflare Pages Functions ───────────────────

test('functions/ directory is preserved as Cloudflare Pages Functions', () => {
  const fnDir = path.join(ROOT, 'functions');
  assert.ok(fs.existsSync(fnDir), 'functions/ must remain');
  assert.ok(fs.existsSync(path.join(fnDir, 'api')), 'functions/api must remain');
  // Must not be deleted or reclassified wholesale as Netlify in this PR.
  const readme = path.join(fnDir, 'README.md');
  if (fs.existsSync(readme)) {
    const text = fs.readFileSync(readme, 'utf8');
    assert.ok(
      !/active production backend.*Netlify Functions/i.test(text) ||
        /not.*active production backend/i.test(text),
      'functions/README.md must not claim Netlify Functions is the active backend'
    );
  }
});


// ─── 7. Current runtime truth reflects route-selected Direct-Neon + Modal ───

test('current Production config contains checked-in Direct-Neon general runtime gates', () => {
  const wrangler = read('wrangler.toml');
  for (const expected of [
    'LB_TREE_CREATE_WRITE_RUNTIME = "direct_neon"',
    'LB_OWNER_TREES_READ_RUNTIME = "direct_neon"',
    'LB_OWNER_MEMORIES_READ_RUNTIME = "direct_neon"',
    'LB_COMMUNITY_MEMORIES_READ_RUNTIME = "direct_neon"',
  ]) {
    assert.ok(wrangler.includes(expected), `wrangler.toml must preserve current gate: ${expected}`);
  }
});

test('current runtime entrypoint docs do not restore a universal Modal backend claim', () => {
  const forbidden = [
    /Primary backend\/compute:\s*Modal/i,
    /Modal compute handles the backend execution/i,
    /All backend execution for production routes runs here via Modal deployment/i,
    /Current active runtime is Cloudflare Pages Functions\s*→\s*Modal/i,
  ];

  for (const rel of CURRENT_RUNTIME_DOCS) {
    const src = read(rel);
    assert.match(src, /Direct-Neon/i, `${rel} must acknowledge Direct-Neon current runtime ownership`);
    assert.match(src, /Modal/i, `${rel} must preserve retained Modal runtime context`);
    for (const pattern of forbidden) {
      assert.doesNotMatch(src, pattern, `${rel} must not claim Modal is the universal current backend`);
    }
  }
});

test('runtime docs distinguish retained Modal fallback/specialized ownership from Direct-Neon selection', () => {
  for (const rel of ['functions/README.md', 'modal_compute/README.md', 'docs/backend/backend.md']) {
    const src = read(rel);
    assert.match(src, /route-specific|route-selected/i, `${rel} must describe per-route runtime selection`);
    assert.match(src, /fallback|residual|specialized/i, `${rel} must classify retained Modal responsibility`);
  }
});
