const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.resolve(ROOT, 'docs/product/lovebud-moment-social-write-readiness-contract.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readDoc() {
  return fs.readFileSync(DOC_PATH, 'utf8');
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function hasSection(doc, headerPattern) {
  const re = new RegExp('^##\\s+(\\d+\\.\\s+)?' + headerPattern, 'm');
  return re.test(doc);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('governance document exists and is non-empty', () => {
  assert.ok(fs.existsSync(DOC_PATH), 'document must exist');
  const doc = readDoc();
  assert.ok(doc.length > 800, 'document must contain substantive content');
});

test('document references #3201, #3075, #3184, #3192, #1882', () => {
  const doc = readDoc();
  assert.ok(doc.includes('#3201'), 'must reference #3201');
  assert.ok(doc.includes('#3075'), 'must reference #3075');
  assert.ok(doc.includes('#3184'), 'must reference #3184');
  assert.ok(doc.includes('#3192'), 'must reference #3192');
  assert.ok(doc.includes('#1882'), 'must reference #1882');
});

test('document contains all mandatory sections', () => {
  const doc = readDoc();
  assert.ok(hasSection(doc, 'Current Boundary'), 'must have Current Boundary section');
  assert.ok(hasSection(doc, 'Source-of-Truth API Decision Table'), 'must have API decision table');
  assert.ok(hasSection(doc, 'Authenticated Write Boundaries'), 'must have Auth Write Boundaries');
  assert.ok(hasSection(doc, 'Controlled Runtime Verification Protocol'), 'must have verification protocol');
  assert.ok(hasSection(doc, 'Permanent Exclusions'), 'must have Permanent Exclusions');
});

test('API decision table includes guest and confirmed-auth rows', () => {
  const doc = readDoc();
  const tableSection = doc.match(/## 2\. Source-of-Truth API Decision Table[\s\S]*?(?=## \d)/);
  assert.ok(tableSection, 'decision table section must exist');
  const section = tableSection[0];
  assert.ok(section.includes('fetchPublicMomentReactionSummary'), 'guest row uses public reaction summary');
  assert.ok(section.includes('fetchPublicMomentComments'), 'guest row uses public comments');
  assert.ok(section.includes('fetchReactionSummary'), 'auth row references private reaction summary');
  assert.ok(section.includes('toggleReaction'), 'auth row references toggleReaction');
  assert.ok(section.includes('createComment'), 'auth row references createComment');
});

test('guest gate: no private social request for guest or auth-not-ready state', () => {
  const doc = readDoc();
  const tableSection = doc.match(/## 2\. Source-of-Truth API Decision Table[\s\S]*?(?=## \d)/);
  assert.ok(tableSection, 'decision table section must exist');
  const section = tableSection[0];
  // Guest row must not reference private read/write methods — find the guest line
  const guestLine = section.split('\n').filter(function(line) {
    return line.includes('Guest / no auth');
  })[0] || '';
  assert.ok(!guestLine.includes('fetchReactionSummary'), 'guest must not use private reaction summary');
  assert.ok(!guestLine.includes('toggleReaction'), 'guest must not use toggleReaction');
  assert.ok(!guestLine.includes('createComment'), 'guest must not use createComment');
  assert.ok(!guestLine.includes('fetchComments'), 'guest must not use private fetchComments');

  // Auth not ready row = same as guest
  assert.ok(section.includes('Auth unknown / not ready'), 'auth-not-ready state row exists');
});

test('public-comments-only display rule: always use guest-safe reader', () => {
  const doc = readDoc();
  const displayRuleSection = doc.match(/### Display Rule[\s\S]*?(?=## \d)/);
  assert.ok(displayRuleSection, 'Display Rule subsection must exist');
  const rule = displayRuleSection[0];
  assert.ok(rule.includes('fetchPublicMomentComments'), 'must reference public comments reader');
  assert.ok(rule.includes('fetchComments'), 'must reference private fetchComments as excluded');
  assert.ok(rule.includes('account‑scoped'), 'must mention account-scoped fields concern');
});

test('authenticated write boundary requirements present', () => {
  const doc = readDoc();
  const writeSection = doc.match(/## 3\. Authenticated Write Boundaries[\s\S]*?(?=## \d)/);
  assert.ok(writeSection, 'authenticated write boundaries section must exist');
  const section = writeSection[0];
  assert.ok(/explicit user activation/i.test(section), 'must require explicit user activation');
  assert.ok(/authenticated session/i.test(section), 'must require confirmed auth session');
  assert.ok(section.includes('toggleReaction'), 'must reference toggleReaction');
  assert.ok(section.includes('createComment'), 'must reference createComment');
  assert.ok(section.includes('idempotencyKey'), 'must reference idempotency key');
});

test('controlled lifecycle protocol references #3192 and safe reporting rules', () => {
  const doc = readDoc();
  const protocolSection = doc.match(/## 4\. Controlled Runtime Verification Protocol[\s\S]*?(?=## \d)/);
  assert.ok(protocolSection, 'controlled lifecycle protocol section must exist');
  const section = protocolSection[0];
  assert.ok(section.includes('#3192'), 'must reference #3192');
  assert.ok(/not.*established by #3192/i.test(section), 'must clarify protocol is not from #3192');
  assert.ok(/reversible/i.test(section), 'must mention reversible reaction lifecycle');
  assert.ok(/comment lifecycle/i.test(section), 'must mention controlled comment lifecycle');
  assert.ok(/PASS \/ BLOCKED \/ FAIL/i.test(section), 'must specify outcome categories');
  assert.ok(/Never/i.test(section), 'must have a Never-listing of forbidden report content');
});

test('permanent exclusions present', () => {
  const doc = readDoc();
  const exclusionsSection = doc.match(/## 5\. Permanent Exclusions[\s\S]*?(?=## \d)/);
  assert.ok(exclusionsSection, 'permanent exclusions section must exist');
  const section = exclusionsSection[0];
  assert.ok(/composer|drawer|sign‑in|optimistic mutation/i.test(section), 'must exclude write UI');
  assert.ok(/backend|API|DB|schema|migration|config|package|deployment/i.test(section), 'must exclude backend/config changes');
  assert.ok(/Browse|My Trees|tree‑level social|moderation/i.test(section), 'must exclude Browse/My Trees changes');
  assert.ok(/Direct SQL|database inspection|real‑user data|runtime|production/i.test(section), 'must exclude DB/real-user/runtime changes');
});

// ---------------------------------------------------------------------------
// Tightened callback-boundary contract tests
// ---------------------------------------------------------------------------

test('public viewer detail-ui accepts only public callbacks in read-only boundary, and accepts private callbacks in auth boundary', () => {
  const src = readSource('js/viewer/public-viewer-detail-ui.js');

  // Must consume deps.fetchPublicMomentReactionSummary (exact dep source)
  assert.ok(src.includes('deps.fetchPublicMomentReactionSummary'),
    'must consume deps.fetchPublicMomentReactionSummary');

  // Must consume deps.fetchPublicMomentComments (exact dep source)
  assert.ok(src.includes('deps.fetchPublicMomentComments'),
    'must consume deps.fetchPublicMomentComments');

  // Must consume deps.fetchReactionSummary (private read) for auth boundary
  assert.ok(src.includes('deps.fetchReactionSummary'),
    'must consume deps.fetchReactionSummary for auth boundary');

  // Must not accept deps.fetchComments (private read — not used)
  assert.ok(!src.includes('deps.fetchComments') &&
    !src.includes("deps['fetchComments']"),
    'must not accept deps.fetchComments');

  // Must reference toggleReaction (private write) for auth boundary
  assert.ok(src.includes('toggleReaction'),
    'must reference toggleReaction in auth boundary');

  // Must not reference createComment
  assert.ok(!src.includes('createComment'), 'must not reference createComment');
});

test('canvas-entry.js injects public callbacks and new auth private callbacks', () => {
  const src = readSource('js/viewer/public-viewer-canvas-entry.js');

  // Must inject exact pairing: fetchPublicMomentReactionSummary: typeof apiClient.fetchPublicMomentReactionSummary
  assert.ok(src.includes('fetchPublicMomentReactionSummary: typeof apiClient.fetchPublicMomentReactionSummary'),
    'canvas-entry must inject exact public reaction pairing');

  // Must inject exact pairing: fetchPublicMomentComments: typeof apiClient.fetchPublicMomentComments
  assert.ok(src.includes('fetchPublicMomentComments: typeof apiClient.fetchPublicMomentComments'),
    'canvas-entry must inject exact public comments pairing');

  // Must inject private fetchReactionSummary from apiClient for auth boundary
  assert.ok(src.includes('apiClient.fetchReactionSummary'),
    'canvas-entry must inject private fetchReactionSummary for auth boundary');

  // Must not inject private fetchComments from apiClient
  assert.ok(!src.includes('apiClient.fetchComments') &&
    !src.includes("apiClient['fetchComments']"),
    'canvas-entry must not inject private fetchComments');

  // Must reference toggleReaction for auth boundary
  assert.ok(src.includes('toggleReaction'), 'toggleReaction present in canvas-entry for auth boundary');
  // Must not reference createComment
  assert.ok(!src.includes('createComment'), 'no createComment in canvas-entry');
});

test('canvas-init.js injects public callbacks and includes safe auth private callbacks in fallback', () => {
  const src = readSource('js/viewer/public-canvas-init.js');

  // Must inject exact pairing: fetchPublicMomentReactionSummary: typeof apiClient.fetchPublicMomentReactionSummary
  assert.ok(src.includes('fetchPublicMomentReactionSummary: typeof apiClient.fetchPublicMomentReactionSummary'),
    'canvas-init must inject exact public reaction pairing');

  // Must inject exact pairing: fetchPublicMomentComments: typeof apiClient.fetchPublicMomentComments
  assert.ok(src.includes('fetchPublicMomentComments: typeof apiClient.fetchPublicMomentComments'),
    'canvas-init must inject exact public comments pairing');

  // Must not reference apiClient.fetchReactionSummary (uses safe fallback function)
  assert.ok(!src.includes('apiClient.fetchReactionSummary') &&
    !src.includes("apiClient['fetchReactionSummary']"),
    'canvas-init must not call apiClient.fetchReactionSummary directly');

  // Must not inject private fetchComments from apiClient
  assert.ok(!src.includes('apiClient.fetchComments') &&
    !src.includes("apiClient['fetchComments']"),
    'canvas-init must not inject private fetchComments');

  // Must not reference toggleReaction via apiClient (uses safe fallback function)
  assert.ok(!src.includes('apiClient.toggleReaction') &&
    !src.includes("apiClient['toggleReaction']"),
    'canvas-init must not call apiClient.toggleReaction directly');

  // Must not reference createComment
  assert.ok(!src.includes('createComment'), 'no createComment in canvas-init');
});

test('postgres-client.js exposes public read methods and separate private methods', () => {
  const src = readSource('js/postgres-client.js');
  // Public read methods
  assert.ok(src.includes('fetchPublicMomentReactionSummary'), 'postgres-client must expose fetchPublicMomentReactionSummary');
  assert.ok(src.includes('fetchPublicMomentComments'), 'postgres-client must expose fetchPublicMomentComments');
  // Private auth write methods
  assert.ok(src.includes('toggleReaction'), 'postgres-client must expose toggleReaction');
  assert.ok(src.includes('createComment'), 'postgres-client must expose createComment');
  // Private read methods (for authenticated viewer state)
  assert.ok(src.includes('fetchReactionSummary'), 'postgres-client must expose private fetchReactionSummary');
  assert.ok(src.includes('fetchComments'), 'postgres-client must expose private fetchComments');
});

// ---------------------------------------------------------------------------
// Regression assertions
// ---------------------------------------------------------------------------

test('document does not contain forbidden phrases', () => {
  const doc = readDoc();

  // Must not describe #3192 as "fixture governance"
  assert.ok(!doc.includes('fixture governance'),
    'document must not say fixture governance');

  // Must not describe #1882 as "live integration test harness"
  assert.ok(!doc.includes('live integration test harness'),
    'document must not say live integration test harness');

  // Must not say "established in #3192"
  assert.ok(!doc.includes('established in #3192'),
    'document must not say established in #3192');

  // Must not use Closes/Fixes/Resolves #1882
  assert.ok(!doc.includes('Fixes #1882'), 'must not use Fixes #1882');
  assert.ok(!doc.includes('Closes #1882'), 'must not use Closes #1882');
  assert.ok(!doc.includes('Resolves #1882'), 'must not use Resolves #1882');
});

test('source files uphold #1882 wording rule', () => {
  const srcs = [
    readSource('js/viewer/public-viewer-detail-ui.js'),
    readSource('js/viewer/public-viewer-canvas-entry.js'),
    readSource('js/viewer/public-canvas-init.js'),
    readSource('js/postgres-client.js')
  ];
  srcs.forEach(function(src, i) {
    assert.ok(!src.includes('Fixes #1882'), 'source ' + i + ' must not use Fixes #1882');
    assert.ok(!src.includes('Closes #1882'), 'source ' + i + ' must not use Closes #1882');
    assert.ok(!src.includes('Resolves #1882'), 'source ' + i + ' must not use Resolves #1882');
  });
});
