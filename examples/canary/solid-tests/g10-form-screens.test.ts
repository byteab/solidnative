import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provideService } from '@solidnative/device/solid';
import { registerExpoUiViews } from '@solidnative/expo/views';
import type { FakeNode } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { consumerFixture } from './consumer-fixture.tsx';
import { bootConsumer } from './consumer-harness.ts';
import { FormsPage } from '../src/app/forms/forms.solid.tsx';
import { ApplicationPage } from '../src/app/forms/application.solid.tsx';
import { Usernames, UsernameChecks } from '../src/app/forms/application-form.solid.ts';

type Harness = ReturnType<typeof bootConsumer>;
const field = (h: Harness, label: string) => {
  const node = h.nodes().find((node) => node.props['accessibilityLabel'] === label);
  assert.ok(node, label);
  return node;
};
const change = (h: Harness, label: string, value: boolean) => {
  h.fabric.emit(field(h, label), 'topChange', { value });
  h.clock.flushMicrotasks();
};
const select = (h: Harness, label: string, selection: string) => {
  const picker = h
    .nodes()
    .find((node) => node.instanceHandle.name === 'ui-picker' && node.props['label'] === label);
  assert.ok(picker, label);
  h.fabric.emit(picker, 'topSelectionChange', { selection });
  h.clock.flushMicrotasks();
};
const focused = (h: Harness) => {
  const labels: unknown[] = [];
  Object.assign(h.fabric, {
    dispatchCommand(node: FakeNode, command: string) {
      if (command === 'focus') labels.push(node.props['accessibilityLabel']);
    },
  });
  return labels;
};

for (const platform of ['ios', 'android'] as const) {
  test(`actual ${platform} forms keep required/short validation and every rapid input`, async (t) => {
    const fixture = consumerFixture(() => [{ path: 'forms', component: FormsPage }]);
    const h = bootConsumer(fixture, platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/forms');
    h.finish();
    assert.match(h.renderedText(), /1 validation error\(s\)/);
    const input = () => h.nodes().find((node) => node.props['placeholder'] === 'name')!;
    const tag = input().tag;
    for (const [index, text] of ['a', 'ab', 'abc', 'abcdefgh'].entries()) {
      h.fabric.emit(input(), 'topChange', { text, eventCount: index + 1 });
      h.clock.flushMicrotasks();
      assert.equal(input().props['text'], text);
    }
    assert.equal(input().tag, tag);
    assert.match(h.renderedText(), /valid/);
    assert.match(h.renderedText(), /"name":"abcdefgh"/);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} application preserves fields, keyboard focus and conditional native identity`, async (t) => {
    const fixture = consumerFixture(() => [{ path: 'application', component: ApplicationPage }]);
    const h = bootConsumer(fixture, platform);
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    const labels = focused(h);
    await fixture.navigation().reset('/application');
    h.finish();
    assert.ok(
      h.nodes().filter((node) => ['text-input', 'switch'].includes(node.instanceHandle.name))
        .length >= 15,
    );
    assert.ok(
      h.nodes().filter((node) => ['ui-picker', 'ui-date-picker'].includes(node.instanceHandle.name))
        .length >= 2,
    );
    assert.equal(
      field(h, 'About you').props['minHeight'],
      88,
      'projected control keeps application CSS',
    );
    h.fabric.emit(field(h, 'First name'), 'topSubmitEditing', { text: '' });
    h.fabric.emit(field(h, 'Postcode'), 'topSubmitEditing', { text: '' });
    h.clock.flushMicrotasks();
    assert.deepEqual(labels, ['Last name', 'Username']);
    const emailTag = field(h, 'Email').tag;
    select(h, 'Country', 'US');
    assert.equal(field(h, 'ZIP code').props['keyboardType'], 'number-pad');
    assert.ok(h.nodes().some((node) => node.props['label'] === 'State'));
    assert.doesNotMatch(h.renderedText(), /How often/);
    change(h, 'Newsletter', true);
    assert.match(h.renderedText(), /How often/);
    assert.match(h.renderedText(), /Add a phone number/);
    h.input('Phone', '0207 946 0000');
    assert.doesNotMatch(h.renderedText(), /Add a phone number/);
    assert.equal(field(h, 'Text messages').props['disabled'], false);
    assert.equal(field(h, 'Email').tag, emailTag);
    const creates = h.fabric.creates;
    h.input('First name', 'A');
    h.input('First name', 'Ad', 2);
    assert.equal(h.fabric.creates, creates, 'typing preserves all native controls');
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} application keeps dependant values and native identity after removal`, async (t) => {
    const fixture = consumerFixture(() => [{ path: 'application', component: ApplicationPage }]);
    const h = bootConsumer(fixture, platform);
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    await fixture.navigation().reset('/application');
    h.finish();
    h.press('Add a dependant');
    h.press('Add a dependant');
    h.input('Dependant 1 name', 'Alan');
    h.input('Dependant 2 name', 'Bea');
    const tag = field(h, 'Dependant 2 name').tag;
    const remove = h
      .nodes()
      .find((node) => node.props['accessibilityLabel'] === 'Remove dependant 1');
    assert.ok(remove);
    h.press('Remove', remove);
    assert.equal(field(h, 'Dependant 1 name').props['text'], 'Bea');
    assert.equal(field(h, 'Dependant 1 name').tag, tag);
    assert.ok(!h.nodes().some((node) => node.props['accessibilityLabel'] === 'Dependant 2 name'));
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} application debounces usernames and focuses first invalid on submit`, async (t) => {
    const usernames = new UsernameChecks();
    usernames.latency = 1;
    const fixture = consumerFixture(
      () => [{ path: 'application', component: ApplicationPage }],
      [provideService(Usernames, () => usernames)],
    );
    const h = bootConsumer(fixture, platform);
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    const labels = focused(h);
    await fixture.navigation().reset('/application');
    h.finish();
    h.input('Username', 'a');
    h.input('Username', 'ad', 2);
    h.input('Username', 'ada', 3);
    h.fabric.emit(field(h, 'Username'), 'topBlur');
    h.clock.flushMicrotasks();
    // Explicitly exceed the actual 300ms debounce, rather than changing production timing.
    await new Promise((resolve) => setTimeout(resolve, 330));
    await h.waitFor(() => h.renderedText().includes('That username is taken'));
    assert.equal(usernames.checks, 1);
    h.press('Apply');
    await h.waitFor(() => labels.includes('First name'));
    assert.match(h.renderedText(), /Enter your first name/);
    assert.match(h.renderedText(), /Accept the terms to continue/);
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} application submits valid values and cancels covered completion`, async (t) => {
    const usernames = new UsernameChecks();
    usernames.latency = 1;
    const fixture = consumerFixture(
      () => [
        { path: 'application', component: ApplicationPage },
        { path: 'cover', component: () => null },
      ],
      [provideService(Usernames, () => usernames)],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    await nav.reset('/application');
    h.finish();
    for (const [label, text] of [
      ['First name', 'Ada'],
      ['Last name', 'Lovelace'],
      ['Email', 'ada@example.com'],
      ['Address line 1', '1 Example Street'],
      ['Town or city', 'London'],
      ['Postcode', 'SW1A 1AA'],
      ['Username', 'ada_2026'],
      ['Password', 'password123'],
      ['Confirm password', 'password123'],
    ])
      h.input(label!, text!);
    const birth = field(h, 'Date of birth');
    const event = platform === 'ios' ? 'topDateChange' : 'topDateSelected';
    // The first report describes an initially empty native picker; the second is the edit.
    h.fabric.emit(birth, event, { date: '2000-01-01T00:00:00.000Z' });
    h.fabric.emit(birth, event, { date: '2000-01-01T00:00:00.000Z' });
    change(h, 'I accept the terms', true);
    h.press('Apply');
    assert.match(h.renderedText(), /Sending/);
    // Cover before validation completes; that older request must not start its delayed action
    // or publish success when the retained form returns to the foreground.
    await nav.push('/cover');
    h.finish();
    await nav.back();
    h.finish();
    await new Promise((resolve) => setTimeout(resolve, 380));
    await h.waitFor(() => h.renderedText().includes('Apply'));
    assert.doesNotMatch(h.renderedText(), /Application sent/);
    h.press('Apply');
    await new Promise((resolve) => setTimeout(resolve, 450));
    await h.waitFor(() => h.renderedText().includes('Application sent.'));
    assert.equal(usernames.checks, 1, 'unrelated field edits do not restart username validation');
    assert.deepEqual(fixture.errors, []);
  });

  test(`actual ${platform} application never focuses a covered field after validation settles`, async (t) => {
    const usernames = new UsernameChecks();
    usernames.latency = 1;
    const fixture = consumerFixture(
      () => [
        { path: 'application', component: ApplicationPage },
        { path: 'cover', component: () => null },
      ],
      [provideService(Usernames, () => usernames)],
    );
    const h = bootConsumer(fixture, platform),
      nav = fixture.navigation();
    registerExpoUiViews(platform);
    t.after(() => h.root.dispose());
    const labels = focused(h);
    await nav.reset('/application');
    h.finish();
    h.input('Username', 'fresh_name');
    h.press('Apply');
    await nav.push('/cover');
    h.finish();
    await new Promise((resolve) => setTimeout(resolve, 350));
    h.clock.flushMicrotasks();
    assert.equal(labels.length, 0);
    await nav.back();
    h.finish();
    // Back can still be settling on a loaded machine; press once the form is on screen again.
    await h.waitFor(() => h.renderedText().includes('Apply'));
    h.press('Apply');
    await h.waitFor(() => labels.includes('First name'));
    assert.deepEqual(labels, ['First name']);
    assert.deepEqual(fixture.errors, []);
  });
}
