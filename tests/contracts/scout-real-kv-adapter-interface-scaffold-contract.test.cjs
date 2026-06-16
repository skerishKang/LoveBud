const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCAFFOLD_FILE = path.join(__dirname, '../../functions/api/scout/live-rate-limit-kv-adapter.js');

function runTests() {
  console.log('Running scout-real-kv-adapter-interface-scaffold-contract.test.cjs...');

  // 1. scaffold file exists
  assert.ok(fs.existsSync(SCAFFOLD_FILE), 'Scaffold file must exist.');

  const content = fs.readFileSync(SCAFFOLD_FILE, 'utf-8');

  // 2. scaffold references #1882 and #2589 in header comment
  assert.ok(content.includes('#1882'), 'Must reference #1882');
  assert.ok(content.includes('#2589'), 'Must reference #2589');

  // 3. scaffold references #2584/#2585 activation gates
  assert.ok(content.includes('#2584') && content.includes('#2585'), 'Must reference activation gates #2584/#2585');

  // 4. scaffold references #2586/#2588 schema and TTL policy
  assert.ok(content.includes('#2586') && content.includes('#2588'), 'Must reference schema and TTL policy #2586/#2588');

  // 5. exported version constant exists
  assert.ok(content.includes('export const SCOUT_LIVE_RATE_LIMIT_KV_ADAPTER_VERSION'), 'Exported version constant must exist');

  // 6. adapter factory exists
  assert.ok(content.includes('export function createScoutLiveRateLimitKvAdapter'), 'Adapter factory must exist');

  // 7. operation names exist
  const requiredOperations = [
    'readQuotaRecord',
    'writeQuotaRecord',
    'deleteQuotaRecord',
    'buildQuotaKey',
    'parseQuotaRecord',
    'validateQuotaRecordFreshness'
  ];
  for (const op of requiredOperations) {
    assert.ok(content.includes(op), `Operation name ${op} must exist`);
  }

  // 8. disabled/not-implemented code exists
  assert.ok(content.includes('KV_ADAPTER_DISABLED'), 'KV_ADAPTER_DISABLED code must exist');

  // 9. no automatic allow phrase or behavior (rough check in code)
  assert.ok(!content.includes('allowed: true'), 'Must not have allowed: true');

  // 10. executable adapter/dependency code does not contain forbidden tokens
  const forbiddenTokens = [
    'env.SCOUT_RATE_LIMIT_KV',
    'env.KV',
    'global.KV',
    'globalThis.KV',
    '.get(',
    '.put(',
    '.list(',
    '.delete(',
    'D1Database',
    'DurableObject',
    'fetch(',
    'process.env',
    'STAGING_LIVE',
    'PRODUCTION_LIVE'
  ];

  // We need to strip comments before checking forbidden tokens to avoid false positives
  // if they happen to be mentioned in the documentation context.
  // Actually, wait, some of them might not be in comments. Let's just strip block comments
  // and line comments roughly.
  const codeWithoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/\/\/.*/g, '');          // remove line comments

  for (const token of forbiddenTokens) {
    assert.ok(!codeWithoutComments.includes(token), `Must not contain forbidden token in executable code: ${token}`);
  }

  // Verify runtime behavior dynamically
  const runnerScript = path.join(__dirname, 'scaffold-test-runner.mjs');
  const runnerCode = `
import { createScoutLiveRateLimitKvAdapter } from '../../functions/api/scout/live-rate-limit-kv-adapter.js';

const adapter = createScoutLiveRateLimitKvAdapter();

const results = [
  adapter.readQuotaRecord(),
  adapter.writeQuotaRecord(),
  adapter.deleteQuotaRecord(),
  adapter.buildQuotaKey(),
  adapter.parseQuotaRecord(),
  adapter.validateQuotaRecordFreshness()
];

for (const res of results) {
  if (res.allowed !== false) throw new Error('allowed must be false');
  if (res.released !== false) throw new Error('released must be false');
  if (!res.code || !res.code.includes('DISABLED')) throw new Error('code must indicate disabled');
}

console.log('Adapter runtime behavior validated successfully.');
`;
  fs.writeFileSync(runnerScript, runnerCode, 'utf-8');

  try {
    const { execSync } = require('child_process');
    execSync('node ' + runnerScript, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(runnerScript)) {
      fs.unlinkSync(runnerScript);
    }
  }

  // Verify endpoints remain disabled/stubbed
  const endpointFile = path.join(__dirname, '../../functions/api/scout/suggest.js');
  if (fs.existsSync(endpointFile)) {
    const epContent = fs.readFileSync(endpointFile, 'utf-8');
    assert.ok(epContent.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'Endpoint default must remain STUB');
  }

  // Verify frontend source selector remains local_stub
  const frontendSourceFile = path.join(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
  if (fs.existsSync(frontendSourceFile)) {
    const feContent = fs.readFileSync(frontendSourceFile, 'utf-8');
    assert.ok(feContent.includes("LOCAL_STUB: 'local_stub'"), "Must have LOCAL_STUB");
    assert.ok(feContent.includes("local_stub"), "Default must be local_stub");
  }

  console.log('scout-real-kv-adapter-interface-scaffold-contract.test.cjs PASSED!');
}

runTests();
