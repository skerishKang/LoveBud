const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-live-activation-manual-smoke-test-scenarios.md');
const ENDPOINT_FILE = path.join(__dirname, '../../functions/api/scout/suggest.js');
const SOURCE_SELECTOR_FILE = path.join(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_FILE = path.join(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');

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
  console.log('Running scout-live-activation-manual-smoke-test-scenarios-contract.test.cjs...');

  const content = readRequiredFile(DOC_FILE, 'Manual smoke test scenarios doc');

  assertIncludesAll(content, ['#1882', '#2601'], 'Doc issue references');

  const completedSafetySlices = [
    ['#2584', '#2585'],
    ['#2586', '#2588'],
    ['#2589', '#2592'],
    ['#2594', '#2596'],
    ['#2597', '#2598'],
    ['#2599', '#2600'],
  ];
  for (const [issue, pr] of completedSafetySlices) {
    assertIncludes(content, issue, `Doc must reference completed safety slice issue ${issue}`);
    assertIncludes(content, pr, `Doc must reference completed safety slice PR ${pr}`);
  }

  const requiredScenarioCoverage = [
    'Pre-activation confirmation',
    'Staging-only activation confirmation',
    'Kill switch / rollback confirmation',
    'Endpoint default remains stub before activation',
    'Frontend source selector remains local_stub before activation',
    'Endpoint client remains disabled before activation',
    'Auth-required request behavior',
    'Missing/malformed auth behavior',
    'Rate-limit unavailable safe-fail behavior',
    'Provider unavailable safe-fail behavior',
    'KV unavailable safe-fail behavior',
    'No automatic allow on missing/malformed/stale/untrusted quota state',
    'No sensitive data in client-visible responses',
    'No sensitive data in logs',
    'Save-to-LoveTree remains user-reviewed and not automatic',
    'Source link remains visible',
    'Original source content is not rehosted or stored in full',
    'Post-activation smoke test pass/fail recording',
  ];
  assertIncludesAll(content, requiredScenarioCoverage, 'Manual scenario coverage');

  const requiredSafetyAssertions = [
    'No activation in this slice',
    'No executable live smoke test',
    'Real provider execution remains',
    'Real KV binding/read/write remains',
    'kv_live',
    'kv',
    'Endpoint default remains `stub`',
    'Frontend source selector default remains `local_stub`',
    'Endpoint client remains',
    'env.SCOUT_RATE_LIMIT_KV',
    'env.KV',
    'global.KV',
    'globalThis.KV',
    'KV `get`',
    'put',
    'list',
    'delete',
    'DurableObject',
    'D1Database',
    'DB',
    'fetch',
    'provider SDK',
    'secrets',
    'No automatic allow on missing/malformed/stale/untrusted quota state',
  ];
  assertIncludesAll(content, requiredSafetyAssertions, 'Safety assertions');

  assert.ok(content.includes('operator-facing') || content.includes('manual/operator-facing'), 'Doc must state scenarios are manual/operator-facing.');
  assertIncludes(content, 'not an executable live test', 'Doc must state scenarios are not executable live tests.');
  assertIncludes(content, 'No activation in this slice', 'Doc must state this slice does not activate live behavior.');
  assert.ok(content.toLowerCase().includes('pass/fail'), 'Doc must include pass/fail recording guidance.');
  assert.ok(content.toLowerCase().includes('kill switch') && content.toLowerCase().includes('rollback'), 'Doc must include kill switch/rollback confirmation.');
  assert.ok(content.includes('client-visible responses') && content.includes('logs'), 'Doc must include no-leak checks for responses and logs.');

  const endpointContent = readRequiredFile(ENDPOINT_FILE, 'Scout suggest endpoint');
  assertIncludes(endpointContent, 'SCOUT_SUGGEST_PROVIDER_MODES.STUB', 'Endpoint default must remain SCOUT_SUGGEST_PROVIDER_MODES.STUB.');
  assertIncludes(endpointContent, 'providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB', 'Endpoint default return must remain stub.');

  const sourceSelectorContent = readRequiredFile(SOURCE_SELECTOR_FILE, 'Scout source selector');
  assertIncludes(sourceSelectorContent, "LOCAL_STUB: 'local_stub'", 'Frontend source selector must keep local_stub.');
  assertIncludes(sourceSelectorContent, 'Default is always local_stub', 'Frontend source selector default must remain local_stub.');

  const endpointClientContent = readRequiredFile(ENDPOINT_CLIENT_FILE, 'Scout endpoint client');
  assertIncludes(endpointClientContent, 'Disabled by default', 'Endpoint client must remain disabled by default.');
  assertIncludes(endpointClientContent, 'if (!config || typeof config !== \'object\') return false;', 'Endpoint client must not auto-enable without explicit config.');
  assertIncludes(endpointClientContent, "message: 'Scout suggestion endpoint client is disabled.'", 'Endpoint client disabled path must remain safe-fail.');

  assertIncludes(content, '#1882', '#1882 must remain referenced as the open parent issue.');

  console.log('scout-live-activation-manual-smoke-test-scenarios-contract.test.cjs PASSED!');
}

runTests();
