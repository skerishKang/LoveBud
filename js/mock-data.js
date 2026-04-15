// LoveBud 샘플/예시 콘텐츠 (Demo Data)
// ⚠️ 검증 가능한 공개 콘텐츠를 기반으로 구성한 데모 데이터입니다
// 133-relovetree 폴더에 실제 근거 자료는 없으나,
// 아래 콘텐츠는 공식 YouTube 채널에서 검증된 실제 공개 영상입니다
// 실제 서비스 시에는 사용자 생성 콘텐츠로 교체 필요

// ── Trees (샘플/데모 트리) ─────────────────────────────────────────
// ⚠️ 아래 트리는 실제 사용자 트리가 아닌 데모용 예시입니다
// 2025-04-15: Hearts2Hearts 항목 중 placeholder ID가 확인되어 전체 삭제
// 현재 검증된 공식 콘텐츠: BTS Official YouTube 채널 4개 MV만 포함
var trees = [
  {
    id: 'demo-bts-public',
    ownerId: 'demo-user-001',
    title: '[샘플] BTS 공식 MV 모음',
    visibility: 'public',
    createdAt: '2024-01-15',
    updatedAt: '2024-07-20',
    isDemo: true
  }
];

// ── Memories (검증된 공개 콘텐츠 기반 샘플) ───────────────────────
// 모든 sourceUrl은 공식 YouTube 채널의 실제 공개 영상입니다
// memo는 객관적 설명과 절제된 감상을 담았습니다
var memories = [
  // === Tree 1: BTS 공식 MV (demo-bts-public) ===
  // 검증 출처: BTS Official YouTube Channel (https://www.youtube.com/@BTS)
  {
    id: 'root',
    treeId: 'demo-bts-public',
    title: 'BTS 공식 MV 모음',
    memo: 'BTS 공식 유튜브 채널의 대표 뮤직비디오 클립 모음. 2017-2021년 발표된 공식 콘텐츠입니다.',
    timestamp: '2017.02.13',
    sourceUrl: '',
    sourceType: 'system',
    emotionTags: ['시작'],
    parentId: null,
    thumbnail: '',
    visibility: 'private',
    createdAt: '2017-02-13',
    x: 400,
    y: 300,
    delay: '0s'
  },
  {
    id: 'bts-001',
    treeId: 'demo-bts-public',
    title: 'BTS — 봄날 (Spring Day) Official MV',
    memo: '2017년 2월 13일 공개된 BTS의 정규 2집 리패키지 타이틀곡 뮤직비디오. 눈 덮인 풍경과 봄을 기다리는 서사를 담은 공식 MV입니다.',
    quote: '봄날이 오면 꽃이 피고',
    timestamp: '2017.02.13',
    sourceUrl: 'https://www.youtube.com/embed/xEeFrLSkMm8',
    sourceType: 'youtube',
    emotionTags: ['봄', '그리움', '희망'],
    parentId: 'root',
    thumbnail: 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg',
    visibility: 'public',
    createdAt: '2017-02-13',
    artist: 'BTS',
    source: 'BTS Official YouTube',
    x: 200,
    y: 150,
    delay: '0.5s'
  },
  {
    id: 'bts-002',
    treeId: 'demo-bts-public',
    title: 'BTS — Dynamite Official MV',
    memo: '2020년 8월 21일 공개된 BTS의 첫 영어 싱글 뮤직비디오. 디스코 팝 장르의 공식 MV입니다.',
    quote: 'Shining through the city',
    timestamp: '2020.08.21',
    sourceUrl: 'https://www.youtube.com/embed/gdZLi9oWNZg',
    sourceType: 'youtube',
    emotionTags: ['에너지', '여름'],
    parentId: 'root',
    thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg',
    visibility: 'public',
    createdAt: '2020-08-21',
    artist: 'BTS',
    source: 'BTS Official YouTube',
    x: 600,
    y: 200,
    delay: '1s'
  },
  {
    id: 'bts-003',
    treeId: 'demo-bts-public',
    title: 'BTS — Butter Official MV',
    memo: '2021년 5월 21일 공개된 BTS의 두 번째 영어 싱글 공식 뮤직비디오입니다.',
    quote: 'Smooth like butter',
    timestamp: '2021.05.21',
    sourceUrl: 'https://www.youtube.com/embed/UMHX0l11nlY',
    sourceType: 'youtube',
    emotionTags: ['경쾌', '댄스'],
    parentId: 'root',
    thumbnail: 'https://img.youtube.com/vi/UMHX0l11nlY/mqdefault.jpg',
    visibility: 'public',
    createdAt: '2021-05-21',
    artist: 'BTS',
    source: 'BTS Official YouTube',
    x: 150,
    y: 450,
    delay: '1.5s'
  },
  {
    id: 'bts-004',
    treeId: 'demo-bts-public',
    title: 'BTS — Permission to Dance Official MV',
    memo: '2021년 7월 9일 공개된 BTS의 영어 싱글 공식 뮤직비디오. 에드 시런이 작곡에 참여했습니다.',
    quote: 'We don\'t need permission to dance',
    timestamp: '2021.07.09',
    sourceUrl: 'https://www.youtube.com/embed/CuklIb9dEfA',
    sourceType: 'youtube',
    emotionTags: ['자유', '희망'],
    parentId: 'root',
    thumbnail: 'https://img.youtube.com/vi/CuklIb9dEfA/mqdefault.jpg',
    visibility: 'public',
    createdAt: '2021-07-09',
    artist: 'BTS',
    source: 'BTS Official YouTube',
    x: 700,
    y: 400,
    delay: '2s'
  },

  // Note: Hearts2Hearts 항목은 2025-04-15에 placeholder 영상 ID 확인으로 인해 전체 삭제됨
  // 검증된 공식 콘텐츠만 유지 (BTS Official YouTube 4개 MV)
];

// ── Helper Functions ──────────────────────────────────────────────
function getMemoriesByTree(treeId) {
  return memories.filter(function(m) { return m.treeId === treeId; });
}

function getMemory(id) {
  return memories.find(function(m) { return m.id === id; }) || null;
}

function getTrees() {
  return trees;
}
