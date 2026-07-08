/**
 * Issue #1069 Delete Smoke Test
 * 
 * Flow:
 * 1. Use Firebase service account to create custom token
 * 2. Exchange custom token for ID token via Firebase Auth API (identitytoolkit)
 * 3. Create test memory via Modal API
 * 4. Delete it via Modal API
 * 5. Verify 2xx response (not 500)
 * 
 * Modal backend: https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run
 * Test accounts reference qa-credentials (identifiers only; passwords not stored here).
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODAL_BASE_URL = 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run';

// Firebase Web API key must come from the environment (never hard-coded).
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
if (!FIREBASE_API_KEY) {
  throw new Error('FIREBASE_API_KEY environment variable is required (Firebase Web API key)');
}

// Test account identifiers (no secrets stored in this script).
const TEST_ACCOUNTS = [
  { key: 'admin001', email: 'admin001-test5@lovebud.local', uid: 'admin001-test5' },
  { key: 'dev001', email: 'dev001-test5@lovebud.local', uid: 'dev001-test5' },
];

// Service account path resolution (no developer-specific absolute paths):
//   1. FIREBASE_SERVICE_ACCOUNT_PATH (explicit, CI-friendly)
//   2. repo-relative fallback <cwd>/.secrets/<filename>.json
function resolveServiceAccountPath() {
  const filename = 'relovetree-firebase-adminsdk-fbsvc-5ec9e2b62770.json';
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  }
  return path.join(process.cwd(), '.secrets', filename);
}

function loadServiceAccount() {
  const serviceAccountPath = resolveServiceAccountPath();
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      'Firebase service account not found at ' + serviceAccountPath +
      ' (set FIREBASE_SERVICE_ACCOUNT_PATH or place the file at <repo>/.secrets)'
    );
  }
  return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}

// Step 1: Create custom token using Firebase Admin SDK
async function createCustomToken(uid, email) {
  const firebaseAdmin = require('firebase-admin');
  
  // Initialize app if not already
  if (!firebaseAdmin.apps.length) {
    const serviceAccount = loadServiceAccount();
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
  }
  
  // Create custom token with additional claims
  const customToken = await firebaseAdmin.auth().createCustomToken(uid, {
    email: email,
    email_verified: true
  });
  
  return customToken;
}

// Step 2: Exchange custom token for ID token via Firebase Auth API
async function exchangeCustomTokenForIdToken(customToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange custom token: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return data.idToken;
}

// Step 3: Create tree via Modal API
async function createTree(idToken, title = 'Delete Smoke Test Tree') {
  const response = await fetch(`${MODAL_BASE_URL}/modal/private/trees`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, visibility: 'public' })
  });
  
  if (!response.ok) {
    throw new Error(`Create tree failed: ${response.status} ${await response.text()}`);
  }
  
  return response.json();
}

// Step 4: Create memory via Modal API
async function createMemory(idToken, treeId, title = 'Delete Smoke Test Memory') {
  const response = await fetch(`${MODAL_BASE_URL}/modal/private/memories`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      treeId,
      title,
      memo: 'Test memory for delete operation - Issue #1069',
      artist: 'Test Artist',
      source: 'Test Source',
      sourceType: 'youtube',
      timestamp: '2024-01',
      visibility: 'public'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Create memory failed: ${response.status} ${await response.text()}`);
  }
  
  return response.json();
}

// Step 5: Delete memory via Modal API - main test
async function deleteMemory(idToken, memoryId) {
  const response = await fetch(`${MODAL_BASE_URL}/modal/private/memories/${memoryId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  
  return {
    status: response.status,
    ok: response.ok,
    data: response.ok ? await response.json().catch(() => null) : null,
    error: !response.ok ? await response.text().catch(() => 'Unknown error') : null
  };
}

// Cleanup: Delete tree
async function deleteTree(idToken, treeId) {
  const response = await fetch(`${MODAL_BASE_URL}/modal/private/trees/${treeId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  return { status: response.status, ok: response.ok };
}

// Main test function
async function runDeleteSmokeTest(account) {
  console.log(`\n=== Testing account: ${account.key} ===`);
  
  let idToken;
  let tree;
  let memory;
  
  try {
    // Step 1: Create custom token using Firebase Admin SDK
    console.log('Step 1: Creating custom token with Firebase Admin SDK...');
    const customToken = await createCustomToken(account.uid, account.email);
    console.log(`  ✓ Created custom token for ${account.email}`);
    
    // Step 2: Exchange custom token for ID token via Firebase Auth API
    console.log('Step 2: Exchanging custom token for ID token...');
    idToken = await exchangeCustomTokenForIdToken(customToken);
    console.log(`  ✓ Got ID token (expires in 3600s)`);
    
    // Step 3: Create tree for testing
    console.log('Step 3: Creating test tree...');
    tree = await createTree(idToken, `Issue#1069 Test - ${account.key} - ${Date.now()}`);
    console.log(`  ✓ Created tree: ${tree.id}`);
    
    // Step 4: Create memory
    console.log('Step 4: Creating test memory...');
    memory = await createMemory(idToken, tree.id, `Delete Test Memory ${Date.now()}`);
    console.log(`  ✓ Created memory: ${memory.id}`);
    
    // Step 5: Delete memory - THE MAIN TEST
    console.log('Step 5: Deleting memory...');
    const deleteResult = await deleteMemory(idToken, memory.id);
    
    // Verify 2xx response (not 500)
    assert.ok(deleteResult.ok, `Delete should return 2xx, got ${deleteResult.status}`);
    assert.ok(deleteResult.status >= 200 && deleteResult.status < 300, 
      `Expected 2xx response, got ${deleteResult.status}`);
    console.log(`  ✓ Delete returned ${deleteResult.status} (2xx OK)`);
    
    // Assert NOT 500
    assert.ok(deleteResult.status !== 500, 'Delete should NOT return 500');
    
    // Cleanup: Delete tree
    console.log('Cleanup: Deleting test tree...');
    const treeDelete = await deleteTree(idToken, tree.id);
    console.log(`  Tree delete: ${treeDelete.status}`);
    
    return { 
      success: true, 
      account: account.key,
      treeId: tree.id,
      memoryId: memory.id,
      deleteStatus: deleteResult.status
    };
    
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    
    // Attempt cleanup on error
    if (idToken && tree?.id) {
      try {
        await deleteTree(idToken, tree.id);
        console.log('  Cleanup: Tree deleted after error');
      } catch (e) {
        console.log(`  Cleanup warning: ${e.message}`);
      }
    }
    
    return { success: false, account: account.key, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Issue #1069 Delete Smoke Test');
  console.log('Using Firebase service account -> custom token -> ID token');
  console.log('Modal backend: ' + MODAL_BASE_URL);
  console.log('='.repeat(60));
  
  // Check prerequisites
  try {
    loadServiceAccount();
    console.log('✓ Firebase service account found');
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
  
  const results = [];
  
  for (const account of TEST_ACCOUNTS) {
    const result = await runDeleteSmokeTest(account);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Results Summary:');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.account}: ${r.success ? `PASSED (${r.deleteStatus})` : r.error}`);
  });
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
