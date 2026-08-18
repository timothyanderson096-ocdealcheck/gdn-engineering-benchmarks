import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.mjs <worktree>');
const cliTruncate = (await import(pathToFileURL(path.join(target, 'index.js')))).default;
const stringWidth = (await import(pathToFileURL(path.join(target, 'node_modules/string-width/index.js')))).default;
const text = 'unicorns are awesome dragons here today';

assert.equal(cliTruncate(text, 6, {position: 'end', preferTruncationOnSpace: true, truncationCharacter: '...'}), 'uni...');
assert.equal(cliTruncate(text, 6, {position: 'start', preferTruncationOnSpace: true, truncationCharacter: '...'}), '...day');
for (const position of ['start', 'end']) {
	for (let columns = 4; columns <= 20; columns++) {
		const result = cliTruncate(text, columns, {position, preferTruncationOnSpace: true, truncationCharacter: '...'});
		assert.ok(stringWidth(result) <= columns, `${position} width ${stringWidth(result)} exceeds ${columns}: ${result}`);
	}
}
console.log('PASS: word-aware start/end truncation reserves the custom marker width');
