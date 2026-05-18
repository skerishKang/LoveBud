// Fix Modal secret - read from .secrets file and create properly
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
for (const line of raw.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().replace('DATABASE_URL=', '');
    break;
  }
}
if (!dbUrl) { console.log('FATAL: DATABASE_URL not found'); process.exit(1); }

// Delete existing secret first
try {
  execSync('modal secret delete lovebud-db --yes', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('Deleted existing lovebud-db secret');
} catch (e) {
  console.log('Delete note:', e.stderr?.substring(0, 100) || 'already deleted');
}

// Create new secret using the piped method with here-string
// Write the value to a temp file for safer handling
const tmpFile = '/tmp/modal_db_url_secret.txt';
fs.writeFileSync(tmpFile, dbUrl, 'utf-8');

// Use modal secret create with the value from a file
// The - flag means read from stdin, so we pipe the file content
const result = spawnSync('bash', ['-c', `cat "${tmpFile}" | modal secret create lovebud-db DATABASE_URL=- --force 2>&1`], {
  stdio: 'pipe',
  encoding: 'utf-8',
  timeout: 30000,
  env: { ...process.env, EDITOR: 'cat' }  // Use cat as editor to avoid vim issues
});
console.log('Result:', result.stdout?.trim());
if (result.stderr) console.log('Stderr:', result.stderr?.substring(0, 200));
if (result.error) console.log('Error:', result.error.message);

// Clean up
fs.unlinkSync(tmpFile);
console.log('Temp file cleaned up');
