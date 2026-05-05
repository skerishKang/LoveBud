#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function parseArgs(argv) {
  const options = {
    file: path.join('.local', 'test-accounts.json'),
    key: 'accounts.user',
    firebaseConfig: path.join('js', 'firebase-config.js'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file' && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    } else if (arg === '--key' && argv[index + 1]) {
      options.key = argv[index + 1];
      index += 1;
    } else if (arg === '--firebase-config' && argv[index + 1]) {
      options.firebaseConfig = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      options.unknown = arg;
      break;
    }
  }

  return options;
}

function status(label, value) {
  console.log(`${label}: ${value}`);
}

function printHelp() {
  console.log([
    'Usage: node scripts/ops-auth-direct-verify-password.js --key accounts.user',
    '',
    'Reads the selected local QA credential and directly calls Firebase Identity Toolkit verifyPassword.',
    'The script never prints email, password, token, session, cookie, UID, request payload, or private values.',
  ].join('\n'));
}

function readJson(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return { absolutePath, json: JSON.parse(raw) };
}

function getByDottedPath(root, dottedPath) {
  return String(dottedPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, segment) => {
      if (!value || typeof value !== 'object') return undefined;
      return value[segment];
    }, root);
}

function getLegacyArrayAccount(root, selectedKey) {
  const suffix = String(selectedKey || '').split('.').pop();
  if (!Array.isArray(root && root.accounts)) return undefined;
  return root.accounts.find((account) => account && account.id === suffix);
}

function getAccount(root, selectedKey) {
  const dottedAccount = getByDottedPath(root, selectedKey);
  const legacyAccount = dottedAccount || getLegacyArrayAccount(root, selectedKey);
  return legacyAccount && typeof legacyAccount === 'object' ? legacyAccount : undefined;
}

function readFirebaseConfig(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const sandbox = { console: { warn() {}, error() {}, log() {} }, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: absolutePath });
  return { absolutePath, config: sandbox.FIREBASE_CONFIG };
}

function hasCleanString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  status('Work type', 'Local Firebase Direct verifyPassword Check');
  status('Selected credential key', options.key);

  if (options.help) {
    printHelp();
    return;
  }
  if (options.unknown) {
    status('Unknown argument', 'PRESENT');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'INVALID_ARGUMENTS');
    process.exitCode = 2;
    return;
  }

  let loaded;
  let firebase;
  try {
    loaded = readJson(options.file);
    firebase = readFirebaseConfig(options.firebaseConfig);
  } catch (error) {
    status('Credential/config file readable', 'NO');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'LOCAL_FILE_BLOCKED');
    process.exitCode = 1;
    return;
  }

  status('Credential file absolute path', loaded.absolutePath);
  status('Firebase config file absolute path', firebase.absolutePath);

  const account = getAccount(loaded.json, options.key);
  const emailReady = hasCleanString(account && account.email);
  const passwordReady = hasCleanString(account && account.password);
  const configReady = Boolean(firebase.config && hasCleanString(firebase.config.apiKey) && hasCleanString(firebase.config.projectId));

  status('Selected credential key present', account ? 'YES' : 'NO');
  status('Credential email', emailReady ? 'PRESENT_NONEMPTY' : 'MISSING_OR_INVALID');
  status('Credential password', passwordReady ? 'PRESENT_NONEMPTY' : 'MISSING_OR_INVALID');
  status('Firebase config present', configReady ? 'YES' : 'NO');
  status('Firebase projectId', firebase.config && firebase.config.projectId ? firebase.config.projectId : 'MISSING');

  if (!account || !emailReady || !passwordReady || !configReady) {
    status('verifyPassword request attempted', 'NO');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'LOCAL_PREFLIGHT_BLOCKED');
    process.exitCode = 1;
    return;
  }

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebase.config.apiKey)}`;
  let response;
  let body;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    status('verifyPassword request attempted', 'YES');
    status('verifyPassword HTTP status', 'NETWORK_ERROR');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'VERIFY_PASSWORD_NETWORK_BLOCKED');
    process.exitCode = 1;
    return;
  }

  const errorMessage = body && body.error && body.error.message
    ? String(body.error.message)
    : '';

  status('verifyPassword request attempted', 'YES');
  status('verifyPassword HTTP status', String(response.status));
  status('verifyPassword safe error code/message', response.ok ? 'NONE' : (errorMessage || 'UNKNOWN'));
  status('idToken exposed', 'NO');
  status('refreshToken exposed', 'NO');
  status('Credential values exposed', 'NO');
  status('Secret exposure', 'NO');
  status('Final status', response.ok ? 'DIRECT_VERIFY_PASSWORD_PASS' : 'DIRECT_VERIFY_PASSWORD_REJECTED');
  process.exitCode = response.ok ? 0 : 1;
}

main().catch(() => {
  status('Unhandled error', 'YES');
  status('Credential values exposed', 'NO');
  status('Secret exposure', 'NO');
  status('Final status', 'DIRECT_VERIFY_PASSWORD_FAILED');
  process.exit(1);
});
