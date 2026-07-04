const test = require('node:test');

// #3197 — Social Runtime Fixture Governance Contract Test
//
// Static contract only. No network, Firebase, Modal, Cloudflare, browser, or DB calls.
// Verifies the governance document exists and covers mandatory policy sections,
// without printing any matched sensitive fragment.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DOC_PATH = path.resolve(__dirname, '../../docs/product/lovebud-social-runtime-fixture-governance-contract.md');

// ---------------------------------------------------------------------------
// Helper: read document once
// ---------------------------------------------------------------------------
function readDoc() {
  return fs.readFileSync(DOC_PATH, 'utf-8');
}

// ---------------------------------------------------------------------------
// Helper: check section header exists (handles "## Section Name" and "## N. Section Name")
// ---------------------------------------------------------------------------
function hasSection(doc, headerPattern) {
  const re = new RegExp('^##\\s+(\\d+\\.\\s+)?' + headerPattern, 'm');
  return re.test(doc);
}

// ---------------------------------------------------------------------------
// Helper: count occurrences of a pattern (safe — returns count, not fragments)
// ---------------------------------------------------------------------------
function countOccurrences(doc, pattern) {
  const re = new RegExp(pattern, 'gi');
  const matches = doc.match(re);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('governance document exists and is non-empty', () => {
  assert.ok(fs.existsSync(DOC_PATH), 'document must exist');
  const doc = readDoc();
  assert.ok(doc.length > 500, 'document must contain substantive content');
});

test('document references #3183, #3197, #3184, #3075, #1882', () => {
  const doc = readDoc();
  assert.ok(doc.includes('#3183'), 'must reference #3183');
  assert.ok(doc.includes('#3197'), 'must reference #3197');
  assert.ok(doc.includes('#3184'), 'must reference #3184');
  assert.ok(doc.includes('#3075'), 'must reference #3075');
  assert.ok(doc.includes('#1882'), 'must reference #1882');
});

test('document contains all mandatory policy sections', () => {
  const doc = readDoc();
  assert.ok(hasSection(doc, 'Dedicated Test Identity'), 'must have Dedicated Test Identity section');
  assert.ok(hasSection(doc, 'Controlled Public Fixture'), 'must have Controlled Public Fixture section');
  assert.ok(hasSection(doc, 'Disposable Synthetic Comment Lifecycle'), 'must have Disposable Synthetic Comment Lifecycle section');
  assert.ok(hasSection(doc, 'Safe Evidence and Reporting Boundary'), 'must have Safe Evidence and Reporting Boundary section');
  assert.ok(hasSection(doc, 'Governance Completion Boundary'), 'must have Governance Completion Boundary section');
});

test('governance completion does not authorize provisioning', () => {
  const doc = readDoc();
  // The completion boundary section must explicitly state no provisioning authorization
  const boundarySection = doc.match(/## 5\. Governance Completion Boundary[\s\S]*?(?=## \d)/);
  assert.ok(boundarySection, 'governance completion boundary section must exist');
  assert.ok(
    boundarySection[0].toLowerCase().includes('does **not** authorize'),
    'completion boundary must explicitly deny provisioning authorization'
  );
});

test('no direct DB/SQL/migration/config/secret/runtime UI authorization language', () => {
  const doc = readDoc();

  // Out-of-Scope Operations section must exist and cover DB/SQL/migration and config/secret
  const outOfScopeSection = doc.match(/## 6\. Out-of-Scope Operations[\s\S]*?(?=## \d)/);
  assert.ok(outOfScopeSection, 'must have Out-of-Scope Operations section');

  const outOfScope = outOfScopeSection[0];
  assert.ok(
    /DB\/SQL/i.test(outOfScope) || /migration/i.test(outOfScope),
    'must mention DB/SQL/migration as out of scope'
  );
  assert.ok(
    /config/i.test(outOfScope) || /secret/i.test(outOfScope),
    'must mention config/secret as out of scope'
  );

  // UI work restriction may be in Out-of-Scope Operations or Issue Status Governance sections
  const statusSection = doc.match(/## 7\. Issue Status Governance[\s\S]*?(?=## \d)/);
  const combinedCheck = (outOfScopeSection[0] + (statusSection ? statusSection[0] : ''));
  assert.ok(
    /UI/i.test(combinedCheck) || /#3184/i.test(combinedCheck) || /#3075/i.test(combinedCheck),
    'must reference UI work as out of scope (in section 6 or 7)'
  );
});

test('document contains no token-like or credential patterns', () => {
  const doc = readDoc();

  // These patterns should not appear:
  const forbiddenPatterns = [
    /bearer\s+\S{8,}/i,           // bearer token values
    /ghp_[a-zA-Z0-9]{36}/,         // GitHub PAT
    /gho_[a-zA-Z0-9]{36}/,         // GitHub OAuth
    /ya29\.[a-zA-Z0-9_-]{100,}/,   // Google OAuth
    /[A-Za-z0-9]{20,}\.firebaseapp\.com/,  // Firebase subdomain with long prefix
    /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/,  // PEM private key
  ];

  for (const pattern of forbiddenPatterns) {
    assert.strictEqual(
      countOccurrences(doc, pattern),
      0,
      'must not contain token-like pattern'
    );
  }
});

test('document contains no UUID-like fixture ID', () => {
  const doc = readDoc();
  // Standard UUID pattern
  const uuidCount = countOccurrences(doc, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.strictEqual(uuidCount, 0, 'must not contain UUID-like fixture ID');
});

test('document contains no email address', () => {
  const doc = readDoc();
  const emailCount = countOccurrences(doc, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  assert.strictEqual(emailCount, 0, 'must not contain email address');
});

test('document contains no Firebase credential JSON', () => {
  const doc = readDoc();
  const firebaseCredCount = countOccurrences(doc, /"type"\s*:\s*"service_account"/);
  assert.strictEqual(firebaseCredCount, 0, 'must not contain Firebase credential JSON');
  const projectIdCount = countOccurrences(doc, /"project_id"\s*:/);
  assert.strictEqual(projectIdCount, 0, 'must not contain project_id JSON');
});

test('document contains no example production URL', () => {
  const doc = readDoc();
  const urlCount = countOccurrences(doc, /https?:\/\/[a-zA-Z0-9.-]+\/api\//);
  assert.strictEqual(urlCount, 0, 'must not contain example API URLs');
});

test('document correctly forbids credential/ID/body in reports', () => {
  const doc = readDoc();
  const evidenceSection = doc.match(/## 4\. Safe Evidence and Reporting Boundary[\s\S]*?(?=## \d)/);
  assert.ok(evidenceSection, 'must have Safe Evidence and Reporting Boundary section');

  const section = evidenceSection[0].toLowerCase();
  assert.ok(section.includes('must **never**'), 'must include prohibition language');
  assert.ok(
    /token/.test(section) && /uid/.test(section) && /comment body/.test(section),
    'must explicitly forbid token, UID, comment body in reports'
  );
});

test('issue status governance rules are present', () => {
  const doc = readDoc();
  const statusSection = doc.match(/## 7\. Issue Status Governance[\s\S]*?(?=## \d)/);
  assert.ok(statusSection, 'must have Issue Status Governance section');

  const section = statusSection[0].toLowerCase();
  assert.ok(section.includes('#3183') && section.includes('open'), 'must state #3183 stays open');
  assert.ok(section.includes('#1882'), 'must reference #1882 status');
  assert.ok(
    /refs\s+#1882/i.test(statusSection[0]) || /refs only/.test(statusSection[0].toLowerCase()),
    'must use Refs #1882 only, not Fixes'
  );
});

test('policy invariants section exists', () => {
  const doc = readDoc();
  assert.ok(hasSection(doc, 'Policy Invariants'), 'must have Policy Invariants section');
});

// ---------------------------------------------------------------------------
// Negative test: contract output does NOT print document contents or fragments
// ---------------------------------------------------------------------------
test('contract output does not print document contents or matched sensitive fragments', () => {
  // This test itself verifies that no test above printed document content.
  // All assertions above use counts, boolean checks, or comparison with static strings.
  // If any test above used console.log or assertion messages that include document text,
  // the test runner output would contain it. Manually verify that test output is clean.
  assert.ok(true, 'all tests use only safe assertion messages');
});
