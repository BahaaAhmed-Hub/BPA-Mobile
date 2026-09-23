import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useHabitStore } from '../../store/habitStore';
import { Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function last13WeeksGrid(logs: { date: string; completed: boolean }[]): boolean[][] {
  const logSet = new Set(logs.filter(l => l.completed).map(l => l.date));
  const today = new Date();
  // Start from the Monday 13 weeks ago
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - (startDay.getDay() || 7) + 1 - 12 * 7);

  const grid: boolean[][] = [];
  for (let week = 0; week < 13; week++) {
    const row: boolean[] = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(startDay);
      d.setDate(d.getDate() + week * 7 + day);
      const iso = d.toISOString().slice(0, 10);
      row.push(logSet.has(iso));
    }
    grid.push(row);
  }
  return grid;
}

function pct30Day(logs: { date: string; completed: boolean }[]): number {
  const logSet = new Set(logs.filter(l => l.completed).map(l => l.date));
  const today = new Date();
  let done = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (logSet.has(d.toISOString().slice(0, 10))) done++;
  }
  return Math.round((done / 30) * 100);
}

export function HabitDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HabitDetail'>>();
  const P = useScreenPalette();

  const habits           = useHabitStore(s => s.habits);
  const logsByHabit      = useHabitStore(s => s.logsByHabit);
  const load             = useHabitStore(s => s.loadFromDB);
  const toggleToday      = useHabitStore(s => s.toggleToday);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  useEffect(() => { void load(); }, [load]);

  const habit = habits.find(h => h.id === route.params.habitId);
  const logs  = logsByHabit[route.params.habitId] ?? [];
  const done  = habit ? isCompletedToday(habit.id) : false;

  if (!habit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 20 }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 15, color: P.ink3 }}>Habit not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const grid = last13WeeksGrid(logs);
  const pct  = pct30Day(logs);
  const totalCompleted = logs.filter(l => l.completed).length;
  const emoji = habit.name.match(/^\p{Emoji}/u)?.[0] ?? '🎯';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      {/* Nav bar */}
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
        }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: NumFont.bold, fontSize: 15, color: P.ink }}>
          {habit.name.replace(/^\p{Emoji}\s*/u, '')}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('HabitEdit', { habitId: habit.id })}
          hitSlop={8}
          style={{
            width: 36, height: 36, borderRadius: 18,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
          }}
        >
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>✎</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}>
        {/* Hero card */}
        <View style={{
          backgroundColor: '#1F1A14', borderRadius: Radii.md,
          padding: 20, gap: 8, ...Shadows.card,
        }}>
          <Text style={{ fontSize: 40 }}>{emoji}</Text>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 26, color: '#FDF8E7', letterSpacing: -0.5 }}>
            {habit.name.replace(/^\p{Emoji}\s*/u, '')}
          </Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: 'rgba(253,248,231,0.55)', marginTop: 2 }}>
            {habit.frequency}
          </Text>

          {/* Mark done button */}
          <Pressable
            onPress={() => void toggleToday(habit.id)}
            style={({ pressed }) => ({
              marginTop: 8, paddingVertical: 12, borderRadius: Radii.md,
              backgroundColor: done ? P.positive : pressed ? P.accentDeep : P.accent,
              borderWidth: 1, borderColor: done ? P.positive : P.accentBorder,
              alignItems: 'center',
            })}
          >
            <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: done ? '#fff' : P.accentInk }}>
              {done ? '✓ Done today' : 'Mark as done'}
            </Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Streak', value: `${habit.current_streak}d` },
            { label: 'Best',   value: `${habit.longest_streak}d` },
            { label: 'Total',  value: `${totalCompleted}` },
            { label: '30-day', value: `${pct}%` },
          ].map(s => (
            <View key={s.label} style={{
              flex: 1, backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline,
              padding: 12, alignItems: 'center', gap: 4,
              ...Shadows.card,
            }}>
              <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
                {s.value}
              </Text>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 13-week grid */}
        <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 16, ...Shadows.card }}>
          <Text style={{
            fontFamily: UIFont.semiBold, fontSize: 11,
            color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12,
          }}>
            Last 13 weeks
          </Text>

          {/* Day labels */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: UIFont.medium, fontSize: 9, color: P.ink4 }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grid rows (each row = 1 week, 7 days) */}
          <View style={{ gap: 3 }}>
            {grid.map((week, wi) => (
              <View key={wi} style={{ flexDirection: 'row', gap: 3 }}>
                {week.map((isOn, di) => (
                  <View
                    key={di}
                    style={{
                      flex: 1, aspectRatio: 1, borderRadius: 3,
                      backgroundColor: isOn ? P.positive : P.field,
                      borderWidth: 1,
                      borderColor: isOn ? P.positive : P.hairline,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 10 }}>
            A part day shades in part.
          </Text>
        </View>

        {/* Streak note */}
        {habit.current_streak >= 3 && (
          <View style={{
            padding: 14, backgroundColor: P.accentTint, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.accentBorder,
          }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink, lineHeight: 18 }}>
              🔥 {habit.current_streak}-day streak — your longest is {habit.longest_streak}. Keep going.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
