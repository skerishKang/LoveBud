// URL-only quick save handler
// Creates moment with auto defaults from URL
export async function quickSaveUrl(url) {
  const moment = {
    id: crypto.randomUUID(),
    type: 'url',
    url,
    title: extractTitle(url),
    memo: '',
    createdAt: new Date().toISOString()
  };
  
  // Auto-fetch metadata if YouTube
  if (isYoutubeUrl(url)) {
    moment.type = 'youtube';
    moment.title = await fetchYoutubeTitle(url) || 'YouTube Video';
  }
  
  return moment;
}

function extractTitle(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return url;
  }
}

function isYoutubeUrl(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

async function fetchYoutubeTitle(url) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    const data = await res.json();
    return data.title;
  } catch {
    return null;
  }
}