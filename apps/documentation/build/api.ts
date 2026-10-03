/**
 * The API reference, read out of the source rather than written beside it.
 *
 * Every package publishes its Solid surface from one entry, `src/solid.ts` (and `@solid-native/web`
 * from `src/solid/index.ts`), plus the `./solid/<module>` subpaths a package keeps off its root so
 * that importing one Expo module does not make an app install the rest. This walks what those
 * entries export, with a TypeScript program and its type checker, and the docs render what it
 * found: a component's props (inherited ones included, because most components here take every
 * prop a `View` does), a function's signature, a service's members. The moment any of that is
 * transcribed into markdown it starts drifting, so the page does not say it.
 *
 * Typed rather than syntactic, because a Solid component's
 * surface is an interface that usually extends two or three others, and only a checker can flatten
 * that. One program over every entry keeps it to a single pass per build.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** A prop or event of a component, or a property of a class or service. */
export interface ApiMember {
  readonly name: string;
  /** `event` is a callback prop, `onPress`; `property` belongs to a class or service. */
  readonly kind: 'prop' | 'event' | 'property';
  readonly type: string;
  readonly required: boolean;
  readonly doc?: string;
}

/** A public method on a class or service. */
export interface ApiMethod {
  readonly name: string;
  readonly signature: string;
  readonly doc?: string;
}

export interface ApiEntry {
  readonly name: string;
  readonly kind: 'component' | 'function' | 'class' | 'value';
  /** `@solid-native/components`. */
  readonly package: string;
  /** The declaration's file, relative to the workspace. */
  readonly file: string;
  /** Where an app imports it from: `@solid-native/components/solid`, `@solid-native/expo/solid/battery`. */
  readonly importPath: string;
  readonly doc?: string;
  /** A function's signature, or a plain value's type. */
  readonly signature?: string;
  readonly members: readonly ApiMember[];
  readonly methods: readonly ApiMethod[];
}

/** The packages documented, by folder name. */
const PACKAGES = ['components', 'device', 'expo', 'icons', 'platform', 'router', 'testing', 'web'];

/** Subpaths that are build plumbing rather than API an app calls. */
const PLUMBING = /\/(?:jsx-runtime|dev-reload|vite)$/;

const SKIP = /\.(generated|spec|test)\.ts$/;

const FLAGS =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/**
 * Every Solid entry of one package: `[importPath, file]`, its root entry first. A package with no
 * `./solid` subpath (`@solid-native/testing`, whose root entry is already the Solid one) is read
 * from `.`.
 */
function entriesOf(packageDir: string, name: string): [string, string][] {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    exports?: Record<string, unknown>;
  };
  const exports = manifest.exports ?? {};
  const surface = './solid' in exports ? /^\.\/solid(?:\/|$)/ : /^\.$/;
  return Object.entries(exports)
    .filter(
      (entry): entry is [string, string] =>
        surface.test(entry[0]) &&
        typeof entry[1] === 'string' &&
        entry[1].endsWith('.ts') &&
        !PLUMBING.test(entry[0]),
    )
    .sort(([a], [b]) => (a === './solid' ? -1 : b === './solid' ? 1 : 0))
    .map(([key, file]) => [`@solid-native/${name}${key.slice(1)}`, path.join(packageDir, file)]);
}

function docOf(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim() || undefined;
}

function isHidden(declaration: ts.Declaration | undefined): boolean {
  if (!declaration) return false;
  const flags = ts.getCombinedModifierFlags(declaration);
  return (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0;
}

/** As written on the declaration when it has a type node, so an alias reads as its name. */
function typeText(symbol: ts.Symbol, checker: ts.TypeChecker, at: ts.Node): string {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration && 'type' in declaration && declaration.type) {
    return (declaration.type as ts.TypeNode).getText();
  }
  return checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, at), undefined, FLAGS);
}

function signatureText(name: string, type: ts.Type, checker: ts.TypeChecker): string {
  return type
    .getCallSignatures()
    .map((signature) => `${name}${checker.signatureToString(signature, undefined, FLAGS)}`)
    .join('\n');
}

/** A component's props, every one of them, inherited and intersected members included. */
function propsOf(type: ts.Type, checker: ts.TypeChecker, at: ts.Node): ApiMember[] {
  return checker.getPropertiesOfType(type).map((symbol) => {
    const name = symbol.getName();
    const doc = docOf(symbol, checker);
    return {
      name,
      kind: /^on[A-Z]/.test(name) ? 'event' : 'prop',
      type: typeText(symbol, checker, at),
      required: (symbol.flags & ts.SymbolFlags.Optional) === 0,
      ...(doc ? { doc } : {}),
    };
  });
}

/** A class's or a service interface's public surface, split into properties and methods. */
function surfaceOf(type: ts.Type, checker: ts.TypeChecker, at: ts.Node) {
  const members: ApiMember[] = [];
  const methods: ApiMethod[] = [];
  for (const symbol of checker.getPropertiesOfType(type)) {
    const name = symbol.getName();
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (name.startsWith('#') || name.startsWith('_') || isHidden(declaration)) continue;
    const doc = docOf(symbol, checker);
    if (declaration && (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration))) {
      const signature = signatureText(name, checker.getTypeOfSymbolAtLocation(symbol, at), checker);
      methods.push({ name, signature, ...(doc ? { doc } : {}) });
    } else {
      members.push({
        name,
        kind: 'property',
        type: typeText(symbol, checker, at),
        required: (symbol.flags & ts.SymbolFlags.Optional) === 0,
        ...(doc ? { doc } : {}),
      });
    }
  }
  return { members, methods };
}

/**
 * A component is a PascalCase function whose first parameter is an object: its props. Solid has
 * no decorator to say so, and this is the shape every component here has (`View(props: ViewProps)`).
 */
function propsType(name: string, type: ts.Type, checker: ts.TypeChecker, at: ts.Node) {
  if (!/^[A-Z]/.test(name)) return undefined;
  const [signature] = type.getCallSignatures();
  const [parameter] = signature?.getParameters() ?? [];
  if (!parameter) return undefined;
  const props = checker.getTypeOfSymbolAtLocation(parameter, at);
  if (props.getCallSignatures().length) return undefined;
  const object = props.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection);
  return object ? props : undefined;
}

function entryOf(
  exported: ts.Symbol,
  checker: ts.TypeChecker,
  workspaceRoot: string,
  packageName: string,
  importPath: string,
): ApiEntry | undefined {
  const symbol =
    exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  // Type-only exports are not entries: they are read as part of whatever uses them.
  if (!(symbol.flags & ts.SymbolFlags.Value)) return undefined;
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (!declaration) return undefined;
  const file = declaration.getSourceFile().fileName;
  // Re-exports of Solid itself (`Index`, `Suspense`) are Solid's API, not this workspace's.
  if (file.includes(`${path.sep}node_modules${path.sep}`)) return undefined;

  const name = exported.getName();
  const doc = docOf(symbol, checker);
  const base = {
    name,
    package: packageName,
    file: path.relative(workspaceRoot, file),
    importPath,
    ...(doc ? { doc } : {}),
  };
  if (ts.isClassDeclaration(declaration)) {
    const surface = surfaceOf(checker.getDeclaredTypeOfSymbol(symbol), checker, declaration);
    return { ...base, kind: 'class', ...surface };
  }

  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const props = propsType(name, type, checker, declaration);
  if (props) {
    return {
      ...base,
      kind: 'component',
      members: propsOf(props, checker, declaration),
      methods: [],
    };
  }
  if (type.getCallSignatures().length) {
    return {
      ...base,
      kind: 'function',
      signature: signatureText(name, type, checker),
      members: [],
      methods: [],
    };
  }
  // A service: a token with an interface of the same name, which is what `useService` returns.
  if (symbol.flags & ts.SymbolFlags.Interface) {
    const surface = surfaceOf(checker.getDeclaredTypeOfSymbol(symbol), checker, declaration);
    return { ...base, kind: 'value', ...surface };
  }
  return {
    ...base,
    kind: 'value',
    signature: `const ${name}: ${checker.typeToString(type, declaration)}`,
    members: [],
    methods: [],
  };
}

/**
 * Every Solid export of every documented package, keyed `@solid-native/components#Switch`.
 *
 * Keyed by package and name because a name is not unique across the workspace: the platform's
 * control-flow `Switch` and the components' native `Switch` are both real. A page usually writes
 * the bare name and `lookup` resolves it; where two packages share one, it has to say which. An
 * export reached from a package's root entry is documented with that entry as its import path.
 */
export function extractApi(workspaceRoot: string): Record<string, ApiEntry> {
  const entries = PACKAGES.flatMap((name) =>
    entriesOf(path.join(workspaceRoot, 'packages', name), name).map(
      ([importPath, file]) => [name, importPath, file] as const,
    ),
  );
  const program = ts.createProgram(
    entries.map(([, , file]) => file),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      types: [],
    },
  );
  const checker = program.getTypeChecker();
  const out: Record<string, ApiEntry> = {};
  for (const [name, importPath, file] of entries) {
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const key = `@solid-native/${name}#${exported.getName()}`;
      if (out[key]) continue;
      const entry = entryOf(exported, checker, workspaceRoot, `@solid-native/${name}`, importPath);
      if (entry) out[key] = entry;
    }
  }
  return out;
}

/**
 * One entry, by `Button` or by `@solid-native/components#Switch`.
 *
 * An ambiguous bare name throws rather than picking one, naming the candidates: a page that
 * silently documented the wrong `Switch` is the failure this whole file exists to avoid.
 */
export function lookup(api: Record<string, ApiEntry>, reference: string): ApiEntry {
  const exact = api[reference];
  if (exact) return exact;
  const matches = Object.values(api).filter((entry) => entry.name === reference);
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) throw new Error(`No exported declaration named ${reference}`);
  throw new Error(
    `${reference} is declared in more than one package; write one of ` +
      matches.map((m) => `${m.package}#${m.name}`).join(', '),
  );
}

const MODULE = 'virtual:solid-native/api';

/**
 * Serves the extraction as a module the site imports.
 *
 * Rebuilt whenever a package source file changes, so the dev server shows a prop added seconds
 * ago without a restart.
 */
export function api(workspaceRoot: string): Plugin {
  const resolved = `\0${MODULE}`;
  let cache: Record<string, ApiEntry> | undefined;

  return {
    name: 'documentation:api',
    resolveId: (id) => (id === MODULE ? resolved : undefined),
    load(id) {
      if (id !== resolved) return undefined;
      cache ??= extractApi(workspaceRoot);
      return `export const API = ${JSON.stringify(cache)};\nexport default API;\n`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.includes(`${path.sep}packages${path.sep}`) || SKIP.test(file)) return;
      cache = undefined;
      const module = server.moduleGraph.getModuleById(resolved);
      if (module) server.moduleGraph.invalidateModule(module);
    },
  };
}
