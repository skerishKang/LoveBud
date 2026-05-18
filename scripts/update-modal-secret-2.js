// Update Modal lovebud-db secret - take 2
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}
if (!dbUrl) { console.log('FATAL: DATABASE_URL not found'); process.exit(1); }

// Use zx-like approach: pass via env var that modal can read
process.env.MODAL_DB_URL = dbUrl;

const result = execSync(
  'modal secret create lovebud-db DATABASE_URL="\\$MODAL_DB_URL" --force',
  { 
    env: process.env,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024,
    shell: '/bin/bash'
  }
);
console.log('Secret update:', result.trim());
