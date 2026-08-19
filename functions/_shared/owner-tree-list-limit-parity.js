// #4116 owner Tree list query-limit parity helper.
// The existing Cloudflare→Modal path coerces/clamps first, then FastAPI parses
// the forwarded value as an integer. Only a finite fractional value that
// survives the 1..200 clamp reaches FastAPI as fractional input.
export function hasFractionalOwnerTreeLimit(rawLimit, defaultLimit = 100) {
  const numeric = Number(rawLimit || defaultLimit) || defaultLimit;
  const clamped = Math.min(Math.max(numeric, 1), 200);
  return Number.isFinite(clamped) && !Number.isInteger(clamped);
}

export function buildIntegerLimitValidationBody(rawLimit) {
  return {
    detail: [{
      type: 'int_parsing',
      loc: ['query', 'limit'],
      msg: 'Input should be a valid integer, unable to parse string as an integer',
      input: String(rawLimit)
    }]
  };
}
