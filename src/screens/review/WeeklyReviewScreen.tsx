import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { C, Radii, Shadows, Spacing } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { supabase } from '../../lib/supabase';
import type { DbWeeklyReview } from '../../types/database';
import { UIFont, NumFont } from '../../theme/typography';

// Returns "YYYY-MM-DD" for the Monday of the week containing d
function mondayOfWeek(d: Date): string {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out.toISOString().slice(0, 10);
}

function formatMonday(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: undefined, day: 'numeric', month: 'short' });
}

function weekRangeLabel(isoMonday: string): string {
  const mon = new Date(isoMonday + 'T00:00:00');
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

export function WeeklyReviewScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();

  const thisMonday = mondayOfWeek(new Date());

  const [shipped, setShipped] = useState('');
  const [slipped, setSlipped] = useState('');
  const [focusHrs, setFocusHrs] = useState('');
  const [meetingHrs, setMeetingHrs] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<DbWeeklyReview[]>([]);
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
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('week_of', { ascending: false })
        .limit(12);

      if (error) throw error;
      if (data) {
        setHistory(data as DbWeeklyReview[]);
        // Pre-fill form if there's a review for this week
        const thisWeek = data.find((r: DbWeeklyReview) => r.week_of === thisMonday);
        if (thisWeek) {
          setShipped(thisWeek.shipped_count != null ? String(thisWeek.shipped_count) : '');
          setSlipped(thisWeek.slipped_count != null ? String(thisWeek.slipped_count) : '');
          setFocusHrs(thisWeek.focus_hours != null ? String(thisWeek.focus_hours) : '');
          setMeetingHrs(thisWeek.meeting_hours != null ? String(thisWeek.meeting_hours) : '');
          setNotes(thisWeek.professor_insight ?? '');
        }
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load history');
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
        week_of: thisMonday,
        shipped_count: shipped !== '' ? parseInt(shipped, 10) : null,
        slipped_count: slipped !== '' ? parseInt(slipped, 10) : null,
        focus_hours: focusHrs !== '' ? parseFloat(focusHrs) : null,
        meeting_hours: meetingHrs !== '' ? parseFloat(meetingHrs) : null,
        professor_insight: notes.trim() || null,
      };

      const { error } = await supabase
        .from('weekly_reviews')
        .upsert(payload, { onConflict: 'user_id,week_of' });

      if (error) throw error;
      Alert.alert('Saved', 'Weekly review saved.');
      await loadHistory();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.hairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: UIFont.medium,
    fontSize: 15,
    color: P.ink,
    textAlign: 'center' as const,
  };

  const labelStyle = {
    fontFamily: UIFont.medium,
    fontSize: 12,
    color: P.ink3,
    marginBottom: 4,
    textAlign: 'center' as const,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={{ fontSize: 22, color: P.ink, fontFamily: UIFont.bold }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 17, color: P.ink, letterSpacing: -0.3, flex: 1 }}>
          Weekly Review
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}>

          {/* This week's form */}
          <View style={{
            backgroundColor: P.surface,
            borderRadius: Radii.md,
            padding: 16,
            borderWidth: 1,
            borderColor: P.hairline,
            gap: 14,
            ...Shadows.card,
          }}>
            <Text style={{
              fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4,
              textTransform: 'uppercase', letterSpacing: 1.6,
            }}>
              Week of {formatMonday(thisMonday)}
            </Text>

            {/* 2×2 numeric grid */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Shipped</Text>
                <TextInput
                  style={inputStyle}
                  value={shipped}
                  onChangeText={setShipped}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={P.ink3}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Slipped</Text>
                <TextInput
                  style={inputStyle}
                  value={slipped}
                  onChangeText={setSlipped}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={P.ink3}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Focus hrs</Text>
                <TextInput
                  style={inputStyle}
                  value={focusHrs}
                  onChangeText={setFocusHrs}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={P.ink3}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Meeting hrs</Text>
                <TextInput
                  style={inputStyle}
                  value={meetingHrs}
                  onChangeText={setMeetingHrs}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={P.ink3}
                />
              </View>
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
                fontFamily: UIFont.regular,
                fontSize: 14,
                color: P.ink,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Reflection, wins, lessons…"
              placeholderTextColor={P.ink3}
            />

            {/* Save button */}
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
                  : <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: '#fff' }}>Save Review</Text>}
              </View>
            </Pressable>
          </View>

          {/* History */}
          <Text style={{
            fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4,
            letterSpacing: 1.6, textTransform: 'uppercase',
            marginTop: 4, marginHorizontal: 4,
          }}>
            History
          </Text>

          {loading ? (
            <ActivityIndicator color={P.accent} style={{ marginTop: 20 }} />
          ) : history.filter(r => r.week_of !== thisMonday).length === 0 ? (
            <View style={{
              backgroundColor: P.surface, borderRadius: Radii.md,
              padding: 16, borderWidth: 1, borderColor: P.hairline, ...Shadows.card,
            }}>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink2 }}>
                No past reviews yet.
              </Text>
            </View>
          ) : (
            history
              .filter(r => r.week_of !== thisMonday)
              .map(r => (
                <View key={r.id} style={{
                  backgroundColor: P.surface, borderRadius: Radii.md,
                  padding: 14, borderWidth: 1, borderColor: P.hairline,
                  gap: 8, ...Shadows.card,
                }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
                    {weekRangeLabel(r.week_of)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {r.shipped_count != null && (
                      <View style={{
                        backgroundColor: `${C.green}1A`, borderRadius: Radii.pill,
                        paddingHorizontal: 10, paddingVertical: 3,
                        borderWidth: 1, borderColor: `${C.green}30`,
                      }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: C.green }}>
                          ✓ {r.shipped_count} shipped
                        </Text>
                      </View>
                    )}
                    {r.slipped_count != null && (
                      <View style={{
                        backgroundColor: `${C.orange}1A`, borderRadius: Radii.pill,
                        paddingHorizontal: 10, paddingVertical: 3,
                        borderWidth: 1, borderColor: `${C.orange}30`,
                      }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: C.orange }}>
                          ↷ {r.slipped_count} slipped
                        </Text>
                      </View>
                    )}
                  </View>
                  {(r.focus_hours != null || r.meeting_hours != null) && (
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>
                      {r.focus_hours != null ? `${r.focus_hours}h focus` : ''}
                      {r.focus_hours != null && r.meeting_hours != null ? '  ·  ' : ''}
                      {r.meeting_hours != null ? `${r.meeting_hours}h meetings` : ''}
                    </Text>
                  )}
                  {r.professor_insight ? (
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2 }} numberOfLines={2}>
                      {r.professor_insight}
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
