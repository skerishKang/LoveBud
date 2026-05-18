// Find owner_id from users table and run seed
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
    // Find admin/test user by email
    const user = await client.query(
      `SELECT id, external_user_id, email FROM users WHERE email LIKE $1 LIMIT 5`,
      ['%test5@lovebud.local']
    );
    console.log('Test accounts found:', user.rows.length);
    user.rows.forEach((r, i) => {
      const email = r.email;
      const uid = r.external_user_id || r.id;
      // Show only domain part of email
      console.log(`  [${i}] email=${email.split('@')[0]}...@${email.split('@')[1]}`);
      console.log(`  external_user_id=${uid ? uid.slice(0,4)+'...'+uid.slice(-4) : 'null'}`);
    });

    // Also try to find any user with an external_user_id
    const withUid = await client.query(
      `SELECT external_user_id, email FROM users WHERE external_user_id IS NOT NULL LIMIT 3`
    );
    console.log('\nUsers with external_user_id:', withUid.rows.length);
    withUid.rows.forEach((r, i) => {
      const uid = r.external_user_id;
      const email = r.email;
      console.log(`  [${i}] email domain=...@${email.split('@')[1]} uid_len=${uid.length}`);
    });

    // Also check dev002 or admin001 style emails
    const allUsers = await client.query(`SELECT email FROM users ORDER BY email LIMIT 20`);
    console.log('\nAll user emails:');
    allUsers.rows.forEach(r => console.log(`  - ${r.email}`));

  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => console.log('FAILED:', e.message));
