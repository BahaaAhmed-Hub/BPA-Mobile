import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, TriangleAlert } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useWeekPlanStore, visibleProposals } from '../../store/weekPlanStore';
import { dayWords } from '../../lib/weekplan/weekPlanData';
import { blockWarnings } from '../../lib/weekplan/weekPlanMove';
import { WHY_TEXT, type SkipWhy } from '../../lib/weekplan/weekPlanItems';
import type { Proposal } from '../../lib/weekplan/weekPlan';

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dur = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`);

/** Plan week, on the phone: a week of blocks, proposed with a reason on every one, and never written until a person adds it. */
export function PlanWeekScreen() {
  const P = useScreenPalette();
  const navigation = useNavigation();
  const { which, plan, say, loading, dropped, forced, rows, busyAll } = useWeekPlanStore();
  const add = useWeekPlanStore(s => s.add);
  const undo = useWeekPlanStore(s => s.undo);
  const addAll = useWeekPlanStore(s => s.addAll);
  const setWhich = useWeekPlanStore(s => s.setWhich);
  const load = useWeekPlanStore(s => s.load);
  const drop = useWeekPlanStore(s => s.drop);
  const planAnyway = useWeekPlanStore(s => s.planAnyway);
  const clear = useWeekPlanStore(s => s.clear);
  const [showLeftOut, setShowLeftOut] = useState(false);

  useEffect(() => { void load(); return () => clear(); }, [load, clear]);

  const proposals = useMemo(() => visibleProposals(plan, dropped, rows), [plan, dropped, rows]);
  const waiting = proposals.filter(p => !rows[p.id] || rows[p.id].state === 'failed');
  const byDay = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    for (const p of proposals) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [proposals]);
  const planned = proposals.reduce((n, p) => n + p.mins, 0);
  const leftOut = plan ? (Object.keys(WHY_TEXT) as SkipWhy[]).map(why => ({ why, items: plan.skipped.filter(s => s.why === why) })).filter(g => g.items.length) : [];
  const leftOutCount = leftOut.reduce((n, g) => n + g.items.length, 0);

  const card = { backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' as const };
  const label = (t: string) => <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, marginTop: 6 }}>{t}</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} hitSlop={8}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
          <ChevronLeft size={20} color={P.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: NumFont.bold, fontSize: 15, color: P.ink }}>Plan week</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {(['this', 'next'] as const).map(w => (
          <Pressable key={w} accessibilityLabel={`${w === 'this' ? 'This' : 'Next'} week`} accessibilityState={{ selected: which === w }} onPress={() => setWhich(w)}
            style={{ flex: 1, minHeight: 40, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: which === w ? P.ink : P.surface, borderWidth: 1, borderColor: which === w ? P.ink : P.hairline }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: which === w ? P.bg : P.ink2 }}>{w === 'this' ? 'This week' : 'Next week'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={P.ink3} />
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>Reading your calendars and tasks…</Text>
          </View>
        ) : null}

        {!loading && say ? (
          <View style={{ ...card, padding: 16, gap: 10 }}>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 14, lineHeight: 20, color: P.ink }}>{say}</Text>
            <Pressable accessibilityLabel="Try again" onPress={() => void load()} style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 16, borderRadius: Radii.pill, justifyContent: 'center', backgroundColor: P.accent }}>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.accentInk }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && plan?.problem ? (
          <View style={{ ...card, padding: 16, gap: 10 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>No plan this time</Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 14, lineHeight: 20, color: P.ink2 }}>{plan.problem}</Text>
            <Pressable accessibilityLabel="Try again" onPress={() => void load()} style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 16, borderRadius: Radii.pill, justifyContent: 'center', backgroundColor: P.accent }}>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.accentInk }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && plan && !plan.problem ? (
          <>
            <View style={{ paddingVertical: 4 }}>
              <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink }}>
                {proposals.length ? `${proposals.length} block${proposals.length === 1 ? '' : 's'} · ${dur(planned)}` : 'Nothing to plan'}
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 3 }}>
                Week of {dayWords(plan.weekOf)}, in {plan.tz}. Nothing is on your calendar yet.
              </Text>
            </View>

            {plan.notes.length ? (
              <View style={{ ...card, padding: 14, gap: 6, backgroundColor: P.accentTint, borderColor: P.accentBorder }}>
                {plan.notes.map((n, i) => <Text key={i} style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 18, color: P.ink }}>{n}</Text>)}
              </View>
            ) : null}

            {byDay.map(([date, list]) => (
              <View key={date} style={{ gap: 6 }}>
                {label(dayWords(date).toUpperCase())}
                <View style={card}>
                  {list.map((p, i) => (
                    <View key={p.id} style={{ padding: 14, gap: 4, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.accentDeep, width: 92 }}>{hhmm(p.startMin)}–{hhmm(p.startMin + p.mins)}</Text>
                        <Text style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{p.title}{p.of > 1 ? ` (${p.part}/${p.of})` : ''}</Text>
                      </View>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, lineHeight: 17, color: P.ink3, marginLeft: 104 }}>{p.reason}</Text>
                      {/* Every rule the block, where it sits, runs against: derived each time, amber and never red. Adding is never blocked by one. */}
                      {blockWarnings(plan, p, proposals).map((w, wi) => (
                        <View key={wi} style={{ flexDirection: 'row', gap: 6, marginLeft: 104, alignItems: 'flex-start' }}>
                          <TriangleAlert size={13} color={P.accentDeep} style={{ marginTop: 2 }} />
                          <Text style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 12, lineHeight: 17, color: P.accentDeep }}>{w}</Text>
                        </View>
                      ))}
                      {(() => {
                        const row = rows[p.id];
                        const state = row?.state;
                        if (state === 'added' || state === 'removing') {
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 104, minHeight: 36 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Check size={14} color={P.positive} />
                                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.positive }}>On your calendar</Text>
                              </View>
                              <Pressable accessibilityLabel={`Undo adding ${p.title}`} disabled={state === 'removing'} onPress={() => void undo(p.id)} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
                                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>{state === 'removing' ? 'Removing…' : 'Undo'}</Text>
                              </Pressable>
                            </View>
                          );
                        }
                        return (
                          <View style={{ marginLeft: 104, gap: 4 }}>
                            {row?.error ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, lineHeight: 17, color: P.negative }}>{row.error}</Text> : null}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                              <Pressable accessibilityLabel={`Add ${p.title} to your calendar`} disabled={state === 'adding'} onPress={() => void add(p.id)}
                                style={{ minHeight: 40, paddingHorizontal: 18, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent, opacity: state === 'adding' ? 0.6 : 1 }}>
                                <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.accentInk }}>{state === 'adding' ? 'Adding…' : state === 'failed' ? 'Try again' : 'Add'}</Text>
                              </Pressable>
                              <Pressable accessibilityLabel={`Leave out ${p.title}`} disabled={state === 'adding'} onPress={() => drop(p.id)} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
                                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink3 }}>Leave out</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })()}
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {plan.result.unplaced.length ? (
              <View style={{ gap: 6 }}>
                {label('DID NOT FIT')}
                <View style={card}>
                  {plan.result.unplaced.map((u, i) => (
                    <View key={u.itemKey} style={{ padding: 14, gap: 3, borderBottomWidth: i < plan.result.unplaced.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{u.title}{u.placed > 0 ? ` (${dur(u.left)} left)` : ''}</Text>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, lineHeight: 17, color: P.ink3 }}>{u.because}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {leftOutCount ? (
              <View style={{ gap: 6 }}>
                <Pressable accessibilityLabel={`Not in this plan, ${leftOutCount}`} accessibilityState={{ expanded: showLeftOut }} onPress={() => setShowLeftOut(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6 }}>NOT IN THIS PLAN ({leftOutCount})</Text>
                  <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>{showLeftOut ? 'Hide' : 'Show'}</Text>
                </Pressable>
                {showLeftOut ? leftOut.map(g => (
                  <View key={g.why} style={{ ...card, padding: 14, gap: 8 }}>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2 }}>{g.items.length} {WHY_TEXT[g.why]}</Text>
                    {g.items.map(s => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text numberOfLines={2} style={{ flex: 1, fontFamily: UIFont.regular, fontSize: 14, color: P.ink }}>{s.title}</Text>
                        {/* Not for one that already has a block (it would be on the calendar twice), and not once asked for. */}
                        {g.why !== 'has-block' && !forced.includes(s.id) ? (
                          <Pressable accessibilityLabel={`Plan ${s.title} anyway`} onPress={() => planAnyway(s.id)} hitSlop={8} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: Radii.pill, justifyContent: 'center', borderWidth: 1, borderColor: P.hairline }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>Plan anyway</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {waiting.length > 0 && !loading && plan && !plan.problem ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
          <Pressable accessibilityLabel={`Add all ${waiting.length} blocks to your calendar`} disabled={busyAll}
            onPress={() => Alert.alert(`Add ${waiting.length} block${waiting.length === 1 ? '' : 's'} to your calendar?`, 'They are real events on your own calendars. Nobody is invited. You can undo each one.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Add all', onPress: () => void addAll() },
            ])}
            style={{ minHeight: 52, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: P.ink, opacity: busyAll ? 0.6 : 1 }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.bg }}>{busyAll ? 'Adding…' : `Add all (${waiting.length})`}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
