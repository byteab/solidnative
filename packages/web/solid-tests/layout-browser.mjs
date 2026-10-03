/**
 * What a style and an event resolve to in a real Chromium, which jsdom cannot answer: it lays
 * nothing out, loads no Tailwind, never matches `:active`/`:hover`, has no colour scheme to change,
 * and dispatches whatever event a test builds rather than what the browser would send.
 *
 * The page is `browser-page/` served by the real Vite preset (`solidNativeWeb()` plus Tailwind);
 * each check calls `window.show(name)` to mount one fixture through `mount`. Playwright drives real
 * mouse, keyboard, wheel, viewport and colour-scheme input. Uses the installed Chrome; it never
 * downloads one.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { solidNativeWeb } from '../solid-vite.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const cache = mkdtempSync(path.join(tmpdir(), 'solid-native-web-layout-cache-'));
let server, browser, page;
const errors = [];

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('./browser-page/', import.meta.url)),
    configFile: false,
    logLevel: 'warn',
    plugins: [...solidNativeWeb(), tailwindcss()],
    cacheDir: cache,
    server: { host: '127.0.0.1', port: 0, fs: { allow: [workspace] } },
  });
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => typeof window.show === 'function');
});

after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(cache, { recursive: true, force: true });
  assert.deepEqual(errors, [], 'no page errors');
});

/** Mount a fixture at a viewport, then let measurement-driven work land (three frames). */
async function show(name, { width = 1200, asAnAppMounts = false } = {}) {
  await page.mouse.up();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width, height: 800 });
  await page.evaluate(([n, a]) => window.show(n, { asAnAppMounts: a }), [name, asAnAppMounts]);
  await settle();
}
const settle = () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  );
const css = (selector, property, pseudo = null) =>
  page.$eval(selector, (el, [p, s]) => getComputedStyle(el, s)[p], [property, pseudo]);
const box = (selector) =>
  page.$eval(selector, (el) => {
    const { left, top, right, bottom, width, height } = el.getBoundingClientRect();
    return { left, top, right, bottom, width, height };
  });
const waitFor = (predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 2000 });
const log = () => page.evaluate(() => window.current.log());

describe('viewport width', () => {
  it('flips a md: media query when the window crosses the breakpoint', async () => {
    await show('breakpoints', { width: 700 });
    const row = '[id="layout"] > [data-rn="view"]';
    assert.equal(await css(row, 'flexDirection'), 'column');
    await page.setViewportSize({ width: 900, height: 800 });
    await waitFor((s) => getComputedStyle(document.querySelector(s)).flexDirection === 'row', row);
  });
});

describe('resolved styles', () => {
  it('gives a hairline border a real width and a solid style', async () => {
    await show('textFields');
    assert.equal(await css('#plain', 'borderTopStyle'), 'solid');
    const width = parseFloat(await css('#plain', 'borderTopWidth'));
    assert.ok(width > 0 && width <= 2, `hairline, got ${width}`);
  });

  it("draws a text field in the page's text styles, with none of a textarea's chrome", async () => {
    await show('textFields');
    const field = '#plain textarea';
    assert.equal(await css(field, 'fontFamily'), await css('body', 'fontFamily'));
    assert.equal(await css(field, 'fontSize'), '14px');
    assert.equal(await css(field, 'paddingTop'), '0px');
    assert.equal(await css(field, 'paddingLeft'), '0px');
    assert.equal(await css(field, 'borderTopWidth'), '0px');
    assert.equal(await css(field, 'resize'), 'none');
  });

  it('draws an unstyled placeholder fainter than the text', async () => {
    await show('textFields');
    const field = '#plain textarea';
    assert.notEqual(await css(field, 'color', '::placeholder'), await css(field, 'color'));
  });

  it('changes the border colour when the field takes focus', async () => {
    await show('textFields');
    const resting = await css('#plain', 'borderTopColor');
    await page.focus('#plain textarea');
    await waitFor(
      (r) => getComputedStyle(document.getElementById('plain')).borderTopColor !== r,
      resting,
    );
  });

  it('dims a disabled button, through the attribute the variant keys off', async () => {
    await show('button');
    assert.equal(parseFloat(await css('#trigger', 'opacity')), 1);
    await page.evaluate(() => window.current.setDisabled(true));
    await waitFor(
      () => parseFloat(getComputedStyle(document.getElementById('trigger')).opacity) <= 0.501,
    );
    assert.ok(Math.abs(parseFloat(await css('#trigger', 'opacity')) - 0.5) < 0.01);
  });
});

describe('a pressable, from a mouse and the keyboard', () => {
  it('presses on the primary button and not on a right click', async () => {
    await show('events');
    await page.click('#button', { button: 'right' });
    await settle();
    assert.deepEqual(await log(), []);
    await page.click('#button');
    await waitFor(() => window.current.log().includes('pressOut'));
    assert.deepEqual(await log(), ['pressIn', 'press', 'pressOut']);
  });

  it('presses on Enter, the way a focused button does', async () => {
    await show('events');
    await page.focus('#button');
    await page.keyboard.press('Enter');
    await waitFor(() => window.current.log().includes('pressOut'));
    assert.deepEqual(await log(), ['pressIn', 'press', 'pressOut']);
  });

  it('presses on Space when the key comes up, and holds the press while it is down', async () => {
    await show('events');
    await page.focus('#button');
    await page.keyboard.down('Space');
    await settle();
    assert.deepEqual(await log(), ['pressIn']);
    // Held past minPressDuration (130ms), so pressOut fires on release ahead of press.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.keyboard.up('Space');
    await waitFor(() => window.current.log().includes('press'));
    assert.deepEqual(await log(), ['pressIn', 'pressOut', 'press']);
  });
});

describe('a text field, on Enter', () => {
  it('submits a single line and lets go of it, as blurAndSubmit does on a device', async () => {
    await show('events');
    await page.click('#line');
    await page.keyboard.type('hi');
    await page.keyboard.press('Enter');
    await waitFor(() => window.current.log().includes('blur'));
    assert.deepEqual(await log(), ['focus', 'submitEditing', 'endEditing', 'blur']);
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'line');
  });

  it('submits a multiline field whose submitBehavior says so, keeping focus', async () => {
    await show('events');
    await page.click('#chat');
    await page.keyboard.type('a');
    await page.keyboard.press('Enter');
    await settle();
    assert.deepEqual(await log(), ['submitEditing']);
    assert.equal(await page.evaluate(() => window.current.chat()), 'a');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chat');
  });

  it('adds a line to a multiline field by default', async () => {
    await show('events');
    await page.click('#notes');
    await page.keyboard.type('a');
    await page.keyboard.press('Enter');
    await page.keyboard.type('b');
    await settle();
    assert.equal(await page.evaluate(() => window.current.notes()), 'a\nb');
  });
});

describe('scroll views', () => {
  it('lays a horizontal one out in a row as wide as its content, and reports that size', async () => {
    await show('events');
    assert.equal(await css('#strip', 'flexDirection'), 'row');
    assert.equal(
      await page.$eval('#strip', (el) => el.firstElementChild.getBoundingClientRect().width),
      160,
    );
    await waitFor(() => window.current.contentSize());
    assert.equal(await page.evaluate(() => window.current.contentSize().width), 160);
  });

  it('reports where it came to rest once a scroll ends, as momentumScrollEnd', async () => {
    await show('events');
    await page.$eval('#strip', (el) => el.scrollTo({ left: 30, behavior: 'smooth' }));
    await waitFor(() => window.current.restedAt() !== null);
    assert.equal(await page.evaluate(() => window.current.restedAt()), 30);
  });

  it('ignores the wheel with scrollEnabled off, and still moves for scrollTo', async () => {
    await show('events');
    await page.hover('#frozen');
    await page.mouse.wheel(0, 40);
    await settle();
    assert.equal(await page.$eval('#frozen', (el) => el.scrollTop), 0);
    assert.equal(await page.$eval('#frozen', (el) => (el.scrollTo({ top: 25 }), el.scrollTop)), 25);
  });
});

describe('layout', () => {
  it('stacks a view in a column by default, stretched, with its gap between', async () => {
    await show('cascade');
    const [column, c1, c2] = await Promise.all(['#column', '#c1', '#c2'].map(box));
    assert.equal(c2.top - c1.bottom, 16);
    assert.equal(c1.left, c2.left);
    assert.equal(c1.width, column.width);
  });

  it('spaces a row by a numeric gap from style, in points', async () => {
    await show('cascade');
    const [r1, r2] = await Promise.all(['#r1', '#r2'].map(box));
    assert.equal(r2.left - r1.right, 12);
    assert.equal(r2.top, r1.top);
  });

  it('places an absolutely positioned card at the numbers it was given', async () => {
    await show('cascade');
    const [stage, card] = await Promise.all(['#stage', '#popover'].map(box));
    assert.deepEqual([card.left - stage.left, card.top - stage.top], [40, 96]);
    assert.deepEqual([card.width, card.height], [60, 20]);
  });

  it('moves a view by its transform list without moving its layout box', async () => {
    await show('cascade');
    const shift = await page.$eval('#moved', (el) => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement.getBoundingClientRect();
      return [rect.left - parent.left - el.offsetLeft, rect.top - parent.top - el.offsetTop];
    });
    assert.deepEqual(shift, [30, 10]);
  });
});

describe('AnimatedStyle', () => {
  it('fades and slides over real frames, then settles at the end values', async () => {
    await show('cascade');
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const el = document.getElementById('animated');
          const start = el.getBoundingClientRect().left;
          const sample = () => [
            parseFloat(getComputedStyle(el).opacity),
            el.getBoundingClientRect().left - start,
          ];
          const first = sample();
          const seen = [];
          let finished = null;
          window.current.play((value) => (finished = value));
          const tick = () => {
            seen.push(sample());
            if (finished === null) return requestAnimationFrame(tick);
            resolve({
              first,
              seen,
              finished,
              last: sample(),
              bg: getComputedStyle(el).backgroundColor,
            });
          };
          requestAnimationFrame(tick);
        }),
    );
    assert.deepEqual(result.first, [1, 0]);
    assert.equal(result.finished, true);
    assert.ok(Math.abs(result.last[0] - 0.2) < 0.01);
    assert.ok(Math.abs(result.last[1] - 40) < 0.5);
    assert.ok(
      result.seen.some(([o]) => o < 0.95 && o > 0.25),
      'a fade in between, not a jump',
    );
    assert.ok(
      result.seen.some(([, x]) => x > 1 && x < 39),
      'a spring under way',
    );
    result.seen.slice(1).forEach(([o], i) => assert.ok(o <= result.seen[i][0] + 1e-6));
    // The view's own style survives every frame the binding writes.
    assert.equal(result.bg, 'rgb(3, 2, 1)');
  });

  it('reaches none of React Native to do it', async () => {
    const loaded = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => entry.name),
    );
    assert.ok(loaded.some((name) => name.includes('components/src/solid/animations-web.ts')));
    assert.deepEqual(
      loaded.filter((name) => /\/react-native\//.test(name)),
      [],
    );
  });
});

describe('paint', () => {
  it('draws a linear gradient between the colours the classes name', async () => {
    await show('cascade');
    const image = await css('#gradient', 'backgroundImage');
    assert.match(image, /^linear-gradient\(to right/);
    assert.ok(image.includes('rgb(255, 0, 0)') && image.includes('rgb(0, 0, 255)'));
  });

  it("casts React Native's shadow keys as one box-shadow, at the opacity they give", async () => {
    await show('cascade');
    assert.match(await css('#shadow', 'boxShadow'), /0\.45\)? 0px 6px 12px 0px$/);
  });

  it('draws a border from its width alone, solid and black, as a device does', async () => {
    await show('cascade');
    assert.equal(await css('#framed', 'borderTopWidth'), '2px');
    assert.equal(await css('#framed', 'borderTopStyle'), 'solid');
    assert.equal(await css('#framed', 'borderTopColor'), 'rgb(0, 0, 0)');
    assert.equal(await css('#tinted-frame', 'borderTopColor'), 'rgb(255, 0, 0)');
  });

  it('draws a turning spinner in its colour, and hides it once stopped', async () => {
    await show('cascade');
    assert.equal(await css('#spinner', 'borderTopColor', '::after'), 'rgb(255, 0, 0)');
    assert.equal(await css('#spinner', 'borderTopWidth', '::after'), '2px');
    assert.equal(await css('#spinner', 'animationName', '::after'), 'rn-activity-indicator');
    assert.equal(parseFloat(await css('#spinner', 'width', '::after')), 20);
    assert.equal(await css('#stopped', 'animationPlayState', '::after'), 'paused');
    assert.equal(await css('#stopped', 'visibility', '::after'), 'hidden');
  });

  it('blurs an image by its blurRadius, and covers its box with no resizeMode', async () => {
    await show('cascade');
    assert.equal(await css('#blurred', 'filter'), 'blur(4px)');
    assert.equal(await css('#blurred', 'backgroundSize'), 'cover');
    assert.equal(await css('#blurred', 'backgroundRepeat'), 'no-repeat');
  });
});

describe('state', () => {
  it("applies a component's :active rule while the pointer is down, and only then", async () => {
    await show('cascade');
    assert.equal(await css('#held', 'backgroundColor'), 'rgb(1, 1, 1)');
    await page.hover('#held');
    await page.mouse.down();
    await waitFor(
      () => getComputedStyle(document.getElementById('held')).backgroundColor === 'rgb(2, 2, 2)',
    );
    await page.mouse.up();
    await waitFor(
      () => getComputedStyle(document.getElementById('held')).backgroundColor === 'rgb(1, 1, 1)',
    );
  });

  it("scopes each component's sheet to its own elements", async () => {
    await show('cascade');
    assert.equal(await css('#card-label', 'color'), 'rgb(0, 128, 0)');
    assert.equal(await css('#badge-label', 'color'), 'rgb(0, 0, 255)');
    const plain = await css('#plain', 'color');
    assert.notEqual(plain, 'rgb(0, 128, 0)');
    assert.notEqual(plain, 'rgb(0, 0, 255)');
  });
});

describe('the Tailwind web preset', () => {
  it('matches press: while the pointer is down, as :active', async () => {
    await show('cascade');
    assert.equal(await css('#pressed', 'backgroundColor'), 'rgb(16, 16, 16)');
    await page.hover('#pressed');
    await page.mouse.down();
    await waitFor(
      () =>
        getComputedStyle(document.getElementById('pressed')).backgroundColor === 'rgb(32, 32, 32)',
    );
    await page.mouse.up();
  });

  it('matches hover: under a real pointer', async () => {
    await show('cascade');
    await page.mouse.move(0, 0);
    assert.equal(await css('#hovered', 'backgroundColor'), 'rgb(48, 48, 48)');
    await page.hover('#hovered');
    await waitFor(
      () =>
        getComputedStyle(document.getElementById('hovered')).backgroundColor === 'rgb(64, 64, 64)',
    );
    await page.mouse.move(0, 0);
  });

  it('follows the OS into dark:, through ColorScheme and the class it binds', async () => {
    await show('cascade');
    assert.equal(await css('#themed', 'backgroundColor'), 'rgb(255, 255, 255)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await waitFor(
      () => getComputedStyle(document.getElementById('themed')).backgroundColor === 'rgb(0, 0, 0)',
    );
  });

  it("pads pt-safe by the device's inset, and by nothing without one", async () => {
    await show('cascade');
    assert.equal(await css('#notched', 'paddingTop'), '30px');
    assert.equal(await css('#unnotched', 'paddingTop'), '0px');
  });
});

describe('the reset', () => {
  it('mount injects it by default, below every utility', async () => {
    await show('cascade', { asAnAppMounts: true });
    assert.ok(await page.$('#solid-native-web-reset'));
    assert.equal(await css('#tinted-frame', 'borderTopWidth'), '2px');
    assert.equal(await css('#tinted-frame', 'borderTopColor'), 'rgb(255, 0, 0)');
    assert.equal(
      await page.$eval('#column', (el) => getComputedStyle(el.parentElement).flexDirection),
      'row',
    );
    await page.evaluate(() => document.getElementById('solid-native-web-reset')?.remove());
  });

  for (const order of ['utilities first', 'reset first']) {
    it(`stays below utilities that declare no base layer, with the ${order}`, async () => {
      const result = await page.evaluate((order) => {
        const frame = document.createElement('iframe');
        document.body.appendChild(frame);
        try {
          const doc = frame.contentDocument;
          const utilities = doc.createElement('style');
          utilities.textContent = '@layer utilities { .u-row { flex-direction: row } }';
          if (order === 'reset first') window.injectReset(doc);
          doc.head.appendChild(utilities);
          if (order === 'utilities first') window.injectReset(doc);
          const probe = (className) => {
            const view = doc.createElement('div');
            view.setAttribute('data-rn', 'view');
            view.className = className;
            doc.body.appendChild(view);
            return frame.contentWindow.getComputedStyle(view).flexDirection;
          };
          return [!!doc.getElementById('solid-native-web-reset'), probe(''), probe('u-row')];
        } finally {
          frame.remove();
        }
      }, order);
      assert.deepEqual(result, [true, 'column', 'row']);
    });
  }
});
