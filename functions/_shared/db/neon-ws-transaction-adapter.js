// Post-#4093 Neon WebSocket interactive transaction foundation.
//
// This module intentionally contains no Product-route wiring and no environment
// fallback. Callers must supply one explicit Neon connection string. Each
// transaction owns exactly one request-scoped Client and never retries the whole
// transaction automatically. In particular, a COMMIT transport error is treated
// as an unknown commit outcome and must never be followed by an automatic retry.

export const NEON_WS_TRANSACTION_STATE = Object.freeze({
  NEW: 'new',
  CONNECTING: 'connecting',
  READY: 'ready',
  BEGINNING: 'beginning',
  ACTIVE: 'active',
  COMMITTING: 'committing',
  COMMITTED: 'committed',
  ROLLING_BACK: 'rolling_back',
  ROLLED_BACK: 'rolled_back',
  COMMIT_OUTCOME_UNKNOWN: 'commit_outcome_unknown',
  FAILED: 'failed',
  CLOSING: 'closing',
  CLOSED: 'closed',
});

export const NEON_WS_TRANSACTION_COMMIT_OUTCOME = Object.freeze({
  NOT_ATTEMPTED: 'not_attempted',
  COMMITTED: 'committed',
  NOT_COMMITTED: 'not_committed',
  UNKNOWN: 'unknown',
});

export const NEON_WS_TRANSACTION_ERROR = Object.freeze({
  CONFIG_INVALID: 'CONFIG_INVALID',
  IMPORT_FAILURE: 'IMPORT_FAILURE',
  CLIENT_UNAVAILABLE: 'CLIENT_UNAVAILABLE',
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  TRANSACTION_STATE_INVALID: 'TRANSACTION_STATE_INVALID',
  QUERY_INVALID: 'QUERY_INVALID',
  QUERY_FAILURE: 'QUERY_FAILURE',
  BEGIN_FAILURE: 'BEGIN_FAILURE',
  WORK_FAILURE: 'WORK_FAILURE',
  ROLLBACK_FAILURE: 'ROLLBACK_FAILURE',
  COMMIT_OUTCOME_UNKNOWN: 'COMMIT_OUTCOME_UNKNOWN',
  CONNECTION_CLOSE_FAILURE: 'CONNECTION_CLOSE_FAILURE',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
});

export const NEON_WS_TRANSACTION_LOCK = Object.freeze({
  FOR_SHARE: 'for_share',
  FOR_UPDATE: 'for_update',
  ADVISORY_XACT: 'advisory_xact',
});

export const NEON_WS_TRANSACTION_RETRY_POLICY = Object.freeze({
  wholeTransactionAttempts: 1,
  automaticWholeTransactionRetries: 0,
  retryOnUnknownCommitOutcome: false,
});

export const NEON_WS_TRANSACTION_CAPABILITIES = Object.freeze({
  interactiveTransaction: true,
  requestScopedClientAffinity: true,
  rowLocks: true,
  advisoryTransactionLocks: true,
  canonicalReread: true,
  unknownCommitOutcomeExplicit: true,
  automaticWholeTransactionRetry: false,
});

const BEGIN_SQL = 'BEGIN';
const COMMIT_SQL = 'COMMIT';
const ROLLBACK_SQL = 'ROLLBACK';
const ADVISORY_XACT_LOCK_SQL = 'SELECT pg_advisory_xact_lock(hashtext($1::text))';
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;
const TRANSACTION_CONTROL = /^(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE\s+SAVEPOINT|SET\s+TRANSACTION)\b/i;
const FOR_SHARE = /\bFOR\s+SHARE\b/i;
const FOR_UPDATE = /\bFOR\s+UPDATE\b/i;

const ALLOWED_TRANSITIONS = Object.freeze({
  [NEON_WS_TRANSACTION_STATE.NEW]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CONNECTING,
    NEON_WS_TRANSACTION_STATE.FAILED,
  ]),
  [NEON_WS_TRANSACTION_STATE.CONNECTING]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.READY,
    NEON_WS_TRANSACTION_STATE.FAILED,
  ]),
  [NEON_WS_TRANSACTION_STATE.READY]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.BEGINNING,
    NEON_WS_TRANSACTION_STATE.CLOSING,
    NEON_WS_TRANSACTION_STATE.FAILED,
  ]),
  [NEON_WS_TRANSACTION_STATE.BEGINNING]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.ACTIVE,
    NEON_WS_TRANSACTION_STATE.FAILED,
  ]),
  [NEON_WS_TRANSACTION_STATE.ACTIVE]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.COMMITTING,
    NEON_WS_TRANSACTION_STATE.ROLLING_BACK,
  ]),
  [NEON_WS_TRANSACTION_STATE.COMMITTING]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.COMMITTED,
    NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN,
  ]),
  [NEON_WS_TRANSACTION_STATE.COMMITTED]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CLOSING,
  ]),
  [NEON_WS_TRANSACTION_STATE.ROLLING_BACK]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.ROLLED_BACK,
    NEON_WS_TRANSACTION_STATE.FAILED,
  ]),
  [NEON_WS_TRANSACTION_STATE.ROLLED_BACK]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CLOSING,
  ]),
  [NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CLOSING,
  ]),
  [NEON_WS_TRANSACTION_STATE.FAILED]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CLOSING,
    NEON_WS_TRANSACTION_STATE.CLOSED,
  ]),
  [NEON_WS_TRANSACTION_STATE.CLOSING]: Object.freeze([
    NEON_WS_TRANSACTION_STATE.CLOSED,
  ]),
  [NEON_WS_TRANSACTION_STATE.CLOSED]: Object.freeze([]),
});

export class NeonWsTransactionError extends Error {
  constructor(code, message = code, options = {}) {
    super(message);
    this.name = 'NeonWsTransactionError';
    this.code = Object.values(NEON_WS_TRANSACTION_ERROR).includes(code)
      ? code
      : NEON_WS_TRANSACTION_ERROR.UNEXPECTED_ERROR;
    this.status = Number.isInteger(options.status) ? options.status : 500;
    this.transactionState = options.transactionState || null;
    this.commitOutcome = options.commitOutcome || NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_ATTEMPTED;
    this.wholeTransactionRetrySafe = false;
  }
}

export function isNeonWsConnectionString(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    return NEON_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

async function defaultNeonImporter() {
  return import('@neondatabase/serverless');
}

function rowsFromResult(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function freezeStats(stats) {
  return Object.freeze({
    queryCount: stats.queryCount,
    applicationQueryCount: stats.applicationQueryCount,
    controlQueryCount: stats.controlQueryCount,
    advisoryLockCount: stats.advisoryLockCount,
    rowLockCount: stats.rowLockCount,
    canonicalRereadCount: stats.canonicalRereadCount,
    connectionCount: stats.connectionCount,
    closeCount: stats.closeCount,
  });
}

function assertState(current, expected) {
  if (current !== expected) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.TRANSACTION_STATE_INVALID,
      'transaction state invalid',
      { transactionState: current },
    );
  }
}

function assertParameterizedQuery(text, values) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.QUERY_INVALID, 'query text invalid');
  }
  if (!Array.isArray(values)) {
    throw new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.QUERY_INVALID, 'query values invalid');
  }

  const trimmed = text.trim();
  if (TRANSACTION_CONTROL.test(trimmed)) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
      'transaction control is adapter-owned',
    );
  }

  const withoutTrailingSemicolon = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed;
  if (withoutTrailingSemicolon.includes(';')) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
      'multi-statement query rejected',
    );
  }

  const placeholders = [...withoutTrailingSemicolon.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  if (placeholders.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.QUERY_INVALID, 'query placeholder invalid');
  }

  const maxPlaceholder = placeholders.length ? Math.max(...placeholders) : 0;
  if (maxPlaceholder !== values.length) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
      'query placeholder/value mismatch',
    );
  }
  for (let i = 1; i <= maxPlaceholder; i += 1) {
    if (!placeholders.includes(i)) {
      throw new NeonWsTransactionError(
        NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
        'query placeholder sequence invalid',
      );
    }
  }
}

function assertLockQuery(text, pattern, label) {
  if (!pattern.test(text)) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
      `${label} lock clause required`,
    );
  }
}

function safeTransition(machine, next) {
  const allowed = ALLOWED_TRANSITIONS[machine.state] || [];
  if (!allowed.includes(next)) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.TRANSACTION_STATE_INVALID,
      'transaction transition invalid',
      { transactionState: machine.state },
    );
  }
  machine.state = next;
  machine.history.push(next);
}

function makeError(code, message, machine, commitOutcome, status = 500) {
  return new NeonWsTransactionError(code, message, {
    status,
    transactionState: machine.state,
    commitOutcome,
  });
}

function makeTransactionContext(client, machine, stats) {
  async function query(text, values = []) {
    assertState(machine.state, NEON_WS_TRANSACTION_STATE.ACTIVE);
    assertParameterizedQuery(text, values);
    stats.queryCount += 1;
    stats.applicationQueryCount += 1;
    try {
      return rowsFromResult(await client.query(text, values));
    } catch {
      throw makeError(
        NEON_WS_TRANSACTION_ERROR.QUERY_FAILURE,
        'transaction query failed',
        machine,
        NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_ATTEMPTED,
        502,
      );
    }
  }

  return Object.freeze({
    get state() {
      return machine.state;
    },
    query,
    async advisoryXactLock(lockKey) {
      if (lockKey === undefined || lockKey === null || String(lockKey).length === 0) {
        throw new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.QUERY_INVALID, 'advisory lock key invalid');
      }
      const rows = await query(ADVISORY_XACT_LOCK_SQL, [String(lockKey)]);
      stats.advisoryLockCount += 1;
      return rows;
    },
    async forShare(text, values = []) {
      assertLockQuery(text, FOR_SHARE, 'FOR SHARE');
      const rows = await query(text, values);
      stats.rowLockCount += 1;
      return rows;
    },
    async forUpdate(text, values = []) {
      assertLockQuery(text, FOR_UPDATE, 'FOR UPDATE');
      const rows = await query(text, values);
      stats.rowLockCount += 1;
      return rows;
    },
    async canonicalReread(text, values = []) {
      const rows = await query(text, values);
      stats.canonicalRereadCount += 1;
      return rows;
    },
  });
}

async function runControlQuery(client, text, machine, stats, errorCode, nextOnFailure) {
  stats.queryCount += 1;
  stats.controlQueryCount += 1;
  try {
    await client.query(text, []);
  } catch {
    if (nextOnFailure && (ALLOWED_TRANSITIONS[machine.state] || []).includes(nextOnFailure)) {
      safeTransition(machine, nextOnFailure);
    }
    throw makeError(errorCode, 'transaction control failed', machine, NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_ATTEMPTED, 502);
  }
}

async function closeClient(client, machine, stats) {
  if (!client) {
    if (machine.state === NEON_WS_TRANSACTION_STATE.FAILED) {
      safeTransition(machine, NEON_WS_TRANSACTION_STATE.CLOSED);
    }
    return false;
  }
  if (machine.state !== NEON_WS_TRANSACTION_STATE.CLOSING) {
    safeTransition(machine, NEON_WS_TRANSACTION_STATE.CLOSING);
  }
  try {
    await client.end();
    stats.closeCount += 1;
    safeTransition(machine, NEON_WS_TRANSACTION_STATE.CLOSED);
    return false;
  } catch {
    machine.state = NEON_WS_TRANSACTION_STATE.CLOSED;
    machine.history.push(NEON_WS_TRANSACTION_STATE.CLOSED);
    return true;
  }
}

function outcomeForState(state) {
  if (state === NEON_WS_TRANSACTION_STATE.COMMITTED || state === NEON_WS_TRANSACTION_STATE.CLOSING || state === NEON_WS_TRANSACTION_STATE.CLOSED) {
    return NEON_WS_TRANSACTION_COMMIT_OUTCOME.COMMITTED;
  }
  if (state === NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN) {
    return NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN;
  }
  return NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED;
}

export async function createNeonWsTransactionAdapter({ connectionString, neonImporter = defaultNeonImporter } = {}) {
  if (!isNeonWsConnectionString(connectionString)) {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.CONFIG_INVALID,
      'Neon WS transaction config invalid',
      { status: 503 },
    );
  }

  let imported;
  try {
    imported = await neonImporter();
  } catch {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.IMPORT_FAILURE,
      'Neon WS driver import failed',
      { status: 503 },
    );
  }
  const Client = imported && imported.Client;
  if (typeof Client !== 'function') {
    throw new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.CLIENT_UNAVAILABLE,
      'Neon WS Client unavailable',
      { status: 503 },
    );
  }

  return Object.freeze({
    transport: 'neon_ws',
    capabilities: NEON_WS_TRANSACTION_CAPABILITIES,
    retryPolicy: NEON_WS_TRANSACTION_RETRY_POLICY,

    async runTransaction(work) {
      if (typeof work !== 'function') {
        throw new NeonWsTransactionError(
          NEON_WS_TRANSACTION_ERROR.QUERY_INVALID,
          'transaction work callback required',
        );
      }

      const machine = {
        state: NEON_WS_TRANSACTION_STATE.NEW,
        history: [NEON_WS_TRANSACTION_STATE.NEW],
      };
      const stats = {
        queryCount: 0,
        applicationQueryCount: 0,
        controlQueryCount: 0,
        advisoryLockCount: 0,
        rowLockCount: 0,
        canonicalRereadCount: 0,
        connectionCount: 0,
        closeCount: 0,
      };
      let client = null;
      let value;
      let pendingError = null;
      let commitOutcome = NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_ATTEMPTED;

      try {
        try {
          client = new Client({ connectionString });
        } catch {
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.FAILED);
          throw makeError(
            NEON_WS_TRANSACTION_ERROR.CONNECTION_FAILURE,
            'database client construction failed',
            machine,
            NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED,
            502,
          );
        }

        safeTransition(machine, NEON_WS_TRANSACTION_STATE.CONNECTING);
        try {
          await client.connect();
          stats.connectionCount += 1;
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.READY);
        } catch {
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.FAILED);
          throw makeError(
            NEON_WS_TRANSACTION_ERROR.CONNECTION_FAILURE,
            'database connection failed',
            machine,
            NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED,
            502,
          );
        }

        safeTransition(machine, NEON_WS_TRANSACTION_STATE.BEGINNING);
        await runControlQuery(
          client,
          BEGIN_SQL,
          machine,
          stats,
          NEON_WS_TRANSACTION_ERROR.BEGIN_FAILURE,
          NEON_WS_TRANSACTION_STATE.FAILED,
        );
        safeTransition(machine, NEON_WS_TRANSACTION_STATE.ACTIVE);

        const tx = makeTransactionContext(client, machine, stats);
        try {
          value = await work(tx);
        } catch (error) {
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.ROLLING_BACK);
          try {
            await runControlQuery(
              client,
              ROLLBACK_SQL,
              machine,
              stats,
              NEON_WS_TRANSACTION_ERROR.ROLLBACK_FAILURE,
              NEON_WS_TRANSACTION_STATE.FAILED,
            );
            safeTransition(machine, NEON_WS_TRANSACTION_STATE.ROLLED_BACK);
            commitOutcome = NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED;
          } catch (rollbackError) {
            pendingError = makeError(
              NEON_WS_TRANSACTION_ERROR.ROLLBACK_FAILURE,
              'transaction rollback failed',
              machine,
              NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_COMMITTED,
              502,
            );
            throw pendingError;
          }

          const code = error instanceof NeonWsTransactionError
            ? error.code
            : NEON_WS_TRANSACTION_ERROR.WORK_FAILURE;
          pendingError = makeError(
            code,
            code === NEON_WS_TRANSACTION_ERROR.QUERY_FAILURE ? 'transaction query failed' : 'transaction work failed',
            machine,
            commitOutcome,
            error instanceof NeonWsTransactionError ? error.status : 500,
          );
          throw pendingError;
        }

        safeTransition(machine, NEON_WS_TRANSACTION_STATE.COMMITTING);
        stats.queryCount += 1;
        stats.controlQueryCount += 1;
        try {
          await client.query(COMMIT_SQL, []);
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.COMMITTED);
          commitOutcome = NEON_WS_TRANSACTION_COMMIT_OUTCOME.COMMITTED;
        } catch {
          safeTransition(machine, NEON_WS_TRANSACTION_STATE.COMMIT_OUTCOME_UNKNOWN);
          commitOutcome = NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN;
          pendingError = makeError(
            NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'transaction commit outcome unknown',
            machine,
            commitOutcome,
            502,
          );
          throw pendingError;
        }
      } catch (error) {
        pendingError = pendingError || error;
      }

      const stateBeforeClose = machine.state;
      const closeFailed = await closeClient(client, machine, stats);
      if (closeFailed && !pendingError) {
        const knownOutcome = outcomeForState(stateBeforeClose);
        pendingError = makeError(
          NEON_WS_TRANSACTION_ERROR.CONNECTION_CLOSE_FAILURE,
          'database connection close failed',
          machine,
          knownOutcome,
          502,
        );
      }

      if (pendingError) throw pendingError;

      return Object.freeze({
        value,
        outcome: 'committed',
        commitOutcome,
        state: machine.state,
        stateHistory: Object.freeze([...machine.history]),
        stats: freezeStats(stats),
      });
    },
  });
}

export async function runNeonWsTransaction({ connectionString, work, neonImporter } = {}) {
  const adapter = await createNeonWsTransactionAdapter({ connectionString, neonImporter });
  return adapter.runTransaction(work);
}

export function sanitizeNeonWsTransactionError(error) {
  const known = error instanceof NeonWsTransactionError;
  return Object.freeze({
    error: 'neon websocket transaction failed',
    code: known ? error.code : NEON_WS_TRANSACTION_ERROR.UNEXPECTED_ERROR,
    status: known ? error.status : 500,
    transaction_state: known ? error.transactionState : null,
    commit_outcome: known ? error.commitOutcome : NEON_WS_TRANSACTION_COMMIT_OUTCOME.NOT_ATTEMPTED,
    whole_transaction_retry_safe: false,
  });
}

export const __NEON_WS_TRANSACTION_TEST_ONLY = Object.freeze({
  BEGIN_SQL,
  COMMIT_SQL,
  ROLLBACK_SQL,
  ADVISORY_XACT_LOCK_SQL,
  ALLOWED_TRANSITIONS,
});
