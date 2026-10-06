const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const BOUNDARY_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-principal.js');
const ADAPTER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'firebase-read-principal.js');
const SHARED_DIR = path.join(ROOT, 'functions', '_shared');

// #4563 Phase A inventory: every Production Direct-Neon helper that previously
// imported the Firebase principal/verifier pair directly. The read-side
// memory-social core is included because it composes the authenticated
// principal for the gated memory social read gates.
const HELPER_FILES = [
  'appreciation-order-direct-neon.js',
  'comment-delete-direct-neon.js',
  'hub-layout-direct-neon.js',
  'hub-layout-read-direct-neon.js',
  'memory-comment-direct-neon.js',
  'memory-create-direct-neon.js',
  'memory-delete-direct-neon.js',
  'memory-reaction-direct-neon.js',
  'memory-social-read-core.js',
  'memory-update-direct-neon.js',
  'owner-memory-detail-direct-neon.js',
  'owner-memory-list-direct-neon.js',
  'owner-tree-detail-direct-neon.js',
  'owner-tree-list-direct-neon.js',
  'private-tree-capability-direct-neon.js',
  'tree-comment-direct-neon.js',
  'tree-create-direct-neon.js',
  'tree-delete-direct-neon.js',
  'tree-fork-direct-neon.js',
  'tree-like-direct-neon.js',
  'tree-like-read-direct-neon.js',
  'tree-update-direct-neon.js'
];

const FORBIDDEN_HELPER_FRAGMENTS = [
  'firebase-read-principal',
  'firebase-id-token-verifier',
  'resolveFirebaseReadPrincipal',
  'createFirebaseIdTokenVerifier',
  'readFirebaseProjectId',
  'FirebaseReadPrincipalError',
  'FIREBASE_READ_PRINCIPAL_ERROR',
  'buildFirebaseReadPrincipalErrorResponse'
];

const RAW_TOKEN = 'raw-firebase-id-token-value-4563';
const FAKE_EMAIL = 'principal-actor@example.invalid';
const FAKE_ISSUER = 'https://securetoken.google.com/relovetree';

function loadBoundary() {
  return import('../../workers/love-platform-api/authenticated-principal.js');
}

function bearerRequest(token, extraHeaders = {}) {
  const headers = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request('https://lovebud.pages.dev/api/trees', { headers: { ...headers, ...extraHeaders } });
}

function fakeVerifiedIdentity() {
  return {
    uid: 'verified-uid-4563',
    email: FAKE_EMAIL,
    email_verified: true,
    iss: FAKE_ISSUER,
    aud: 'relovetree',
    admin: true,
    customFlag: 'provider-payload-marker'
  };
}

test('1. verified Firebase uid resolves to the canonical provider-neutral principal shape', async () => {
  const boundary = await loadBoundary();
  const principal = await boundary.resolveAuthenticatedPrincipal(
    bearerRequest(RAW_TOKEN),
    {},
    { verifyTokenOverride: async () => fakeVerifiedIdentity() }
  );
  assert.deepEqual(
    {
      provider: principal.provider,
      providerSubject: principal.providerSubject,
      accountId: principal.accountId,
      legacyOwnerId: principal.legacyOwnerId
    },
    {
      provider: 'firebase',
      providerSubject: 'verified-uid-4563',
      accountId: null,
      legacyOwnerId: 'verified-uid-4563'
    }
  );
});

test('2. principal object is frozen with exactly the canonical output fields', async () => {
  const boundary = await loadBoundary();
  const principal = await boundary.resolveAuthenticatedPrincipal(
    bearerRequest(RAW_TOKEN),
    {},
    { verifyTokenOverride: async () => fakeVerifiedIdentity() }
  );
  assert.ok(Object.isFrozen(principal), 'principal must be frozen');
  assert.deepEqual(Object.keys(principal), ['provider', 'providerSubject', 'accountId', 'legacyOwnerId']);
});

test('3. raw token, email, decoded claims, and provider payload never leak into the principal', async () => {
  const boundary = await loadBoundary();
  const principal = await boundary.resolveAuthenticatedPrincipal(
    bearerRequest(RAW_TOKEN),
    {},
    { verifyTokenOverride: async () => fakeVerifiedIdentity() }
  );
  const serialized = JSON.stringify(principal);
  assert.ok(!serialized.includes(RAW_TOKEN), 'raw token must be absent');
  assert.ok(!serialized.includes(FAKE_EMAIL), 'email must be absent');
  assert.ok(!serialized.includes(FAKE_ISSUER), 'decoded issuer must be absent');
  assert.ok(!('email' in principal), 'email field must be absent');
  assert.ok(!('token' in principal), 'token field must be absent');
  assert.ok(!('iss' in principal), 'iss field must be absent');
  assert.ok(!('aud' in principal), 'aud field must be absent');
  assert.ok(!('claims' in principal), 'claims field must be absent');
  assert.ok(!('customFlag' in principal), 'provider payload fields must be absent');
  assert.ok(!('email_verified' in principal), 'provider payload fields must be absent');
});

test('4. client-supplied owner/uid/account headers are never authority', async () => {
  const boundary = await loadBoundary();
  const principal = await boundary.resolveAuthenticatedPrincipal(
    bearerRequest(RAW_TOKEN, {
      'x-client-owner-id': 'client-supplied-owner',
      'x-client-uid': 'client-supplied-uid',
      'x-client-account-id': 'client-supplied-account'
    }),
    {},
    { verifyTokenOverride: async () => fakeVerifiedIdentity() }
  );
  assert.equal(principal.providerSubject, 'verified-uid-4563');
  assert.equal(principal.legacyOwnerId, 'verified-uid-4563');
  assert.equal(principal.accountId, null);
  const serialized = JSON.stringify(principal);
  assert.ok(!serialized.includes('client-supplied'), 'client identity headers must be ignored');

  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(null, { 'x-client-owner-id': 'client-supplied-owner' }),
      {},
      { verifyTokenOverride: async () => fakeVerifiedIdentity() }
    ),
    (error) => error.code === 'AUTHORIZATION_REQUIRED'
  );
});

test('5. provider selection is not client-wirable and Neon tokens are not accepted in Phase A', async () => {
  const boundary = await loadBoundary();
  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(RAW_TOKEN),
      {},
      { provider: 'neon', verifyTokenOverride: async () => fakeVerifiedIdentity() }
    ),
    (error) => error.code === 'FIREBASE_VERIFICATION_FAILED'
  );
  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(RAW_TOKEN),
      {},
      { provider: 'firebase', neonAuthToken: 'neon-token-value', verifyTokenOverride: async () => fakeVerifiedIdentity() }
    ),
    (error) => error.code === 'FIREBASE_VERIFICATION_FAILED'
  );
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.currentAcceptedProvider, 'firebase');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.neonTokenAcceptance, false);
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_PROVIDER.FIREBASE, 'firebase');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_PROVIDER.NEON, 'neon');
  const boundarySource = fs.readFileSync(BOUNDARY_PATH, 'utf8');
  assert.doesNotMatch(boundarySource, /neon[-_]auth/i, 'no Neon Auth wiring may exist in the boundary');
});

test('6. existing auth wire taxonomy is preserved exactly', async () => {
  const boundary = await loadBoundary();
  const cases = [
    ['AUTHORIZATION_REQUIRED', 401, 'Authentication required'],
    ['AUTHORIZATION_MALFORMED', 401, 'Invalid authorization header'],
    ['FIREBASE_VERIFICATION_FAILED', 401, 'Invalid Firebase ID token'],
    ['FIREBASE_VERIFIER_UNAVAILABLE', 503, 'Authentication verifier unavailable']
  ];
  for (const [code, status, message] of cases) {
    const response = boundary.buildAuthenticatedPrincipalErrorResponse(
      new boundary.AuthenticatedPrincipalError(code),
      bearerRequest(null)
    );
    assert.equal(response.status, status, code);
    const body = await response.json();
    assert.deepEqual(body.error, { code, message });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('7. verifier dependency outage and invalid identity keep the 503/401 contract', async () => {
  const boundary = await loadBoundary();
  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(RAW_TOKEN),
      {},
      { verifyTokenOverride: async () => { throw new Error('jwk fetch failed'); } }
    ),
    (error) => error.code === 'FIREBASE_VERIFIER_UNAVAILABLE'
  );
  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(RAW_TOKEN),
      {},
      { verifyTokenOverride: async () => ({ uid: 42 }) }
    ),
    (error) => error.code === 'FIREBASE_VERIFICATION_FAILED'
  );
  await assert.rejects(
    boundary.resolveAuthenticatedPrincipal(
      bearerRequest(RAW_TOKEN),
      {},
      { verifyTokenOverride: async () => null }
    ),
    (error) => error.code === 'FIREBASE_VERIFICATION_FAILED'
  );
});

test('8. deterministic verifier injection seam is preserved through the boundary', async () => {
  const boundary = await loadBoundary();
  let capturedToken = null;
  const principal = await boundary.resolveAuthenticatedPrincipal(
    bearerRequest(RAW_TOKEN),
    {},
    {
      verifyTokenOverride: async (token) => {
        capturedToken = token;
        return { uid: 'seam-uid-4563' };
      }
    }
  );
  assert.equal(capturedToken, RAW_TOKEN, 'override must receive the raw bearer token');
  assert.equal(principal.providerSubject, 'seam-uid-4563');

  const adapter = await import('../../workers/love-platform-api/firebase-read-principal.js');
  assert.equal(typeof adapter.createFirebasePrincipalVerifier, 'function', 'adapter owns verifier assembly');
  const verifier = adapter.createFirebasePrincipalVerifier({ FIREBASE_PROJECT_ID: 'proj-4563' }, { someVerifierOption: 'x' });
  assert.equal(typeof verifier, 'function', 'verifier creation must not require network');
});

test('9. mechanical regression guard: zero direct Firebase principal/verifier dependencies in the Direct-Neon helper inventory', () => {
  const discovered = fs
    .readdirSync(SHARED_DIR)
    .filter((name) => name.endsWith('-direct-neon.js'))
    .concat(['memory-social-read-core.js'])
    .sort();
  assert.ok(discovered.length >= HELPER_FILES.length, 'Direct-Neon helper inventory must not shrink below the migrated baseline');
  for (const expected of HELPER_FILES) {
    assert.ok(discovered.includes(expected), `inventory drift: ${expected} missing from discovered helpers`);
  }

  // Every discovered helper (including future ones) is scanned without exclusion.
  const offenders = [];
  for (const name of discovered) {
    const source = fs.readFileSync(path.join(SHARED_DIR, name), 'utf8');
    for (const fragment of FORBIDDEN_HELPER_FRAGMENTS) {
      if (source.includes(fragment)) offenders.push(`${name} -> ${fragment}`);
    }
  }
  assert.deepEqual(offenders, [], `direct Firebase principal/verifier dependencies remain: ${offenders.join(', ')}`);

  // The migrated baseline helpers must compose the provider-neutral boundary.
  for (const name of HELPER_FILES) {
    const source = fs.readFileSync(path.join(SHARED_DIR, name), 'utf8');
    assert.ok(
      source.includes('workers/love-platform-api/authenticated-principal.js'),
      `${name} must compose the provider-neutral boundary`
    );
  }
});

test('10. dependency inversion wiring: boundary -> adapter -> verifier', () => {
  const boundarySource = fs.readFileSync(BOUNDARY_PATH, 'utf8');
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf8');
  assert.ok(boundarySource.includes("from './firebase-read-principal.js'"), 'boundary must compose the Firebase adapter');
  assert.ok(!boundarySource.includes('firebase-id-token-verifier'), 'boundary must not assemble the Firebase verifier itself');
  assert.ok(adapterSource.includes('firebase-id-token-verifier'), 'adapter must own the Firebase verifier import');
});
