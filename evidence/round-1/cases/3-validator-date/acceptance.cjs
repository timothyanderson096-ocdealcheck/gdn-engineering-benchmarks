const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.cjs <worktree>');
const register = require.resolve('@babel/register', {paths: [target]});
const program = `
const assert = require('node:assert/strict');
const isDate = require('./src/lib/isDate').default;
for (const input of ['2024-05', '2024-05-01-abc', '2024-05-01-']) {
  assert.doesNotThrow(() => isDate(input), input + ' must not throw');
  assert.equal(isDate(input), false, input + ' must be rejected');
}
assert.equal(isDate('2024-05-01'), true, 'valid date must remain accepted');
console.log('PASS: malformed dates return false without throwing; valid date remains accepted');`;
const result = spawnSync(process.execPath, ['-r', register, '-e', program], {
	cwd: target,
	encoding: 'utf8',
	env: {...process.env, BABEL_DISABLE_CACHE: '1'},
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
