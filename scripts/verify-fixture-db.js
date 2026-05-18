// Check fixture data in DB
const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    // Check fixture tree
    const tree = await client.query(
      `SELECT id, name, is_public, owner_id, node_count, payload IS NOT NULL as has_payload
       FROM trees WHERE id = '10340000-0000-4000-8000-000000000001'`
    );
    console.log('Fixture tree:');
    if (tree.rows.length === 0) {
      console.log('  NOT FOUND - seed may have failed silently');
    } else {
      const r = tree.rows[0];
      console.log(`  name: ${r.name}`);
      console.log(`  is_public: ${r.is_public}`);
      console.log(`  has_payload: ${r.has_payload}`);
      console.log(`  node_count: ${r.node_count}`);

      // Check payload structure
      const payload = await client.query(
        `SELECT jsonb_typeof(payload) as payload_type, 
                jsonb_typeof(payload->'nodes') as nodes_type,
                jsonb_array_length(payload->'nodes') as node_count
         FROM trees WHERE id = '10340000-0000-4000-8000-000000000001'`
      );
      if (payload.rows.length > 0) {
        console.log(`  payload_type: ${payload.rows[0].payload_type}`);
        console.log(`  nodes_type: ${payload.rows[0].nodes_type}`);
        console.log(`  node_count_in_payload: ${payload.rows[0].node_count}`);
      }
    }
  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => console.log('FAILED:', e.message));
