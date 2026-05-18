const fs = require('fs');
const path = require('path');

// Read .secrets file
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

if (!dbUrl) {
  console.log('DATABASE_URL: MISSING');
  process.exit(1);
}

console.log('DB_URL found, querying...');

const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    // Get distinct owner_ids from trees
    const trees = await client.query('SELECT DISTINCT owner_id FROM trees ORDER BY owner_id LIMIT 10');
    console.log('\n=== Owner IDs from trees table ===');
    if (trees.rows.length === 0) {
      console.log('No trees found - need to check if table exists');
      const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
      console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
    } else {
      trees.rows.forEach((row, i) => console.log(`OWNER_ID[${i}]: ${row.owner_id}`));
    }

    // Also check memories table
    const memories = await client.query('SELECT DISTINCT owner_id FROM memories ORDER BY owner_id LIMIT 5');
    if (memories.rows.length > 0) {
      console.log('\n=== Owner IDs from memories table ===');
      memories.rows.forEach((row, i) => console.log(`MEMORY_OWNER[${i}]: ${row.owner_id}`));
    }
  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.log('QUERY FAILED:', e.message); process.exit(1); });
