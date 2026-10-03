/**
 * Record what a real browser does with the differential cases, and commit it as a fixture.
 *
 * The browser is the oracle for specificity, inheritance and custom-property resolution, which is
 * where a hand-written expectation is most likely to enshrine a misreading of the spec. It is
 * consulted here, once, rather than during the tests: `npm test` stays pure `node --test` with no
 * browser to install and no extra second on every run.
 *
 * No dependency either. Chrome's `--dump-dom` prints the DOM after scripts have run, so the page
 * computes the answers and writes them into the body for this to read back.
 *
 *   node scripts/generate-css-oracle.mjs
 *
 * Re-run it when cases are added, and commit the fixture alongside them. It records two
 * fixtures: `css-oracle.json` for the hand-written cases and `css-corpus-oracle.json` for the
 * cases drawn from real libraries (`fixtures/css-corpus.ts`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, PROPERTIES } from '../fixtures/css-oracle-cases.ts';
import { CORPUS_CASES, CORPUS_PROPERTIES, HEIGHT, source } from '../fixtures/css-corpus.ts';

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function render(node) {
  const attrs = [
    node.id ? ` id="${node.id}"` : '',
    node.classes?.length ? ` class="${node.classes.join(' ')}"` : '',
    ...Object.entries(node.attrs ?? {}).map(([k, v]) => ` ${k}="${v}"`),
  ].join('');
  const children = (node.children ?? []).map(render).join('');
  return `<${node.name}${attrs}>${children}</${node.name}>`;
}

/**
 * One document per case. They share class names deliberately, so a single page would let every
 * case's rules match every other case's probe, and the whole suite would quietly measure the
 * wrong thing.
 */
function pageFor(test) {
  return `<!doctype html><meta charset="utf-8">
<style>${test.css}</style>
${render(test.tree)}
<script>
  const el = document.getElementById('probe');
  const style = getComputedStyle(el);
  const values = {};
  for (const property of ${JSON.stringify(PROPERTIES)}) values[property] = style.getPropertyValue(property);
  document.body.textContent = 'RESULT:' + JSON.stringify(values);
</script>`;
}

const dir = mkdtempSync(join(tmpdir(), 'css-oracle-'));

const chrome = CHROME.find((path) => {
  try {
    execFileSync(path, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});
if (!chrome) throw new Error(`no Chrome found; looked in:\n  ${CHROME.join('\n  ')}`);

const fixture = CASES.map((test, i) => {
  const file = join(dir, `case-${i}.html`);
  writeFileSync(file, pageFor(test));
  const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--dump-dom', file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const match = dom.match(/RESULT:(\{.*?\})</s);
  if (!match) throw new Error(`case "${test.name}" reported nothing; did Chrome run its scripts?`);
  return { name: test.name, expected: JSON.parse(match[1]) };
});
const target = fileURLToPath(new URL('../fixtures/css-oracle.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`recorded ${fixture.length} cases from ${chrome.split('/').pop()} into ${target}`);

/**
 * The corpus cases: a real library's stylesheet, a tree wearing its classes, one viewport width.
 *
 * `view` and `text` are rendered as `div` and `span` here, because these stylesheets style real
 * elements - a reset that says `div` or `span` should reach the probe exactly as it would in an
 * app - and an unknown element would dodge every one of those rules.
 */
const ELEMENT = { view: 'div', text: 'span' };

function renderHtml(node) {
  const name = ELEMENT[node.name] ?? node.name;
  const attrs = [
    node.id ? ` id="${node.id}"` : '',
    node.classes?.length ? ` class="${node.classes.join(' ')}"` : '',
    ...Object.entries(node.attrs ?? {}).map(([k, v]) => ` ${k}="${v}"`),
  ].join('');
  return `<${name}${attrs}>${(node.children ?? []).map(renderHtml).join('')}</${name}>`;
}

/** The probe's own classes and attributes, which the control measurement takes away. */
function probeOf(node) {
  if (node.id === 'probe') return node;
  for (const child of node.children ?? []) {
    const found = probeOf(child);
    if (found) return found;
  }
  return null;
}

/**
 * Two measurements per case: the probe as written, then the same element with its own classes
 * and attributes removed. The second is what the element would be without the library's help -
 * the user-agent sheet, the resets and whatever it inherits - so comparing the two says which
 * properties the classes under test actually set.
 */
function corpusPage(test) {
  const attrs = Object.keys(probeOf(test.tree).attrs ?? {});
  // The script waits in the head, so the tree is all the body holds: a script after it would be a
  // sibling, and a library's `:last-child` rules would not see the probe as the last child.
  return `<!doctype html><meta charset="utf-8">
<style>${source(test.library)}</style>
<script>
addEventListener('DOMContentLoaded', () => {
  // A colour from a wider space (Tailwind's are all oklch) is reported in that space, which says
  // nothing a device can compare against. What the browser paints for it in sRGB is read back
  // off a canvas instead, and marked with a '~': a converted colour can be a unit off per channel.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const alpha = (byte) => {
    const two = Math.round((byte / 255) * 100) / 100;
    return Math.round(two * 255) === byte ? two : Math.round((byte / 255) * 1000) / 1000;
  };
  const srgb = (colour) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = colour;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return a === 255 ? '~rgb(' + [r, g, b].join(', ') + ')' : '~rgba(' + [r, g, b, alpha(a)].join(', ') + ')';
  };
  const WIDE = /(?:oklch|oklab|lab|lch|color)\\([^)]*\\)/g;
  const el = document.getElementById('probe');
  const read = () => {
    const style = getComputedStyle(el);
    const values = {};
    for (const property of ${JSON.stringify(CORPUS_PROPERTIES)}) {
      values[property] = style.getPropertyValue(property).replace(WIDE, srgb);
    }
    return values;
  };
  const probe = read();
  el.removeAttribute('class');
  for (const name of ${JSON.stringify(attrs)}) el.removeAttribute(name);
  const control = read();
  document.body.textContent = 'RESULT:' + JSON.stringify({ probe, control });
});
</script>
<body>${renderHtml(test.tree)}</body>`;
}

const corpus = CORPUS_CASES.map((test, i) => {
  const file = join(dir, `corpus-${i}.html`);
  writeFileSync(file, corpusPage(test));
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${test.width},${HEIGHT}`,
      '--dump-dom',
      file,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*?\}\})</s);
  if (!match) throw new Error(`corpus case "${test.name}" reported nothing`);
  return { library: test.library, name: test.name, width: test.width, ...JSON.parse(match[1]) };
});
const corpusTarget = fileURLToPath(new URL('../fixtures/css-corpus-oracle.json', import.meta.url));
writeFileSync(corpusTarget, `${JSON.stringify(corpus, null, 2)}\n`);
console.log(`recorded ${corpus.length} corpus cases into ${corpusTarget}`);
