import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useCalendarStore } from '../../store/calendarStore';
import { isActionable } from '../../lib/tasks';
import { scheduleView } from '../../lib/settingsView';
import { freeGaps, suggest, hhmmToMinutes, clock, spanOn, type PlanTask } from '../../lib/dayPlan';
import type { DbTask } from '../../types/database';

/** Today laid out for planning: meetings, the free time between them, and what would fit. Read-only — a suggestion
 *  books nothing. Placing a task on the calendar writes a real event, which the web does with its per-company rules. */
export function PlanView({ tasks, onOpen }: { tasks: DbTask[]; onOpen: (id: string) => void }) {
  const P = useScreenPalette();
  const events = useCalendarStore(s => s.events);
  const loadRange = useCalendarStore(s => s.loadRange);
  const today = new Date().toLocaleDateString('en-CA');
  const [hours, setHours] = useState<{ start: number | null; end: number | null } | 'loading'>('loading');

  useEffect(() => {
    void loadRange(today, today);
    let live = true;
    void supabase.from('users').select('schedule_rules').maybeSingle().then(({ data }) => {
      if (!live) return;
      const s = scheduleView((data as { schedule_rules?: unknown } | null)?.schedule_rules);
      setHours({ start: hhmmToMinutes(s.earliestMeeting), end: hhmmToMinutes(s.endOfDay) });
    });
    return () => { live = false; };
  }, [loadRange, today]);

  const todays = useMemo(() => events
    .map(e => ({ e, span: spanOn(e, today) }))
    .filter((x): x is { e: typeof x.e; span: { start: number; end: number } } => !!x.span)
    .sort((a, b) => a.span.start - b.span.start), [events, today]);

  // What is pressing: due today or earlier, or in the urgent-and-important quadrant.
  const pressing = useMemo(() => tasks.filter(t => isActionable(t) && ((t.due_date && t.due_date <= today) || t.quadrant === 'urgent_important')), [tasks, today]);
  const planTasks: PlanTask[] = pressing.map(t => ({ id: t.id, title: t.title, effort_minutes: t.effort_minutes, quadrant: t.quadrant, due_date: t.due_date }));

  const ready = hours !== 'loading' && hours.start !== null && hours.end !== null && hours.end > hours.start;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const gaps = useMemo(() => ready ? freeGaps(events, today, (hours as { start: number }).start, (hours as { end: number }).end, nowMin) : [], [ready, hours, events, today, nowMin]);
  // Without working hours there is no free time to fit anything into, so nothing is said to "not fit".
  const plan = useMemo(() => ready ? suggest(planTasks, gaps) : { placed: [], unplaced: [], unestimated: planTasks }, [ready, planTasks, gaps]);   // eslint-disable-line react-hooks/exhaustive-deps

  const label = (s: string) => <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, marginTop: 8 }}>{s}</Text>;
  const card = { backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' as const };
  const titleOf = (id: string) => pressing.find(t => t.id === id)?.title ?? '';

  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingVertical: 8 }}>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: P.ink, letterSpacing: -0.3 }}>Plan today</Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · suggestions only, nothing is booked
        </Text>
      </View>

      {label('MEETINGS')}
      {todays.length === 0 ? (
        <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>No meetings today.</Text>
      ) : (
        <View style={card}>
          {todays.map(({ e, span }, i) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: 12, padding: 12, borderBottomWidth: i < todays.length - 1 ? 1 : 0, borderColor: P.hairline }}>
              <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.ink3, width: 92 }}>{clock(span.start)}–{clock(span.end)}</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{e.title}</Text>
            </View>
          ))}
        </View>
      )}

      {hours !== 'loading' && !ready ? (
        <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 18, color: P.ink3 }}>
          Your working hours are not set, so free time cannot be worked out. Set them on the web under Settings.
        </Text>
      ) : null}

      {ready ? (
        <>
          {label(`FREE TIME · ${clock((hours as { start: number }).start)}–${clock((hours as { end: number }).end)}`)}
          {gaps.length === 0 ? (
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>No free time left in your working day.</Text>
          ) : (
            <View style={card}>
              {gaps.map((g, i) => {
                const here = plan.placed.filter(p => p.start >= g.start && p.end <= g.end);
                return (
                  <View key={g.start} style={{ padding: 12, gap: 6, borderBottomWidth: i < gaps.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                    <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.ink3 }}>{clock(g.start)}–{clock(g.end)} · {g.minutes} min free</Text>
                    {here.map(p => (
                      <Pressable key={p.task.id} accessibilityLabel={`Open ${titleOf(p.task.id)}`} onPress={() => onOpen(p.task.id)}
                        style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.accentDeep, width: 92 }}>{clock(p.start)}–{clock(p.end)}</Text>
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{p.task.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {plan.unplaced.length > 0 ? (
        <>
          {label('DOES NOT FIT TODAY')}
          <View style={card}>
            {plan.unplaced.map((t, i) => (
              <Pressable key={t.id} accessibilityLabel={`Open ${t.title}`} onPress={() => onOpen(t.id)}
                style={{ flexDirection: 'row', gap: 12, padding: 12, borderBottomWidth: i < plan.unplaced.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{t.title}</Text>
                <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{t.effort_minutes} min</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {plan.unestimated.length > 0 ? (
        <>
          {label(ready ? 'NEEDS A TIME ESTIMATE' : 'DUE OR URGENT TODAY')}
          <View style={card}>
            {plan.unestimated.map((t, i) => (
              <Pressable key={t.id} accessibilityLabel={`Open ${t.title}`} onPress={() => onOpen(t.id)}
                style={{ padding: 12, borderBottomWidth: i < plan.unestimated.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                <Text numberOfLines={1} style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{t.title}</Text>
              </Pressable>
            ))}
          </View>
          {ready ? <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>These are due or urgent, but with no length they cannot be fitted without guessing.</Text> : null}
        </>
      ) : null}

      {pressing.length === 0 ? (
        <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>Nothing is due today or marked urgent and important.</Text>
      ) : null}
    </View>
  );
}
