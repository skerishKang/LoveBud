// Gate A moment-social-write smoke runner (Issue #3334).
//
// Controlled, fixture-based runtime smoke for the Gate A verification (#3264).
// Verifies the authenticated public social-write path (reaction + comment)
// against a separately approved dedicated public fixture (provisioned in #3270)
// through the opaque private operator path only.
//
// This script NEVER:
//   - hard-codes fixture IDs, tree IDs, memory IDs, account IDs, URLs, or creds;
//   - creates fixtures or any production content;
//   - activates the tree runtime writer;
//   - deploys Modal / Cloudflare;
//   - prints raw identifiers, tokens, bodies, headers, audit rows, or secrets.
//
// It reads ONLY opaque env inputs supplied by the operator via a private
// secret channel. Missing required inputs => fail-closed (BLOCKED).
//
// Allowed output is strictly the typed, sanitized Gate A evidence block:
//   smokeStatus / reactionWrite / commentWrite / publicVisibility /
//   legacyCompatibility / genericTargetIntegrity / triggerCompatibility /
//   secret/private exposure
//
// Refs: #3334, #3264, #3188, #3075, #1882

import process from 'node:process';

// ─── Opaque operator env inputs ───────────────────────────────────────────────
// GATE_A_API_BASE      : base URL of the API proxy (operator-supplied, e.g. https://lovebud.pages.dev)
// GATE_A_MEMORY_ID     : opaque fixture target memory id (operator-supplied)
// GATE_A_TREE_ID       : opaque fixture parent tree id (operator-supplied)
// GATE_A_AUTHORIZATION : opaque Firebase bearer token (operator-supplied, NEVER logged)
// GATE_A_REACTION_KEY  : idempotency key for the reaction write (operator-supplied)
// GATE_A_COMMENT_KEY   : idempotency key for the comment write (operator-supplied)
// GATE_A_TIMEOUT_MS    : optional request timeout (default 30000)

const EVIDENCE = {
  smokeStatus: 'NOT_RUN',
  reactionWrite: 'NOT_RUN',
  commentWrite: 'NOT_RUN',
  publicVisibility: 'NOT_RUN',
  legacyCompatibility: 'NOT_RUN',
  genericTargetIntegrity: 'NOT_RUN',
  triggerCompatibility: 'NOT_RUN',
  'secret/private exposure': 'NONE',
};

function emit() {
  for (const [key, value] of Object.entries(EVIDENCE)) {
    process.stdout.write(`${key}: ${value}\n`);
  }
}

function fail() {
  if (!EVIDENCE.smokeStatus.startsWith('BLOCKED')) {
    EVIDENCE.smokeStatus = 'FAIL';
  }
  emit();
}

const REQUIRED_ENV = [
  'GATE_A_API_BASE',
  'GATE_A_MEMORY_ID',
  'GATE_A_TREE_ID',
  'GATE_A_AUTHORIZATION',
  'GATE_A_REACTION_KEY',
  'GATE_A_COMMENT_KEY',
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    // Fail closed. Emit ONLY the typed evidence block — no env names, no
    // detail, no stderr. Per Gate A contract (#3334), nothing outside the
    // approved block may be printed on any channel.
    EVIDENCE.smokeStatus = 'BLOCKED_MISSING_ENV';
    emit();
    return false;
  }
  return true;
}

function baseUrl() {
  return String(process.env.GATE_A_API_BASE).replace(/\/+$/, '');
}

function headers() {
  // Opaque operator token passed through; never echoed, logged, or stored.
  return {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: `Bearer ${process.env.GATE_A_AUTHORIZATION}`,
  };
}

function idemHeaders(key) {
  return { ...headers(), 'Idempotency-Key': key };
}

async function safeFetch(url, init) {
  const ctrl = new AbortController();
  const timeout = Number(process.env.GATE_A_TIMEOUT_MS || 30000);
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function is2xx(status) {
  return status >= 200 && status < 300;
}

// Verify the fixture target is publicly visible (guest-safe GET, no auth).
// 2xx => public path reachable; non-2xx => public visibility not satisfied.
async function checkPublicVisibility() {
  const url = `${baseUrl()}/api/trees/${encodeURIComponent(process.env.GATE_A_TREE_ID)}/memories/${encodeURIComponent(process.env.GATE_A_MEMORY_ID)}/reactions`;
  try {
    const res = await safeFetch(url, { method: 'GET' });
    EVIDENCE.publicVisibility = is2xx(res.status) ? 'PASS' : 'FAIL';
  } catch (err) {
    EVIDENCE.publicVisibility = 'FAIL';
  }
}

async function runReaction() {
  const url = `${baseUrl()}/api/memories/${encodeURIComponent(process.env.GATE_A_MEMORY_ID)}/reactions`;
  try {
    const res = await safeFetch(url, {
      method: 'POST',
      headers: idemHeaders(process.env.GATE_A_REACTION_KEY),
      body: JSON.stringify({ type: 'like' }),
    });
    // Accept 2xx. Also accept 409/conflict-style idempotency replay as PASS.
    EVIDENCE.reactionWrite = is2xx(res.status) || res.status === 409 ? 'PASS' : 'FAIL';
  } catch (err) {
    EVIDENCE.reactionWrite = 'FAIL';
  }
}

async function runComment() {
  const url = `${baseUrl()}/api/memories/${encodeURIComponent(process.env.GATE_A_MEMORY_ID)}/comments`;
  try {
    const res = await safeFetch(url, {
      method: 'POST',
      headers: idemHeaders(process.env.GATE_A_COMMENT_KEY),
      body: JSON.stringify({ body: 'Gate A controlled smoke comment.' }),
    });
    EVIDENCE.commentWrite = is2xx(res.status) || res.status === 409 ? 'PASS' : 'FAIL';
  } catch (err) {
    EVIDENCE.commentWrite = 'FAIL';
  }
}

async function main() {
  if (!checkEnv()) {
    process.exit(0); // BLOCKED_MISSING_ENV already emitted.
  }
  // legacyCompatibility / genericTargetIntegrity / triggerCompatibility are
  // aggregate-only post-apply schema checks (#3264). This runtime smoke
  // cannot assert DB schema state without the operator DB path; they remain
  // NOT_RUN here and are covered by the runbook queries.
  EVIDENCE.legacyCompatibility = 'NOT_RUN';
  EVIDENCE.genericTargetIntegrity = 'NOT_RUN';
  EVIDENCE.triggerCompatibility = 'NOT_RUN';

  try {
    await checkPublicVisibility();
    if (EVIDENCE.publicVisibility !== 'PASS') {
      EVIDENCE.smokeStatus = 'BLOCKED_FIXTURE_VISIBILITY';
      emit();
      process.exit(0);
    }
    await runReaction();
    await runComment();

    const wrote = EVIDENCE.reactionWrite === 'PASS' && EVIDENCE.commentWrite === 'PASS';
    EVIDENCE.smokeStatus = wrote ? 'PASS' : 'FAIL';
  } catch (err) {
    // Never echo raw error internals (may contain request/response bodies).
    EVIDENCE.smokeStatus = 'FAIL';
  }
  emit();
}

main();
