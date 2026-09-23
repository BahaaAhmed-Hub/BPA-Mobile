import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../../store/habitStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { TopBar } from '../../components/atoms/TopBar';
import { SwipeRow } from '../../components/atoms/SwipeRow';
import type { DbHabitFrequency } from '../../types/database';

export function HabitsScreen() {
  const P = useScreenPalette();

  const habits          = useHabitStore(s => s.habits);
  const load            = useHabitStore(s => s.loadFromDB);
  const loading         = useHabitStore(s => s.loading);
  const toggleToday     = useHabitStore(s => s.toggleToday);
  const addHabit        = useHabitStore(s => s.addHabit);
  const removeHabit     = useHabitStore(s => s.removeHabit);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<DbHabitFrequency>('daily');

  useEffect(() => { void load(); }, [load]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addHabit(trimmed, freq);
    setName('');
    setFreq('daily');
    setAdding(false);
  }

  const doneCount = habits.filter(h => isCompletedToday(h.id)).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar
        title="Habits"
        subtitle={`${doneCount} / ${habits.length || 0} today`}
        right={
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 18, lineHeight: 18 }}>＋</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
      >
        {habits.length === 0 && !loading ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink2 }}>No habits yet</Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, textAlign: 'center' }}>
              Tap ＋ to add one. Daily, weekdays, or weekly.
            </Text>
          </View>
        ) : (
          habits.map(h => {
            const done = isCompletedToday(h.id);
            return (
              <SwipeRow
                key={h.id}
                leftAction={{
                  label: done ? 'UNDO' : 'DONE',
                  color: done ? C.slate : C.green,
                  onAction: () => void toggleToday(h.id),
                }}
                rightAction={{
                  label: 'ARCHIVE',
                  color: C.red,
                  onAction: () => {
                    Alert.alert('Archive habit', h.name, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Archive', style: 'destructive', onPress: () => void removeHabit(h.id) },
                    ]);
                  },
                }}
              >
                <Pressable onPress={() => void toggleToday(h.id)}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: P.surface,
                    borderRadius: Radii.md,
                    borderWidth: 1, borderColor: P.hairline,
                    padding: 14,
                    ...Shadows.card,
                  }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 8,
                      borderWidth: 2, borderColor: done ? C.green : P.hairline,
                      backgroundColor: done ? C.green : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done ? <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 16, lineHeight: 16 }}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>{h.name}</Text>
                      <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 2 }}>
                        {h.frequency}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: NumFont.medium, fontSize: 16, color: C.red }}>{h.current_streak}</Text>
                      <Text style={{ fontFamily: UIFont.medium, fontSize: 10, color: P.ink3, letterSpacing: 0.5 }}>STREAK</Text>
                    </View>
                  </View>
                </Pressable>
              </SwipeRow>
            );
          })
        )}
      </ScrollView>

      {/* Add habit modal */}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <Pressable onPress={() => setAdding(false)} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>New habit</Text>
            <TextInput
              placeholder="Habit name (e.g. Morning run)"
              placeholderTextColor={P.ink3}
              value={name}
              onChangeText={setName}
              autoFocus
              style={{
                borderWidth: 1, borderColor: P.hairline,
                borderRadius: Radii.sm,
                paddingHorizontal: 14, paddingVertical: 12,
                fontFamily: UIFont.medium, fontSize: 15, color: P.ink,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['daily','weekdays','weekly'] as DbHabitFrequency[]).map(f => {
                const active = freq === f;
                return (
                  <Pressable key={f} onPress={() => setFreq(f)} style={{ flex: 1 }}>
                    <View style={{
                      paddingVertical: 10,
                      borderRadius: Radii.sm,
                      borderWidth: 1,
                      borderColor: active ? P.accent : P.hairline,
                      backgroundColor: active ? `${P.accent}20` : P.surface,
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.accent : P.ink2, textTransform: 'capitalize' }}>{f}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={save}
              disabled={!name.trim()}
              style={{
                backgroundColor: name.trim() ? P.accent : P.hairline,
                paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center', marginTop: 4,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>Save habit</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
