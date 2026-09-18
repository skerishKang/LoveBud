// #4425 source-only Cloudflare Firestore profile reader.
//
// This adapter reads exactly one users/{verifiedUid} document using the
// request-scoped Firebase ID token. Firestore remains the canonical entitlement
// source of truth. Firebase-ID-token REST requests are authorized by Firestore
// Security Rules; no service-account/IAM bypass is introduced here.
//
// This file does not wire any Product route, check in a Production gate, mutate
// Firestore Rules, or add/bind provider credentials. Current live Rules access
// must be proven separately before Product integration.

import { readFirebaseProjectId } from './firebase-id-token-verifier.js';

const FIRESTORE_API_ORIGIN = 'https://firestore.googleapis.com';
const FIRESTORE_DATABASE_ID = '(default)';
const DEFAULT_TIMEOUT_MS = 2500;
const MAX_TIMEOUT_MS = 5000;

export const FIRESTORE_USER_PROFILE_FIELDS = Object.freeze([
  'privateStorageEnabled',
  'plan',
  'plus',
  'entitlements.privateStorage'
]);

export const FIRESTORE_USER_PROFILE_ERROR = Object.freeze({
  REQUEST_INVALID: 'FIRESTORE_USER_PROFILE_REQUEST_INVALID',
  CONFIG_INVALID: 'FIRESTORE_USER_PROFILE_CONFIG_INVALID',
  PROVIDER_UNAVAILABLE: 'FIRESTORE_USER_PROFILE_PROVIDER_UNAVAILABLE',
  RESPONSE_INVALID: 'FIRESTORE_USER_PROFILE_RESPONSE_INVALID'
});

const ERROR_MESSAGES = Object.freeze({
  [FIRESTORE_USER_PROFILE_ERROR.REQUEST_INVALID]: 'Firestore profile request invalid',
  [FIRESTORE_USER_PROFILE_ERROR.CONFIG_INVALID]: 'Firestore profile config invalid',
  [FIRESTORE_USER_PROFILE_ERROR.PROVIDER_UNAVAILABLE]: 'Firestore profile provider unavailable',
  [FIRESTORE_USER_PROFILE_ERROR.RESPONSE_INVALID]: 'Firestore profile response invalid'
});

export class FirestoreUserProfileReadError extends Error {
  constructor(code) {
    const safeCode = Object.hasOwn(ERROR_MESSAGES, code)
      ? code
      : FIRESTORE_USER_PROFILE_ERROR.PROVIDER_UNAVAILABLE;
    super(ERROR_MESSAGES[safeCode]);
    this.name = 'FirestoreUserProfileReadError';
    this.code = safeCode;
  }
}

function readBearerToken(request) {
  if (!(request instanceof Request)) {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.REQUEST_INVALID);
  }
  const authorization = request.headers.get('authorization');
  const match = typeof authorization === 'string'
    ? /^Bearer ([^\s]+)$/.exec(authorization)
    : null;
  if (!match) {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.REQUEST_INVALID);
  }
  return match[1];
}

function normalizeVerifiedUid(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.REQUEST_INVALID);
  }
  return value;
}

function normalizeTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(parsed), MAX_TIMEOUT_MS);
}

export function buildFirestoreUserProfileUrl(projectId, verifiedUid) {
  if (typeof projectId !== 'string' || !projectId.trim()) {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.CONFIG_INVALID);
  }
  const uid = normalizeVerifiedUid(verifiedUid);
  const base = new URL(
    `/v1/projects/${encodeURIComponent(projectId.trim())}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/users/${encodeURIComponent(uid)}`,
    FIRESTORE_API_ORIGIN
  );
  for (const fieldPath of FIRESTORE_USER_PROFILE_FIELDS) {
    base.searchParams.append('mask.fieldPaths', fieldPath);
  }
  return base;
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (Object.hasOwn(value, 'booleanValue')) {
    return value.booleanValue === true;
  }
  if (Object.hasOwn(value, 'stringValue')) {
    return typeof value.stringValue === 'string' ? value.stringValue : undefined;
  }
  if (Object.hasOwn(value, 'integerValue')) {
    return typeof value.integerValue === 'string' || typeof value.integerValue === 'number'
      ? value.integerValue
      : undefined;
  }
  if (Object.hasOwn(value, 'doubleValue')) {
    return typeof value.doubleValue === 'number' ? value.doubleValue : undefined;
  }
  if (Object.hasOwn(value, 'nullValue')) {
    return null;
  }
  if (Object.hasOwn(value, 'mapValue')) {
    const fields = value.mapValue?.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
    const out = {};
    for (const [key, entry] of Object.entries(fields)) {
      const decoded = decodeFirestoreValue(entry);
      if (decoded !== undefined) out[key] = decoded;
    }
    return out;
  }
  return undefined;
}

export function projectFirestoreEntitlementProfile(documentPayload) {
  if (!documentPayload || typeof documentPayload !== 'object' || Array.isArray(documentPayload)) {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.RESPONSE_INVALID);
  }
  const fields = documentPayload.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};

  const profile = {};
  for (const fieldName of ['privateStorageEnabled', 'plan', 'plus']) {
    if (!Object.hasOwn(fields, fieldName)) continue;
    const decoded = decodeFirestoreValue(fields[fieldName]);
    if (decoded !== undefined) profile[fieldName] = decoded;
  }

  if (Object.hasOwn(fields, 'entitlements')) {
    const decoded = decodeFirestoreValue(fields.entitlements);
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)
        && Object.hasOwn(decoded, 'privateStorage')) {
      profile.entitlements = { privateStorage: decoded.privateStorage };
    }
  }
  return profile;
}

async function fetchBounded({
  fetchImpl,
  url,
  token,
  timeoutMs,
  setTimeoutImpl,
  clearTimeoutImpl
}) {
  const controller = new AbortController();
  const timer = setTimeoutImpl(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });
  } catch {
    throw new FirestoreUserProfileReadError(
      FIRESTORE_USER_PROFILE_ERROR.PROVIDER_UNAVAILABLE
    );
  } finally {
    clearTimeoutImpl(timer);
  }
}

export function createFirestoreUserProfileReader({
  request,
  env = {},
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout
} = {}) {
  if (typeof fetchImpl !== 'function'
      || typeof setTimeoutImpl !== 'function'
      || typeof clearTimeoutImpl !== 'function') {
    throw new FirestoreUserProfileReadError(FIRESTORE_USER_PROFILE_ERROR.CONFIG_INVALID);
  }

  const projectId = readFirebaseProjectId(env);
  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);

  return async function readFirestoreUserProfile(verifiedUid) {
    // Deliberately defer token extraction until invocation. #4425 calls the
    // reader only after the same request's Firebase principal was verified.
    const token = readBearerToken(request);
    const url = buildFirestoreUserProfileUrl(projectId, verifiedUid);
    const response = await fetchBounded({
      fetchImpl,
      url,
      token,
      timeoutMs: safeTimeoutMs,
      setTimeoutImpl,
      clearTimeoutImpl
    });

    if (response?.status === 404) return {};
    if (!response?.ok) {
      throw new FirestoreUserProfileReadError(
        FIRESTORE_USER_PROFILE_ERROR.PROVIDER_UNAVAILABLE
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new FirestoreUserProfileReadError(
        FIRESTORE_USER_PROFILE_ERROR.RESPONSE_INVALID
      );
    }
    return projectFirestoreEntitlementProfile(payload);
  };
}

export const FIRESTORE_USER_PROFILE_READER_CONTRACT = Object.freeze({
  auth: 'request-scoped-firebase-id-token',
  authorization: 'firestore-security-rules',
  sourceOfTruth: 'firestore.users/{verifiedUid}',
  requestShape: 'single-document-get',
  fieldMask: FIRESTORE_USER_PROFILE_FIELDS,
  missingDocument: 'empty-profile',
  cache: 'none',
  serviceAccountRequired: false,
  productionCutover: false
});
