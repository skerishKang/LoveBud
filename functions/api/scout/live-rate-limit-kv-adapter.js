/**
 * @fileoverview LoveBud Scout real-KV adapter interface scaffold.
 * @context
 * - Issue #2589: Add disabled real-KV adapter interface scaffold without binding access
 * - Issue #1882: [PRODUCT] Explore LoveBud Scout link-based fan assistant MVP
 * - Relates to #2584 and #2585 activation gates
 * - Relates to #2586 and #2588 schema and TTL policy
 *
 * @description
 * This is a disabled-by-default scaffold for the future real-KV adapter interface seam.
 * It strictly performs NO real KV access, NO bindings, and NO read/write operations.
 * All operations return safe-fail responses.
 */

export const SCOUT_LIVE_RATE_LIMIT_KV_ADAPTER_VERSION = '20260617-interface-scaffold-1';

export const SCOUT_KV_ADAPTER_RESULT_CODES = Object.freeze({
  KV_ADAPTER_DISABLED: 'KV_ADAPTER_DISABLED',
  KV_ADAPTER_NOT_IMPLEMENTED: 'KV_ADAPTER_NOT_IMPLEMENTED',
  KV_ADAPTER_BINDING_UNAVAILABLE: 'KV_ADAPTER_BINDING_UNAVAILABLE',
  KV_ADAPTER_UNTRUSTED_STATE: 'KV_ADAPTER_UNTRUSTED_STATE',
});

function createSafeFailResult(reason = 'Scout real-KV adapter is disabled by default.') {
  return {
    allowed: false,
    released: false,
    code: SCOUT_KV_ADAPTER_RESULT_CODES.KV_ADAPTER_DISABLED,
    reason,
  };
}

export function createScoutLiveRateLimitKvAdapter(options = {}) {
  return {
    readQuotaRecord() {
      return createSafeFailResult('readQuotaRecord is disabled.');
    },
    writeQuotaRecord() {
      return createSafeFailResult('writeQuotaRecord is disabled.');
    },
    deleteQuotaRecord() {
      return createSafeFailResult('deleteQuotaRecord is disabled.');
    },
    buildQuotaKey() {
      return createSafeFailResult('buildQuotaKey is disabled.');
    },
    parseQuotaRecord() {
      return createSafeFailResult('parseQuotaRecord is disabled.');
    },
    validateQuotaRecordFreshness() {
      return createSafeFailResult('validateQuotaRecordFreshness is disabled.');
    }
  };
}
