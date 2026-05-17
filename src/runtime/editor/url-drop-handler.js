// Drag-and-drop URL/YouTube handler
// Supports: URLs, YouTube links → auto-create moments
export function setupUrlDropZone(dropZone, callback) {
  ['dragenter', 'dragover'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  
  ['dragleave', 'drop'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });
  
  dropZone.addEventListener('drop', async (e) => {
    const url = extractUrlFromDrop(e);
    if (url && isValidUrl(url)) {
      const moment = await createMomentFromUrl(url);
      callback?.(moment);
    }
  });
}

function extractUrlFromDrop(e) {
  const dt = e.dataTransfer;
  for (const item of dt.types) {
    if (item === 'text/uri-list') return dt.getData('text/uri-list');
    if (item === 'text/plain') {
      const text = dt.getData('text/plain');
      if (text.startsWith('http')) return text;
    }
  }
  return null;
}

function isValidUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://');
}

async function createMomentFromUrl(url) {
  return {
    id: crypto.randomUUID(),
    type: 'url',
    url,
    title: url,
    createdAt: new Date().toISOString()
  };
}