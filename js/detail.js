document.addEventListener('DOMContentLoaded', () => {
    const videoMain = document.getElementById('videoMain');

    // Simple routing logic based on URL params (e.g., detail.html?id=v1)
    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id') || 'v1';

    // Mock data (same as search.js for consistency)
    const memories = {
        'v1': {
            youtubeId: 'dQw4w9WgXcQ',
            title: 'Whispering Petals — Live Stage'
        },
        'v2': {
            youtubeId: '9bZkp7q19f0',
            title: 'Eternal Spring — Official MV'
        }
    };

    const currentMemory = memories[memoryId] || memories['v1'];

    // Load Video
    videoMain.innerHTML = `
        <iframe width="100%" height="100%" 
            src="https://www.youtube.com/embed/${currentMemory.youtubeId}?autoplay=0" 
            title="${currentMemory.title}" frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>
    `;

    console.log('Detail View Loaded for:', currentMemory.title);
});
