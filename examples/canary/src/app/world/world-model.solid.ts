function arabicCategory(count: number): Intl.LDMLPluralRule {
  if (count === 0) return 'zero';
  if (count === 1) return 'one';
  if (count === 2) return 'two';
  const remainder = count % 100;
  if (Number.isInteger(remainder) && remainder >= 3 && remainder <= 10) return 'few';
  if (Number.isInteger(remainder) && remainder >= 11 && remainder <= 99) return 'many';
  return 'other';
}

function frenchCategory(count: number, integer: number, decimals: number): Intl.LDMLPluralRule {
  if (integer === 0 || integer === 1) return 'one';
  const exponent = Number.parseInt(count.toString().replace(/^[^e]*(e([-+]?\d+))?/, '$2')) || 0;
  return (exponent === 0 && integer !== 0 && integer % 1_000_000 === 0 && decimals === 0) ||
    exponent < 0 ||
    exponent > 5
    ? 'many'
    : 'other';
}

function hebrewCategory(integer: number, decimals: number): Intl.LDMLPluralRule {
  if ((integer === 1 && decimals === 0) || (integer === 0 && decimals !== 0)) return 'one';
  return integer === 2 && decimals === 0 ? 'two' : 'other';
}

/** Deterministic cardinal rules for the seven supported locales; Hermes need not expose Intl.PluralRules. */
export function pluralCategory(tag: string, count: number): Intl.LDMLPluralRule {
  const integer = Math.floor(Math.abs(count));
  const decimals = count.toString().replace(/^[^.]*\.?/, '').length;
  switch (tag) {
    case 'ar-EG':
      return arabicCategory(count);
    case 'fr-FR':
      return frenchCategory(count, integer, decimals);
    case 'he-IL':
      return hebrewCategory(integer, decimals);
    case 'hi-IN':
      return integer === 0 || count === 1 ? 'one' : 'other';
    case 'ja-JP':
      return 'other';
    default:
      return integer === 1 && decimals === 0 ? 'one' : 'other';
  }
}

/** The locales the screen shows, each in its own words, and which way it is written. */
export interface Locale {
  readonly tag: string;
  readonly name: string;
  readonly direction: 'ltr' | 'rtl';
  readonly currency: string;
  /** The message for each plural category the language has, `#` standing for the number. */
  readonly messages: Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };
}

export const LOCALES: readonly Locale[] = [
  {
    tag: 'en-GB',
    name: 'English',
    direction: 'ltr',
    currency: 'GBP',
    messages: { zero: 'No new messages', one: '# new message', other: '# new messages' },
  },
  {
    tag: 'de-DE',
    name: 'Deutsch',
    direction: 'ltr',
    currency: 'EUR',
    messages: { one: '# neue Nachricht', other: '# neue Nachrichten' },
  },
  {
    tag: 'fr-FR',
    name: 'Français',
    direction: 'ltr',
    currency: 'EUR',
    messages: {
      one: '# nouveau message',
      many: '# de nouveaux messages',
      other: '# nouveaux messages',
    },
  },
  {
    tag: 'ar-EG',
    name: 'العربية',
    direction: 'rtl',
    currency: 'EGP',
    messages: {
      zero: 'لا توجد رسائل جديدة',
      one: 'رسالة جديدة واحدة',
      two: 'رسالتان جديدتان',
      few: '# رسائل جديدة',
      many: '# رسالة جديدة',
      other: '# رسالة جديدة',
    },
  },
  {
    tag: 'he-IL',
    name: 'עברית',
    direction: 'rtl',
    currency: 'ILS',
    messages: { one: 'הודעה חדשה אחת', two: 'שתי הודעות חדשות', other: '# הודעות חדשות' },
  },
  {
    tag: 'hi-IN',
    name: 'हिन्दी',
    direction: 'ltr',
    currency: 'INR',
    messages: { one: '# नया संदेश', other: '# नए संदेश' },
  },
  {
    tag: 'ja-JP',
    name: '日本語',
    direction: 'ltr',
    currency: 'JPY',
    messages: { other: '新着メッセージ #件' },
  },
];

/**
 * The message for a count in a locale: the locale's cardinal category, the
 * number written the locale's way. English's `zero` is a choice of wording, not a category, so it
 * is only used for zero exactly, as ICU's `=0` would.
 */
export function message(locale: Locale, count: number): string {
  const category = pluralCategory(locale.tag, count);
  const exact = count === 0 && locale.messages.zero ? 'zero' : category;
  const template = locale.messages[exact] ?? locale.messages.other;
  return template.replace('#', new Intl.NumberFormat(locale.tag).format(count));
}

/** A sample amount, date and number, formatted as the locale writes them. */
export function samples(
  locale: Locale,
  when: Date,
): { money: string; date: string; number: string } {
  return {
    money: new Intl.NumberFormat(locale.tag, {
      style: 'currency',
      currency: locale.currency,
    }).format(1234.5),
    date: new Intl.DateTimeFormat(locale.tag, { dateStyle: 'full' }).format(when),
    number: new Intl.NumberFormat(locale.tag).format(12345678.9),
  };
}

/** Text that is hard to lay out, and why. */
export const SCRIPTS: readonly { readonly label: string; readonly text: string }[] = [
  {
    label: 'A word longer than the line',
    text: 'Donaudampfschifffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft',
  },
  {
    label: 'Chinese, no spaces to break at',
    text: '敏捷的棕色狐狸跳过了那只懒狗，然后又跑回了森林里去找它的朋友们。',
  },
  { label: 'Thai, no spaces between words', text: 'สุนัขจิ้งจอกสีน้ำตาลกระโดดข้ามสุนัขขี้เกียจ' },
  { label: 'Emoji made of several', text: '👩‍👩‍👧‍👦 🏳️‍🌈 🧑🏽‍🚀 👍🏿 🇬🇧 🫶🏼' },
  { label: 'Combining marks stacked up', text: 'Z̷̢̛a̶̧͝l̵̨̛g̸̡͝o̴̢͠ t̷̨̕e̵̢͝x̶̧̕t̸̨͝' },
  {
    label: 'Right to left and left to right in one line',
    text: 'Order #1234 شكراً لك, see you at 10:30 غداً',
  },
];
