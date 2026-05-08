(function() {
    'use strict';

    window.LoveBudVisitorViewerData = {
        tree: {
            title: 'XLOV 첫 기억들',
            creator: '@lovebud_memory',
            meta: '6 moments · 12.8k views',
            likes: 1280,
            comments: 84,
            shares: 42,
            rootMomentId: 'root-first-stage',
            commentsList: [
                { author: '@slow_fan', text: '첫 기록부터 이어지는 흐름이 좋아요.' },
                { author: '@mint_memory', text: '같이 본 밤 생각나요.' }
            ]
        },
        branches: [
            {
                id: 'first-days',
                name: '처음 좋아진 날',
                y: 64,
                side: 'left',
                rotate: '-13deg',
                caption: '처음 마음이 움직였던 장면들.',
                momentIds: ['debut-stage']
            },
            {
                id: 'records',
                name: '첫 기록',
                y: 44,
                side: 'right',
                rotate: '11deg',
                caption: '함께 기뻤던 첫 기록.',
                momentIds: ['music-show-win', 'first-encore']
            },
            {
                id: 'kept-scenes',
                name: '오래 남은 장면',
                y: 25,
                side: 'left',
                rotate: '-8deg',
                caption: '다시 열어보게 되는 기억.',
                momentIds: ['fanmeeting', 'crying-night']
            }
        ],
        moments: [
            {
                id: 'root-first-stage',
                branchId: 'first-days',
                title: '첫 무대',
                caption: '처음 봤을 때 바로 저장해 둔 장면.',
                tags: ['설렘', '첫 기록'],
                comments: [{ author: '@nara', text: '이때 분위기 아직도 기억나요.' }]
            },
            {
                id: 'debut-stage',
                branchId: 'first-days',
                title: '데뷔 무대',
                caption: '눈빛이 오래 남아서 다시 보게 됐어요.',
                tags: ['응원'],
                comments: [{ author: '@leaf', text: '여기서 시작된 마음 같아요.' }]
            },
            {
                id: 'music-show-win',
                branchId: 'records',
                title: '첫 음악방송 1위',
                caption: '같이 놀라고 같이 웃었던 첫 기록.',
                tags: ['첫 기록'],
                comments: [{ author: '@rosebud', text: '이 장면은 저장해야죠.' }]
            },
            {
                id: 'first-encore',
                branchId: 'records',
                title: '첫 앵콜',
                caption: '작게 떨리던 목소리까지 좋아서.',
                tags: ['응원', '깊어진 마음'],
                comments: [{ author: '@moon', text: 'caption이 딱 그 마음이에요.' }]
            },
            {
                id: 'fanmeeting',
                branchId: 'kept-scenes',
                title: '첫 팬미팅',
                caption: '팬들에게 건넨 말이 오래 남았어요.',
                tags: ['설렘'],
                comments: [{ author: '@warm', text: '나도 여기서 더 좋아졌어요.' }]
            },
            {
                id: 'crying-night',
                branchId: 'kept-scenes',
                title: '같이 울었던 밤',
                caption: '기억이 아니라 마음처럼 남은 순간.',
                tags: ['깊어진 마음'],
                comments: [{ author: '@page', text: '짧은데 충분해요.' }]
            }
        ]
    };
})();
