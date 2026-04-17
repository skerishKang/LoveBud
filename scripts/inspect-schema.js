const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// .env 파일 로드
const envPath = path.resolve(__dirname, '.env');
let env = {};
try {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([A-Za-z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  });
} catch (e) {
  console.error('❌ .env 파일을 읽을 수 없습니다:', e.message);
  process.exit(1);
}

const connStr = env.NETLIFY_DATABASE_URL || env.DATABASE_URL;
if (!connStr) {
  console.error('❌ NETLIFY_DATABASE_URL 또는 DATABASE_URL 환경변수가 없습니다');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const client = await pool.connect();
  try {
    // 1) trees 테이블 컬럼
    console.log('\n=== trees 테이블 컬럼 ===');
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'trees'
      ORDER BY ordinal_position;
    `);
    if (cols.rows.length === 0) console.log('(테이블 없음)');
    else cols.rows.forEach(r => {
      console.log(`  ${r.column_name}  (${r.data_type})  nullable=${r.is_nullable}`);
    });

    // 2) memories 테이블 컬럼
    console.log('\n=== memories 테이블 컬럼 ===');
    const memCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'memories'
      ORDER BY ordinal_position;
    `);
    if (memCols.rows.length === 0) console.log('(테이블 없음)');
    else memCols.rows.forEach(r => {
      console.log(`  ${r.column_name}  (${r.data_type})  nullable=${r.is_nullable}`);
    });

    // 3) 샘플 데이터 건수
    const treeCnt = await client.query('SELECT COUNT(*) as c FROM trees');
    console.log(`\n🌳 전체 trees: ${treeCnt.rows[0].c}개`);

    const pubCnt = await client.query(`
      SELECT COUNT(*) as c FROM trees WHERE is_public = true
    `);
    console.log(`📂 Public trees (is_public=true): ${pubCnt.rows[0].c}개`);

    const demoCnt = await client.query(`
      SELECT COUNT(*) as c FROM trees WHERE owner_id = '6xJoZMw64gWZcSIIS92kmBcSGVn1'
    `);
    console.log(`👤 Demo Owner trees: ${demoCnt.rows[0].c}개`);

    // 3-1) Demo Owner 트리 상세
    const demoTrees = await client.query(`
      SELECT id, name, is_public, node_count, payload
      FROM trees
      WHERE owner_id = '6xJoZMw64gWZcSIIS92kmBcSGVn1'
    `);
    console.log(`\n=== Demo Owner 트리 목록 (${demoTrees.rows.length}개) ===`);
    for (const t of demoTrees.rows) {
      const payload = t.payload || {};
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      console.log(`  ID: ${t.id}`);
      console.log(`  이름: ${t.name} | public: ${t.is_public} | nodes: ${nodes.length}`);
      if (nodes.length > 0) {
        console.log(`    첫 노드: ${nodes[0].title || nodes[0].id}`);
        console.log(`    emotion_tags: ${JSON.stringify(nodes[0].emotion_tags || nodes[0].emotionTags)}`);
      }
    }

    // memories 테이블 확인 (존재하는지)
    console.log('\n=== memories 테이블 확인 ===');
    try {
      const memCnt = await client.query('SELECT COUNT(*) as c FROM memories');
      console.log(`🧠 전체 memories: ${memCnt.rows[0].c}개`);
    } catch (e) {
      console.log('  (테이블 없음 - 정상)');
    }

    // 3-2) 특정 트리 payload 상세
    const targetTreeId = 'public-bts-growth';
    const specific = await client.query('SELECT id, name, payload FROM trees WHERE id = $1', [targetTreeId]);
    if (specific.rows.length > 0) {
      console.log(`\n=== 특정 트리 상세: ${targetTreeId} ===`);
      const t = specific.rows[0];
      console.log(`이름: ${t.name}`);
      console.log(`Payload 전체: ${JSON.stringify(t.payload, null, 2)}`);
      const nodes = t.payload?.nodes || [];
      console.log(`Nodes 개수: ${nodes.length}`);
      if (nodes.length > 0) {
        console.log('첫 번째 node 구조:');
        console.log(JSON.stringify(nodes[0], null, 2));
      }
    }

  } catch (err) {
    console.error('\n❌ DB 조회 실패:', err.message);
    console.error('   stack:', err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

inspect();
