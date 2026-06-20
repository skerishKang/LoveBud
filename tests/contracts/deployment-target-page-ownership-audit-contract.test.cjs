'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = 'docs/ops/DEPLOYMENT_TARGET_PAGE_OWNERSHIP_AUDIT.md';
const OPS_INDEX_PATH = 'docs/ops/ops_index.md';
const TEST_PATH = 'tests/contracts/deployment-target-page-ownership-audit-contract.test.cjs';

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function requirePhrase(source, phrase, message) {
  assert.ok(source.includes(phrase), message || `required phrase missing: ${phrase}`);
}

test('deployment target page ownership audit document exists with expected title', () => {
  assert.ok(fs.existsSync(path.join(ROOT, DOC_PATH)), 'deployment target page ownership audit document must exist');
  const doc = readFile(DOC_PATH);
  assert.match(doc, /^# Deployment Target and Page Ownership Audit$/m, 'document title must match exactly');
  assert.ok(doc.length > 1000, 'document must contain substantive audit content');
});

test('companion contract test is present', () => {
  const testSource = readFile(TEST_PATH);
  assert.match(testSource, /Deployment Target and Page Ownership Audit/i, 'contract must name the audit');
});

test('document states #2715 docs/audit-only scope and #1882 protection', () => {
  const doc = readFile(DOC_PATH);

  requirePhrase(doc, 'Issue #2715 `docs/audit-only`', 'document must identify #2715 docs/audit-only scope');
  requirePhrase(doc, 'Refs #2715', 'document must include Refs #2715');
  requirePhrase(doc, 'Refs #1882', 'document must include Refs #1882');
  requirePhrase(doc, '`#1882` remains open.', 'document must state #1882 remains open');
  requirePhrase(doc, 'Production activation remains BLOCKED.', 'document must block production activation');

  const forbidden = ['Closes', 'Fixes', 'Resolves'].map((word) => `${word} #1882`);
  for (const phrase of forbidden) {
    assert.ok(!doc.includes(phrase), `document must not include forbidden phrase: ${phrase}`);
  }
});

test('document declares no runtime/config/env/auth/api/db authority', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    'No runtime changes.',
    'No deployment config changes.',
    'No Cloudflare env changes.',
    'No Scout/auth/API/DB changes.',
    'No Wrangler deploy, Cloudflare preview deploy, or manual production deploy.',
    'No file deletion, file movement, or legacy artifact reactivation from this audit alone.',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `scope guardrail must include: ${phrase}`);
  }
});

test('document maps current deployed and runtime targets', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    'https://lovebud.pages.dev/',
    'Browser',
    'same-origin /api/*',
    'Cloudflare Pages Functions',
    'Modal',
    'Neon',
    'Cloudflare Pages',
    'Active browser-facing frontend and same-origin API entry',
    'functions/api/**',
    'Active Cloudflare Pages Functions gateway',
    'modal_compute/**',
    'Active backend compute/runtime',
    'Vercel',
    'Deprecated transitional fallback under audit',
    'Netlify',
    'Legacy artifact',
    'netlify/functions/**',
    'Not the active production fallback path',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `target map must include: ${phrase}`);
  }
});

test('document preserves staging and preview boundary', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    'Cloudflare Pages PR Preview is the normal pre-merge verification target',
    'Already approved test or preview URLs are acceptable',
    '`https://lovebud.pages.dev/` is for merge-after production confirmation, not pre-merge branch verification.',
    'This document does not perform, configure, or authorize:',
    'preview deploy',
    'Wrangler deploy',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `preview boundary must include: ${phrase}`);
  }
});

test('document lists no-removal preservation guardrails', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    '`functions/api/**`',
    '`modal_compute/**`',
    '`vercel.json`',
    '`_redirects`',
    '`netlify.toml`',
    '`netlify/functions/**`',
    'This audit does not delete, move, rename, reactivate, or repurpose them.',
    '`_redirects` is a static route alias marker.',
    'The presence of “Netlify” in nearby legacy audit language is not sufficient evidence to delete it.',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `preservation guardrail must include: ${phrase}`);
  }
});

test('document separates detail.html and view.html ownership', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    '`pages/detail.html` and `js/detail.js` own the individual memory/detail reading surface.',
    'It is not a replacement for `pages/view.html`',
    'not a sub-implementation of the public viewer surface.',
    '`pages/view.html` and `js/viewer/**` own the public/read-only tree canvas viewer surface.',
    'not a target for blind consolidation into `detail.html` or the editor.',
    'Access permission, visibility, and data source decisions are runtime policy decisions.',
    'does not label `detail.html` as authenticated-only without runtime evidence.',
    'Shared UI fragments between `detail.html` and `view.html` do not change route ownership.',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `page ownership section must include: ${phrase}`);
  }
});

test('document defines future follow-up work without creating cleanup issues', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    'Actual Vercel/Netlify removal requires exact file inventory, script/test/docs dependency audit, runtime impact review, and CTO approval in a separate issue.',
    '`detail.html` / `view.html` consolidation requires a separate architecture audit and issue.',
    'Viewer/editor split or merge decisions require a separate architecture audit and issue.',
    'This audit does not create a cleanup issue.',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `future work section must include: ${phrase}`);
  }
});

test('document lists non-goals', () => {
  const doc = readFile(DOC_PATH);
  const required = [
    'Cloudflare/Vercel/Netlify/Modal config changes.',
    'Environment variable changes.',
    'Runtime route changes.',
    'Scout/auth/API/DB changes.',
    'File deletion.',
    'File movement.',
    'Legacy platform reactivation.',
    'Production activation.',
  ];

  for (const phrase of required) {
    requirePhrase(doc, phrase, `non-goals must include: ${phrase}`);
  }
});

test('ops_index links the new deployment target page ownership audit', () => {
  const opsIndex = readFile(OPS_INDEX_PATH);
  requirePhrase(opsIndex, '[DEPLOYMENT_TARGET_PAGE_OWNERSHIP_AUDIT.md](DEPLOYMENT_TARGET_PAGE_OWNERSHIP_AUDIT.md)', 'ops_index.md must link the new audit document');
  requirePhrase(opsIndex, 'Issue #2715 deployment target and page ownership audit', 'ops_index.md must describe the audit scope');
  requirePhrase(opsIndex, 'Cloudflare Pages/Modal active boundary', 'ops_index.md must mention Cloudflare Pages/Modal active boundary');
  requirePhrase(opsIndex, 'Vercel/Netlify legacy/transitional posture', 'ops_index.md must mention Vercel/Netlify legacy/transitional posture');
  requirePhrase(opsIndex, 'detail.html vs view.html ownership', 'ops_index.md must mention detail/view ownership');
  requirePhrase(opsIndex, 'no-removal guardrails', 'ops_index.md must mention no-removal guardrails');
});
