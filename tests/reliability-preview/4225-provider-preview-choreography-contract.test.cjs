'use strict';

// Issue #4225 / #4082 — source-only Provider Preview deployment choreography
// contract. This test performs no provider/network/secret/Production action.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WRANGLER = path.join(
  ROOT,
  'workers',
  'reliability-preview',
  'wrangler.reliability-preview.toml'
);
const ADDENDUM = path.join(
  ROOT,
  'docs',
  'engineering',
  'RUNTIME_RELIABILITY_PROVIDER_PREVIEW_CHOREOGRAPHY_4225.md'
);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('#4225 exports-based Provider Preview base deploy is explicitly cron-free', () => {
  const source = read(WRANGLER);

  assert.match(
    source,
    /\[env\.reliability-preview\.exports\.ReliabilityPreviewStore\][\s\S]*?type\s*=\s*"durable-object"[\s\S]*?storage\s*=\s*"sqlite"/,
    'SQLite Durable Object must remain declared through exports'
  );
  assert.doesNotMatch(
    source,
    /\[\[?env\.reliability-preview\.migrations\]?\]/,
    'exports and legacy migrations must not be mixed'
  );
  assert.match(
    source,
    /\[env\.reliability-preview\.triggers\]\s*\ncrons\s*=\s*\[\s*\]/,
    'base provider deploy must explicitly carry crons = []'
  );
  assert.doesNotMatch(
    source,
    /^crons\s*=\s*\[\s*"\*\/5 \* \* \* \*"\s*\]\s*$/m,
    'base provider deploy must not attach the future five-minute Cron'
  );
});

test('#4225 source documentation forbids versions upload with exports and keeps Cron a separate owner gate', () => {
  const wrangler = read(WRANGLER);
  const addendum = read(ADDENDUM);

  assert.match(
    wrangler,
    /Do NOT use `wrangler versions upload` for this `exports`-based configuration\./,
    'Wrangler contract must explicitly reject versions upload for exports'
  );
  assert.match(
    addendum,
    /EXPORTS_WITH_VERSIONS_UPLOAD = FORBIDDEN/,
    'authoritative addendum must forbid the stale versions-upload stage'
  );
  assert.match(
    addendum,
    /BASE_PROVIDER_DEPLOY_CRONS = \[\]/,
    'authoritative addendum must pin the cron-free base deploy'
  );
  assert.match(
    addendum,
    /CRON_ATTACHMENT = SEPARATE_OWNER_GATE/,
    'Cron attachment must remain independently authorized'
  );
});

test('#4225 correction remains non-activating and carries no Production credential binding', () => {
  const addendum = read(ADDENDUM);

  for (const invariant of [
    'PROVIDER_PREVIEW_EXECUTED_BY_THIS_CHANGE = NO',
    'PROVIDER_MUTATION = NONE',
    'PRODUCTION_MUTATION = NONE',
    'READ_ONLY_SENTINEL_ACTIVATION = NO',
    'ALERT_DELIVERY_ACTIVATION = NO',
    'PRODUCTION_READ_AUTHORITY = NO',
    'PRODUCTION_SYNTHETIC_WRITE_AUTHORITY = NO',
  ]) {
    assert.ok(addendum.includes(invariant), invariant);
  }

  assert.match(
    addendum,
    /PRODUCTION_CREDENTIAL_IN_BASE_PREVIEW = NO/,
    'base Preview must not require a Production credential'
  );
  assert.match(
    addendum,
    /SYNTHETIC_CAPABILITY_IN_BASE_PREVIEW = ABSENT/,
    'base Preview must not carry synthetic write capability'
  );
});
