const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // 1. Check current schema
  console.log('=== Current trees columns ===');
  const cols = await pool.query(
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_name = 'trees'
     ORDER BY ordinal_position`
  );
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} default=${r.column_default}`));

  // 2. Check if name/is_public/node_count/payload exist
  const existingCols = cols.rows.map(r => r.column_name);
  const needsMigration = ['name', 'is_public', 'node_count', 'payload'].filter(c => !existingCols.includes(c));
  console.log('\n=== Migration needed for: ===', needsMigration.length ? needsMigration : 'none');

  if (needsMigration.length === 0) {
    console.log('Migration already applied. Verifying data...');
    const rows = await pool.query('SELECT id, title, name, visibility, is_public, node_count FROM trees LIMIT 5');
    console.log(JSON.stringify(rows.rows, null, 2));
  } else {
    console.log('\nApplying migration 002_add_payload_columns.sql...');
    const sql = fs.readFileSync('netlify/sql/002_add_payload_columns.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration applied.');

    // Verify
    const rows = await pool.query('SELECT id, title, name, visibility, is_public, node_count, jsonb_typeof(payload->\'nodes\') as nodes_type FROM trees LIMIT 5');
    console.log('\n=== After migration ===');
    console.log(JSON.stringify(rows.rows, null, 2));
  }

  await pool.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });