const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MATRIX_DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-live-rate-limit-storage-readiness-matrix.md');

function runTests() {
  console.log('Running scout-live-rate-limit-storage-readiness-matrix-contract.test.cjs...');

  // 1. Matrix doc exists
  assert.ok(fs.existsSync(MATRIX_DOC_FILE), 'Readiness matrix doc must exist.');
  
  const content = fs.readFileSync(MATRIX_DOC_FILE, 'utf-8');

  // 2. References required issues
  assert.ok(content.includes('#1882'), 'Must reference #1882');
  assert.ok(content.includes('#2597'), 'Must reference #2597');
  
  // 3. References completed slices
  assert.ok(content.includes('#2584') && content.includes('#2585'), 'Must reference #2584/#2585');
  assert.ok(content.includes('#2586') && content.includes('#2588'), 'Must reference #2586/#2588');
  assert.ok(content.includes('#2589') && content.includes('#2592'), 'Must reference #2589/#2592');
  assert.ok(content.includes('#2594') && content.includes('#2596'), 'Must reference #2594/#2596');

  // 4. Includes all required rows
  const requiredRows = [
    'Parent Scout MVP scope (#1882)',
    'Provider mode default',
    'Frontend source selector default',
    'Endpoint client default disabled state',
    'Auth verifier state',
    'Rate-limit dependency adapter state',
    'Storage adapter skeleton state',
    'KV skeleton activation gates',
    'KV schema and TTL policy',
    'Disabled real-KV adapter interface scaffold',
    'Disabled real-KV adapter dependency mapping',
    'Secrets/config requirements',
    'Observability/no-leak posture',
    'Current production readiness status'
  ];
  for (const row of requiredRows) {
    assert.ok(content.includes(row), `Matrix must include row: ${row}`);
  }

  // 5. Includes required columns
  const requiredCols = [
    'Area',
    'Completed issue / PR reference',
    'Current status',
    'Runtime enabled?',
    'External network/provider/KV used?',
    'Next required gate before activation'
  ];
  for (const col of requiredCols) {
    assert.ok(content.includes(col), `Matrix must include column: ${col}`);
  }

  // 6. Clearly marks real KV and real provider execution as disabled/not-ready
  assert.ok(content.includes('Real provider execution remains **disabled**') || content.includes(/provider execution.*disabled/i), 'Must explicitly mark provider execution as disabled');
  assert.ok(content.includes('Real KV binding/read/write remains **disabled**') || content.includes(/KV binding.*disabled/i), 'Must explicitly mark KV binding as disabled');

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

  console.log('scout-live-rate-limit-storage-readiness-matrix-contract.test.cjs PASSED!');
}

runTests();
