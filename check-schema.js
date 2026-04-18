const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://neondb_owner:REDACTED@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});
p.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'trees\' ORDER BY ordinal_position')
  .then(r => { console.log(r.rows.map(x => x.column_name).join(', ')); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });