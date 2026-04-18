const { query } = require('./netlify/functions/_lib/db');

async function checkSchema() {
  try {
    console.log('--- Tables ---');
    const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(tables.rows);

    for (const table of tables.rows) {
      console.log(`--- Columns for ${table.table_name} ---`);
      const cols = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table.table_name}'`);
      console.log(cols.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkSchema();
