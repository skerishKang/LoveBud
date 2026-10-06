const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const VERIFIER_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'neon-auth-token-verifier.js');
const BOUNDARY_PATH = path.join(ROOT, 'workers', 'love-platform-api', 'authenticated-principal.js');
const SHARED_DIR = path.join(ROOT, 'functions', '_shared');
const API_DIR = path.join(ROOT, 'functions', 'api');

const TRUSTED_ISSUER = 'https://auth.example.invalid';
const TRUSTED_AUDIENCE = 'lovebud-product';
const TRUSTED_JWKS_URL = 'https://auth.example.invalid/jwks.json';
const BASE_MS = 1700000000000;
const BASE_SEC = BASE_MS / 1000;

let keysPromise = null;
function getKeys() {
  if (!keysPromise) {
    keysPromise = (async () => {
      const generate = () => crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
      const keyA = await generate();
      const keyB = await generate();
      const jwkA = await crypto.subtle.exportKey('jwk', keyA.publicKey);
      const jwkB = await crypto.subtle.exportKey('jwk', keyB.publicKey);
      return {
        privateKeyA: keyA.privateKey,
        privateKeyB: keyB.privateKey,
        jwksA: { keys: [{ kty: 'OKP', crv: 'Ed25519', kid: 'kid-4565-A', x: jwkA.x }] }
      };
    })();
  }
  return keysPromise;
}

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) {
    verifierModulePromise = import('../../workers/love-platform-api/neon-auth-token-verifier.js');
  }
  return verifierModulePromise;
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

async function signToken(privateKey, header, payload) {
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    Buffer.from(signingInput, 'utf8')
  );
  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

async function makeHarness({ jwksPayload = null, cacheControl = null, fetchBehavior = 'ok' } = {}) {
  const { createNeonAuthTokenVerifier } = await loadVerifierModule();
  const state = { calls: 0, urls: [] };
  const fetchImpl = async (url) => {
    state.calls += 1;
    state.urls.push(String(url));
    if (fetchBehavior === 'throw') throw new Error('simulated network outage');
    if (fetchBehavior === 'http-error') {
      return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (String(name).toLowerCase() === 'cache-control' ? cacheControl : null) },
      json: async () => jwksPayload
    };
  };
  let currentTime = BASE_MS;
  const clock = {
    now: () => currentTime,
    advanceSeconds: (seconds) => { currentTime += seconds * 1000; }
  };
  const build = (overrides = {}) => createNeonAuthTokenVerifier({
    issuer: TRUSTED_ISSUER,
    audience: TRUSTED_AUDIENCE,
    jwksUrl: TRUSTED_JWKS_URL,
    fetchImpl,
    cryptoImpl: crypto,
    now: clock.now,
    ...overrides
  });
  return { state, clock, build };
}

async function makeValidToken(keys, payloadOverrides = {}, headerOverrides = {}) {
  return signToken(keys.privateKeyA, {
    alg: 'EdDSA',
    kid: 'kid-4565-A',
    typ: 'JWT',
    ...headerOverrides
  }, {
    iss: TRUSTED_ISSUER,
    aud: TRUSTED_AUDIENCE,
    exp: BASE_SEC + 600,
    iat: BASE_SEC,
    sub: 'neon-subject-4565',
    ...payloadOverrides
  });
}

function loadVerifierModule() {
  return import('../../workers/love-platform-api/neon-auth-token-verifier.js');
}

test('setup: synthetic Ed25519 keypairs and JWKS are generated with Web Crypto', async () => {
  const keys = await getKeys();
  assert.equal(keys.jwksA.keys[0].kty, 'OKP');
  assert.equal(keys.jwksA.keys[0].crv, 'Ed25519');
  assert.ok(typeof keys.jwksA.keys[0].x === 'string' && keys.jwksA.keys[0].x.length > 0);
});

test('1. valid EdDSA token resolves the exact frozen minimal identity', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, { nbf: BASE_SEC - 60 });
  const identity = await verifier.verify(token);
  assert.deepEqual(identity, { provider: 'neon', providerSubject: 'neon-subject-4565' });
  assert.deepEqual(Object.keys(identity), ['provider', 'providerSubject']);
  assert.ok(Object.isFrozen(identity));
});

test('2. unsupported algorithm is rejected before any JWKS fetch', async () => {
  const keys = await getKeys();
  const { build, state } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await signToken(keys.privateKeyA, { alg: 'RS256', kid: 'kid-4565-A' }, {
    iss: TRUSTED_ISSUER, aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'subject'
  });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
  assert.equal(state.calls, 0, 'unsupported alg must not reach the JWKS store');
});

test('3. malformed tokens are rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const malformed = [
    '',
    'not-a-token',
    'a.b',
    'a.b.c.d',
    '!!!.???...',
    `${Buffer.from('not json').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.c`,
    `${Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'kid-4565-A' })).toString('base64url')}.!!!.c`
  ];
  for (const token of malformed) {
    await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID', token);
  }
});

test('4. missing kid header is rejected', async () => {
  const keys = await getKeys();
  const { build, state } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await signToken(keys.privateKeyA, { alg: 'EdDSA' }, {
    iss: TRUSTED_ISSUER, aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'subject'
  });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
  assert.equal(state.calls, 0, 'missing kid must not reach the JWKS store');
});

test('5. unknown kid performs at most one forced JWKS refresh per verify call', async () => {
  const keys = await getKeys();
  const { build, state } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys);
  const ghostToken = await signToken(keys.privateKeyA, { alg: 'EdDSA', kid: 'ghost-kid' }, {
    iss: TRUSTED_ISSUER, aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'subject'
  });
  await assert.rejects(verifier.verify(ghostToken), (error) => error.code === 'TOKEN_INVALID');
  assert.equal(state.calls, 2, 'initial fetch + exactly one forced refresh');
  await assert.rejects(verifier.verify(ghostToken), (error) => error.code === 'TOKEN_INVALID');
  assert.equal(state.calls, 3, 'no unbounded retry loop across calls');
  const identity = await verifier.verify(token);
  assert.equal(identity.provider, 'neon');
});

test('6. invalid signature is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const forged = await signToken(keys.privateKeyB, { alg: 'EdDSA', kid: 'kid-4565-A' }, {
    iss: TRUSTED_ISSUER, aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'subject'
  });
  await assert.rejects(verifier.verify(forged), (error) => error.code === 'TOKEN_INVALID');
});

test('7. wrong issuer is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, { iss: 'https://evil.example.invalid' });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
});

test('8. wrong audience is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, { aud: 'other-product' });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
});

test('9. expired token is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, { exp: BASE_SEC - 10 });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
});

test('10. future iat is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, { iat: BASE_SEC + 60 });
  await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID');
});

test('11. future nbf is rejected; absent and already-valid nbf stay allowed', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const futureNbf = await makeValidToken(keys, { nbf: BASE_SEC + 60 });
  await assert.rejects(verifier.verify(futureNbf), (error) => error.code === 'TOKEN_INVALID');
  const absentNbf = await makeValidToken(keys, { nbf: undefined });
  const identity = await verifier.verify(absentNbf);
  assert.equal(identity.providerSubject, 'neon-subject-4565');
  const pastNbf = await makeValidToken(keys, { nbf: BASE_SEC - 60 });
  const identity2 = await verifier.verify(pastNbf);
  assert.equal(identity2.providerSubject, 'neon-subject-4565');
});

test('12. invalid or untrimmed sub is rejected', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  for (const sub of ['', 123, null, '   spaced   ']) {
    const token = await makeValidToken(keys, { sub });
    await assert.rejects(verifier.verify(token), (error) => error.code === 'TOKEN_INVALID', String(sub));
  }
  const missing = await makeValidToken(keys, { sub: undefined });
  await assert.rejects(verifier.verify(missing), (error) => error.code === 'TOKEN_INVALID');
});

test('13. JWKS fetch failures are sanitized as VERIFIER_UNAVAILABLE', async () => {
  const keys = await getKeys();
  const throwing = await makeHarness({ fetchBehavior: 'throw' });
  await assert.rejects(
    throwing.build().verify(await makeValidToken(keys)),
    (error) => error.code === 'VERIFIER_UNAVAILABLE'
  );
  const httpError = await makeHarness({ fetchBehavior: 'http-error' });
  await assert.rejects(
    httpError.build().verify(await makeValidToken(keys)),
    (error) => error.code === 'VERIFIER_UNAVAILABLE'
  );
});

test('14. invalid JWKS or unusable key fails closed', async () => {
  const keys = await getKeys();
  const noKeys = await makeHarness({ jwksPayload: { notKeys: true } });
  await assert.rejects(
    noKeys.build().verify(await makeValidToken(keys)),
    (error) => error.code === 'VERIFIER_UNAVAILABLE'
  );
  const wrongKty = await makeHarness({
    jwksPayload: { keys: [{ kty: 'EC', crv: 'P-256', kid: 'kid-4565-A', x: 'aGk' }] }
  });
  await assert.rejects(
    wrongKty.build().verify(await makeValidToken(keys)),
    (error) => error.code === 'TOKEN_INVALID'
  );
  const missingX = await makeHarness({
    jwksPayload: { keys: [{ kty: 'OKP', crv: 'Ed25519', kid: 'kid-4565-A' }] }
  });
  await assert.rejects(
    missingX.build().verify(await makeValidToken(keys)),
    (error) => error.code === 'TOKEN_INVALID'
  );
});

test('15. crypto import infrastructure failure is sanitized as VERIFIER_UNAVAILABLE', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const brokenCrypto = {
    subtle: {
      importKey: async () => { throw new Error('keystore down'); },
      verify: (...args) => crypto.subtle.verify(...args)
    }
  };
  const verifier = build({ cryptoImpl: brokenCrypto });
  const token = await makeValidToken(keys);
  await assert.rejects(verifier.verify(token), (error) => error.code === 'VERIFIER_UNAVAILABLE');
});

test('16. crypto verify infrastructure exception is sanitized as VERIFIER_UNAVAILABLE', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const brokenCrypto = {
    subtle: {
      importKey: (...args) => crypto.subtle.importKey(...args),
      verify: async () => { throw new Error('hsm stuck'); }
    }
  };
  const verifier = build({ cryptoImpl: brokenCrypto });
  const token = await makeValidToken(keys);
  await assert.rejects(verifier.verify(token), (error) => error.code === 'VERIFIER_UNAVAILABLE');
});

test('17. no raw token, email, name, role, JWK material, or provider response leakage', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const verifier = build();
  const token = await makeValidToken(keys, {
    email: 'principal-actor@example.invalid',
    name: 'Leaky Name',
    role: 'admin'
  });
  const identity = await verifier.verify(token);
  assert.deepEqual(identity, { provider: 'neon', providerSubject: 'neon-subject-4565' });
  const serialized = JSON.stringify(identity);
  const signatureSegment = token.split('.')[2];
  assert.ok(!serialized.includes(signatureSegment), 'token signature material must not leak into the identity');
  assert.ok(!serialized.includes('principal-actor@example.invalid'), 'email claim must not leak');
  assert.ok(!serialized.includes('Leaky Name'), 'name must not leak');
  assert.ok(!serialized.includes('admin'), 'role must not leak');
  assert.ok(!('email' in identity) && !('name' in identity) && !('role' in identity));

  const failures = [];
  const probes = ['', 'a.b', await signToken(keys.privateKeyA, { alg: 'RS256', kid: 'kid-4565-A' }, {
    iss: TRUSTED_ISSUER, aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'x'
  }), await signToken(keys.privateKeyA, { alg: 'EdDSA', kid: 'kid-4565-A' }, {
    iss: 'https://evil.example.invalid', aud: TRUSTED_AUDIENCE, exp: BASE_SEC + 600, iat: BASE_SEC, sub: 'x'
  })];
  for (const probe of probes) {
    try {
      await verifier.verify(probe);
    } catch (error) {
      failures.push(error);
      assert.ok(error.message === error.code, 'error message must stay bounded to the code');
      assert.ok(!error.message.includes(TRUSTED_JWKS_URL), 'JWKS URL must not leak into errors');
      assert.ok(!/eyJ|Bearer|postgresql/i.test(error.message), 'credential-looking material must not leak');
    }
  }
  assert.equal(failures.length, probes.length);
});

test('18. JWKS cache is bounded: reuse within TTL, finite refresh after expiry', async () => {
  const keys = await getKeys();
  const { build, state, clock } = await makeHarness({ jwksPayload: keys.jwksA, cacheControl: 'max-age=2' });
  const verifier = build();
  const token = await makeValidToken(keys);
  await verifier.verify(token);
  await verifier.verify(token);
  assert.equal(state.calls, 1, 'cached JWKS must be reused within the TTL');
  clock.advanceSeconds(3);
  await verifier.verify(token);
  assert.equal(state.calls, 2, 'expired cache refreshes exactly once');
  const maxAge = await makeHarness({ jwksPayload: keys.jwksA, cacheControl: 'max-age=99999999' });
  await maxAge.build().verify(await makeValidToken(keys));
  assert.ok(maxAge.state.urls.every((url) => url === TRUSTED_JWKS_URL));
});

test('19. invalid trusted composition inputs are CONFIG_INVALID', async () => {
  const keys = await getKeys();
  const { build } = await makeHarness({ jwksPayload: keys.jwksA });
  const invalidConfigs = [
    { issuer: '' },
    { audience: null },
    { jwksUrl: 'http://insecure.example.invalid/jwks.json' },
    { jwksUrl: 42 },
    { fetchImpl: 'not-a-function' },
    { cryptoImpl: null },
    { now: 'nope' }
  ];
  for (const override of invalidConfigs) {
    await assert.rejects(
      (async () => {
        const verifier = build(override);
        return verifier.verify(await makeValidToken(keys));
      })(),
      (error) => error.code === 'CONFIG_INVALID',
      JSON.stringify(override)
    );
  }
});

test('20. non-wiring regression: the verifier stays isolated from the Product auth boundary', () => {
  const boundarySource = fs.readFileSync(BOUNDARY_PATH, 'utf8');
  assert.ok(!boundarySource.includes('neon-auth-token-verifier'), 'boundary must not import the Neon verifier');

  const helperFiles = fs
    .readdirSync(SHARED_DIR)
    .filter((name) => name.endsWith('-direct-neon.js'))
    .concat(['memory-social-read-core.js']);
  const helperOffenders = helperFiles.filter((name) =>
    fs.readFileSync(path.join(SHARED_DIR, name), 'utf8').includes('neon-auth-token-verifier'));
  assert.deepEqual(helperOffenders, [], 'no Direct-Neon helper may import the Neon verifier');

  const apiOffenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes('neon-auth-token-verifier')) {
        apiOffenders.push(full);
      }
    }
  };
  walk(API_DIR);
  assert.deepEqual(apiOffenders, [], 'no Product route may reference the Neon verifier');
});

test('21. boundary contract still pins FIREBASE_ONLY after the Neon verifier lands', async () => {
  const boundary = await import('../../workers/love-platform-api/authenticated-principal.js');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.currentAcceptedProvider, 'firebase');
  assert.equal(boundary.AUTHENTICATED_PRINCIPAL_CONTRACT.neonTokenAcceptance, false);
  const verifierModule = await loadVerifierModule();
  assert.equal(verifierModule.NEON_AUTH_TOKEN_VERIFIER_CONTRACT.provider, 'neon');
  assert.equal(verifierModule.NEON_AUTH_TOKEN_VERIFIER_CONTRACT.wiredIntoProductBoundary, false);
  assert.equal(verifierModule.NEON_AUTH_TOKEN_VERIFIER_CONTRACT.acceptsEmailAuthority, false);
  assert.equal(verifierModule.NEON_AUTH_TOKEN_VERIFIER_CONTRACT.unknownKidForcedRefreshMax, 1);
});
