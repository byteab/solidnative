/**
 * Shared Solid components inside a host page that owns its own reactive scope.
 *
 * `mountBrowser(..., { owner })` and `Island` put an island inside the host's owner rather than
 * beside it: one set of services, the host's context, the host's reactivity, the host's error
 * reporting, and disposal tied to the host. Without an owner a root is an app of its own; the
 * other files cover that, and the last case here checks it comes apart cleanly.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createComponent, createRoot, createSignal, getOwner, type Owner } from 'solid-js';
import { provideService, useService, withServiceScope, type Screen } from '@solidnative/device';
import { installJsdomEnvironment } from '../src/jsdom-env.ts';
import { Island, mount, mountBrowser, type BrowserComponent } from '../src/solid/index.ts';
import { settle } from './boot.ts';
import {
  HostName,
  IslandBadge,
  IslandCounter,
  IslandDetails,
  OtherIslandBadge,
  Section,
  Tally,
  disposals,
} from './fixtures.solid.tsx';

const text = (document: Document, id: string) =>
  document.querySelector(`[id="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

function pressOn(document: Document, id: string) {
  const target = document.querySelector(`[id="${id}"]`)!;
  const Pointer = (globalThis as unknown as typeof window).PointerEvent;
  target.dispatchEvent(new Pointer('pointerdown', { pointerId: 1, bubbles: true }));
  target.dispatchEvent(new Pointer('pointerup', { pointerId: 1, bubbles: true }));
}

/** A host page: its own services, context, error handler, and a slot an island mounts into. */
function bootHost(component: BrowserComponent<object>) {
  const { document, window } = installJsdomEnvironment();
  const slot = document.createElement('div');
  slot.id = 'slot';
  document.body.appendChild(slot);
  const handled: unknown[] = [];
  let tally!: ReturnType<typeof Tally.create>;
  let owner!: Owner;
  let disposeHost!: () => void;
  createRoot((dispose) => {
    disposeHost = dispose;
    withServiceScope([provideService(Tally, Tally.create)], () =>
      createComponent(HostName.Provider, {
        value: 'Ada',
        get children() {
          return createComponent(Section.Provider, {
            value: 'Accounts',
            get children() {
              owner = getOwner()!;
              tally = useService(Tally);
              return undefined;
            },
          });
        },
      }),
    );
  });
  const island = mountBrowser(() => component({}), slot, {
    owner,
    island: true,
    onError: (error) => handled.push(error),
  });
  return { document, window, slot, handled, island, tally, disposeHost };
}

describe('mountBrowser with an owner: an island inside a host page', () => {
  it("uses the host's services, sees its context, and is driven by its reactivity", () => {
    const { document, tally, island, disposeHost } = bootHost(() => IslandCounter());
    assert.equal(text(document, 'island-label'), 'Ada: 0', "the host's context reached it");
    // The host increments its own Tally; the island renders the same instance.
    tally.increment();
    assert.equal(text(document, 'island-label'), 'Ada: 1', 'one Tally, shared');
    island.dispose();
    disposeHost();
  });

  it('sees what a provider above it provides, and hands its errors to the host', async () => {
    const { document, handled, island, disposeHost } = bootHost(() => IslandDetails({}));
    assert.equal(text(document, 'details-section'), 'Accounts');
    pressOn(document, 'details-fail');
    await settle();
    assert.equal(handled.length, 1);
    assert.match(String(handled[0]), /island press failed/);
    island.dispose();
    disposeHost();
  });

  it('reads the browser for its device services', () => {
    let screen: Screen | undefined;
    const { window, island, disposeHost } = bootHost(() =>
      IslandDetails({ onScreen: (value) => (screen = value) }),
    );
    assert.equal(screen!.window().width, window.innerWidth);
    assert.ok(screen!.window().width > 0, 'a real width, not the phone default of zero');
    island.dispose();
    disposeHost();
  });

  it('renders into the slot, marks it as the root, and carries a press out to the host', async () => {
    const { document, slot, tally, island, disposeHost } = bootHost(() => IslandCounter());
    assert.ok(slot.contains(document.querySelector('[id="island-label"]')));
    assert.equal(slot.getAttribute('data-rn-root'), '');
    pressOn(document, 'island-press');
    await settle();
    assert.equal(tally.count(), 1, "the host's own Tally saw the press");
    assert.equal(text(document, 'island-label'), 'Ada: 1');
    island.dispose();
    disposeHost();
  });

  it("leaves the host page's own html and body alone", () => {
    const { document, island, disposeHost } = bootHost(() => IslandCounter());
    assert.equal(document.getElementById('solid-native-web-reset'), null, 'not the page reset');
    const reset = document.getElementById('solid-native-web-island-reset')?.textContent;
    assert.ok(reset?.includes('[data-rn-root]'), 'the island still gets its element reset');
    assert.doesNotMatch(reset!, /(^|[\s,}])(html|body)\s*[,{]/, 'but no rule for html or body');
    assert.match(reset!, /\[data-rn-root\][^{]*\{[^}]*font-family/, 'the root carries the font');
    island.dispose();
    disposeHost();
  });

  it('comes apart without taking the host with it, and with the host when it goes', () => {
    const { document, slot, island, disposeHost } = bootHost(() => IslandCounter());
    island.dispose();
    assert.equal(document.querySelector('[id="island-label"]'), null);
    assert.equal(slot.childNodes.length, 0, 'emptied, still in the page');
    assert.equal(slot.hasAttribute('data-rn-root'), false, 'and no longer marked as a root');
    const again = bootHost(() => IslandCounter());
    again.disposeHost();
    assert.equal(again.island.disposed, true, "the host's disposal disposed the island");
    disposeHost();
  });
});

describe('Island: an island placed by a host component', () => {
  function bootPage() {
    const { document } = installJsdomEnvironment();
    const [label, setLabel] = createSignal('Ada');
    const [component, setComponent] = createSignal<BrowserComponent<never>>(
      IslandBadge as BrowserComponent<never>,
    );
    const presses: string[] = [];
    let element!: HTMLElement, dispose!: () => void;
    createRoot((stop) => {
      dispose = stop;
      element = Island({
        document,
        get component() {
          return component();
        },
        get inputs() {
          return { label: label(), onPressed: (value: string) => presses.push(value) } as never;
        },
      });
      document.body.appendChild(element);
    });
    return { document, element, setLabel, setComponent, presses, dispose };
  }

  it('mounts the component with its inputs, and passes a change through without remounting', () => {
    const { document, setLabel, dispose } = bootPage();
    assert.equal(text(document, 'badge-label'), 'Ada');
    const before = disposals.count;
    setLabel('Grace');
    assert.equal(text(document, 'badge-label'), 'Grace');
    assert.equal(disposals.count, before, 'the same component, so its state survives');
    dispose();
  });

  it("calls the host's handler when the island emits", async () => {
    const { document, presses, dispose } = bootPage();
    pressOn(document, 'badge');
    await settle();
    assert.deepEqual(presses, ['Ada']);
    dispose();
  });

  it('swaps the island when the component changes, and goes with its owner', () => {
    const { document, setComponent, dispose } = bootPage();
    const before = disposals.count;
    setComponent(() => OtherIslandBadge as BrowserComponent<never>);
    assert.equal(document.querySelector('[id="badge-label"]'), null);
    assert.equal(text(document, 'other-label'), 'Other Ada');
    assert.equal(disposals.count, before + 1, 'the first one was disposed');
    dispose();
    assert.equal(document.querySelector('[id="other-label"]'), null);
    assert.equal(disposals.count, before + 2);
  });
});

describe('mount() on its own', () => {
  it('sets inputs before the first render, and leaves its element in the page, empty', () => {
    const { document } = installJsdomEnvironment();
    const root = document.getElementById('app-root')!;
    const island = mount(root, IslandBadge, { inputs: { label: 'Ada' } });
    assert.equal(text(document, 'badge-label'), 'Ada');
    island.destroy();
    assert.equal(island.disposed, true);
    assert.equal(document.getElementById('app-root'), root);
    assert.equal(root.childNodes.length, 0);
  });
});
