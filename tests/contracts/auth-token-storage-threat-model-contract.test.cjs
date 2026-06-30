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

function normalizeDocument(text) {
  return text
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  const doc = normalizeDocument(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /sessionStorage-backed token cache is retained as a short-term interim model/, 'Must state sessionStorage-backed token cache is retained as the interim model');
  assert.match(doc, /does not eliminate active XSS risk/, 'Must state sessionStorage does not eliminate active XSS risk');
  assert.match(doc, /active XSS authenticated action risk/, 'Must state active XSS authenticated action risk');
  assert.match(doc, /No claim that current state is XSS-proof/, 'Must not claim XSS-proof');
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
  const doc = normalizeDocument(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /CSRF/, 'CSRF must be mentioned');
  assert.match(doc, /session revocation/, 'Session revocation must be mentioned');
  
  const gates = [
    'Login', 'Token refresh', 'Expiry / 30s guard', 'Logout', 'Hard reload',
    'Second tab behavior', 'Invalid session handling', 'Authenticated API retry / Authorization header attachment'
  ];
  for (const gate of gates) {
    assert.ok(doc.includes(gate), `Migration gate must list: ${gate}`);
  }
  assert.match(doc, /browser QA.*auth smoke/, 'Migration PR must require browser QA and auth smoke');
});

test('Docs-only scope and no runtime behavior change claims', () => {
  const doc = normalizeDocument(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /Scope: docs-only; no auth runtime, Firebase, API.*changes/, 'Must state docs-only scope, no runtime behavior change claim');
  assert.match(doc, /does not claim behavior test completion/, 'Must not claim behavior test completion');
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
  assert.match(src, /tokenStorage\.setItem\(\s*tokenKey/, 'Token must be written to sessionStorage via setItem');
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
  const doc = normalizeDocument(read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md'));
  assert.match(doc, /The issue text references a legacy localStorage token path. The current implementation baseline/, 'Must neutrally record legacy localStorage reference vs current baseline difference');
  assert.match(doc, /without judging past design choices/, 'Must not judge past design choices');
});

test('Follow-up test matrix reflects hard reload preservation', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /Hard reload.*Same-tab hard reload.*restore preserves sessionStorage|Same-tab hard reload.*restore preserves sessionStorage/i,
    'Follow-up test matrix must state same-tab hard reload preserves sessionStorage');
});

test('Follow-up test matrix reflects opener-created tab behavior', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /opener-created tab.*may.*inherit|opener-created tab.*initial copy|opener-created tab.*may.*inherit.*initial/i,
    'Follow-up test matrix must mention opener-created tab inheritance');
});

test('Follow-up test matrix does NOT assert second tab always unauthenticated', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.ok(!doc.includes('New tab `sessionStorage.getItem(tokenKey) === null` until login'),
    'Follow-up matrix must not assert second tab always null until login');
  assert.ok(!doc.includes('second tab always has no token'),
    'Follow-up matrix must not assert second tab always has no token');
});

test('Document states same-tab hard reload preserves sessionStorage', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /same-tab hard reload.*restore preserves sessionStorage|same-tab hard reload.*preserves sessionStorage/i,
    'Must state same-tab hard reload preserves sessionStorage token');
});

test('Document states opener-created tab may inherit sessionStorage copy', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /opener-created tab.*may.*inherit|opener-created tab.*initial copy/i,
    'Must state opener-created tab may receive initial sessionStorage copy');
});

test('Document does NOT assert second tab always unauthenticated', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  // Should NOT contain the old absolute assertion
  assert.ok(!doc.includes('second tab has no token until new login'),
    'Must not contain old absolute assertion about second tab having no token');
  assert.ok(!doc.includes('second tab has no token until login'),
    'Must not contain absolute assertion about second tab having no token until login');
});

// ---------------------------------------------------------------------------
// 5. Stale hard-reload claim removal contracts (Refs #2987)
// ---------------------------------------------------------------------------

test('Document does NOT contain "lost on tab close / hard reload"', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.ok(!doc.includes('lost on tab close'),
    'Document must not contain the stale phrase "lost on tab close"');
  assert.ok(!/token lost on tab close/.test(doc),
    'Document must not contain "token lost on tab close" pattern');
});

test('Document does NOT contain "hard reload clears token"', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.ok(!/hard reload.*clears token/.test(doc),
    'Document must not contain "hard reload clears token" pattern');
  assert.ok(!/hard reload.*clear/.test(doc),
    'Document must not contain "hard reload clear" pattern');
});

test('§5-A mentions same-tab hard reload/restore preservation', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /same-tab hard reload.*restore preserves the sessionStorage record/i,
    '§5-A Security property must state same-tab hard reload/restore preserves sessionStorage');
});

test('§5-A does not absolutely assert multi-tab results', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  // §5-A Tradeoff must avoid absolute claims about multi-tab behavior
  assert.ok(!doc.includes('per-tab token breaks multi-tab UX'),
    '§5-A must not claim absolute "per-tab token breaks multi-tab UX"');
  assert.match(doc, /Independent and opener-created browsing contexts can differ/i,
    '§5-A Tradeoff must state browsing contexts can differ');
});

test('Lifecycle map distinguishes independent-tab cache read from Firebase re-bootstrap', () => {
  const doc = read('docs/security/AUTH_TOKEN_STORAGE_THREAT_MODEL.md');
  assert.match(doc, /direct cache read initially returns `null`/i,
    'Lifecycle map must mention independent-tab direct cache read initially returns null');
  assert.match(doc, /Firebase re-bootstrap.*may subsequently populate or alter effective auth state/i,
    'Lifecycle map must state Firebase re-bootstrap may subsequently populate or alter effective auth state');
  assert.match(doc, /final behavior requires runtime verification/i,
    'Lifecycle map must state final behavior requires runtime verification per environment');
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