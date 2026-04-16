const { Pool } = require('pg');

// Neon DB 연결
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_5aH9oiPjWIyJ@ep-little-poetry-a1vjyiim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// 프롬프트 1: 기존 트리에 메모리 3개 (payload.nodes 형식)
const existingTreeMemories = [
  {
    id: 'mem-root-001',
    parentId: null,
    title: '처음 들은 그날, 모든 게 달라졌어',
    memo: '유튜브 알고리즘이 던져준 영상. 첫 노트부터 심장이 뛰었고, 3분짜리 영상을 10번 반복했다. 이게 입덕이라는 거구나.',
    timestamp: '2023.03.15',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sourceType: 'youtube',
    emotionTags: ['#첫설렘', '#입덕', '#운명'],
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg'
  },
  {
    id: 'mem-child-002',
    parentId: 'mem-root-001',
    title: '라이브 무대에서 눈물이 났던 순간',
    memo: '직접 보니까 더 달랐다. 노래 중간에 흘린 땀방울까지 보이고, 숨 소리가 들렸어. 팬들이 함께 부르는 파트에서 내 목소리도 섞였다.',
    timestamp: '2023.06.22',
    sourceUrl: 'https://www.youtube.com/embed/6_bzPdB7B6U',
    sourceType: 'youtube',
    emotionTags: ['#감동', '#라이브', '#함께했던순간'],
    thumbnail: 'https://img.youtube.com/vi/6_bzPdB7B6U/0.jpg'
  },
  {
    id: 'mem-child-003',
    parentId: 'mem-child-002',
    title: '첫 팬미팅, 마주보고 인사했을 때',
    memo: '5초? 3초? 짧았지만 충분했어. 내가 8개월 동안 매일 본 영상 속 사람이 내 앞에 서 있었고, 내 이름을 불러줬다. 손 떨림을 억제하지 못했다.',
    timestamp: '2023.11.08',
    sourceUrl: 'https://www.youtube.com/embed/L_jWHffIx5E',
    sourceType: 'youtube',
    emotionTags: ['#실제만남', '#꿈같음', '#오래기억할'],
    thumbnail: 'https://img.youtube.com/vi/L_jWHffIx5E/0.jpg'
  }
];

// 프롬프트 2: 새 트리
const newTree = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'BTS, 내 20대의 soundtrack이 되다',
  is_public: false,
  owner_id: '6xJoZMw64gWZcSIIS92kmBcSGVn1',
  node_count: 4,
  payload: {
    description: '처음엔 그냥 좋은 음악이었는데, 어느 순간 내 삶의 배경음악이 되었어',
    stage: 'deep',
    emotionTags: ['#위로', '#성장', '#청춘'],
    nodes: [
      {
        id: 'bts-mem-001',
        parentId: null,
        title: '시험 끝난 날, 우연히 들은 Spring Day',
        memo: '도서관에서 시험 공부하다가 귀가 막힌 것처럼 모든 소리가 사라지고 이 노래만 들렸어. 가사를 검색해봤더니 내 마음을 다 알고 있더라고.',
        timestamp: '2022.06.18',
        sourceUrl: 'https://www.youtube.com/embed/xEeFrLSkMm8',
        sourceType: 'youtube',
        emotionTags: ['#처음', '#위로', '#봄날'],
        thumbnail: 'https://img.youtube.com/vi/xEeFrLSkMm8/0.jpg'
      },
      {
        id: 'bts-mem-002',
        parentId: 'bts-mem-001',
        title: 'Love Yourself 시리즈를 듣고 나서',
        memo: '제목이 먼저 와닿았다. 너 자신을 사랑하라. 그때는 자신을 사랑하는 게 뭔지 몰랐는데, 이 앨범들이 1년 동안 나의 심리상담사였다.',
        timestamp: '2022.09.05',
        sourceUrl: 'https://www.youtube.com/embed/GEo5bmUKFvI',
        sourceType: 'youtube',
        emotionTags: ['#성장', '#자기사랑', '#치유'],
        thumbnail: 'https://img.youtube.com/vi/GEo5bmUKFvI/0.jpg'
      },
      {
        id: 'bts-mem-003',
        parentId: 'bts-mem-002',
        title: 'Yet To Come 콘서트에서 울고 웃었던 밤',
        memo: '팬 5년차에 처음 간 콘서트. 아미봉 파도가 은하수 같았어. 주변 사람들과 모르는 사이인데도 눈을 마주치면 웃어줬다. 다 같은 마음으로 왔구나.',
        timestamp: '2023.10.15',
        sourceUrl: 'https://www.youtube.com/embed/TiK5Ov6dwPM',
        sourceType: 'youtube',
        emotionTags: ['#콘서트', '#공동체', '#청춘'],
        thumbnail: 'https://img.youtube.com/vi/TiK5Ov6dwPM/0.jpg'
      },
      {
        id: 'bts-mem-004',
        parentId: 'bts-mem-003',
        title: '입대 소식, 그리고 다시 만날 날을 믿어',
        memo: '팬으로서 처음 겪는 이별이야. 근데 슬프지 않아. Spring Day 가사처럼 얼마나 오래 걸릴지 몰라도 다시 만날 거니까. 그때까지 나도 성장해 있을 거야.',
        timestamp: '2024.01.10',
        sourceUrl: 'https://www.youtube.com/embed/7C2z4GqqS5g',
        sourceType: 'youtube',
        emotionTags: ['#기다림', '#성숙', '#약속'],
        thumbnail: 'https://img.youtube.com/vi/7C2z4GqqS5g/0.jpg'
      }
    ]
  }
};

async function insertData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 기존 트리 payload 업데이트 (nodes 추가)
    console.log('[1/3] 기존 트리 payload 업데이트 중...');
    const existingPayload = { nodes: existingTreeMemories };
    await client.query(`
      UPDATE trees 
      SET payload = payload || $1::jsonb,
          node_count = 3,
          updated_at = NOW()
      WHERE id = 'c5e16523-c50f-4459-b5ec-f8d8e6aded94'
    `, [JSON.stringify(existingPayload)]);
    console.log('  ✓ 기존 트리에 nodes 3개 추가 완료');
    
    // 2. 새 트리 삽입
    console.log('[2/3] 새 트리 삽입 중...');
    await client.query(`
      INSERT INTO trees (id, name, is_public, owner_id, node_count, created_at, updated_at, payload)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        payload = EXCLUDED.payload,
        node_count = EXCLUDED.node_count,
        updated_at = NOW()
    `, [newTree.id, newTree.name, newTree.is_public, newTree.owner_id, newTree.node_count, JSON.stringify(newTree.payload)]);
    console.log('  ✓ BTS 트리 삽입 완료');
    
    await client.query('COMMIT');
    console.log('\n=== 모든 데이터 삽입 완료 ===');
    console.log('기존 트리 (c5e16523...): payload.nodes 3개 추가');
    console.log('새 트리 (a1b2c3d4...): BTS 트리 + payload.nodes 4개');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('삽입 실패:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

insertData();
