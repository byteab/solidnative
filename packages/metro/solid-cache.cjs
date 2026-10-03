const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

function solidCompilerFingerprint() {
  const hash = createHash('sha256');
  for (const file of readdirSync(__dirname)
    .filter((name) => name.endsWith('.cjs') && !name.endsWith('.test.cjs'))
    .sort()) {
    hash.update(file).update(readFileSync(path.join(__dirname, file)));
  }
  for (const name of ['@babel/core', '@babel/plugin-transform-typescript', 'babel-preset-solid']) {
    hash.update(`${name}:${require(`${name}/package.json`).version}`);
  }
  for (const file of readdirSync(path.join(__dirname, 'css'))
    .filter((name) => name.endsWith('.cjs'))
    .sort()) {
    hash.update(`css/${file}`).update(readFileSync(path.join(__dirname, 'css', file)));
  }
  hash.update(
    readFileSync(path.join(path.dirname(require.resolve('lightningcss')), '../package.json')),
  );
  return hash.digest('hex').slice(0, 20);
}

module.exports = { solidCompilerFingerprint };
