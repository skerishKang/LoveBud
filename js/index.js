document.addEventListener('DOMContentLoaded', () => {
    // Gallery Data
    const images = [
        'slide_home-slide-01-empty-tree_safe.png',
        'slide_home-slide-02-first-memory_safe.png',
        'slide_Gemini_Generated_Image_tlt4p0tlt4p0tlt4.png',
        'slide_Gemini_Generated_Image_z8g408z8g408z8g4.png',
        'slide_home-slide-01-empty-tree_bts.png',
        'slide_home-slide-02-first-memory_bts.png',
        'slide_slide1.png',
        'slide_slide2.png'
    ];

    const galleryGrid = document.getElementById('galleryGrid');
    const imagePath = '../LoveBud_Gallery/assets/images/';

    // Populate Gallery
    images.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item reveal';
        item.innerHTML = `
            <img src="${imagePath}${img}" alt="Bud ${index + 1}" loading="lazy">
            <div class="overlay">
                <span>VIEW MOMENT</span>
            </div>
        `;
        galleryGrid.appendChild(item);
    });

    // Scroll Reveal Logic
    const revealElements = document.querySelectorAll('.reveal');
    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        revealElements.forEach(el => {
            const elementTop = el.getBoundingClientRect().top;
            const elementVisible = 150;
            if (elementTop < windowHeight - elementVisible) {
                el.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Initial check

    // Smooth scroll for hero background parallax
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const hero = document.querySelector('.hero');
        hero.style.backgroundPositionY = -(scrolled * 0.5) + 'px';
    });

    // Simple Modal/Lightbox placeholder
    galleryGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
            const img = item.querySelector('img').src;
            alert('This would open a premium modal for: ' + img.split('/').pop());
            // In a real premium app, we would inject a beautiful modal here.
        }
    });

    console.log('LoveBud Identity Site initialized.');
});
