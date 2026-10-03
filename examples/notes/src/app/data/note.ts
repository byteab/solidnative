export interface Note {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly pinned: boolean;
  readonly updatedAt: number;
}

/** A fresh id, local to this device until the fake server has seen it. */
export function nextId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Pinned first, then most recently updated - the order the list shows. */
export function sortNotes(notes: readonly Note[]): readonly Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

/** Whether a note's title or body contains the search text, case-insensitively. */
export function matchesQuery(note: Note, query: string): boolean {
  const clean = query.trim().toLowerCase();
  if (!clean) return true;
  return note.title.toLowerCase().includes(clean) || note.body.toLowerCase().includes(clean);
}

/** Words in a note's body, for the editor's word count. Empty text is zero words, not one. */
export function wordCount(body: string): number {
  const trimmed = body.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** A one-line preview of the body, for the list row. */
export function excerpt(body: string, max = 80): string {
  const clean = body.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}
