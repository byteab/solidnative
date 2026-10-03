/** @jsxImportSource @solid-native/platform/solid */
import { Check, Flame, Plus } from 'lucide-static';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { ColorScheme, useService } from '@solid-native/device/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { Icon, IconProvider } from '@solid-native/icons/solid';
import { For, Show, withNativeStyles } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeStackOutlet,
  useNavigation,
} from '@solid-native/router/solid';
import { Habits } from '../data/habits.solid.ts';
import { HabitRow } from './habit-row.solid.tsx';
import { ProgressBar } from './progress-bar.solid.tsx';
import sheet from './today.native.css';

const icons = { Check, Flame, Plus };

/** The Today tab is a stack of its own, for the native header its large title and "+" need. */
export function TodayStack() {
  return <NativeStackOutlet />;
}

/**
 * The habits due today: a progress bar for the day, and a checklist. Checking one off animates,
 * fires a haptic, and updates every streak on screen.
 */
export function Today() {
  const scheme = useService(ColorScheme);
  const habits = useService(Habits);
  const haptics = useService(Haptics);
  const navigation = useNavigation();
  /** The header button's icon, dark on a light bar and light on a dark one. */
  const headerIcon = () => (scheme.current() === 'dark' ? '#fafafa' : '#18181b');
  const doneCount = () => habits.habits().filter((habit) => habits.isDone(habit.id)).length;

  function toggleHabit(id: string) {
    const wasDone = habits.isDone(id);
    habits.toggleToday(id);
    haptics.notify(wasDone ? 'warning' : 'success');
  }

  return withNativeStyles(sheet, () => (
    <IconProvider icons={icons}>
      <NativeHeader title="Today" largeTitle>
        <NativeHeaderItem type="right">
          <Pressable
            class="add"
            accessibilityRole="button"
            accessibilityLabel="New habit"
            onPress={() => void navigation.present('/habit/new')}
          >
            <Icon name="Plus" size={22} color={headerIcon()} />
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>

      <ScrollView class="screen" contentInsetAdjustmentBehavior="automatic">
        <View class="content">
          <ProgressBar done={doneCount()} total={habits.habits().length} />
          <Show
            when={habits.habits().length > 0}
            fallback={
              <View class="empty">
                <Text class="empty-title">No habits yet</Text>
                <Text class="empty-body">Tap + to add the first one.</Text>
              </View>
            }
          >
            <View class="list">
              <For each={habits.habits()}>
                {(habit) => (
                  <HabitRow
                    habit={habit}
                    done={habits.isDone(habit.id)}
                    streak={habits.streak(habit.id)}
                    onToggle={() => toggleHabit(habit.id)}
                    onOpen={() => void navigation.push(`/habit/${habit.id}`)}
                  />
                )}
              </For>
            </View>
          </Show>
        </View>
      </ScrollView>
    </IconProvider>
  ));
}
