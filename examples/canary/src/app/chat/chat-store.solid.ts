import { batch, createRenderEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { ChatBackend, type ChatMessage } from './chat-backend.solid.ts';

/** A retained conversation with foreground-owned live work and disposal-safe requests. */
export function createChatStore(
  backend = useService(ChatBackend),
  front: Accessor<boolean> = useService(SCREEN_IN_FRONT),
) {
  const [messages, setMessages] = createSignal<readonly ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [historyFailed, setHistoryFailed] = createSignal(false);
  const [reachedStart, setReachedStart] = createSignal(false);
  const [typing, setTyping] = createSignal(false);
  const [isLive, setIsLive] = createSignal(false);
  let active = true,
    before: number | null | undefined,
    sent = 0,
    replies = 0,
    historyRequests = 0,
    epoch = 0;
  let live: ReturnType<typeof setInterval> | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const deliveries = new Map<string, number>();
  const replace = (id: string, state: ChatMessage['state']) => {
    if (active)
      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, state } : message)),
      );
  };
  async function loadOlder() {
    if (!active || loadingOlder() || before === null) return;
    batch(() => {
      setLoadingOlder(true);
      setHistoryFailed(false);
    });
    if (!active) return;
    historyRequests++;
    try {
      const page = await backend.history(before ?? null);
      if (!active) return;
      before = page.before;
      batch(() => {
        setMessages((current) => [...current, ...page.messages]);
        setReachedStart(page.before === null);
      });
    } catch {
      if (active) setHistoryFailed(true);
    } finally {
      if (active) setLoadingOlder(false);
    }
  }
  function deliver(message: ChatMessage) {
    const request = (deliveries.get(message.id) ?? 0) + 1;
    deliveries.set(message.id, request);
    Promise.resolve()
      .then(() => (active ? backend.send(message) : undefined))
      .then(
        () => {
          if (active && deliveries.get(message.id) === request) replace(message.id, 'sent');
        },
        () => {
          if (active && deliveries.get(message.id) === request) replace(message.id, 'failed');
        },
      );
  }
  function send(text: string) {
    const trimmed = text.trim();
    if (!active || !front() || !trimmed) return;
    const message: ChatMessage = {
      id: `m${++sent}`,
      from: 'me',
      text: trimmed,
      sentAt: Date.now(),
      state: 'sending',
    };
    setMessages((current) => [message, ...current]);
    if (active) deliver(message);
  }
  function retry(id: string) {
    const message = messages().find((candidate) => candidate.id === id);
    if (!active || !front() || message?.state !== 'failed') return;
    replace(id, 'sending');
    if (active) deliver(message);
  }
  function receive(after = 1200) {
    if (!active || !front()) return;
    const mine = epoch;
    setTyping(true);
    if (!active || !front() || epoch !== mine) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!active || !front() || epoch !== mine) return;
      const reply = backend.reply(++replies);
      if (!active || !front() || epoch !== mine) return;
      batch(() => {
        setTyping(timers.size > 0);
        setMessages((current) => [reply, ...current]);
      });
    }, after);
    timers.add(timer);
  }
  function stopLive() {
    if (live !== undefined) clearInterval(live);
    live = undefined;
    setIsLive(false);
  }
  function stopForeground() {
    epoch++;
    stopLive();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    setTyping(false);
  }
  function startLive(every = 1500) {
    stopLive();
    if (!active || !front()) return;
    live = setInterval(() => receive(400), every);
    setIsLive(true);
  }
  createRenderEffect(() => {
    if (!front()) stopForeground();
  });
  onCleanup(() => {
    active = false;
    stopForeground();
    deliveries.clear();
  });
  return {
    messages,
    loadingOlder,
    historyFailed,
    reachedStart,
    typing,
    isLive,
    loadOlder,
    send,
    retry,
    receive,
    startLive,
    stopLive,
    get historyRequests() {
      return historyRequests;
    },
  };
}
