/**
 * LoveBud UI 유틸리티
 * v20260418-1
 *
 * 공통 UI 컴포넌트 및 상호작용 유틸리티
 */

(function() {
    'use strict';

    const DEFAULT_DURATION = 3000;
    let toastContainer = null;

    /**
     * 토스트 컨테이너 초기화 (lazy)
     */
    function ensureToastContainer() {
        if (toastContainer) return toastContainer;

        toastContainer = document.createElement('div');
        toastContainer.id = 'lovebud-toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;

        // 애니메이션 스타일 추가
        if (!document.getElementById('lovebud-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'lovebud-ui-styles';
            style.textContent = `
                @keyframes lovebud-fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes lovebud-fade-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .lovebud-toast {
                    animation: lovebud-fade-in-up 0.3s ease;
                }
                .lovebud-toast.hiding {
                    animation: lovebud-fade-out 0.3s ease forwards;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    /**
     * 토스트 메시지 표시
     *
     * @param {string} message - 표시할 메시지
     * @param {string} type - 타입: 'info' | 'success' | 'warn' | 'error'
     * @param {number} duration - 표시 시간 (ms)
     */
    function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
        const container = ensureToastContainer();

        // 색상 설정
        const colors = {
            info: { bg: '#2e7d32', icon: 'info' },
            success: { bg: '#2e7d32', icon: 'check_circle' },
            warn: { bg: '#ef6c00', icon: 'warning' },
            error: { bg: '#c62828', icon: 'error' }
        };
        const style = colors[type] || colors.info;

        // 토스트 생성
        const toast = document.createElement('div');
        toast.className = 'lovebud-toast';
        toast.style.cssText = `
            background: ${style.bg};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 90vw;
            min-width: 200px;
            word-break: break-word;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: auto;
        `;

        // 아이콘 추가
        toast.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 18px;">${style.icon}</span>
            <span>${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // 자동 제거
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);

        return toast;
    }

    /**
     * 모든 토스트 즉시 숨김
     */
    function hideAllToasts() {
        const container = document.getElementById('lovebud-toast-container');
        if (container) {
            const toasts = container.querySelectorAll('.lovebud-toast');
            toasts.forEach(toast => {
                toast.classList.add('hiding');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            });
        }
    }

    /**
     * HTML escape helper
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 로딩 표시 (향후 확장용)
     */
    function showLoading() {
        console.log('[LoveBudUI] showLoading called (placeholder)');
        // TODO: 향후 구현
    }

    /**
     * 로딩 숨김 (향후 확장용)
     */
    function hideLoading() {
        console.log('[LoveBudUI] hideLoading called (placeholder)');
        // TODO: 향후 구현
    }

    /**
     * 확인 다이얼로그 (향후 확장용)
     */
    function showConfirm(message) {
        return window.confirm(message);
    }

    // 전역 노출
    window.LoveBudUI = {
        showToast,
        hideAllToasts,
        showLoading,
        hideLoading,
        showConfirm
    };

    console.log('[LoveBudUI] UI utilities loaded v20260418-1');
})();
