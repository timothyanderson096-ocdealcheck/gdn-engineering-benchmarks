export function adjudicateBatch(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError('checks must be an array');
  }

  const seenIds = new Set();
  const normalized = [];
  const counts = { total: 0, pass: 0, fail: 0, unresolved: 0 };

  for (const check of checks) {
    const id = typeof check?.id === 'string' ? check.id.trim() : '';
    if (!id) {
      throw new TypeError('check id must be a non-empty string');
    }
    if (seenIds.has(id)) {
      throw new TypeError(`duplicate check id: ${id}`);
    }
    seenIds.add(id);

    if (check.status !== 'PASS' && check.status !== 'FAIL' && check.status !== 'UNRESOLVED') {
      throw new TypeError(`invalid status for ${id}`);
    }

    const required = check.required !== false;
    let status;
    let reason;

    if (check.status === 'PASS') {
      if (typeof check.evidence === 'string' && check.evidence.trim().length > 0) {
        status = 'PASS';
        reason = 'accepted';
      } else {
        status = 'UNRESOLVED';
        reason = 'missing-evidence';
      }
    } else if (check.status === 'FAIL') {
      status = 'FAIL';
      reason = 'failed';
    } else {
      status = 'UNRESOLVED';
      reason = 'unresolved';
    }

    normalized.push({ id, status, required, reason });
    counts.total += 1;
    if (status === 'PASS') counts.pass += 1;
    else if (status === 'FAIL') counts.fail += 1;
    else counts.unresolved += 1;
  }

  const requiredChecks = normalized.filter((check) => check.required);
  let overall = 'UNRESOLVED';

  if (requiredChecks.length > 0) {
    if (requiredChecks.some((check) => check.status === 'FAIL')) {
      overall = 'FAIL';
    } else if (requiredChecks.some((check) => check.status === 'UNRESOLVED')) {
      overall = 'UNRESOLVED';
    } else {
      overall = 'PASS';
    }
  }

  return { overall, counts, checks: normalized };
}
