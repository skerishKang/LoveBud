const { Client } = require('pg');

async function dump_tree() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_5aH9oiPjWIyJ@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  const r = await client.query("SELECT * FROM trees LIMIT 1");
  if (r.rows.length > 0) {
    console.log(JSON.stringify(r.rows[0], null, 2));
  } else {
    console.log("No trees found");
  }

  await client.end();
}

dump_tree().catch(console.error);
