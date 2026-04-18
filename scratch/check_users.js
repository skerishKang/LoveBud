const { Client } = require('pg');

async function check_users() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  console.log("--- users columns ---");
  const cols = await client.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `);
  cols.rows.forEach(r => console.log(`${r.column_name}: nullable=${r.is_nullable}, default=${r.column_default}`));

  console.log("\n--- sample users ---");
  const users = await client.query("SELECT id, email FROM users LIMIT 5");
  users.rows.forEach(r => console.log(`${r.id}: ${r.email}`));

  await client.end();
}

check_users().catch(console.error);
