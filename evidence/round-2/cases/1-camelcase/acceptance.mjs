import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const target = process.argv[2];
assert.ok(target, 'usage: node acceptance.mjs <worktree>');
const camelCase = (await import(pathToFileURL(path.join(target, 'index.js')))).default;

assert.equal(camelCase('b2b_registration_request'), 'b2bRegistrationRequest');
assert.equal(camelCase('b2b-registration-request'), 'b2bRegistrationRequest');
assert.equal(camelCase('b2b_registration_b2b_request'), 'b2bRegistrationB2bRequest');
assert.equal(camelCase('foo2bar_baz'), 'foo2barBaz');
assert.equal(camelCase('b2b_registration_request', {pascalCase: true}), 'B2bRegistrationRequest');
console.log('PASS: numeric identifiers remain correctly cased across word separators');
