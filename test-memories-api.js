const { queryMemories, getMemory } = require('./netlify/functions/_lib/doc-store');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
try {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([A-Za-z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
} catch (e) {}

async function test() {
  try {
    // 1) 특정 트리 memories 조회
    console.log('=== queryMemories({ treeId: "public-bts-growth" }) ===');
    const mems = await queryMemories({ treeId: 'public-bts-growth' });
    console.log(`총 ${mems.length}개 memory`);
    mems.forEach((m, i) => {
      console.log(`${i+1}. ${m.data.title} | tags: ${JSON.stringify(m.data.emotion_tags)} | timestamp: ${m.data.timestamp}`);
    });

    // 2) community memories (no treeId)
    console.log('\n=== queryMemories({ visibility: "public", limit: 10 }) ===');
    const publicMems = await queryMemories({ visibility: 'public', limit: 10 });
    console.log(`총 ${publicMems.length}개 public memory (전체 트리 통합)`);
    // 트리별 집계
    const byTree = {};
    publicMems.forEach(m => {
      const tid = m.data.tree_id;
      if (!byTree[tid]) byTree[tid] = [];
      byTree[tid].push(m);
    });
    Object.entries(byTree).forEach(([tid, list]) => {
      console.log(`  tree ${tid}: ${list.length}개 memory`);
    });

    // 3) getMemory 테스트 (첫 번째 memory id)
    if (mems.length > 0) {
      const memId = mems[0].id;
      console.log(`\n=== getMemory("${memId}") ===`);
      const found = await getMemory(memId);
      if (found) {
        console.log(`Found: ${found.data.title} (tree: ${found.data.tree_id})`);
      } else {
        console.log('Not found');
      }
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  }
}

test();
