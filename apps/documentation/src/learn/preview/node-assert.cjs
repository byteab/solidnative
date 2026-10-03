/**
 * Node's `assert`, as much of it as Babel calls in the page: a CommonJS module, because Babel
 * calls it as a function (`assert(cond)`) as well as by member. Aliased in `vite.config.ts`.
 */
function assert(value, message) {
  if (!value) throw new Error(message ?? 'Assertion failed');
}
assert.ok = assert;
assert.fail = (message) => {
  throw new Error(message);
};
assert.equal = (actual, expected, message) => assert(actual == expected, message);
assert.strictEqual = (actual, expected, message) => assert(actual === expected, message);
module.exports = assert;
