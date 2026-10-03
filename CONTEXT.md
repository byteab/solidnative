# solid-native

Solid applications rendering real native iOS and Android views on React Native's Fabric
renderer, with React never in the render path. This glossary fixes the words the project uses for
its own concepts, so that a name means one thing everywhere.

## Language

**Engine**:
The framework-agnostic retained tree and the code that commits it to Fabric. Knows nothing about
Solid or any other UI framework. Lives in `@solid-native/fabric`, which is named for what it talks to.
_Avoid_: renderer, reconciler

**Platform**:
The one Solid-aware layer: Solid's universal renderer over the engine, the native root with its
commit scheduler, and the mount onto a React Native surface. The same role `solid-js/web` plays for
the DOM. Lives in `@solid-native/platform`.
_Avoid_: bridge, integration

**Node**:
One entry in the engine's retained tree. May be an element, a text node, or an anchor.
_Avoid_: element (an element is one kind of node), view

**Anchor**:
A node that takes part in sibling ordering but is never sent to Fabric: a placeholder for a host
that needs one among siblings.
_Avoid_: comment, marker

**Commit**:
One handover of a changed tree to Fabric. Reactive changes made in one synchronous run coalesce
into at most one commit, on the next microtask.
_Avoid_: flush, render, paint

**Sheet**:
One component's `.native.css` file, compiled at build time into a sorted rule set and applied to
the component's nodes with `withNativeStyles`.
_Avoid_: styles, stylesheet object, CSS

**Global sheet**:
An application-level sheet matched against every node, whatever component created it. The only
rules that deliberately cross a component boundary.
_Avoid_: root styles, app styles

**Host node**:
The node a component's sheet treats as its host (`setNativeStyleHost`). It sits where the parent
placed it, which is why the parent's sheet styles it as well as the component's own.
_Avoid_: root element, component element

**Condition set**:
The device state that media queries are evaluated against: viewport size, orientation and colour
scheme. Changing it re-resolves styles without any property having changed.
_Avoid_: environment, media state

**Token**:
A CSS custom property. Cascades down the node tree, so a parent may retheme a child component's
internals even though ordinary rules cannot.
_Avoid_: variable, theme value

**Screen**:
One destination on the native stack: a `RNSScreen` the outlet creates per activated route, holding
the page component itself. Screens below the top stay mounted, which is what
keeps a pushed-away page's native state alive.
_Avoid_: page (a page is the component, the screen is what it is mounted on), route, view

**Presentation**:
How a screen enters the stack: pushed, or presented as a sheet, a modal or a full-screen modal.
Native has a vocabulary for this that a URL cannot express, so it travels as navigation state
rather than in the path.
_Avoid_: mode, style, transition

**Navigation intent**:
What a call site meant by a navigation: push, replace, present or reset. A property of the journey
rather than of the destination, which is why the same screen can be pushed from one place and
presented as a sheet from another.
_Avoid_: action, command

**Header**:
The native title bar belonging to a screen, holding its title, the back button and any items the
page puts either side of them. Owned by the screen, not drawn by the page, and it consumes the top
safe-area inset on the page's behalf.
_Avoid_: navbar, toolbar, app bar

**Host primitive**:
A component in `@solid-native/components` whose host element is one native view: `View`,
`Text`, `Image`, `ScrollView` and the rest. Each carries the typed props its native view
accepts, plus whatever React Native's JavaScript wrapper adds on top, and is imported by the file
that uses it. `Primitive` on its own means the behavioural kind below.
_Avoid_: element, tag, primitive

**Primitive**:
One control's behaviour and none of its looks, installed on a host primitive's node: what it does
with touches and keyboard focus, and what it announces to a screen reader. Press handling
(`installPressBehavior`, behind `Pressable` and a pressable `View`) is the one
`@solid-native/components` ships. It never adds a view of its own.
_Avoid_: headless component, behaviour, host primitive

**Component**:
A styled control an app builds for itself: host primitives and their behaviour, plus the classes
that give it a look. The framework ships the behaviour; the looks belong to the app.
_Avoid_: widget, control, primitive

**Transition**:
An eased change to a property, declared in CSS as `transition:` and driven by the engine when the
cascade recomputes a value. Distinct from an animation: a transition has no timeline of its own,
only a start value it is leaving and an end value it is heading for.
_Avoid_: animation, tween

**Animation**:
A run of `@keyframes` over a duration, declared in CSS as `animation:` and played by the engine.
Unlike a transition it has a timeline of its own and plays from its own frames, so it does not
depend on anything having changed.
_Avoid_: transition, tween

**Responder**:
The single node that currently owns a touch gesture, elected by the capture and bubble passes of
React Native's responder negotiation.
_Avoid_: gesture owner, active element
