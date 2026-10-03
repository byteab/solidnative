/** @jsxImportSource @solidnative/platform/solid */
/**
 * The whole Testing Library surface under `node --import @solidnative/testing/register --test`,
 * written as an app's test would be: Solid components declared here, everything imported by
 * package name. The edges an app has no reason to show are here too: what every query throws, and
 * exactly what each event sends.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, TextInput, View } from '@solidnative/components';
import {
  cleanup,
  createClock,
  fireEvent,
  render,
  renderWith,
  screen,
  settle,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
  type FakeFabric,
  type FakeFabricNode,
} from '@solidnative/testing';
import { Show, createNativeRoot } from '@solidnative/platform/solid';

declare const __DEV__: boolean;

afterEach(cleanup);

const [shown, setShown] = createSignal(true);

function List() {
  return (
    <View testID="list">
      <View nativeID="first" accessibilityRole="listitem" accessibilityLabel="First item">
        <Text>Apples</Text>
      </View>
      <View testID="second" accessibilityRole="listitem">
        <Text>Pears</Text>
        <Text>
          and <Text>plums</Text>
        </Text>
      </View>
      <Show when={shown()}>
        <Text>Going soon</Text>
      </Show>
    </View>
  );
}

const renderList = () => {
  setShown(true);
  return render(List);
};

describe('queries', () => {
  it('finds by test id, through testID or nativeID', () => {
    renderList();
    assert.equal(screen.getByTestId('second').props['testID'], 'second');
    assert.equal(screen.getByTestId('first').props['nativeID'], 'first');
    assert.equal(screen.queryByTestId('third'), null);
  });

  it('finds by role, named by label or by the text inside', () => {
    renderList();
    assert.equal(screen.getAllByRole('listitem').length, 2);
    assert.equal(screen.getByRole('listitem', { name: 'First item' }).props['nativeID'], 'first');
    assert.equal(screen.getByRole('listitem', { name: /pears/i }).props['testID'], 'second');
    assert.equal(
      screen.queryByRole('listitem', { name: 'pears', exact: false })?.props['testID'],
      'second',
    );
  });

  it('names a labelled node by its label alone, as a screen reader does', () => {
    renderList();
    assert.equal(screen.queryByRole('listitem', { name: 'Apples' }), null);
  });

  it('matches whole text by default, a substring when not exact, and a RegExp as given', () => {
    renderList();
    assert.ok(screen.getByText('Apples'));
    assert.equal(screen.queryByText('Apple'), null);
    assert.ok(screen.getByText('apple', { exact: false }));
    assert.ok(screen.getByText(/^and plums$/), 'a nested span is part of its paragraph');
    assert.equal(screen.queryAllByText(/plums/).length, 1, 'and not a match of its own');
    assert.ok(screen.getByText('  Pears '), 'whitespace is normalised on both sides');
  });

  it('finds by label', () => {
    renderList();
    assert.equal(screen.getByLabelText('First item').props['nativeID'], 'first');
    assert.equal(screen.getAllByLabelText(/item/).length, 1);
  });

  it('throws from getBy with the tree when nothing matches', () => {
    renderList();
    assert.throws(
      () => screen.getByText('Bananas'),
      (error: Error) =>
        error.message.startsWith('Unable to find a node with text "Bananas".') &&
        error.message.includes('RawText "Apples"') &&
        error.message.includes('View nativeID="first" accessibilityRole="listitem"'),
    );
    assert.throws(() => screen.getAllByText('Bananas'), /Unable to find a node with text/);
  });

  it('throws from getBy and queryBy when more than one matches', () => {
    renderList();
    assert.throws(() => screen.getByRole('listitem'), /Found 2 nodes with role "listitem"/);
    assert.throws(() => screen.queryByRole('listitem'), /Use getAllByRole/);
    assert.deepEqual(screen.queryAllByText('Bananas'), []);
  });

  it('scopes a query to a subtree with within', () => {
    renderList();
    const second = screen.getByTestId('second');
    assert.ok(within(second).getByText('Pears'));
    assert.equal(within(second).queryByText('Apples'), null);
  });

  it('finds asynchronously, and rejects on timeout', async () => {
    renderList();
    setTimeout(() => setShown(false), 20);
    await waitForElementToBeRemoved(() => screen.queryByText('Going soon'));
    await assert.rejects(
      screen.findByText('Going soon', undefined, { timeout: 60, interval: 10 }),
      /Unable to find a node with text "Going soon"/,
    );
    assert.equal((await screen.findAllByRole('listitem')).length, 2);
    assert.equal((await screen.findByTestId('list')).props['testID'], 'list');
  });

  it('waits for a held node to go, and refuses one that is already gone', async () => {
    renderList();
    const going = screen.getByText('Going soon');
    setTimeout(() => setShown(false), 20);
    await waitForElementToBeRemoved(going);
    await assert.rejects(waitForElementToBeRemoved(going), /already is not/);
    await assert.rejects(
      waitForElementToBeRemoved(() => screen.getByText('Going soon')),
      /already is not/,
    );
  });

  it('gives waitFor the last error once it times out', async () => {
    renderList();
    await assert.rejects(
      waitFor(() => assert.fail('never'), { timeout: 30, interval: 10 }),
      /never/,
    );
    assert.equal(await waitFor(() => 7), 7);
  });

  it('prints the tree, or one node of it', () => {
    renderList();
    const printed: unknown[] = [];
    const log = console.log;
    console.log = (line: unknown) => printed.push(line);
    try {
      screen.debug(screen.getByTestId('second'));
      screen.debug();
    } finally {
      console.log = log;
    }
    assert.match(String(printed[0]), /^View testID="second" accessibilityRole="listitem"/);
    assert.match(String(printed[1]), /^View testID="list"/);
  });

  it('prints a node as its view, its props and its children, not the engine behind it', () => {
    renderList();
    const node = screen.getByTestId('second');
    const printed = inspect(node, { depth: Infinity });
    assert.ok(printed.length < 2000, `printed ${printed.length} characters`);
    assert.match(printed, /Pears/);
    assert.ok(node.instanceHandle, 'the handle is still there for events to use');
    assert.ok(node.children[0]!.instanceHandle, 'and on a clone a later commit made');
  });
});

describe('hidden elements', () => {
  function Hidden() {
    return (
      <View>
        <View style={{ display: 'none' }}>
          <Pressable accessibilityRole="button">
            <Text>Parked</Text>
          </Pressable>
        </View>
        <View accessibilityElementsHidden>
          <Text>Behind a sheet</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants">
          <Text>Decoration</Text>
        </View>
        <Text>Visible</Text>
      </View>
    );
  }

  it('are not found by default', () => {
    render(Hidden);
    assert.equal(screen.queryByText('Parked'), null);
    assert.equal(screen.queryByRole('button'), null);
    assert.equal(screen.queryByText('Behind a sheet'), null);
    assert.equal(screen.queryByText('Decoration'), null);
    assert.ok(screen.getByText('Visible'));
  });

  it('are found when asked for', () => {
    render(Hidden);
    assert.ok(screen.getByText('Parked', { includeHiddenElements: true }));
    assert.ok(screen.getByRole('button', { includeHiddenElements: true }));
  });
});

interface ControlsState {
  events: string[];
  name: () => string;
  setName: (value: string) => void;
  locked: () => string;
  code: () => string;
  fabric: FakeFabric;
}

function renderControls(): ControlsState {
  const events: string[] = [];
  const [name, setName] = createSignal('');
  const [locked, setLocked] = createSignal('');
  const [code, setCode] = createSignal('');
  const log = (event: string) => events.push(event);
  const { fabric } = render(() => (
    <View>
      <Pressable
        testID="button"
        accessibilityRole="button"
        onPress={() => log('press')}
        onLongPress={() => log('longPress')}
      >
        <Text>Go</Text>
      </Pressable>
      <View testID="field-wrapper">
        <TextInput
          placeholder="Name"
          value={name()}
          onValueChange={setName}
          onFocus={() => log('focus')}
          onBlur={() => log('blur')}
          onSubmitEditing={() => log('submit')}
          onKeyPress={(event) => log('key ' + event.nativeEvent.key)}
        />
      </View>
      <TextInput placeholder="Locked" editable={false} value={locked()} onValueChange={setLocked} />
      <TextInput placeholder="Code" maxLength={4} value={code()} onValueChange={setCode} />
      <ScrollView
        testID="scroller"
        onScroll={(event) => log('scroll ' + event.nativeEvent.contentOffset.y)}
      >
        <Text>Content</Text>
      </ScrollView>
    </View>
  ));
  return { events, name, setName, locked, code, fabric };
}

describe('events', () => {
  const field = (): FakeFabricNode => screen.getByPlaceholderText('Name');

  it('presses through the responder, by fireEvent or by name', async () => {
    const { events } = renderControls();
    await fireEvent.press(screen.getByText('Go'));
    await fireEvent(screen.getByRole('button'), 'press');
    assert.deepEqual(events, ['press', 'press']);
  });

  it('long-presses by holding the touch', async () => {
    const { events } = renderControls();
    await userEvent.longPress(screen.getByRole('button'));
    assert.deepEqual(events, ['longPress']);
    await userEvent.setup().longPress(screen.getByRole('button'), { duration: 0 });
    assert.deepEqual(events, ['longPress', 'press'], 'released at once, it is a press');
  });

  it('still presses after a long hold when nothing listens for a long press', async () => {
    let presses = 0;
    render(() => (
      <Pressable accessibilityRole="button" onPress={() => presses++}>
        <Text>Go</Text>
      </Pressable>
    ));
    await userEvent.longPress(screen.getByRole('button'), { duration: 800 });
    assert.equal(presses, 1);
  });

  it('changes text with the next eventCount, at or under the node given', async () => {
    const { name, fabric } = renderControls();
    await fireEvent.changeText(screen.getByTestId('field-wrapper'), 'Ada');
    await fireEvent(field(), 'changeText', 'Ada L');
    assert.equal(name(), 'Ada L');
    assert.equal(field().props['mostRecentEventCount'], 2);
    assert.ok(screen.getByDisplayValue('Ada L'));
    assert.equal(fabric.commands.length, 0, 'an echo, so no setTextAndSelection');
  });

  it('refuses to change text on something that is not a field', async () => {
    renderControls();
    await assert.rejects(fireEvent.changeText(screen.getByTestId('scroller'), 'x'), /No TextInput/);
  });

  it('types a character at a time, then submits and blurs', async () => {
    const { events, name } = renderControls();
    await userEvent.type(field(), 'Hi', { submitEditing: true });
    assert.equal(name(), 'Hi');
    assert.equal(field().props['mostRecentEventCount'], 2, 'one change per character');
    assert.deepEqual(events, ['focus', 'key H', 'key i', 'submit', 'blur']);
  });

  it('types onto what is already there, and can leave the field focused', async () => {
    const { events, name, setName } = renderControls();
    setName('A');
    await settle();
    await userEvent.type(field(), 'b', { skipBlur: true });
    assert.equal(name(), 'Ab');
    assert.deepEqual(events, ['focus', 'key b']);
  });

  it('clears a field', async () => {
    const { events, name } = renderControls();
    await userEvent.type(field(), 'Ada');
    await userEvent.clear(field());
    assert.equal(name(), '');
    assert.equal(events.at(-1), 'blur');
  });

  it('stops at maxLength, the way native truncates before onChangeText ever fires', async () => {
    const { code } = renderControls();
    await userEvent.type(screen.getByPlaceholderText('Code'), '123456');
    assert.equal(code(), '1234', 'native never calls back with more than maxLength');
  });

  it('leaves a field that is not editable alone', async () => {
    const { locked } = renderControls();
    await userEvent.type(screen.getByPlaceholderText('Locked'), 'x');
    await userEvent.clear(screen.getByPlaceholderText('Locked'));
    assert.equal(locked(), '');
  });

  it('focuses, blurs and scrolls', async () => {
    const { events } = renderControls();
    await fireEvent.focus(field());
    await fireEvent.blur(field());
    await fireEvent.scroll(screen.getByTestId('scroller'), {
      nativeEvent: { contentOffset: { x: 0, y: 120 } },
    });
    await fireEvent(screen.getByTestId('scroller'), 'scroll', { contentOffset: { x: 0, y: 5 } });
    assert.deepEqual(events, ['focus', 'blur', 'scroll 120', 'scroll 5']);
  });

  it('fires any other event by name, top prefix or not', async () => {
    const { events } = renderControls();
    await fireEvent(field(), 'submitEditing', { text: 'x' });
    await fireEvent(field(), 'topFocus');
    assert.deepEqual(events, ['submit', 'focus']);
  });
});

function Labelled(props: { label?: string; count?: number }) {
  return (
    <Text>
      {props.label ?? 'Count'} {props.count ?? 0}
    </Text>
  );
}

describe('render', () => {
  it('renders with props, and updates them in place', () => {
    const { setProps } = render(Labelled, { props: { label: 'Total' } });
    assert.ok(screen.getByText('Total 0'));
    setProps({ count: 3 });
    assert.ok(screen.getByText('Total 3'), 'merged into the props it had');
    setProps({ label: 'Sum' });
    assert.ok(screen.getByText('Sum 3'));
  });

  it('queries the latest render on screen, and each render keeps its own', () => {
    const first = render(Labelled);
    const second = render(() => (
      <View>
        <Labelled />
        <Labelled />
      </View>
    ));
    assert.equal(screen.getAllByText('Count 0').length, 2, 'screen is the latest render');
    assert.ok(first.getByText('Count 0'), 'and each render keeps its own queries');
    second.unmount();
    second.unmount();
    assert.ok(screen.getByText('Count 0'), 'the one before it is current again');
  });

  it('unmounts through the native root, clearing what it committed', () => {
    const { fabric, root, unmount } = render(Labelled);
    assert.equal(fabric.committed.length, 1);
    unmount();
    assert.equal(root.disposed, true);
    assert.equal(fabric.committed.length, 0);
  });

  it('commits on a hand-driven clock only when flushed', () => {
    const clock = createClock();
    const [count, setCount] = createSignal(0);
    const { flush, getByText } = render(() => <Labelled count={count()} />, { clock });
    assert.ok(getByText('Count 0'), 'the first frame commits at once');
    setCount(1);
    assert.ok(getByText('Count 0'), 'nothing runs until the clock does');
    flush();
    assert.ok(getByText('Count 1'));
  });

  it('settles a hand-driven clock too', async () => {
    const clock = createClock();
    const [count, setCount] = createSignal(0);
    render(() => <Labelled count={count()} />, { clock });
    setCount(2);
    await settle();
    assert.ok(screen.getByText('Count 2'));
  });

  it('mounts an app through its own boot function', () => {
    let disposed = false;
    const { root, getByText, unmount } = renderWith(({ fabric, rootTag, clock }) => {
      const native = createNativeRoot({ fabric, rootTag, clock });
      native.render(() => <Labelled label="Booted" />);
      return {
        flush: native.flush,
        dispose() {
          disposed = true;
          native.dispose();
        },
      };
    });
    assert.ok(getByText('Booted 0'));
    assert.equal(typeof root.flush, 'function');
    unmount();
    assert.equal(disposed, true);
  });

  it('uses iOS view names by default', () => {
    render(() => <TextInput placeholder="Name" />);
    assert.equal(screen.getByPlaceholderText('Name').viewName, 'TextInput');
  });

  it('says so when nothing is rendered', () => {
    cleanup();
    assert.throws(() => screen.getByText('x'), /call render\(\) first/);
  });

  it('defines __DEV__ as a development build does', () => {
    assert.equal(__DEV__, true);
  });
});
