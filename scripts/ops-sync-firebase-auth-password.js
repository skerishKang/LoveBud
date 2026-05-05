#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const options = {
    file: path.join('.local', 'test-accounts.json'),
    key: 'accounts.user',
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file' && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    } else if (arg === '--key' && argv[index + 1]) {
      options.key = argv[index + 1];
      index += 1;
    } else if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      options.unknown = arg;
      break;
    }
  }

  return options;
}

function printHelp() {
  console.log([
    'Usage: node scripts/ops-sync-firebase-auth-password.js --key accounts.user [--file .local/test-accounts.json] --apply',
    '',
    'Secret-safe local helper that reads a local QA credential and updates the matching Firebase Auth user password.',
    'The script never prints email, password, token, session, cookie, UID, or private values.',
    'Requires Firebase Admin credentials configured locally through Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS.',
  ].join('\n'));
}

function status(label, value) {
  console.log(`${label}: ${value}`);
}

function readJson(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return {
    absolutePath,
    json: JSON.parse(raw),
  };
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

function hasMeaningfulString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function classifyAdminCredentialState(error) {
  const message = String(error && error.message || '');
  const code = String(error && error.code || '');
  if (code || message) {
    if (/credential|application-default|GOOGLE_APPLICATION_CREDENTIALS|service account|auth\/invalid-credential/i.test(`${code} ${message}`)) {
      return 'ADMIN_CREDENTIAL_BLOCKED';
    }
    if (/permission|not authorized|insufficient/i.test(`${code} ${message}`)) {
      return 'ADMIN_PERMISSION_BLOCKED';
    }
    if (/auth\/user-not-found|no user record/i.test(`${code} ${message}`)) {
      return 'FIREBASE_USER_MISSING';
    }
  }
  return 'FIREBASE_PASSWORD_SYNC_FAILED';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  status('Work type', 'Local Firebase Auth Password Sync');
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

  if (!options.apply) {
    status('Apply flag', 'MISSING');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'DRY_RUN_ONLY');
    process.exitCode = 1;
    return;
  }

  let loaded;
  try {
    loaded = readJson(options.file);
  } catch (error) {
    status('Credential file', 'MISSING_OR_UNREADABLE');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'CREDENTIAL_FILE_BLOCKED');
    process.exitCode = 1;
    return;
  }

  status('Credential file absolute path', loaded.absolutePath);
  status('Credential file', 'PRESENT');

  const account = getAccount(loaded.json, options.key);
  status('Selected credential key present', account ? 'YES' : 'NO');
  status('Credential schema', Array.isArray(loaded.json && loaded.json.accounts) ? 'LEGACY_ARRAY' : 'OBJECT_MAP');

  const emailReady = hasMeaningfulString(account && account.email);
  const passwordReady = hasMeaningfulString(account && account.password);
  status('Credential email', emailReady ? 'PRESENT_NONEMPTY' : 'MISSING_OR_INVALID');
  status('Credential password', passwordReady ? 'PRESENT_NONEMPTY' : 'MISSING_OR_INVALID');

  if (!account || !emailReady || !passwordReady) {
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'CREDENTIAL_PREFLIGHT_BLOCKED');
    process.exitCode = 1;
    return;
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch (error) {
    status('firebase-admin dependency', 'MISSING');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'DEPENDENCY_BLOCKED');
    process.exitCode = 1;
    return;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    status('Firebase Admin initialized', 'YES');
  } catch (error) {
    status('Firebase Admin initialized', 'NO');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', classifyAdminCredentialState(error));
    process.exitCode = 1;
    return;
  }

  try {
    const user = await admin.auth().getUserByEmail(account.email);
    status('Firebase user found by selected credential email', user ? 'YES' : 'NO');
    status('Firebase user disabled', user && user.disabled ? 'YES' : 'NO');

    await admin.auth().updateUser(user.uid, {
      password: account.password,
      disabled: false,
    });

    status('Firebase password updated from local credential', 'YES');
    status('Firebase user enabled after sync', 'YES');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', 'FIREBASE_PASSWORD_SYNCED');
  } catch (error) {
    status('Firebase password updated from local credential', 'NO');
    status('Credential values exposed', 'NO');
    status('Secret exposure', 'NO');
    status('Final status', classifyAdminCredentialState(error));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  status('Unhandled error', 'YES');
  status('Credential values exposed', 'NO');
  status('Secret exposure', 'NO');
  status('Final status', classifyAdminCredentialState(error));
  process.exit(1);
});
