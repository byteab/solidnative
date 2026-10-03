/**
 * Record what Chrome does with every case of the Tailwind sweep, and commit it as a fixture.
 *
 *   node scripts/generate-tailwind-oracle.mjs
 *
 * The same stylesheet the sweep compiles - the native preset's build of every case - goes into a
 * page per world (see `WORLDS`), with each case on an element of its own beside a control that has
 * no classes. What the browser computes for a case, where it differs from the control, is what the
 * classes set, and `tailwind-sweep.test.ts` holds the engine to it. In the base world each case
 * also has a child, whose difference from the control's child is what the classes hand down.
 *
 * Each case sits in a wrapper of its own, so `first:`, `odd:` and the other structural variants see
 * the same tree the engine is given. The elements sit inside a `display: none` box: a rendered
 * element reports some properties as laid out - a `width: 50%` as the pixels it came to - and the
 * engine is compared on what the cascade gave, before layout. A transform is the exception, read
 * off a rendered twin of each case, because an unrendered element reports none whatever it has.
 *
 * Re-run it when the sweep's cases change: a Tailwind upgrade, or a case added to the sweep.
 * `TAILWIND_SWEEP=v3` records Tailwind 3's sweep (`tailwind-v3-sweep.test.ts`) instead.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE } from '../layout.ts';
import {
  ROOT_CLASSES,
  ROOT_CSS,
  MOTION_POINTS,
  STATE_ATTRIBUTES,
  STATE_CLASSES,
  TRANSFORM_BOX,
  VIEWPORT,
} from '../fixtures/tailwind-sweep.ts';

const V3 = process.env.TAILWIND_SWEEP === 'v3';
const source = await import(
  V3 ? '../fixtures/tailwind-v3-sweep.ts' : '../fixtures/tailwind-sweep.ts'
);
const { buildFor, sweep, WORLDS, measuredIn } = source;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const chrome = CHROME.find((path) => {
  try {
    execFileSync(path, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});
if (!chrome) throw new Error(`no Chrome found; looked in:\n  ${CHROME.join('\n  ')}`);

const { css, cases } = await sweep();
// A web app's Tailwind has its preflight, which gives every element the defaults native starts
// from: no margin, a zero-width solid border. Without it, `border-dashed` alone would be a 3px
// border here, where it is none in any real app.
const preflight = V3
  ? await source.preflight()
  : readFileSync(createRequire(import.meta.url).resolve('tailwindcss/preflight.css'), 'utf8');
/** The rendered twins' box: fixed, so a percentage in a translate is the same pixels on both sides. */
const BOX = `position: absolute; width: ${TRANSFORM_BOX}px; height: ${TRANSFORM_BOX}px`;
const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const STATES = Object.entries(STATE_ATTRIBUTES)
  .map(([name, value]) => (value ? ` ${name}="${value}"` : ` ${name}`))
  .join('');

/** One case's elements: in a wrapper, under a `.group` with a `.peer` before it in the states world. */
function element(world, test, attributes) {
  const classes = escape(test.classes.join(' '));
  const own = `${attributes}${world.states ? STATES : ''}`;
  // A sibling after the child, so `space-*` and `divide-*`, which skip the last child, reach it.
  const child = world.name === 'base' ? '<span data-child></span><span></span>' : '';
  // On the web host a view is marked as `@solidnative/web` marks the elements it creates, which is
  // what its reset applies to: React Native's flex and border defaults.
  const rn = world.name === 'web' ? ' data-rn="view"' : '';
  const node = `<div class="${classes}"${own}${rn}>${child}</div>`;
  if (!world.states) return `<div${rn}>${node}</div>`;
  const ancestor = ['group', ...STATE_CLASSES].join(' ');
  return `<div class="${ancestor}"${STATES}><div class="peer"${STATES}></div>${node}</div>`;
}

/**
 * The web host's reset, in Tailwind's `base` layer as `mount` injects it: the web world is the
 * page a component is on in `@solidnative/web`, which has this and not preflight.
 */
const reset = readFileSync(
  fileURLToPath(new URL('../../web/src/reset.css', import.meta.url)),
  'utf8',
);
const webCss = WORLDS.some((world) => world.name === 'web') ? await buildFor(cases, 'web') : '';

function page(world, inWorld) {
  const shown = (test) => element(world, test, ` data-shown="${escape(test.name)}" style="${BOX}"`);
  const styles =
    world.name === 'web'
      ? `@layer theme, base, components, utilities;\n@layer base { ${reset} }\n${webCss}`
      : `@layer base { ${preflight} }\n${css}`;
  return `<!doctype html><meta charset="utf-8">
<style>${styles}\n${ROOT_CSS}</style>
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
  const control = document.querySelector('[data-case="(control)"]');
  const properties = [...getComputedStyle(control)].filter((name) => !name.startsWith('--'));
  const read = (el) => {
    const style = getComputedStyle(el);
    return Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
  };
  const diff = (el, from) => {
    const now = read(el);
    const out = {};
    for (const name of properties) {
      if (name !== 'transform' && now[name] !== from[name]) out[name] = now[name].replace(WIDE, srgb);
    }
    return out;
  };
  const before = read(control);
  const childBefore = control.querySelector('[data-child]') && read(control.querySelector('[data-child]'));
  const flat = getComputedStyle(document.querySelector('[data-shown="(control)"]')).transform;
  const cases = {};
  const children = {};
  for (const el of document.querySelectorAll('[data-case]')) {
    const name = el.dataset.case;
    if (name === '(control)') continue;
    const own = diff(el, before);
    const shown = getComputedStyle(document.querySelector('[data-shown="' + CSS.escape(name) + '"]')).transform;
    if (shown !== flat) own.transform = shown;
    cases[name] = own;
    const child = el.querySelector('[data-child]');
    if (child) children[name] = diff(child, childBefore);
  }
  const out = { viewport: { width: innerWidth, height: innerHeight }, control: before, cases };
  if (childBefore) out.children = children;
  document.body.textContent = 'RESULT:' + JSON.stringify(out);
});
</script>
<body><div class="${world.rootClasses}" style="display: none">${[
    element(world, { name: '(control)', classes: [] }, ' data-case="(control)"'),
    ...inWorld.map((test) => element(world, test, ` data-case="${escape(test.name)}"`)),
  ].join('')}</div><div class="${world.rootClasses}" style="visibility: hidden">${[
    shown({ name: '(control)', classes: [] }),
    ...inWorld.map(shown),
  ].join('')}</div></body>`;
}

/**
 * Where each case's boxes land, in `layout.ts`'s scene, on the web host: `@solidnative/web`'s reset
 * in Tailwind's `base` layer, as `mount` injects it, under the same utilities. Only a case whose
 * boxes differ from the control scene's is recorded, so every other case is held to the control.
 */
function layoutWorld() {
  const sized = ({ width, height }) => `style="width: ${width}px; height: ${height}px"`;
  const scene = (name, classes) =>
    `<div data-rn="view" data-scene="${escape(name)}" ${sized(SCENE.container)}>` +
    `<div data-rn="view" ${sized(SCENE.before)}></div>` +
    `<div data-rn="view" class="${escape(classes)}">` +
    SCENE.inside.map((size) => `<div data-rn="view" ${sized(size)}></div>`).join('') +
    `</div><div data-rn="view" ${sized(SCENE.after)}></div></div>`;
  const inWorld = cases.filter((test) => test.kind !== 'variant');
  const html = `<!doctype html><meta charset="utf-8">
<style>@layer theme, base, components, utilities;\n@layer base { ${reset} }\n${css}\n${ROOT_CSS}
/* A transform moves what is painted and not the layout box, and is compared on its own. */
[data-rn] { transform: none !important; translate: none !important; rotate: none !important; scale: none !important }
/* Native has no scrollbar that takes up room; a desktop browser's would narrow the box. */
* { scrollbar-width: none !important }</style>
<script>
addEventListener('DOMContentLoaded', () => {
  const round = (n) => Math.round(n * 100) / 100;
  const boxes = (scene) => {
    const origin = scene.getBoundingClientRect();
    const [before, target, after] = scene.children;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [round(r.left - origin.left), round(r.top - origin.top), round(r.width), round(r.height)];
    };
    return [box(target), box(before), box(after), ...[...target.children].map(box)];
  };
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const control = boxes(scenes[0]);
  const cases = {};
  for (const scene of scenes.slice(1)) {
    const measured = boxes(scene);
    if (JSON.stringify(measured) !== JSON.stringify(control)) cases[scene.dataset.scene] = measured;
  }
  document.body.textContent = 'RESULT:' + JSON.stringify({ viewport: { width: innerWidth, height: innerHeight }, control, cases });
});
</script>
<body><div class="${ROOT_CLASSES}">${[
    scene('(control)', ''),
    ...inWorld.map((test) => scene(test.name, test.classes.join(' '))),
  ].join('')}</div></body>`;
  const file = join(mkdtempSync(join(tmpdir(), 'tailwind-oracle-')), 'layout.html');
  writeFileSync(file, html);
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--dump-dom',
      file,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 512 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*\})/s);
  if (!match) throw new Error('the layout page reported nothing; did Chrome run its script?');
  const layout = JSON.parse(
    match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
  );
  console.log(`layout: ${Object.keys(layout.cases).length} of ${inWorld.length} cases move a box`);
  return layout;
}

/**
 * Every animated case, paused at points through its first cycle: the transform and the opacity it
 * paints there. Read off the animation Chrome is running, so each keyframe's own easing, the
 * animation's easing and the implicit frames are all as a browser plays them.
 */
function motionWorld() {
  const animated = cases.filter(
    (test) => test.kind !== 'variant' && test.classes.some((name) => /(^|:)animate-/.test(name)),
  );
  const html = `<!doctype html><meta charset="utf-8">
<style>@layer base { ${preflight} }\n${css}\n${ROOT_CSS}</style>
<script>
addEventListener('DOMContentLoaded', () => {
  const out = {};
  for (const el of document.querySelectorAll('[data-motion]')) {
    const [animation] = el.getAnimations();
    if (!animation) continue;
    animation.pause();
    const duration = animation.effect.getTiming().duration;
    out[el.dataset.motion] = { duration, frames: ${JSON.stringify(MOTION_POINTS)}.map((at) => {
      animation.currentTime = at * duration;
      const style = getComputedStyle(el);
      return { at, transform: style.transform, opacity: style.opacity };
    }) };
  }
  document.body.textContent = 'RESULT:' + JSON.stringify(out);
});
</script>
<body><div class="${ROOT_CLASSES}">${animated
    .map(
      (test) =>
        `<div><div data-motion="${escape(test.name)}" class="${escape(test.classes.join(' '))}" style="${BOX}"></div></div>`,
    )
    .join('')}</div></body>`;
  const file = join(mkdtempSync(join(tmpdir(), 'tailwind-oracle-')), 'motion.html');
  writeFileSync(file, html);
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--dump-dom',
      file,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*\})/s);
  if (!match) throw new Error('the motion page reported nothing; did Chrome run its script?');
  const motion = JSON.parse(
    match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
  );
  console.log(`motion: ${Object.keys(motion).length} of ${animated.length} animated cases play`);
  return motion;
}

const recorded = {};
for (const world of WORLDS) {
  const inWorld = world.name === 'base' || world.name === 'web' ? cases : measuredIn(world, cases);
  const file = join(mkdtempSync(join(tmpdir(), 'tailwind-oracle-')), `${world.name}.html`);
  writeFileSync(file, page(world, inWorld));
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${world.width},${VIEWPORT.height}`,
      '--dump-dom',
      file,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 512 * 1024 * 1024 },
  );
  const match = dom.match(/RESULT:(\{.*\})/s);
  if (!match)
    throw new Error(`the ${world.name} page reported nothing; did Chrome run its script?`);
  recorded[world.name] = JSON.parse(
    match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
  );
  console.log(`${world.name}: ${Object.keys(recorded[world.name].cases).length} cases`);
}

recorded.layout = layoutWorld();
recorded.motion = motionWorld();

const target = fileURLToPath(
  new URL(
    `../fixtures/${V3 ? 'tailwind-v3-sweep' : 'tailwind-sweep'}-oracle.json`,
    import.meta.url,
  ),
);
writeFileSync(target, `${JSON.stringify(recorded)}\n`);
console.log(`recorded from ${chrome.split('/').pop()}`);
