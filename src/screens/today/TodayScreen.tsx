import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, Sparkles, Zap } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useFinanceStore } from '../../store/financeStore';
import { C, Quadrants, Radii, Shadows } from '../../theme/tokens';
import { UIFont, NumFont } from '../../theme/typography';
import { useScreenPalette } from '../../theme/palette';
import { useIsTablet } from '../../lib/layout';
import type { RootStackParamList } from '../../navigation/RootNavigator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToday(): string { return new Date().toISOString().slice(0, 10); }

function greetingParts(): { salutation: string } {
  const h = new Date().getHours();
  if (h < 5)  return { salutation: 'LATE NIGHT,' };
  if (h < 12) return { salutation: 'GOOD MORNING,' };
  if (h < 17) return { salutation: 'GOOD AFTERNOON,' };
  if (h < 21) return { salutation: 'GOOD EVENING,' };
  return       { salutation: 'GOOD NIGHT,' };
}

function dateLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function dayElapsedPct(): number {
  const now = new Date();
  return Math.min(100, Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100));
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TodayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();
  const tablet = useIsTablet();

  // Stores
  const user             = useAuthStore(s => s.user);
  const tasks            = useTaskStore(s => s.tasks);
  const loadTasks        = useTaskStore(s => s.loadFromDB);
  const setStatus        = useTaskStore(s => s.setStatus);
  const tasksLoading     = useTaskStore(s => s.loading);

  const habits           = useHabitStore(s => s.habits);
  const loadHabits       = useHabitStore(s => s.loadFromDB);
  const toggleHabit      = useHabitStore(s => s.toggleToday);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const emailActions     = useEmailActionsStore(s => s.actions);
  const loadEmails       = useEmailActionsStore(s => s.loadFromDB);

  const events           = useCalendarStore(s => s.events);
  const loadRange        = useCalendarStore(s => s.loadRange);

  const accounts         = useFinanceStore(s => s.accounts);
  const transactions     = useFinanceStore(s => s.transactions);
  const loadFinance      = useFinanceStore(s => s.loadAll);

  const [refreshing, setRefreshing] = useState(false);
  const [dayPct] = useState(dayElapsedPct);

  const today = isoToday();

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadTasks(),
      loadHabits(),
      loadEmails(),
      loadRange(today, today),
      loadFinance(),
    ]);
  }, [loadTasks, loadHabits, loadEmails, loadRange, loadFinance, today]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const pendingEmails = useMemo(
    () => emailActions.filter(a => a.status !== 'handled').length,
    [emailActions],
  );

  const { topTasks, doneToday, totalOpen, weeklyScore } = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done');
    const ranked = [...open].sort((a, b) => {
      const ord: Record<string, number> = { urgent_important: 0, important_not_urgent: 1, urgent_not_important: 2, neither: 3 };
      return (ord[a.quadrant ?? 'neither'] ?? 4) - (ord[b.quadrant ?? 'neither'] ?? 4);
    });
    const done = tasks.filter(t => t.completed_at?.slice(0, 10) === today).length;

    const habitsDoneCount = habits.filter(h => isCompletedToday(h.id)).length;
    const habitPct   = habits.length > 0 ? Math.round((habitsDoneCount / habits.length) * 100) : 0;
    const taskPct    = Math.min(Math.round(done * 20 + (1 - Math.min(open.length, 10) / 10) * 40), 100);
    const planPct    = tasks.length > 0
      ? Math.round((tasks.filter(t => !!t.due_date).length / tasks.length) * 100)
      : 0;
    const score      = Math.round(habitPct * 0.4 + taskPct * 0.4 + planPct * 0.2);
    return { topTasks: ranked.slice(0, 3), doneToday: done, totalOpen: open.length,
      weeklyScore: { total: score, habits: habitPct, tasks: taskPct, planning: planPct } };
  }, [tasks, habits, isCompletedToday, today]);

  const habitsDone = habits.filter(h => isCompletedToday(h.id)).length;

  // Today's upcoming calendar events (not yet started or in progress)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => {
        const start = new Date(e.start_time);
        const end   = new Date(e.end_time);
        return start.toISOString().slice(0, 10) === today && end > now;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 3);
  }, [events, today]);

  // Finance quick stats
  const { safeToSpend, spentToday } = useMemo(() => {
    const paymentAccounts = accounts.filter(a =>
      a.account_type !== 'credit_card' && a.currency === 'EGP' && a.balance > 0,
    );
    const safe = paymentAccounts.reduce((s, a) => s + a.balance, 0);
    const spent = transactions
      .filter(t => t.date === today && t.tx_type === 'expense' && t.currency === 'EGP')
      .reduce((s, t) => s + t.amount, 0);
    return { safeToSpend: safe, spentToday: spent };
  }, [accounts, transactions, today]);

  // Brief lines
  const briefLines = useMemo(() => {
    const lines: string[] = [];
    if (topTasks.length > 0) {
      lines.push(`Lead with "${topTasks[0]?.title ?? 'your top task'}" — it carries the most leverage today.`);
    } else {
      lines.push('No urgent tasks queued — a clear morning to focus on what matters.');
    }
    if (habitsDone === habits.length && habits.length > 0) {
      lines.push(`All ${habits.length} habit${habits.length > 1 ? 's' : ''} done — a perfect day so far.`);
    } else {
      lines.push(`${habitsDone} of ${habits.length || 0} habit${habits.length !== 1 ? 's' : ''} checked in${habits.length > 0 ? ` — ${habits.length - habitsDone} remaining` : ''}.`);
    }
    if (upcomingEvents.length > 0) {
      const next = upcomingEvents[0];
      lines.push(`Next up: ${next.title} at ${fmtTime(next.start_time)}.`);
    } else if (doneToday > 0) {
      lines.push(`${doneToday} task${doneToday > 1 ? 's' : ''} shipped — keep the thread.`);
    } else {
      lines.push(`${totalOpen} open task${totalOpen !== 1 ? 's' : ''} across all quadrants.`);
    }
    return lines;
  }, [topTasks, habitsDone, habits.length, upcomingEvents, doneToday, totalOpen]);

  // Display name
  const displayName = useMemo(() => {
    if (!user?.name) return 'BAHAA';
    return user.name.split(' ')[0]?.toUpperCase() ?? 'BAHAA';
  }, [user]);

  const { salutation } = greetingParts();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 14, color: P.accentInk }}>B</Text>
          </View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink4, letterSpacing: 1.4 }}>BPA</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => navigation.navigate('Search')} hitSlop={8}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 15 }}>🔍</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={16} color={P.ink2} strokeWidth={2} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── Hero greeting ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>
          {dateLabel().toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
          <View>
            <Text style={{ fontFamily: NumFont.regular, fontSize: 14, color: P.ink3, letterSpacing: 0.1 }}>
              {salutation}
            </Text>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 32, color: P.ink, letterSpacing: -1, lineHeight: 38 }}>
              {displayName}
            </Text>
          </View>
          {/* Score badge */}
          <View style={{
            alignItems: 'center',
            backgroundColor: P.surface, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.hairline,
            paddingHorizontal: 12, paddingVertical: 8,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 26, color: P.ink, letterSpacing: -1 }}>
              {weeklyScore.total}
            </Text>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 9, color: P.ink4, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Score
            </Text>
          </View>
        </View>

        {/* Day elapsed bar */}
        <View style={{ marginTop: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 10, color: P.ink4 }}>Day elapsed</Text>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink3 }}>{dayPct}%</Text>
          </View>
          <View style={{ height: 3, backgroundColor: P.hairline, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 3, width: `${dayPct}%`, backgroundColor: P.accent, borderRadius: 2 }} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
          paddingTop: 14,
          maxWidth: tablet ? 1100 : undefined,
          alignSelf: tablet ? 'center' : undefined,
          width: tablet ? '100%' : undefined,
          gap: 14,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={P.accent} />
        }
      >

        {/* ── Morning Brief — always dark hero ── */}
        <View style={{
          backgroundColor: '#1F1A14', borderRadius: Radii.md,
          ...Shadows.card,
        }}>
          <View style={{ padding: 18, gap: 12 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.accent, letterSpacing: 1.8 }}>
                ✦ THE BRIEF
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {tasksLoading && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent, opacity: 0.6 }} />
                )}
                <Text style={{ fontFamily: UIFont.regular, fontSize: 10, color: 'rgba(253,248,231,0.35)' }}>
                  {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {/* Lines */}
            <View style={{ gap: 8 }}>
              {briefLines.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.accent, lineHeight: 20, width: 14 }}>
                    {i + 1}
                  </Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: 'rgba(253,248,231,0.80)', lineHeight: 20, flex: 1 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            {/* Score sub-metrics */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'TASKS', value: weeklyScore.tasks },
                { label: 'HABITS', value: weeklyScore.habits },
                { label: 'PLAN', value: weeklyScore.planning },
              ].map(m => (
                <View key={m.label} style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 9, color: 'rgba(253,248,231,0.45)', letterSpacing: 1.2 }}>
                      {m.label}
                    </Text>
                    <Text style={{ fontFamily: NumFont.semiBold, fontSize: 10, color: 'rgba(253,248,231,0.70)' }}>
                      {m.value}
                    </Text>
                  </View>
                  <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 3, width: `${m.value}%`, backgroundColor: P.accent, borderRadius: 2 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Inbox alert ── */}
        {pendingEmails > 0 && (
          <Pressable onPress={() => navigation.navigate('Inbox')}>
            <View style={{
              backgroundColor: P.accentTint, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.accentBorder,
              padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: Radii.nav,
                backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16 }}>✉️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
                  {pendingEmails} item{pendingEmails !== 1 ? 's' : ''} need{pendingEmails === 1 ? 's' : ''} you
                </Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>
                  Inbox · triaged threads waiting for review
                </Text>
              </View>
              <ChevronRight size={16} color={P.accent} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}

        {/* ── NEXT UP — calendar events ── */}
        {upcomingEvents.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionEyebrow label="NEXT UP" sub="Today's remaining events" />
            <View style={{ gap: 6 }}>
              {upcomingEvents.map((e, idx) => {
                const isNow = new Date(e.start_time) <= new Date() && new Date(e.end_time) >= new Date();
                return (
                  <Pressable key={e.id} onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}>
                    <View style={{
                      backgroundColor: P.surface, borderRadius: Radii.md,
                      borderWidth: 1, borderColor: isNow ? C.indigo : P.hairline,
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 12, paddingHorizontal: 14,
                      ...Shadows.card,
                    }}>
                      <View style={{ alignItems: 'center', width: 42 }}>
                        <Text style={{ fontFamily: NumFont.bold, fontSize: 15, color: isNow ? C.indigo : P.ink, letterSpacing: -0.3 }}>
                          {fmtTime(e.start_time)}
                        </Text>
                        {isNow && (
                          <View style={{
                            marginTop: 2, paddingHorizontal: 5, paddingVertical: 1,
                            borderRadius: Radii.pill, backgroundColor: C.indigo,
                          }}>
                            <Text style={{ fontFamily: UIFont.bold, fontSize: 8, color: '#fff', letterSpacing: 0.6 }}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }} numberOfLines={1}>
                          {e.title}
                        </Text>
                        {e.location ? (
                          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }} numberOfLines={1}>
                            📍 {e.location}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.chip,
                        backgroundColor: `${C.indigo}14`, borderWidth: 1, borderColor: `${C.indigo}30`,
                      }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: C.indigo }}>
                          #{idx + 1}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── THE THREE — top tasks ── */}
        <View style={{ gap: 8 }}>
          <SectionEyebrow
            label="THE THREE"
            sub="Highest leverage right now"
            right={`${totalOpen} open`}
          />

          {topTasks.length === 0 ? (
            <View style={[{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline, padding: 20, alignItems: 'center',
            }, Shadows.card]}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>
                Nothing queued — add a task to begin.
              </Text>
            </View>
          ) : (
            topTasks.map((t, idx) => {
              const q = Quadrants[t.quadrant ?? 'neither'];
              return (
                <Pressable key={t.id} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}>
                  <View style={[{
                    backgroundColor: P.surface, borderRadius: Radii.md,
                    borderWidth: 1, borderColor: P.hairline,
                    padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                  }, Shadows.card]}>
                    {/* Rank */}
                    <View style={{
                      width: 24, height: 24, borderRadius: Radii.nav,
                      backgroundColor: idx === 0 ? P.accent : P.field,
                      alignItems: 'center', justifyContent: 'center', marginTop: 1,
                    }}>
                      <Text style={{ fontFamily: NumFont.bold, fontSize: 12, color: idx === 0 ? P.accentInk : P.ink3 }}>
                        {idx + 1}
                      </Text>
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink, lineHeight: 20 }}>
                        {t.title}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <View style={{
                          paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.chip,
                          borderWidth: 1, borderColor: `${q.color}40`, backgroundColor: `${q.color}14`,
                        }}>
                          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: q.color }}>
                            {q.label}
                          </Text>
                        </View>
                        {t.effort_minutes ? (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.chip, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline }}>
                            <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>{t.effort_minutes}m</Text>
                          </View>
                        ) : null}
                        {t.due_date ? (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.chip, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline }}>
                            <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>{t.due_date}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {/* Complete circle */}
                    <Pressable
                      onPress={() => void setStatus(t.id, 'done')}
                      hitSlop={8}
                      style={{
                        width: 22, height: 22, borderRadius: 11,
                        borderWidth: 1.5, borderColor: P.hairline,
                        backgroundColor: P.field, marginTop: 1,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── HABITS TODAY — compact chip row ── */}
        <View style={{ gap: 8 }}>
          <SectionEyebrow
            label="HABITS TODAY"
            sub="Tap to check in"
            right={`${habitsDone}/${habits.length}`}
          />

          {habits.length === 0 ? (
            <View style={[{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline, padding: 18, alignItems: 'center',
            }, Shadows.card]}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>
                No habits yet — create one from the Habits tab.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {habits.map(h => {
                const done = isCompletedToday(h.id);
                const emoji = h.name.match(/^\p{Emoji}/u)?.[0] ?? '🎯';
                const label = h.name.replace(/^\p{Emoji}\s*/u, '');
                return (
                  <Pressable key={h.id} onPress={() => void toggleHabit(h.id)}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radii.md,
                      backgroundColor: done ? P.positiveTint : P.surface,
                      borderWidth: 1,
                      borderColor: done ? P.positive : P.hairline,
                      ...Shadows.card,
                    }}>
                      <Text style={{ fontSize: 15 }}>{emoji}</Text>
                      <Text style={{
                        fontFamily: UIFont.semiBold, fontSize: 13,
                        color: done ? P.positive : P.ink,
                        textDecorationLine: done ? 'line-through' : 'none',
                      }} numberOfLines={1}>
                        {label}
                      </Text>
                      {done && (
                        <Text style={{ fontFamily: UIFont.bold, fontSize: 11, color: P.positive }}>✓</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Quick stats row — finance ── */}
        {(safeToSpend > 0 || spentToday > 0) && (
          <View style={{ gap: 8 }}>
            <SectionEyebrow label="MONEY TODAY" sub="EGP only" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={{ flex: 1 }} onPress={() => {}}>
                <View style={[{
                  backgroundColor: P.surface, borderRadius: Radii.md,
                  borderWidth: 1, borderColor: P.hairline,
                  padding: 14,
                }, Shadows.card]}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                    Safe to spend
                  </Text>
                  <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: C.green, marginTop: 4, letterSpacing: -0.5 }}>
                    {fmtCompact(safeToSpend)}
                  </Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 2 }}>EGP</Text>
                </View>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => {}}>
                <View style={[{
                  backgroundColor: P.surface, borderRadius: Radii.md,
                  borderWidth: 1, borderColor: P.hairline,
                  padding: 14,
                }, Shadows.card]}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                    Spent today
                  </Text>
                  <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: spentToday > 0 ? C.red : P.ink3, marginTop: 4, letterSpacing: -0.5 }}>
                    {spentToday > 0 ? fmtCompact(spentToday) : '—'}
                  </Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 2 }}>EGP</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Quick-access row ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('EnergyLog')}>
            <View style={[{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline,
              padding: 14, alignItems: 'center', gap: 6,
            }, Shadows.card]}>
              <Zap size={20} color={P.accent} strokeWidth={1.5} />
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink }}>Energy Log</Text>
            </View>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('WeeklyReview')}>
            <View style={[{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline,
              padding: 14, alignItems: 'center', gap: 6,
            }, Shadows.card]}>
              <Text style={{ fontSize: 20 }}>📋</Text>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink }}>Weekly Review</Text>
            </View>
          </Pressable>
        </View>

        {/* ── Ask The Professor ── */}
        <Pressable onPress={() => navigation.navigate('PlanningAssistant')}>
          <View style={[{
            backgroundColor: '#1F1A14', borderRadius: Radii.md,
            padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
          }, Shadows.card]}>
            <View style={{
              width: 42, height: 42, borderRadius: Radii.nav,
              backgroundColor: `${P.accent}22`,
              borderWidth: 1, borderColor: `${P.accent}40`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color={P.accent} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: '#FDF8E7' }}>Ask The Professor</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: 'rgba(253,248,231,0.5)', marginTop: 2 }}>
                AI executive coach · planning, focus, strategy
              </Text>
            </View>
            <ChevronRight size={16} color={P.accent} strokeWidth={2} />
          </View>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionEyebrow({ label, sub, right }: { label: string; sub?: string; right?: string }) {
  const P = useScreenPalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 }}>
      <View>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 1 }}>{sub}</Text>
        ) : null}
      </View>
      {right ? (
        <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{right}</Text>
      ) : null}
    </View>
  );
}
