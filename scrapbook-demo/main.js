document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            const cardId = card.id;
            console.log(`${cardId} 클릭됨!`);
            
            // 클릭 시 튀어오르는 애니메이션
            card.animate([
                { transform: 'scale(1.05) translateY(-10px)' },
                { transform: 'scale(1.2) translateY(-20px)' },
                { transform: 'scale(1.05) translateY(-10px)' }
            ], {
                duration: 500,
                easing: 'ease-out'
            });

            // 기능 연결 예시
            if (cardId === 'cardMusic') {
                alert('음악 플레이어 기능을 시작합니다! 🎵');
            } else if (cardId === 'cardHeart') {
                alert('이 카드의 상세 감정 트리를 불러옵니다. ❤️');
            }
        });
    });

    // 배경 노이즈나 미세한 움직임 추가 가능
    document.addEventListener('mousemove', (e) => {
        const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
        
        // 미세하게 시차(Parallax) 효과 부여
        document.querySelector('.base-background').style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
});
