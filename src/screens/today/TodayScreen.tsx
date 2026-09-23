import { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, Sparkles } from 'lucide-react-native';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { SB, C, Quadrants, Radii, Shadows, Spacing } from '../../theme/tokens';
import { UIFont, NumFont } from '../../theme/typography';
import { useScreenPalette } from '../../theme/palette';
import { useIsTablet } from '../../lib/layout';
import type { RootStackParamList } from '../../navigation/RootNavigator';

function greetingParts(): { salutation: string; label: string } {
  const h = new Date().getHours();
  if (h < 5)  return { salutation: 'LATE NIGHT,',    label: 'late' };
  if (h < 12) return { salutation: 'GOOD MORNING,',  label: 'morning' };
  if (h < 17) return { salutation: 'GOOD AFTERNOON,', label: 'afternoon' };
  if (h < 21) return { salutation: 'GOOD EVENING,',  label: 'evening' };
  return       { salutation: 'GOOD NIGHT,',           label: 'night' };
}

function dateLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).toUpperCase();
}

function timeLabel(): string {
  return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function TodayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();

  const tasks        = useTaskStore(s => s.tasks);
  const loadTasks    = useTaskStore(s => s.loadFromDB);
  const setStatus    = useTaskStore(s => s.setStatus);
  const tasksLoading = useTaskStore(s => s.loading);

  const habits           = useHabitStore(s => s.habits);
  const loadHabits       = useHabitStore(s => s.loadFromDB);
  const toggleHabit      = useHabitStore(s => s.toggleToday);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const emailActions = useEmailActionsStore(s => s.actions);
  const loadEmails   = useEmailActionsStore(s => s.loadFromDB);

  useEffect(() => {
    void loadTasks();
    void loadHabits();
    void loadEmails();
  }, [loadTasks, loadHabits, loadEmails]);

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
    const today = new Date().toISOString().slice(0, 10);
    const done = tasks.filter(t => t.completed_at?.slice(0, 10) === today).length;

    const habitsDoneCount = habits.filter(h => isCompletedToday(h.id)).length;
    const habitPct = habits.length > 0 ? Math.round((habitsDoneCount / habits.length) * 100) : 0;
    const taskPct = Math.min(Math.round(done * 20 + (1 - Math.min(open.length, 10) / 10) * 40), 100);
    const planPct = tasks.length > 0
      ? Math.round((tasks.filter(t => !!t.due_date).length / tasks.length) * 100)
      : 0;
    const score = Math.round((habitPct * 0.4 + taskPct * 0.4 + planPct * 0.2));

    return {
      topTasks: ranked.slice(0, 3),
      doneToday: done,
      totalOpen: open.length,
      weeklyScore: { total: score, habits: habitPct, tasks: taskPct, planning: planPct },
    };
  }, [tasks, habits, isCompletedToday]);

  const habitsDone = habits.filter(h => isCompletedToday(h.id)).length;
  const tablet = useIsTablet();
  const { salutation } = greetingParts();

  // User's first name from store would be ideal; fall back to a generic label
  const firstName = 'BAHAA';

  const briefLines = useMemo(() => {
    const lines: string[] = [];
    if (topTasks.length > 0) {
      lines.push(`${topTasks.length} priorit${topTasks.length === 1 ? 'y' : 'ies'} queued — lead with ${topTasks[0]?.title ?? 'your top task'}`);
    } else {
      lines.push('No urgent tasks queued — a clear morning');
    }
    lines.push(`${habitsDone} of ${habits.length || 0} habit${habits.length !== 1 ? 's' : ''} checked in`);
    lines.push(doneToday > 0
      ? `${doneToday} task${doneToday > 1 ? 's' : ''} shipped today — keep the thread`
      : `${totalOpen} open task${totalOpen !== 1 ? 's' : ''} across all quadrants`);
    return lines;
  }, [topTasks, habitsDone, habits.length, doneToday, totalOpen]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>

      {/* ── Top bar (logo + bell only) ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 14, color: P.accentInk }}>B</Text>
          </View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink4, letterSpacing: 1.4 }}>BPA</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline, alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={16} color={P.ink2} strokeWidth={2} />
          </View>
        </Pressable>
      </View>

      {/* ── Hero greeting ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>
          {dateLabel()} · EVERYTHING AT A GLANCE
        </Text>
        <Text style={{ fontFamily: NumFont.regular, fontSize: 15, color: P.ink3, marginTop: 6, letterSpacing: 0.2 }}>
          {salutation}
        </Text>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 34, color: P.ink, letterSpacing: -1, lineHeight: 40 }}>
          {firstName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
          maxWidth: tablet ? 1100 : undefined,
          alignSelf: tablet ? 'center' : undefined,
          width: tablet ? '100%' : undefined,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={tasksLoading}
            onRefresh={() => { void loadTasks(); void loadHabits(); }}
            tintColor={P.accent}
          />
        }
      >
        {/* ── Execution Integrity score card ── */}
        <View style={[{
          backgroundColor: P.surface,
          borderRadius: Radii.md,
          borderWidth: 1,
          borderColor: P.hairline,
          overflow: 'hidden',
        }, Shadows.card]}>
          {/* Accent stripe */}
          <View style={{ height: 3, backgroundColor: P.accent }} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <View>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1.6 }}>
                  THIS WEEK
                </Text>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2, marginTop: 2 }}>
                  Execution Integrity
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: NumFont.bold, fontSize: 28, color: P.ink, letterSpacing: -1 }}>
                  {weeklyScore.total}
                </Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3 }}>/ 100</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ height: 6, backgroundColor: P.hairline, borderRadius: Radii.pill, marginBottom: 12 }}>
              <View style={{ height: 6, width: `${weeklyScore.total}%`, backgroundColor: P.accent, borderRadius: Radii.pill }} />
            </View>

            {/* Sub-scores */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ScorePill label="Tasks" value={weeklyScore.tasks} accent={P.accent} />
              <ScorePill label="Habits" value={weeklyScore.habits} accent={P.accent} />
              <ScorePill label="Planning" value={weeklyScore.planning} accent={P.accent} />
            </View>
          </View>
        </View>

        {/* ── Morning Brief ── */}
        {!tasksLoading && (
          <View style={{
            backgroundColor: P.isDark ? P.surface : '#1F1A14',
            borderRadius: Radii.md,
            borderWidth: 1,
            borderColor: P.isDark ? P.hairline : 'rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}>
            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.accent, letterSpacing: 1.6 }}>
                  ✦ MORNING BRIEF
                </Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {`Written at ${timeLabel()} · ${dateLabel().split(' ').slice(0,3).join(' ')}`}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                {briefLines.map((line, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginTop: 0 }}>·</Text>
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: SB.inkOnDark, lineHeight: 20, flex: 1 }}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Inbox alert ── */}
        {pendingEmails > 0 && (
          <Pressable onPress={() => navigation.navigate('Inbox')}>
            <View style={{
              backgroundColor: P.accentTint,
              borderRadius: Radii.md,
              borderWidth: 1,
              borderColor: P.accentBorder,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.accentDeep }}>
                  {pendingEmails} item{pendingEmails === 1 ? '' : 's'} need{pendingEmails === 1 ? 's' : ''} a decision
                </Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, marginTop: 2 }}>
                  Inbox · triaged threads waiting for review
                </Text>
              </View>
              <ChevronRight size={16} color={P.accentDeep} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}

        {/* ── Tasks section ── */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <View>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>THE THREE</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>Highest leverage right now</Text>
            </View>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{totalOpen} open</Text>
          </View>

          {topTasks.length === 0 ? (
            <View style={[{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 20, alignItems: 'center' }, Shadows.card]}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>Nothing queued — add a task to begin.</Text>
            </View>
          ) : (
            topTasks.map((t, idx) => {
              const q = Quadrants[t.quadrant ?? 'neither'];
              return (
                <Pressable key={t.id} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}>
                  <View style={[{
                    backgroundColor: P.surface,
                    borderRadius: Radii.md,
                    borderWidth: 1,
                    borderColor: P.hairline,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                  }, Shadows.card]}>
                    {/* Rank number */}
                    <View style={{ width: 24, height: 24, borderRadius: Radii.nav, backgroundColor: idx === 0 ? P.accent : P.field, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <Text style={{ fontFamily: NumFont.bold, fontSize: 12, color: idx === 0 ? P.accentInk : P.ink3 }}>{idx + 1}</Text>
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink, lineHeight: 20 }}>{t.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.chip, borderWidth: 1, borderColor: `${q.color}40`, backgroundColor: `${q.color}14` }}>
                          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: q.color }}>{q.label}</Text>
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
                    <Pressable
                      onPress={() => void setStatus(t.id, 'done')}
                      hitSlop={8}
                      style={{
                        width: 22, height: 22, borderRadius: 11,
                        borderWidth: 1.5, borderColor: P.hairline,
                        backgroundColor: P.field,
                        marginTop: 1,
                      }}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Habits section ── */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <View>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>HABITS</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>Tap to mark complete</Text>
            </View>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{habitsDone}/{habits.length}</Text>
          </View>

          {habits.length === 0 ? (
            <View style={[{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 20, alignItems: 'center' }, Shadows.card]}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>No habits yet — create one from the Habits tab.</Text>
            </View>
          ) : (
            habits.slice(0, 5).map(h => {
              const done = isCompletedToday(h.id);
              return (
                <Pressable key={h.id} onPress={() => void toggleHabit(h.id)}>
                  <View style={[{
                    backgroundColor: P.surface,
                    borderRadius: Radii.md,
                    borderWidth: 1,
                    borderColor: done ? P.accentBorder : P.hairline,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }, Shadows.card]}>
                    {/* Checkbox */}
                    <View style={{
                      width: 22, height: 22, borderRadius: 6,
                      borderWidth: done ? 0 : 1.5,
                      borderColor: P.hairline,
                      backgroundColor: done ? P.positive : P.field,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done && <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: done ? P.ink3 : P.ink, textDecorationLine: done ? 'line-through' : 'none' }}>
                        {h.name}
                      </Text>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>
                        {h.frequency} · {h.current_streak} day streak
                      </Text>
                    </View>
                    {done && (
                      <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.chip, backgroundColor: P.positiveTint }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.positive }}>DONE</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Ask The Professor ── */}
        <Pressable onPress={() => navigation.navigate('PlanningAssistant')} style={{ marginTop: 4 }}>
          <View style={[{
            backgroundColor: P.surface,
            borderRadius: Radii.md,
            borderWidth: 1,
            borderColor: P.hairline,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }, Shadows.card]}>
            <View style={{
              width: 40, height: 40, borderRadius: Radii.nav,
              backgroundColor: P.accentTint,
              borderWidth: 1, borderColor: P.accentBorder,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color={P.accentDeep} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>Ask The Professor</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>
                AI executive coach · planning, focus, strategy
              </Text>
            </View>
            <ChevronRight size={16} color={P.ink3} strokeWidth={2} />
          </View>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

function ScorePill({ label, value, accent }: { label: string; value: number; accent: string }) {
  const P = useScreenPalette();
  return (
    <View style={{ flex: 1, backgroundColor: P.field, borderRadius: Radii.chip, padding: 8, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: NumFont.semiBold, fontSize: 16, color: P.ink, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontFamily: UIFont.regular, fontSize: 10, color: P.ink4, letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}
