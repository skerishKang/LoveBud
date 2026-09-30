#!/usr/bin/env node

'use strict';

// Canonical protected-Issue authority. Issue #4546 requires the protected set to be
// derived from the owner-approved governance document rather than hard-coded here.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL_GOVERNANCE_PATH = 'docs/ops/MVP_AGENT_GOVERNANCE.md';

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

// Bounded protected-Issue authority parser: only the canonical hard standing rule
// shape `Never close #<number>` grants protected status. Advisory "Keep OPEN"
// phrasings are deliberately NOT authority and are never parsed here.
const PROTECTED_ISSUE_RULE_REGEX = /never\s+close\s+#(\d+)/gi;

// Bounded closing-directive matcher. Requires a closing verb IMMEDIATELY followed
// by a protected-issue reference, so ordinary prose that merely contains the word
// "closes" is not treated as a closing directive.
const CLOSING_DIRECTIVE_REGEX =
  /\b(?:closes|close|closed|fixes|fix|fixed|resolves|resolve|resolved)\b[ \t]*(?:(?:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)?#(\d+)|https?:\/\/[^\s)]+\/issues\/(\d+))/gi;

const FENCE_OPEN_REGEX = /^[ \t]*(`{3,}|~{3,})/;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;

function defaultGitRunner(args, options) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function resolveProtectedIssueIds(options) {
  const opts = options || {};
  if (Array.isArray(opts.protectedIssueIds)) {
    return [...new Set(opts.protectedIssueIds.map(Number))]
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  }

  const governancePath = opts.governancePath
    ? path.resolve(opts.governancePath)
    : path.join(REPO_ROOT, CANONICAL_GOVERNANCE_PATH);

  let governanceText;
  try {
    governanceText =
      typeof opts.governanceText === 'string'
        ? opts.governanceText
        : fs.readFileSync(governancePath, 'utf8');
  } catch (error) {
    throw new Error(
      `protected-Issue authority document could not be read: ${CANONICAL_GOVERNANCE_PATH}`
    );
  }

  if (typeof governanceText !== 'string' || governanceText.trim().length === 0) {
    throw new Error(
      `protected-Issue authority document is empty or unreadable: ${CANONICAL_GOVERNANCE_PATH}`
    );
  }

  const ids = new Set();
  const ruleRegex = new RegExp(PROTECTED_ISSUE_RULE_REGEX.source, 'gi');
  let match = ruleRegex.exec(governanceText);
  while (match !== null) {
    ids.add(Number(match[1]));
    match = ruleRegex.exec(governanceText);
  }

  if (ids.size === 0) {
    throw new Error(
      `protected-Issue authority document declares no "Never close #<number>" rule: ${CANONICAL_GOVERNANCE_PATH}`
    );
  }

  return [...ids].sort((a, b) => a - b);
}

function loadProtectedIssueIds(options) {
  return resolveProtectedIssueIds(options);
}

function stripMarkdownCode(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return '';
  }

  const lines = text.split(/\r?\n/);
  const kept = [];
  let openFence = null;

  for (const line of lines) {
    const fence = FENCE_OPEN_REGEX.exec(line);
    if (openFence) {
      if (fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length) {
        openFence = null;
      }
      kept.push('');
      continue;
    }
    if (fence) {
      openFence = fence[1];
      kept.push('');
      continue;
    }
    kept.push(line);
  }

  return kept.join('\n').replace(INLINE_CODE_REGEX, ' ');
}

function findProtectedClosingReferences(body, protectedIssueIds) {
  const protectedSet = new Set(
    (protectedIssueIds || []).map(Number).filter(Number.isInteger)
  );
  if (protectedSet.size === 0) {
    return [];
  }

  const scannableText = stripMarkdownCode(body);
  const directiveRegex = new RegExp(CLOSING_DIRECTIVE_REGEX.source, 'gi');
  const found = new Set();
  let match = directiveRegex.exec(scannableText);

  while (match !== null) {
    const issueId = Number(match[1] || match[2]);
    if (Number.isInteger(issueId) && protectedSet.has(issueId)) {
      found.add(issueId);
    }
    match = directiveRegex.exec(scannableText);
  }

  return [...found].sort((a, b) => a - b);
}

function checkGuardrails(files, prBody, docsOnlyMode, options) {
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

  // Protected-Issue closing rules. Fail closed when the canonical authority
  // document cannot be derived (#4546).
  try {
    const protectedIssueIds = resolveProtectedIssueIds(options);
    const closedProtectedIssues = findProtectedClosingReferences(
      prBody,
      protectedIssueIds
    );
    for (const issueId of closedProtectedIssues) {
      failures.push(
        `Protected Issue #${issueId} cannot be closed from a PR body; use Refs #${issueId}.`
      );
      status = 'FAIL';
    }
  } catch (error) {
    failures.push(`Protected-Issue authority could not be loaded: ${error.message}`);
    status = 'FAIL';
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

function parseGithubEvent(eventPath) {
  if (typeof eventPath !== 'string' || eventPath.trim().length === 0) {
    throw new Error('GitHub event path is required for --github-event.');
  }

  let raw;
  try {
    raw = fs.readFileSync(eventPath, 'utf8');
  } catch (error) {
    throw new Error('GitHub event file could not be read from GITHUB_EVENT_PATH.');
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (error) {
    throw new Error('GitHub event JSON is malformed.');
  }

  if (!event || typeof event !== 'object' || !event.pull_request ||
      typeof event.pull_request !== 'object') {
    throw new Error('GitHub event JSON does not contain a pull_request object.');
  }

  const { base, head, body } = event.pull_request;
  const baseSha = base && typeof base.sha === 'string' ? base.sha.trim() : '';
  const headSha = head && typeof head.sha === 'string' ? head.sha.trim() : '';

  if (baseSha.length === 0 || headSha.length === 0) {
    throw new Error(
      'GitHub event JSON is missing pull_request.base.sha or pull_request.head.sha.'
    );
  }

  return {
    body: typeof body === 'string' ? body : '',
    baseSha,
    headSha,
  };
}

function deriveChangedFiles(baseSha, headSha, options) {
  const opts = options || {};
  const runGit = typeof opts.runGit === 'function' ? opts.runGit : defaultGitRunner;
  const cwd = opts.cwd || REPO_ROOT;

  let mergeBase;
  try {
    mergeBase = runGit(['merge-base', baseSha, headSha], { cwd }).trim();
  } catch (error) {
    throw new Error('git merge-base failed; cannot derive changed files.');
  }
  if (!mergeBase) {
    throw new Error('git merge-base returned no merge base; cannot derive changed files.');
  }

  let diffOutput;
  try {
    diffOutput = runGit(['diff', '--name-only', '-z', mergeBase, headSha], { cwd });
  } catch (error) {
    throw new Error('git diff failed; cannot derive changed files.');
  }

  const files = String(diffOutput)
    .split('\0')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  return { mergeBase, files };
}

function parseArgs(argv) {
  const args = argv || process.argv.slice(2);
  let files = [];
  let body = '';
  let docsOnlyMode = false;
  let githubEventPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--files' || arg === '-f') {
      const value = args[++i];
      files = typeof value === 'string' ? value.split(',').map(f => f.trim()).filter(Boolean) : [];
    } else if (arg === '--body' || arg === '-b') {
      const value = args[++i];
      body = typeof value === 'string' ? value : '';
    } else if (arg === '--docs-only') {
      docsOnlyMode = true;
    } else if (arg === '--github-event') {
      const value = args[++i];
      githubEventPath = typeof value === 'string' ? value : null;
    }
  }
  return { files, body, docsOnlyMode, githubEventPath };
}

async function main() {
  const { files, body, docsOnlyMode, githubEventPath } = parseArgs();

  let effectiveFiles = files;
  let effectiveBody = body;
  let mergeBase = null;

  if (githubEventPath) {
    let event;
    let derived;
    try {
      event = parseGithubEvent(githubEventPath);
      derived = deriveChangedFiles(event.baseSha, event.headSha);
    } catch (error) {
      console.log('PR Guardrail Check Status: FAIL');
      console.error('Failures:');
      console.error(`- ${error.message}`);
      process.exit(1);
    }
    effectiveFiles = derived.files;
    effectiveBody = event.body;
    mergeBase = derived.mergeBase;
    console.log(`Changed files derived from merge-base ${mergeBase}: ${derived.files.length}`);
  } else if (files.length === 0) {
    console.error('Error: --files argument is required.');
    process.exit(1);
  }

  const { status, warnings, failures } = checkGuardrails(
    effectiveFiles,
    effectiveBody,
    docsOnlyMode
  );

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
    console.log('PR Guardrail Check Status: FAIL');
    console.error('Failures:');
    console.error(`- ${error && error.message ? error.message : 'unknown guardrail error'}`);
    process.exit(1);
  });
}

module.exports = {
  CANONICAL_GOVERNANCE_PATH,
  FORBIDDEN_PATHS,
  LEGACY_PATHS,
  RUNTIME_PATHS,
  checkGuardrails,
  deriveChangedFiles,
  findProtectedClosingReferences,
  loadProtectedIssueIds,
  parseArgs,
  parseGithubEvent,
  stripMarkdownCode,
};
