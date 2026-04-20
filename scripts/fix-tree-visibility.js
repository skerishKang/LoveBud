/**
 * LoveBud - trees.visibility를 public으로 업데이트
 * 사용법: node scripts/fix-tree-visibility.js "postgresql://..."
 */

const { Pool } = require('pg');

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL이 필요합니다.');
  console.error('사용법: node scripts/fix-tree-visibility.js "postgresql://username:password@host/database"');
  process.exit(1);
}

async function fixTreeVisibility() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 DB 연결 중...');
    
    // 현재 상태 확인
    console.log('\n📊 현재 trees 상태:');
    const beforeResult = await pool.query(`
      SELECT visibility, COUNT(*) as count 
      FROM trees 
      GROUP BY visibility
    `);
    console.table(beforeResult.rows);

    // public 트리 목록
    console.log('\n🌳 public 트리 목록:');
    const publicTrees = await pool.query(`
      SELECT id, title, visibility, created_at
      FROM trees
      WHERE visibility = 'public'
      ORDER BY created_at DESC
    `);
    console.table(publicTrees.rows);

    // 업데이트 실행
    console.log('\n🔄 visibility를 public으로 업데이트...');
    const updateResult = await pool.query(`
      UPDATE trees
      SET visibility = 'public',
          updated_at = NOW()
      WHERE visibility IS DISTINCT FROM 'public'
      RETURNING id, title
    `);
    
    console.log(`✅ ${updateResult.rowCount}개 트리 업데이트 완료`);
    if (updateResult.rows.length > 0) {
      console.log('업데이트된 트리:');
      updateResult.rows.forEach(t => console.log(`  - ${t.id}: ${t.title}`));
    }

    // 업데이트 후 상태
    console.log('\n📊 업데이트 후 trees 상태:');
    const afterResult = await pool.query(`
      SELECT visibility, COUNT(*) as count 
      FROM trees 
      GROUP BY visibility
    `);
    console.table(afterResult.rows);

    // memories도 함께 업데이트
    console.log('\n🔄 memories visibility도 public으로 업데이트...');
    const memUpdateResult = await pool.query(`
      UPDATE memories
      SET visibility = 'public',
          updated_at = NOW()
      WHERE visibility IS DISTINCT FROM 'public'
    `);
    console.log(`✅ ${memUpdateResult.rowCount}개 메모리 업데이트 완료`);

    console.log('\n🎉 완료! 이제 /api/community/trees를 다시 확인하세요.');
    console.log('   curl.exe -s "https://lovebud.netlify.app/api/community/trees"');

  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixTreeVisibility();
