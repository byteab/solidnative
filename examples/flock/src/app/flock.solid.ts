import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

export interface User {
  readonly handle: string;
  readonly name: string;
  readonly color: string;
  readonly bio: string;
  readonly verified?: boolean;
  readonly photo: string;
  readonly cover?: string;
  readonly location?: string;
  readonly website?: string;
  readonly joined?: string;
  readonly followers: number;
  readonly following: number;
}

export interface Post {
  readonly id: string;
  readonly author: string;
  readonly text: string;
  readonly createdAt: number;
  readonly replyTo?: string;
  readonly image?: PostImage;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
}

export interface PostImage {
  /** A remote URL, or a bundled asset from `require()`. */
  readonly source: number | { readonly uri: string };
  /** Width over height, so the row can reserve its space before the image loads. */
  readonly aspectRatio: number;
}

export interface Activity {
  readonly id: string;
  readonly kind: 'like' | 'repost' | 'follow' | 'reply';
  readonly who: string;
  readonly postId?: string;
  readonly createdAt: number;
  unread: boolean;
}

export const ME = 'byteab';

export const USERS: Record<string, User> = {
  byteab: {
    handle: 'byteab',
    photo: 'https://pbs.twimg.com/profile_images/2103486855027314688/uGuFU0f7_400x400.jpg',
    cover: 'https://pbs.twimg.com/profile_banners/1782451947636764672/1790581974/1500x500',
    name: 'ehsan',
    color: '#1d9bf0',
    bio: 'design engineer @send\nReact ( native ) developer since 2017\n\nEhsan Sarshar',
    location: 'Muscat, Oman 🏖️',
    website: 'github.com/byteab',
    joined: 'April 2024',
    verified: true,
    followers: 1066,
    following: 934,
  },
  ryan: {
    handle: 'ryan',
    photo: 'https://i.pravatar.cc/150?img=33',
    name: 'Ryan Signals',
    color: '#f97316',
    bio: 'Fine-grained reactivity enjoyer.',
    verified: true,
    followers: 98200,
    following: 410,
  },
  maya: {
    handle: 'maya',
    photo: 'https://i.pravatar.cc/150?img=47',
    name: 'Maya Fabric',
    color: '#a855f7',
    bio: 'Stores, reconcile and keyed lists. Ask me about produce().',
    verified: true,
    followers: 24100,
    following: 880,
  },
  leo: {
    handle: 'leo',
    photo: 'https://i.pravatar.cc/150?img=59',
    name: 'Leo Yoga',
    color: '#10b981',
    bio: 'Components that run once.',
    followers: 5300,
    following: 120,
  },
  iris: {
    handle: 'iris',
    photo: 'https://i.pravatar.cc/150?img=45',
    name: 'Iris Glass',
    color: '#ec4899',
    bio: 'Designer who writes createMemo for fun.',
    verified: true,
    followers: 61800,
    following: 230,
  },
  sam: {
    handle: 'sam',
    photo: 'https://i.pravatar.cc/150?img=68',
    name: 'Sam Screens',
    color: '#eab308',
    bio: 'Control flow enjoyer: <Show>, <For>, <Switch>.',
    followers: 2900,
    following: 640,
  },
  Send: {
    handle: 'Send',
    photo: 'https://pbs.twimg.com/profile_images/2013524991669637120/JarfCfVd_400x400.jpg',
    name: 'Send',
    color: '#5ee35e',
    bio: 'Your Global Wallet.',
    verified: true,
    followers: 48200,
    following: 90,
  },
  ethentree: {
    handle: 'ethentree',
    photo: 'https://pbs.twimg.com/profile_images/2100064413109678080/BdjqiFjA_400x400.jpg',
    name: '/ethen 🌳',
    color: '#16a34a',
    bio: 'Building the future of fintech.',
    verified: true,
    followers: 3100,
    following: 410,
  },
  alleneubank: {
    handle: 'alleneubank',
    photo: 'https://pbs.twimg.com/profile_images/2064744191658246144/lZRc9HhW_400x400.jpg',
    name: 'Allen',
    color: '#0ea5e9',
    bio: 'Building Sox.',
    verified: true,
    followers: 2400,
    following: 380,
  },
};

const minutes = (n: number) => Date.now() - n * 60_000;

const seed: [author: string, text: string, ago: number, replyTo?: string][] = [
  ['iris', 'One signal flips, one view updates. That is it.', 4],
  ['ryan', 'Signals in, native views out. No virtual DOM.', 12],
  ['maya', 'Liking a post is one produce() call. Only the heart re-renders.', 25],
  ['leo', 'Hot take: components that run once beat hooks.', 48],
  ['sam', '<Show>, <For>, <Switch>. Control flow you can read.', 75],
  ['ryan', 'createSignal(0) and a badge that updates itself.', 110],
  ['iris', 'createMemo for the timeline. The list just follows.', 160],
  ['maya', 'Never destructure props. Use splitProps.', 240],
  ['leo', 'First Solid app on TestFlight today 🚀', 380],
  ['sam', 'onCleanup right next to the effect. Clean.', 600],
  ['ryan', 'No re-renders, no memo() wrappers.', 9, 'p2'],
  ['maya', 'reconcile with a key keeps every row.', 20, 'p3'],
  ['iris', 'Once you think in signals, there is no going back.', 40, 'p4'],
  ['byteab', 'SolidJS + Expo. Fine-grained reactivity, real native apps ⚡️', 2],
  ['byteab', 'Derive with createMemo. Effects are for side effects.', 300],
  ['iris', 'Cleanest Solid demo all year.', 1, 'p14'],
  ['leo', 'The whole sheet is one signal?', 3, 'p1'],
  ['sam', 'One signal. I counted.', 2, 'p1'],
  ['ryan', 'React Native did the hard part. Solid just renders.', 5],
  ['maya', 'WebGPU on a phone via react-native-wgpu, fed by a signal.', 7],
  ['leo', 'Keep the React Native ecosystem. Drop the re-renders.', 6],
  ['iris', 'WebGPU particles at 120fps. The slider is one createSignal.', 14],
  ['sam', 'New sticker for the laptop.', 450],
  ['Send', 'Tacos in Mexico City 🌮\nRamen in Tokyo 🍜\nOne tap. Your Global Wallet 🌎', 8],
  [
    'ethentree',
    "we have this ui/ux we've been working on for the past few months that is going to set the standard for fintech applications going forward\n\nwill put every neobank and banking application to shame\n\nevery. single. one.",
    30,
  ],
  [
    'alleneubank',
    'yeee terminal notifications finally working in Sox. Get notified when your agent is blocked or needs you to answer a question. works on linux/macos.',
    260,
  ],
];

const SOLID_EXPO = { source: require('../../assets/solid-expo.jpg'), aspectRatio: 1200 / 767 };
const LOGO = {
  source: { uri: 'https://www.solidjs.com/img/logo/without-wordmark/logo.png' },
  aspectRatio: 16 / 9, // contain letterboxes the square logo with room around it
};
const SEND = {
  source: { uri: 'https://pbs.twimg.com/media/HTK6_TyaYAAgIre?format=jpg&name=medium' },
  aspectRatio: 897 / 1200,
};
const SOX = { source: require('../../assets/sox-notifications.jpg'), aspectRatio: 836 / 996 };
const images: Record<string, PostImage> = { p14: SOLID_EXPO, p23: LOGO, p24: SEND, p26: SOX };
/** Fixed numbers for the featured posts, in place of the generated ones. */
const stats: Partial<Record<string, Pick<Post, 'replies' | 'reposts' | 'likes' | 'views'>>> = {
  p25: { replies: 64, reposts: 142, likes: 1386, views: 48_200 },
  p26: { replies: 41, reposts: 97, likes: 912, views: 31_700 },
};

const [posts, setPosts] = createStore<Post[]>(
  seed.map(([author, text, ago, replyTo], i) => ({
    id: `p${i + 1}`,
    author,
    text,
    replyTo,
    image: images[`p${i + 1}`],
    createdAt: minutes(ago),
    replies: replyTo ? 0 : Math.round(8 + ((i * 37) % 90)),
    reposts: Math.round(20 + ((i * 53) % 400)),
    likes: Math.round(120 + ((i * 97) % 2400)),
    views: Math.round(9000 + ((i * 7919) % 90000)),
    liked: i === 1,
    reposted: false,
    bookmarked: false,
    ...stats[`p${i + 1}`],
  })),
);

const [activity, setActivity] = createStore<Activity[]>([
  { id: 'a1', kind: 'like', who: 'iris', postId: 'p2', createdAt: minutes(3), unread: true },
  { id: 'a2', kind: 'follow', who: 'maya', createdAt: minutes(18), unread: true },
  { id: 'a3', kind: 'repost', who: 'ryan', postId: 'p2', createdAt: minutes(42), unread: true },
  { id: 'a4', kind: 'reply', who: 'leo', postId: 'p4', createdAt: minutes(90), unread: false },
  { id: 'a5', kind: 'like', who: 'sam', postId: 'p6', createdAt: minutes(200), unread: false },
  { id: 'a6', kind: 'follow', who: 'leo', createdAt: minutes(400), unread: false },
]);

const [following, setFollowing] = createSignal<ReadonlySet<string>>(new Set(['maya', 'iris']));
const [muted, setMuted] = createSignal<ReadonlySet<string>>(new Set());

/** Settings, read app-wide: the accent tints every bar and button, the text size every post. */
export const [accent, setAccent] = createSignal('#1d9bf0');
export const [textSize, setTextSize] = createSignal(16);
export const [pushEnabled, setPushEnabled] = createSignal(true);
export const [autoplay, setAutoplay] = createSignal(false);
export const [audience, setAudience] = createSignal<'everyone' | 'following' | 'mentioned'>(
  'everyone',
);

export const user = (handle: string): User => USERS[handle]!;
export const post = (id: string) => posts.find((p) => p.id === id);
export const isFollowing = (handle: string) => following().has(handle);
export const unreadCount = () => activity.filter((a) => a.unread).length;
export { activity };

/** The timeline: pinned posts, then top-level posts newest first, with muted accounts filtered out. */
export const timeline = (onlyFollowing = false) =>
  posts
    .filter((p) => !p.replyTo && !muted().has(p.author))
    .filter((p) => !onlyFollowing || following().has(p.author) || p.author === ME)
    .sort((a, b) => pinRank(a.id) - pinRank(b.id) || b.createdAt - a.createdAt);

/** Posts that lead the timeline in this order, whatever their age. */
const PINNED = ['p14', 'p21', 'p24', 'p22', 'p25', 'p26'];
const pinRank = (id: string) => {
  const i = PINNED.indexOf(id);
  return i < 0 ? PINNED.length : i;
};

export const repliesTo = (id: string) =>
  posts.filter((p) => p.replyTo === id).sort((a, b) => a.createdAt - b.createdAt);

export const postsBy = (handle: string) =>
  posts.filter((p) => p.author === handle).sort((a, b) => b.createdAt - a.createdAt);

export const likedPosts = () => posts.filter((p) => p.liked);

export function toggleLike(id: string) {
  setPosts(
    (p) => p.id === id,
    produce((p) => {
      p.liked = !p.liked;
      p.likes += p.liked ? 1 : -1;
    }),
  );
}

export function toggleRepost(id: string) {
  setPosts(
    (p) => p.id === id,
    produce((p) => {
      p.reposted = !p.reposted;
      p.reposts += p.reposted ? 1 : -1;
    }),
  );
}

export function toggleBookmark(id: string) {
  setPosts(
    (p) => p.id === id,
    'bookmarked',
    (b) => !b,
  );
}

let nextId = 100;
export function publish(text: string, replyTo?: string) {
  const id = `p${nextId++}`;
  setPosts(
    produce((all) => {
      all.push({
        id,
        author: ME,
        text,
        replyTo,
        createdAt: Date.now(),
        replies: 0,
        reposts: 0,
        likes: 0,
        views: 0,
        liked: false,
        reposted: false,
        bookmarked: false,
      });
      const parent = replyTo && all.find((p) => p.id === replyTo);
      if (parent) parent.replies++;
    }),
  );
  return id;
}

const fresh = [
  ['maya', 'Pull to refresh: one push, one new row.'],
  ['ryan', 'Fresh from the pull to refresh. Still zero React.'],
  ['iris', 'The accent colour is one signal. Every button follows.'],
  ['leo', 'Every row here is keyed and never recreated.'],
] as const;
let freshIndex = 0;
/** What a refresh brings: one new post from someone else. */
export function refresh() {
  const [author, text] = fresh[freshIndex++ % fresh.length]!;
  const id = `p${nextId++}`;
  setPosts(
    produce((all) => {
      all.push({
        id,
        author,
        text,
        createdAt: Date.now(),
        replies: 0,
        reposts: 0,
        likes: 1,
        views: 12,
        liked: false,
        reposted: false,
        bookmarked: false,
      });
    }),
  );
}

export function toggleFollow(handle: string) {
  setFollowing((set) => {
    const next = new Set(set);
    if (!next.delete(handle)) next.add(handle);
    return next;
  });
}

export function mute(handle: string) {
  setMuted((set) => new Set(set).add(handle));
}

export function markRead(id: string) {
  setActivity((a) => a.id === id, 'unread', false);
}

export function markAllRead() {
  setActivity({}, 'unread', false);
}

export function dismissActivity(id: string) {
  setActivity((all) => all.filter((a) => a.id !== id));
}

/** "4m", "2h", "3d": the timeline's own shorthand. */
export function ago(time: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - time) / 60_000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/** 1284 -> "1,284", 98200 -> "98.2K". */
export function compact(n: number) {
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
