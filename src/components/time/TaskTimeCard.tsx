import { useMemo, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { Play, Square, Plus } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useTaskSessionStore } from '../../store/taskSessionStore';
import { notify } from '../../store/feedbackStore';
import { clock, elapsedMs, span } from '../../lib/time/timer';
import { sittingsOf, taskTime } from '../../lib/time/summary';
import { isAssumed, runningOfTask } from '../../lib/time/taskSessions';
import { useNow } from '../../lib/time/useNow';
import { isOpenTask } from '../../lib/tasks';
import type { DbTask } from '../../types/database';

const ENDED: { id: string; label: string; ago: number }[] = [
  { id: 'now', label: 'Just now', ago: 0 },
  { id: '1h', label: '1 h ago', ago: 3_600_000 },
  { id: '3h', label: '3 h ago', ago: 3 * 3_600_000 },
  { id: 'yesterday', label: 'Yesterday', ago: 24 * 3_600_000 },
];

const dayTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Time on one task: a Start/Stop button, what has been logged, and a way to type in time that was never timed. A finished
 *  task cannot start a timer (it would add hours to nothing) but can still have time typed in. */
export function TaskTimeCard({ task }: { task: DbTask }) {
  const P = useScreenPalette();
  const sessions = useTaskSessionStore(s => s.sessions);
  const unavailable = useTaskSessionStore(s => s.unavailable);
  const start = useTaskSessionStore(s => s.startTimer);
  const stop = useTaskSessionStore(s => s.stopTimer);
  const addManual = useTaskSessionStore(s => s.addManual);
  const removeSession = useTaskSessionStore(s => s.removeSession);
  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [ended, setEnded] = useState('now');
  const [busy, setBusy] = useState(false);

  const running = useMemo(() => runningOfTask(sessions, task.id), [sessions, task.id]);
  const now = useNow(!!running);
  const t = useMemo(() => taskTime(sessions, task.id), [sessions, task.id]);
  const recent = useMemo(() => sittingsOf(sessions, task.id, 5).filter(s => s.end !== null), [sessions, task.id]);
  const open = isOpenTask(task);

  if (unavailable) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (running) {
        const r = await stop(running.id);
        if (r && !r.kept) notify('info', 'That ran under 30 seconds, so it was not logged.');
      } else await start(task.id);
    } finally { setBusy(false); }
  }

  async function addTime() {
    const m = Math.round(Number(minutes.replace(/,/g, '').trim()));
    if (!isFinite(m) || m < 1 || m > 24 * 60) { notify('error', 'Enter the minutes, from 1 to 1,440.'); return; }
    const end = Date.now() - (ENDED.find(e => e.id === ended)?.ago ?? 0);
    if (await addManual({ taskId: task.id, start: end - m * 60_000, end })) { setMinutes(''); setAdding(false); setEnded('now'); }
  }

  function confirmRemove(id: string, label: string) {
    Alert.alert('Remove this sitting?', label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void removeSession(id); } },
    ]);
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
            {t.sittings ? span(t.totalMs) : 'None logged yet'}
          </Text>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>
            {t.sittings ? `in ${t.sittings} ${t.sittings === 1 ? 'sitting' : 'sittings'}${t.assumedMs > 0 ? ` · ${span(t.assumedMs)} of it assumed` : ''}` : 'Start a timer, or add time you spent'}
          </Text>
        </View>
        <Pressable accessibilityLabel={running ? 'Stop the timer' : 'Start a timer on this task'} onPress={() => void toggle()} disabled={!running && !open}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: Radii.pill, backgroundColor: running ? P.ink : P.accent, opacity: !running && !open ? 0.5 : 1 }}>
          {running ? <Square size={13} color={P.bg} fill={P.bg} /> : <Play size={13} color={P.accentInk} fill={P.accentInk} />}
          <Text style={{ fontFamily: NumFont.bold, fontSize: 14, color: running ? P.bg : P.accentInk, fontVariant: ['tabular-nums'] }}>
            {running ? clock(elapsedMs(running, now)) : 'Start'}
          </Text>
        </Pressable>
      </View>
      {!open && !running ? <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>This task is finished. You can still add time you spent on it.</Text> : null}

      {recent.map(s => {
        const label = `${dayTime.format(new Date(s.start))} · ${span((s.end as number) - s.start)}${isAssumed(s) ? ' · assumed' : ''}${s.review ? ' · check this' : ''}`;
        return (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: UIFont.regular, fontSize: 13, color: s.review ? P.negative : P.ink2 }}>{label}</Text>
            <Pressable accessibilityLabel={`Remove the sitting ${label}`} onPress={() => confirmRemove(s.id, label)}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>Remove</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable accessibilityLabel="Add time" onPress={() => setAdding(a => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 }}>
        <Plus size={14} color={P.accentDeep} />
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.accentDeep }}>Add time</Text>
      </Pressable>

      {adding ? (
        <View style={{ gap: 10, padding: 12, borderRadius: Radii.md, backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline }}>
          <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="Minutes spent" placeholderTextColor={P.ink3} accessibilityLabel="Minutes spent"
            style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: NumFont.bold, fontSize: 16, color: P.ink }} />
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.3 }}>IT ENDED</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ENDED.map(e => (
              <Pressable key={e.id} accessibilityLabel={`It ended ${e.label}`} onPress={() => setEnded(e.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: ended === e.id ? P.accent : P.surface, borderWidth: 1, borderColor: ended === e.id ? P.accent : P.hairline }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: ended === e.id ? P.accentInk : P.ink }}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityLabel="Save the time" onPress={() => void addTime()}
            style={{ minHeight: 44, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.accentInk }}>Save</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
