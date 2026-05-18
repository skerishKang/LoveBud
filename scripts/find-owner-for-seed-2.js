// Find owner_id format for existing trees
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
    // Get owner_ids from trees that have public trees
    const trees = await client.query(
      `SELECT DISTINCT owner_id, COUNT(*) as cnt 
       FROM trees WHERE owner_id IS NOT NULL 
       GROUP BY owner_id ORDER BY cnt DESC LIMIT 3`
    );
    console.log('Distinct owner_ids in trees:');
    trees.rows.forEach((r, i) => {
      const masked = r.owner_id.substring(0, 6) + '...' + r.owner_id.substring(r.owner_id.length - 4);
      console.log(`  [${i}] ${masked} (${r.cnt} trees)`);
    });

    // Get a specific tree to confirm owner pattern
    const publicTree = await client.query(
      `SELECT owner_id, name FROM trees WHERE is_public = true AND owner_id IS NOT NULL LIMIT 1`
    );
    if (publicTree.rows.length > 0) {
      const r = publicTree.rows[0];
      const masked = r.owner_id.substring(0, 6) + '...' + r.owner_id.substring(r.owner_id.length - 4);
      console.log(`\nSample public tree owner: ${masked}, icon_len=${r.owner_id.length}`);
    }
  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => console.log('FAILED:', e.message));
