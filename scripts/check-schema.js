const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');

let dbUrl = null;
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.replace('DATABASE_URL=', '');
    break;
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    // Check tables
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('=== Tables in DB ===');
    tables.rows.forEach(r => console.log(r.table_name));

    // Check if memories table exists
    const hasMemories = tables.rows.some(r => r.table_name === 'memories');
    console.log('\nmemories table exists:', hasMemories ? 'YES' : 'NO');

    // Check trees table columns
    const treeCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='trees' ORDER BY ordinal_position"
    );
    console.log('\n=== trees columns ===');
    treeCols.rows.forEach(r => console.log(r.column_name, r.data_type));

    // Check existing fixture tree
    const fixtureCheck = await client.query(
      "SELECT id, title, owner_id, visibility FROM trees WHERE id = '10340000-0000-4000-8000-000000000001'"
    );
    console.log('\n=== Fixture tree check ===');
    if (fixtureCheck.rows.length > 0) {
      console.log('Fixture tree EXISTS:', fixtureCheck.rows[0].title);
      console.log('Owner:', fixtureCheck.rows[0].owner_id);
      console.log('Visibility:', fixtureCheck.rows[0].visibility);
    } else {
      console.log('Fixture tree: NOT YET SEEDED');
    }

    // Pick best owner_id
    const owners = await client.query(
      "SELECT DISTINCT owner_id FROM trees WHERE owner_id IS NOT NULL ORDER BY owner_id LIMIT 3"
    );
    console.log('\n=== Available owner_ids for seeding ===');
    owners.rows.forEach((r, i) => {
      // Only show first and last 4 chars
      const masked = r.owner_id.substring(0, 4) + '...' + r.owner_id.substring(r.owner_id.length - 4);
      console.log(`  [${i}] ${masked} (${r.owner_id.length} chars)`);
    });

  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.log('FAILED:', e.message); });
