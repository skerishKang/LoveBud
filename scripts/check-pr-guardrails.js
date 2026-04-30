#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');

const FORBIDDEN_PATHS = [
  'prototype/',
  'reference/',
  'demo/',
  'variant/',
  'hotspot-prototype/',
  'scrapbook-demo/',
  'quiet/',
];

const LEGACY_PATHS = [
  'netlify/',
  'netlify.toml',
  'vercel.json',
  '_redirects',
];

const RUNTIME_PATHS = [
  'js/',
  'css/',
  'pages/',
  'functions/',
  'modal_compute/',
];

const CLOSE_KEYWORDS = [
  'close', 'closes', 'closed',
  'fix', 'fixes', 'fixed',
  'resolve', 'resolves', 'resolved',
];

function checkGuardrails(files, prBody, docsOnlyMode) {
  let status = 'PASS';
  const warnings = [];
  const failures = [];

  // Check for forbidden paths
  for (const file of files) {
    for (const forbiddenPath of FORBIDDEN_PATHS) {
      if (file.includes(forbiddenPath)) {
        failures.push(`Forbidden path detected: ${file}`);
        status = 'FAIL';
      }
    }
  }

  // Check for close keywords in PR body
  const lowerCasePrBody = prBody.toLowerCase();
  for (const keyword of CLOSE_KEYWORDS) {
    if (lowerCasePrBody.includes(keyword)) {
      warnings.push(`PR body contains a close keyword: "${keyword}". Please use "Refs #" instead.`);
      if (status === 'PASS') status = 'WARN';
    }
  }

  // Check for legacy paths
  for (const file of files) {
    for (const legacyPath of LEGACY_PATHS) {
      if (file.includes(legacyPath)) {
        warnings.push(`Legacy path detected: ${file}`);
        if (status === 'PASS') status = 'WARN';
      }
    }
  }

  // Check for runtime paths in docs-only mode
  if (docsOnlyMode) {
    for (const file of files) {
      for (const runtimePath of RUNTIME_PATHS) {
        if (file.includes(runtimePath)) {
          failures.push(`Runtime file changed in docs-only mode: ${file}`);
          status = 'FAIL';
        }
      }
    }
  }

  return { status, warnings, failures };
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('files', {
      alias: 'f',
      description: 'Comma-separated list of changed file paths',
      type: 'string',
      demandOption: true,
      coerce: (arg) => arg.split(',').map(p => p.trim()),
    })
    .option('body', {
      alias: 'b',
      description: 'PR body content',
      type: 'string',
      default: '',
    })
    .option('docs-only', {
      description: 'Run in docs-only mode (warns on runtime file changes)',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('h', 'help')
    .argv;

  const { status, warnings, failures } = checkGuardrails(argv.files, argv.body, argv['docs-only']);

  console.log(`PR Guardrail Check Status: ${status}`);
  if (warnings.length > 0) {
    console.warn('Warnings:');
    warnings.forEach(w => console.warn(`- ${w}`));
  }
  if (failures.length > 0) {
    console.error('Failures:');
    failures.forEach(f => console.error(`- ${f}`));
  }

  if (status === 'FAIL') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });
}
