(function() {
    'use strict';

    var palette = {
        rose: { stroke: '#e99aac', soft: '#fff1f3', text: '#be123c', dim: 'rgba(251,113,133,.16)' },
        amber: { stroke: '#eac86f', soft: '#fff7df', text: '#a16207', dim: 'rgba(251,191,36,.15)' },
        emerald: { stroke: '#8fd8bc', soft: '#ecfdf5', text: '#047857', dim: 'rgba(110,231,183,.16)' },
        violet: { stroke: '#c8b8f8', soft: '#f5f3ff', text: '#7c3aed', dim: 'rgba(167,139,250,.16)' }
    };

    var branches = [{
        id: 'first', name: '처음', side: 'left', color: 'rose',
        startY: 77, endY: 51, endX: 15, curveA: 34, curveB: 27,
        caption: '처음 마음이 생긴 순간들', count: 3,
        moments: [
            { id: 'm1', title: '첫 팬미팅', tag: '설렘', caption: '가까이에서 처음 마주한 날.', t: 0.28, color: 'from-rose-200 via-rose-100 to-amber-50', emoji: '✦' },
            { id: 'm2', title: '데뷔 무대', tag: '무대', caption: '조명이 켜지고 이름을 처음 불렀던 밤.', t: 0.56, color: 'from-amber-100 via-rose-100 to-white', emoji: '♪' },
            { id: 'm3', title: '첫 편지', tag: '편지', caption: '종이에 눌러 담은 첫 응원.', t: 0.84, color: 'from-pink-100 via-orange-50 to-white', emoji: '✎' }
        ]
    }, {
        id: 'record', name: '첫 기록', side: 'right', color: 'amber',
        startY: 67, endY: 36, endX: 84, curveA: 63, curveB: 73,
        caption: '처음으로 숫자가 마음이 된 날들', count: 16,
        moments: [
            { id: 'm4', title: '첫 1위', tag: '기록', caption: '믿기지 않아서 여러 번 다시 봤던 순간.', t: 0.22, color: 'from-amber-200 via-yellow-100 to-white', emoji: '1' },
            { id: 'm5', title: '첫 앵콜', tag: '라이브', caption: '떨림까지 오래 남은 첫 앵콜.', t: 0.47, color: 'from-orange-100 via-amber-50 to-white', emoji: '♫' },
            { id: 'm6', title: '차트 진입', tag: '차트', caption: '작은 숫자가 큰 기억이 된 날.', t: 0.68, color: 'from-yellow-100 via-orange-50 to-white', emoji: '#' },
            { id: 'cluster-record', title: '+12', tag: '묶음', caption: '첫 기록 가지에 모인 열두 개의 작은 순간.', t: 0.92, cluster: 12, color: 'from-amber-200 via-yellow-100 to-white' }
        ]
    }, {
        id: 'together', name: '함께', side: 'left', color: 'emerald',
        startY: 54, endY: 23, endX: 22, curveA: 35, curveB: 27,
        caption: '같은 장면을 같이 기억하는 가지', count: 26,
        moments: [
            { id: 'm7', title: '같이 울었던 밤', tag: '공연', caption: '말보다 표정이 먼저 닿았던 밤.', t: 0.22, color: 'from-emerald-100 via-lime-50 to-white', emoji: '•' },
            { id: 'm8', title: '첫 떼창', tag: '함께', caption: '목소리가 하나로 겹쳤던 순간.', t: 0.45, color: 'from-lime-100 via-emerald-50 to-white', emoji: '♪' },
            { id: 'm9', title: '응원 배너', tag: '응원', caption: '천천히 펼쳐진 마음의 문장.', t: 0.67, color: 'from-green-100 via-lime-50 to-white', emoji: '▱' },
            { id: 'cluster-together', title: '+23', tag: '묶음', caption: '함께 가지에 모인 스물세 개의 작은 순간.', t: 0.91, cluster: 23, color: 'from-emerald-100 via-lime-50 to-white' }
        ]
    }, {
        id: 'after', name: '여운', side: 'right', color: 'violet',
        startY: 44, endY: 14, endX: 77, curveA: 62, curveB: 70,
        caption: '끝난 뒤에도 오래 남은 장면들', count: 3,
        moments: [
            { id: 'm10', title: '조용한 엔딩', tag: '엔딩', caption: '불이 꺼진 뒤에도 마음에 남은 장면.', t: 0.26, color: 'from-violet-100 via-rose-50 to-white', emoji: '○' },
            { id: 'm11', title: '다시 본 장면', tag: '다시보기', caption: '처음보다 두 번째에 더 선명해진 표정.', t: 0.54, color: 'from-fuchsia-100 via-violet-50 to-white', emoji: '↺' },
            { id: 'm12', title: '다음 약속', tag: '약속', caption: '다시 만날 이유가 된 말.', t: 0.82, color: 'from-rose-100 via-violet-50 to-white', emoji: '∞' }
        ]
    }];

    var rootSeed = {
        id: 'root',
        branchId: 'first',
        title: '첫 팬미팅',
        tag: '시작',
        caption: '이 트리가 시작된 순간.',
        color: 'from-rose-200 via-rose-100 to-amber-50',
        emoji: '✦'
    };

    var treeComments = [
        { id: 'tc1', author: '@softorbit', body: '트리 전체 흐름이 너무 좋아요. 처음에서 여운까지 이어지는 느낌이 진짜 하나의 기록 같아요.', time: '방금', likes: 28 },
        { id: 'tc2', author: '@dailyxlove', body: '첫 기록 가지에서 갑자기 울컥했어요. 만든 분의 순서가 느껴져요.', time: '12분 전', likes: 14 },
        { id: 'tc3', author: '@roseclip', body: '이 트리 공유해줘서 고마워요. 같이 본 장면들이 다시 떠올랐어요.', time: '1시간 전', likes: 9 }
    ];

    var momentComments = {
        'm1': [
            { id: 'mc1', author: '@nara', body: '처음 가까이에서 본 날, 이 순간이 기억에 남아요.', time: '5분 전', likes: 12, replies: 1 },
            { id: 'mc2', author: '@leaf', body: '이 사진 오래 간직하고 싶어요.', time: '30분 전', likes: 8, replies: 0 }
        ],
        'm4': [
            { id: 'mc3', author: '@firstlight', body: '이날 진짜 다 같이 멈춘 것처럼 봤어요. 첫 1위라서 더 선명해요.', time: '3분 전', likes: 17, replies: 2 },
            { id: 'mc4', author: '@memo_leaf', body: '앵콜 전에 표정 바뀌던 순간이 아직도 기억나요.', time: '18분 전', likes: 11, replies: 0 },
            { id: 'mc5', author: '@quietfan', body: '이 순간은 트리 댓글보다 여기서 따로 이야기하는 게 맞네요.', time: '42분 전', likes: 6, replies: 1 }
        ],
        'm10': [
            { id: 'mc6', author: '@encoreday', body: '끝난 뒤에도 계속 생각나는 장면이에요.', time: '8분 전', likes: 8, replies: 0 }
        ]
    };

    function curvePoint(branch, t) {
        var x0 = 50, y0 = branch.startY;
        var x1 = branch.curveA, y1 = branch.startY - 8;
        var x2 = branch.curveB, y2 = branch.endY + 8;
        var x3 = branch.endX, y3 = branch.endY;
        var mt = 1 - t;
        return {
            x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
            y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
        };
    }

    window.LoveBudVisitorViewerData = {
        palette: palette,
        branches: branches,
        rootSeed: rootSeed,
        treeComments: treeComments,
        momentComments: momentComments,
        curvePoint: curvePoint,
        tree: {
            title: 'XLOV 첫 기억들',
            creator: '@lovebud_memory',
            meta: '43개 순간 · 4개 가지 · 꾸민 트리',
            metrics: { likes: 2800, comments: 184, shares: 92 }
        }
    };
})();