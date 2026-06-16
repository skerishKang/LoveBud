const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-live-activation-evidence-packet.md');

function readRequiredFile(filePath, label) {
  assert.ok(fs.existsSync(filePath), `${label} must exist.`);
  return fs.readFileSync(filePath, 'utf-8');
}

function assertIncludes(content, expected, message) {
  assert.ok(content.includes(expected), message || `Expected content to include: ${expected}`);
}

function assertIncludesAll(content, expectedItems, label) {
  for (const item of expectedItems) {
    assertIncludes(content, item, `${label} must include: ${item}`);
  }
}

function runTests() {
  console.log('Running scout-live-activation-evidence-packet-contract.test.cjs...');

  const content = readRequiredFile(DOC_FILE, 'Scout live activation evidence packet doc');

  assertIncludesAll(content, ['#1882', '#2603'], 'Doc issue references');
  assertIncludes(content, 'Keeps #1882 open.', 'Doc must preserve #1882 open note.');

  const completedSafetySlices = [
    ['#2584', '#2585'],
    ['#2586', '#2588'],
    ['#2589', '#2592'],
    ['#2594', '#2596'],
    ['#2597', '#2598'],
    ['#2599', '#2600'],
    ['#2601', '#2602'],
  ];
  for (const [issue, pr] of completedSafetySlices) {
    assertIncludes(content, issue, `Doc must reference completed safety slice issue ${issue}`);
    assertIncludes(content, pr, `Doc must reference completed safety slice PR ${pr}`);
  }

  const requiredCoverage = [
    'Operator name / role',
    'Review date',
    'Environment',
    'Build SHA',
    'staging only',
    'Production activation requested?',
    'production activation is explicitly out of scope',
    'Staging-only approval',
    'Pre-activation Checklist Status',
    'Post-activation Manual Smoke Results',
    'No sensitive data in client-visible responses',
    'No sensitive data in logs',
    'Source link remains visible',
    'Original source content is not rehosted or stored in full',
    'Save-to-LoveTree remains user-reviewed and not automatic',
    'Kill switch / rollback confirmation',
    'Final Go / No-Go Decision',
    'Blockers',
    'Warnings',
    'Follow-up issue links',
    'Any FAIL or missing result blocks activation',
  ];
  assertIncludesAll(content, requiredCoverage, 'Evidence packet coverage');

  const requiredSafetyAssertions = [
    'No activation in this slice',
    'No executable live smoke test',
    'No real provider execution',
    'No real KV binding/read/write',
    'kv_live',
    'kv',
    'Endpoint default remains `stub`',
    'Frontend source selector default remains `local_stub`',
    'Endpoint client remains disabled by default',
    'env.SCOUT_RATE_LIMIT_KV',
    'env.KV',
    'global.KV',
    'globalThis.KV',
    'KV `get`',
    'KV `put`',
    'KV `list`',
    'KV `delete`',
    'Durable Object',
    'D1',
    'DB',
    'fetch',
    'provider SDK',
    'secrets',
    'No automatic allow on missing/malformed/stale/untrusted quota state',
    '#1882 remains open',
  ];
  assertIncludesAll(content, requiredSafetyAssertions, 'Safety assertions');

  assertIncludes(content, 'docs/contracts-only', 'Doc must state docs/contracts-only scope.');
  assertIncludes(content, 'GO / NO-GO', 'Doc must include final go/no-go decision.');
  assertIncludes(content, 'A final **GO** is prohibited', 'Doc must block GO when evidence is incomplete.');

  console.log('scout-live-activation-evidence-packet-contract.test.cjs PASSED!');
}

runTests();
