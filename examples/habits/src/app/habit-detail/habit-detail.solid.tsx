/** @jsxImportSource @solidnative/platform/solid */
import { Flame, Pencil, Trash2 } from 'lucide-static';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { ColorScheme, Dialogs, useService } from '@solidnative/device/solid';
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { For, Show, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, NativeHeaderItem, useNavigation, useRoute } from '@solidnative/router/solid';
import { calendarGrid, Habits } from '../data/habits.solid.ts';
import sheet from './habit-detail.native.css';

const WEEKS = 10;
const icons = { Flame, Pencil, Trash2 };

/** One habit in full: its streak, ten weeks of history as a grid, and edit/delete. */
export function HabitDetail() {
  const habits = useService(Habits);
  const dialogs = useService(Dialogs);
  const scheme = useService(ColorScheme);
  const navigation = useNavigation();
  const id = useRoute().params['id'] ?? '';
  /** The header button's icon, dark on a light bar and light on a dark one. */
  const headerIcon = () => (scheme.current() === 'dark' ? '#fafafa' : '#18181b');
  const habit = () => habits.find(id);
  const streak = () => habits.streak(id);
  const grid = () => calendarGrid(habits.completions(id), WEEKS);

  async function remove() {
    const sure = await dialogs.confirm(`Delete "${habit()?.name}"?`, { destructive: true });
    if (!sure) return;
    habits.remove(id);
    void navigation.back();
  }

  return withNativeStyles(sheet, () => (
    <IconProvider icons={icons}>
      <NativeHeader title={habit()?.name ?? 'Habit'} backTitle="Today">
        <NativeHeaderItem type="right">
          <Pressable
            class="header-button"
            accessibilityRole="button"
            accessibilityLabel="Edit habit"
            onPress={() => void navigation.present(`/habit/${id}/edit`)}
          >
            <Icon name="Pencil" size={19} color={headerIcon()} />
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>

      <Show
        when={habit()}
        fallback={
          <View class="screen missing">
            <Text class="empty-body">This habit no longer exists.</Text>
          </View>
        }
      >
        {(current) => (
          <ScrollView class="screen" contentInsetAdjustmentBehavior="automatic">
            <View class="content">
              <View class="streak-card" style={{ backgroundColor: current().colour }}>
                <Icon name="Flame" size={28} color="#ffffff" />
                <Text class="streak-count">{streak()}</Text>
                <Text class="streak-label">day{streak() === 1 ? '' : 's'} in a row</Text>
              </View>

              <Text class="section-title">Last {WEEKS} weeks</Text>
              <View class="grid">
                <For each={grid()}>
                  {(day) => (
                    <View
                      class="cell"
                      classList={{ today: day.today }}
                      style={{ backgroundColor: day.done ? current().colour : undefined }}
                    />
                  )}
                </For>
              </View>

              <Pressable class="delete" accessibilityRole="button" onPress={() => void remove()}>
                <Icon name="Trash2" size={16} color="#e11d48" />
                <Text class="delete-label">Delete habit</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Show>
    </IconProvider>
  ));
}
