import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useHabitStore } from '../../store/habitStore';
import { Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { DbHabitFrequency } from '../../types/database';

const FREQS: { id: DbHabitFrequency; label: string; hint: string }[] = [
  { id: 'daily',    label: 'Daily',    hint: 'Every day of the week' },
  { id: 'weekdays', label: 'Weekdays', hint: 'Monday through Friday' },
  { id: 'weekly',   label: 'Weekly',   hint: 'Once per week, on your chosen day' },
];

export function HabitEditScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HabitEdit'>>();
  const P = useScreenPalette();

  const habits      = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const habit       = habits.find(h => h.id === route.params.habitId);

  const [name,    setName]    = useState(habit?.name ?? '');
  const [freq,    setFreq]    = useState<DbHabitFrequency>(habit?.frequency ?? 'daily');
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(false);

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

  async function handleSave() {
    if (!habit) return;
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase
        .from('habits')
        .update({ name: trimmed, frequency: freq })
        .eq('id', habit.id);
      if (error) throw error;
      // Refresh store
      await useHabitStore.getState().loadFromDB();
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!habit) return;
    Alert.alert(
      'Delete habit',
      `"${habit.name.replace(/^\p{Emoji}\s*/u, '')}" and all its logs will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeHabit(habit.id);
              navigation.goBack();
              navigation.goBack(); // pop detail + edit
            } catch {
              setDeleting(false);
              Alert.alert('Error', 'Could not delete habit.');
            }
          },
        },
      ],
    );
  }

  const emoji = habit.name.match(/^\p{Emoji}/u)?.[0] ?? '🎯';
  const displayName = habit.name.replace(/^\p{Emoji}\s*/u, '');

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
          Edit habit
        </Text>
        <Pressable onPress={() => void handleSave()} disabled={saving} hitSlop={8} style={{
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill,
          backgroundColor: P.accent,
          opacity: saving ? 0.6 : 1,
        }}>
          {saving
            ? <ActivityIndicator size="small" color={P.accentInk} />
            : <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.accentInk }}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>

        {/* Identity card (read-only emoji) */}
        <View style={{
          backgroundColor: '#1F1A14', borderRadius: Radii.md,
          padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
          ...Shadows.card,
        }}>
          <View style={{
            width: 52, height: 52, borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 28 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 16, color: '#FDF8E7' }}>{displayName}</Text>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: 'rgba(253,248,231,0.45)', marginTop: 2 }}>
              {habit.current_streak}d current streak · {habit.longest_streak}d best
            </Text>
          </View>
        </View>

        {/* Name */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Habit name (emoji prefix optional)"
            placeholderTextColor={P.ink3}
            style={{
              backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
              borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 12,
              fontFamily: UIFont.medium, fontSize: 16, color: P.ink,
            }}
          />
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 6 }}>
            Start with an emoji to give it an icon — e.g. 🏃 Morning run
          </Text>
        </View>

        {/* Frequency */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
            Frequency
          </Text>
          <View style={{
            backgroundColor: P.surface, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
          }}>
            {FREQS.map((f, i) => {
              const active = freq === f.id;
              return (
                <Pressable key={f.id} onPress={() => setFreq(f.id)}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: i < FREQS.length - 1 ? 1 : 0,
                    borderColor: P.hairline,
                    backgroundColor: active ? P.accentTint : P.surface,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{f.label}</Text>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>{f.hint}</Text>
                    </View>
                    {active && (
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: P.accentInk, fontSize: 11, fontFamily: UIFont.bold }}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Rules note */}
        <View style={{
          backgroundColor: P.field, borderRadius: Radii.md,
          borderWidth: 1, borderColor: P.hairline, padding: 14,
        }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2, lineHeight: 18 }}>
            ✦ Changing frequency does not reset your streak. Historical logs are kept regardless.
          </Text>
        </View>

        {/* Danger zone */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
            Danger zone
          </Text>
          <View style={{
            backgroundColor: P.surface, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
          }}>
            {/* Pause row (display only) */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderColor: P.hairline,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>Pause habit</Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>
                  Streak freezes, history is kept
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill,
                backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline,
              }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>Pause</Text>
              </View>
            </View>

            {/* Delete row */}
            <Pressable onPress={confirmDelete} disabled={deleting}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 14,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.negative }}>Delete habit</Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}>
                    Permanently removes this habit and all its logs
                  </Text>
                </View>
                {deleting
                  ? <ActivityIndicator size="small" color={P.negative} />
                  : (
                    <View style={{
                      paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill,
                      backgroundColor: P.negativeTint, borderWidth: 1, borderColor: `${P.negative}30`,
                    }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.negative }}>Delete</Text>
                    </View>
                  )}
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
