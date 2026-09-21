import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { supabase } from '../../lib/supabase';
import type { DbEnergyLog } from '../../types/database';

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function DotRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const P = useScreenPalette();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: n <= value ? P.accent : 'transparent',
            borderWidth: 2,
            borderColor: n <= value ? P.accent : P.hairline,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {n <= value ? (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', opacity: 0.9 }} />
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function MiniDotRating({ value }: { value: number | null }) {
  const P = useScreenPalette();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <View key={n} style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: value != null && n <= value ? P.accent : P.hairline,
        }} />
      ))}
    </View>
  );
}

export function EnergyLogScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();

  const today = todayIso();

  const [morningLevel, setMorningLevel] = useState(0);
  const [afternoonLevel, setAfternoonLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<DbEnergyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('energy_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(14);

      if (error) throw error;
      if (data) {
        setHistory(data as DbEnergyLog[]);
        // Pre-fill if today already logged
        const todayLog = data.find((r: DbEnergyLog) => r.date === today);
        if (todayLog) {
          setMorningLevel(todayLog.morning_level ?? 0);
          setAfternoonLevel(todayLog.afternoon_level ?? 0);
          setNotes(todayLog.notes ?? '');
        }
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not signed in'); return; }

      const payload = {
        user_id: user.id,
        date: today,
        morning_level: morningLevel > 0 ? morningLevel : null,
        afternoon_level: afternoonLevel > 0 ? afternoonLevel : null,
        notes: notes.trim() || null,
      };

      const { error } = await supabase
        .from('energy_logs')
        .upsert(payload, { onConflict: 'user_id,date' });

      if (error) throw error;
      Alert.alert('Saved', 'Energy log saved.');
      await loadHistory();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={{ fontSize: 22, color: P.ink, fontFamily: 'Inter_700Bold' }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: P.ink, letterSpacing: -0.3, flex: 1 }}>
          Energy Log
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}>

          {/* Today's card */}
          <View style={{
            backgroundColor: P.surface,
            borderRadius: Radii.md,
            padding: 16,
            borderWidth: 1,
            borderColor: P.hairline,
            gap: 16,
            ...Shadows.card,
          }}>
            <Text style={{
              fontFamily: 'Inter_600SemiBold', fontSize: 12, color: P.ink2,
              textTransform: 'uppercase', letterSpacing: 0.6,
            }}>
              Today · {formatDate(today)}
            </Text>

            {/* Morning Energy */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>
                Morning Energy
              </Text>
              <DotRating value={morningLevel} onChange={setMorningLevel} />
            </View>

            {/* Afternoon Energy */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>
                Afternoon Energy
              </Text>
              <DotRating value={afternoonLevel} onChange={setAfternoonLevel} />
            </View>

            {/* Notes */}
            <TextInput
              style={{
                backgroundColor: P.bg,
                borderWidth: 1,
                borderColor: P.hairline,
                borderRadius: Radii.sm,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: P.ink,
                minHeight: 72,
                textAlignVertical: 'top',
              }}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="How's your focus? Any blockers?"
              placeholderTextColor={P.ink3}
            />

            {/* Save */}
            <Pressable onPress={() => { void handleSave(); }} disabled={saving}>
              <View style={{
                backgroundColor: P.accent,
                borderRadius: Radii.sm,
                paddingVertical: 13,
                alignItems: 'center',
                opacity: saving ? 0.7 : 1,
              }}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' }}>Save Log</Text>}
              </View>
            </Pressable>
          </View>

          {/* Past 14 days */}
          <Text style={{
            fontFamily: 'Inter_700Bold', fontSize: 11, color: P.ink,
            letterSpacing: 0.5, textTransform: 'uppercase',
            marginTop: 4, marginHorizontal: 4,
          }}>
            Past 14 Days
          </Text>

          {loading ? (
            <ActivityIndicator color={P.accent} style={{ marginTop: 20 }} />
          ) : history.filter(r => r.date !== today).length === 0 ? (
            <View style={{
              backgroundColor: P.surface, borderRadius: Radii.md,
              padding: 16, borderWidth: 1, borderColor: P.hairline, ...Shadows.card,
            }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: P.ink2 }}>
                No past logs yet.
              </Text>
            </View>
          ) : (
            history
              .filter(r => r.date !== today)
              .map(r => (
                <View key={r.id} style={{
                  backgroundColor: P.surface, borderRadius: Radii.md,
                  padding: 14, borderWidth: 1, borderColor: P.hairline,
                  gap: 8, ...Shadows.card,
                }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: P.ink }}>
                    {formatDate(r.date)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: P.ink3 }}>Morning</Text>
                      <MiniDotRating value={r.morning_level} />
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: P.ink3 }}>Afternoon</Text>
                      <MiniDotRating value={r.afternoon_level} />
                    </View>
                  </View>
                  {r.notes ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: P.ink2 }} numberOfLines={2}>
                      {r.notes}
                    </Text>
                  ) : null}
                </View>
              ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
