/**
 * LoveBud Phase1 Specific Verification
 * phase1 시드에서 삽입한 트리만 확인
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 필요');
  process.exit(1);
}

async function main() {
  console.log('\n📊 Phase1 Seed Specific Verification\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Phase1에서 삽입한 tree ID들
    const PHASE1_IDS = ['public-bts-growth', 'public-first-love', 'public-energy-boost'];

    console.log('📋 Phase1 트리 검색:');
    for (const treeId of PHASE1_IDS) {
      const result = await client.query(`
        SELECT id, name, is_public, owner_id, node_count, 
               created_at::date as created_date,
               (payload->>'nodes')::jsonb as nodes
        FROM trees 
        WHERE id = $1
      `, [treeId]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const nodes = row.nodes || []; // payload->>'nodes' already returns parsed JSON in PostgreSQL
        console.log(`\n✅ ${treeId}`);
        console.log(`   title: ${row.name}`);
        console.log(`   nodes: ${nodes.length}개`);
        console.log(`   is_public: ${row.is_public}`);
        console.log(`   owner: ${row.owner_id}`);
        
        // 첫 번째 노드 확인
        if (nodes.length > 0) {
          console.log(`   첫 노드: ${nodes[0].title}`);
          console.log(`   첫 thumbnail: ${(nodes[0].thumbnail || '').substring(0, 50)}...`);
        }
      } else {
        console.log(`\n❌ ${treeId} - 없음`);
      }
    }

    // Phase1에서 삽입한 총 노드 수
    console.log('\n📈 Phase1 노드 합계:');
    const phase1Nodes = await client.query(`
      SELECT SUM(node_count) as total_nodes
      FROM trees 
      WHERE id = ANY($1)
    `, [PHASE1_IDS]);
    console.log(`   Phase1 총 노드: ${phase1Nodes.rows[0].total_nodes}개`);

    console.log('\n✅ Phase1 검증 완료\n');

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