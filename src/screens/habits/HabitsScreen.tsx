import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../../store/habitStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import type { DbHabitFrequency } from '../../types/database';

export function HabitsScreen() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar
        title="Habits"
        subtitle={`${doneCount} / ${habits.length || 0} today`}
        right={
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.indigo, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 18 }}>＋</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={C.indigo} />}
      >
        {habits.length === 0 && !loading ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.ink2 }}>No habits yet</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink3, textAlign: 'center' }}>
              Tap ＋ to add one. Daily, weekdays, or weekly.
            </Text>
          </View>
        ) : (
          habits.map(h => {
            const done = isCompletedToday(h.id);
            return (
              <Pressable
                key={h.id}
                onPress={() => void toggleToday(h.id)}
                onLongPress={() => {
                  Alert.alert('Archive habit', h.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive', style: 'destructive', onPress: () => void removeHabit(h.id) },
                  ]);
                }}
              >
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: C.card,
                  borderRadius: Radii.md,
                  borderWidth: 1, borderColor: C.hairline,
                  padding: 14,
                  ...Shadows.card,
                }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 8,
                    borderWidth: 2, borderColor: done ? C.green : C.hairline,
                    backgroundColor: done ? C.green : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done ? <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 16 }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{h.name}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: C.ink3, marginTop: 2 }}>
                      {h.frequency}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 16, color: C.red }}>{h.current_streak}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: C.ink3, letterSpacing: 0.5 }}>STREAK</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Add habit modal */}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <Pressable onPress={() => setAdding(false)} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: C.ink }}>New habit</Text>
            <TextInput
              placeholder="Habit name (e.g. Morning run)"
              placeholderTextColor={C.ink3}
              value={name}
              onChangeText={setName}
              autoFocus
              style={{
                borderWidth: 1, borderColor: C.hairline,
                borderRadius: Radii.sm,
                paddingHorizontal: 14, paddingVertical: 12,
                fontFamily: 'Inter_500Medium', fontSize: 15, color: C.ink,
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
                      borderColor: active ? C.indigo : C.hairline,
                      backgroundColor: active ? C.indigoSoft : C.card,
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: active ? C.indigo : C.ink2, textTransform: 'capitalize' }}>{f}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={save}
              disabled={!name.trim()}
              style={{
                backgroundColor: name.trim() ? C.indigo : C.hairline,
                paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center', marginTop: 4,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 }}>Save habit</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
