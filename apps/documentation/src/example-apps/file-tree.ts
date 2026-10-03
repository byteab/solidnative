/**
 * An example app's file paths as the tree the code browser draws: folders first, then files,
 * each level in alphabetical order.
 */
export interface FileNode {
  readonly name: string;
  /** The whole path, relative to the app's folder. A folder's has no trailing slash. */
  readonly path: string;
  /** Present on a folder only. */
  readonly children?: readonly FileNode[];
}

interface Folder {
  readonly folders: Map<string, Folder>;
  readonly files: string[];
}

export function fileTree(paths: readonly string[]): FileNode[] {
  const root: Folder = { folders: new Map(), files: [] };
  for (const file of paths) {
    const parts = file.split('/');
    const name = parts.pop()!;
    let folder = root;
    for (const part of parts) {
      let next = folder.folders.get(part);
      if (!next) folder.folders.set(part, (next = { folders: new Map(), files: [] }));
      folder = next;
    }
    folder.files.push(name);
  }
  return nodes(root, '');
}

function nodes(folder: Folder, prefix: string): FileNode[] {
  const byName = (a: string, b: string) => a.localeCompare(b);
  return [
    ...[...folder.folders.keys()].sort(byName).map((name) => ({
      name,
      path: prefix + name,
      children: nodes(folder.folders.get(name)!, `${prefix}${name}/`),
    })),
    ...[...folder.files].sort(byName).map((name) => ({ name, path: prefix + name })),
  ];
}
