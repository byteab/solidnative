/**
 * One learner file, compiled the way Metro compiles it for a device: Solid's JSX transform in its
 * universal mode against `@solidnative/platform/solid`, with TypeScript's types stripped, exactly
 * as `@solidnative/metro/solid-transform.cjs` configures Babel. Sucrase then turns the ES module
 * into the `require`/`exports` shape `program.ts` runs in a `Function`.
 *
 * Babel keeps each line where it was (`retainLines`), and sucrase never moves one, so a line in a
 * stack trace is a line in the editor.
 */
import './process-shim.ts';
import { transform } from '@babel/core';
import typescript from '@babel/plugin-transform-typescript';
import solid from 'babel-preset-solid';
import { transform as toCommonJs } from 'sucrase';

/** The name every loop calls at the top of its body. See `learn-runtime.ts`. */
export const GUARD = '__learnGuard';

export class SyntaxProblem extends Error {
  readonly line?: number;
  /** 0-based. */
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

interface BabelTypes {
  isBlockStatement(node: unknown): boolean;
  blockStatement(body: unknown[]): unknown;
  expressionStatement(expression: unknown): unknown;
  callExpression(callee: unknown, args: unknown[]): unknown;
  identifier(name: string): unknown;
}

interface LoopPath {
  node: { body: unknown };
}

/** A call to `GUARD` at the top of every loop, so one that never ends can be stopped. */
function guardLoops({ types: t }: { types: BabelTypes }) {
  return {
    visitor: {
      Loop(path: LoopPath) {
        const call = t.expressionStatement(t.callExpression(t.identifier(GUARD), []));
        const { body } = path.node;
        path.node.body = t.isBlockStatement(body)
          ? t.blockStatement([call, ...(body as { body: unknown[] }).body])
          : t.blockStatement([call, body]);
      },
    },
  };
}

function babel(file: string, source: string): string {
  try {
    const result = transform(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: 'module',
      retainLines: true,
      highlightCode: false,
      presets: [
        [solid, { generate: 'universal', moduleName: '@solidnative/platform/solid', dev: false }],
      ],
      plugins: [
        [
          typescript,
          {
            isTSX: true,
            allExtensions: true,
            allowDeclareFields: true,
            onlyRemoveTypeImports: true,
          },
        ],
        guardLoops,
      ],
    });
    return result?.code ?? '';
  } catch (error) {
    const loc = (error as { loc?: { line: number; column: number } }).loc;
    const message = String((error as Error).message ?? error)
      .split('\n')[0]!
      .replace(/^[^:]*\.(?:tsx?|jsx?): /, '')
      .replace(/\s*\(\d+:\d+\)$/, '');
    throw new SyntaxProblem(message, loc?.line, loc?.column);
  }
}

/** A learner's `.ts` or `.tsx` file as CommonJS, or a `SyntaxProblem` saying where it is wrong. */
export function compileFile(file: string, source: string): string {
  const code = babel(file, source);
  return toCommonJs(code, { transforms: ['imports'], disableESTransforms: true, filePath: file })
    .code;
}
