import { useMemo, useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { Play, Square } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useTaskSessionStore } from '../../store/taskSessionStore';
import { useTaskStore } from '../../store/taskStore';
import { clock, elapsedMs, FORGOTTEN_AFTER_MS, runningTimers, span } from '../../lib/time/timer';
import { todayNumbers } from '../../lib/time/summary';
import { useNow } from '../../lib/time/useNow';
import { isOpenTask, hasTitle } from '../../lib/tasks';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Every running timer, today's two numbers, and a way to start another by typing a few letters of a task. */
export function TimerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const P = useScreenPalette();
  const sessions = useTaskSessionStore(s => s.sessions);
  const startTimer = useTaskSessionStore(s => s.startTimer);
  const stopTimer = useTaskSessionStore(s => s.stopTimer);
  const tasks = useTaskStore(s => s.tasks);
  const [q, setQ] = useState('');

  const running = useMemo(() => runningTimers(sessions), [sessions]);
  const now = useNow(visible && running.length > 0);
  const numbers = useMemo(() => todayNumbers(sessions, tz(), now), [sessions, now]);
  const titleOf = (id: string) => tasks.find(t => t.id === id)?.title.trim() || 'A task';

  const offered = useMemo(() => {
    const timed = new Set(running.map(r => r.taskId));
    const needle = q.trim().toLowerCase();
    return tasks
      .filter(t => isOpenTask(t) && hasTitle(t) && !timed.has(t.id) && (!needle || t.title.toLowerCase().includes(needle)))
      .slice(0, 6);
  }, [tasks, running, q]);

  async function stopAll() { for (const r of running) await stopTimer(r.id); }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close timers" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '82%' }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>Timing</Text>
              {running.length > 1 ? (
                <Pressable accessibilityLabel="Stop all timers" onPress={() => void stopAll()}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.negative }}>Stop all</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Today, in the web's two numbers: the clock, and every task added up. Both come from the same sittings. */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Figure label="WORKED TODAY" value={span2(numbers.worked)} P={P} />
              {numbers.gain > 0 ? <Figure label="TASK-HOURS" value={span2(numbers.taskHours)} note="doing things together" P={P} /> : null}
            </View>

            {running.length > 0 ? (
              <View style={{ gap: 8 }}>
                {running.map(r => {
                  const ms = elapsedMs(r, now);
                  const forgotten = ms > FORGOTTEN_AFTER_MS;
                  return (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radii.md, backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline }}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{titleOf(r.taskId)}</Text>
                        {forgotten ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.negative }}>Probably forgotten: stop it and check the time.</Text> : null}
                      </View>
                      <Text style={{ fontFamily: NumFont.bold, fontSize: 16, color: P.ink, fontVariant: ['tabular-nums'] }}>{clock(ms)}</Text>
                      <Pressable accessibilityLabel={`Stop timing ${titleOf(r.taskId)}`} onPress={() => void stopTimer(r.id)}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <Square size={14} color={P.bg} fill={P.bg} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>Nothing is being timed.</Text>
            )}

            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4 }}>START A TIMER</Text>
              <TextInput value={q} onChangeText={setQ} placeholder="Type a few letters of a task" placeholderTextColor={P.ink3} accessibilityLabel="Find a task to time"
                style={{ backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: UIFont.regular, fontSize: 15, color: P.ink }} />
              {offered.map(t => (
                <Pressable key={t.id} accessibilityLabel={`Start timing ${t.title}`} onPress={() => { void startTimer(t.id).then(ok => { if (ok) setQ(''); }); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={13} color={P.accentInk} fill={P.accentInk} />
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 14, color: P.ink }}>{t.title}</Text>
                </Pressable>
              ))}
              {offered.length === 0 ? <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>No open task matches.</Text> : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "2 h 5 min", or "0 min" for nothing (span() never says less than a minute). */
const span2 = (ms: number): string => (ms < 30_000 ? '0 min' : span(ms));

function Figure({ label, value, note, P }: { label: string; value: string; note?: string; P: ReturnType<typeof useScreenPalette> }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: Radii.md, backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline }}>
      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1.3 }}>{label}</Text>
      <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, marginTop: 2 }}>{value}</Text>
      {note ? <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 1 }}>{note}</Text> : null}
    </View>
  );
}
