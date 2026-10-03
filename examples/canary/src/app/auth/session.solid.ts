import { createRenderEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';
import type { NativeNavigation, NavigationContext } from '@solidnative/router/solid';

export interface User {
  readonly email: string;
}

/** App-owned auth state; ending identity and removing native screens are separate transactions. */
export function createSession(
  navigation: Pick<NativeNavigation, 'reset'> & Partial<Pick<NativeNavigation, 'busy'>>,
  delay = 150,
) {
  const [user, setUser] = createSignal<User | null>(null);
  const [resetRequired, setResetRequired] = createSignal(false);
  const idleWaits = new Set<() => void>();
  createRenderEffect(() => {
    if (!navigation.busy?.()) {
      for (const finish of idleWaits) finish();
      idleWaits.clear();
    }
  });
  const [notice, setNotice] = createSignal<string | null>(null);
  const signedIn = createMemo(() => user() !== null);
  const waits = new Map<ReturnType<typeof setTimeout>, () => void>();
  let active = true;
  let epoch = 0;
  let pending: User | null = null;
  let attempts = 0;
  let returnTo = '/account';
  let provisional: { previous: User | null; request: number } | undefined;
  function rollback(transaction = provisional) {
    if (!transaction || provisional !== transaction) return;
    provisional = undefined;
    setUser(transaction.previous);
  }
  function cancelWaiting() {
    const request = ++epoch;
    for (const [timer, finish] of waits) {
      clearTimeout(timer);
      finish();
    }
    waits.clear();
    for (const finish of idleWaits) finish();
    idleWaits.clear();
    // Rollback publishes a signal: observers may start a newer request synchronously.
    rollback();
    return request;
  }
  onCleanup(() => {
    active = false;
    pending = null;
    cancelWaiting();
  });
  function pause() {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        waits.delete(timer);
        resolve();
      }, delay);
      waits.set(timer, resolve);
    });
  }
  const valid = (request: number) => active && request === epoch;
  const validAttempt = (request: number, signal?: AbortSignal) =>
    valid(request) && !signal?.aborted;
  async function pauseForAttempt(request: number, signal?: AbortSignal) {
    const abort = () => {
      if (valid(request)) cancelWaiting();
    };
    if (signal?.aborted) return;
    signal?.addEventListener('abort', abort, { once: true });
    try {
      await pause();
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
  const current = (transaction: NonNullable<typeof provisional>) =>
    valid(transaction.request) && provisional === transaction;
  async function end(message: string | null = null): Promise<boolean> {
    if (!active) return false;
    const request = cancelWaiting();
    if (!valid(request)) return false;
    pending = null;
    setResetRequired(true);
    if (!valid(request)) return false;
    setUser(null);
    if (!valid(request)) return false;
    setNotice(message);
    if (!valid(request)) return false;
    return resetEnd(request);
  }
  async function resetEnd(request: number): Promise<boolean> {
    do {
      if (navigation.busy?.()) await new Promise<void>((resolve) => idleWaits.add(resolve));
      if (!valid(request)) return false;
      const accepted = await navigation.reset('/auth/login');
      if (!valid(request)) return false;
      if (accepted) {
        setResetRequired(false);
        return valid(request);
      }
      // A competing native transition may have started between the idle check and reset.
      // An idle guard refusal needs explicit retry, never a busy loop or identity rollback.
    } while (navigation.busy?.());
    return false;
  }
  async function finishSignIn(transaction: NonNullable<typeof provisional>, target: string) {
    try {
      const accepted = await navigation.reset(target);
      if (!current(transaction)) return false;
      if (!accepted) {
        rollback(transaction);
        return false;
      }
      provisional = undefined;
      pending = null;
      returnTo = '/account';
      return true;
    } catch (error) {
      if (!current(transaction)) return false;
      rollback(transaction);
      throw error;
    }
  }
  return {
    user,
    signedIn,
    notice,
    resetRequired,
    retryEnd: () => (resetRequired() ? end(notice()) : Promise.resolve(false)),
    get returnTo() {
      return returnTo;
    },
    set returnTo(path: string) {
      if (active) returnTo = path;
    },
    clearNotice() {
      if (active) setNotice(null);
    },
    async checkPassword(
      email: string,
      password: string,
      signal?: AbortSignal,
    ): Promise<'ok' | 'wrong' | 'locked' | 'cancelled'> {
      if (!active || resetRequired() || signal?.aborted) return 'cancelled';
      const request = cancelWaiting();
      if (!valid(request)) return 'cancelled';
      pending = null;
      await pauseForAttempt(request, signal);
      if (!validAttempt(request, signal)) return 'cancelled';
      if (attempts >= 3) return 'locked';
      if (password !== 'correct horse') {
        attempts++;
        return attempts >= 3 ? 'locked' : 'wrong';
      }
      attempts = 0;
      pending = { email };
      return 'ok';
    },
    async checkCode(code: string, signal?: AbortSignal): Promise<boolean> {
      if (!active || resetRequired() || signal?.aborted) return false;
      const request = cancelWaiting();
      if (!valid(request)) return false;
      await pauseForAttempt(request, signal);
      if (!validAttempt(request, signal) || !pending || code !== '123456') return false;
      const transaction = { previous: user(), request };
      provisional = transaction;
      setUser(pending);
      // Destination guards see the candidate, but a reactive observer may synchronously
      // dispose/sign out/start another request while that candidate is published.
      if (!current(transaction)) return false;
      if (signal?.aborted) {
        rollback(transaction);
        return false;
      }
      // Validation belongs to the screen. The reset now owns navigation: successful
      // native completion disposes that screen and must not cancel committed identity.
      const target = returnTo;
      return finishSignIn(transaction, target);
    },
    signOut: () => end(),
    expire: () => end('Your session has expired. Sign in again.'),
  };
}

export type Session = ReturnType<typeof createSession>;
/** Bind once in CanaryProviders using () => createSession(navigation), before routed screens. */
export const Session = createServiceToken<Session>('CanarySession', () => {
  throw new Error('Canary Session requires an app-scoped navigation binding.');
});

/** Preserve the full attempted URL, including query/fragment, for the completed sign-in reset. */
export function signedIn(session: Session) {
  return ({ to }: NavigationContext): boolean | string => {
    if (session.signedIn()) return true;
    session.returnTo = to.url;
    return '/auth/login';
  };
}
