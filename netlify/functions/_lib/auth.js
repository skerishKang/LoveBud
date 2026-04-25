/**
 * LoveBud - Firebase Authentication Middleware
 *
 * Based on: 133-relovetree/netlify/functions/_lib/firebase-auth.js
 *
 * Verifies Firebase ID tokens from Authorization: Bearer <token> header.
 * Each protected Netlify Function should call requireUser(event) first.
 */
const admin = require('firebase-admin');
const { httpError } = require('./http');

// Plus entitlement error response
const PLUS_REQUIRED_ERROR = {
  error: 'Private storage requires Plus.',
  code: 'PLUS_REQUIRED_PRIVATE_STORAGE',
  upgradeRequired: true
};

function getAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    const err = new Error(
      'Missing Firebase service account: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT'
    );
    err.status = 503;
    console.error('[auth] Firebase service account env missing. Set FIREBASE_SERVICE_ACCOUNT_JSON in Netlify env.');
    throw err;
  }

  try {
    console.log('[auth] Parsing Firebase service account JSON...');
    const serviceAccount = JSON.parse(raw);
    console.log('[auth] Initializing Firebase Admin for project:', serviceAccount.project_id);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (parseError) {
    const err = new Error(
      'Invalid Firebase service account JSON: ' + parseError.message
    );
    err.status = 503;
    console.error('[auth] CRITICAL: Firebase Admin init failed:', parseError.message, parseError.stack);
    throw err;
  }

  return admin;
}

function extractBearerToken(event) {
  const headers = event && event.headers ? event.headers : {};
  const authHeader = headers.authorization || headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

/**
 * Verify Firebase ID token and return user object.
 * Returns null if no token provided (for optional auth).
 * @returns {Promise<{uid, email, decoded}|null>}
 */
async function getUserFromEvent(event) {
  const token = extractBearerToken(event);
  if (!token) return null;

  try {
    const adminInstance = getAdmin();
    const decoded = await adminInstance.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      decoded,
    };
  } catch (error) {
    throw httpError(401, 'Invalid ID token');
  }
}

/**
 * Require authenticated user. Throws 401 if not authenticated.
 * @returns {Promise<{uid, email, decoded}>}
 */
async function requireUser(event) {
  const user = await getUserFromEvent(event);
  if (!user) throw httpError(401, 'Authentication required');
  return user;
}

/**
 * Check if user has Plus private storage entitlement
 * Canonical: users/{uid}.privateStorageEnabled === true
 * Tolerant: plan: "plus"/"admin", plus: true, entitlements.privateStorage: true
 * Fail-closed: missing/null/false/"false"/0/"0"/unknown/unreadable = non-Plus
 * @param {string} uid - User ID
 * @returns {Promise<boolean>}
 */
async function hasPlusEntitlement(uid) {
  if (!uid) return false;

  try {
    const adminInstance = getAdmin();
    const db = adminInstance.firestore();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.log(`[auth] User profile not found: ${uid}`);
      return false;
    }

    const data = userDoc.data();
    if (!data) {
      console.log(`[auth] User profile empty: ${uid}`);
      return false;
    }

    // Canonical field check
    if (data.privateStorageEnabled === true) {
      console.log(`[auth] Plus entitlement confirmed (canonical): ${uid}`);
      return true;
    }

    // Tolerant reads
    const plan = typeof data.plan === 'string' ? data.plan.toLowerCase() : '';
    if (plan === 'plus' || plan === 'admin') {
      console.log(`[auth] Plus entitlement confirmed (plan): ${uid}`);
      return true;
    }

    if (data.plus === true || data.plus === 'true' || data.plus === 1 || data.plus === '1') {
      console.log(`[auth] Plus entitlement confirmed (plus field): ${uid}`);
      return true;
    }

    if (data.entitlements?.privateStorage === true ||
        data.entitlements?.privateStorage === 'true' ||
        data.entitlements?.privateStorage === 1 ||
        data.entitlements?.privateStorage === '1') {
      console.log(`[auth] Plus entitlement confirmed (entitlements): ${uid}`);
      return true;
    }

    // Explicit non-Plus indicators
    if (data.privateStorageEnabled === false ||
        data.privateStorageEnabled === 'false' ||
        data.privateStorageEnabled === 0 ||
        data.privateStorageEnabled === '0') {
      console.log(`[auth] Plus entitlement denied (explicit false): ${uid}`);
      return false;
    }

    console.log(`[auth] Plus entitlement denied (default): ${uid}`);
    return false;
  } catch (error) {
    console.error(`[auth] Plus entitlement check failed for ${uid}:`, error.message);
    // Fail-closed: any error = non-Plus
    return false;
  }
}

/**
 * Require Plus entitlement for private storage operations
 * Throws 403 with PLUS_REQUIRED_PRIVATE_STORAGE if not entitled
 * @param {string} uid - User ID
 * @throws {Error} 403 if not Plus user
 */
async function requirePlusEntitlement(uid) {
  const entitled = await hasPlusEntitlement(uid);
  if (!entitled) {
    const err = new Error('Private storage requires Plus.');
    err.status = 403;
    err.code = 'PLUS_REQUIRED_PRIVATE_STORAGE';
    err.details = PLUS_REQUIRED_ERROR;
    throw err;
  }
}

module.exports = {
  getAdmin,
  getUserFromEvent,
  requireUser,
  hasPlusEntitlement,
  requirePlusEntitlement,
  PLUS_REQUIRED_ERROR,
};