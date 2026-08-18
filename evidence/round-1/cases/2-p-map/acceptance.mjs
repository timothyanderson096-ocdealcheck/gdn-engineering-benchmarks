import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.mjs <worktree>');
const {pMapIterable} = await import(pathToFileURL(path.join(target, 'index.js')));

const resolvers = [];
const inputs = [0, 1, 2].map(index => new Promise(resolve => {
	resolvers[index] = resolve;
}));
const output = [];
const collecting = (async () => {
	for await (const item of pMapIterable(inputs, async (value, index) => [value, index], {concurrency: 3})) {
		output.push(item);
	}
})();
await new Promise(resolve => setImmediate(resolve));
resolvers[1]('b');
await Promise.resolve();
resolvers[2]('c');
await Promise.resolve();
resolvers[0]('a');
await collecting;
assert.deepEqual(output, [['a', 0], ['b', 1], ['c', 2]]);
console.log('PASS: mapper indices follow input order despite out-of-order promise settlement');
