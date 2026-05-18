import { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { C, Quadrants, Radii, Shadows } from '../../theme/tokens';
import { Card } from '../../components/atoms/Card';
import { TopBar } from '../../components/atoms/TopBar';
import { Pill } from '../../components/atoms/Pill';
import { useIsTablet } from '../../lib/layout';
import type { RootStackParamList } from '../../navigation/RootNavigator';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function TodayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tasks       = useTaskStore(s => s.tasks);
  const loadTasks   = useTaskStore(s => s.loadFromDB);
  const setStatus   = useTaskStore(s => s.setStatus);
  const tasksLoading= useTaskStore(s => s.loading);

  const habits        = useHabitStore(s => s.habits);
  const loadHabits    = useHabitStore(s => s.loadFromDB);
  const toggleHabit   = useHabitStore(s => s.toggleToday);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const emailActions  = useEmailActionsStore(s => s.actions);
  const loadEmails    = useEmailActionsStore(s => s.loadFromDB);

  useEffect(() => { void loadTasks(); void loadHabits(); void loadEmails(); }, [loadTasks, loadHabits, loadEmails]);

  const pendingEmails = useMemo(
    () => emailActions.filter(a => a.status !== 'handled').length,
    [emailActions],
  );

  const { topTasks, doneToday, totalOpen } = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done');
    const ranked = [...open].sort((a, b) => {
      const order: Record<string, number> = { urgent_important: 0, important_not_urgent: 1, urgent_not_important: 2, neither: 3 };
      const ai = order[a.quadrant ?? 'neither'] ?? 4;
      const bi = order[b.quadrant ?? 'neither'] ?? 4;
      return ai - bi;
    });
    const today = new Date().toISOString().slice(0, 10);
    const done = tasks.filter(t => t.completed_at && t.completed_at.slice(0, 10) === today).length;
    return { topTasks: ranked.slice(0, 3), doneToday: done, totalOpen: open.length };
  }, [tasks]);

  const habitsDone = habits.filter(h => isCompletedToday(h.id)).length;
  const tablet = useIsTablet();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar title="Today" subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />

      {/* Greeting (always top, never split) */}
      <View style={{ paddingHorizontal: 20, marginTop: 6, marginBottom: 6, maxWidth: tablet ? 1100 : undefined, alignSelf: tablet ? 'center' : 'auto', width: tablet ? '100%' : undefined }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: C.ink3, letterSpacing: 1.2 }}>
          {greeting().toUpperCase()}
        </Text>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 28, color: C.ink, letterSpacing: -0.6, marginTop: 4 }}>
          What needs your attention.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20, paddingBottom: 120,
          maxWidth: tablet ? 1100 : undefined,
          alignSelf: tablet ? 'center' : undefined,
          width: tablet ? '100%' : undefined,
        }}
        refreshControl={<RefreshControl refreshing={tasksLoading} onRefresh={() => { void loadTasks(); void loadHabits(); }} tintColor={C.indigo} />}
      >
        {/* Stat strip — full width on both */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <StatCard label="Open tasks"  value={totalOpen}  accent={C.indigo} />
          <StatCard label="Done today"  value={doneToday}  accent={C.green}  />
          <StatCard label="Habits"      value={`${habitsDone}/${habits.length || 0}`} accent={C.red} />
        </View>

        <View style={{ flexDirection: tablet ? 'row' : 'column', gap: tablet ? 24 : 0 }}>
          {/* LEFT (tablet) / TOP (phone) — The three */}
          <View style={{ flex: tablet ? 1 : undefined, gap: 16 }}>
            {pendingEmails > 0 ? (
              <Pressable onPress={() => navigation.navigate('Inbox')}>
                <View style={{
                  backgroundColor: C.indigoSoft, borderRadius: Radii.md,
                  borderWidth: 1, borderColor: 'rgba(42,63,217,0.18)',
                  padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Text style={{ fontSize: 22 }}>📬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.indigo }}>
                      {pendingEmails} item{pendingEmails === 1 ? '' : 's'} in inbox
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink2, marginTop: 2 }}>
                      Triaged emails waiting for review.
                    </Text>
                  </View>
                  <Text style={{ color: C.indigo, fontSize: 22, lineHeight: 22 }}>›</Text>
                </View>
              </Pressable>
            ) : null}

            <SectionHeader title="The three" hint="Highest leverage right now" />
            {topTasks.length === 0 ? (
              <Card><Text style={{ color: C.ink2, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Nothing queued. Add a task to begin.</Text></Card>
            ) : (
              <View style={{ gap: 10 }}>
                {topTasks.map(t => {
                  const q = Quadrants[t.quadrant ?? 'neither'];
                  return (
                    <Pressable key={t.id} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}>
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <Pressable
                            onPress={() => void setStatus(t.id, 'done')}
                            hitSlop={8}
                            style={{
                              width: 22, height: 22, borderRadius: 11,
                              borderWidth: 2, borderColor: q.color, marginTop: 1,
                            }}
                          />
                          <View style={{ flex: 1, gap: 6 }}>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{t.title}</Text>
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                              <Pill label={q.label} color={q.color} soft={q.soft} small />
                              {t.effort_minutes ? <Pill label={`${t.effort_minutes}m`} color={C.ink2} soft="#EEF1F6" small /> : null}
                              {t.due_date ? <Pill label={t.due_date} color={C.ink2} soft="#EEF1F6" small /> : null}
                            </View>
                          </View>
                          <Text style={{ color: C.ink3, fontSize: 22, lineHeight: 22 }}>›</Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* RIGHT (tablet) / BOTTOM (phone) — Habits */}
          <View style={{ flex: tablet ? 1 : undefined, gap: 16, marginTop: tablet ? 0 : 16 }}>
            <SectionHeader title="Habits" hint="Swipe right to mark complete · Swipe left to archive" />
            {habits.length === 0 ? (
              <Card><Text style={{ color: C.ink2, fontFamily: 'Inter_500Medium', fontSize: 14 }}>No habits yet. Create one from the Habits tab.</Text></Card>
            ) : (
              <View style={{ gap: 10 }}>
                {habits.slice(0, 5).map(h => {
                  const done = isCompletedToday(h.id);
                  return (
                    <Pressable key={h.id} onPress={() => void toggleHabit(h.id)}>
                      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            borderWidth: 2, borderColor: done ? C.green : C.hairline,
                            backgroundColor: done ? C.green : 'transparent',
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{h.name}</Text>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: C.ink3, marginTop: 2 }}>
                            {h.frequency} · {h.current_streak} day streak
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.card,
        borderRadius: Radii.md,
        padding: 14,
        borderWidth: 1,
        borderColor: C.hairline,
        ...Shadows.card,
      }}
    >
      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 24, color: accent, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: C.ink3, marginTop: 2, letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ marginTop: 12, marginBottom: 2 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink2, letterSpacing: 1.4 }}>{title.toUpperCase()}</Text>
      {hint ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink3, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}
