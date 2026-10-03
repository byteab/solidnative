import { expect, test } from 'vitest';
import { fileTree } from './file-tree.ts';

test('puts folders before files, each level in order', () => {
  expect(fileTree(['tabs.ts', 'src/list/row.ts', 'app.ts', 'src/home.ts'])).toEqual([
    {
      name: 'src',
      path: 'src',
      children: [
        {
          name: 'list',
          path: 'src/list',
          children: [{ name: 'row.ts', path: 'src/list/row.ts' }],
        },
        { name: 'home.ts', path: 'src/home.ts' },
      ],
    },
    { name: 'app.ts', path: 'app.ts' },
    { name: 'tabs.ts', path: 'tabs.ts' },
  ]);
});
