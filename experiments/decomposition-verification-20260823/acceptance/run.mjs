import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const solutionArg = process.argv[2];
if (!solutionArg) throw new Error('solution path argument required');
const solutionUrl = pathToFileURL(path.resolve(solutionArg)).href;
const { adjudicateBatch } = await import(solutionUrl);
assert.equal(typeof adjudicateBatch, 'function');

const clone = (value) => JSON.parse(JSON.stringify(value));

function expectTypeError(fn) {
  assert.throws(fn, TypeError);
}

{
  expectTypeError(() => adjudicateBatch(null));
  expectTypeError(() => adjudicateBatch({}));
}

{
  const input = [
    { id: ' A ', status: 'PASS', evidence: 'ok' },
    { id: 'B', status: 'UNRESOLVED', evidence: 'ignored', required: false },
    { id: 'C', status: 'FAIL', evidence: 'still failed', required: false },
  ];
  const before = clone(input);
  const out = adjudicateBatch(input);
  assert.deepEqual(input, before);
  assert.deepEqual(out.checks.map((c) => c.id), ['A', 'B', 'C']);
  assert.deepEqual(out.checks.map((c) => c.required), [true, false, false]);
  assert.equal(out.overall, 'PASS');
  assert.deepEqual(out.counts, { total: 3, pass: 1, fail: 1, unresolved: 1 });
}

{
  const out = adjudicateBatch([
    { id: 'a', status: 'PASS', evidence: '   ' },
    { id: 'b', status: 'PASS', evidence: 7 },
  ]);
  assert.equal(out.overall, 'UNRESOLVED');
  assert.deepEqual(out.counts, { total: 2, pass: 0, fail: 0, unresolved: 2 });
  assert.deepEqual(out.checks.map((c) => c.reason), ['missing-evidence', 'missing-evidence']);
}

{
  const out = adjudicateBatch([
    { id: 'a', status: 'FAIL', evidence: 'evidence' },
    { id: 'b', status: 'UNRESOLVED', evidence: 'evidence' },
  ]);
  assert.equal(out.overall, 'FAIL');
  assert.deepEqual(out.checks.map((c) => [c.status, c.reason]), [
    ['FAIL', 'failed'],
    ['UNRESOLVED', 'unresolved'],
  ]);
}

{
  const out = adjudicateBatch([
    { id: 'opt-fail', status: 'FAIL', required: false },
    { id: 'req-pass', status: 'PASS', evidence: 'yes' },
  ]);
  assert.equal(out.overall, 'PASS');
  assert.deepEqual(out.counts, { total: 2, pass: 1, fail: 1, unresolved: 0 });
}

{
  assert.equal(adjudicateBatch([]).overall, 'UNRESOLVED');
  assert.equal(adjudicateBatch([
    { id: 'x', status: 'PASS', evidence: 'ok', required: false },
  ]).overall, 'UNRESOLVED');
}

{
  expectTypeError(() => adjudicateBatch([{ id: '   ', status: 'PASS', evidence: 'ok' }]));
  expectTypeError(() => adjudicateBatch([{ id: 2, status: 'PASS', evidence: 'ok' }]));
  expectTypeError(() => adjudicateBatch([
    { id: ' x ', status: 'PASS', evidence: 'ok' },
    { id: 'x', status: 'PASS', evidence: 'ok' },
  ]));
  const caseSensitive = adjudicateBatch([
    { id: 'x', status: 'PASS', evidence: 'ok' },
    { id: 'X', status: 'PASS', evidence: 'ok' },
  ]);
  assert.equal(caseSensitive.overall, 'PASS');
}

{
  expectTypeError(() => adjudicateBatch([{ id: 'x', status: 'pass', evidence: 'ok' }]));
  expectTypeError(() => adjudicateBatch([{ id: 'x', status: 'SKIP', evidence: 'ok' }]));
}

{
  const out = adjudicateBatch([
    { id: 'x', status: 'PASS', evidence: 'ok', required: 0 },
  ]);
  assert.equal(out.checks[0].required, true);
  assert.equal(out.overall, 'PASS');
}

console.log('ACCEPTANCE_PASS');
