/**
 * LoveBud - Neon PostgreSQL Database Connection
 *
 * Based on: 133-relovetree/netlify/functions/_lib/db.js
 *
 * Provides a connection pool to Neon PostgreSQL.
 * All SQL operations go through this module.
 */
const { Pool } = require('pg');

let pool;

function getDatabaseUrl() {
  return (
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  );
}

function getPool() {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    const err = new Error('Database is not configured');
    err.status = 503;
    err.details = 'Missing Postgres connection string (NETLIFY_DATABASE_URL or DATABASE_URL)';
    throw err;
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  });

  return pool;
}

/**
 * Execute a SQL query.
 * @param {string} text - SQL query text
 * @param {any[]} params - Query parameters
 * @returns {Promise<{rows: any[]}>}
 */
async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Run a function within a transaction.
 * @param {Function} fn - async function receiving client
 */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getDatabaseUrl,
  getPool,
  query,
  withTransaction,
};