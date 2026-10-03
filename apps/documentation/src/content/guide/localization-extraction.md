---
title: Extracting messages
summary: There is no extractor for Solid sources; the typed source catalog is the message list.
---

# Extracting messages

Solid components hold plain JSX expressions, not marked-up text, so there is no extractor. The
source catalog from [Localization](/guide/localization) is the message list, and TypeScript keeps
translations in step with it.

## Add a language

Copy `locale/en.ts` to `locale/fr.ts`, type it as `Messages`, and translate the values. Keep each
function's parameters; place them where the grammar needs:

```ts
// locale/fr.ts
import type { Messages } from './en.ts';

export const fr: Messages = {
  home: {
    title: 'Votre panier',
    greeting: (name: string) => `Bonjour, ${name} !`,
  },
  checkout: { pay: 'Payer' },
  dialog: { close: 'Fermer la boîte de dialogue' },
  settings: { followDevice: "Utiliser la langue de l'appareil" },
  basket: {
    count: (count: number) =>
      count === 0 ? 'Votre panier est vide' : count === 1 ? 'Un article' : `${count} articles`,
  },
};
```

French uses the singular for 0 and 1, but the empty basket has its own sentence. Each catalog owns
its plural rule.

## Keep catalogs complete

Run the typecheck after changing the source catalog:

```sh
npm run typecheck
```

A key missing from `fr.ts`, a renamed key, or a changed function signature is an error naming the
file and key, so nothing ships half-translated.

## Working with translators

Translators can edit `fr.ts` directly: plain literals and template strings with named parameters.
For a translation service's file format, convert the string leaves with your own script; keep
functions in TypeScript, since a plural rule is code.

Next: [Loading a language](/guide/localization-loading) puts `fr.ts` into the app.
