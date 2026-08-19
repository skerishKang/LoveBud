// #4116 owner Tree list query-limit parity helper.
export function hasFractionalOwnerTreeLimit(rawLimit, defaultLimit = 100) {
  const numeric = Number(rawLimit || defaultLimit);
  return Number.isFinite(numeric) && !Number.isInteger(numeric);
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
