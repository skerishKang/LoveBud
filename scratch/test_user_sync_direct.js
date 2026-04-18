const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testSync() {
  const user = { uid: 'test-node-sync-' + Date.now(), email: 'node-sync-test@example.com', displayName: 'Node Sync Test' };
  try {
    console.log('Testing SELECT...');
    const r = await pool.query('SELECT id FROM users WHERE id = $1', [user.uid]);
    console.log('Exists?', r.rows.length > 0);

    if (!r.rows.length) {
      console.log('Inserting...');
      await pool.query(
        `INSERT INTO users (id, email, display_name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [user.uid, user.email || '', user.displayName]
      );
      console.log('Insert success!');
    }
  } catch (e) {
    console.error('FAILED:', e.message);
    if (e.detail) console.error('Detail:', e.detail);
  } finally {
    process.exit(0);
  }
}

testSync();
