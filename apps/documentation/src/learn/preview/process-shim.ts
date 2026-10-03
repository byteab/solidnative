/**
 * The `process` global Babel reads while it loads (`process.env`, `process.cwd()`). Imported
 * before `@babel/core`, which is why it is a module of its own: imports run in order. In Node it
 * changes nothing.
 */
const scope = globalThis as { process?: unknown };
scope.process ??= { env: {}, cwd: () => '/', platform: 'browser', version: '', versions: {} };
