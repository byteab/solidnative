/**
 * Expo, reached without Expo's React.
 *
 * Two halves. A view's Fabric name is the whole contract for `registerExpoView`, and a name that
 * does not match commits as an unimplemented view with no error at all, so the derivation is
 * pinned here where a device is not needed to see it. The services are the other half: the
 * behaviour lives in classes that take their native surface, which is what lets a fake stand in
 * for Expo in Node, where React Native's Flow source cannot be parsed at all.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Engine } from '@solid-native/fabric';
import { createNativeRoot } from '@solid-native/platform/solid';
import { provideService, useService, withServiceScope } from '@solid-native/device/solid';
import {
  expoViewName,
  registerExpoView,
  registerExpoViews,
  registerNativeViews,
  registerExpoUiViews,
} from '@solid-native/expo';
import { EXPO_UI_VIEWS } from '../expo/src/expo-ui.ts';
import { Clipboard } from '@solid-native/expo/clipboard';
import { FileSystem, type NativeFile } from '@solid-native/expo/file-system';
import { Haptics } from '@solid-native/expo/haptics';
import { disposeServices, owned, serviceWith } from './expo-service.ts';
import {
  createFakeFabric,
  type FakeFabric,
  type FakeFabricNode as FakeNode,
} from '@solid-native/testing';
import { expoUiControlsFixture, expoUiFixture, expoUiListFixture } from './expo-ui-fixture.tsx';

afterEach(disposeServices);

/** Expo Go installs this; a standalone build does not. */
function asExpoGo(identifier: string | undefined): void {
  const global = globalThis as { expo?: { __expo_app_identifier__?: string } };
  if (identifier === undefined) delete global.expo;
  else global.expo = { __expo_app_identifier__: identifier };
}

describe('expo view names', () => {
  afterEach(() => asExpoGo(undefined));

  it('names a module default view', () => {
    assert.equal(expoViewName('ExpoImage'), 'ViewManagerAdapter_ExpoImage');
  });

  it('names a second view on the same module', () => {
    assert.equal(
      expoViewName('ExpoClipboard', 'PasteButton'),
      'ViewManagerAdapter_ExpoClipboard_PasteButton',
    );
  });

  it('carries the app identifier, because Expo Go namespaces every view by project', () => {
    asExpoGo('abc123');
    assert.equal(expoViewName('ExpoImage'), 'ViewManagerAdapter_ExpoImage_abc123');
    assert.equal(
      expoViewName('ExpoImage', 'Ref'),
      'ViewManagerAdapter_ExpoImage_Ref_abc123',
      'the identifier goes last, after the view name',
    );
  });
});

describe('an expo view in the tree', () => {
  let fabric: FakeFabric;
  let engine: Engine;

  beforeEach(() => {
    fabric = createFakeFabric();
    engine = new Engine(fabric, 1, { processColor: (value) => value });
  });

  afterEach(() => asExpoGo(undefined));

  it('commits under the adapter name, with the module props passed straight through', () => {
    registerExpoView('expo-image', 'ExpoImage', { defaultProps: { contentFit: 'cover' } });

    const image = engine.createElement('expo-image');
    engine.setProp(image, 'source', [{ uri: 'https://example.com/a.png' }]);
    engine.appendChild(engine.root, image);
    engine.commit();

    const [node] = fabric.committed;
    assert.equal(node?.viewName, 'ViewManagerAdapter_ExpoImage');
    assert.equal(node?.props['contentFit'], 'cover', 'the default the React wrapper would apply');
    assert.deepEqual(node?.props['source'], [{ uri: 'https://example.com/a.png' }]);
  });

  it('is not mistaken for a primitive whose component was forgotten', () => {
    const reports: string[] = [];
    const original = console.error;
    console.error = (message: string) => reports.push(message);
    try {
      const dev = new Engine(createFakeFabric(), 1, { dev: true, processColor: (v) => v });
      registerExpoView('expo-blur', 'ExpoBlurView');
      dev.appendChild(dev.root, dev.createElement('expo-blur'));
      dev.commit();
    } finally {
      console.error = original;
    }
    assert.deepEqual(reports, [], 'nothing in components claims an Expo view, and nothing should');
  });

  it('registers the name it had at startup, identifier and all', () => {
    asExpoGo('canary');
    registerExpoView('expo-blur', 'ExpoBlurView');

    engine.appendChild(engine.root, engine.createElement('expo-blur'));
    engine.commit();

    assert.equal(fabric.committed[0]?.viewName, 'ViewManagerAdapter_ExpoBlurView_canary');
  });
});

/**
 * Every service is a `@Service()` class reading its platform through an injected source token, so
 * this pins the shape rather than any one of them: nothing is constructed until something injects
 * it, it is constructed once, and an app can put a fake in front of the platform without knowing
 * anything about how the service reaches it.
 */
describe('the shape every service uses', () => {
  it('constructs on first use, once, for the life of its scope', async () => {
    let subscribed = 0;
    const seen = owned(() =>
      withServiceScope(
        [
          provideService(Clipboard.SOURCE, () => ({
            getStringAsync: async () => 'from the fake',
            setStringAsync: async () => true,
            addClipboardListener: () => {
              subscribed += 1;
              return { remove: () => {} };
            },
          })),
        ],
        () => {
          const before = subscribed;
          const first = useService(Clipboard);
          const once = subscribed;
          const second = useService(Clipboard);
          return { before, first, once, second };
        },
      ),
    ).value;

    assert.equal(seen.before, 0, 'a service nobody uses is never constructed');
    assert.equal(seen.once, 1, 'using it constructed it');
    assert.equal(await seen.first.read(), 'from the fake', 'and it reached the provided platform');
    assert.equal(seen.second, seen.first, 'one instance per scope, as a root service');
    assert.equal(subscribed, 1);
  });
});

describe('haptics', () => {
  const calls: string[] = [];
  const native = {
    impactAsync: (style: string) => (calls.push(`impact:${style}`), Promise.resolve()),
    notificationAsync: (type: string) => (calls.push(`notify:${type}`), Promise.resolve()),
    selectionAsync: () => (calls.push('select'), Promise.resolve()),
  };

  beforeEach(() => (calls.length = 0));

  it('plays each kind of feedback, defaulting an impact to medium', () => {
    const haptics = serviceWith(Haptics, native);
    haptics.impact();
    haptics.impact('heavy');
    haptics.notify('success');
    haptics.select();
    assert.deepEqual(calls, ['impact:medium', 'impact:heavy', 'notify:success', 'select']);
    assert.equal(haptics.available, true);
  });

  it('does nothing at all when the module is not installed', () => {
    const haptics = serviceWith(Haptics, null);
    assert.equal(haptics.available, false);
    haptics.impact();
    assert.deepEqual(calls, [], 'and no throw, because nobody awaits a vibration');
  });

  it('swallows a rejection, so a missing Taptic Engine is not an unhandled promise', () => {
    const haptics = serviceWith(Haptics, {
      ...native,
      impactAsync: () => Promise.reject(new Error('no haptics here')),
    });
    haptics.impact();
  });
});

describe('the clipboard', () => {
  function fake(text = '') {
    let notify = () => {};
    const written: string[] = [];
    return {
      written,
      change: () => notify(),
      native: {
        getStringAsync: () => Promise.resolve(text),
        setStringAsync: (value: string) => (written.push(value), Promise.resolve(true)),
        addClipboardListener: (listener: () => void) => {
          notify = listener;
          return { remove: () => (notify = () => {}) };
        },
      },
    };
  }

  it('counts pasteboard changes as a signal, and reads nothing on its own', async () => {
    const stub = fake('hello');
    const clipboard = serviceWith(Clipboard, stub.native);
    assert.equal(clipboard.changes(), 0);

    stub.change();
    stub.change();
    assert.equal(clipboard.changes(), 2, 'the notification is free; the read is not');

    assert.equal(await clipboard.read(), 'hello');
  });

  it('writes through to native', async () => {
    const stub = fake();
    const clipboard = serviceWith(Clipboard, stub.native);
    await clipboard.write('copied');
    assert.deepEqual(stub.written, ['copied']);
  });

  it('reads empty rather than throwing with no module installed', async () => {
    const clipboard = serviceWith(Clipboard, null);
    assert.equal(await clipboard.read(), '');
  });
});

describe('the file system', () => {
  function fakeFile(exists: boolean) {
    const written: (string | Uint8Array)[] = [];
    let created = 0;
    const file = {
      uri: 'file:///canary.txt',
      exists,
      size: 0,
      create: () => created++,
      write: (content: string | Uint8Array) => written.push(content),
      text: () => Promise.resolve(written.join('')),
      textSync: () => written.join(''),
      bytes: () => Promise.resolve(written.at(-1) as Uint8Array),
      delete: () => {},
    } satisfies NativeFile;
    return { file, written, creations: () => created };
  }

  const files = (file: NativeFile) => ({
    cacheDirectory: { name: 'cache' },
    documentDirectory: { name: 'documents' },
    file: (directory: object, name: string) => {
      asked.push(`${(directory as { name: string }).name}/${name}`);
      return file;
    },
  });
  let asked: string[] = [];

  beforeEach(() => (asked = []));

  it('names a file in the directory that matches what it is for', () => {
    const { file } = fakeFile(true);
    const system = serviceWith(FileSystem, files(file));
    system.cache('canary.txt');
    system.document('canary.txt');
    assert.deepEqual(asked, ['cache/canary.txt', 'documents/canary.txt']);
  });

  it('creates a file that is not there before writing it', () => {
    const missing = fakeFile(false);
    const system = serviceWith(FileSystem, files(missing.file));
    system.write(missing.file, 'hello');
    assert.equal(missing.creations(), 1);
    assert.deepEqual(missing.written, ['hello']);
  });

  it('writes bytes as bytes, for a file that is not text', async () => {
    const missing = fakeFile(false);
    const system = serviceWith(FileSystem, files(missing.file));
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    system.write(missing.file, pdf);
    assert.equal(missing.creations(), 1);
    assert.equal(missing.written[0], pdf, 'handed to Expo as it is, not turned into text');
    assert.deepEqual(await missing.file.bytes(), pdf);
  });

  it('writes an existing file without creating it again', () => {
    const present = fakeFile(true);
    const system = serviceWith(FileSystem, files(present.file));
    system.write(present.file, 'hello');
    assert.equal(present.creations(), 0, 'create() throws on a file that is already there');
  });
});

describe('the views worth knowing the names of', () => {
  it('registers a known one by its element name', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoViews('expo-blur');

    engine.appendChild(engine.root, engine.createElement('expo-blur'));
    engine.commit();

    const view = fabric.committed[0]!;
    assert.match(view.viewName, /ExpoBlurView/, 'committed as the module its name says');
    assert.equal(view.props['intensity'], 50, 'with the defaults the React component applies');
  });

  it('names SF Symbols by the module expo-symbols registers', () => {
    // expo-symbols asks for requireNativeViewManager('SymbolModule'). Any other name commits as
    // UnimplementedNativeView: a red box, on a device, and nothing in a test.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoViews('expo-symbol');

    engine.appendChild(engine.root, engine.createElement('expo-symbol'));
    engine.commit();

    assert.equal(fabric.committed[0]!.viewName, 'ViewManagerAdapter_SymbolModule');
  });

  it('says so rather than registering an element that commits as nothing', () => {
    // A name that is not known would otherwise be an element whose native side never arrives,
    // which looks exactly like a module the app forgot to install.
    assert.throws(() => registerExpoViews('expo-nothing' as 'expo-blur'), /no Expo view is known/);
  });
});

describe('the native views that are not Expo modules', () => {
  it('registers one under its own Fabric name, not a ViewManagerAdapter one', () => {
    // These libraries generate their own component names; only Expo's modules get the adapter
    // prefix, and using it here would be an element that commits as nothing.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerNativeViews('slider');

    engine.appendChild(engine.root, engine.createElement('slider'));
    engine.commit();

    assert.equal(fabric.committed[0]?.viewName, 'RNCSlider');
    assert.equal(fabric.committed[0]?.props['maximumValue'], 1);
  });

  it('asks an old-architecture control for its change events, as a React handler would', () => {
    // The segmented control is a Paper view manager run through Fabric's interop layer, which
    // only installs the onChange block when the prop is set. Without it, taps change the
    // control on screen and no event is ever sent.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerNativeViews('segmented-control');

    engine.appendChild(engine.root, engine.createElement('segmented-control'));
    engine.commit();

    assert.equal(fabric.committed[0]?.viewName, 'RNCSegmentedControl');
    assert.equal(fabric.committed[0]?.props['onChange'], true);
  });

  it('says so rather than registering a name nothing will answer to', () => {
    assert.throws(() => registerNativeViews('nope' as 'slider'), /no native view is known/);
  });
});

describe('the SwiftUI and Compose views', () => {
  it('accepts Platform.OS directly, and registers nothing on a platform neither ships for', () => {
    // The docs pass `Platform.OS` straight through - `'ios' | 'android' | 'macos' | 'windows' |
    // 'web'` from react-native, not the narrower `'ios' | 'android'` this took before. Web is the
    // one every canary app also runs on, so it is the one that would have caught a fallthrough to
    // the Android table. Run before any other test in this file touches the registry, since
    // registration only ever adds names and never removes them.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoUiViews('web');

    engine.appendChild(engine.root, engine.createElement('ui-toggle'));
    engine.commit();
    assert.doesNotMatch(fabric.committed[0]!.viewName, /ExpoUI/);
  });

  it('registers the slot on both platforms, which twenty SwiftUI views need', () => {
    // `Slot` is how a composite SwiftUI view takes its children - a picker's options, a
    // section's rows. It had been recorded as Android-only because SwiftUI's lives in a
    // top-level file rather than a directory, and without it those children mount into a plain
    // UIView: a red screen on iOS, and a control that draws nothing.
    //
    // Mounted rather than read off the table: the table being right is not the claim, the element
    // reaching a native view is - and this passed while the registration was broken.
    for (const platform of ['ios', 'android'] as const) {
      const fabric = createFakeFabric();
      const engine = new Engine(fabric, 1, { processColor: (value) => value });
      registerExpoUiViews(platform);

      engine.appendChild(engine.root, engine.createElement('ui-slot'));
      engine.commit();
      assert.match(fabric.committed[0]!.viewName, /SlotView/, platform);
    }
  });

  it('registers the platform-neutral name against the platform that has it', () => {
    // `@expo/ui` reaches these through `requireNativeView('ExpoUI', ...)`, which is the same
    // derivation `registerExpoView` mirrors - so the whole surface is a table of names.
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoUiViews('ios');

    engine.appendChild(engine.root, engine.createElement('ui-slider'));
    engine.commit();
    assert.match(fabric.committed[0]!.viewName, /ExpoUI_SliderView/);
  });

  it('registers the SwiftUI list, whose rows take native swipe actions', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoUiViews('ios');
    engine.appendChild(engine.root, engine.createElement('ui-list'));
    engine.commit();
    assert.match(fabric.committed[0]!.viewName, /ExpoUI_ListView/);
  });

  it('registers the other platform view for the same element', () => {
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoUiViews('android');

    engine.appendChild(engine.root, engine.createElement('ui-vstack'));
    engine.commit();
    // Compose calls it a Column; an app should not have to.
    assert.match(fabric.committed[0]!.viewName, /ExpoUI_ColumnView/);
  });

  it('leaves an element alone on a platform that has no such control', () => {
    /*
     * A Gauge is SwiftUI's. Registering it on Android would be an element that commits as nothing,
     * which looks exactly like a module that failed to install.
     *
     * Half of this is mounted and half is read off the table, and the split is not laziness.
     * `registerViewName` writes into one process-wide map that no test can clear, so once any
     * earlier test has registered the iOS set, `ui-gauge` resolves for the rest of the run - an
     * absence cannot be observed behaviourally from in here. What can be observed is that iOS
     * really does reach a native view, and that the table Android registration reads has no entry
     * to give it.
     */
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, { processColor: (value) => value });
    registerExpoUiViews('ios');
    engine.appendChild(engine.root, engine.createElement('ui-gauge'));
    engine.commit();
    assert.match(fabric.committed[0]!.viewName, /ExpoUI_GaugeView/, 'iOS has one');

    assert.equal(EXPO_UI_VIEWS['gauge']?.[1], null, 'and Android is given nothing to register');
  });
});

const all = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...all(node.children)]);

/** Renders a Solid fixture onto a fresh fake Fabric; `named` finds a committed view by name. */
function renderFixture(View: () => unknown) {
  const fabric = createFakeFabric();
  const root = createNativeRoot({ fabric, rootTag: 1 });
  root.render(View as never);
  const named = (pattern: RegExp) =>
    all(fabric.committed).find((node) => pattern.test(node.viewName))!;
  return { fabric, root, named, nodes: () => all(fabric.committed) };
}

describe('the typed SwiftUI and segmented-control components', () => {
  let view: ReturnType<typeof renderFixture>;
  let fixture: ReturnType<typeof expoUiFixture>;

  beforeEach(() => {
    registerExpoUiViews('ios');
    registerNativeViews('segmented-control');
    fixture = expoUiFixture();
    view = renderFixture(fixture.View);
  });
  afterEach(() => view.root.dispose());

  it('passes each input to the native view as the prop of the same name', () => {
    const { named } = view;
    assert.equal(named(/HostView/).props['ignoreSafeArea'], 'container');
    // Except `matchContents`, which native reads as a flag per axis; see `UiHost`.
    assert.equal(named(/HostView/).props['matchContentsVertical'], true);
    assert.equal(named(/HostView/).props['matchContentsHorizontal'], true);
    assert.equal(named(/ExpoUI_MenuView/).props['accessibilityLabel'], 'More');
    assert.deepEqual(named(/ExpoUI_MenuView/).props['modifiers'], [
      { $type: 'opacity', value: 0.5 },
    ]);
    assert.equal(named(/ExpoUI_Button$/).props['role'], 'destructive');
    assert.deepEqual(named(/DatePicker/).props['displayedComponents'], ['date']);
    assert.deepEqual(named(/RNCSegmentedControl/).props['values'], ['A', 'B']);
    assert.equal(named(/RNCSegmentedControl/).props['onChange'], true, 'the default still applies');
    assert.equal('title' in named(/DatePicker/).props, false, 'an unset input sends nothing');

    // The rest of the typed SwiftUI surface: a divider and a slot inside the menu, and an image
    // that is not inside one at all.
    assert.equal(named(/ExpoUI_SlotView/).props['name'], 'label');
    assert.equal(named(/ExpoUI_TextView/).props['text'], 'More');
    assert.equal(named(/ExpoUI_DividerView/) !== undefined, true, 'committed, even with no props');
    assert.equal(named(/ExpoUI_ImageView/).props['systemName'], 'star');
    // SwiftUI's image has no size or color prop; they travel as modifiers, as @expo/ui's own do.
    assert.deepEqual(named(/ExpoUI_ImageView/).props['modifiers'], [
      { $type: 'font', size: 24 },
      { $type: 'foregroundStyle', style: { type: 'color', color: '#ff0000' } },
    ]);
    assert.equal('size' in named(/ExpoUI_ImageView/).props, false);
  });

  it('hands the native events to the handlers', () => {
    const { fabric, named, root } = view;
    fabric.emit(named(/ExpoUI_Button$/), 'topButtonPress', {});
    fabric.emit(named(/DatePicker/), 'topDateChange', { date: '2026-03-04T00:00:00Z' });
    fabric.emit(named(/RNCSegmentedControl/), 'topChange', { selectedSegmentIndex: 1, value: 'B' });
    root.flush();
    assert.equal(fixture.presses(), 1, 'once, not once per route');
    assert.equal(fixture.date(), '2026-03-04T00:00:00Z');
    assert.equal(fixture.index(), 1);
  });
});

describe('the typed SwiftUI list', () => {
  it('passes a row s swipe actions and layout through as props', () => {
    registerExpoUiViews('ios');
    const fixture = expoUiListFixture();
    const { fabric, named, nodes, root } = renderFixture(fixture.View);

    assert.deepEqual(named(/ExpoUI_ListView/).props['modifiers'], [
      { $type: 'listStyle', style: 'plain' },
    ]);
    assert.ok(named(/ExpoUI_SwipeActionsView/));
    assert.deepEqual(named(/ExpoUI_SlotView/).props['extraProps'], {
      edge: 'trailing',
      allowsFullSwipe: true,
    });
    assert.equal(named(/ExpoUI_VStackView/).props['alignment'], 'leading');
    assert.equal(named(/ExpoUI_VStackView/).props['spacing'], 2);

    const row = nodes().find(
      (node) => /ExpoUI_Button$/.test(node.viewName) && node.props['label'] === undefined,
    )!;
    fabric.emit(row, 'topButtonPress', {});
    root.flush();
    assert.equal(fixture.opened(), 1);

    const slider = named(/ExpoUI_SliderView/);
    assert.equal(slider.props['value'], 0.25);
    assert.equal(slider.props['max'], 1);
    fabric.emit(slider, 'topValueChanged', { value: 0.75 });
    root.flush();
    assert.equal(fixture.level(), 0.75);
    root.dispose();
  });
});

describe('the typed SwiftUI controls and expo-image', () => {
  it('passes each input through as the prop of the same name, and events to the handlers', () => {
    registerExpoUiViews('ios');
    registerExpoViews('expo-image');
    const fixture = expoUiControlsFixture();
    const { fabric, named, root } = renderFixture(fixture.View);

    assert.equal(named(/ExpoUI_ToggleView$/).props['isOn'], true);
    assert.equal(named(/ExpoUI_ToggleView$/).props['label'], 'Wi-Fi');
    assert.equal(named(/ExpoUI_StepperView$/).props['max'], 8);
    assert.equal(named(/ExpoUI_TextFieldView$/).props['placeholder'], 'Name');
    assert.equal(named(/ExpoUI_ColorPickerView$/).props['selection'], '#ff0000');
    assert.equal(named(/ExpoUI_SectionView$/).props['title'], 'Network');
    assert.equal(named(/ExpoUI_HStackView$/).props['spacing'], 4);
    assert.equal(named(/ExpoUI_GaugeView$/).props['currentValueLabel'], '40%');
    assert.equal(named(/ExpoUI_ProgressView$/).props['value'], 0.5);
    assert.ok(named(/ExpoUI_FormView$/) && named(/ExpoUI_SpacerView$/));
    assert.ok(named(/ExpoUI_LabeledContentView$/));

    fabric.emit(named(/ExpoUI_ToggleView$/), 'topIsOnChange', { isOn: false });
    root.flush();
    assert.equal(fixture.on(), false);

    const image = named(/ExpoImage/);
    assert.deepEqual(image.props['source'], [{ uri: 'a.png' }]);
    assert.equal(image.props['transition'], 300);
    assert.equal(image.props['contentFit'], 'cover', 'the default an unset prop leaves alone');
    root.dispose();
  });
});
