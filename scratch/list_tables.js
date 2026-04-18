const { Client } = require('pg');

async function list_tables() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_5aH9oiPjWIyJ@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  console.log("--- tables ---");
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  tables.rows.forEach(r => console.log(r.table_name));

  await client.end();
}

list_tables().catch(console.error);
