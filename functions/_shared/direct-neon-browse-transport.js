// Worker-compatible direct-Neon read transport adapter for the #4003 Browse
// summary prototype.
//
// This module is the *transport* layer only. The Browse query authority (sort
// normalization, limit clamp, public-only filtering, representative-media
// selection, capability fallback, parameterized SQL, response normalization)
// lives in `./direct-neon-browse-summary-core.js` and is reused verbatim so the
// direct-Neon path cannot drift from the canonical modern Browse semantics.
//
// Design constraints (issue #4003):
//   - No network / env / secret / route access on import.
//   - The Neon driver is imported lazily so this module loads (and is unit
//     tested) in environments where the package is not installed, and so the
//     Production path never imports the driver unless the experimental seam is
//     explicitly active.
//   - Never reads the Production canonical secret (DATABASE_URL) or the Modal
//     secret. The experimental secret name is dedicated and Preview-only.
//   - Never logs secrets, connection strings, Tree/Memory IDs, or row bodies.
//   - Fails closed when configuration is absent.

import {
  fetchDirectNeonBrowseSummary,
} from './direct-neon-browse-summary-core.js';

const NEON_CONNECTION_STRING_PATTERN = /^postgres(?:ql)?:\/\//i;
const NEON_HOST_PATTERN = /\.neon\.tech($|\/)/i;

// The dedicated, Preview-only experimental secret name. This is intentionally
// distinct from the Production canonical `DATABASE_URL` and from any Modal
// secret. It must only be bound in the Preview/experimental Cloudflare context.
export const DIRECT_NEON_BROWSE_CONNECTION_SECRET = 'DIRECT_NEON_BROWSE_DATABASE_URL';

// Explicit opt-in gate. Must be set to exactly 'true'. In Production this is
// never set, so the experimental seam is unreachable from normal traffic.
export const DIRECT_NEON_BROWSE_ENABLED_FLAG = 'LB_EXPERIMENTAL_DIRECT_NEON_BROWSE';

export function isNeonConnectionString(value) {
  if (typeof value !== 'string' || !value) return false;
  if (!NEON_CONNECTION_STRING_PATTERN.test(value)) return false;
  try {
    const url = new URL(value);
    return NEON_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

// Resolve the experimental direct-Neon Browse configuration from the Worker env.
// Reads ONLY the dedicated experimental secret. Returns a frozen descriptor so
// callers cannot accidentally mutate it. `configured` is true only when the gate
// is enabled AND the secret is a recognizable Neon serverless URL.
export function readDirectNeonBrowseConfig(env = {}) {
  const rawSecret = env && typeof env[DIRECT_NEON_BROWSE_CONNECTION_SECRET] === 'string'
    ? env[DIRECT_NEON_BROWSE_CONNECTION_SECRET]
    : '';
  const enabled = env && env[DIRECT_NEON_BROWSE_ENABLED_FLAG] === 'true';
  return Object.freeze({
    enabled,
    configured: enabled && isNeonConnectionString(rawSecret),
    connectionString: rawSecret || '',
  });
}

// Build a Neon serverless HTTP executor from a connection string.
//
// `neon()`'s returned query function uses the HTTP fetch transport by default
// (no WebSocket pool), which is Worker-compatible. The driver is imported
// lazily. The executor maps our `(text, values)` contract onto the driver's
// `(queryWithPlaceholders, params)` contract and returns an array of rows.
export async function createDirectNeonBrowseExecutor({ connectionString, neonOptions } = {}) {
  if (!isNeonConnectionString(connectionString)) {
    throw new TypeError('DIRECT_NEON_BROWSE_CONFIG_INVALID: connectionString is not a Neon serverless URL');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {}),
  });
  return async function directNeonBrowseExecutor(text, values) {
    const rows = await sql(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

// Full prototype read path: capability-aware Browse summary over direct Neon.
//
// Accepts either:
//   - { executor }          -> injected executor (tests / alternative transport)
//   - { connectionString }  -> real Neon serverless HTTP transport (built lazily)
//
// This function performs no env/secret access; configuration resolution is the
// responsibility of the route layer. `capabilities` may be supplied to skip the
// capability auto-detection query when known.
export async function fetchBrowseSummaryViaDirectNeon(options = {}) {
  const { executor, connectionString, sort, limit, capabilities, neonOptions } = options;
  let resolvedExecutor = executor;
  if (!resolvedExecutor) {
    if (!connectionString) {
      throw new TypeError('DIRECT_NEON_BROWSE_CONFIG_INVALID: provide executor or connectionString');
    }
    resolvedExecutor = await createDirectNeonBrowseExecutor({ connectionString, neonOptions });
  }
  return fetchDirectNeonBrowseSummary(resolvedExecutor, { sort, limit, capabilities });
}

export { fetchDirectNeonBrowseSummary };
