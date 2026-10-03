import { createMemo, createSignal } from 'solid-js';
import { createServiceToken } from '@solidnative/device/solid';

/** A day as `YYYY-MM-DD`, which sorts and compares as the date it is. */
export type Day = string;

export interface CalendarEvent {
  readonly id: string;
  readonly day: Day;
  readonly title: string;
  /** Minutes from midnight. */
  readonly start: number;
  readonly end: number;
  readonly calendar: CalendarId;
}

export type CalendarId = 'work' | 'home' | 'fitness';

/** Each calendar's colour, bound as a CSS variable an event's block and rail derive from. */
export const CALENDAR_TONES: Record<CalendarId, string> = {
  work: '#4f46e5',
  home: '#ea580c',
  fitness: '#059669',
};

/** The first hour the day view shows, and how tall an hour is in it. */
export const DAY_START = 7;
export const DAY_END = 22;
export const HOUR = 64;

export const dayOf = (date: Date): Day =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function dateOf(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * The weeks of a month's grid, Monday first: every day from the Monday on or before the 1st to
 * the Sunday on or after the last, so each row is a whole week.
 */
export function monthGrid(year: number, month: number): Day[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const last = new Date(year, month + 1, 0);
  const trail = (7 - ((last.getDay() + 6) % 7) - 1) % 7;
  const days = lead + last.getDate() + trail;
  const weeks: Day[][] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push(dayOf(date));
  }
  return weeks;
}

/** `09:30` for minutes from midnight. */
export const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Where a finger at `y` in the day view falls, in minutes from midnight, snapped to a quarter
 * hour and kept inside the hours the view shows.
 */
export function minuteAt(y: number): number {
  const minutes = DAY_START * 60 + (y / HOUR) * 60;
  const snapped = Math.round(minutes / 15) * 15;
  return Math.max(DAY_START * 60, Math.min(DAY_END * 60, snapped));
}

/** The events that overlap, as columns side by side: each event's column and how many share it. */
export function lanes(
  events: readonly CalendarEvent[],
): Map<string, { readonly lane: number; readonly of: number }> {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = new Map<string, { lane: number; of: number }>();
  let group: CalendarEvent[] = [];
  let groupEnd = -1;
  let ends: number[] = [];
  const close = () => {
    for (const event of group) placed.get(event.id)!.of = ends.length;
    group = [];
    ends = [];
  };
  for (const event of sorted) {
    if (event.start >= groupEnd) close();
    let lane = ends.findIndex((end) => end <= event.start);
    if (lane === -1) lane = ends.push(event.end) - 1;
    else ends[lane] = event.end;
    placed.set(event.id, { lane, of: 0 });
    group.push(event);
    groupEnd = Math.max(groupEnd, event.end);
  }
  close();
  return placed;
}

const today = dayOf(new Date());
const offset = (days: number) => {
  const date = dateOf(today);
  date.setDate(date.getDate() + days);
  return dayOf(date);
};

const SEED: readonly CalendarEvent[] = [
  {
    id: 'e1',
    day: today,
    title: 'Stand-up',
    start: 9 * 60 + 30,
    end: 9 * 60 + 45,
    calendar: 'work',
  },
  {
    id: 'e2',
    day: today,
    title: 'Design review',
    start: 11 * 60,
    end: 12 * 60 + 30,
    calendar: 'work',
  },
  { id: 'e3', day: today, title: 'Lunch with Sam', start: 12 * 60, end: 13 * 60, calendar: 'home' },
  {
    id: 'e4',
    day: today,
    title: 'Run by the river',
    start: 18 * 60,
    end: 19 * 60,
    calendar: 'fitness',
  },
  {
    id: 'e5',
    day: offset(1),
    title: 'Dentist',
    start: 8 * 60 + 30,
    end: 9 * 60 + 15,
    calendar: 'home',
  },
  {
    id: 'e6',
    day: offset(1),
    title: 'Planning',
    start: 14 * 60,
    end: 15 * 60 + 30,
    calendar: 'work',
  },
  {
    id: 'e7',
    day: offset(3),
    title: 'Yoga',
    start: 7 * 60 + 30,
    end: 8 * 60 + 30,
    calendar: 'fitness',
  },
  {
    id: 'e8',
    day: offset(-2),
    title: 'Quarterly numbers',
    start: 10 * 60,
    end: 11 * 60,
    calendar: 'work',
  },
];

export class AgendaModel {
  readonly today = today;
  private readonly eventsState = createSignal<readonly CalendarEvent[]>(SEED);
  readonly events = this.eventsState[0];
  readonly setEvents = this.eventsState[1];
  private readonly selectedState = createSignal<Day>(today);
  readonly selected = this.selectedState[0];
  readonly setSelected = this.selectedState[1];
  readonly selectedEvents = createMemo(() =>
    this.events()
      .filter((event) => event.day === this.selected())
      .sort((a, b) => a.start - b.start),
  );
  /** Which days have anything on, and in which calendars, for the dots under the month's days. */
  readonly busy = createMemo(() => {
    const out = new Map<Day, CalendarId[]>();
    for (const event of this.events()) {
      const calendars = out.get(event.day) ?? [];
      if (!calendars.includes(event.calendar)) calendars.push(event.calendar);
      out.set(event.day, calendars);
    }
    return out;
  });
  private next = 100;

  add(day: Day, start: number, end: number): CalendarEvent {
    const event: CalendarEvent = {
      id: `e${this.next++}`,
      day,
      title: 'New event',
      start: Math.min(start, end),
      end: Math.max(Math.max(start, end), Math.min(start, end) + 15),
      calendar: 'work',
    };
    this.setEvents((events) => [...events, event]);
    return event;
  }

  remove(id: string): void {
    this.setEvents((events) => events.filter((event) => event.id !== id));
  }
}

export type Agenda = AgendaModel;
export const Agenda = createServiceToken('Agenda', () => new AgendaModel());
