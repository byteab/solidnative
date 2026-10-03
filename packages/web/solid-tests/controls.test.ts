/**
 * The shared Solid controls against `BrowserEngine`: a real `<textarea>` for `TextInput`, a real
 * checkbox for `Switch`, an `ImageBackground` mirroring its outer size, styled and validated fields
 * built from them, a one-time-code field, and fields bound to a form - each driven by real DOM
 * events and read back from the DOM and the signals it renders from.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boot, settle } from './boot.ts';
import { controls, fieldForms, otp, textFields } from './fixtures.solid.tsx';

describe('TextInput, over a real <textarea>', () => {
  it('commits as a textarea and carries the placeholder', () => {
    const { element, root } = boot(controls().view);
    const field = element.querySelector('[data-rn="text-input"]') as HTMLTextAreaElement;
    assert.equal(field.tagName, 'TEXTAREA');
    assert.equal(field.placeholder, 'Say something');
    root.dispose();
  });

  it('reflects a real keystroke back into the value signal', () => {
    const fixture = controls();
    const { element, root, input } = boot(fixture.view);
    input(element.querySelector('[data-rn="text-input"]') as HTMLTextAreaElement, 'hello');
    assert.equal(fixture.text(), 'hello');
    root.dispose();
  });

  it('reflects a signal change back into the field', async () => {
    const fixture = controls();
    const { element, root } = boot(fixture.view);
    const field = element.querySelector('[data-rn="text-input"]') as HTMLTextAreaElement;
    fixture.setText('set from code');
    await settle();
    assert.equal(field.value, 'set from code');
    root.dispose();
  });
});

describe('Switch, over a real checkbox', () => {
  const change = (toggle: HTMLInputElement, window: Window & typeof globalThis) => {
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  it('commits as a checkbox with the switch role', () => {
    const { element, root } = boot(controls().view);
    const toggle = element.querySelector('[data-rn="switch"]') as HTMLInputElement;
    assert.equal(toggle.type, 'checkbox');
    assert.equal(toggle.getAttribute('role'), 'switch');
    root.dispose();
  });

  it('reflects a real click back into the checked signal', () => {
    const fixture = controls();
    const { element, window, root } = boot(fixture.view);
    change(element.querySelector('[data-rn="switch"]') as HTMLInputElement, window);
    assert.equal(fixture.on(), true);
    root.dispose();
  });

  it('unticks the checkbox again when the app refuses the flip', async () => {
    const fixture = controls();
    const { element, window, root } = boot(fixture.view);
    const toggle = element.querySelectorAll('[data-rn="switch"]')[1] as HTMLInputElement;
    change(toggle, window);
    await settle();
    assert.equal(fixture.kept(), false);
    assert.equal(toggle.checked, false, 'the setValue command reached the checkbox');
    root.dispose();
  });

  it('reflects a signal change back into the checkbox', () => {
    const fixture = controls();
    const { element, root } = boot(fixture.view);
    fixture.setOn(true);
    assert.equal((element.querySelector('[data-rn="switch"]') as HTMLInputElement).checked, true);
    root.dispose();
  });
});

describe("ImageBackground's outer size mirror", () => {
  it("copies the outer view's width/height onto the absolutely-filled inner image", () => {
    const { element, root } = boot(controls().view);
    const inner = element.querySelector('[data-rn="image"]') as HTMLElement;
    const outer = inner.parentElement as HTMLElement;
    assert.equal(outer.style.width, '120px');
    assert.equal(outer.style.height, '80px');
    assert.equal(inner.style.width, '120px');
    assert.equal(inner.style.height, '80px');
    assert.equal(inner.style.position, 'absolute');
    root.dispose();
  });
});

describe('styled text fields', () => {
  const setup = () => {
    const fixture = textFields();
    const booted = boot(fixture.view);
    const field = (id: string) => booted.byId(id).querySelector('textarea')!;
    return { fixture, ...booted, field };
  };

  it('reflects a real keystroke into the value signal', () => {
    const { fixture, root, field, input } = setup();
    input(field('plain'), 'hello@example.com');
    assert.equal(fixture.value(), 'hello@example.com');
    root.dispose();
  });

  it('marks the box data-disabled, and stops editing, once disabled', () => {
    const { fixture, root, byId, field } = setup();
    assert.equal(byId('plain').getAttribute('data-disabled'), null);
    fixture.setOff(true);
    assert.equal(byId('plain').getAttribute('data-disabled'), '');
    assert.equal(field('plain').readOnly, true, 'editable=false -> readOnly');
    root.dispose();
  });

  it('carries no data-invalid until both invalid and touched are true', () => {
    const { fixture, root, byId } = setup();
    const el = byId('validated');
    assert.equal(el.getAttribute('data-invalid'), null);
    fixture.setInvalid(true);
    assert.equal(el.getAttribute('data-invalid'), null, 'invalid alone is not enough');
    fixture.setTouched(true);
    assert.equal(el.getAttribute('data-invalid'), '', 'invalid and touched together');
    root.dispose();
  });

  it('sets data-focus on a real focus, and clears it on blur', async () => {
    const { root, byId, field } = setup();
    const el = byId('validated');
    field('validated').focus();
    await settle();
    assert.equal(el.getAttribute('data-focus'), '', 'a real DOM focus, not a simulated one');
    field('validated').blur();
    await settle();
    assert.equal(el.getAttribute('data-focus'), null);
    root.dispose();
  });

  it('fires the blur handler a form marks a field touched from', async () => {
    const { fixture, root, field } = setup();
    assert.equal(fixture.touchedFired(), false);
    field('validated').focus();
    field('validated').blur();
    await settle();
    assert.equal(fixture.touchedFired(), true);
    root.dispose();
  });

  it('reflects a real keystroke into a multiline field the same way', () => {
    const { fixture, root, field, input } = setup();
    input(field('notes'), 'a couple of lines');
    assert.equal(fixture.notes(), 'a couple of lines');
    root.dispose();
  });
});

describe('a one-time-code field', () => {
  const setup = () => {
    const fixture = otp();
    const booted = boot(fixture.view);
    const hidden = () =>
      booted.byId('otp').querySelector('[data-slot="input-otp-field"]') as HTMLTextAreaElement;
    const glyphs = () =>
      [...booted.byId('otp').querySelectorAll('textarea')].filter((el) => el !== hidden());
    return { fixture, ...booted, hidden, glyphs };
  };

  it('renders one glyph box per slot', () => {
    const { root, glyphs } = setup();
    assert.equal(glyphs().length, 4);
    root.dispose();
  });

  it('reflects typed characters into the value signal and the glyph boxes', async () => {
    const { fixture, root, hidden, glyphs, input } = setup();
    input(hidden(), '12');
    await settle();
    assert.equal(fixture.code(), '12');
    assert.deepEqual(
      glyphs().map((glyph) => glyph.value),
      ['1', '2', '', ''],
    );
    root.dispose();
  });

  it('fires complete once the value reaches the configured length, and not before', () => {
    const { fixture, root, hidden, input } = setup();
    input(hidden(), '123');
    assert.equal(fixture.completions.length, 0, 'one short still');
    input(hidden(), '1234');
    assert.deepEqual(fixture.completions, ['1234']);
    root.dispose();
  });

  it('does not accept edits while disabled', () => {
    const { fixture, root, hidden } = setup();
    fixture.setDisabled(true);
    assert.equal(hidden().readOnly, true, 'editable=false -> readOnly');
    root.dispose();
  });
});

describe('fields bound to a form', () => {
  const setup = () => {
    const fixture = fieldForms();
    const booted = boot(fixture.view);
    const field = (id: string) => booted.byId(id).querySelector('textarea')!;
    const messagesOf = (id: string) =>
      [...booted.byId(id).querySelectorAll('text')].map((node) => node.textContent);
    const touch = async (id: string) => {
      field(id).focus();
      field(id).blur();
      await settle();
    };
    return { fixture, ...booted, field, messagesOf, touch };
  };

  it('shows no error before the required field has been touched', () => {
    const { root, messagesOf } = setup();
    assert.deepEqual(messagesOf('email-error'), []);
    root.dispose();
  });

  it('shows the required message once a real blur marks the field touched', async () => {
    const { root, messagesOf, touch } = setup();
    await touch('email');
    assert.deepEqual(messagesOf('email-error'), ['Email is required']);
    root.dispose();
  });

  it('clears the message once a real keystroke satisfies the rule', async () => {
    const { root, messagesOf, touch, input, field } = setup();
    await touch('email');
    input(field('email'), 'alex@example.com');
    assert.deepEqual(messagesOf('email-error'), []);
    root.dispose();
  });

  it('writes the keystroke through to the form model, not just the field', () => {
    const { fixture, root, input, field } = setup();
    input(field('email'), 'alex@example.com');
    assert.equal(fixture.form.value().email, 'alex@example.com');
    root.dispose();
  });

  it('shows an always-on error immediately, with no touch needed', () => {
    const { root, messagesOf } = setup();
    assert.deepEqual(messagesOf('notes-error'), ['Say a little more']);
    root.dispose();
  });

  it('clears the always-on error once a real keystroke satisfies minLength', () => {
    const { root, messagesOf, input, field } = setup();
    input(field('notes'), 'a proper sentence');
    assert.deepEqual(messagesOf('notes-error'), []);
    root.dispose();
  });
});
