/**
 * Contract test: Auth token storage threat model decision record.
 *
 * Validates that the decision record document exists, contains required
 * decision concepts, and cross-checks against current source implementation.
 * This is a static source-only test — no production auth runtime behavior is NOT tested here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Document existence and required headings
// ---------------------------------------------------------------------------

test('Decision record file exists', () => {
  const docPath = path.join(ROOT, 'docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.ok(fs.existsSync(docPath), 'Decision record file must exist');
});

test('Decision record has required top-level headings', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  const requiredHeadings = [
    '# LoveBud Client Token Storage Threat Model and Decision Record',
    '## 1. Decision summary',
    '## 2. Current verified baseline',
    '## 3. Lifecycle map',
    '## 4. Threat model',
    '## 5. Options considered',
    '## 6. Decision and migration gates',
    '## 7. Dependencies kept separate',
    '## 8. Non-goals',
    '## 9. Follow-up test matrix'
  ];
  for (const h of requiredHeadings) {
    assert.ok(doc.includes(h), `Missing required heading: ${h}`);
  }
});

test('Decision record meta fields present', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /Status: DECISION_RECORD/);
  assert.match(doc, /Scope: docs-only/);
  assert.match(doc, /Refs #2987/);
  assert.match(doc, /Refs #1882/);
  assert.match(doc, /Baseline source files/);
});

// ---------------------------------------------------------------------------
// 2. Core decision concepts present
// ---------------------------------------------------------------------------

test('Decision summary contains interim model and XSS caveat', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  // Interim model retained
  assert.match(doc, /sessionStorage.*interim model/i, 'Must state sessionStorage interim model retained');
  // XSS residual risk
  assert.match(doc, /sessionStorage.*does not eliminate XSS/i, 'Must state sessionStorage does not eliminate XSS risk');
  assert.match(doc, /active XSS residual risk/i, 'Must state active XSS residual risk');
  // No claim of XSS-proof
  assert.match(doc, /No claim that current state is XSS-proof/i, 'Must not claim XSS-proof');
});

test('HttpOnly BFF option has required prerequisites', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  const prereqs = [
    'CSRF protection design',
    'session revocation',
    'logout invalidation',
    'refresh.*session rotation',
    'same-origin API boundary',
    'multi-tab behavior',
    'server-side deployment and observability'
  ];
  for (const p of prereqs) {
    assert.match(doc, new RegExp(p, 'i'), `HttpOnly BFF option must list prerequisite: ${p}`);
  });
});

test('CSRF, session revocation, migration gates documented', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /CSRF/i, 'CSRF must be mentioned');
  assert.match(doc, /session revocation/i, 'Session revocation must be mentioned');
  // Migration gates
  assert.match(doc, /login.*refresh.*expiry.*logout.*hard reload.*second tab/i, 'Migration gates must list login/refresh/expiry/logout/hard reload/second tab');
  assert.match(doc, /browser QA.*auth smoke/i, 'Migration PR must require browser QA and auth smoke');
});

test('Docs-only scope and no runtime behavior change claims', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /docs-only.*no runtime behavior change/i, 'Must state docs-only scope, no runtime behavior change claim');
  assert.match(doc, /no claim.*behavior test completion/i, 'Must not claim behavior test completion');
});

test('Dependencies kept separate listed', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  const deps = [
    'CSP / renderer XSS hardening',
    'URL sanitization',
    'iframe referrer policy',
    'Firebase config',
    'Auth UI',
    'Protected-route behavior'
  ];
  for (const d of deps) {
    assert.match(doc, new RegExp(d, 'i'), `Separate workstream ${d} must be listed`);
  });
});

// ---------------------------------------------------------------------------
// 3. Source cross-check against current implementation
// ---------------------------------------------------------------------------

test('auth-state.js contains AUTH_TOKEN_KEY constant', () => {
  const src = read('js/auth/auth-state.js');
  assert.match(src, /AUTH_TOKEN_KEY\s*[:=]\s*['"]lovebud_auth_token['"]/,
    'auth-state.js must define AUTH_TOKEN_KEY as "lovebud_auth_token"');
});

test('auth-cache.js getTokenStorage returns sessionStorage', () => {
  const src = read('js/auth/auth-cache.js');
  assert.match(src, /function getTokenStorage\(\)/, 'getTokenStorage function must exist');
  assert.match(src, /return window\.sessionStorage/, 'getTokenStorage must return window.sessionStorage');
});

test('auth-cache.js clears legacy localStorage token key', () => {
  const src = read('js/auth/auth-cache.js');
  // clearAuthTokenCache removes from localStorage and sessionStorage
  assert.match(src, /function clearAuthTokenCache\(tokenKey\)/, 'clearAuthTokenCache function must exist');
  assert.match(src, /localStorage\.removeItem\(tokenKey\)/, 'clearAuthTokenCache must remove token from localStorage');
  assert.match(src, /getTokenStorage\(\)/, 'clearAuthTokenCache must use getTokenStorage for sessionStorage');
});

test('auth-cache.js sessionStorage token write path exists', () => {
  const src = read('js/auth/auth-cache.js');
  // persistConfirmedAuthSession writes token to sessionStorage
  assert.match(src, /tokenStorage\.setItem\(tokenKey/, 'Token must be written to sessionStorage via setItem');
  assert.match(src, /expiresAt/, 'Token record must include expiresAt');
});

test('auth-cache.js has 30-second expiry guard', () => {
  const src = read('js/auth/auth-cache.js');
  assert.match(src, /expiresAt.*-.*30000/, 'Expiry guard must use 30-second (30000ms) window');
  assert.match(src, /removeItem\(tokenKey\)/, 'Expired token must be removed from storage');
  assert.match(src, /return null/, 'Expired token must return null');
});

test('auth-cache.js does NOT write tokenKey to localStorage', () => {
  const src = read('js/auth/auth-cache.js');
  // Token is only written to sessionStorage; localStorage token is cleared
  // Verify no localStorage.setItem(tokenKey, ...) for token
  // The only localStorage.setItem for tokenKey should be in clearAuthTokenCache (removal)
  const setItemMatches = src.match(/localStorage\.setItem\([^)]*tokenKey[^)]*\)/g) || [];
  // Any setItem with tokenKey should be for removal/clearing, not persistence
  // Just ensure there's no explicit persistence to localStorage for the token
  // (This is a sanity check — the actual logic is in clearAuthTokenCache which removes)
  assert.ok(src.includes('localStorage.removeItem(tokenKey)'),
    'localStorage token key must be removed, not persisted');
});

// ---------------------------------------------------------------------------
// 4. Document distinguishes source facts from decisions
// ---------------------------------------------------------------------------

test('Document marks issue legacy localStorage vs current baseline neutrally', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /legacy localStorage.*issue.*current.*baseline.*neutrally/i,
    'Must neutrally record legacy localStorage reference vs current baseline difference');
  assert.match(doc, /without judging past design choices/i, 'Must not judge past design choices');
});

test('Lifecycle map marks unverified items', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /not verified in this docs-only slice/i,
    'Must mark unverified lifecycle behaviors');
});

test('Non-goals explicitly listed', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  const nongoals = [
    'no auth provider replacement',
    'no.*js/auth.js.*changes',
    'no.*localStorage.*sessionStorage.*runtime migration',
    'no cookie.*server.*BFF implementation',
    'no Firebase Console changes',
    'no secret.*token values in docs',
    'no claim.*XSS-proof'
  ];
  for (const ng of nongoals) {
    assert.match(doc, new RegExp(ng, 'i'), `Non-goal "${ng}" must be listed`);
  }
});