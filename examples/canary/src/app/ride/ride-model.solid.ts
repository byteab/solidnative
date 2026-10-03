import { batch, createMemo, createSignal, getOwner, onCleanup } from 'solid-js';
import { createServiceToken } from '@solid-native/device/solid';

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Place {
  readonly id: string;
  readonly name: string;
  readonly area: string;
  readonly coordinates: Coordinates;
}

export interface RideOption {
  readonly id: 'economy' | 'comfort' | 'xl';
  readonly name: string;
  readonly seats: number;
  /** Pounds per kilometre, on top of the base fare. */
  readonly perKm: number;
  readonly base: number;
  /** Minutes until a car of this kind reaches the pickup. */
  readonly eta: number;
}

export interface Driver {
  readonly id: string;
  readonly name: string;
  readonly car: string;
  readonly plate: string;
  readonly coordinates: Coordinates;
}

export type TripStage = 'idle' | 'choosing' | 'finding' | 'arriving';

/** Where the rider is standing: King's Cross. */
export const PICKUP: Coordinates = { latitude: 51.5308, longitude: -0.1238 };

export const PLACES: readonly Place[] = [
  ['British Museum', 'Bloomsbury', 51.5194, -0.127],
  ['Tate Modern', 'Bankside', 51.5076, -0.0994],
  ['Borough Market', 'Southwark', 51.5055, -0.091],
  ['Covent Garden', 'West End', 51.5117, -0.124],
  ['Camden Market', 'Camden', 51.5413, -0.1463],
  ['Paddington', 'Westminster', 51.5154, -0.1755],
  ['Victoria', 'Westminster', 51.4965, -0.1447],
  ['Greenwich Park', 'Greenwich', 51.4769, -0.0005],
  ['Canary Wharf', 'Docklands', 51.5054, -0.0235],
  ['Hampstead Heath', 'Hampstead', 51.5608, -0.1629],
  ['Notting Hill', 'Kensington', 51.5094, -0.2046],
  ['Natural History Museum', 'South Kensington', 51.4967, -0.1764],
  ['Shoreditch', 'Hackney', 51.5265, -0.0782],
  ['Brixton', 'Lambeth', 51.4613, -0.1156],
  ['Heathrow Terminal 5', 'Hillingdon', 51.4723, -0.4884],
  ['London Bridge', 'Southwark', 51.5079, -0.0877],
  ['Wembley Stadium', 'Brent', 51.556, -0.2796],
  ['Richmond Park', 'Richmond', 51.4428, -0.2745],
].map(([name, area, latitude, longitude], i) => ({
  id: `p${i + 1}`,
  name: name as string,
  area: area as string,
  coordinates: { latitude: latitude as number, longitude: longitude as number },
}));

export const OPTIONS: readonly RideOption[] = [
  { id: 'economy', name: 'Economy', seats: 4, perKm: 1.2, base: 2.5, eta: 3 },
  { id: 'comfort', name: 'Comfort', seats: 4, perKm: 1.7, base: 3.5, eta: 5 },
  { id: 'xl', name: 'XL', seats: 6, perKm: 2.3, base: 4.5, eta: 8 },
];

/** Straight-line kilometres between two points, which is what the fares are made from. */
export function kilometres(from: Coordinates, to: Coordinates): number {
  const radius = 6371;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

/** The fare for a trip, to the penny. */
export function fare(option: RideOption, km: number): number {
  return Math.round((option.base + option.perKm * km) * 100) / 100;
}

const POUNDS = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatFare(amount: number): string {
  return POUNDS.format(amount);
}

/** Places whose name or area contains every word of the query, case aside. */
export function searchPlaces(query: string): readonly Place[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return PLACES;
  return PLACES.filter((place) => {
    const text = `${place.name} ${place.area}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Six drivers around the pickup, each nudged a little every tick, as a live map moves them. */
export function drivers(tick: number): readonly Driver[] {
  return ['Priya', 'Tom', 'Aisha', 'Kofi', 'Mei', 'Luca'].map((name, i) => {
    const angle = (i / 6) * Math.PI * 2 + tick * 0.05;
    const reach = 0.004 + (i % 3) * 0.002;
    return {
      id: `d${i + 1}`,
      name,
      car: ['Toyota Prius', 'Kia Niro', 'Tesla Model 3'][i % 3]!,
      plate: `LN${24 + i} ${'ABCDEF'[i]}XR`,
      coordinates: {
        latitude: PICKUP.latitude + Math.sin(angle) * reach,
        longitude: PICKUP.longitude + Math.cos(angle) * reach * 1.6,
      },
    };
  });
}

/** One trip, shared by the map and the sheet over it. */
export class TripModel {
  private readonly destinationState = createSignal<Place | null>(null);
  readonly destination = this.destinationState[0];
  private readonly optionState = createSignal<RideOption>(OPTIONS[0]!);
  readonly option = this.optionState[0];
  readonly setOption = this.optionState[1];
  private readonly stageState = createSignal<TripStage>('idle');
  readonly stage = this.stageState[0];
  private readonly driverState = createSignal<Driver | null>(null);
  readonly driver = this.driverState[0];
  readonly km = createMemo(() => {
    const destination = this.destination();
    return destination ? kilometres(PICKUP, destination.coordinates) : 0;
  });
  private finding: ReturnType<typeof setTimeout> | undefined;
  private epoch = 0;
  private active = true;
  constructor() {
    if (getOwner())
      onCleanup(() => {
        this.active = false;
        this.invalidate();
      });
  }
  private invalidate() {
    this.epoch++;
    if (this.finding !== undefined) clearTimeout(this.finding);
    this.finding = undefined;
  }
  choose(place: Place): void {
    if (!this.active) return;
    this.invalidate();
    batch(() => {
      this.destinationState[1](place);
      this.driverState[1](null);
      this.stageState[1]('choosing');
    });
  }
  request(): void {
    if (!this.active || !this.destination()) return;
    this.invalidate();
    const request = this.epoch;
    this.stageState[1]('finding');
    if (!this.active || request !== this.epoch) return;
    this.finding = setTimeout(() => {
      if (!this.active || request !== this.epoch) return;
      this.finding = undefined;
      batch(() => {
        this.driverState[1](
          drivers(0)[OPTIONS.findIndex((option) => option.id === this.option().id)] ??
            drivers(0)[0]!,
        );
        this.stageState[1]('arriving');
      });
    }, 2000);
  }
  cancel(): void {
    this.invalidate();
    if (!this.active) return;
    batch(() => {
      this.destinationState[1](null);
      this.driverState[1](null);
      this.stageState[1]('idle');
    });
  }
}
export type Trip = TripModel;
export const Trip = createServiceToken('Trip', () => new TripModel());
