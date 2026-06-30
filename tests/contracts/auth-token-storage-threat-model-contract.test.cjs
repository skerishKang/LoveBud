/**
 * Contract test: Auth token storage threat model — minimal static contract.
 *
 * Verifies only the core security decision, current storage location, future
 * migration prerequisites, and docs-only boundary. Avoids brittle matching
 * against Markdown formatting, line breaks, or secondary phrasing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function normalize(text) {
  return text
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// A. Decision record exists and is scoped
// ---------------------------------------------------------------------------

test('Decision record exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md')));
});

test('Decision record has required meta fields', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /Status: DECISION_RECORD/);
  assert.match(doc, /Scope: docs-only/);
  assert.match(doc, /Refs #2987/);
  assert.match(doc, /Refs #1882/);
});

test('Decision record states scoped non-goals', () => {
  const doc = normalize(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /no auth provider replacement/i);
  assert.match(doc, /no cookie.*server.*bff implementation/i);
});

// ---------------------------------------------------------------------------
// B. Current token-storage decision is accurately stated
// ---------------------------------------------------------------------------

test('Decision summary states current interim model', () => {
  const doc = normalize(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /sessionStorage-backed token cache is retained as a short-term interim model/);
  assert.match(doc, /does not eliminate active XSS risk/);
  assert.ok(doc.includes('only in sessionStorage'));
});

test('Decision record describes correct cross-tab semantics', () => {
  const doc = normalize(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /same-tab hard reload\/restore preserves sessionStorage/);
  assert.ok(doc.includes('opener-created tab may receive an initial copy'));
  assert.match(doc, /final behavior requires runtime verification per environment/);
});

// ---------------------------------------------------------------------------
// C. Future HttpOnly BFF option has required prerequisites
// ---------------------------------------------------------------------------

test('HttpOnly BFF option lists required implementation prerequisites', () => {
  const doc = normalize(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  const prereqs = [
    'CSRF protection design',
    'Session revocation mechanism',
    'Logout invalidation',
    'Refresh/session rotation policy',
    'Same-origin API boundary',
    'Multi-tab behavior',
    'Server-side deployment and observability'
  ];
  for (const p of prereqs) {
    assert.ok(doc.includes(p), `Prerequisite not found: ${p}`);
  }
});

// ---------------------------------------------------------------------------
// D. Current source still uses sessionStorage token storage
// ---------------------------------------------------------------------------

test('auth-state.js defines AUTH_TOKEN_KEY', () => {
  const src = read('js/auth/auth-state.js');
  assert.match(src, /lovebud_auth_token/);
});

test('auth-cache.js has sessionStorage token storage path', () => {
  const src = read('js/auth/auth-cache.js');
  assert.match(src, /function getTokenStorage\(\)/);
  assert.match(src, /return window\.sessionStorage/);
  assert.match(src, /localStorage\.removeItem\(tokenKey\)/);
  assert.match(src, /tokenStorage\.setItem\(\s*tokenKey/);
  assert.match(src, /Number\(parsed\.expiresAt\) - 30000/);
});

// ---------------------------------------------------------------------------
// E. Docs-only migration boundary is explicit
// ---------------------------------------------------------------------------

test('Migration boundary is documented', () => {
  const doc = normalize(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /Future runtime migration will be a separate issue \/ PR/);
  assert.ok(doc.includes('browser QA + auth smoke test'));
  assert.ok(doc.includes('does not claim behavior test completion'));
  assert.ok(doc.includes('localStorage/sessionStorage runtime migration'));
});
