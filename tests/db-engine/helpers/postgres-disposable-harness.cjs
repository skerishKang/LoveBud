'use strict';

/**
 * Shared disposable PostgreSQL harness for DB_ENGINE_EXECUTION tests.
 * Loopback + synthetic LB_TEST_PG* env only. Never reads DATABASE_URL.
 *
 * Refs: #3532, #3531, #3459, #3458, #1882
 */

const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const USER_RE = /^lovebud_ci(_[a-z0-9_]+)?$/;
const DB_PREFIX = 'lovebud_ci_';

function boundedFail(scenario, phase, category, exitCode, expectedClass, actualClass) {
  const msg = [
    `scenario=${scenario}`,
    `phase=${phase}`,
    `bounded_category=${category}`,
    `exit_code=${exitCode == null ? 'n/a' : String(exitCode)}`,
    `expected_class=${expectedClass}`,
    `actual_class=${actualClass}`,
  ].join(' ');
  const err = new Error(msg);
  err.bounded = true;
  throw err;
}

function readConfig() {
  const host = process.env.LB_TEST_PGHOST || '';
  const port = process.env.LB_TEST_PGPORT || '5432';
  const user = process.env.LB_TEST_PGUSER || '';
  const password = process.env.LB_TEST_PGPASSWORD || '';
  const adminDb = process.env.LB_TEST_PGADMIN_DB || '';
  const psqlBin = process.env.PSQL_BIN || 'psql';

  if (!host || !user || !password || !adminDb) {
    boundedFail(
      'config',
      'preflight',
      'DB_ENGINE_MISSING_SYNTHETIC_ENV',
      null,
      'LB_TEST_PG_VARS',
      'missing'
    );
  }
  if (!ALLOWED_HOSTS.has(host)) {
    boundedFail(
      'config',
      'preflight',
      'DB_ENGINE_UNSAFE_HOST_REJECTED',
      null,
      'loopback',
      'non_loopback'
    );
  }
  if (!USER_RE.test(user)) {
    boundedFail('config', 'preflight', 'DB_ENGINE_UNSAFE_USER_REJECTED', null, 'lovebud_ci*', 'other');
  }
  if (!adminDb.startsWith(DB_PREFIX)) {
    boundedFail('config', 'preflight', 'DB_ENGINE_UNSAFE_ADMIN_DB_REJECTED', null, 'lovebud_ci_*', 'other');
  }
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    boundedFail('config', 'preflight', 'DB_ENGINE_INVALID_PORT', null, '1-65535', String(port));
  }

  return { host, port: portNum, user, password, adminDb, psqlBin };
}

function makeDbName(scenario) {
  const safe = String(scenario).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'x';
  const rnd = crypto.randomBytes(4).toString('hex');
  const name = `${DB_PREFIX}ts_${safe}_${process.pid}_${rnd}`;
  if (!/^[a-z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error('DB_ENGINE_INVALID_DB_NAME');
  }
  return name;
}

function baseClientConfig(cfg, database) {
  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database,
    connectionTimeoutMillis: 10000,
  };
}

function runPsqlFile(cfg, database, filePath) {
  if (!fs.existsSync(filePath)) {
    return { status: 127, stdout: '', stderr: 'FILE_MISSING' };
  }
  const args = [
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    cfg.host,
    '-p',
    String(cfg.port),
    '-U',
    cfg.user,
    '-d',
    database,
    '-f',
    filePath,
  ];
  const env = {
    ...process.env,
    PGPASSWORD: cfg.password,
    PGOPTIONS: '',
  };
  const result = spawnSync(cfg.psqlBin, args, {
    encoding: 'utf8',
    env,
    shell: false,
    windowsHide: true,
    timeout: 60000,
  });
  return {
    status: result.status == null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.code || 'SPAWN_ERROR' : null,
  };
}

function combinedOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

/**
 * Create a disposable DB, optionally apply a fixture SQL file, run fn, drop DB.
 * @param {string} scenario
 * @param {string|null} fixtureSqlPath
 * @param {(ctx: {cfg:object, client:import('pg').Client, dbName:string, runSql:Function}) => Promise<any>} fn
 */
async function withDisposableDb(scenario, fixtureSqlPath, fn) {
  const cfg = readConfig();
  const dbName = makeDbName(scenario);
  const admin = new Client(baseClientConfig(cfg, cfg.adminDb));
  let client = null;
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    created = true;
    await admin.end();

    if (fixtureSqlPath) {
      const applyFixture = runPsqlFile(cfg, dbName, fixtureSqlPath);
      if (applyFixture.status !== 0) {
        boundedFail(
          scenario,
          'fixture_apply',
          'FIXTURE_APPLY_FAILED',
          applyFixture.status,
          'exit_0',
          `exit_${applyFixture.status}`
        );
      }
    }

    client = new Client(baseClientConfig(cfg, dbName));
    await client.connect();
    return await fn({
      cfg,
      client,
      dbName,
      runSql: (file) => runPsqlFile(cfg, dbName, file),
    });
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
    const admin2 = new Client(baseClientConfig(cfg, cfg.adminDb));
    try {
      await admin2.connect();
      if (created) {
        await admin2.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      }
    } catch (cleanupErr) {
      const code = cleanupErr && cleanupErr.code ? String(cleanupErr.code) : 'CLEANUP_FAIL';
      if (!globalThis.__lb_db_cleanup_errors) globalThis.__lb_db_cleanup_errors = [];
      globalThis.__lb_db_cleanup_errors.push(`${scenario}:${code}`);
    } finally {
      try {
        await admin2.end();
      } catch {
        // ignore
      }
    }
  }
}

module.exports = {
  ALLOWED_HOSTS,
  USER_RE,
  DB_PREFIX,
  boundedFail,
  readConfig,
  makeDbName,
  baseClientConfig,
  runPsqlFile,
  combinedOutput,
  withDisposableDb,
};
