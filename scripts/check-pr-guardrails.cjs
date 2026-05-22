#!/usr/bin/env node

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

const CLOSE_KEYWORDS_REGEX = /\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\b/i;

function checkGuardrails(files, prBody, docsOnlyMode) {
  let status = 'PASS';
  const warnings = [];
  const failures = [];

  // Check for forbidden paths
  for (const file of files) {
    const filePath = file.toLowerCase();
    for (const forbiddenPath of FORBIDDEN_PATHS) {
      if (filePath.startsWith(forbiddenPath)) {
        failures.push(`Forbidden path detected: ${file}`);
        status = 'FAIL';
        break;
      }
    }
  }

  // Check for close keywords in PR body
  if (CLOSE_KEYWORDS_REGEX.test(prBody)) {
    warnings.push(`PR body contains a close keyword. Please use "Refs #" instead.`);
    if (status === 'PASS') status = 'WARN';
  }

  // Check for legacy paths
  for (const file of files) {
    const filePath = file.toLowerCase();
    for (const legacyPath of LEGACY_PATHS) {
      if (legacyPath.endsWith('/') && filePath.startsWith(legacyPath)) {
        warnings.push(`Legacy path detected: ${file}`);
        if (status === 'PASS') status = 'WARN';
        break;
      } else if (filePath === legacyPath) {
        warnings.push(`Legacy file detected: ${file}`);
        if (status === 'PASS') status = 'WARN';
        break;
      }
    }
  }

  // Check for runtime paths in docs-only mode
  if (docsOnlyMode) {
    for (const file of files) {
      const filePath = file.toLowerCase();
      for (const runtimePath of RUNTIME_PATHS) {
        if (filePath.startsWith(runtimePath)) {
          failures.push(`Runtime file changed in docs-only mode: ${file}`);
          status = 'FAIL';
          break;
        }
      }
    }
  }

  return { status, warnings, failures };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let files = [];
  let body = '';
  let docsOnlyMode = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--files' || arg === '-f') {
      files = args[++i].split(',').map(f => f.trim());
    } else if (arg === '--body' || arg === '-b') {
      body = args[++i];
    } else if (arg === '--docs-only') {
      docsOnlyMode = true;
    }
  }
  return { files, body, docsOnlyMode };
}

async function main() {
  const { files, body, docsOnlyMode } = parseArgs();

  if (files.length === 0) {
    console.error('Error: --files argument is required.');
    process.exit(1);
  }

  const { status, warnings, failures } = checkGuardrails(files, body, docsOnlyMode);

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
