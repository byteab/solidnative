import { batch, createMemo, createSignal, onCleanup } from 'solid-js';
import { createServiceToken, useService } from '@solidnative/device/solid';

export interface Project {
  readonly id: string;
  readonly name: string;
}

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly notes: string;
  readonly done: boolean;
  readonly assignee: string;
  /** Bumped by every save, here or on the server, so a stale copy can be told from a fresh one. */
  readonly version: number;
}

export interface TaskComment {
  readonly id: string;
  readonly taskId: string;
  readonly author: string;
  readonly text: string;
}

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export const PEOPLE: readonly Person[] = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Engineering' },
  { id: 'grace', name: 'Grace Hopper', role: 'Platform' },
  { id: 'alan', name: 'Alan Turing', role: 'Research' },
  { id: 'katherine', name: 'Katherine Johnson', role: 'Navigation' },
];

const NAMES = ['Launch', 'Website', 'Mobile app', 'Research', 'Hiring', 'Office move'];
const VERBS = ['Draft', 'Review', 'Ship', 'Test', 'Plan', 'Fix', 'Document', 'Design'];
const THINGS = ['the brief', 'onboarding', 'the budget', 'search', 'the release notes', 'checkout'];

function seed(): { projects: Project[]; tasks: Task[]; comments: TaskComment[] } {
  const projects = NAMES.map((name, i) => ({ id: `p${i + 1}`, name }));
  const tasks: Task[] = [];
  const comments: TaskComment[] = [];
  projects.forEach((project, p) => {
    for (let i = 0; i < 40; i++) {
      const n = p * 40 + i;
      const id = `t${n + 1}`;
      tasks.push({
        id,
        projectId: project.id,
        title: `${VERBS[n % VERBS.length]} ${THINGS[n % THINGS.length]}`,
        notes: n % 3 === 0 ? 'Needs sign-off before Friday.' : '',
        done: n % 4 === 0,
        assignee: PEOPLE[n % PEOPLE.length]!.id,
        version: 1,
      });
      for (let c = 0; c < 3; c++) {
        comments.push({
          id: `c${n * 3 + c + 1}`,
          taskId: id,
          author: PEOPLE[(n + c + 1) % PEOPLE.length]!.id,
          text: ['Looks good to me.', 'Can we split this in two?', 'Blocked on the API.'][c]!,
        });
      }
    }
  });
  return { projects, tasks, comments };
}

/** The server, simulated: slow, able to fail, and edited by other people from time to time. */
export class ProjectBackend {
  latency = 350;
  offline = false;
  private readonly data = seed();

  projects(): Promise<Project[]> {
    return this.respond(() => this.data.projects.map((project) => ({ ...project })));
  }

  tasks(): Promise<Task[]> {
    return this.respond(() => this.data.tasks.map((task) => ({ ...task })));
  }

  comments(): Promise<TaskComment[]> {
    return this.respond(() => this.data.comments.map((comment) => ({ ...comment })));
  }

  save(task: Task): Promise<Task> {
    return this.respond(() => {
      const stored = { ...task, version: task.version + 1 };
      const at = this.data.tasks.findIndex((existing) => existing.id === task.id);
      if (at === -1) this.data.tasks.push(stored);
      else this.data.tasks[at] = stored;
      return { ...stored };
    });
  }

  remove(id: string): Promise<void> {
    return this.respond(() => {
      this.data.tasks = this.data.tasks.filter((task) => task.id !== id);
    });
  }

  /** Someone else renames a task, which this device only learns on its next refresh. */
  editElsewhere(id: string): void {
    const at = this.data.tasks.findIndex((task) => task.id === id);
    if (at === -1) return;
    const task = this.data.tasks[at]!;
    this.data.tasks[at] = {
      ...task,
      title: `${task.title} (edited by Grace)`,
      version: task.version + 1,
    };
  }

  private respond<T>(answer: () => T): Promise<T> {
    const fail = this.offline;
    return new Promise((resolve, reject) => {
      const settle = () => (fail ? reject(new Error('No connection')) : resolve(answer()));
      if (this.latency === 0) queueMicrotask(settle);
      else setTimeout(settle, this.latency);
    });
  }
}

export type ProjectServer = ProjectBackend;
export const ProjectServer = createServiceToken('canary.projectServer', () => new ProjectBackend());
export type LoadState = 'idle' | 'loading' | 'refreshing' | 'failed';
let created = 0;

/** Shared, owner-bound state. Pending edits and acknowledged newer versions outrank refreshes. */
export function createProjectStore(server: ProjectServer) {
  const [projects, setProjects] = createSignal<readonly Project[]>([]);
  const [tasks, setTasks] = createSignal<ReadonlyMap<string, Task>>(new Map());
  const [comments, setComments] = createSignal<readonly TaskComment[]>([]);
  const [state, setState] = createSignal<LoadState>('idle');
  const [notice, setNotice] = createSignal<string | null>(null);
  const loaded = createMemo(() => projects().length > 0);
  const confirmed = new Map<string, Task | null>();
  const acknowledged = new Map<string, number>();
  const pending = new Map<string, { token: number; value: Task | null }>();
  // Only acknowledged mutations outrank a refresh that started earlier. A rejected
  // optimistic edit must not make its old rollback snapshot stronger than server data.
  const committedAt = new Map<string, number>();
  let revision = 0;
  let active = true;
  onCleanup(() => {
    active = false;
  });

  function put(id: string, task: Task | null) {
    setTasks((previous) => {
      const next = new Map(previous);
      if (task) next.set(id, task);
      else next.delete(id);
      return next;
    });
  }

  function mergeRefresh(nextTasks: readonly Task[], started: number) {
    const fetched = new Map(nextTasks.map((task) => [task.id, task]));
    for (const id of new Set([...confirmed.keys(), ...fetched.keys()])) {
      if ((committedAt.get(id) ?? 0) > started) continue;
      const known = confirmed.get(id);
      const incoming = fetched.get(id);
      if (known && incoming && known.version > incoming.version) continue;
      // Absence is authoritative too, including the baseline for a stale editor's rollback.
      confirmed.set(id, incoming ?? null);
    }
    const merged = new Map<string, Task>();
    for (const [id, value] of confirmed) if (value) merged.set(id, value);
    for (const [id, local] of pending) {
      if (local.value) merged.set(id, local.value);
      else merged.delete(id);
    }
    return merged;
  }

  async function load(): Promise<void> {
    if (!active || state() === 'loading' || state() === 'refreshing') return;
    const started = revision;
    setState(loaded() ? 'refreshing' : 'loading');
    if (!active) return;
    try {
      const [nextProjects, nextTasks, nextComments] = await Promise.all([
        server.projects(),
        server.tasks(),
        server.comments(),
      ]);
      if (!active) return;
      const merged = mergeRefresh(nextTasks, started);
      batch(() => {
        setProjects(nextProjects);
        setTasks(merged);
        setComments(nextComments);
        setState('idle');
      });
    } catch {
      if (active) setState('failed');
    }
  }

  function begin(id: string, value: Task | null) {
    const token = ++revision;
    if (!confirmed.has(id)) confirmed.set(id, tasks().get(id) ?? null);
    pending.set(id, { token, value });
    put(id, value);
    return token;
  }

  function settle(id: string, token: number, value: Task | null) {
    if (!active) return;
    if (token > (acknowledged.get(id) ?? 0)) {
      confirmed.set(id, value);
      acknowledged.set(id, token);
      committedAt.set(id, ++revision);
    }
    if (pending.get(id)?.token === token) pending.delete(id);
    if (!pending.has(id)) put(id, confirmed.get(id) ?? null);
  }

  function rollback(id: string, token: number, message: string) {
    if (!active || pending.get(id)?.token !== token) return;
    pending.delete(id);
    batch(() => {
      put(id, confirmed.get(id) ?? null);
      setNotice(message);
    });
  }

  async function save(task: Task): Promise<void> {
    if (!active) return;
    const token = begin(task.id, task);
    if (!active || pending.get(task.id)?.token !== token) return;
    try {
      settle(task.id, token, await server.save(task));
    } catch {
      rollback(task.id, token, 'Could not save the task');
    }
  }

  async function remove(id: string): Promise<void> {
    if (!active || !tasks().has(id)) return;
    const token = begin(id, null);
    if (!active || pending.get(id)?.token !== token) return;
    try {
      await server.remove(id);
      settle(id, token, null);
    } catch {
      rollback(id, token, 'Could not delete the task');
    }
  }

  function draft(projectId: string): Task {
    return {
      id: `n${Date.now().toString(36)}${++created}`,
      projectId,
      title: '',
      notes: '',
      done: false,
      assignee: PEOPLE[0]!.id,
      version: 0,
    };
  }

  return {
    projects,
    tasks,
    comments,
    state,
    notice,
    loaded,
    load,
    save,
    remove,
    draft,
    ensureLoaded() {
      if (!loaded() && state() === 'idle') void load();
    },
    project: (id: string) => projects().find((project) => project.id === id),
    task: (id: string) => tasks().get(id),
    tasksOf: (id: string) => [...tasks().values()].filter((task) => task.projectId === id),
    commentsOf: (id: string) => comments().filter((comment) => comment.taskId === id),
    comment: (id: string) => comments().find((comment) => comment.id === id),
    dismissNotice() {
      if (active) setNotice(null);
    },
    toggleDone(id: string) {
      const task = tasks().get(id);
      if (task) void save({ ...task, done: !task.done });
    },
    duplicate(id: string) {
      const task = tasks().get(id);
      if (!task || !active) return undefined;
      const copy = { ...draft(task.projectId), title: `${task.title} (copy)`, notes: task.notes };
      void save(copy);
      return copy;
    },
  };
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
export const ProjectStore = createServiceToken('canary.projects', () =>
  createProjectStore(useService(ProjectServer)),
);
