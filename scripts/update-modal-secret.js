// Update Modal lovebud-db secret to match local DB (where fixture was seeded)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
let modalTokenId = null;
let modalTokenSecret = null;
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.replace('DATABASE_URL=', '');
  }
  if (trimmed.startsWith('MODAL_TOKEN_ID=')) {
    modalTokenId = trimmed.replace('MODAL_TOKEN_ID=', '');
  }
  if (trimmed.startsWith('MODAL_TOKEN_SECRET=')) {
    modalTokenSecret = trimmed.replace('MODAL_TOKEN_SECRET=', '');
  }
}

if (!dbUrl) {
  console.log('FATAL: DATABASE_URL not found');
  process.exit(1);
}

console.log('Updating Modal lovebud-db secret...');
console.log('DATABASE_URL: PRESENT (length=' + dbUrl.length + ')');

// Update Modal secret using modal CLI
try {
  // Create/update the secret with the local DB URL
  // modal secret create lovebud-db DATABASE_URL=<value>
  // But we need to avoid exposing the value in shell history
  
  // Use env var approach
  const env = { ...process.env };
  env.DATABASE_URL = dbUrl;
  
  const result = execSync(
    'modal secret create lovebud-db DATABASE_URL',
    { env, encoding: 'utf-8', maxBuffer: 50 * 1024 }
  );
  console.log('Secret update output:', result.trim());
} catch (e) {
  // The secret might already exist - try update
  try {
    const env = { ...process.env };
    env.DATABASE_URL = dbUrl;
    
    const result = execSync(
      'modal secret create lovebud-db DATABASE_URL --force',
      { env, encoding: 'utf-8', maxBuffer: 50 * 1024 }
    );
    console.log('Secret force update output:', result.trim());
  } catch (e2) {
    console.log('Secret update error:', e2.message);
  }
}
