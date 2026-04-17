const { queryTrees } = require('./netlify/functions/_lib/doc-store');
const fs = require('fs');
const path = require('path');

// .env 수동 로드
const envPath = path.resolve(__dirname, '.env');
try {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([A-Za-z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
  console.log('✅ .env 로드 완료');
} catch (e) {
  console.warn('⚠️ .env 파일 없음, 환경변수 사용');
}

async function test() {
  try {
    console.log('=== GET /trees (no filter) ===');
    const all = await queryTrees({});
    console.log(`총 ${all.length}개 트리`);
    all.forEach((t, i) => {
      const d = t.data;
      console.log(`${i+1}. ${d.title} (visibility:${d.visibility}, public:${d.is_public}, nodes:${d.nodes ? d.nodes.length : 0})`);
      if (d.nodes && d.nodes.length > 0) {
        console.log(`   nodes[0].emotion_tags:`, d.nodes[0].emotion_tags || d.nodes[0].emotionTags);
      }
    });

    console.log('\n=== GET /trees?visibility=public ===');
    const publicTrees = await queryTrees({ visibility: 'public' });
    console.log(`공개 트리 ${publicTrees.length}개`);
    publicTrees.forEach((t, i) => {
      console.log(`${i+1}. ${t.data.title} (nodes:${t.data.nodes ? t.data.nodes.length : 0})`);
    });

    console.log('\n=== GET /trees?ownerId=demo-owner ===');
    const demo = await queryTrees({ ownerId: '6xJoZMw64gWZcSIIS92kmBcSGVn1' });
    console.log(`데모 오너 트리 ${demo.length}개`);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  }
}

test();
