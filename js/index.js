document.addEventListener('DOMContentLoaded', () => {
    function isIndexDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_INDEX_DEBUG === true;
    }

    function indexDebugLog() {
        if (!isIndexDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    // Reveal Observer for scroll animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Language Toggle Logic (Visual only)
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            indexDebugLog('Language changed to:', btn.textContent);
            // In a real app, this would trigger i18n logic
        });
    });

    setupBrowseSafePrefetch();


});

function setupBrowseSafePrefetch() {
    if (window.LoveBudBrowsePrefetch) {
        window.LoveBudBrowsePrefetch.init();
    }
}
