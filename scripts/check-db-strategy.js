// Run fixture seed on Modal DB by updating Modal secret
// Approach: seed the fixture on whatever DB Modal connects to
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read DB URL from local .secrets
const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let localDbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    localDbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}

// Query the LOCAL (seeded) DB to see if fixture tree exists there
const { Pool } = require('pg');
const localPool = new Pool({ connectionString: localDbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await localPool.connect();
  try {
    // Check fixture tree
    const fixture = await client.query(
      `SELECT id, name, is_public, payload IS NOT NULL as has_payload 
       FROM trees WHERE id='10340000-0000-4000-8000-000000000001'`
    );
    console.log('Local DB fixture:');
    if (fixture.rows.length > 0) {
      console.log('  EXISTS:', fixture.rows[0].name);
      console.log('  is_public:', fixture.rows[0].is_public);
      console.log('  has_payload:', fixture.rows[0].has_payload);
      
      // Check columns
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name='trees' AND table_schema='public'
         ORDER BY ordinal_position`
      );
      console.log('  columns:', cols.rows.map(r => r.column_name).join(', '));
    } else {
      console.log('  NOT FOUND');
    }
  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await localPool.end();
  }

  console.log('\nSTRATEGY:');
  console.log('Option 1: Update Modal lovebud-db secret to match local DB URL');
  console.log('Option 2: Seed fixture directly on Modal DB');
  console.log('Recommended: Update Modal secret to local DB');
})().catch(e => console.log('FAILED:', e.message));
