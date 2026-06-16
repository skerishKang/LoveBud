const fs = require('fs');
const path = require('path');
const assert = require('assert');

/**
 * @context
 * - Issue #2594: Map disabled real-KV adapter result codes into Scout storage dependency safe-fail taxonomy
 * - Issue #1882: [PRODUCT] Explore LoveBud Scout link-based fan assistant MVP
 * - Relates to #2589 / #2592 disabled real-KV adapter scaffold
 * - Relates to #2586 / #2588 schema and TTL policy
 * - Relates to #2584 / #2585 activation gates
 */

const DEPENDENCY_ADAPTER_FILE = path.join(__dirname, '../../functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const DOC_FILE = path.join(__dirname, '../../docs/product/lovebud-scout-real-kv-adapter-dependency-mapping.md');

function runTests() {
  console.log('Running scout-real-kv-adapter-dependency-mapping-contract.test.cjs...');

  assert.ok(fs.existsSync(DEPENDENCY_ADAPTER_FILE), 'Dependency adapter file must exist.');
  
  const content = fs.readFileSync(DEPENDENCY_ADAPTER_FILE, 'utf-8');

  // Check forbidden tokens (only inside code, not comments)
  const codeWithoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
    
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
  
  for (const token of forbiddenTokens) {
    assert.ok(!codeWithoutComments.includes(token), `Must not contain forbidden token in executable code: ${token}`);
  }

  // Check references in doc file
  if (fs.existsSync(DOC_FILE)) {
    const docContent = fs.readFileSync(DOC_FILE, 'utf-8');
    assert.ok(docContent.includes('#1882'), 'Must reference #1882');
    assert.ok(docContent.includes('#2594'), 'Must reference #2594');
    assert.ok(docContent.includes('#2589') && docContent.includes('#2592'), 'Must reference #2589/#2592 scaffold');
    assert.ok(docContent.includes('#2586') && docContent.includes('#2588'), 'Must reference #2586/#2588 schema');
    assert.ok(docContent.includes('#2584') && docContent.includes('#2585'), 'Must reference #2584/#2585 gates');
  }

  
  // Verify runtime mapping behavior
  const runnerScript = path.join(__dirname, 'mapping-test-runner.mjs');
  const runnerCode = `
import { createScoutLiveDependencyAdapter } from '../../functions/api/scout/live-auth-rate-limit-dependency-adapter.js';

async function test() {
  // Test mapping
  const adapter = createScoutLiveDependencyAdapter({ mockDisabled: false });
  
  const testCodes = [
    'KV_ADAPTER_DISABLED',
    'KV_ADAPTER_NOT_IMPLEMENTED',
    'KV_ADAPTER_BINDING_UNAVAILABLE',
    'KV_ADAPTER_UNTRUSTED_STATE',
    'UNKNOWN_KV_CODE'
  ];
  
  for (const code of testCodes) {
    // We mock the storage adapter to return these codes directly
    const mockStorageAdapter = {
      checkQuota: async () => ({ code })
    };
    const testAdapter = createScoutLiveDependencyAdapter({ 
      mockDisabled: false,
      storageAdapter: mockStorageAdapter
    });
    
    const res = await testAdapter.checkRateLimit({});
    if (res.allowed !== false) throw new Error('allowed must be false for code ' + code);
    if (res.code !== 'RATE_LIMIT_STORAGE_UNAVAILABLE') {
      throw new Error('Expected RATE_LIMIT_STORAGE_UNAVAILABLE, got ' + res.code + ' for ' + code);
    }
  }

  // Test thrown errors mapping
  const throwAdapter = createScoutLiveDependencyAdapter({
    mockDisabled: false,
    storageAdapter: {
      checkQuota: async () => { throw new Error('test error'); }
    }
  });
  const errRes = await throwAdapter.checkRateLimit({});
  if (errRes.allowed !== false) throw new Error('allowed must be false for thrown error');
  if (errRes.code !== 'RATE_LIMIT_STORAGE_UNAVAILABLE') {
    throw new Error('Expected RATE_LIMIT_STORAGE_UNAVAILABLE for thrown error');
  }

  console.log('Mapping runtime behavior validated successfully.');
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
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

  console.log('scout-real-kv-adapter-dependency-mapping-contract.test.cjs PASSED!');
}

runTests();
