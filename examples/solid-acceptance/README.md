# Solid acceptance app

The starter template (`template/`, what `create-expo-app --template @solidnative/template` gives a new
user), extended to exercise the features a real app leans on. It uses public `@solidnative/*` entries
only.

| Screen                        | What it shows                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Home tab (`src/app/home`)     | The starter's counter, a push with a route param, scoped `.native.css` with a dark scheme     |
| Detail (`src/app/detail`)     | A pushed native-stack screen reading `useRoute()`, Tailwind classes with `dark:` variants     |
| List tab (`src/app/list`)     | A `<VirtualList>` of 200 rows with pull-to-refresh; a row pushes its detail                   |
| Motion tab (`src/app/motion`) | A CSS `@keyframes` pulse toggled by a class, and a Reanimated worklet style gated by a switch |
| Form (`src/app/form`)         | Signal forms over native text fields: required, min-length and email rules, then a result     |

Links such as `solidacceptance://detail/7` open a detail screen. Key elements carry `testID`s
(`tabs`, `counter`, `open-detail`, `open-form`, `detail-title`, `detail-back`, `list`, `row-<n>`,
`refresh-count`, `pulse`, `toggle-pulse`, `box-switch`, `animated-box`, `name-input`,
`email-input`, `name-error`, `email-error`, `submit`, `form-result`) for device automation.

```sh
pnpm start             # Metro; press i or a
pnpm test              # Node tests against a fake Fabric, no simulator
pnpm test:worker       # the same under the worker/development export conditions
pnpm typecheck
```
