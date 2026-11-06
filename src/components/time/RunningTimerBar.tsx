import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { Square } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Shadows } from '../../theme/tokens';
import { useTaskSessionStore } from '../../store/taskSessionStore';
import { useTaskStore } from '../../store/taskStore';
import { clock, elapsedMs, runningTimers } from '../../lib/time/timer';
import { useNow } from '../../lib/time/useNow';
import { TimerSheet } from './TimerSheet';

export const TIMER_BAR_H = 52;

/** How tall the bar is right now (0 when nothing runs), so what floats near it can move out of its way. */
export function useTimerBarHeight(): number {
  return useTaskSessionStore(s => (s.sessions.some(x => x.end === null && x.source === 'timer') ? TIMER_BAR_H + 8 : 0));
}

/** A slim bar above the tab bar while any timer runs, like a now-playing bar: the task, a live clock, Stop. Tapping it
 *  opens every timer, today's two numbers and a way to start another. Mounted once, by the tab navigator. */
export function RunningTimerBar({ bottom, left = 12, right = 12 }: { bottom: number; left?: number; right?: number }) {
  const P = useScreenPalette();
  const sessions = useTaskSessionStore(s => s.sessions);
  const loadFromDB = useTaskSessionStore(s => s.loadFromDB);
  const stopTimer = useTaskSessionStore(s => s.stopTimer);
  const tasks = useTaskStore(s => s.tasks);
  const [open, setOpen] = useState(false);

  // The first read of the day's sittings, so a timer started on another device is here when the app opens.
  useEffect(() => { void loadFromDB(); }, [loadFromDB]);

  const running = useMemo(() => runningTimers(sessions), [sessions]);
  const now = useNow(running.length > 0);

  // A quiet pulse so a running timer reads as alive without being loud.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!running.length) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [running.length, pulse]);

  const first = running[0];
  if (!first) return <TimerSheet visible={open} onClose={() => setOpen(false)} />;
  const title = tasks.find(t => t.id === first.taskId)?.title.trim() || 'A task';
  const more = running.length - 1;

  return (
    <>
      <View pointerEvents="box-none" style={{ position: 'absolute', left, right, bottom }}>
        <Pressable accessibilityLabel={`Timing ${title}${more ? ` and ${more} more` : ''}. Open timers`} onPress={() => setOpen(true)}
          style={{
            height: TIMER_BAR_H, borderRadius: 18, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: P.ink, ...Shadows.pop,
          }}>
          <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: P.accent, opacity: pulse }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.bg }}>{title}</Text>
            {more > 0 ? <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.bg, opacity: 0.7 }}>and {more} more</Text> : null}
          </View>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 16, color: P.bg, fontVariant: ['tabular-nums'] }}>{clock(elapsedMs(first, now))}</Text>
          <Pressable accessibilityLabel={`Stop timing ${title}`} onPress={() => void stopTimer(first.id)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Square size={14} color={P.accentInk} fill={P.accentInk} />
          </Pressable>
        </Pressable>
      </View>
      <TimerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
