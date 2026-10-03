/**
 * Which screen each task manager screen sits under, for a deep link to open on the whole way down:
 * a comment under its task, a task under its project, a project under the list.
 */
export function projectLinkParent(url: string): string | null {
  const path = url.split(/[?#]/)[0]!;
  const segments = path.split('/').filter(Boolean);
  if (segments[0] !== 'projects' || segments.length < 2) return null;
  if (segments.length === 2) return '/projects';
  if (segments[2] === 'tasks' && segments.length === 4) return `/projects/${segments[1]}`;
  if (segments[4] === 'comments' && segments.length === 6) {
    return `/projects/${segments[1]}/tasks/${segments[3]}`;
  }
  return null;
}
