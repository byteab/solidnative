/**
 * The course's lessons in order, written out like `navigation.ts` so the outline is one screen.
 *
 * The title and summary live here rather than in each lesson's front matter, so the course page
 * can list every lesson without loading any of them, and so `build/prerender.ts` can read the list
 * in Node. See `course.ts` for the lessons themselves.
 */
export interface CourseLesson {
  readonly slug: string;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  /** Written into the outline but not yet into a lesson. */
  readonly planned?: boolean;
}

export const COURSE_TITLE = 'Build a habit tracker';

export const LESSONS: readonly CourseLesson[] = [
  {
    slug: 'first-screen',
    number: 1,
    title: 'Your first screen',
    summary: 'Native elements instead of the DOM, and the views they become.',
  },
  {
    slug: 'layout-and-style',
    number: 2,
    title: 'Layout and style',
    summary: 'Flexbox as a phone does it, and component CSS compiled for native.',
  },
  {
    slug: 'a-list-of-habits',
    number: 3,
    title: 'A list of habits',
    summary:
      'A list drawn from a signal, what it costs in native views, and a scroll view to hold it.',
  },
  {
    slug: 'state-and-components',
    number: 4,
    title: 'Touch',
    summary: 'Pressables, touch feedback with :active, and screen readers without a <button>.',
  },
  {
    slug: 'tailwind-and-platforms',
    number: 5,
    title: 'Tailwind and platforms',
    summary: 'Style with Tailwind, and let iOS, Android and dark mode each look right.',
  },
  {
    slug: 'a-form-for-new-habits',
    number: 6,
    title: 'A form for new habits',
    summary: 'A native text field bound to a signal, and a keyboard that behaves.',
  },
  {
    slug: 'testing',
    number: 7,
    title: 'Testing',
    summary:
      'Test the native tree and its interactions on a fake Fabric, and see what needs a device.',
  },
];
