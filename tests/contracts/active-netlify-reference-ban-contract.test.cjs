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

const ACTIVE_SCRIPTS = [
  'scripts/verify-env.js',
  'scripts/verify-env.cjs',
  'scripts/pre-deploy.js',
  'scripts/pre-deploy.cjs',
  'scripts/fix-tree-visibility.js',
  'scripts/fix-tree-visibility.cjs',
];

const ACTIVE_DOCS = [
  'docs/ops/ENV_DEPENDENCY.md',
  'docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md',
  'docs/ops/OPERATIONS.md',
  'docs/ops/NETLIFY_STALE_HOST_POLICY.md',
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
  for (const rel of ['scripts/verify-env.js', 'scripts/verify-env.cjs', 'scripts/pre-deploy.js', 'scripts/pre-deploy.cjs']) {
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
