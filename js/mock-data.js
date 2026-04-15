// LoveBud 공통 Mock 데이터
// API 교체 시: 이 파일의 데이터 배열을 fetch 응답으로 대체하면 됨
// 함수 시그니처(getMemory, getMemoriesByTree, getTrees)는 그대로 유지

var memories = [
  {
    id: 'root',
    treeId: 'tree-sweet-magnolia',
    title: 'Sweet Magnolia',
    memo: '당신의 Lovetree가 처음 피어났습니다. 이 마음의 나무는 당신의 감정과 기억을 담아 성장합니다.',
    timestamp: '2024.01.15',
    sourceUrl: '',
    sourceType: 'system',
    emotionTags: ['시작', '희망'],
    parentId: null,
    thumbnail: '',
    createdAt: '2024-01-15',
    x: 400,
    y: 300,
    delay: '0s'
  },
  {
    id: 'v1',
    treeId: 'tree-sweet-magnolia',
    title: 'Live Stage — Whispering Petals',
    memo: '마지막 앙코르 곡이 울려 퍼질 때, 그 순간의 공기와 팬들의 함성 소리가 아직도 생생해. 무대 위 레이저lights가 내 머리 위를 스쳐 지나갔고, 나는 그녀의 목소리에 완전히 녹아버렸다. 세상에 우리만 있는 것 같은 그런 기분. 그녀가 마지막 인사를 할 때 눈물이 핑 도는 걸 참을 수 없었다.',
    quote: '그 순간의 공기와 팬들의 함성 소리가 아직도 생생해.',
    timestamp: '2024.03.24',
    sourceUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sourceType: 'youtube',
    emotionTags: ['강렬한', '환희', '무대'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtTuAoKJeSHwkrsYAPRVf1hmE2ZOakz9QiG-sju-B6kAPXGROuK8oRYHr-x0HettulikZeo7sXfaC6h2R9eK3VtsWxQT96eJIrPyOvLyREEBA2L3Zyu0JHd5D4vtfoGFEqKsz5OSgh3Z8sNgFE0lJiLcO2F8-f5fvUKFP3493fAmcAj-tTmhUV6Mr3XIeT5X1U1vvJiqDrU7OmZYLarm7dTiNVw3DsNXV8bmbZekV9jDGjb6ovsa8XEBO5EDAuKWQ2MDz3zKkN5RQ',
    createdAt: '2024-03-24',
    artist: 'LUMINA',
    source: 'M-Countdown',
    x: 650,
    y: 150,
    delay: '1s'
  },
  {
    id: 'v2',
    treeId: 'tree-sweet-magnolia',
    title: 'M/V — Eternal Spring',
    memo: '봄이 오는 것처럼, 그 시절의 순수한 마음이 다시 피어나는 것 같아. 파스텔 색감과 리듬 속에서 나의 청춘을 본다. 비디오 속 그녀의 미소는 아침 햇살처럼 따뜻했고, 반복 재생해도 질리지 않는다. 이 노래를 들을 때마다 첫눈에 반했던 그 감정이 떠오른다.',
    quote: '봄이 오는 것처럼, 순수한 마음이 다시 피어나는 것 같아.',
    timestamp: '2024.04.02',
    sourceUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    sourceType: 'youtube',
    emotionTags: ['따뜻함', '회상', '청춘'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzWVpWYsddLvWm5QtFvAlBO77i--ZKO3bZpEO5--Y39_YWGGeXcsI0QwgH7Pf3Htge5qDKQWZ-mRLfhCpWIRqiU8E7KWY_Mz7-boHu-Nvjsxazgkkbvb2nKeMa4zIOixk1eyQ4FzRt4ZSo3fFMOJA5Mtl6HFQhODb0EBI6_30-qIFHqNMpisOXK0aNjFgYnmeo3BzugRpfJCWBexlhBiyXuaF7zxSSNxA99IKXRhA_P7nQreJL6SyGmDDjXDJgS2naem1gGLVZHR0',
    createdAt: '2024-04-02',
    artist: 'LUMINA',
    source: 'Star Ent.',
    x: 150,
    y: 400,
    delay: '0.5s'
  },
  {
    id: 'v3',
    treeId: 'tree-sweet-magnolia',
    title: 'Encore Cam — Nightfall Serenade',
    memo: '어두운 무대 위에서 빛나는 한 줄기 조명. 그 속에서 노래하는 목소리가 떨림과 감동으로 전해진다. 마이크를 잡은 손의 떨림이 보일 정도로 진솔한 무대, 나도 모르게 눈물이 맺혔다. 그녀의 목소리가 점점 사라질 때, 마음 속에 깊은 여운이 남는다.',
    quote: '한 줄기 조명 속에서 전해진 떨림과 감동.',
    timestamp: '2024.04.15',
    sourceUrl: 'https://www.youtube.com/embed/jNQXAC9IVRw',
    sourceType: 'youtube',
    emotionTags: ['떨림', '감동', '진솔함'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWJPadJz5CKVIofhWn1kYL2ioMnDA1LToVY1eah0vxpprqoJDiy2ymM-llQPIFlDCf3pSHs-vYyC_4vV1k1xkn8mXYnX24NPedwENxaSpL5Qeo5b6pJRSmyCUy1LEFWvfngHD5tfRp8eCvebRH8sIZT_eIC9RN_JN9dTlRgSr1Qpt2-94jvLJZS6efxuwqivBqsoIcy_CCsIFdFshwz0i2LRJWuS01RUjWDLn09EwOwYM1I_qRLovxlHN9_48w0IFF3kD2pt_9MF0',
    createdAt: '2024-04-15',
    artist: 'SOLOIST',
    source: 'SBS Inkigayo',
    x: 700,
    y: 550,
    delay: '2s'
  },
  {
    id: 'm2',
    treeId: 'tree-sweet-magnolia',
    title: 'First Input — Short Form',
    memo: '처음 본 그 순간, 호기심이 시작됐다. 짧은 클립 하나가 나의 하루를 바꿨다. 화면 속 그녀의 눈빛이 나를 잡아끌었고, 그 후로 나는 그녀의 모든 영상을 찾아보게 됐다. 그녀의 작은 미소 하나에 내 하루가 빛났다.',
    quote: '짧은 클립 하나가 나의 하루를 바꿨다.',
    timestamp: '2024.02.12',
    sourceUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    sourceType: 'youtube',
    emotionTags: ['호기심', '설렘', '시작'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBAZCNgT8x1SqpOUkJ96DWvXw_P65NfLHGuKe6_QdYtFjZJo-3MCKSnhn3b73TOOVjMJ_7xOBRmntRLv0e3YxwgnCHzJ9t9L3K8y30vcDLQDz8hxvk4vMrJ3laFT8hEUcI8GO2JJnfxWpvUd1PtbVIfjXoODP5iwSA_wFpeK7VOMwlRr1kIdl-nTUMsHwVjPkdkfAXWU71tj-UtBLZI0bnoedhDMq4SYG95Ba0aTvbxGGBJN_r6KRDNQUGXpCrPKtlznC55JUQbB8',
    createdAt: '2024-02-12',
    artist: 'LUMINA',
    source: 'Star Ent.',
    x: 150,
    y: 550,
    delay: '2.5s'
  },
  {
    id: 'm3',
    treeId: 'tree-sweet-magnolia',
    title: 'On-site — Heartbeat Moment',
    memo: '퇴근길에 우연히 마주친 실물. 그 순간의 떨림은 아직도 손끝에 남아있다. 살짝 고개를 숙 인사하는 그녀의 모습에 심장이 멎을 뻔했다. 그 짧은 순간이 내게는 가장 소중한 기억이 됐다. 아직도 그날의 공기가 느껴진다.',
    quote: '그 순간의 떨림은 아직도 손끝에 남아있다.',
    timestamp: '2024.06.05',
    sourceUrl: 'https://www.youtube.com/embed/jNQXAC9IVRw',
    sourceType: 'youtube',
    emotionTags: ['떨림', '우연', '소중'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrWsB6Evx4iHGNNg4ZRTIYZytQJoo7k_ifxzzU28H6M7Nob_nZ58BkkMyBcP1UzHLLcO0iUWaGRjzd2h_YBVNWKfAJ6oqlr-2gq-cLtE_SJ0YCAa2atrnsCOWR6iY_HfM3W6-JzLBlxHPW_d3WRldC5ZybuguIkCbTkAa1f761Az61ByQpII4m0KNUSXin8BJZLJJ_UWXyEsF4T8-HY89o7FQAJeddQ7U4UfIYOsIMGh7rVoiZbXBa9SODOGrb77KnqjevmMT8VMQ',
    createdAt: '2024-06-05',
    artist: 'SOLOIST',
    source: 'SBS Inkigayo',
    x: 900,
    y: 200,
    delay: '1.5s'
  },
  {
    id: 'm4',
    treeId: 'tree-sweet-magnolia',
    title: 'Unboxing — First Memory',
    memo: '기다리던 그 상자가 드디어 도착했다. 내 방에 피어나는 작은 꽃 한 송이. 포장을 뜯을 때의 두근거림, 안에서 보이는 포스트카드, 향수 냄새까지. 모두 완벽했다. 상자를 열고 나서 몇 분 동안 그냥 바라만 보고 있었다. 작은 행복이 내 방을 가득 채웠다.',
    quote: '내 방에 피어나는 작은 꽃 한 송이.',
    timestamp: '2024.07.01',
    sourceUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    sourceType: 'youtube',
    emotionTags: ['소유', '기쁨', '기다림'],
    parentId: 'root',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvRZCwwiIkdklz1NO2MXzO4-uK6kxx_PB3z92JqbOFy5Ar-nknhmjinNrJ50YV_IpoVcN8ElcO9XaPnlOhrKlWRAIAT6IyU-i_QqTRKw-ZPWRQ30PYEyBhD_J_FnhsXL9T9_gngDVKltWsGSyDVSz-sOIxriMYhinCysQp9JwfCz4ZKywPTrU4FZ94lHWaH2Prr2RS1jSah1_4Ovmu9mPQ6vn23cxzt_Va6rcTvqi4nr9Epi7VCw78efNXh8ptqAXwElj2VzKmPnQ',
    createdAt: '2024-07-01',
    artist: 'LUMINA',
    source: 'Star Ent.',
    x: 900,
    y: 400,
    delay: '3s'
  }
];

function getMemoriesByTree(treeId) {
  return memories.filter(function(m) { return m.treeId === treeId; });
}

function getMemory(id) {
  return memories.find(function(m) { return m.id === id; }) || null;
}

function getTrees() {
  return trees;
}
