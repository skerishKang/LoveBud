// Check Modal deploy status
const fs = require('fs');
const path = require('path');

// Check Modal app deploy status
console.log('Checking Modal deployment...');

// Read MODAL_BASE_URL from secrets to understand routing
const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let modalBaseUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('MODAL_BASE_URL=')) {
    modalBaseUrl = line.trim().replace('MODAL_BASE_URL=', '');
    break;
  }
}
console.log('Modal base URL: PRESENT (length=' + (modalBaseUrl ? modalBaseUrl.length : 0) + ')');

// Try direct Modal API call for the tree
const https = require('https');
const url = modalBaseUrl + '/modal/trees/10340000-0000-4000-8000-000000000001';

https.get(url, { timeout: 10000 }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Modal direct status:', res.statusCode);
    // Print only structure, not full payload
    try {
      const json = JSON.parse(data);
      console.log('Response keys:', Object.keys(json).join(', '));
      if (json.id) console.log('Tree found: YES');
      if (json.title) console.log('Title:', json.title.substring(0, 40));
      if (json.detail) console.log('Detail message:', json.detail);
    } catch {
      console.log('Raw response:', data.substring(0, 200));
    }
  });
}).on('error', (e) => {
  console.log('Modal direct error:', e.message);
  console.log('Modal likely not deployed or not updated with PR #1294');
});
