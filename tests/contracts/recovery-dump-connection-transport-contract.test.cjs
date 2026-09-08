/**
 * Recovery dump connection-transport contract (#3460 / #3894 recovery lane).
 *
 * Proves the pg_dump connection handoff is secret-safe and correct WITHOUT any
 * live operation: no Modal, DB, pg_dump, network, Drive, or Production secret is
 * touched. Two independent layers:
 *
 *   1. Static source analysis of modal_compute/recovery_backup_app.py `_run_dump`
 *      and modal_compute/recovery_pg_transport.py — the raw connection value is
 *      never placed in argv, only decomposed child-only libpq environment
 *      variables reach the subprocess, and the parser module stays pure.
 *   2. Deterministic execution of the PURE parser against FAKE connection URIs
 *      through a local python subprocess, asserting correct decomposition and
 *      fail-closed classification with no credential leakage.
 *
 * The scenario script is written to the OS temp directory (never the repository)
 * and removed after the run.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_PATH = path.join(ROOT, 'modal_compute', 'recovery_backup_app.py');
const TRANSPORT_PATH = path.join(ROOT, 'modal_compute', 'recovery_pg_transport.py');
const APP = fs.readFileSync(APP_PATH, 'utf8');
const TRANSPORT = fs.readFileSync(TRANSPORT_PATH, 'utf8');

// ---- 1. static: the dump helper never carries the connection value in argv ----

test('T1. dump helper decomposes the connection into child-only libpq env vars', () => {
  const dumpDef = APP.slice(APP.indexOf('def _run_dump'), APP.indexOf('def _is_non_empty'));
  assert.ok(dumpDef.includes('parse_pg_connection('), 'dump must route through the transport parser');
  assert.ok(dumpDef.includes('os.environ[DB_URL_ENV]'), 'connection read via the symbolic env name');
  assert.ok(!/os\.environ\[\s*["']DATABASE_URL["']\s*\]/.test(dumpDef), 'no literal DATABASE_URL subscript');
  assert.match(dumpDef, /PGHOST/);
  assert.match(dumpDef, /PGPORT/);
  assert.match(dumpDef, /PGDATABASE/);
  assert.match(dumpDef, /PGUSER/);
  assert.match(dumpDef, /PGCONNECT_TIMEOUT/);
  assert.match(dumpDef, /env\s*=\s*child_env/);
  assert.ok(!dumpDef.includes('db_url'), 'db_url must not appear in the dump helper');
  assert.ok(!dumpDef.includes('DRIVE_CLIENT') && !dumpDef.includes('RECOVERY_ENCRYPTION_KEY'), 'no secret inherited into child env');
});

test('T2. the pg_dump argv contains only fixed flags and the dump path', () => {
  const start = APP.indexOf('def _run_dump');
  const dumpDef = APP.slice(start, APP.indexOf('def _is_non_empty'));
  const cmdBlock = dumpDef.slice(dumpDef.indexOf('cmd = ['), dumpDef.indexOf('child_env'));
  assert.ok(cmdBlock.length > 0, 'cmd block located');
  // No connection value, parsed components, or URI-bearing token may appear in argv.
  assert.ok(!cmdBlock.includes('DB_URL_ENV'), 'argv must not read the connection env value');
  assert.ok(!cmdBlock.includes('conn'), 'argv must not reference parsed connection components');
  assert.ok(!/["']postgres(ql)?:\/\//.test(cmdBlock), 'no inline connection URI literal in argv');
  assert.ok(!/--dbname/.test(cmdBlock), 'no --dbname connection value passed on argv');
  assert.match(cmdBlock, /["']pg_dump["']/);
  assert.match(cmdBlock, /["']--format=custom["']/);
});

test('T3. the transport parser module stays pure (stdlib only, no side effects)', () => {
  assert.match(TRANSPORT, /from urllib\.parse import/, 'parser uses stdlib urllib.parse');
  assert.ok(!/^\s*(import|from)\s+(subprocess|socket|http|requests|psycopg|modal|os)\b/m.test(TRANSPORT), 'parser must not import subprocess/network/os/modal');
  assert.ok(!/os\.environ/.test(TRANSPORT), 'parser must not read the environment');
  assert.ok(!/print\(/.test(TRANSPORT), 'parser must not log');
  assert.ok(!/subprocess\./.test(TRANSPORT), 'no subprocess call in parser');
});

// ---- 2. executed: deterministic decomposition + fail-closed on FAKE URIs ----

const SCENARIO_SCRIPT = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from modal_compute.recovery_pg_transport import parse_pg_connection, PgConnectionConfigError

results = {}

def dec(url):
    try:
        return {'status': 'PASS', 'value': parse_pg_connection(url)}
    except PgConnectionConfigError as e:
        return {'status': 'RAISED', 'token': str(e)}
    except Exception as e:
        return {'status': 'BAD', 'error': type(e).__name__}

# faithful decomposition of a standard managed-Postgres style URI
results['dec-basic'] = dec('postgres://alice:secret@db.example.com:5432/proddb?sslmode=require')
# default port when omitted
results['dec-default-port'] = dec('postgresql://bob:pw@h.example/mb')
# percent-decoding preserves literal '+' and decodes '@'
results['dec-percent'] = dec('postgres://dave:p%40w%2Bd@h.example/dbname')
# ssl family carried faithfully
results['dec-ssl'] = dec('postgres://bob:pw@h.example/mb?sslmode=verify-full&sslrootcert=%2Fca.pem')
# query host override wins over authority (mirrors libpq precedence)
results['dec-query-host'] = dec('postgres://u:p@authority.example/db?host=query.example')

# fail-closed classifications (generic non-credential tokens)
results['fail-unknown'] = dec('postgres://user:TOPSECRET@h.example/db?pgbouncer=true')
results['fail-service'] = dec('postgres://user:TOPSECRET@h.example/db?service=evil')
results['fail-passfile'] = dec('postgres://user:TOPSECRET@h.example/db?passfile=%2Fetc%2Fpasswd')
results['fail-badssl'] = dec('postgres://user@h.example/db?sslmode=bogus')
results['fail-dup'] = dec('postgres://user@h.example/db?sslmode=require&sslmode=require')
results['fail-scheme'] = dec('mysql://user@h.example/db')
results['fail-nohost'] = dec('postgres:///localdb')
results['fail-nodb'] = dec('postgres://user@h.example')
results['fail-nouser'] = dec('postgres://h.example/db')
results['fail-empty'] = dec('')
results['fail-port'] = dec('postgres://user@h.example:99999/db')
results['fail-frag'] = dec('postgres://user@h.example/db#frag')

# a raised token must never leak the host or password from the URI
leak = results['fail-unknown']
assert leak['status'] == 'RAISED', leak
assert 'TOPSECRET' not in json.dumps(leak), 'password leaked'
assert 'h.example' not in json.dumps(leak), 'host leaked'

print(json.dumps(results))
`;

function pythonBin() {
  for (const candidate of ['python3', 'python', 'py']) {
    try {
      execFileSync(candidate, ['-c', 'import sys'], { stdio: 'ignore', timeout: 15000 });
      return candidate;
    } catch (e) {
      // try the next candidate
    }
  }
  return null;
}

function runScenarios() {
  const bin = pythonBin();
  if (!bin) {
    return null;
  }
  const tmp = path.join(os.tmpdir(), 'lovebud-pg-transport-' + process.pid + '.py');
  fs.writeFileSync(tmp, SCENARIO_SCRIPT, { mode: 0o600 });
  try {
    const stdout = execFileSync(bin, [tmp], { encoding: 'utf8', timeout: 60000 });
    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* best effort */ }
  }
}

const results = runScenarios();
const havePython = results !== null;

test('T4. parser decomposes standard URIs into the exact libpq env vars', { skip: !havePython && 'no python interpreter available' }, () => {
  assert.equal(results['dec-basic'].status, 'PASS');
  assert.deepEqual(results['dec-basic'].value, {
    PGHOST: 'db.example.com',
    PGPORT: '5432',
    PGDATABASE: 'proddb',
    PGUSER: 'alice',
    PGPASSWORD: 'secret',
    PGSSLMODE: 'require',
  });
  assert.equal(results['dec-default-port'].status, 'PASS');
  assert.equal(results['dec-default-port'].value.PGPORT, '5432');
  assert.equal(results['dec-percent'].status, 'PASS');
  assert.equal(results['dec-percent'].value.PGPASSWORD, 'p@w+d');
  assert.equal(results['dec-ssl'].status, 'PASS');
  assert.equal(results['dec-ssl'].value.PGSSLMODE, 'verify-full');
  assert.equal(results['dec-ssl'].value.PGSSLROOTCERT, '/ca.pem');
  assert.equal(results['dec-query-host'].status, 'PASS');
  assert.equal(results['dec-query-host'].value.PGHOST, 'query.example');
});

test('T5. parser fails closed with generic tokens on every unsupported input', { skip: !havePython && 'no python interpreter available' }, () => {
  const expectToken = (name, token) => {
    assert.equal(results[name].status, 'RAISED', name + ' must raise');
    assert.equal(results[name].token, token, name + ' token');
  };
  expectToken('fail-unknown', 'unsupported_parameter');
  expectToken('fail-service', 'unsupported_parameter');
  expectToken('fail-passfile', 'unsupported_parameter');
  expectToken('fail-badssl', 'bad_sslmode');
  expectToken('fail-dup', 'duplicate_parameter');
  expectToken('fail-scheme', 'bad_scheme');
  expectToken('fail-nohost', 'missing_host');
  expectToken('fail-nodb', 'missing_database');
  expectToken('fail-nouser', 'missing_user');
  expectToken('fail-empty', 'empty_uri');
  expectToken('fail-port', 'bad_port');
  expectToken('fail-frag', 'unexpected_fragment');
});

test('T6. fail-closed classification never leaks credentials', { skip: !havePython && 'no python interpreter available' }, () => {
  // The scenario script asserts host/password absence and exits non-zero on a
  // leak; reaching here with a parsed result proves no credential leaked.
  assert.equal(results['fail-unknown'].status, 'RAISED');
  const blob = JSON.stringify(results['fail-unknown']);
  assert.ok(!blob.includes('TOPSECRET'), 'password must not appear in the error surface');
  assert.ok(!blob.includes('h.example'), 'host must not appear in the error surface');
});
