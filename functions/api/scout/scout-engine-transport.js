/**
 * LoveBud #1882 S4A — Scout Engine Transport Adapter
 * Bounded server-only transport to Padiem AI Engine /internal/v1/execute
 *
 * Canonical wire:
 *   POST https://padiem-ai-engine.internal/internal/v1/execute
 *
 * This module:
 * - owns server-side app/agent identity
 * - constructs service identity headers server-side
 * - uses ONLY the Engine service binding fetch
 * - fails closed when Engine binding or credential is missing
 * - never exposes Engine internals through Scout product output
 * - never calls direct Provider or Core runtime
 *
 * Non-goals:
 * - No LoveBud -> Core direct runtime
 * - No real Provider execution
 * - No external URL fetch
 * - No Engine SDK vendoring
 *
 * Refs #1882
 * Keep #1882 open
 */

'use strict';

const SCOUT_ENGINE_TRANSPORT_ERROR_CODES = Object.freeze({
  ENGINE_BINDING_MISSING: 'ENGINE_BINDING_MISSING',
  ENGINE_CREDENTIAL_MISSING: 'ENGINE_CREDENTIAL_MISSING',
  ENGINE_REQUEST_FAILED: 'ENGINE_REQUEST_FAILED',
  ENGINE_RESPONSE_INVALID: 'ENGINE_RESPONSE_INVALID',
  ENGINE_ANSWER_PARSE_FAILED: 'ENGINE_ANSWER_PARSE_FAILED',
  ENGINE_OUTPUT_PROJECTION_FAILED: 'ENGINE_OUTPUT_PROJECTION_FAILED',
});

const SERVER_OWNED_ENGINE_IDENTITY = Object.freeze({
  appId: 'lovebud-scout',
  callerId: 'lovebud-scout-server',
  agent: Object.freeze({
    id: 'scout-suggestion-v1',
    title: 'LoveBud Scout Suggestion',
    description: 'Generates bounded fan-domain suggestions from normalized Scout product intent',
    system_instruction:
      'You are a fan-domain assistant for LoveBud Scout. Given the user excerpt, optional summary, optional memo, and an attribution-only source URL, return ONLY a JSON object with exactly these fields: titleSuggestion (string, max 50 chars), summarySuggestion (string, max 200 chars), translationSuggestion (string, max 500 chars), emotionTags (array of up to 4 strings, each max 20 chars), memoSuggestion (string, max 500 chars), safetyNote (string, max 300 chars). Do NOT fetch or access the source URL. Do NOT include any other fields.',
    task_type: 'scout_suggestion',
    optimize_for: 'quality',
    max_tokens: 500,
  }),
});

const SCOUT_ENGINE_REQUEST_PATH = '/internal/v1/execute';

function buildEngineRequest(normalizedIntent) {
  const contentLines = [];
  if (normalizedIntent.excerpt) {
    contentLines.push(`Excerpt:\n${normalizedIntent.excerpt}`);
  }
  if (normalizedIntent.summary) {
    contentLines.push(`Summary:\n${normalizedIntent.summary}`);
  }
  if (normalizedIntent.memo) {
    contentLines.push(`Memo:\n${normalizedIntent.memo}`);
  }
  if (normalizedIntent.sourceUrl) {
    contentLines.push(`Source URL (attribution only, do not fetch):\n${normalizedIntent.sourceUrl}`);
  }
  contentLines.push(`Requested language: ${normalizedIntent.requestedLanguage}`);
  contentLines.push(`Desired tone: ${normalizedIntent.desiredTone}`);
  contentLines.push(`Max output length: ${normalizedIntent.maxOutputLength}`);

  return {
    app_id: SERVER_OWNED_ENGINE_IDENTITY.appId,
    agent: { ...SERVER_OWNED_ENGINE_IDENTITY.agent },
    messages: [
      {
        role: 'user',
        content: contentLines.join('\n\n'),
      },
    ],
  };
}

function projectEngineAnswerToScoutOutput(answer) {
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    throw new Error('Engine answer is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Engine answer is not a valid JSON object');
  }

  const expectedKeys = [
    'titleSuggestion',
    'summarySuggestion',
    'translationSuggestion',
    'emotionTags',
    'memoSuggestion',
    'safetyNote',
  ];

  const hasExpectedKey = expectedKeys.some((key) => key in parsed);
  if (!hasExpectedKey) {
    throw new Error('Engine answer does not contain any expected Scout output fields');
  }

  const emotionTags = Array.isArray(parsed.emotionTags)
    ? parsed.emotionTags.slice(0, 4).map((t) => String(t).slice(0, 20))
    : [];

  return {
    titleSuggestion: String(parsed.titleSuggestion || '').slice(0, 50),
    summarySuggestion: String(parsed.summarySuggestion || '').slice(0, 200),
    translationSuggestion: String(parsed.translationSuggestion || '').slice(0, 500),
    emotionTags,
    memoSuggestion: String(parsed.memoSuggestion || '').slice(0, 500),
    safetyNote: String(parsed.safetyNote || '').slice(0, 300),
  };
}

function buildScoutEngineError(code, message) {
  return { ok: false, error: { code, message } };
}

async function callEngineWithBinding({
  binding,
  request,
  callerId,
  credential,
}) {
  if (!binding || typeof binding.fetch !== 'function') {
    return buildScoutEngineError(
      SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_BINDING_MISSING,
      'Engine service binding is not available'
    );
  }

  if (!callerId || !credential) {
    return buildScoutEngineError(
      SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_CREDENTIAL_MISSING,
      'Engine caller identity or credential is not configured'
    );
  }

  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('X-Padiem-Engine-Caller', callerId);
  headers.set('X-Padiem-Engine-Credential', credential);

  let response;
  try {
    response = await binding.fetch(
      `https://padiem-ai-engine.internal${SCOUT_ENGINE_REQUEST_PATH}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }
    );
  } catch {
    return buildScoutEngineError(
      SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_REQUEST_FAILED,
      'Engine request failed'
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return buildScoutEngineError(
      SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_RESPONSE_INVALID,
      'Engine response is not valid JSON'
    );
  }

  if (!response.ok || !body?.ok) {
    const error = body?.error || {};
    const code = error.code || 'ENGINE_REQUEST_FAILED';
    const message = error.message || 'Engine request failed';
    return buildScoutEngineError(code, message);
  }

  try {
    const suggestion = projectEngineAnswerToScoutOutput(body.answer);
    return { ok: true, suggestion };
  } catch (err) {
    return buildScoutEngineError(
      SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_ANSWER_PARSE_FAILED,
      err.message || 'Failed to parse Engine answer'
    );
  }
}

export function createScoutEngineTransport({ env, context }) {
  const binding = env?.PADIEM_AI_ENGINE || null;
  const callerId = String(env?.SCOUT_ENGINE_CALLER_ID || '').trim();
  const credential = String(env?.SCOUT_ENGINE_CREDENTIAL || '').trim();

  if (!binding) {
    return {
      status: 'ENGINE_UNAVAILABLE',
      error: buildScoutEngineError(
        SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_BINDING_MISSING,
        'Engine transport is not configured'
      ),
    };
  }

  if (!callerId || !credential) {
    return {
      status: 'ENGINE_UNAVAILABLE',
      error: buildScoutEngineError(
        SCOUT_ENGINE_TRANSPORT_ERROR_CODES.ENGINE_CREDENTIAL_MISSING,
        'Engine caller identity or credential is not configured'
      ),
    };
  }

  return {
    status: 'READY',
    async suggest(normalizedIntent) {
      const request = buildEngineRequest(normalizedIntent);
      return callEngineWithBinding({
        binding,
        request,
        callerId,
        credential,
      });
    },
  };
}
