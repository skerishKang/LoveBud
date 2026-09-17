// #4425 Phase-B Plus/private-storage entitlement boundary candidate.
//
// Firestore remains the source of truth. This adapter deliberately accepts a
// bounded profile reader so the Cloudflare credential/binding can be supplied
// by the owning integration without introducing a second Neon truth source.

import {
  FIREBASE_READ_PRINCIPAL_ERROR,
  FirebaseReadPrincipalError,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const PLUS_ENTITLEMENT_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_PLUS_ENTITLEMENT_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export const PLUS_ENTITLEMENT_FIELDS = Object.freeze([
  'privateStorageEnabled',
  'plan',
  'plus',
  'entitlements.privateStorage'
]);

export const PLUS_ENTITLEMENT_ERROR = Object.freeze({
  REQUIRED: 'PLUS_REQUIRED_PRIVATE_STORAGE',
  UNAVAILABLE: 'PLUS_ENTITLEMENT_UNAVAILABLE'
});

export function isEntitlementTruthy(value) {
  if (value === true) return true;
  if (typeof value === 'number' && value === 1) return true;
  return typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase());
}

export function hasPlusEntitlement(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  if (isEntitlementTruthy(profile.privateStorageEnabled)) return true;
  if (typeof profile.plan === 'string' && ['plus', 'admin'].includes(profile.plan.trim().toLowerCase())) return true;
  if (isEntitlementTruthy(profile.plus)) return true;
  return isEntitlementTruthy(profile.entitlements?.privateStorage);
}

export function isPlusEntitlementDirectNeonSelected(env = {}) {
  return env?.[PLUS_ENTITLEMENT_RUNTIME.GATE_FLAG]?.trim?.() === PLUS_ENTITLEMENT_RUNTIME.DIRECT_NEON_VALUE;
}

function directHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'firestore',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, routeStatus)
  });
}

function isAuthDenial(error) {
  return error instanceof FirebaseReadPrincipalError && [
    FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED,
    FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED,
    FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
  ].includes(error.code);
}

export async function resolvePlusEntitlement({
  request,
  env = {},
  requestId = null,
  verifyTokenOverride = null,
  verifierOptions = null,
  readProfile
} = {}) {
  if (typeof readProfile !== 'function') throw new TypeError('PLUS_ENTITLEMENT_PROFILE_READER_REQUIRED');

  let principal;
  try {
    const verifyToken = verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env),
      ...(verifierOptions && typeof verifierOptions === 'object' ? verifierOptions : {})
    });
    principal = await resolveFirebaseReadPrincipal(request, verifyToken);
  } catch (error) {
    if (isAuthDenial(error)) return Object.freeze({ entitled: false, reason: 'unauthorized' });
    return Object.freeze({ entitled: false, reason: 'unavailable' });
  }

  try {
    const profile = await readProfile(principal.providerSubject);
    return Object.freeze({ entitled: hasPlusEntitlement(profile), reason: 'profile' });
  } catch {
    return Object.freeze({ entitled: false, reason: 'unavailable' });
  }
}

export async function handlePlusEntitlementDirectNeon(
  request,
  env = {},
  requestId = null,
  options = {}
) {
  if (!isPlusEntitlementDirectNeonSelected(env)) return null;
  const result = await resolvePlusEntitlement({ ...options, request, env, requestId });
  if (result.reason === 'unavailable') {
    return jsonResponse({ error: { code: PLUS_ENTITLEMENT_ERROR.UNAVAILABLE, message: 'Entitlement unavailable' } }, 503, requestId, 'entitlement-unavailable');
  }
  return jsonResponse({ entitled: result.entitled }, 200, requestId, 'entitlement-complete');
}

export const PLUS_ENTITLEMENT_DIRECT_NEON_CONTRACT = Object.freeze({
  sourceOfTruth: 'firestore.users/{uid}',
  principal: 'verified-firebase-uid',
  fields: PLUS_ENTITLEMENT_FIELDS,
  gate: PLUS_ENTITLEMENT_RUNTIME.GATE_FLAG,
  directValue: PLUS_ENTITLEMENT_RUNTIME.DIRECT_NEON_VALUE,
  responseFields: Object.freeze(['entitled']),
  cache: 'no-store',
  productionCutover: false
});
