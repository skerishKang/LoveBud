// Non-wired Neon lookup transport for stable account resolution
// (#4569 / #4006 / #4004; data provenance #4005).
//
// Source-only DB transport: verified { provider, providerSubject } ->
// normalized identity row / null for the R1 compatibility resolver
// (authenticated-account-resolution.js). This module is NOT wired into the
// Product auth path or the resolver; tests compose the two with fake
// executors only. No live DB access happens from repository tests.
//
// Read credential authority: LOVE_PLATFORM_DATABASE_URL only. Writer/generic
// credentials are never a fallback authority.

const POSTGRES_URL = /^postgres(?:ql)?:///i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

const SUPPORTED_PROVIDERS = Object.freeze(['firebase', 'neon']);

export const AUTHENTICATED_ACCOUNT_NEON_LOOKUP_DATABASE_ENV = 'LOVE_PLATFORM_DATABASE_URL';

export const AUTHENTICATED_ACCOUNT_NEON_LOOKUP_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_WRITE_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export const AUTHENTICATED_ACCOUNT_NEON_LOOKUP_ERROR = Object.freeze({
  CONFIG_INVALID: 'CONFIG_INVALID',
  QUERY_UNAVAILABLE: 'QUERY_UNAVAILABLE',
  QUERY_INVALID_RESULT: 'QUERY_INVALID_RESULT',
  QUERY_AMBIGUOUS_RESULT: 'QUERY_AMBIGUOUS_RESULT'
});

// Static, parameterized, SELECT-only lookup. Base tables are read directly
// (not the active-only app_authenticated_owner_resolution view) so revoked /
// disabled / merged states stay distinguishable for the R1 policy.
export const AUTHENTICATED_ACCOUNT_NEON_LOOKUP_SQL = `
SELECT
  i.status AS identity_status,
  i.account_id::text AS account_id,
  a.status AS account_status,
  u.id::text AS legacy_owner_id
FROM public.app_auth_identity i
LEFT JOIN public.app_account a
  ON a.id = i.account_id
LEFT JOIN public.users u
  ON u.account_id = i.account_id
WHERE i.provider = $1
  AND i.provider_subject = $2
ORDER BY i.identity_id
LIMIT 2;
`;

export const AUTHENTICATED_ACCOUNT_NEON_LOOKUP_CONTRACT = Object.freeze({
  databaseEnvAuthority: AUTHENTICATED_ACCOUNT_NEON_LOOKUP_DATABASE_ENV,
  forbiddenFallbackEnvs: AUTHENTICATED_ACCOUNT_NEON_LOOKUP_FORBIDDEN_FALLBACK_ENVS,
  supportedProviders: SUPPORTED_PROVIDERS,
  queryLimit: 2,
  executorCallMaxPerLookup: 1,
  normalizedFields: Object.freeze(['identityStatus', 'accountId', 'accountStatus', 'legacyOwnerId']),
  acceptsEmailAuthority: false,
  wiredIntoProduct: false,
  wiredIntoResolver: false
});

export class AuthenticatedAccountNeonLookupError extends Error {
  constructor(code) {
    const safeCode = Object.values(AUTHENTICATED_ACCOUNT_NEON_LOOKUP_ERROR).includes(code)
      ? code
      : AUTHENTICATED_ACCOUNT_NEON_LOOKUP_ERROR.QUERY_UNAVAILABLE;
    super(safeCode);
    this.name = 'AuthenticatedAccountNeonLookupError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new AuthenticatedAccountNeonLookupError(code);
}

export function isNeonReadDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function readAuthenticatedAccountNeonLookupConfig(env) {
  const source = env && typeof env === 'object' ? env : {};
  const raw = source[AUTHENTICATED_ACCOUNT_NEON_LOOKUP_DATABASE_ENV];
  const connectionString = typeof raw === 'string' ? raw.trim() : '';
  const configured = isNeonReadDatabaseUrl(connectionString);
  return Object.freeze({
    configured,
    connectionString: configured ? connectionString : ''
  });
}

export async function createAuthenticatedAccountNeonLookupExecutor({ connectionString, neonOptions } = {}) {
  if (!isNeonReadDatabaseUrl(connectionString)) {
    fail('CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {})
  });
  return async function authenticatedAccountNeonLookupExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

function isValidLookupIdentity(identity) {
  if (!identity || typeof identity !== 'object') return false;
  if (!SUPPORTED_PROVIDERS.includes(identity.provider)) return false;
  const subject = identity.providerSubject;
  return typeof subject === 'string' && subject.length > 0 && subject === subject.trim();
}

function isNonEmptyTrimmedString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function normalizeLookupRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    fail('QUERY_INVALID_RESULT');
  }
  const identityStatus = row.identity_status;
  if (identityStatus !== 'active' && identityStatus !== 'revoked') {
    fail('QUERY_INVALID_RESULT');
  }
  // Identifiers must already be non-empty trimmed strings; malformed values
  // are rejected as-invalid, never trimmed or coerced into authority.
  if (!isNonEmptyTrimmedString(row.account_id)) {
    fail('QUERY_INVALID_RESULT');
  }
  const accountStatus = row.account_status;
  if (accountStatus !== 'active' && accountStatus !== 'disabled' && accountStatus !== 'merged') {
    fail('QUERY_INVALID_RESULT');
  }
  // Explicit SQL NULL is the valid no-legacy-owner projection. An undefined
  // value or an absent column shape is malformed and fails closed; it is never
  // coerced or defaulted to null.
  const legacyOwnerId = row.legacy_owner_id;
  if (legacyOwnerId !== null && !isNonEmptyTrimmedString(legacyOwnerId)) {
    fail('QUERY_INVALID_RESULT');
  }
  return Object.freeze({
    identityStatus,
    accountId: row.account_id,
    accountStatus,
    legacyOwnerId
  });
}

// Returns the lookupIdentity function for createAuthenticatedAccountResolver.
// Invalid provider/subject input fails closed (null) without reaching the
// executor; every valid lookup performs at most one executor call.
export function createAuthenticatedAccountNeonLookup({ executor } = {}) {
  if (typeof executor !== 'function') {
    fail('CONFIG_INVALID');
  }
  return async function authenticatedAccountNeonLookup(identity) {
    if (!isValidLookupIdentity(identity)) return null;

    let rows;
    try {
      rows = await executor(
        AUTHENTICATED_ACCOUNT_NEON_LOOKUP_SQL,
        [identity.provider, identity.providerSubject]
      );
    } catch {
      fail('QUERY_UNAVAILABLE');
    }
    if (!Array.isArray(rows)) {
      fail('QUERY_INVALID_RESULT');
    }
    if (rows.length === 0) return null;
    if (rows.length > 1) {
      // Ambiguous mapping is never resolved by taking the first row.
      fail('QUERY_AMBIGUOUS_RESULT');
    }
    return normalizeLookupRow(rows[0]);
  };
}