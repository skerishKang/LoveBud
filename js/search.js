document.addEventListener('DOMContentLoaded', () => {
    const resultsList = document.getElementById('resultsList');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const detailArtist = document.getElementById('detailArtist');
    const detailDate = document.getElementById('detailDate');

    // Sample Search Data
    const searchResults = [
        {
            id: 'v1',
            youtubeId: 'dQw4w9WgXcQ', // Placeholder
            title: 'Whispering Petals — Live Stage',
            date: '2024.03.24',
            artist: 'LUMINA',
            source: 'M-Countdown',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtTuAoKJeSHwkrsYAPRVf1hmE2ZOakz9QiG-sju-B6kAPXGROuK8oRYHr-x0HettulikZeo7sXfaC6h2R9eK3VtsWxQT96eJIrPyOvLyREEBA2L3Zyu0JHd5D4vtfoGFEqKsz5OSgh3Z8sNgFE0lJiLcO2F8-f5fvUKFP3493fAmcAj-tTmhUV6Mr3XIeT5X1U1vvJiqDrU7OmZYLarm7dTiNVw3DsNXV8bmbZekV9jDGjb6ovsa8XEBO5EDAuKWQ2MDz3zKkN5RQ',
            quote: 'A performance that captures the essence of early morning dew.'
        },
        {
            id: 'v2',
            youtubeId: '9bZkp7q19f0', // Placeholder
            title: 'Eternal Spring — Official MV',
            date: '2024.04.02',
            artist: 'LUMINA',
            source: 'Star Ent.',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzWVpWYsddLvWm5QtFvAlBO77i--ZKO3bZpEO5--Y39_YWGGeXcsI0QwgH7Pf3Htge5qDKQWZ-mRLfhCpWIRqiU8E7KWY_Mz7-boHu-Nvjsxazgkkbvb2nKeMa4zIOixk1eyQ4FzRt4ZSo3fFMOJA5Mtl6HFQhODb0EBI6_30-qIFHqNMpisOXK0aNjFgYnmeo3BzugRpfJCWBexlhBiyXuaF7zxSSNxA99IKXRhA_P7nQreJL6SyGmDDjXDJgS2naem1gGLVZHR0',
            quote: 'The blooming colors of a heart in spring.'
        },
        {
            id: 'v3',
            youtubeId: 'jNQXAC9IVRw', // Placeholder
            title: 'Nightfall Serenade — Encore Cam',
            date: '2024.04.15',
            artist: 'SOLOIST',
            source: 'SBS Inkigayo',
            img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWJPadJz5CKVIofhWn1kYL2ioMnDA1LToVY1eah0vxpprqoJDiy2ymM-llQPIFlDCf3pSHs-vYyC_4vV1k1xkn8mXYnX24NPedwENxaSpL5Qeo5b6pJRSmyCUy1LEFWvfngHD5tfRp8eCvebRH8sIZT_eIC9RN_JN9dTlRgSr1Qpt2-94jvLJZS6efxuwqivBqsoIcy_CCsIFdFshwz0i2LRJWuS01RUjWDLn09EwOwYM1I_qRLovxlHN9_48w0IFF3kD2pt_9MF0',
            quote: 'The lingering echo of a perfect night.'
        }
    ];

    const populateResults = (results) => {
        resultsList.innerHTML = '';
        results.forEach(res => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="${res.img}" alt="${res.title}">
                </div>
                <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h3 class="serif" style="font-size: 1.25rem; margin-bottom: 4px;">${res.title}</h3>
                        <p style="font-size: 10px; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 1px;">
                            ${res.date} • ${res.source}
                        </p>
                    </div>
                    <button class="btn-round btn-primary save-btn" data-id="${res.id}" style="width: fit-content; margin-top: 16px;">
                        Save to LoveTree
                    </button>
                </div>
            `;
            card.addEventListener('click', () => updatePreview(res));
            resultsList.appendChild(card);
        });
    };

    const updatePreview = (res) => {
        // Update YouTube Embed
        previewContainer.innerHTML = `
            <iframe width="100%" height="100%" 
                src="https://www.youtube.com/embed/${res.youtubeId}?autoplay=1" 
                title="YouTube video player" frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>
        `;
        
        previewTitle.textContent = res.title;
        previewDesc.textContent = `"${res.quote}"`;
        detailArtist.textContent = res.artist;
        detailDate.textContent = res.date;
    };

    // Initial Load
    populateResults(searchResults);
    updatePreview(searchResults[0]);

    console.log('Search Logic Initialized');
});
