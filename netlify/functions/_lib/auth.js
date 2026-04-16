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

let adminInitialized = false;

function getAdmin() {
  if (adminInitialized) return admin;

  if (!admin.apps || !admin.apps.length) {
    const raw =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {
      const err = new Error(
        'Missing Firebase service account: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT'
      );
      err.status = 503;
      throw err;
    }

    try {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (parseError) {
      const err = new Error(
        'Invalid Firebase service account JSON: ' + parseError.message
      );
      err.status = 503;
      throw err;
    }
  }

  adminInitialized = true;
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

module.exports = {
  getAdmin,
  getUserFromEvent,
  requireUser,
};