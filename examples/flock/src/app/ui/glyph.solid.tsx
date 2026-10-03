/** @jsxImportSource @solidnative/platform/solid */
import {
  BadgeCheck,
  Bell,
  Bookmark,
  Calendar,
  ChartNoAxesColumn,
  Feather,
  Heart,
  Link,
  MapPin,
  MessageCircle,
  Plus,
  Repeat2,
  Settings,
  Share,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-static';
import { nativePlatform } from '@solidnative/fabric';
import { ExpoSymbol } from '@solidnative/expo/solid';
import { Icon } from '@solidnative/icons/solid';

const filled = (svg: string) => svg.replace('fill="none"', 'fill="currentColor"');

/** SF Symbol name -> the Lucide icon Android draws in its place. */
const LUCIDE: Record<string, string> = {
  'bubble.left': MessageCircle,
  'arrow.2.squarepath': Repeat2,
  heart: Heart,
  'heart.fill': filled(Heart),
  'square.and.arrow.up': Share,
  'chart.bar': ChartNoAxesColumn,
  bookmark: Bookmark,
  'bookmark.fill': filled(Bookmark),
  'checkmark.seal.fill': BadgeCheck,
  'bell.fill': Bell,
  'person.fill.badge.plus': UserPlus,
  'arrow.2.squarepath.circle': Repeat2,
  'square.and.pencil': Feather,
  plus: Plus,
  gearshape: Settings,
  sparkles: Sparkles,
  xmark: X,
  'mappin.and.ellipse': MapPin,
  link: Link,
  calendar: Calendar,
};

/** One icon, written once: a real SF Symbol on iOS, a vector Lucide icon on Android. */
export function Glyph(props: { name: string; size?: number; color: string; class?: string }) {
  if (nativePlatform() === 'ios')
    return (
      <ExpoSymbol
        class={props.class}
        name={props.name}
        size={props.size ?? 18}
        tintColor={props.color}
      />
    );
  return (
    <Icon
      class={props.class}
      svg={LUCIDE[props.name] ?? Sparkles}
      size={props.size ?? 18}
      color={props.color}
    />
  );
}
