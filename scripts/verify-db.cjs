/**
 * LoveBud DB Verification Script
 * phase1 시드 결과 검증
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 필요');
  process.exit(1);
}

async function main() {
  console.log('\n📊 LoveBud DB Verification\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 1. 전체 카운트
    const totalResult = await client.query('SELECT COUNT(*) as total FROM trees');
    console.log('📈 전체 Trees: ' + totalResult.rows[0].total + '개');

    // 2. Public 트리 수
    const publicResult = await client.query("SELECT COUNT(*) as count FROM trees WHERE is_public = true");
    console.log('📈 Public Trees: ' + publicResult.rows[0].count + '개');

    // 3. Demo Owner 트리 수
    const demoResult = await client.query(
      "SELECT COUNT(*) as count FROM trees WHERE owner_id = $1",
      ['6xJoZMw64gWZcSIIS92kmBcSGVn1']
    );
    console.log('📈 Demo Owner Trees: ' + demoResult.rows[0].count + '개');

    // 4. 최근 삽입된 public tree 5개
    console.log('\n📋 최근 삽입된 Public Trees (상위 5개):');
    const recentResult = await client.query(`
      SELECT id, name, is_public, owner_id, node_count, 
             created_at::date as created_date, updated_at::date as updated_date
      FROM trees 
      WHERE is_public = true 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    recentResult.rows.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.id}`);
      console.log(`     title: ${row.name}`);
      console.log(`     nodes: ${row.node_count}개, created: ${row.created_date}`);
    });

    // 5. 샘플 노드 데이터 확인 (상위 1개)
    console.log('\n📋 첫 번째 트리의 노드 샘플:');
    const sampleResult = await client.query(`
      SELECT t.id as tree_id, t.name as tree_title, 
             t.payload->>'nodes' as nodes_json
      FROM trees t
      WHERE t.is_public = true
      ORDER BY t.created_at DESC
      LIMIT 1
    `);
    if (sampleResult.rows.length > 0) {
      const row = sampleResult.rows[0];
      const nodes = JSON.parse(row.nodes_json || '[]');
      console.log(`  Tree: ${row.tree_title}`);
      console.log(`  Nodes: ${nodes.length}개`);
      if (nodes.length > 0) {
        console.log('\n  첫 번째 노드:');
        console.log('    id: ' + nodes[0].id);
        console.log('    title: ' + nodes[0].title);
        console.log('    thumbnail: ' + (nodes[0].thumbnail || 'N/A').substring(0, 50) + '...');
        console.log('    artist: ' + nodes[0].artist);
      }
    }

    console.log('\n✅ 검증 완료\n');

  } catch (err) {
    console.error('❌ 검증 실패:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });