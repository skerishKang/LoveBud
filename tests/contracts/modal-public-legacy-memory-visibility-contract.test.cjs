const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('Modal public legacy memory visibility behavior test', () => {
    const pythonTestPath = path.join(__dirname, 'test_public_legacy_memory_visibility.py');

    const result = spawnSync('python3', [pythonTestPath], {
        env: { ...process.env, PYTHONPATH: process.cwd() },
        encoding: 'utf-8'
    });

    if (result.error) {
        throw new Error(`Failed to execute Python test: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(`Python test failed with exit code ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    }

    const output = (result.stdout || '') + (result.stderr || '');
    assert.ok(output.includes('OK'), 'Python test output should indicate success');
});
