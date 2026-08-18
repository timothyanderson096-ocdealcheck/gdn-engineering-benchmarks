const assert = require('node:assert/strict');
const path = require('node:path');

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.cjs <worktree>');
const {Command} = require(path.join(target, 'index.js'));

function parseValue(value) {
	const program = new Command()
		.exitOverride()
		.configureOutput({writeErr: () => {}})
		.argument('<value>');
	program.parse(['node', 'acceptance', value]);
	return program.args[0];
}

for (const value of ['-1E3', '-1E+3', '-1E-3', '-1.2E3', '-.5E2']) {
	assert.equal(parseValue(value), value);
}
for (const value of ['-1E', '-1E3x']) {
	assert.throws(() => parseValue(value), error => error?.code === 'commander.unknownOption');
}
console.log('PASS: uppercase scientific-notation negatives are arguments; malformed forms remain options');
