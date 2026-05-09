/**
 * LoveBud Public Trees Seeder
 * browse/search용 public 트리 시드 스크립트
 * 
 * 사용법:
 *   # 환경변수 설정 후 실행
 *   DATABASE_URL=postgresql://... node scripts/seed-public-trees.js
 *   
 *   # Dry-run (실제 삽입 없이 미리보기)
 *   DRY_RUN=true DATABASE_URL=... node scripts/seed-public-trees.js
 *   
 *   # Phase 지정 (phase1=3개, phase2=7개)
 *   SEED_STAGE=phase1 DATABASE_URL=... node scripts/seed-public-trees.js
 *   SEED_STAGE=phase2 DATABASE_URL=... node scripts/seed-public-trees.js
 * 
 * Demo Owner: demo-owner-lovebud (실제 Firebase UID 아님, synthetic owner)
 */

const { Pool } = require('pg');

// ─────────────────────────────────────────────────────────────────────────────
// 환경변수 설정
// ─────────────────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
const DRY_RUN = process.env.DRY_RUN === 'true';
const SEED_STAGE = process.env.SEED_STAGE || 'phase1'; // 'phase1' | 'phase2' | 'all'

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 또는 NETLIFY_DATABASE_URL 환경변수가 필요합니다');
  console.error('   예시: DATABASE_URL=postgresql://... node scripts/seed-public-trees.js');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Owner 설정 (실제 DB에 존재하는 Firebase UID 사용 - FK constraint 준수)
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_OWNER_ID = '6xJoZMw64gWZcSIIS92kmBcSGVn1';
const DEMO_OWNER_NOTE = '데모용 public 트리 owner';

// ─────────────────────────────────────────────────────────────────────────────
// 1차 Public 트리 (3개) - MVP browse 완성용
// ─────────────────────────────────────────────────────────────────────────────
const PHASE1_TREES = [
  {
    id: 'public-bts-growth',
    title: 'BTS, 내 20대의 soundtrack이 되다',
    description: '처음엔 그냥 좋은 음악이었는데, 어느 순간 내 삶의 배경음악이 되었어',
    emotion_tags: ['#위로', '#성장', '#청춘'],
    stage: 'deep',
    memories: [
      {
        id: 'bts-mem-001',
        parent_id: null,
        title: '시험 끝난 날, 우연히 들은 Spring Day',
        memo: '도서관에서 시험 공부하다가 귀가 막힌 것처럼 모든 소리가 사라지고 이 노래만 들렸어. 가사를 검색해봤더니 내 마음을 다 알고 있더라고.',
        timestamp: '2022.06.18',
        source_url: 'https://www.youtube.com/embed/xEeFrLSkMm8',
        source_type: 'youtube',
        emotion_tags: ['#처음', '#위로', '#봄날'],
        thumbnail: 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'bts-mem-002',
        parent_id: 'bts-mem-001',
        title: 'Love Yourself 시리즈를 듣고 나서',
        memo: '제목이 먼저 와닿았다. 너 자신을 사랑하라. 그때는 자신을 사랑하는 게 뭔지 몰랐는데, 이 앨범들이 1년 동안 나의 심리상담사였다.',
        timestamp: '2022.09.05',
        source_url: 'https://www.youtube.com/embed/GEo5bmUKFvI',
        source_type: 'youtube',
        emotion_tags: ['#성장', '#자기사랑', '#치유'],
        thumbnail: 'https://img.youtube.com/vi/GEo5bmUKFvI/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'bts-mem-003',
        parent_id: 'bts-mem-002',
        title: 'Yet To Come 콘서트에서 울고 웃었던 밤',
        memo: '팬 5년차에 처음 간 콘서트. 아미봉 파도가 은하수 같았어. 주변 사람들과 모르는 사이인데도 눈을 마주치면 웃어줬다. 다 같은 마음으로 왔구나.',
        timestamp: '2023.10.15',
        source_url: 'https://www.youtube.com/embed/TiK5Ov6dwPM',
        source_type: 'youtube',
        emotion_tags: ['#콘서트', '#공동체', '#청춘'],
        thumbnail: 'https://img.youtube.com/vi/TiK5Ov6dwPM/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'bts-mem-004',
        parent_id: 'bts-mem-003',
        title: '입대 소식, 그리고 다시 만날 날을 믿어',
        memo: '팬으로서 처음 겪는 이별이야. 근데 슬프지 않아. Spring Day 가사처럼 얼마나 오래 걸릴지 몰라도 다시 만날 거니까. 그때까지 나도 성장해 있을 거야.',
        timestamp: '2024.01.10',
        source_url: 'https://www.youtube.com/embed/7C2z4GqqS5g',
        source_type: 'youtube',
        emotion_tags: ['#기다림', '#성숙', '#약속'],
        thumbnail: 'https://img.youtube.com/vi/7C2z4GqqS5g/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-first-love',
    title: '처음 사랑에 빠진 순간, 봄날의 기억',
    description: '눈 덮인 풍경 속에서 기다리는 봄, 그리고 사랑의 시작',
    emotion_tags: ['#입덕', '#설렘', '#그리움'],
    stage: 'growth',
    memories: [
      {
        id: 'fl-mem-001',
        parent_id: null,
        title: '봄날 MV를 처음 본 순간',
        memo: '2017년 2월. 친구가 보내준 링크를 클릭한 순간, 내 봄은 시작되었다. 눈 덮인 기차역과 친구들의 우정이 보여주는 무언가에 심장이 뛰었다.',
        timestamp: '2017.02.13',
        source_url: 'https://www.youtube.com/embed/xEeFrLSkMm8',
        source_type: 'youtube',
        emotion_tags: ['#첫만남', '#입덕', '#봄'],
        thumbnail: 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'fl-mem-002',
        parent_id: 'fl-mem-001',
        title: 'Blood Sweat & Tears로 깊어진 감정',
        memo: '봄날의 순수함과는 다른, 더 성숙하고 복잡한 매력. 안무 영상을 20번 넘게 봤다. 각 멤버의 표정 하나하나가 기억에 남는다.',
        timestamp: '2017.10.13',
        source_url: 'https://www.youtube.com/embed/hmE9f-TEutc',
        source_type: 'youtube',
        emotion_tags: ['#성장', '#몰입', '#예술'],
        thumbnail: 'https://img.youtube.com/vi/hmE9f-TEutc/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'fl-mem-003',
        parent_id: 'fl-mem-002',
        title: 'Save Me, 그리고 계속된 여정',
        memo: '"Save me, I need your love before I fall, fall" 가사가 내 심장을 찔렀다. 힘들 때마다 찾게 되는 노래가 되었다. 이게 팬이 된다는 건가.',
        timestamp: '2018.05.25',
        source_url: 'https://www.youtube.com/embed/GZb6KwwX-Rs',
        source_type: 'youtube',
        emotion_tags: ['#구원', '#연결', '#위로'],
        thumbnail: 'https://img.youtube.com/vi/GZb6KwwX-Rs/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-energy-boost',
    title: '에너지가 필요한 날, Dynamite와 Butter',
    description: '지친 일상에 필요한 활력과 에너지를 주는 순간들',
    emotion_tags: ['#활력', '#즐거움', '#춤'],
    stage: 'growth',
    memories: [
      {
        id: 'eb-mem-001',
        parent_id: null,
        title: 'Dynamite로 시작되는 아침',
        memo: '2020년, 세상이 멈춘 것 같던 그 해. 이 노래가 아침 알람이 되었다. "Cause I, I, I\'m in the stars tonight" 부분에서 하루가 시작된다.',
        timestamp: '2020.08.21',
        source_url: 'https://www.youtube.com/embed/gdZLi9oWNZg',
        source_type: 'youtube',
        emotion_tags: ['#에너지', '#아침', '#희망'],
        thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'eb-mem-002',
        parent_id: 'eb-mem-001',
        title: 'Butter로 완성되는 하루',
        memo: 'Smooth like butter, like a criminal undercover. 이 중독성 있는 멜로디가 머릿속에서 떠나지 않는다. 힘들 때마다 추억의 댄스를 춰본다.',
        timestamp: '2021.05.21',
        source_url: 'https://www.youtube.com/embed/UMHX0l11nlY',
        source_type: 'youtube',
        emotion_tags: ['#중독성', '#댄스', '#유쾌'],
        thumbnail: 'https://img.youtube.com/vi/UMHX0l11nlY/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'eb-mem-003',
        parent_id: 'eb-mem-002',
        title: 'Permission to Dance, 모두와 함께',
        memo: 'We don\'t need permission to dance! 이 구절에서 자유로움을 느낀다. 에드 시런의 선물 같은 곡, 이 노래가 있어 오늘도 웃을 수 있다.',
        timestamp: '2021.07.09',
        source_url: 'https://www.youtube.com/embed/CuklIb9dEfA',
        source_type: 'youtube',
        emotion_tags: ['#자유', '#희망', '#함께'],
        thumbnail: 'https://img.youtube.com/vi/CuklIb9dEfA/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 2차 Public 트리 (7개) - browse 풍부화용
// ─────────────────────────────────────────────────────────────────────────────
const PHASE2_TREES = [
  {
    id: 'public-iu-comfort',
    title: '아이유, 나의 작은 위로들',
    description: '밤하늘 별처럼 반짝이는 감성 발라드들',
    emotion_tags: ['#위로', '#밤', '#별'],
    stage: 'deep',
    memories: [
      {
        id: 'iu-mem-001',
        parent_id: null,
        title: 'Through the Night의 따뜻함',
        memo: '밤 12시, 창밖으로 보이는 도시 불빛과 함께. 내일이 걱정되던 날, 이 노래가 이불처럼 덮어주었다.',
        timestamp: '2017.03.24',
        source_url: 'https://www.youtube.com/embed/M12RbMSj5NQ',
        source_type: 'youtube',
        emotion_tags: ['#밤', '#위로', '#이불'],
        thumbnail: 'https://img.youtube.com/vi/M12RbMSj5NQ/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      },
      {
        id: 'iu-mem-002',
        parent_id: 'iu-mem-001',
        title: 'Love Poem으로 전하는 마음',
        memo: '콘서트에서 처음 들었을 때의 눈물. "내가 널 사랑하는 것처럼 너도 널 사랑하길" 가사가 가슴에 와닿았다.',
        timestamp: '2019.11.01',
        source_url: 'https://www.youtube.com/embed/nM0xHI5Lisg',
        source_type: 'youtube',
        emotion_tags: ['#사랑', '#시', '#감동'],
        thumbnail: 'https://img.youtube.com/vi/nM0xHI5Lisg/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      },
      {
        id: 'iu-mem-003',
        parent_id: 'iu-mem-002',
        title: 'eight에서 느껴진 성장',
        memo: 'SUGA와의 콜라보, 28살의 아이유가 전하는 위로. 아직 모든 게 괜찮지 않지만, 괜찮아질 거라는 믿음.',
        timestamp: '2020.05.06',
        source_url: 'https://www.youtube.com/embed/EgRrx3Rjb3c',
        source_type: 'youtube',
        emotion_tags: ['#스물여덟', '#성장', '#위로'],
        thumbnail: 'https://img.youtube.com/vi/EgRrx3Rjb3c/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-midnight-vibes',
    title: '새벽에 듣는 노래들',
    description: '잠들지 못하는 밤, 나를 위로해주는 감성 플레이리스트',
    emotion_tags: ['#새벽', '#감성', '#사색'],
    stage: 'growth',
    memories: [
      {
        id: 'mid-mem-001',
        parent_id: null,
        title: '밤을 걷는다 - 장재인',
        memo: '새벽 2시, 혼자 걷는 거리. 가로등 불빛 아래 흩어지는 나의 생각들. 이 노래가 나의 동반자가 되었다.',
        timestamp: '2019.03.12',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#새벽', '#혼자', '#생각'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: '장재인',
        visibility: 'public'
      },
      {
        id: 'mid-mem-002',
        parent_id: 'mid-mem-001',
        title: '길 - 폴킴',
        memo: '퇴근길 지하철에서 우연히 들은 노래. "모든 길은 나아지고 있어" 가사가 그날의 피로를 씻어주었다.',
        timestamp: '2020.08.15',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#퇴근', '#길', '#위로'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: '폴킴',
        visibility: 'public'
      },
      {
        id: 'mid-mem-003',
        parent_id: 'mid-mem-002',
        title: '잠이 오질 않네요 - 장범준',
        memo: '밤 12시가 넘어도 잠이 오지 않는 날. 이 노래를 틀고 천장을 바라보면, 나만 새벽을 새는 게 아닌 것 같아 위로가 된다.',
        timestamp: '2021.01.20',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#불면', '#공감', '#밤'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: '장범준',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-dance-time',
    title: '댄스 타임! 흥 폭발',
    description: '스트레스 날려버리는 에너제틱 댄스 뮤직',
    emotion_tags: ['#댄스', '#흥', '#에너지'],
    stage: 'growth',
    memories: [
      {
        id: 'dance-mem-001',
        parent_id: null,
        title: 'KILL THIS LOVE - 블랙핑크',
        memo: '헬스장에서 힘이 안 날 때. 이 노래만 나오면 무게를 더 들 수 있다. 킬락라브 외치는 순간 나도 모르게 파워가 생긴다.',
        timestamp: '2019.04.05',
        source_url: 'https://www.youtube.com/embed/2S24-y0Ij3Y',
        source_type: 'youtube',
        emotion_tags: ['#힘', '#파워', '#운동'],
        thumbnail: 'https://img.youtube.com/vi/2S24-y0Ij3Y/mqdefault.jpg',
        artist: 'BLACKPINK',
        visibility: 'public'
      },
      {
        id: 'dance-mem-002',
        parent_id: 'dance-mem-001',
        title: 'How You Like That',
        memo: 'Look at you, now look at me. 이 가사를 따라 외칠 때마다 자신감이 생긴다. 안무 영상 보고 따라하는 게 요즘 유일한 취미.',
        timestamp: '2020.06.26',
        source_url: 'https://www.youtube.com/embed/ioNng23B1QY',
        source_type: 'youtube',
        emotion_tags: ['#자신감', '#거울', '#춤'],
        thumbnail: 'https://img.youtube.com/vi/ioNng23B1QY/mqdefault.jpg',
        artist: 'BLACKPINK',
        visibility: 'public'
      },
      {
        id: 'dance-mem-003',
        parent_id: 'dance-mem-002',
        title: 'Pink Venom의 중독성',
        memo: 'Get \'em, get \'em, get \'em. 중독성 있는 비트에 맞춰서 어깨가 들썩인다. 친구들과 노래방에서 부르는 게 최고의 스트레스 해소.',
        timestamp: '2022.08.19',
        source_url: 'https://www.youtube.com/embed/gQlMMD8auMs',
        source_type: 'youtube',
        emotion_tags: ['#중독', '#친구', '#즐거움'],
        thumbnail: 'https://img.youtube.com/vi/gQlMMD8auMs/mqdefault.jpg',
        artist: 'BLACKPINK',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-retro-2010s',
    title: '추억의 2010년대 K-pop',
    description: '학교 강당에서, PC방에서 함께 불렀던 그 시절',
    emotion_tags: ['#추억', '#학창', '#2010s'],
    stage: 'deep',
    memories: [
      {
        id: 'retro-mem-001',
        parent_id: null,
        title: 'Gee - 소녀시대',
        memo: '2009년, 중학교 강당에서 처음 본 춤. 모두가 "Gee Gee Gee"를 따라 불렀다. 그때의 설렘과 에너지가 아직도 선명하다.',
        timestamp: '2009.01.05',
        source_url: 'https://www.youtube.com/embed/U7mPqycQ0tQ',
        source_type: 'youtube',
        emotion_tags: ['#첫사랑', '#학교', '#춤'],
        thumbnail: 'https://img.youtube.com/vi/U7mPqycQ0tQ/mqdefault.jpg',
        artist: '소녀시대',
        visibility: 'public'
      },
      {
        id: 'retro-mem-002',
        parent_id: 'retro-mem-001',
        title: 'Ring Ding Dong - SHINee',
        memo: '수능금지곡이라 불렸던 이 노래. 밤새 공부하다가도 어깨가 들썩거려서 문제집에 집중을 못 했던 기억이 난다.',
        timestamp: '2009.10.14',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#중독', '#수능', '#밤샘'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'SHINee',
        visibility: 'public'
      },
      {
        id: 'retro-mem-003',
        parent_id: 'retro-mem-002',
        title: 'Sorry Sorry - 슈퍼주니어',
        memo: 'Everyday I\'m sufferin\' 아니 sorry sorry. 학교 축제에서 반 전체가 춰댔던 그 추억. 지금도 틀면 당시 장면이 떠오른다.',
        timestamp: '2009.03.09',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#학축', '#단체', '#춤'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: '슈퍼주니어',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-hiphop-day',
    title: '힙합으로 채운 하루',
    description: '출근길부터 퇴근길까지, 힙합 비트와 함께',
    emotion_tags: ['#힙합', '#비트', '#파워'],
    stage: 'growth',
    memories: [
      {
        id: 'hip-mem-001',
        parent_id: null,
        title: 'Ddaeng - BTS (RM, SUGA, J-Hope)',
        memo: '사운드클라우드에서 처음 들었을 때의 충격. 공식 발매는 아니지만 팬들 사이에서 레전드가 된 곡. 랩라인의 화력이 장난 아니다.',
        timestamp: '2018.06.11',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#랩', '#파이어', '#레전드'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'hip-mem-002',
        parent_id: 'hip-mem-001',
        title: 'MIC Drop - 스티브 아오키 Remix',
        memo: 'Did you see my bag? 가사가 너무 파워풀하다. 해외 무대에서 선보인 퍼포먼스를 보면서 자부심을 느꼈다.',
        timestamp: '2017.11.24',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#자부심', '#무대', '#파워'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'hip-mem-003',
        parent_id: 'hip-mem-002',
        title: 'UGH! - 화를 내라',
        memo: '분노가 필요한 날, 이 노래를 찾게 된다. 랩라인이 쏟아내는 에너지가 나의 분노도 대신 소모해주는 기분.',
        timestamp: '2020.02.21',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#분노', '#에너지', '#속시원'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-concert-memories',
    title: '콘서트의 기억',
    description: '라이브로 느낀 감동, 함께한 순간들',
    emotion_tags: ['#콘서트', '#라이브', '#공동체'],
    stage: 'deep',
    memories: [
      {
        id: 'con-mem-001',
        parent_id: null,
        title: '첫 콘서트, 떨리는 순간',
        memo: '티켓팅 성공했을 때의 환호. 드디어 직접 본다는 실감이 안 났다. 콘서트 당일, 입장할 때의 두근거림이 아직도 생생하다.',
        timestamp: '2019.06.15',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#첫콘', '#티켓', '#설렘'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'con-mem-002',
        parent_id: 'con-mem-001',
        title: '아미봉 파도의 순간',
        memo: '암흑 속에서 시작된 아미봉 파도. 수만 개의 빛이 물결처럼 일렁이는데, 은하수를 보는 것 같았다. 다들 같은 마음으로 흔들고 있었다.',
        timestamp: '2019.06.16',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#파도', '#빛', '#함께'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      },
      {
        id: 'con-mem-003',
        parent_id: 'con-mem-002',
        title: '마지막 곡, 눈물의 순간',
        memo: '앵콜 없이 끝나버린 콘서트. 멤버들이 울면서 인사하는데, 나도 모르게 눈물이 흘렀다. 다시 만날 약속을 하며 헤어졌다.',
        timestamp: '2019.06.16',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#눈물', '#작별', '#약속'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'BTS',
        visibility: 'public'
      }
    ]
  },
  {
    id: 'public-night-sky',
    title: '밤하늘을 바라보며',
    description: '사색과 힐링이 필요한 밤, 나만의 플레이리스트',
    emotion_tags: ['#밤하늘', '#사색', '#힐링'],
    stage: 'growth',
    memories: [
      {
        id: 'sky-mem-001',
        parent_id: null,
        title: '밤편지 - IU',
        memo: '베란다에 나가서 밤하늘 별을 보며 듣는 노래. "이 밤 그날의 반딧불" 가사가 내 마음의 불을 켜준다.',
        timestamp: '2017.03.24',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#별', '#밤', '#불'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      },
      {
        id: 'sky-mem-002',
        parent_id: 'sky-mem-001',
        title: 'Eight (prod. SUGA) - IU',
        memo: '28살의 나에게 선물하는 노래. 아침 창문으로 들어오는 햇살처럼 따뜻하게 안아준다. 아직은 괜찮지 않지만, 괜찮아질 거야.',
        timestamp: '2020.05.06',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#28', '#성장', '#희망'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      },
      {
        id: 'sky-mem-003',
        parent_id: 'sky-mem-002',
        title: 'Celebrity - IU',
        memo: 'You are my celebrity. 거울 앞에서 자신에게 말해주고 싶은 한마디. 너는 이미 특별하고, 빛나고 있어.',
        timestamp: '2021.01.27',
        source_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        source_type: 'youtube',
        emotion_tags: ['#자기사랑', '#빛', '#특별'],
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        artist: 'IU',
        visibility: 'public'
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 메인 로직
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌳 LoveBud Public Trees Seeder\n');
  console.log(`   Stage: ${SEED_STAGE}`);
  console.log(`   Demo Owner: ${DEMO_OWNER_ID}`);
  console.log(`   Dry Run: ${DRY_RUN ? 'YES (실제 삽입 없음)' : 'NO'}\n`);

  // 대상 트리 결정
  let targetTrees = [];
  if (SEED_STAGE === 'phase1') {
    targetTrees = PHASE1_TREES;
  } else if (SEED_STAGE === 'phase2') {
    targetTrees = PHASE2_TREES;
  } else if (SEED_STAGE === 'all') {
    targetTrees = [...PHASE1_TREES, ...PHASE2_TREES];
  } else {
    console.error(`❌ 잘못된 SEED_STAGE: ${SEED_STAGE}`);
    console.error('   사용 가능: phase1, phase2, all');
    process.exit(1);
  }

  console.log(`📦 시드할 트리: ${targetTrees.length}개\n`);

  // 미리보기
  console.log('📋 미리보기:');
  targetTrees.forEach((tree, idx) => {
    console.log(`   ${idx + 1}. ${tree.title} (${tree.memories.length}개 노드)`);
    console.log(`      감정: ${tree.emotion_tags.join(', ')}`);
  });
  console.log();

  if (DRY_RUN) {
    console.log('🔍 DRY RUN 완료 (실제 삽입은 수행되지 않음)');
    console.log('   실제 실행하려면 DRY_RUN 환경변수를 제거하세요\n');
    return;
  }

  // DB 연결
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  let insertedTrees = 0;
  let insertedMemories = 0;

  try {
    await client.query('BEGIN');

    for (const tree of targetTrees) {
      console.log(`\n📝 삽입 중: ${tree.title}`);

      // 1. Tree 삽입 (UPSERT) - 실제 DB 스키마: id, name, is_public, owner_id, node_count, payload
      const treeResult = await client.query(`
        INSERT INTO trees (id, name, is_public, owner_id, node_count, created_at, updated_at, payload)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          is_public = EXCLUDED.is_public,
          node_count = EXCLUDED.node_count,
          payload = EXCLUDED.payload,
          updated_at = NOW()
        RETURNING id
      `, [
        tree.id,
        tree.title,
        true, // is_public
        DEMO_OWNER_ID,
        tree.memories.length,
        JSON.stringify({
          description: tree.description,
          stage: tree.stage,
          emotion_tags: tree.emotion_tags
        })
      ]);

      insertedTrees++;
      console.log(`   ✓ Tree: ${treeResult.rows[0].id}`);

      // 2. Payload에 nodes 업데이트 (133-relovetree 스키마: memories 테이블 없음)
      const nodesPayload = {
        nodes: tree.memories.map((mem, idx) => ({
          id: mem.id,
          title: mem.title,
          description: mem.memo,
          timestamp: mem.timestamp,
          videoId: mem.source_url?.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/)?.[1] || '',
          thumbnail: mem.thumbnail,
          artist: mem.artist,
          emotion_tags: mem.emotion_tags,
          parent_id: mem.parent_id,
          order: idx
        }))
      };

      await client.query(`
        UPDATE trees
        SET payload = payload || $1::jsonb,
            node_count = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(nodesPayload), tree.memories.length, tree.id]);

      insertedMemories += tree.memories.length;
      console.log(`   ✓ Nodes: ${tree.memories.length}개 payload 업데이트`);
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(50));
    console.log('✅ 시드 완료!');
    console.log('='.repeat(50));
    console.log(`   Trees: ${insertedTrees}개`);
    console.log(`   Memories: ${insertedMemories}개`);
    console.log(`   Demo Owner: ${DEMO_OWNER_ID}`);
    console.log(`   Stage: ${SEED_STAGE}`);
    console.log('='.repeat(50));

    // 검증 쿼리
    console.log('\n📊 검증:');
    const publicCount = await client.query(`
      SELECT COUNT(*) as count FROM trees WHERE is_public = true
    `);
    const demoCount = await client.query(`
      SELECT COUNT(*) as count FROM trees WHERE owner_id = $1
    `, [DEMO_OWNER_ID]);
    console.log(`   전체 Public Trees: ${publicCount.rows[0].count}개`);
    console.log(`   Demo Owner 트리: ${demoCount.rows[0].count}개`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ 시드 실패:', err.message);
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
