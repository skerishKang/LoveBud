// Check Modal secret DB schema vs local DB schema
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check local DB schema from .secrets file
const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let localDbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    localDbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}

// Query local DB for schema check
const { Pool } = require('pg');
const localPool = new Pool({ connectionString: localDbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await localPool.connect();
  try {
    // Check local trees table columns
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='trees' AND table_schema='public' ORDER BY ordinal_position`
    );
    console.log('=== Local DB trees columns ===');
    console.log(cols.rows.map(r => r.column_name).join(', '));
    
    // Check if memories table exists
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    console.log('\n=== Local DB tables ===');
    console.log(tables.rows.map(r => r.table_name).join(', '));

    // Check if fixture tree exists locally
    const localFixture = await client.query(
      `SELECT id FROM trees WHERE id='10340000-0000-4000-8000-000000000001'`
    );
    console.log('\nFixture tree in local DB:', localFixture.rows.length > 0 ? 'YES' : 'NO');
    
    // Try to query local as 'modern' (title/visibility)
    try {
      const modernCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='trees' AND column_name IN ('title','visibility')`
      );
      console.log('Local DB has title/visibility:', modernCheck.rows.length === 2 ? 'YES' : 'NO');
    } catch (e) {
      console.log('Modern check error:', e.message);
    }
  } catch (err) {
    console.log('Local DB error:', err.message);
  } finally {
    client.release();
    await localPool.end();
  }
  
  console.log('\n---');
  console.log('CONCLUSION: Local DB was seeded. Modal DB uses different connection.');
  console.log('Need to either:');
  console.log('1. Update Modal lovebud-db secret to match local DB (or vice versa)');
  console.log('2. Run fixture seed on Modal DB');
})().catch(e => console.log('FAILED:', e.message));
