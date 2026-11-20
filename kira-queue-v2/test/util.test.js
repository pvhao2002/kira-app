import test from 'node:test';
import assert from 'node:assert/strict';
import { numberValue, parseDouble, asArray } from '../src/util.js';

test('numberValue: Java Integer.parseInt / asInt semantics', () => {
  assert.equal(numberValue('+5'), 5);
  assert.equal(numberValue('-7'), -7);
  assert.equal(numberValue('1.5'), null);
  assert.equal(numberValue('abc'), null);
  assert.equal(numberValue('2147483647'), 2147483647);
  assert.equal(numberValue('99999999999'), null);
  assert.equal(numberValue(3.9), 3);
  assert.equal(numberValue(null), null);
  assert.equal(numberValue(true), null);
});

test('parseDouble: null when unparsable', () => {
  assert.equal(parseDouble('1.95'), 1.95);
  assert.equal(parseDouble(' -0.5 '), -0.5);
  assert.equal(parseDouble('abc'), null);
  assert.equal(parseDouble(null), null);
});

test('asArray: object becomes its values, scalars empty', () => {
  assert.deepEqual(asArray({ a: 1, b: 2 }), [1, 2]);
  assert.deepEqual(asArray('x'), []);
  assert.deepEqual(asArray(null), []);
});
