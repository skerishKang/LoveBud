const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-live-activation-manual-smoke-test-scenarios.md');

function runTests() {
  console.log('Running scout-live-activation-manual-smoke-test-scenarios-contract.test.cjs...');

  // 1. Doc exists
  assert.ok(fs.existsSync(DOC_FILE), 'Manual smoke test scenarios doc must exist.');
  
  const content = fs.readFileSync(DOC_FILE, 'utf-8');

  // 2. References #1882 and #2601
  assert.ok(content.includes('#1882'), 'Must reference #1882');
  assert.ok(content.includes('#2601'), 'Must reference #2601');
  
  // 3. References completed safety slices
  assert.ok(content.includes('#2584') && content.includes('#2585'), 'Must reference #2584/#2585');
  assert.ok(content.includes('#2586') && content.includes('#2588'), 'Must reference #2586/#2588');
  assert.ok(content.includes('#2589') && content.includes('#2592'), 'Must reference #2589/#2592');
  assert.ok(content.includes('#2594') && content.includes('#2596'), 'Must reference #2594/#2596');
  assert.ok(content.includes('#2597') && content.includes('#2598'), 'Must reference #2597/#2598');
  assert.ok(content.includes('#2599') && content.includes('#2600'), 'Must reference #2599/#2600');

  // 4. Checklist content requirements
  const requiredContents = [
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
    'Post-activation smoke test pass/fail recording'
  ];

  for (const item of requiredContents) {
    assert.ok(content.includes(item), `Doc must include: ${item}`);
  }

  // 5. Explicit safety assertions
  assert.ok(content.includes('operator-facing') || content.includes('manual'), 'Must state scenarios are manual/operator-facing');
  assert.ok(content.includes('not an executable live test'), 'Must explicitly state not an executable live test');
  assert.ok(content.includes('No activation in this slice'), 'Must explicitly state no activation in this slice');

  // Verify endpoints remain disabled/stubbed without modifying them
  const endpointFile = path.join(__dirname, '../../functions/api/scout/suggest.js');
  if (fs.existsSync(endpointFile)) {
    const epContent = fs.readFileSync(endpointFile, 'utf-8');
    assert.ok(epContent.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'Endpoint default must remain STUB');
  }

  // Verify frontend source selector remains local_stub without modifying them
  const frontendSourceFile = path.join(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
  if (fs.existsSync(frontendSourceFile)) {
    const feContent = fs.readFileSync(frontendSourceFile, 'utf-8');
    assert.ok(feContent.includes("LOCAL_STUB: 'local_stub'"), "Must have LOCAL_STUB");
    assert.ok(feContent.includes("local_stub"), "Default must be local_stub");
  }

  console.log('scout-live-activation-manual-smoke-test-scenarios-contract.test.cjs PASSED!');
}

runTests();
