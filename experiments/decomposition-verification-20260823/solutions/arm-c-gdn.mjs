export function adjudicateBatch(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError('checks must be an array');
  }

  const seenIds = new Set();

  const normalizedChecks = checks.map((check) => {
    if (check === null || typeof check !== 'object') {
      throw new TypeError('each check must be an object');
    }

    if (typeof check.id !== 'string') {
      throw new TypeError('check id must be a string');
    }

    const id = check.id.trim();
    if (id.length === 0) {
      throw new TypeError('check id must be non-empty after trimming');
    }

    if (seenIds.has(id)) {
      throw new TypeError('duplicate check id');
    }
    seenIds.add(id);

    if (
      check.status !== 'PASS' &&
      check.status !== 'FAIL' &&
      check.status !== 'UNRESOLVED'
    ) {
      throw new TypeError('invalid check status');
    }

    const required = check.required === false ? false : true;

    let status = check.status;
    let reason;

    if (status === 'PASS') {
      const hasEvidence =
        typeof check.evidence === 'string' && /\S/.test(check.evidence);

      if (hasEvidence) {
        reason = 'accepted';
      } else {
        status = 'UNRESOLVED';
        reason = 'missing-evidence';
      }
    } else if (status === 'FAIL') {
      reason = 'failed';
    } else {
      reason = 'unresolved';
    }

    return { id, status, required, reason };
  });

  const counts = {
    total: normalizedChecks.length,
    pass: 0,
    fail: 0,
    unresolved: 0,
  };

  for (const check of normalizedChecks) {
    if (check.status === 'PASS') counts.pass += 1;
    else if (check.status === 'FAIL') counts.fail += 1;
    else counts.unresolved += 1;
  }

  const requiredChecks = normalizedChecks.filter((check) => check.required);

  let overall;
  if (requiredChecks.length === 0) {
    overall = 'UNRESOLVED';
  } else if (requiredChecks.some((check) => check.status === 'FAIL')) {
    overall = 'FAIL';
  } else if (requiredChecks.some((check) => check.status === 'UNRESOLVED')) {
    overall = 'UNRESOLVED';
  } else {
    overall = 'PASS';
  }

  return {
    overall,
    counts,
    checks: normalizedChecks,
  };
}
