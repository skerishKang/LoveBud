import { createRequestContext } from './core.js';
import { REQUEST_ID_HEADER } from '../../functions/_shared/request-id.js';

export const FIREBASE_READ_PRINCIPAL_ERROR = Object.freeze({
  AUTHORIZATION_REQUIRED: 'AUTHORIZATION_REQUIRED',
  AUTHORIZATION_MALFORMED: 'AUTHORIZATION_MALFORMED',
  VERIFICATION_FAILED: 'FIREBASE_VERIFICATION_FAILED',
  VERIFIER_UNAVAILABLE: 'FIREBASE_VERIFIER_UNAVAILABLE'
});

const ERROR_CONTRACT = Object.freeze({
  [FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED]: Object.freeze({
    status: 401,
    message: 'Authentication required'
  }),
  [FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED]: Object.freeze({
    status: 401,
    message: 'Invalid authorization header'
  }),
  [FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED]: Object.freeze({
    status: 401,
    message: 'Invalid Firebase ID token'
  }),
  [FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE]: Object.freeze({
    status: 503,
    message: 'Authentication verifier unavailable'
  })
});

export class FirebaseReadPrincipalError extends Error {
  constructor(code) {
    const safeCode = Object.hasOwn(ERROR_CONTRACT, code)
      ? code
      : FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE;
    super(ERROR_CONTRACT[safeCode].message);
    this.name = 'FirebaseReadPrincipalError';
    this.code = safeCode;
  }
}

function readBearerToken(request) {
  if (!(request instanceof Request)) {
    throw new TypeError('Firebase read principal requires a Request');
  }

  const authorization = request.headers.get('authorization');
  if (authorization === null) {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED
    );
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match) {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED
    );
  }

  return match[1];
}

function readVerifiedUid(verifiedIdentity) {
  if (!verifiedIdentity || typeof verifiedIdentity !== 'object') {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
    );
  }

  const uid = verifiedIdentity.uid;
  if (typeof uid !== 'string' || uid.length === 0 || uid !== uid.trim()) {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
    );
  }

  return uid;
}

export async function resolveFirebaseReadPrincipal(request, verifyToken) {
  if (typeof verifyToken !== 'function') {
    throw new TypeError('Firebase read principal requires a verifyToken function');
  }

  const token = readBearerToken(request);
  let verifiedIdentity;

  try {
    verifiedIdentity = await verifyToken(token);
  } catch {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE
    );
  }

  const uid = readVerifiedUid(verifiedIdentity);
  return Object.freeze({
    provider: 'firebase',
    providerSubject: uid,
    legacyOwnerId: uid
  });
}

export function createFirebaseReadPrincipalResolver(verifyToken) {
  if (typeof verifyToken !== 'function') {
    throw new TypeError('Firebase read principal requires a verifyToken function');
  }

  return async function firebaseReadPrincipalResolver(request) {
    return resolveFirebaseReadPrincipal(request, verifyToken);
  };
}

export function buildFirebaseReadPrincipalErrorResponse(error, request) {
  const context = createRequestContext(request);
  const code = error instanceof FirebaseReadPrincipalError && Object.hasOwn(ERROR_CONTRACT, error.code)
    ? error.code
    : FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE;
  const contract = ERROR_CONTRACT[code];

  return new Response(JSON.stringify({
    error: {
      code,
      message: contract.message
    }
  }), {
    status: contract.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [REQUEST_ID_HEADER]: context.requestId,
      'Access-Control-Expose-Headers': REQUEST_ID_HEADER
    }
  });
}

export const FIREBASE_READ_PRINCIPAL_CONTRACT = Object.freeze({
  provider: 'firebase',
  outputFields: Object.freeze([
    'provider',
    'providerSubject',
    'legacyOwnerId'
  ]),
  ownerAuthority: 'verified-firebase-uid',
  acceptsEmailAuthority: false,
  acceptsCallerUidAuthority: false,
  acceptsMultipleIssuers: false
});
