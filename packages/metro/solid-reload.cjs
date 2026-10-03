/** Insert only into a native development AST that Metro will wrap in a module factory. */
const babel = require('@babel/core');

function addSolidReloadBoundary(ast, filename) {
  const guard = babel.parseSync(
    `if (!require('@solidnative/metro/solid-reload-runtime.cjs').registerModule(
      module,
      require('@solidnative/platform/solid/dev-reload'),
      function(reason) { require('react-native').DevSettings.reload(reason); },
      ${JSON.stringify(filename)}
    )) return;`,
    { babelrc: false, configFile: false, parserOpts: { allowReturnOutsideFunction: true } },
  ).program.body[0];
  // Metro's import/export pass hoists imports. This must run before even those imports,
  // so a replacement never evaluates new dependencies in a VM already pending reload.
  guard._blockHoist = 1000;
  // Generated boundaries have no authored source location.
  (function clearLocations(node) {
    if (!node || typeof node !== 'object') return;
    delete node.loc;
    delete node.start;
    delete node.end;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(clearLocations);
      else clearLocations(value);
    }
  })(guard);
  ast.program.body.unshift(guard);
  return ast;
}

module.exports = { addSolidReloadBoundary };
