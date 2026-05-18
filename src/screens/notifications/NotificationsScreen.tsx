import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { DbTask, DbHabit, DbCalendarEvent } from '../../types/database';

type Signal =
  | { kind: 'overdue';   id: string; task: DbTask;   accent: string; icon: string; sortAt: number; }
  | { kind: 'streak';    id: string; habit: DbHabit; accent: string; icon: string; sortAt: number; }
  | { kind: 'meeting';   id: string; event: DbCalendarEvent; accent: string; icon: string; sortAt: number; }
  | { kind: 'greeting';  id: string; openCount: number; doneCount: number; habitsDone: number; habitsTotal: number; accent: string; icon: string; sortAt: number; };

const FILTERS = ['All', 'Tasks', 'Streaks', 'Meetings'] as const;
type Filter = typeof FILTERS[number];

function isOverdue(task: DbTask): boolean {
  if (!task.due_date || task.status === 'done' || task.status === 'deferred') return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

function streakMilestone(streak: number): boolean {
  return streak > 0 && (streak === 3 || streak === 7 || streak === 14 || streak === 21 || streak === 30 || streak === 50 || streak === 100 || streak % 100 === 0);
}

function fmtRelative(d: Date): string {
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  if (absMin < 1) return 'now';
  if (absMin < 60) return diffMs >= 0 ? `in ${absMin}m` : `${absMin}m ago`;
  const absH = Math.round(absMin / 60);
  if (absH < 24) return diffMs >= 0 ? `in ${absH}h` : `${absH}h ago`;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tasks    = useTaskStore(s => s.tasks);
  const loadTasks= useTaskStore(s => s.loadFromDB);

  const habits     = useHabitStore(s => s.habits);
  const loadHabits = useHabitStore(s => s.loadFromDB);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const events    = useCalendarStore(s => s.events);
  const loadCal   = useCalendarStore(s => s.loadRange);

  const [filter, setFilter] = useState<Filter>('All');
  const [reading, setReading] = useState(false);

  useEffect(() => {
    void loadTasks();
    void loadHabits();
    const today = new Date().toISOString().slice(0, 10);
    void loadCal(today, today);
  }, [loadTasks, loadHabits, loadCal]);

  async function refresh() {
    setReading(true);
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([loadTasks(), loadHabits(), loadCal(today, today)]);
    setReading(false);
  }

  const signals = useMemo<Signal[]>(() => {
    const list: Signal[] = [];
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    // Day greeting / summary
    const openCount = tasks.filter(t => t.status !== 'done' && t.status !== 'deferred').length;
    const doneToday = tasks.filter(t => t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length;
    const habitsDone = habits.filter(h => isCompletedToday(h.id)).length;
    list.push({
      kind: 'greeting', id: 'g-today',
      openCount, doneCount: doneToday,
      habitsDone, habitsTotal: habits.length,
      accent: C.indigo, icon: '✦', sortAt: todayMs + 6 * 3600_000,
    });

    // Overdue tasks
    for (const t of tasks) {
      if (isOverdue(t)) {
        list.push({
          kind: 'overdue', id: `t-${t.id}`, task: t,
          accent: C.red, icon: '⚡',
          sortAt: new Date(t.due_date!).getTime(),
        });
      }
    }

    // Streak milestones
    for (const h of habits) {
      if (streakMilestone(h.current_streak)) {
        list.push({
          kind: 'streak', id: `h-${h.id}`, habit: h,
          accent: C.green, icon: '🔥',
          sortAt: todayMs + 30 * 60_000,
        });
      }
    }

    // Upcoming meetings (next 3 today)
    const upcoming = events
      .filter(e => new Date(e.start_time).getTime() >= now)
      .slice(0, 3);
    for (const e of upcoming) {
      list.push({
        kind: 'meeting', id: `e-${e.id}`, event: e,
        accent: C.blue, icon: '📅',
        sortAt: new Date(e.start_time).getTime(),
      });
    }

    // Most recent first
    return list.sort((a, b) => b.sortAt - a.sortAt);
  }, [tasks, habits, events, isCompletedToday]);

  const filtered = useMemo(() => {
    if (filter === 'All')      return signals;
    if (filter === 'Tasks')    return signals.filter(s => s.kind === 'overdue' || s.kind === 'greeting');
    if (filter === 'Streaks')  return signals.filter(s => s.kind === 'streak');
    if (filter === 'Meetings') return signals.filter(s => s.kind === 'meeting');
    return signals;
  }, [signals, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar
        title="Notifications"
        subtitle={signals.length === 0 ? 'All caught up' : `${signals.length} signal${signals.length === 1 ? '' : 's'}`}
      />

      {/* Filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 6 }}
      >
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <View style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.sm,
                backgroundColor: active ? C.ink : C.card,
                borderWidth: active ? 0 : 1, borderColor: C.hairline,
              }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? '#fff' : C.ink }}>{f}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 8 }}
        refreshControl={<RefreshControl refreshing={reading} onRefresh={refresh} tintColor={C.indigo} />}
      >
        {filtered.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.ink2 }}>You're caught up</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink3, marginTop: 6, textAlign: 'center' }}>
              No active signals match this filter.
            </Text>
          </View>
        ) : (
          filtered.map(s => <SignalCard key={s.id} signal={s} onOpen={onOpen} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function onOpen(s: Signal) {
    if (s.kind === 'overdue') navigation.navigate('TaskDetail', { taskId: s.task.id });
  }
}

function SignalCard({ signal, onOpen }: { signal: Signal; onOpen: (s: Signal) => void }) {
  const title = useTitle(signal);
  const body  = useBody(signal);

  return (
    <Pressable onPress={() => onOpen(signal)}>
      <View style={{
        backgroundColor: C.card, borderRadius: Radii.md, padding: 14,
        borderWidth: 1, borderColor: C.hairline,
        position: 'relative', overflow: 'hidden',
        ...Shadows.card,
      }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: signal.accent }} />
        <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 6 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: `${signal.accent}1A`,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Text style={{ fontSize: 14, color: signal.accent }}>{signal.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>{title}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, marginTop: 3, lineHeight: 18 }}>{body}</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: C.ink3, marginTop: 6 }}>
              {fmtRelative(new Date(signal.sortAt))}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function useTitle(s: Signal): string {
  switch (s.kind) {
    case 'greeting': return `${greeting()}`;
    case 'overdue':  return 'Task overdue';
    case 'streak':   return `${s.habit.current_streak}-day streak`;
    case 'meeting':  return s.event.title;
  }
}

function useBody(s: Signal): string {
  switch (s.kind) {
    case 'greeting':
      return `${s.openCount} open task${s.openCount === 1 ? '' : 's'} · ${s.doneCount} shipped today · ${s.habitsDone}/${s.habitsTotal || 0} habits done.`;
    case 'overdue':
      return `${s.task.title} — due ${s.task.due_date}`;
    case 'streak':
      return `${s.habit.name} — your longest is ${s.habit.longest_streak}. Keep going.`;
    case 'meeting': {
      const start = new Date(s.event.start_time);
      const t = `${start.getHours().toString().padStart(2,'0')}:${start.getMinutes().toString().padStart(2,'0')}`;
      return s.event.location
        ? `${t} · ${s.event.location}`
        : `Starts at ${t}`;
    }
  }
}
