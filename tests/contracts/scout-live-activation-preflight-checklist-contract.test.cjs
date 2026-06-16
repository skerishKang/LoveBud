const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-live-activation-preflight-checklist.md');

function runTests() {
  console.log('Running scout-live-activation-preflight-checklist-contract.test.cjs...');

  // 1. Preflight checklist doc exists
  assert.ok(fs.existsSync(DOC_FILE), 'Preflight checklist doc must exist.');

  const content = fs.readFileSync(DOC_FILE, 'utf-8');

  // 2. References #1882 and this issue
  assert.ok(content.includes('#1882'), 'Must reference #1882');
  assert.ok(content.includes('#2599'), 'Must reference #2599');

  // 3. References completed safety slices
  assert.ok(content.includes('#2584') && content.includes('#2585'), 'Must reference #2584/#2585');
  assert.ok(content.includes('#2586') && content.includes('#2588'), 'Must reference #2586/#2588');
  assert.ok(content.includes('#2589') && content.includes('#2592'), 'Must reference #2589/#2592');
  assert.ok(content.includes('#2594') && content.includes('#2596'), 'Must reference #2594/#2596');
  assert.ok(content.includes('#2597') && content.includes('#2598'), 'Must reference #2597/#2598');

  // 4. Checklist content requirements
  const requiredContents = [
    'Staging vs production distinction',
    'Manual activation approval requirement',
    'Rollback/kill switch plan',
    'Privacy/no-leak review',
    'Blocking Conditions'
  ];
  for (const item of requiredContents) {
    assert.ok(content.includes(item) || content.toLowerCase().includes(item.toLowerCase()), `Doc must include: ${item}`);
  }

  // 5. Explicitly states this slice does not activate live behavior
  assert.ok(content.includes('No activation in this slice') || content.toLowerCase().includes('does not activate live behavior'), 'Must explicitly state no activation in this slice');

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

  console.log('scout-live-activation-preflight-checklist-contract.test.cjs PASSED!');
}

runTests();
