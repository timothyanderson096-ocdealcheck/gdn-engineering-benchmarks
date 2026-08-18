import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.mjs <worktree>');
const queryString = (await import(pathToFileURL(path.join(target, 'index.js')))).default;

const single = queryString.parse('foo=a%7Cb', {
	arrayFormat: 'separator',
	arrayFormatSeparator: '|',
});
assert.equal(single.foo, 'a|b');
assert.equal(Array.isArray(single.foo), false);

const multiple = queryString.parse('foo=a%7Cb|c%7Cd', {
	arrayFormat: 'separator',
	arrayFormatSeparator: '|',
});
assert.deepEqual([...multiple.foo], ['a|b', 'c|d']);
console.log('PASS: encoded separators remain data; literal separators define array boundaries');
