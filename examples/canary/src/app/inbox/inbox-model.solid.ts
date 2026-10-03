import { createMemo, createSignal } from 'solid-js';

export interface Mail {
  readonly id: string;
  readonly from: string;
  readonly subject: string;
  readonly preview: string;
  readonly unread: boolean;
  readonly folder: 'inbox' | 'archive';
}

const PEOPLE = ['Ada', 'Grace', 'Alan', 'Katherine', 'Linus', 'Margaret', 'Ken', 'Barbara'];
const SUBJECTS = [
  'Lunch on Friday?',
  'The quarterly numbers',
  'Re: the release notes',
  'Your order has shipped',
  'Flight change',
  'Minutes from Tuesday',
  'A question about the API',
  'Photos from the weekend',
];

export function mailbox(count = 120): Mail[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    from: PEOPLE[i % PEOPLE.length]!,
    subject: `${SUBJECTS[i % SUBJECTS.length]} ${i}`,
    preview: 'A few lines of the message, enough to tell one from another in the list.',
    unread: i % 3 === 0,
    folder: i % 7 === 6 ? 'archive' : 'inbox',
  }));
}

/** Screen-owned immutable mailbox and selection. */
export function createInbox() {
  const [mails, setMails] = createSignal<readonly Mail[]>(mailbox());
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set());
  const move = (ids: readonly string[], folder: Mail['folder']) => {
    const moving = new Set(ids);
    setMails((current) =>
      current.map((mail) => (moving.has(mail.id) ? { ...mail, folder } : mail)),
    );
  };
  return {
    mails,
    selected,
    inbox: createMemo(() => mails().filter((mail) => mail.folder === 'inbox')),
    archive: createMemo(() => mails().filter((mail) => mail.folder === 'archive')),
    selecting: createMemo(() => selected().size > 0),
    remove(id: string) {
      setMails((current) => current.filter((mail) => mail.id !== id));
      setSelected((current) => new Set([...current].filter((each) => each !== id)));
    },
    archiveMail: (id: string) => move([id], 'archive'),
    toggleSelected(id: string) {
      setSelected((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    },
    archiveSelected() {
      move([...selected()], 'archive');
      setSelected(new Set<string>());
    },
    clearSelection() {
      setSelected(new Set<string>());
    },
    markRead(id: string) {
      setMails((current) =>
        current.map((mail) => (mail.id === id ? { ...mail, unread: false } : mail)),
      );
    },
  };
}
