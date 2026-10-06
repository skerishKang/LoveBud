'use strict';

/**
 * Contract: reusable QA credential material must not be distributed through
 * public Git, and no documentation may present the retired channel as a
 * current credential source (Issue #4545).
 *
 * Guards:
 * - Guard A: no credential-bearing artifact is tracked under the retired
 *   channel directory, and the bounded recommit guard (`.gitignore`) exists.
 *   `git ls-files` is the deterministic local source authority, matching the
 *   secret-safe tracked-file detection command already published in
 *   docs/engineering/LARGE_FILE_MODULARIZATION_CANDIDATES.md.
 * - Guard B: active credential documentation must not contain current restore
 *   authority (bundle fetch, extraction, password acquisition, recommit,
 *   rotation-by-committing-bundle) and must name the approved private shared
 *   store as the current recovery authority plus a separately-authorized rotation statement.
 *
 * Safety properties of this file:
 * - It never opens, lists contents of, extracts, or inspects any credential
 *   archive. The retired archive path is a string constant only.
 * - It never reads `.local/test-accounts.json` or any credential-bearing file.
 * - Failure messages report a rule id and a line number only; document line
 *   text is never echoed, so no credential value can reach a log or CI output.
 * - It contacts no network, provider, database, browser, or deployment target.
 *
 * Refs: #4545, #873
 * Evidence layer: SOURCE_STATIC.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// ─── Constants ──────────────────────────────────────────────────────────────

const RETIRED_CHANNEL_DIR = 'docs/ops/qa-credential-bundle';
const TOMBSTONE_REL = `${RETIRED_CHANNEL_DIR}/README.md`;
const LEGACY_BUNDLE_REL = `${RETIRED_CHANNEL_DIR}/test-accounts-encrypted.zip`;
const LEGACY_AGE_REL = `${RETIRED_CHANNEL_DIR}/test-accounts.json.age`;

// Credential-bearing extensions that may never be tracked inside the channel.
const CHANNEL_ARTIFACT_EXTENSIONS = ['.zip', '.age', '.json'];

// Only this non-secret tombstone may remain tracked inside the channel.
const CHANNEL_ALLOWED_TRACKED = [TOMBSTONE_REL];

// Bounded recommit guard. Deliberately scoped: a global `*.zip` / `*.age` /
// `*.json` ignore would hide legitimate repository assets and is forbidden.
const REQUIRED_IGNORE_RULES = [
  `${RETIRED_CHANNEL_DIR}/*.zip`,
  `${RETIRED_CHANNEL_DIR}/*.age`,
  `${RETIRED_CHANNEL_DIR}/*.json`,
];

// Patterns that would make a global credential-file ignore dangerous.
const FORBIDDEN_GLOBAL_IGNORE_RULES = ['*.zip', '*.age', '*.json'];

// Docs that must never name the retired channel as a current credential
// location. The tombstone and the historical note are handled separately.
const AUTHORITY_DOCS = [
  'docs/ops/QA_CREDENTIALS.md',
  'docs/ops/QA_CREDENTIALS.txt',
  'docs/ops/QA_ACCOUNT_REGISTRY.md',
  'docs/ops/SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md',
];

// Docs additionally required to name the approved non-public credential store
// as the current authority.
const CURRENT_AUTHORITY_DOCS = [...AUTHORITY_DOCS];

// Docs where the retired archive filename itself must not appear as a
// location reference. The historical note lives in the tombstone and in
// QA_CREDENTIALS.md, which are excluded here.
const ARCHIVE_PATH_FREE_DOCS = [
  'docs/ops/QA_ACCOUNT_REGISTRY.md',
  'docs/ops/SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md',
];

// ─── Guard B rule corpus ────────────────────────────────────────────────────
//
// Every rule targets a concrete pre-remediation shape (or a future
// reintroduction of it) so the tombstone and historical notes — which discuss
// the retired channel in the negative — do not trip the guard.

const RESTORE_AUTHORITY_RULES = [
  { id: 'CURRENT_BUNDLE_STATUS', re: /persistent encrypted bundle\s*:\s*(?:committed|커밋됨)/i },
  { id: 'CURRENT_BUNDLE_STATUS', re: /\*\*persistent encrypted bundle\*\*/i },
  { id: 'BUNDLE_AS_CURRENT_WORKING_METHOD', re: /current working method[^\n]*persistent encrypted bundle/i },
  { id: 'BUNDLE_RESTORE_CLAIM', re: /can\s+restore credentials\*{0,2}\s*from the bundle/i },
  { id: 'PERSISTENT_RESTORE_PROCEDURE', re: /persistent restore procedure/i },
  { id: 'BUNDLE_FETCH_VIA_GIT', re: /\bgit\s+(?:clone|pull|checkout|fetch)\b[^\n]*qa-credential-bundle/i },
  { id: 'BUNDLE_LOCATE_STEP', re: /\blocate bundle\b/i },
  { id: 'BUNDLE_EXISTS_PROBE', re: /\.zip exist in repo/i },
  { id: 'BUNDLE_EXTRACT_STEP', re: /extract using the bundle password/i },
  { id: 'BUNDLE_ARCHIVE_EXTRACT_COMMAND', re: /\b(?:unzip|7z|7za|bsdtar|tar\s+-x)\b[^\n]*qa-credential/i },
  { id: 'BUNDLE_PASSWORD_ACQUISITION', re: /obtain the bundle password/i },
  { id: 'BUNDLE_PASSWORD_ACQUISITION', re: /번들\s*custodian에게\s*비밀번호\s*수령/ },
  { id: 'BUNDLE_PRESENCE_CHECK_KO', re: /qa-credential-bundle\/[^\s`)]*\.zip[^\n]{0,20}존재 확인/ },
  { id: 'USE_PERSISTENT_BUNDLE', re: /use the persistent bundle/i },
  { id: 'REPO_WILL_CONTAIN_BUNDLE', re: /will contain only encrypted bundle/i },
  { id: 'ROTATION_BY_COMMITTING_BUNDLE', re: /create new encrypted bundle/i },
  { id: 'ROTATION_BY_COMMITTING_BUNDLE', re: /\bzip\s+-P\b/i },
  { id: 'ROTATION_BY_COMMITTING_BUNDLE', re: /commit the (?:updated |new )?bundle/i },
  { id: 'ROTATION_BY_COMMITTING_BUNDLE', re: /notify verifiers of new bundle availability/i },
  { id: 'BUNDLE_INTEGRITY_VERIFICATION', re: /verify bundle integrity/i },
  { id: 'BUNDLE_COMMIT_STATUS_FIELD', re: /bundle committed to repo/i },
  { id: 'BUNDLE_CREDENTIAL_SOURCE', re: /credential source:\s*persistent bundle/i },
  { id: 'BUNDLE_CREDENTIAL_SOURCE', re: /restored from persistent encrypted bundle/i },
  { id: 'BUNDLE_CREDENTIAL_SOURCE', re: /restored from (?:handoff|bundle)\/bundle/i },
  { id: 'TIER2_ENCRYPTED_BACKUP_IN_REPO', re: /Tier 2\*{0,2}\s*—\s*\*{0,2}\s*Encrypted backup/i },
  { id: 'BUNDLE_PATH_AS_NOTES_FIELD', re: /^[ \t]*bundle:[ \t]*docs\/ops\/qa-credential-bundle/im },
];

// Positive statements the authority docs must make.
const REQUIRED_AUTHORITY_PATTERNS = [
  {
    id: 'APPROVED_PRIVATE_SHARED_STORE_NAMED',
    re: /approved (?:private|non-public) shared credential store|Google Drive-backed operator share/i,
    message: 'must name the approved private shared credential store as current recovery custody',
  },
  {
    id: 'ROTATION_REQUIRES_SEPARATE_AUTHORITY',
    re: /ROTATION_STATUS=ROTATION_REQUIRED|separately authoriz/i,
    message: 'must state that credential rotation requires separate authorization',
  },
];

// Tombstone status keys that must survive the remediation.
const REQUIRED_TOMBSTONE_KEYS = [
  'STATUS=RETIRED_PUBLIC_GIT_CREDENTIAL_CHANNEL',
  'NO_CREDENTIAL_MATERIAL_TRACKED_HERE',
  'APPROVED_CURRENT_SOURCE=',
  'HISTORICAL_NOTE=',
  'HISTORICAL_GIT_COPY=NONAUTHORITATIVE',
  'ROTATION_STATUS=ROTATION_REQUIRED',
  'DO_NOT=',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function read(rel) {
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), `Expected file to exist: ${rel}`);
  // Normalize CRLF so every regex and line number below is line-ending agnostic.
  // This repository checks out text blobs with CRLF on Windows and LF on Linux.
  return fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
}

function splitLines(text) {
  return text.split(/\r\n|\n/);
}

/**
 * Deterministic local source authority: tracked paths from the git index.
 * Fails closed — if git cannot answer, this throws and the guard fails.
 */
function readTrackedPaths() {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '-z', '--full-name', RETIRED_CHANNEL_DIR], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`GIT_TRACKED_PATH_QUERY_FAILED: ${(err && err.code) || 'unknown'}`);
  }
  return out.split('\0').map((s) => s.trim()).filter(Boolean);
}

function isCredentialArtifactPath(trackedPath) {
  const lower = trackedPath.toLowerCase();
  return CHANNEL_ARTIFACT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Pure: credential artifacts present in a tracked-path list. */
function findTrackedCredentialArtifacts(trackedPaths) {
  return trackedPaths.filter(isCredentialArtifactPath).sort();
}

/**
 * Fail-closed wrapper: exit 0 = ignored, exit 1 = not ignored, anything else
 * (including a missing git) throws.
 */
function isIgnoredByGit(relPath) {
  const result = spawnSync('git', ['check-ignore', '-q', '--', relPath], { cwd: ROOT, timeout: 20000 });
  if (result.error) {
    throw new Error('GIT_CHECK_IGNORE_FAILED');
  }
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`GIT_CHECK_IGNORE_UNEXPECTED_STATUS`);
}

/** Pure: restore-authority rule hits in a document. Reports id + line only. */
function findRestoreAuthorityHits(text) {
  const hits = [];
  const lines = splitLines(text);
  lines.forEach((line, index) => {
    for (const rule of RESTORE_AUTHORITY_RULES) {
      if (rule.re.test(line)) {
        hits.push({ ruleId: rule.id, line: index + 1 });
      }
    }
  });
  return hits;
}

/** Pure: credential-valued JSON literals in a document. */
function findCredentialValueLiterals(text) {
  const hits = [];
  splitLines(text).forEach((line, index) => {
    const match = /"(email|password|confirmPassword|token|session|cookie|apiKey|secret)"\s*:\s*"([^"]*)"/i.exec(line);
    if (match && match[2] && !/^REDACTED$/i.test(match[2])) {
      hits.push({ field: match[1], line: index + 1 });
    }
  });
  return hits;
}

// ─── Guard A: tracked credential artifact ban ───────────────────────────────

test('A1. the tracked query helper returns repository paths, not contents', () => {
  const tracked = readTrackedPaths();
  assert.ok(Array.isArray(tracked), 'tracked path list must be an array');
  for (const p of tracked) {
    assert.ok(typeof p === 'string' && p.length > 0, 'tracked entry must be a non-empty path string');
    assert.ok(!p.includes('\n') && !p.includes('\0'), 'tracked entry must be a single path');
  }
});

test('A2. no reusable credential artifact is tracked in the retired channel', () => {
  const tracked = readTrackedPaths();
  const artifacts = findTrackedCredentialArtifacts(tracked);
  assert.deepEqual(
    artifacts,
    [],
    `TRACKED_REUSABLE_CREDENTIAL_ARCHIVES must be 0; tracked credential artifacts found: ${artifacts.length}`
  );
});

test('A3. the retired encrypted bundle is not tracked at the current tip', () => {
  const tracked = readTrackedPaths();
  assert.ok(
    !tracked.includes(LEGACY_BUNDLE_REL),
    `${LEGACY_BUNDLE_REL} must not be tracked at the current tip`
  );
});

test('A4. the legacy .age channel artifact is not tracked', () => {
  const tracked = readTrackedPaths();
  assert.ok(!tracked.includes(LEGACY_AGE_REL), `${LEGACY_AGE_REL} must not be tracked`);
});

test('A5. the channel tracks only its non-secret tombstone README', () => {
  const tracked = readTrackedPaths();
  const unexpected = tracked.filter((p) => !CHANNEL_ALLOWED_TRACKED.includes(p));
  assert.deepEqual(
    unexpected,
    [],
    `unexpected tracked paths in ${RETIRED_CHANNEL_DIR}: ${unexpected.length}`
  );
  assert.ok(tracked.includes(TOMBSTONE_REL), `${TOMBSTONE_REL} must remain tracked`);
});

test('A6. the channel directory is retained as a tombstone and holds no artifact on disk', () => {
  assert.ok(fs.existsSync(path.join(ROOT, RETIRED_CHANNEL_DIR)), `${RETIRED_CHANNEL_DIR} must be retained`);
  // Path names only. No archive is opened, listed, or extracted.
  const entries = fs.readdirSync(path.join(ROOT, RETIRED_CHANNEL_DIR));
  const artifacts = entries.filter((name) => isCredentialArtifactPath(name));
  assert.deepEqual(
    artifacts,
    [],
    `credential artifacts present in the channel directory: ${artifacts.length}`
  );
  assert.ok(entries.includes('README.md'), 'channel directory must retain its README.md tombstone');
});

test('A7. the secret-safe tracked-file detection command still names the channel', () => {
  const doc = read('docs/engineering/LARGE_FILE_MODULARIZATION_CANDIDATES.md');
  assert.ok(
    doc.includes("git ls-files '.local' 'docs/ops/qa-credential-bundle' '*.zip' '*.age'"),
    'LARGE_FILE_MODULARIZATION_CANDIDATES.md must keep the secret-safe detection command'
  );
  assert.ok(
    /Expected result for reusable credential material: \*\*NONE\*\*/.test(doc),
    'LARGE_FILE_MODULARIZATION_CANDIDATES.md must state the expected detection result is NONE'
  );
});

// ─── Guard A: bounded recommit guard ────────────────────────────────────────

test('A8. .gitignore blocks every credential artifact inside the channel', () => {
  const ignore = read('.gitignore');
  const rules = new Set(
    splitLines(ignore)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  );
  for (const rule of REQUIRED_IGNORE_RULES) {
    assert.ok(rules.has(rule), `.gitignore must contain the bounded rule: ${rule}`);
  }
});

test('A9. .gitignore does not introduce a global credential-extension ignore', () => {
  const ignore = read('.gitignore');
  const rules = new Set(
    splitLines(ignore)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  );
  for (const rule of FORBIDDEN_GLOBAL_IGNORE_RULES) {
    assert.ok(
      !rules.has(rule),
      `.gitignore must not contain a global ignore that would hide legitimate assets: ${rule}`
    );
  }
});

test('A10. the recommit guard actually ignores channel artifacts and keeps the tombstone trackable', () => {
  const probes = [
    { path: LEGACY_BUNDLE_REL, expectIgnored: true },
    { path: LEGACY_AGE_REL, expectIgnored: true },
    { path: `${RETIRED_CHANNEL_DIR}/test-accounts.json`, expectIgnored: true },
    { path: TOMBSTONE_REL, expectIgnored: false },
  ];
  for (const probe of probes) {
    assert.equal(
      isIgnoredByGit(probe.path),
      probe.expectIgnored,
      `${probe.path} ignore expectation mismatch (expected ignored=${probe.expectIgnored})`
    );
  }
});

test('A11. the local runtime credential file stays gitignored', () => {
  assert.ok(isIgnoredByGit('.local/test-accounts.json'), '.local/test-accounts.json must remain gitignored');
});

// ─── Guard B: no current restore authority in documentation ─────────────────

test('B1. credential authority docs contain no current restore authority', () => {
  for (const rel of AUTHORITY_DOCS) {
    const hits = findRestoreAuthorityHits(read(rel));
    assert.deepEqual(
      hits,
      [],
      `${rel} must contain no current restore authority (violations: ${hits.length})`
    );
  }
});

test('B2. the tombstone contains no current restore authority', () => {
  const hits = findRestoreAuthorityHits(read(TOMBSTONE_REL));
  assert.deepEqual(hits, [], `${TOMBSTONE_REL} must contain no current restore authority`);
});

test('B3. the browser-verification entrypoint lists no repository-bundle credential source', () => {
  const rel = 'docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md';
  const hits = findRestoreAuthorityHits(read(rel));
  assert.deepEqual(hits, [], `${rel} must not offer a repository bundle as a credential source`);
});

test('B4. ops agent rules present the channel as retired, not as an allowed credential path', () => {
  const rel = 'docs/ops/AGENTS.md';
  const src = read(rel);
  const hits = findRestoreAuthorityHits(src);
  assert.deepEqual(hits, [], `${rel} must contain no current restore authority`);
  const allowedPathsSection = /## Allowed local paths to reference([\s\S]*?)\n## /.exec(src);
  assert.ok(allowedPathsSection, 'AGENTS.md must keep its allowed-local-paths section');
  const allowedPathEntries = splitLines(allowedPathsSection[1])
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '));
  assert.ok(allowedPathEntries.length > 0, 'AGENTS.md must keep its allowed local path entries');
  for (const entry of allowedPathEntries) {
    assert.ok(
      !entry.includes(RETIRED_CHANNEL_DIR),
      'AGENTS.md must not list the retired credential channel as an allowed local credential path'
    );
  }
  assert.ok(
    /RETIRED public Git credential channel/i.test(src),
    'AGENTS.md must classify the retired channel explicitly'
  );
});

test('B5. authority docs do not present the retired archive filename as a location', () => {
  for (const rel of ARCHIVE_PATH_FREE_DOCS) {
    const src = read(rel);
    assert.ok(
      !src.includes(LEGACY_BUNDLE_REL),
      `${rel} must not present ${LEGACY_BUNDLE_REL} as a credential location`
    );
    assert.ok(
      !src.includes(LEGACY_AGE_REL),
      `${rel} must not present ${LEGACY_AGE_REL} as a credential location`
    );
  }
});

test('B6. authority docs name the approved non-public store and separate rotation authority', () => {
  for (const rel of CURRENT_AUTHORITY_DOCS) {
    const src = read(rel);
    for (const required of REQUIRED_AUTHORITY_PATTERNS) {
      assert.match(
        src,
        required.re,
        `${rel} ${required.message} (missing ${required.id})`
      );
    }
  }
});

test('B7. the tombstone records the retired status, historical fact, and do-not list', () => {
  const src = read(TOMBSTONE_REL);
  for (const key of REQUIRED_TOMBSTONE_KEYS) {
    assert.ok(src.includes(key), `${TOMBSTONE_REL} must contain ${key}`);
  }
  assert.match(
    src,
    /Git history|old commits|tags, or forks/i,
    `${TOMBSTONE_REL} must forbid restoring credentials from Git history`
  );
  assert.match(
    src,
    /HISTORICAL_BLOB_EXISTS_POSSIBLY=YES/,
    `${TOMBSTONE_REL} must record that historical copies may still exist`
  );
  assert.match(
    src,
    /CREDENTIAL_ROTATION_REQUIRED=YES/,
    `${TOMBSTONE_REL} must record that rotation remains required`
  );
});

test('B8. the public-safe account inventory keeps its metadata columns', () => {
  const src = read('docs/ops/QA_ACCOUNT_REGISTRY.md');
  for (const column of [
    'Account Label',
    'Credential Key',
    'Persona',
    'Environment',
    'Status',
    'Sensitivity',
    'custodian',
  ]) {
    assert.ok(src.includes(column), `QA_ACCOUNT_REGISTRY.md must keep the ${column} metadata column`);
  }
  assert.ok(src.includes('QA_PERSONA_A_001'), 'QA_ACCOUNT_REGISTRY.md must retain its account inventory');
  assert.match(src, /Tier 1[^\n]*gitignored|gitignored[^\n]*Tier 1/i, 'QA_ACCOUNT_REGISTRY.md must describe Tier 1 as gitignored');
  assert.match(
    src,
    /approved non-public/i,
    'QA_ACCOUNT_REGISTRY.md must define the approved non-public custody tier'
  );
});

test('B9. the synthetic actor strategy no longer lists a repository archive as an allowed location', () => {
  const src = read('docs/ops/SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md');
  assert.match(
    src,
    /Tier 2 — Approved non-public credential custody/,
    'SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md must redefine Tier 2 as approved non-public custody'
  );
  const allowedTargets = /Allowed target locations:\s*\n\s*```text\n([\s\S]*?)```/.exec(src);
  assert.ok(allowedTargets, 'SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md must keep an allowed-target-locations block');
  assert.ok(
    !allowedTargets[1].includes('qa-credential-bundle'),
    'SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md must not list the retired channel as an allowed target location'
  );
});

test('B10. no authority doc contains a credential value literal', () => {
  for (const rel of [...AUTHORITY_DOCS, TOMBSTONE_REL]) {
    const hits = findCredentialValueLiterals(read(rel));
    assert.deepEqual(
      hits,
      [],
      `${rel} must not contain credential value literals (violations: ${hits.length})`
    );
  }
});

test('B11. no tracked documentation states that a historical copy is authoritative', () => {
  for (const rel of [...AUTHORITY_DOCS, TOMBSTONE_REL, 'docs/ops/AGENTS.md']) {
    const src = read(rel);
    assert.ok(
      !/historical git copy:\s*authoritative/i.test(src),
      `${rel} must not mark the historical Git copy as authoritative`
    );
  }
});

// ─── Controls ───────────────────────────────────────────────────────────────

test('N1. negative control: pre-remediation restore phrasing is detected', () => {
  const legacySnippets = [
    '> **Persistent encrypted bundle: COMMITTED \u2705**',
    '> **Current working method: Persistent encrypted bundle**',
    '> A new verifier **can restore credentials** from the bundle using the password obtained via secure channel from the CTO.',
    '**Persistent restore procedure (only when bundle exists in repo):**',
    '2. Locate bundle: `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip`',
    'Step 1: Does docs/ops/qa-credential-bundle/test-accounts-encrypted.zip exist in repo?',
    '3. Extract using the bundle password obtained via secure channel from bundle custodian',
    '3. Obtain the bundle password via secure channel from the CTO / bundle custodian',
    '2. Create new encrypted bundle: `zip -P <new_password> docs/ops/qa-credential-bundle/test-accounts-encrypted.zip <source.json>`',
    '5. Commit the updated bundle and documentation',
    '6. Notify verifiers of new bundle availability',
    '- Verify bundle integrity after extraction',
    '| **Persistent encrypted bundle** | \u2705 Bundle committed (v1) | docs/ops/qa-credential-bundle/ |',
    'credential source:           persistent bundle',
    '- `restored from persistent encrypted bundle`',
    '| **Tier 2** \u2014 Encrypted backup | `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip` | Cross-machine restore | \u2705 Yes (encrypted) |',
    'bundle: docs/ops/qa-credential-bundle/test-accounts-encrypted.zip',
    '| **Persistent encrypted bundle** | \u2705 \ucf54\ubbf8\ud2b8\ub428 (v1) | `docs/ops/qa-credential-bundle/test-accounts-encrypted.zip` |',
    '- 번들 custodian에게 비밀번호 수령 (안전한 채널)',
    '- git clone https://github.com/skerishKang/LoveBud qa-credential-bundle',
    '- unzip -P <password> docs/ops/qa-credential-bundle/test-accounts-encrypted.zip',
  ];
  const undetected = legacySnippets.filter((snippet) => findRestoreAuthorityHits(snippet).length === 0);
  assert.deepEqual(
    undetected,
    [],
    `Guard B must detect every pre-remediation restore-authority shape (missed: ${undetected.length})`
  );
});

test('N2. negative control: tracked credential artifact detection', () => {
  assert.deepEqual(findTrackedCredentialArtifacts([LEGACY_BUNDLE_REL]), [LEGACY_BUNDLE_REL]);
  assert.deepEqual(findTrackedCredentialArtifacts([LEGACY_AGE_REL]), [LEGACY_AGE_REL]);
  assert.deepEqual(
    findTrackedCredentialArtifacts([`${RETIRED_CHANNEL_DIR}/test-accounts.json`]),
    [`${RETIRED_CHANNEL_DIR}/test-accounts.json`]
  );
  assert.deepEqual(findTrackedCredentialArtifacts([TOMBSTONE_REL]), []);
  assert.deepEqual(findTrackedCredentialArtifacts([]), []);
});

test('N3. negative control: credential value literals are detected', () => {
  assert.deepEqual(findCredentialValueLiterals('"password": "hunter2-placeholder"'), [
    { field: 'password', line: 1 },
  ]);
  assert.deepEqual(findCredentialValueLiterals('"password": "REDACTED"'), []);
  assert.deepEqual(findCredentialValueLiterals('credential schema: OBJECT_MAP'), []);
});

test('P1. positive control: the current tombstone and docs trip no rule', () => {
  const docs = [...AUTHORITY_DOCS, TOMBSTONE_REL, 'docs/ops/AGENTS.md', 'docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md'];
  for (const rel of docs) {
    const hits = findRestoreAuthorityHits(read(rel));
    assert.deepEqual(hits, [], `${rel} must remain rule-clean (violations: ${hits.length})`);
  }
});

test('P2. positive control: the rule corpus itself contains no credential value', () => {
  const corpus = RESTORE_AUTHORITY_RULES.map((r) => String(r.re.source)).join('\n');
  const hits = findCredentialValueLiterals(corpus);
  assert.deepEqual(hits, [], 'rule corpus must not embed a credential value');
  assert.ok(
    !/\b(?:AKIA|sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,})\b/.test(corpus),
    'rule corpus must not embed a token-shaped literal'
  );
});

test('P3. positive control: required positive patterns match current wording', () => {
  for (const required of REQUIRED_AUTHORITY_PATTERNS) {
    const anyDoc = CURRENT_AUTHORITY_DOCS.map((rel) => read(rel)).join('\n');
    assert.match(anyDoc, required.re, `required authority statement ${required.id} must match`);
  }
});
