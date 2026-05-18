// Run fixture seed on approved test DB
// Reads env vars from .secrets file without exposing values
const fs = require('fs');
const path = require('path');

// Read secrets
const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}

if (!dbUrl) {
  console.log('FATAL: DATABASE_URL not found in secrets');
  process.exit(1);
}

// Use existing owner from trees table (most active)
const ownerId = '6xJoZMw64gWZcSIIS92kmBcSGVn1';

// Set env vars and run seed script
process.env.LOVEBUD_FIXTURE_DB_URL = dbUrl;
process.env.LOVEBUD_FIXTURE_OWNER_ID = ownerId;
process.env.LOVEBUD_FIXTURE_EXECUTE = 'true';

// Import and run the seed script
require('./seed-public-multi-branch-fixture.js');
