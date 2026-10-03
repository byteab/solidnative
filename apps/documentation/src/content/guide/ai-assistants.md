---
title: Using AI assistants
summary: What a coding agent needs to build with solid-native, and where it finds it.
---

# Using AI assistants

An agent that knows Solid and React Native but not solid-native may import `solid-js/web`, use
`document`, write `<div onClick>` or drop the `@jsxImportSource @solidnative/platform/solid`
comment: code that compiles but renders nothing. Two resources fix this without setup.

## `AGENTS.md` in every new app

The template ships a root `AGENTS.md` and a `CLAUDE.md` pointing to it, which Claude Code, Cursor,
GitHub Copilot, Codex and most other agents read automatically. They cover `.solid.tsx` and the
pragma, native components, the absence of a DOM, `<Text>`, native event props, styling, lists,
navigation, and the run and test commands. `nx g @solidnative/nx:app` writes both into the new
app's directory with that workspace's `nx` commands, leaving the workspace's own agent files alone.

The file defers to [docs.solidjs.com](https://docs.solidjs.com) for signals, effects, stores and
components, flags the parts that assume a DOM, and wins where the two disagree. Add your app's
conventions as it grows.

## The docs, as text

- [`/llms.txt`](/llms.txt): the site in outline, a line per page ([llmstxt.org](https://llmstxt.org)).
- Every page as markdown at its address plus `.md`:
  [`/guide/getting-started.md`](/guide/getting-started.md).
- [`/llms-full.txt`](/llms-full.txt): every page in one file, in reading order.

Use `/llms.txt` for lookups and `/llms-full.txt` to read everything first. Both are generated from
the site's markdown on each build.

## An existing app

For an app set up by hand, save [`/agents.md`](/agents.md) as `AGENTS.md` at the app's root and add
a Commands section with your app's commands. It is the template's file minus the template's
commands, rebuilt on every deploy of this site.
