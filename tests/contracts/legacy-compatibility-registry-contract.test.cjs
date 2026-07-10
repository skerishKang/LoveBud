/**
 * Contract test for the LoveBud legacy compatibility retirement registry (Issue #3427).
 *
 * This test verifies that docs/engineering/LEGACY_COMPATIBILITY_REGISTRY.md exists, that it
 * contains the five required registry items (LC-001..LC-005) with all mandatory fields, and that
 * it preserves the documented safety boundaries:
 *   - no runtime artifact is removed/modified/implemented by this work,
 *   - production/staging/DB/Docker are never queried or executed,
 *   - #3120 is referenced but not reopened,
 *   - #1698 / #1711 are not reopened,
 *   - #1882 is not expressed as a Social owner,
 *   - no private endpoint, DB URL, raw UUID, token, request ID, or private log is present.
 *
 * It is a source/document-only contract. No runtime module is imported or executed. No database
 * connection, psql, subprocess, git diff, or git status is used. No raw/private values are asserted.
 *
 * Refs: #3427, #3425, #3426, #3120, #1698, #1711, #3188, #3075, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'docs/engineering/LEGACY_COMPATIBILITY_REGISTRY.md');

const REGISTRY_IDS = ['LC-001', 'LC-002', 'LC-003', 'LC-004', 'LC-005'];

const REQUIRED_FIELDS = [
  '- Registry ID:',
  '- Artifact / path:',
  '- Domain owner:',
  '- Classification:',
  '- Evidence level:',
  '- Evidence:',
  '- Reason retained:',
  '- Known consumers:',
  '- Compatibility/change risk:',
  '- Removal preconditions:',
  '- Required verification before removal:',
  '- Rollback/recovery expectation:',
  '- Existing issue/audit relationship:',
  '- Follow-up decision:',
  '- Status:',
  '- Last-reviewed main SHA:',
];

const EVIDENCE_VOCABULARY = ['CONFIRMED', 'LIKELY', 'UNKNOWN'];
const CLASSIFICATION_VOCABULARY = [
  'TRANSITIONAL_ADAPTER',
  'COMPATIBILITY_ALIAS',
  'DUAL_NORMALIZATION_PATH',
  'LEGACY_DEPLOYMENT_ARTIFACT',
  'PERMANENT_SUPPORT_CANDIDATE',
];
const STATUS_VOCABULARY = [
  'RETAIN',
  'REVIEW_REQUIRED',
  'REMOVAL_BLOCKED',
  'PERMANENT_SUPPORT_PENDING',
];

function readRegistry() {
  assert.ok(fs.existsSync(REGISTRY_PATH), `Registry document must exist at ${REGISTRY_PATH}`);
  return fs.readFileSync(REGISTRY_PATH, 'utf8');
}

function getItemBlock(text, id) {
  const start = text.indexOf(`## ${id}`);
  assert.ok(start !== -1, `Registry item ${id} heading must exist`);
  const next = text.indexOf('## LC-', start + 2);
  return text.slice(start, next === -1 ? text.length : next);
}

test('registry document exists', () => {
  assert.ok(fs.existsSync(REGISTRY_PATH));
});

for (const id of REGISTRY_IDS) {
  test(`registry contains item ${id}`, () => {
    const text = readRegistry();
    assert.ok(text.includes(`## ${id}`), `Heading "## ${id}" must exist`);
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has all required fields`, () => {
    const block = getItemBlock(readRegistry(), id);
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        block.includes(field),
        `Item ${id} must contain required field label "${field}"`
      );
    }
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} declares an evidence level`, () => {
    const block = getItemBlock(readRegistry(), id);
    const hasLevel = EVIDENCE_VOCABULARY.some((level) =>
      new RegExp(`- Evidence level:\\s*${level}\\b`).test(block)
    );
    assert.ok(hasLevel, `Item ${id} must declare one of ${EVIDENCE_VOCABULARY.join('/')} at Evidence level`);
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} declares a domain owner`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Domain owner:\s*\S+/.test(block),
      `Item ${id} must declare a non-empty Domain owner`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} declares a reason retained`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Reason retained:\s*\S/.test(block),
      `Item ${id} must declare a non-empty Reason retained`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has known consumers or UNKNOWN`, () => {
    const block = getItemBlock(readRegistry(), id);
    const hasConsumers = /- Known consumers:/.test(block);
    const hasUnknown = block.includes('UNKNOWN');
    assert.ok(
      hasConsumers || hasUnknown,
      `Item ${id} must declare Known consumers or explicitly mark UNKNOWN`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has compatibility/change risk`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Compatibility\/change risk:\s*\S/.test(block),
      `Item ${id} must declare a non-empty Compatibility/change risk`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has removal preconditions`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Removal preconditions:\s*\S/.test(block),
      `Item ${id} must declare non-empty Removal preconditions`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has required verification before removal`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Required verification before removal:\s*\S/.test(block),
      `Item ${id} must declare non-empty Required verification before removal`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has rollback/recovery expectation`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Rollback\/recovery expectation:\s*\S/.test(block),
      `Item ${id} must declare non-empty Rollback/recovery expectation`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has issue/audit relationship`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Existing issue\/audit relationship:\s*\S/.test(block),
      `Item ${id} must declare non-empty Existing issue/audit relationship`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has follow-up decision`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Follow-up decision:\s*\S/.test(block),
      `Item ${id} must declare a non-empty Follow-up decision`
    );
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has status`, () => {
    const block = getItemBlock(readRegistry(), id);
    const hasStatus = STATUS_VOCABULARY.some((s) =>
      new RegExp(`- Status:\\s*${s}\\b`).test(block)
    );
    assert.ok(hasStatus, `Item ${id} must declare one of ${STATUS_VOCABULARY.join('/')} at Status`);
  });
}

for (const id of REGISTRY_IDS) {
  test(`registry item ${id} has last-reviewed main SHA`, () => {
    const block = getItemBlock(readRegistry(), id);
    assert.ok(
      /- Last-reviewed main SHA:\s*[0-9a-f]{7,40}/.test(block),
      `Item ${id} must declare a Last-reviewed main SHA (git hash)`
    );
  });
}

test('registry uses the required evidence-level vocabulary', () => {
  const text = readRegistry();
  for (const level of EVIDENCE_VOCABULARY) {
    assert.ok(text.includes(level), `Evidence vocabulary "${level}" must appear in registry`);
  }
});

test('registry uses the required classification vocabulary', () => {
  const text = readRegistry();
  for (const cls of CLASSIFICATION_VOCABULARY) {
    assert.ok(text.includes(cls), `Classification vocabulary "${cls}" must appear in registry`);
  }
});

test('registry uses the required status vocabulary', () => {
  const text = readRegistry();
  for (const st of STATUS_VOCABULARY) {
    assert.ok(text.includes(st), `Status vocabulary "${st}" must appear in registry`);
  }
});

test('#3120 is referenced but not reopened', () => {
  const lower = readRegistry().toLowerCase();
  assert.ok(lower.includes('#3120'), '#3120 must be referenced');
  assert.ok(
    !/(we|this pr|please|should|must) reopen #3120/i.test(lower),
    'Registry must not instruct reopening #3120'
  );
  assert.ok(
    lower.includes('do not reopen #3120') || lower.includes('not reopened'),
    'Registry should state #3120 is not reopened'
  );
});

test('#1698 and #1711 are referenced but not reopened', () => {
  const text = readRegistry();
  const lower = text.toLowerCase();
  assert.ok(lower.includes('#1698'), '#1698 must be referenced');
  assert.ok(lower.includes('#1711'), '#1711 must be referenced');
  assert.ok(!/reopen #1698/i.test(text), 'Registry must not reopen #1698');
  assert.ok(!/reopen #1711/i.test(text), 'Registry must not reopen #1711');
});

test('#1882 is not expressed as a Social owner', () => {
  const lower = readRegistry().toLowerCase();
  assert.ok(lower.includes('#1882'), '#1882 must be referenced as Scout boundary');
  assert.ok(
    !lower.includes('#1882 (social') &&
      !lower.includes('social owner #1882') &&
      !lower.includes('#1882 is a social'),
    'Scout #1882 must not be expressed as a Social owner'
  );
  assert.ok(
    lower.includes('#1882 is scout, not a social owner') ||
      lower.includes('#1882 is scout') && lower.includes('not a social owner'),
    'Registry should explicitly state #1882 is Scout, not a Social owner'
  );
});

test('registry does not claim runtime removal or implementation was completed', () => {
  const lower = readRegistry().toLowerCase();
  assert.ok(
    !/(this (pr|registry) (removes|implements|deletes|mutates))/.test(lower),
    'Registry must not claim it removed/implemented/deleted/mutated runtime'
  );
  assert.ok(
    !/(artifact|artifacts|adapter|config|globals) (were|was) (removed|deleted|implemented)/.test(lower),
    'Registry must not claim any artifact was removed/deleted/implemented'
  );
  assert.ok(
    !/removal (is|was) complete/.test(lower) && !/runtime removal completed/.test(lower),
    'Registry must not claim removal is complete'
  );
});

test('registry does not claim production/staging/DB/Docker was executed or queried', () => {
  const text = readRegistry();
  const lower = text.toLowerCase();
  assert.ok(
    !/(we|this pr|the agent|registry) (ran|executed|queried|connected to) (production|staging|docker|postgres|the database)/.test(lower),
    'Registry must not claim it executed/queried production/staging/DB/Docker'
  );
  assert.ok(
    lower.includes('never queried') || lower.includes('do not query production'),
    'Registry should state production/staging/DB were never queried'
  );
});

test('registry contains no private endpoint, DB URL, raw UUID, token, request ID, or private log', () => {
  const text = readRegistry();
  assert.ok(
    !/(postgres|postgresql|mysql|mongodb):\/\//i.test(text),
    'No database connection URL should appear'
  );
  assert.ok(
    !/sk-[a-z0-9]{10,}/i.test(text) &&
      !/ghp_[a-z0-9]{10,}/i.test(text) &&
      !/eyj[a-z0-9_-]+\.[a-z0-9_-]+\./i.test(text),
    'No API key / JWT token should appear'
  );
  assert.ok(
    !/authorization:\s*bearer/i.test(text) && !/request-id:/i.test(text),
    'No Authorization header or request-id should appear'
  );
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text),
    'No raw UUID should appear'
  );
});
