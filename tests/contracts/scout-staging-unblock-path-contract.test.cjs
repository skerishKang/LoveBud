'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs', 'product', 'lovebud-scout-staging-unblock-path.md');
const VERIFIER_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-auth-verifier-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js', 'scout', 'scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js', 'scout', 'scout-suggestion-endpoint-client.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function assertIncludesAll(content, values, label) {
  for (const value of values) {
    assert.ok(content.includes(value), `${label} must include ${value}`);
  }
}

const doc = fs.existsSync(DOC_PATH) ? read(DOC_PATH) : '';
const docLower = doc.toLowerCase();
const verifierCode = read(VERIFIER_PATH);
const depAdapterCode = read(DEP_ADAPTER_PATH);
const suggestCode = read(SUGGEST_PATH);
const sourceSelectorCode = read(SOURCE_SELECTOR_PATH);
const endpointClientCode = read(ENDPOINT_CLIENT_PATH);

test('staging unblock path document exists and references the correct issues', () => {
  assert.ok(fs.existsSync(DOC_PATH), 'staging unblock path doc must exist');
  assert.ok(doc.length > 500, 'staging unblock path doc must be substantive');
  assertIncludesAll(doc, ['#2660', '#2636', '#1882'], 'doc');
  assert.match(doc, /keeps\s+#1882\s+open/i);
});

test('document records the current Preview smoke blocker without completion claims', () => {
  assert.match(doc, /missing-auth[^\n]*pass/i);
  assert.match(doc, /invalid-auth[^\n]*pass/i);
  assert.match(doc, /authenticated success \/ provider path:\s*blocked/i);
  assert.match(doc, /mock-disabled/i);
  assert.match(doc, /provider path reached:\s*no/i);
  assert.match(doc, /production activation:\s*blocked/i);
});

test('existing STAGING verifier mode remains DI-only and has no Cloudflare env activation', () => {
  assert.match(doc, /existing `STAGING` verifier mode remains \*\*DI-only\*\*/);
  assert.match(doc, /must not be activated by a Cloudflare environment variable/i);
  assert.match(verifierCode, /STAGING:\s*'staging'/);
  assert.match(verifierCode, /No Cloudflare env flag activates this mode/);
  assert.match(verifierCode, /exclusively for DI-based testing and contract verification/);
});

test('document defines a separate Preview token-hash verifier path only as a future design candidate', () => {
  assert.match(doc, /separate Preview-only verifier plan/i);
  assert.match(doc, /Preview token-hash verifier surface/i);
  assertIncludesAll(doc, [
    'SCOUT_PREVIEW_VERIFIER_ENABLED',
    'SCOUT_PREVIEW_VERIFIER_MODE',
    'SCOUT_PREVIEW_TOKEN_HASH',
    'SCOUT_SUGGEST_PROVIDER_STAGE',
  ], 'doc');
  assert.match(doc, /These names do not activate anything in this slice/);
  assert.match(doc, /reserved design\s+candidates only/i);
});

test('future activation conditions are staging-only and safe-fail oriented', () => {
  assert.match(doc, /SCOUT_SUGGEST_PROVIDER_STAGE` is exactly `staging`/);
  assert.match(doc, /SCOUT_PREVIEW_VERIFIER_ENABLED` is explicitly `true`/);
  assert.match(doc, /SCOUT_PREVIEW_VERIFIER_MODE` is explicitly `token_hash`/);
  assert.match(doc, /SCOUT_PREVIEW_TOKEN_HASH` is present as a Cloudflare Secret/);
  assert.match(doc, /Production stage values must safe-fail/i);
  assert.match(doc, /Missing configuration must safe-fail/i);
  assert.match(doc, /Any verifier exception must safe-fail/i);
});

test('rollback and kill-switch expectations are documented', () => {
  assert.match(doc, /set `SCOUT_PREVIEW_VERIFIER_ENABLED=false`/);
  assert.match(doc, /unset `SCOUT_PREVIEW_TOKEN_HASH`/);
  assert.match(doc, /SCOUT_SUGGEST_PROVIDER_MODE=stub/);
  assert.match(doc, /redeploy the previous known-good build/);
  assert.match(doc, /Rollback evidence must be recorded without token values/i);
});

test('sensitive values and raw source material remain prohibited in docs and reports', () => {
  const prohibitedEvidence = [
    'secret values',
    'bearer token values',
    'prompt text',
    'excerpt text',
    'source URL text',
    'raw provider responses',
  ];
  for (const value of prohibitedEvidence) {
    assert.ok(docLower.includes(value.toLowerCase()), `doc must prohibit ${value}`);
  }
  assert.match(doc, /never store or record bearer token values/i);
  assert.match(doc, /Only a non-reversible token hash may be compared/i);
});

test('production, provider CI, frontend provider, and persistence remain blocked', () => {
  const blocked = [
    'production activation',
    'production_live',
    'real Firebase Admin SDK import',
    'real provider API call in normal CI',
    'frontend provider call',
    'persistent rate-limit storage',
    'automatic save or persistence of provider responses',
  ];
  for (const item of blocked) {
    assert.ok(docLower.includes(item.toLowerCase()), `doc must list blocked item: ${item}`);
  }
});

test('suggest endpoint defaults remain stub-first and mock-disabled by default', () => {
  assert.match(suggestCode, /STUB:\s*'stub'/);
  assert.match(suggestCode, /const mode = \(env\?\.SCOUT_SUGGEST_PROVIDER_MODE \|\| ''\)\.toLowerCase\(\)/);
  assert.match(suggestCode, /createScoutLiveDependencyAdapter\(\{ mockDisabled: true \}\)/);
  assert.match(suggestCode, /No real Firebase Admin SDK \/ no real persistent rate-limit storage/);
});

test('frontend source selector and endpoint client defaults remain disabled/local_stub', () => {
  assert.match(sourceSelectorCode, /local_stub/);
  assert.match(endpointClientCode, /disabled/i);
  assert.ok(!/fetch\s*\(/.test(codeOnly(sourceSelectorCode)), 'source selector must not fetch provider directly');
});

test('dependency adapter keeps explicit DI staging verifier route but no env activation', () => {
  assert.match(depAdapterCode, /staging verifier/i);
  assert.match(depAdapterCode, /explicitly injected via the `verifierAdapter`/);
  assert.match(depAdapterCode, /cannot[\s\S]*?be activated by any[\s\S]*?Cloudflare env flag/i);
  assert.match(depAdapterCode, /VERIFY_RUNTIME_VERIFIED/);
  assert.match(depAdapterCode, /production activation remains blocked/i);
});

test('no runtime code was changed to use proposed preview verifier env names', () => {
  const runtimeCode = [verifierCode, depAdapterCode, suggestCode, sourceSelectorCode, endpointClientCode].join('\n');
  const proposedNames = [
    'SCOUT_PREVIEW_VERIFIER_ENABLED',
    'SCOUT_PREVIEW_VERIFIER_MODE',
    'SCOUT_PREVIEW_TOKEN_HASH',
  ];
  for (const name of proposedNames) {
    assert.ok(!runtimeCode.includes(name), `${name} must not appear in runtime code in this plan slice`);
  }
});
