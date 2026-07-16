'use strict';

/**
 * CLI: build gate-compatible catalog evidence from disposable PostgreSQL.
 *
 * Explicit connection flags only. No DATABASE_URL, no env password fallback.
 * Repository-root allowlist + role-mapping JSON only.
 *
 * Refs #3544, #3542, #3458
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ADAPTER_FAILURE,
  collectCatalogEvidence,
  loadContract,
  validateConnectionConfig,
} = require('./migration-catalog-postgres-adapter-core.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

function failClosed(blockers) {
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'CATALOG_EVIDENCE_FROM_POSTGRES',
        decision: 'FAIL_CLOSED',
        blockers: [...new Set(blockers)].sort(),
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
}

function parseArgs(argv) {
  const map = new Map();
  const flags = new Set([
    '--host',
    '--port',
    '--user',
    '--password',
    '--database',
    '--objects',
    '--role-mapping',
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--') || !flags.has(arg)) {
      const err = new Error('unknown');
      err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
      throw err;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      const err = new Error('missing');
      err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
      throw err;
    }
    map.set(arg, next);
    i += 1;
  }
  return map;
}

function assertRepoRelative(filePath) {
  const resolved = path.resolve(REPO_ROOT, filePath);
  const root = path.resolve(REPO_ROOT);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    const err = new Error('path');
    err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
    throw err;
  }
  return resolved;
}

function readJsonRepoRelative(rel) {
  const resolved = assertRepoRelative(rel);
  let raw;
  try {
    raw = fs.readFileSync(resolved);
  } catch {
    const err = new Error('read');
    err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
    throw err;
  }
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return JSON.parse(decoder.decode(raw));
  } catch {
    const err = new Error('json');
    err.category = ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID;
    throw err;
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    for (const req of [
      '--host',
      '--port',
      '--user',
      '--password',
      '--database',
      '--objects',
      '--role-mapping',
    ]) {
      if (!args.has(req)) {
        failClosed([ADAPTER_FAILURE.CATALOG_ADAPTER_INPUT_INVALID]);
        return;
      }
    }

    // Explicit flags only — never read process.env for connection material.
    const connection = validateConnectionConfig({
      host: args.get('--host'),
      port: args.get('--port'),
      user: args.get('--user'),
      password: args.get('--password'),
      database: args.get('--database'),
    });

    const objectsDoc = readJsonRepoRelative(args.get('--objects'));
    const roleMappingDoc = readJsonRepoRelative(args.get('--role-mapping'));
    const objects = Array.isArray(objectsDoc) ? objectsDoc : objectsDoc.objects;
    const roleMapping = roleMappingDoc.role_mapping || roleMappingDoc;

    const contract = loadContract(REPO_ROOT);
    const evidence = await collectCatalogEvidence({
      connection,
      objects,
      roleMapping,
      contract,
    });
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    process.exitCode = 0;
  } catch (error) {
    const category =
      (error && error.category) || ADAPTER_FAILURE.CATALOG_ADAPTER_QUERY_FAILED;
    failClosed([category]);
  }
}

main();
