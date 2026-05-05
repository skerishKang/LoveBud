#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const options = {
    file: path.join('.local', 'test-accounts.json'),
    key: 'accounts.user',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file' && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    } else if (arg === '--key' && argv[index + 1]) {
      options.key = argv[index + 1];
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

function printHelp() {
  console.log([
    'Usage: node scripts/ops-auth-credential-preflight.js [--file .local/test-accounts.json] [--key accounts.user]',
    '',
    'Secret-safe local credential preflight for browser auth verification.',
    'The script never prints email, password, token, session, cookie, UID, or private values.',
  ].join('\n'));
}

function readJson(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return {
    absolutePath,
    raw,
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

function classifyString(value) {
  if (typeof value !== 'string') {
    return {
      present: false,
      nonEmpty: false,
      leadingTrailingWhitespace: false,
    };
  }

  return {
    present: true,
    nonEmpty: value.length > 0,
    leadingTrailingWhitespace: value !== value.trim(),
  };
}

function status(label, value) {
  console.log(`${label}: ${value}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.unknown) {
    console.error(`Unknown argument: ${options.unknown}`);
    printHelp();
    process.exitCode = 2;
    return;
  }

  status('Work type', 'Local Auth Credential Preflight');
  status('Selected credential key', options.key);

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

  const dottedAccount = getByDottedPath(loaded.json, options.key);
  const legacyAccount = dottedAccount || getLegacyArrayAccount(loaded.json, options.key);
  const account = legacyAccount && typeof legacyAccount === 'object' ? legacyAccount : undefined;

  status('Selected credential key present', account ? 'YES' : 'NO');
  status('Credential schema', Array.isArray(loaded.json && loaded.json.accounts) ? 'LEGACY_ARRAY' : 'OBJECT_MAP');

  const email = classifyString(account && account.email);
  const password = classifyString(account && account.password);
  const confirmPassword = classifyString(account && account.confirmPassword);

  status('accounts.user email', email.present ? (email.nonEmpty ? 'PRESENT_NONEMPTY' : 'EMPTY') : 'MISSING');
  status('accounts.user password', password.present ? (password.nonEmpty ? 'PRESENT_NONEMPTY' : 'EMPTY') : 'MISSING');
  status('email leading/trailing whitespace', email.leadingTrailingWhitespace ? 'YES' : 'NO');
  status('password leading/trailing whitespace', password.leadingTrailingWhitespace ? 'YES' : 'NO');

  if (confirmPassword.present) {
    status('confirmPassword', confirmPassword.nonEmpty ? 'PRESENT_NONEMPTY' : 'EMPTY');
    status('confirmPassword leading/trailing whitespace', confirmPassword.leadingTrailingWhitespace ? 'YES' : 'NO');
    status('password confirm match', account.password === account.confirmPassword ? 'YES' : 'NO');
  } else {
    status('confirmPassword', 'MISSING');
    status('password confirm match', 'NOT_CHECKED');
  }

  const pass = Boolean(
    account &&
    email.present && email.nonEmpty && !email.leadingTrailingWhitespace &&
    password.present && password.nonEmpty && !password.leadingTrailingWhitespace &&
    (!confirmPassword.present || account.password === account.confirmPassword)
  );

  status('Credential values exposed', 'NO');
  status('Secret exposure', 'NO');
  status('Final status', pass ? 'CREDENTIAL_PREFLIGHT_PASS' : 'CREDENTIAL_PREFLIGHT_BLOCKED');

  process.exitCode = pass ? 0 : 1;
}

main();
