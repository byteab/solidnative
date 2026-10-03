import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Engine, registerPlatformComponents, type StyleSheet } from '@solidnative/fabric';
import { createFakeFabric } from '../../../packages/platform/solid-tests/fake-fabric.ts';
import globalStyles from '../src/app/global-styles.native.css';
import toastStyles from '../src/app/overlays/toast-host.native.css';
import { canaryStyles } from '../src/app/global-styles.solid.ts';
import { assertNativeSheets } from './native-sheets.ts';

const require = createRequire(import.meta.url);
const { withTailwind } = require('@solidnative/tailwind/config.cjs');
const { isSolidReloadSource } = require('@solidnative/metro/solid-transform.cjs');
const canary = fileURLToPath(new URL('../', import.meta.url));

test('actual project screens, the global palette and ToastHost compile on both native platforms', () => {
  assertNativeSheets([
    'projects/projects-page',
    'projects/project-page',
    'projects/task-page',
    'projects/task-editor',
    'global-styles',
    'overlays/toast-host',
  ]);
  assert.ok(globalStyles.rules.length > 0);
  assert.ok(toastStyles.rules.length > 0);
});

test('actual Tailwind CLI scans native TSX and merges utilities after global app rules', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'solidnative-g5-tailwind-'));
  try {
    const filename = path.join(directory, 'Probe.solid.tsx');
    writeFileSync(
      filename,
      '/** @jsxImportSource @solidnative/platform/solid */\nexport const Probe = () => <view class="p-[23px] opacity-50" />;',
    );
    const source = readFileSync(path.join(canary, 'src/tailwind.css'), 'utf8')
      .replace(
        /@import '([^']+)'/g,
        (_, name) => `@import ${JSON.stringify(require.resolve(name))}`,
      )
      .replace(
        "@source './app/tailwind'",
        `@source ${JSON.stringify(path.join(canary, 'src/app/tailwind'))}`,
      );
    const input = path.join(directory, 'tailwind.css');
    const output = path.join(directory, 'app.tailwind.solid.js');
    writeFileSync(input, `${source}\n@source ${JSON.stringify(filename)};\n`);
    const config = { projectRoot: canary };
    assert.equal(withTailwind(config, { input, output, watch: false }), config);
    const module = readFileSync(output, 'utf8');
    assert.equal(isSolidReloadSource(module, output), true);
    const tailwind = JSON.parse(
      module
        .slice(module.indexOf('export default ') + 15)
        .trim()
        .replace(/;$/, ''),
    ) as StyleSheet;
    const before = JSON.stringify(tailwind);
    const sheet = canaryStyles(tailwind);
    assert.equal(JSON.stringify(tailwind), before);
    assert.ok(sheet.rules.length > globalStyles.rules.length);
    assert.match(readFileSync(output.replace(/\.js$/, '.d.ts'), 'utf8'), /StyleSheet/);
    registerPlatformComponents('ios');
    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1, {
      globalStyles: sheet,
      conditions: { width: 402, height: 874, colorScheme: 'light', reducedMotion: false },
    });
    const view = engine.createElement('view');
    for (const name of ['screen', 'p-[23px]', 'opacity-50']) engine.addClass(view, name);
    engine.appendChild(engine.root, view);
    engine.commit();
    const props = fabric.roots.get(1)![0]!.props;
    assert.equal(props['paddingTop'], 23);
    assert.equal(props['opacity'], 0.5);
    assert.equal(props['flexGrow'], 1);
    assert.equal(props['flexShrink'], 1);
    assert.equal(props['flexBasis'], '0%');
    assert.ok(props['backgroundColor']);
    engine.updateConditions({ width: 402, height: 874, colorScheme: 'dark', reducedMotion: false });
    engine.commit();
    assert.notEqual(fabric.roots.get(1)![0]!.props['backgroundColor'], props['backgroundColor']);
    engine.destroyNode(engine.root);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
