const { Client } = require('pg');

async function get_constraints() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_5aH9oiPjWIyJ@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  });
  await client.connect();

  console.log("--- trees columns nullability ---");
  const cols = await client.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'trees'
  `);
  cols.rows.forEach(r => console.log(`${r.column_name}: nullable=${r.is_nullable}, default=${r.column_default}`));

  await client.end();
}

get_constraints().catch(console.error);
