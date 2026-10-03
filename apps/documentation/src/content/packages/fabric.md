---
title: Fabric
summary: The retained tree, native view mapping and CSS engine underneath every rendered screen.
---

# Fabric

`@solid-native/fabric` is the framework-agnostic engine: a retained node tree, a commit step that
makes one call into Fabric, and a CSS engine with a real cascade. No UI framework, no DOM.

You rarely import it directly. [`@solid-native/platform/solid`'s
renderer](/packages/platform/renderer) drives it and `@solid-native/components/solid` builds on it.
The exceptions: the entry file's `getFabricUIManager()` and `registerPlatformComponents()`,
`nativePlatform()` for per-platform answers, `registerViewName()` for a third-party Fabric
component without bindings, and the `FabricUIManager` type a test's fake implements.

## From an element to a native view

Every host element (`view`, `text`, `scroll-view`, `pressable`) is a node in a retained tree, and a
lookup table maps it to a Fabric component name: `view` to `View`, `text` to `Paragraph`,
`scroll-view` to `ScrollView`, `switch` to `Switch`, and so on. `pressable` and `touchable-opacity`
commit as a plain `View` (press handling is JavaScript), as does any unregistered host name.

Add a third-party Fabric component such as `react-native-screens` with
`registerViewName('rns-screen', 'RNSScreen')`, optionally with `defaultProps` for a native view
whose React wrapper normally supplies a base style (`ScrollView` and `Modal` need this; it is
already applied). `registerPlatformComponents(Platform.OS)` swaps in the Android-specific names
(`Switch` to `AndroidSwitch`, `TextInput` to `AndroidTextInput`, and so on); [the entry
file](/packages/platform/bootstrapping) calls it before mounting.

## Commits

A commit clones the changed tree and hands Fabric one `completeRoot` call; unchanged subtrees are
passed by reference. The Solid root's scheduler batches every mutation in one reactive update and
commits once in a microtask; you never call `engine.commit()`. `engine.stats` tracks commit
counts and timings.

## The CSS engine

A component's `.native.css` import is real CSS: compiled to a rule set at build time, then matched
against the tree at runtime with selectors, specificity, inheritance, custom properties and media
queries. [The CSS engine](/packages/fabric/css-engine) covers that split; [what CSS reaches a
device](/packages/fabric/supported-css) lists which selectors, properties and values compile;
[animation](/packages/fabric/animation) covers transitions and `@keyframes`.
