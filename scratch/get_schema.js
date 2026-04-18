const { Client } = require('pg');

async function get_schema() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_5aH9oiPjWIyJ@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  console.log("--- trees schema ---");
  const trees = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trees' ORDER BY ordinal_position");
  trees.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

  console.log("\n--- memories schema ---");
  const memories = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'memories' ORDER BY ordinal_position");
  memories.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

  await client.end();
}

get_schema().catch(console.error);
