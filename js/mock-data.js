/**
 * LoveBud - High Quality Demo Mock Data
 * v20260421-3
 *
 * 주요 4세대/5세대 아이돌 그룹의 공식 콘텐츠를 기반으로 구성한 고품질 데모 데이터입니다.
 * 모든 영상은 공식 YouTube 채널의 실제 공개 MV(embed)입니다.
 */

(function() {
  'use strict';

  // ── Trees (공개 러브트리 목록) ─────────────────────────────────────────
  var trees = [
    {
      id: 'demo-bts-public',
      ownerId: 'demo-user-bts',
      title: 'BTS: 아미와 함께한 보랏빛 기록',
      visibility: 'public',
      createdAt: '2024-01-15',
      updatedAt: '2024-07-20',
      isDemo: true,
      category: 'K-POP'
    },
    {
      id: 'demo-newjeans-public',
      ownerId: 'demo-user-nwj',
      title: 'NewJeans: 우리가 사랑하는 새로운 계절',
      visibility: 'public',
      createdAt: '2024-03-10',
      updatedAt: '2024-08-05',
      isDemo: true,
      category: 'K-POP'
    },
    {
      id: 'demo-triples-public',
      ownerId: 'demo-user-sss',
      title: 'tripleS: 모든 가능성의 기록 (S1-S24)',
      visibility: 'public',
      createdAt: '2024-05-12',
      updatedAt: '2024-09-01',
      isDemo: true,
      category: 'K-POP'
    },
    {
      id: 'demo-ive-public',
      ownerId: 'demo-user-ive',
      title: 'IVE: 완성형 아이돌의 빛나는 서사',
      visibility: 'public',
      createdAt: '2024-02-20',
      updatedAt: '2024-08-15',
      isDemo: true,
      category: 'K-POP'
    },
    {
      id: 'demo-lesserafim-public',
      ownerId: 'demo-user-lsf',
      title: 'LE SSERAFIM: 두려움 없는 당당한 전진',
      visibility: 'public',
      createdAt: '2024-04-05',
      updatedAt: '2024-08-22',
      isDemo: true,
      category: 'K-POP'
    }
  ];

  // ── Memories (각 트리별 상세 순간들) ───────────────────────────────────
  var memories = [
    // === BTS (demo-bts-public) ===
    {
      id: 'bts-root',
      treeId: 'demo-bts-public',
      title: '7인 7색, 방탄소년단의 여정',
      memo: '데뷔부터 글로벌 아이콘이 되기까지, 우리가 함께 걸어온 길을 기록합니다.',
      timestamp: '2013.06.13',
      sourceType: 'system',
      emotionTags: ['방탄', '아미', '시작'],
      parentId: null,
      x: 400, y: 300
    },
    {
      id: 'bts-001',
      treeId: 'demo-bts-public',
      title: '봄날 (Spring Day) MV',
      memo: '가장 따뜻한 위로를 전하는 노래. 눈 덮인 풍경과 기차역의 정서가 너무 좋아요.',
      sourceUrl: 'https://www.youtube.com/embed/xEeFrLSkMm8',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg',
      emotionTags: ['그리움', '희망'],
      parentId: 'bts-root',
      artist: 'BTS',
      x: 200, y: 150
    },
    {
      id: 'bts-002',
      treeId: 'demo-bts-public',
      title: 'IDOL MV',
      memo: '한국의 미와 축제 분위기가 가득한 강렬한 비주얼!',
      sourceUrl: 'https://www.youtube.com/embed/pBuZEGYXA6E',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/pBuZEGYXA6E/mqdefault.jpg',
      emotionTags: ['에너지', '축제'],
      parentId: 'bts-001',
      artist: 'BTS',
      x: 350, y: 50
    },
    {
      id: 'bts-003',
      treeId: 'demo-bts-public',
      title: 'Boy With Luv (Feat. Halsey) MV',
      memo: '사랑의 기쁨을 핑크빛 무드로 담아낸 달콤한 순간.',
      sourceUrl: 'https://www.youtube.com/embed/XsX3ATc3FbA',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/XsX3ATc3FbA/mqdefault.jpg',
      emotionTags: ['핑크', '달콤'],
      parentId: 'bts-002',
      artist: 'BTS',
      x: 600, y: 100
    },
    {
      id: 'bts-004',
      treeId: 'demo-bts-public',
      title: 'Dynamite MV',
      memo: '밝고 경쾌한 디스코 팝! 전 세계에 희망을 준 멜로디.',
      sourceUrl: 'https://www.youtube.com/embed/gdZLi9oWNZg',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg',
      emotionTags: ['경쾌', '희망'],
      parentId: 'bts-003',
      artist: 'BTS',
      x: 750, y: 250
    },
    {
      id: 'bts-005',
      treeId: 'demo-bts-public',
      title: 'Butter MV',
      memo: '스무스하게 스며드는 매력! 댄스 팝의 정석입니다.',
      sourceUrl: 'https://www.youtube.com/embed/UMHX0l11nlY',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/UMHX0l11nlY/mqdefault.jpg',
      emotionTags: ['매력', '버터'],
      parentId: 'bts-004',
      artist: 'BTS',
      x: 650, y: 450
    },
    {
      id: 'bts-006',
      treeId: 'demo-bts-public',
      title: 'Permission to Dance MV',
      memo: '춤추는 데 허락은 필요 없어! 모두가 하나 되는 따뜻한 댄스.',
      sourceUrl: 'https://www.youtube.com/embed/CuklIb9dEfA',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/CuklIb9dEfA/mqdefault.jpg',
      emotionTags: ['자유', '평화'],
      parentId: 'bts-005',
      artist: 'BTS',
      x: 400, y: 550
    },

    // === NewJeans (demo-newjeans-public) ===
    {
      id: 'nwj-root',
      treeId: 'demo-newjeans-public',
      title: '우리의 하이틴 소망, NewJeans',
      memo: '민지, 하니, 다니엘, 해린, 혜인 다섯 소녀의 반짝이는 순간들을 모았습니다.',
      timestamp: '2022.07.22',
      sourceType: 'system',
      emotionTags: ['뉴진스', '팬덤', '상큼'],
      parentId: null,
      x: 400, y: 300
    },
    {
      id: 'nwj-001',
      treeId: 'demo-newjeans-public',
      title: 'Attention MV',
      memo: '혜성처럼 등장한 첫 순간. 스페인의 여름 햇살 같은 청량함.',
      sourceUrl: 'https://www.youtube.com/embed/js1CtxK3sTM',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/js1CtxK3sTM/mqdefault.jpg',
      emotionTags: ['청량', '여름', '데뷔'],
      parentId: 'nwj-root',
      artist: 'NewJeans',
      x: 200, y: 150
    },
    {
      id: 'nwj-002',
      treeId: 'demo-newjeans-public',
      title: 'Hype Boy MV',
      memo: '누가 뭐래도 하이프 보이! 중독성 강한 멜로디와 안무.',
      sourceUrl: 'https://www.youtube.com/embed/110G9V9Y71E',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/110G9V9Y71E/mqdefault.jpg',
      emotionTags: ['중독성', '하이틴'],
      parentId: 'nwj-001',
      artist: 'NewJeans',
      x: 350, y: 50
    },
    {
      id: 'nwj-003',
      treeId: 'demo-newjeans-public',
      title: 'Ditto (Performance ver.)',
      memo: '몽글몽글한 겨울 감성. 신선하면서도 아련한 울림.',
      sourceUrl: 'https://www.youtube.com/embed/pSUydWEqKwE',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/pSUydWEqKwE/mqdefault.jpg',
      emotionTags: ['겨울', '아련', '감성'],
      parentId: 'nwj-002',
      artist: 'NewJeans',
      x: 600, y: 100
    },
    {
      id: 'nwj-004',
      treeId: 'demo-newjeans-public',
      title: 'OMG MV',
      memo: '독특한 세계관과 귀여운 안무가 돋보이는 곡.',
      sourceUrl: 'https://www.youtube.com/embed/sVTy_w6m60E',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/sVTy_w6m60E/mqdefault.jpg',
      emotionTags: ['귀여움', '유니크'],
      parentId: 'nwj-003',
      artist: 'NewJeans',
      x: 750, y: 250
    },
    {
      id: 'nwj-005',
      treeId: 'demo-newjeans-public',
      title: 'Super Shy MV',
      memo: '여름의 상징이 된 퍼포먼스! 다 같이 춤추고 싶은 기분.',
      sourceUrl: 'https://www.youtube.com/embed/arm6S1S58IE',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/arm6S1S58IE/mqdefault.jpg',
      emotionTags: ['파워풀', '경쾌'],
      parentId: 'nwj-004',
      artist: 'NewJeans',
      x: 650, y: 450
    },
    {
      id: 'nwj-006',
      treeId: 'demo-newjeans-public',
      title: 'How Sweet MV',
      memo: '뉴진스만의 힙한 감성이 묻어나는 최근의 소중한 순간.',
      sourceUrl: 'https://www.youtube.com/embed/Q4m2pAnxM54',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/Q4m2pAnxM54/mqdefault.jpg',
      emotionTags: ['힙', '스윗'],
      parentId: 'nwj-005',
      artist: 'NewJeans',
      x: 400, y: 550
    },

    // === tripleS (demo-triples-public) ===
    {
      id: 'sss-root',
      treeId: 'demo-triples-public',
      title: '코스모스의 소녀들, tripleS',
      memo: 'S1부터 S24까지, 우리가 하나로 완성되는 모든 과정을 담습니다.',
      timestamp: '2022.10.28',
      sourceType: 'system',
      emotionTags: ['트리플에스', '웨이브', '성장'],
      parentId: null,
      x: 400, y: 300
    },
    {
      id: 'sss-001',
      treeId: 'demo-triples-public',
      title: 'Generation (Acid Angel from Asia) MV',
      memo: '첫 번째 유닛의 강렬한 시작. 도심 속 소녀들의 자유로운 춤.',
      sourceUrl: 'https://www.youtube.com/embed/1F18J42y30M',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/1F18J42y30M/mqdefault.jpg',
      emotionTags: ['도심', '에너지', '시작'],
      parentId: 'sss-root',
      artist: 'tripleS',
      x: 200, y: 150
    },
    {
      id: 'sss-002',
      treeId: 'demo-triples-public',
      title: 'Rising MV',
      memo: '10명의 S가 모여 만든 폭발적인 퍼포먼스.',
      sourceUrl: 'https://www.youtube.com/embed/K0I7n43wYfE',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/K0I7n43wYfE/mqdefault.jpg',
      emotionTags: ['라이징', '열정'],
      parentId: 'sss-001',
      artist: 'tripleS',
      x: 350, y: 50
    },
    {
      id: 'sss-003',
      treeId: 'demo-triples-public',
      title: 'Cherry Talk MV',
      memo: '상큼하고 톡톡 튀는 소녀들의 대화.',
      sourceUrl: 'https://www.youtube.com/embed/fP7M5rBwZ_Y',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/fP7M5rBwZ_Y/mqdefault.jpg',
      emotionTags: ['체리', '톡'],
      parentId: 'sss-002',
      artist: 'tripleS',
      x: 600, y: 100
    },
    {
      id: 'sss-004',
      treeId: 'demo-triples-public',
      title: 'Girls\' Capitalism MV',
      memo: '자신감 넘치는 소녀들의 당당한 메시지.',
      sourceUrl: 'https://www.youtube.com/embed/z6m6OIdO0Y0',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/z6m6OIdO0Y0/mqdefault.jpg',
      emotionTags: ['당당함', '자본주의'],
      parentId: 'sss-003',
      artist: 'tripleS',
      x: 750, y: 250
    },
    {
      id: 'sss-005',
      treeId: 'demo-triples-public',
      title: 'Girls Never Die MV',
      memo: '24명이 하나로 뭉친 전율의 순간. 무너지지 않는 소녀들의 의지.',
      sourceUrl: 'https://www.youtube.com/embed/yYJ69Y26Pmo',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/yYJ69Y26Pmo/mqdefault.jpg',
      emotionTags: ['감동', '완성'],
      parentId: 'sss-004',
      artist: 'tripleS',
      x: 650, y: 450
    },
    {
      id: 'sss-006',
      treeId: 'demo-triples-public',
      title: 'Door (Visionary Vision) MV',
      memo: '또 다른 새로운 문을 여는 소녀들의 전진.',
      sourceUrl: 'https://www.youtube.com/embed/O_7_47O8XU4',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/O_7_47O8XU4/mqdefault.jpg',
      emotionTags: ['새로운문', '전진'],
      parentId: 'sss-005',
      artist: 'tripleS',
      x: 400, y: 550
    },

    // === IVE (demo-ive-public) ===
    {
      id: 'ive-root',
      treeId: 'demo-ive-public',
      title: '당당한 나르시시즘, IVE',
      memo: '아이브가 보여주는 완성형 아이돌의 정석, 그 화려한 장면들.',
      timestamp: '2021.12.01',
      sourceType: 'system',
      emotionTags: ['아이브', '다이브', '화려함'],
      parentId: null,
      x: 400, y: 300
    },
    {
      id: 'ive-001',
      treeId: 'demo-ive-public',
      title: 'ELEVEN MV',
      memo: '완성형 아이돌의 화려한 데뷔. 그 시작의 설렘.',
      sourceUrl: 'https://www.youtube.com/embed/n6Bw6a_SzeM',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/n6Bw6a_SzeM/mqdefault.jpg',
      emotionTags: ['강렬', '데뷔'],
      parentId: 'ive-root',
      artist: 'IVE',
      x: 200, y: 150
    },
    {
      id: 'ive-002',
      treeId: 'demo-ive-public',
      title: 'LOVE DIVE MV',
      memo: '숨 참코 러브 다이브! 아이브의 전성기를 연 역사적 곡.',
      sourceUrl: 'https://www.youtube.com/embed/Y8JFxS1HlDo',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/Y8JFxS1HlDo/mqdefault.jpg',
      emotionTags: ['우아함', '명곡'],
      parentId: 'ive-001',
      artist: 'IVE',
      x: 350, y: 50
    },
    {
      id: 'ive-003',
      treeId: 'demo-ive-public',
      title: 'After LIKE MV',
      memo: '자신감 넘치는 사랑의 고백! 불꽃놀이 같은 시원한 사운드.',
      sourceUrl: 'https://www.youtube.com/embed/F0B7HDiY-10',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/F0B7HDiY-10/mqdefault.jpg',
      emotionTags: ['자신감', '불꽃놀이'],
      parentId: 'ive-002',
      artist: 'IVE',
      x: 600, y: 100
    },
    {
      id: 'ive-004',
      treeId: 'demo-ive-public',
      title: 'I AM MV',
      memo: '하늘 끝까지 닿는 고음과 당당함. 내 삶의 주인공은 나!',
      sourceUrl: 'https://www.youtube.com/embed/6ZUIwj3FgUY',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/6ZUIwj3FgUY/mqdefault.jpg',
      emotionTags: ['고음', '성장'],
      parentId: 'ive-003',
      artist: 'IVE',
      x: 750, y: 250
    },
    {
      id: 'ive-005',
      treeId: 'demo-ive-public',
      title: 'Baddie MV',
      memo: '색다른 힙한 매력! 다시 한번 아이브의 변신.',
      sourceUrl: 'https://www.youtube.com/embed/Da4P2uT4mVc',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/Da4P2uT4mVc/mqdefault.jpg',
      emotionTags: ['힙', '배디'],
      parentId: 'ive-004',
      artist: 'IVE',
      x: 650, y: 450
    },
    {
      id: 'ive-006',
      treeId: 'demo-ive-public',
      title: 'HEYA MV',
      memo: '한국의 전래동화를 재해석한 독보적인 비주얼과 퍼포먼스.',
      sourceUrl: 'https://www.youtube.com/embed/V6S2ZJat27U',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/V6S2ZJat27U/mqdefault.jpg',
      emotionTags: ['전통', '비주얼'],
      parentId: 'ive-005',
      artist: 'IVE',
      x: 400, y: 550
    },

    // === LE SSERAFIM (demo-lesserafim-public) ===
    {
      id: 'lsf-root',
      treeId: 'demo-lesserafim-public',
      title: '두려움 없는 전진, LE SSERAFIM',
      memo: '어떤 시련 앞에서도 당당하게 전진하는 피어나의 기록들.',
      timestamp: '2022.05.02',
      sourceType: 'system',
      emotionTags: ['르세라핌', '피어나', '강인함'],
      parentId: null,
      x: 400, y: 300
    },
    {
      id: 'lsf-001',
      treeId: 'demo-lesserafim-public',
      title: 'FEARLESS MV',
      memo: '당당하고 두려움 없는 첫 발걸음. 세상을 향한 강렬한 메시지.',
      sourceUrl: 'https://www.youtube.com/embed/4vbDFu0PUew',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/4vbDFu0PUew/mqdefault.jpg',
      emotionTags: ['강렬', '데뷔'],
      parentId: 'lsf-root',
      artist: 'LE SSERAFIM',
      x: 200, y: 150
    },
    {
      id: 'lsf-002',
      treeId: 'demo-lesserafim-public',
      title: 'ANTIFRAGILE MV',
      memo: '시련은 우리를 더 강하게 만들 뿐! 파워풀한 퍼포먼스.',
      sourceUrl: 'https://www.youtube.com/embed/pyf8cbqyfPs',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/pyf8cbqyfPs/mqdefault.jpg',
      emotionTags: ['파워풀', '강인함'],
      parentId: 'lsf-001',
      artist: 'LE SSERAFIM',
      x: 350, y: 50
    },
    {
      id: 'lsf-003',
      treeId: 'demo-lesserafim-public',
      title: 'UNFORGIVEN (feat. Nile Rodgers) MV',
      memo: '우리는 우리만의 길을 간다. 타협하지 않는 단단한 마음.',
      sourceUrl: 'https://www.youtube.com/embed/UBURTj20HXI',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/UBURTj20HXI/mqdefault.jpg',
      emotionTags: ['압도', '의지'],
      parentId: 'lsf-002',
      artist: 'LE SSERAFIM',
      x: 600, y: 100
    },
    {
      id: 'lsf-004',
      treeId: 'demo-lesserafim-public',
      title: 'Eve Psyche & The Bluebeard\'s wife MV',
      memo: '전 세계적 댄스 챌린지를 일으킨 극강의 퍼포먼스.',
      sourceUrl: 'https://www.youtube.com/embed/dZs_cLHfnNA',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/dZs_cLHfnNA/mqdefault.jpg',
      emotionTags: ['퍼포먼스', '챌린지'],
      parentId: 'lsf-003',
      artist: 'LE SSERAFIM',
      x: 750, y: 250
    },
    {
      id: 'lsf-005',
      treeId: 'demo-lesserafim-public',
      title: 'Perfect Night MV',
      memo: '함께라면 완벽한 밤! 편안하면서도 중독성 있는 이지리스닝.',
      sourceUrl: 'https://www.youtube.com/embed/hLvWy2b857I',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/hLvWy2b857I/mqdefault.jpg',
      emotionTags: ['드라이브', '팝'],
      parentId: 'lsf-004',
      artist: 'LE SSERAFIM',
      x: 650, y: 450
    },
    {
      id: 'lsf-006',
      treeId: 'demo-lesserafim-public',
      title: 'EASY MV',
      memo: '어렵지만 우리에겐 쉬워 보여! 독특한 바이브의 매력적인 선율.',
      sourceUrl: 'https://www.youtube.com/embed/bNKXxw7tUPQ',
      sourceType: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/bNKXxw7tUPQ/mqdefault.jpg',
      emotionTags: ['올드스쿨', '바이브'],
      parentId: 'lsf-005',
      artist: 'LE SSERAFIM',
      x: 400, y: 550
    }
  ];

  // ── Global Exports ────────────────────────────────────────────────
  window.trees = trees;
  window.memories = memories;

  window.getMemoriesByTree = function(treeId) {
    return memories.filter(function(m) { return m.treeId === treeId; });
  };

  window.getMemory = function(id) {
    return memories.find(function(m) { return m.id === id; }) || null;
  };

  window.getTrees = function() {
    return trees;
  };

  console.log('[mock-data] 고품질 데모 데이터 로드 완료 (BTS, NewJeans, tripleS, IVE, LE SSERAFIM 총 5개 그룹)');
})();
