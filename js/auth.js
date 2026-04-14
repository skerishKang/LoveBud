document.addEventListener('DOMContentLoaded', () => {
    // Auth State (Simulated)
    let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    const loginBtns = document.querySelectorAll('a[href="login.html"]');
    const googleBtn = document.querySelector('.login-btn-google');

    const updateUI = () => {
        if (isLoggedIn) {
            loginBtns.forEach(btn => {
                btn.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
                btn.style.border = 'none';
                btn.style.padding = '0';
                btn.href = '#';
                btn.onclick = (e) => {
                    e.preventDefault();
                    if (confirm('로그아웃 하시겠습니까?')) {
                        logout();
                    }
                };
            });
        }
    };

    const login = () => {
        localStorage.setItem('isLoggedIn', 'true');
        isLoggedIn = true;
        updateUI();
        window.location.href = 'index.html';
    };

    const logout = () => {
        localStorage.removeItem('isLoggedIn');
        isLoggedIn = false;
        window.location.reload();
    };

    // UI Logic
    if (googleBtn) {
        googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login with Google...');
            // In a real app, this would trigger Firebase signInWithPopup
            login();
        });
    }

    updateUI();
});
