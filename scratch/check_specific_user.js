const { Client } = require('pg');

async function check_user() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  const r = await client.query("SELECT * FROM users WHERE email='lovetest2026@gmail.com'");
  console.log(r.rows);

  await client.end();
}

check_user().catch(console.error);
