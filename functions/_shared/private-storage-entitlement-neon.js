// #4425 Neon-native private-storage entitlement boundary.
//
// Firebase verifies the principal, but entitlement truth lives in Neon.
// During the current compatibility phase public.users.id is the verified
// Firebase UID / legacyOwnerId projection. This helper is transaction-scoped:
// callers pass an already-open Direct-Neon transaction and the verified owner.
//
// No Firestore access, service account, provider call, cache, or network client
// is introduced here. Missing rows and false values are not entitled. Query
// failures remain availability failures and must never be collapsed into a
// misleading "free user" result by callers.

export const PRIVATE_STORAGE_ENTITLEMENT_ERROR = Object.freeze({
  REQUIRED: 'PLUS_REQUIRED_PRIVATE_STORAGE',
  UNAVAILABLE: 'PRIVATE_STORAGE_ENTITLEMENT_UNAVAILABLE',
  PRINCIPAL_INVALID: 'PRIVATE_STORAGE_ENTITLEMENT_PRINCIPAL_INVALID'
});

export const PRIVATE_STORAGE_ENTITLEMENT_SQL = `
SELECT private_storage_enabled
FROM public.users
WHERE id = $1
LIMIT 1
FOR SHARE;
`;

export class PrivateStorageEntitlementError extends Error {
  constructor(code) {
    const safeCode = Object.values(PRIVATE_STORAGE_ENTITLEMENT_ERROR).includes(code)
      ? code
      : PRIVATE_STORAGE_ENTITLEMENT_ERROR.UNAVAILABLE;
    super(safeCode);
    this.name = 'PrivateStorageEntitlementError';
    this.code = safeCode;
  }
}

function normalizeVerifiedOwnerId(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId || ownerId !== ownerId.trim()) {
    throw new PrivateStorageEntitlementError(
      PRIVATE_STORAGE_ENTITLEMENT_ERROR.PRINCIPAL_INVALID
    );
  }
  return ownerId;
}

export async function readPrivateStorageEntitlement(tx, verifiedOwnerId) {
  const ownerId = normalizeVerifiedOwnerId(verifiedOwnerId);
  if (!tx || typeof tx.query !== 'function') {
    throw new PrivateStorageEntitlementError(
      PRIVATE_STORAGE_ENTITLEMENT_ERROR.UNAVAILABLE
    );
  }

  let rows;
  try {
    rows = await tx.query(PRIVATE_STORAGE_ENTITLEMENT_SQL, [ownerId]);
  } catch {
    throw new PrivateStorageEntitlementError(
      PRIVATE_STORAGE_ENTITLEMENT_ERROR.UNAVAILABLE
    );
  }

  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  return Object.freeze({
    entitled: row?.private_storage_enabled === true,
    reason: row ? 'neon-users' : 'missing-user'
  });
}

export async function requirePrivateStorageEntitlement(tx, verifiedOwnerId) {
  const result = await readPrivateStorageEntitlement(tx, verifiedOwnerId);
  if (!result.entitled) {
    throw new PrivateStorageEntitlementError(
      PRIVATE_STORAGE_ENTITLEMENT_ERROR.REQUIRED
    );
  }
  return result;
}

export const PRIVATE_STORAGE_ENTITLEMENT_NEON_CONTRACT = Object.freeze({
  sourceOfTruth: 'neon.public.users.private_storage_enabled',
  principalKey: 'verified-firebase-legacyOwnerId',
  defaultEntitled: false,
  truthRule: 'strict-boolean-true',
  transactionScoped: true,
  rowLock: 'FOR SHARE',
  firestoreRequired: false,
  serviceAccountRequired: false,
  cache: 'none',
  productionCutover: false
});
