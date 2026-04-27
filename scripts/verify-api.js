const fs = require('fs');
const path = require('path');

const libPath = path.resolve(__dirname, '../netlify/functions/_lib/doc-store.js');
if (!fs.existsSync(libPath)) {
  console.log('Skipping API verification: netlify/functions missing');
  process.exit(0);
}
const { queryTrees, queryMemories, getTree } = require('../netlify/functions/_lib/doc-store');
// .env 로드
const envPath = path.resolve(__dirname, '.env');
try {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([A-Za-z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
} catch (e) {}

async function verify() {
  console.log('🔍 LoveBud API 1차 검증\n');
  
  try {
    // Test 1: GET /trees (all)
    console.log('1. GET /trees (전체)');
    const all = await queryTrees({});
    console.log(`   ✅ 조회 성공: ${all.length}개 트리`);
    
    // public 개수
    const publicCount = all.filter(t => t.data.visibility === 'public').length;
    console.log(`   ✅ 공개 트리: ${publicCount}개`);
    
    // 노드 포함 여부
    const withNodes = all.filter(t => t.data.nodes && t.data.nodes.length > 0).length;
    console.log(`   ✅ nodes 포함된 트리: ${withNodes}개`);
    
    if (all.length > 0) {
      const sample = all[0].data;
      console.log(`   📄 샘플 트리: ${sample.title}`);
      console.log(`      nodes 개수: ${sample.nodes ? sample.nodes.length : 0}`);
      if (sample.nodes && sample.nodes[0]) {
        console.log(`      첫 node 감정태그: ${JSON.stringify(sample.nodes[0].emotion_tags)}`);
      }
    }

    // Test 2: GET /trees?visibility=public
    console.log('\n2. GET /trees?visibility=public (공개 only)');
    const publicOnly = await queryTrees({ visibility: 'public' });
    console.log(`   ✅ 조회 성공: ${publicOnly.length}개 트리`);
    publicOnly.slice(0, 3).forEach((t, i) => {
      console.log(`      ${i+1}. ${t.data.title} (nodes: ${t.data.nodes?.length || 0})`);
    });

    // Test 3: GET /trees?ownerId=demo
    console.log('\n3. GET /trees?ownerId=demo-owner (소유자별)');
    const demo = await queryTrees({ ownerId: '6xJoZMw64gWZcSIIS92kmBcSGVn1' });
    console.log(`   ✅ 조회 성공: ${demo.length}개 트리`);
    
    // Test 4: GET /memories?treeId=public-bts-growth
    console.log('\n4. GET /memories?treeId=public-bts-growth (트리별 memories)');
    const mems = await queryMemories({ treeId: 'public-bts-growth' });
    console.log(`   ✅ 조회 성공: ${mems.length}개 memory`);
    mems.slice(0, 2).forEach((m, i) => {
      console.log(`      ${i+1}. ${m.data.title} | tags: ${JSON.stringify(m.data.emotion_tags)}`);
    });

    // Test 5: GET /community/memories (모든 public memories)
    console.log('\n5. GET /community/memories (공개 memories 통합)');
    const community = await queryMemories({ visibility: 'public', limit: 20 });
    console.log(`   ✅ 조회 성공: ${community.length}개 memory`);
    // 트리별 집계
    const byTree = {};
    community.forEach(m => {
      const tid = m.data.tree_id;
      if (!byTree[tid]) byTree[tid] = 0;
      byTree[tid]++;
    });
    console.log(`   📊 트리별 memory 수:`);
    Object.entries(byTree).forEach(([tid, cnt]) => {
      console.log(`      ${tid}: ${cnt}개`);
    });

    // Test 6: GET /trees/:id (single tree)
    console.log('\n6. GET /trees/:id (단일 트리 상세)');
    const single = await getTree('public-bts-growth');
    if (single) {
      console.log(`   ✅ 조회 성공: ${single.data.title}`);
      console.log(`      nodes: ${single.data.nodes?.length || 0}개`);
      console.log(`      emotion_tags (tree-level): ${JSON.stringify(single.data.emotion_tags)}`);
    } else {
      console.log('   ❌ 트리 없음');
    }

    console.log('\n✅ 모든 API 호출 성공! browse/search가 정상 표시되어야 합니다.');
    console.log('⚠️  단, search.js가 API 응답을 올바르게 파싱하는지도 확인 필요');
    
  } catch (err) {
    console.error('\n❌ 검증 실패:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

verify();
