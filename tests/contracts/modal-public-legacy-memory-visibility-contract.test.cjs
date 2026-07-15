const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

/**
 * Resolve a Python interpreter that can run contract tests.
 * Prefer PYTHON env override; otherwise platform default (python3 on POSIX, python on win32).
 * Does not silently fall back across interpreters after selection.
 */
function resolvePythonCommand() {
    if (process.env.PYTHON && String(process.env.PYTHON).trim()) {
        return String(process.env.PYTHON).trim();
    }
    return process.platform === 'win32' ? 'python' : 'python3';
}

function assertPythonAvailable(pythonCmd) {
    const probe = spawnSync(pythonCmd, ['--version'], {
        encoding: 'utf-8',
        env: process.env,
    });
    if (probe.error) {
        throw new Error(
            `Python executable not available (${pythonCmd}): ${probe.error.message}. ` +
            `Set PYTHON to an executable that can run the contract script.`
        );
    }
    // Windows Store alias can return status 9009 with empty/stub output
    if (probe.status !== 0) {
        throw new Error(
            `Python executable failed version check (${pythonCmd}): exit ${probe.status}\n` +
            `stdout: ${probe.stdout || ''}\nstderr: ${probe.stderr || ''}\n` +
            `Set PYTHON to a working interpreter.`
        );
    }
    const versionOut = `${probe.stdout || ''}${probe.stderr || ''}`.trim();
    assert.ok(
        /Python\s+\d+\.\d+/i.test(versionOut),
        `Unexpected python --version output from ${pythonCmd}: ${versionOut}`
    );
    return versionOut;
}

test('Modal public legacy memory visibility behavior test', () => {
    const pythonTestPath = path.join(__dirname, 'test_public_legacy_memory_visibility.py');
    const pythonCmd = resolvePythonCommand();
    assertPythonAvailable(pythonCmd);

    const result = spawnSync(pythonCmd, [pythonTestPath], {
        env: { ...process.env, PYTHONPATH: process.cwd() },
        encoding: 'utf-8'
    });

    if (result.error) {
        throw new Error(`Failed to execute Python test with ${pythonCmd}: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(`Python test failed with exit code ${result.status} (cmd=${pythonCmd})\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    }

    const output = (result.stdout || '') + (result.stderr || '');
    assert.ok(output.includes('OK'), 'Python test output should indicate success');
});
