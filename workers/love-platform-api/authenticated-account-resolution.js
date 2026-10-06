// Non-wired stable-account compatibility resolver (#4567 / #4006 / #4004).
//
// Production-source form of the #4006 R1 account-resolution policy documented
// in docs/architecture/AUTH_THREE_LAYER_MAPPING_CONTRACT_4006.md: verified
// { provider, providerSubject } -> stable app_account -> legacy owner
// compatibility projection -> ALLOW / HOLD / DENY.
//
// This module is intentionally NOT wired into the Product auth path. It
// performs no DB/network work itself; the identity lookup is an injected
// dependency and no email field is ever an authority or a lookup key.

const SUPPORTED_PROVIDERS = Object.freeze(['firebase', 'neon']);
const IDENTITY_STATUSES = Object.freeze(['active', 'revoked']);
const ACCOUNT_STATUSES = Object.freeze(['active', 'disabled', 'merged']);
const HOLD_NEW_NEON_ONLY_PRODUCT_WRITES = 'HOLD_NEW_NEON_ONLY_PRODUCT_WRITES';

export const AUTHENTICATED_ACCOUNT_RESOLUTION_ERROR = Object.freeze({
  CONFIG_INVALID: 'CONFIG_INVALID',
  LOOKUP_UNAVAILABLE: 'LOOKUP_UNAVAILABLE',
  LOOKUP_INVALID_RESULT: 'LOOKUP_INVALID_RESULT'
});

export const AUTHENTICATED_ACCOUNT_RESOLUTION_CONTRACT = Object.freeze({
  supportedProviders: SUPPORTED_PROVIDERS,
  decisions: Object.freeze(['ALLOW', 'DENY', 'HOLD']),
  denyReasons: Object.freeze([
    'IDENTITY_UNKNOWN',
    'IDENTITY_REVOKED',
    'ACCOUNT_DISABLED',
    'ACCOUNT_MERGED_WITHOUT_POLICY',
    'AMBIGUOUS_OWNER_PROJECTION'
  ]),
  holdReasons: Object.freeze([HOLD_NEW_NEON_ONLY_PRODUCT_WRITES]),
  allowFields: Object.freeze(['decision', 'accountId', 'legacyOwnerId']),
  denyHoldFields: Object.freeze(['decision', 'reason']),
  lookupCallMaxPerResolution: 1,
  acceptsEmailAuthority: false,
  wiredIntoProductBoundary: false,
  wiredIntoRoutes: false
});

export class AuthenticatedAccountResolutionError extends Error {
  constructor(code) {
    const safeCode = Object.values(AUTHENTICATED_ACCOUNT_RESOLUTION_ERROR).includes(code)
      ? code
      : AUTHENTICATED_ACCOUNT_RESOLUTION_ERROR.LOOKUP_UNAVAILABLE;
    super(safeCode);
    this.name = 'AuthenticatedAccountResolutionError';
    this.code = safeCode;
  }
}

function deny(reason) {
  return Object.freeze({ decision: 'DENY', reason });
}

function isValidSubject(subject) {
  return typeof subject === 'string' && subject.length > 0 && subject === subject.trim();
}

function isValidNormalizedRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  if (!IDENTITY_STATUSES.includes(row.identityStatus)) return false;
  // Identifiers must already be non-empty trimmed strings; malformed values
  // are rejected as-invalid, never trimmed or coerced into authority.
  if (typeof row.accountId !== 'string' || row.accountId.length === 0
    || row.accountId !== row.accountId.trim()) {
    return false;
  }
  if (!ACCOUNT_STATUSES.includes(row.accountStatus)) return false;
  const legacyOwnerId = row.legacyOwnerId === undefined ? null : row.legacyOwnerId;
  if (legacyOwnerId !== null && (typeof legacyOwnerId !== 'string' || legacyOwnerId.length === 0
    || legacyOwnerId !== legacyOwnerId.trim())) {
    return false;
  }
  return true;
}

export function createAuthenticatedAccountResolver(dependencies = null) {
  const lookupIdentity = dependencies && typeof dependencies === 'object'
    ? dependencies.lookupIdentity
    : undefined;
  if (typeof lookupIdentity !== 'function') {
    throw new AuthenticatedAccountResolutionError('CONFIG_INVALID');
  }

  return Object.freeze({
    async resolve(input) {
      // Only verified provider identity material is read; every other caller
      // field (email, caller-supplied ids, headers) is ignored entirely.
      const provider = input && typeof input === 'object' ? input.provider : undefined;
      const providerSubject = input && typeof input === 'object' ? input.providerSubject : undefined;
      if (!SUPPORTED_PROVIDERS.includes(provider)) return deny('IDENTITY_UNKNOWN');
      if (!isValidSubject(providerSubject)) return deny('IDENTITY_UNKNOWN');

      const lookupKey = Object.freeze({ provider, providerSubject });
      let row;
      try {
        row = await lookupIdentity(lookupKey);
      } catch {
        throw new AuthenticatedAccountResolutionError('LOOKUP_UNAVAILABLE');
      }
      if (row === null || row === undefined) return deny('IDENTITY_UNKNOWN');
      if (!isValidNormalizedRow(row)) {
        throw new AuthenticatedAccountResolutionError('LOOKUP_INVALID_RESULT');
      }

      if (row.identityStatus !== 'active') return deny('IDENTITY_REVOKED');
      if (row.accountStatus === 'disabled') return deny('ACCOUNT_DISABLED');
      if (row.accountStatus === 'merged') return deny('ACCOUNT_MERGED_WITHOUT_POLICY');

      const legacyOwnerId = row.legacyOwnerId === undefined ? null : row.legacyOwnerId;
      if (legacyOwnerId === null) {
        if (provider === 'firebase') return deny('AMBIGUOUS_OWNER_PROJECTION');
        return Object.freeze({ decision: 'HOLD', reason: HOLD_NEW_NEON_ONLY_PRODUCT_WRITES });
      }

      return Object.freeze({
        decision: 'ALLOW',
        accountId: row.accountId,
        legacyOwnerId
      });
    }
  });
}