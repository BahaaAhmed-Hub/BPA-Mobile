import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator,
  Modal, TextInput, Switch, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette, ScreenPalette } from '../../theme/palette';
import { TopBar } from '../../components/atoms/TopBar';
import type { DbCalendarEvent } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { supabase } from '../../lib/supabase';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
function durMin(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();
  const [selected, setSelected] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const events         = useCalendarStore(s => s.events);
  const sync           = useCalendarStore(s => s.syncFromGoogle);
  const load           = useCalendarStore(s => s.loadRange);
  const loading        = useCalendarStore(s => s.loading);
  const syncing        = useCalendarStore(s => s.syncing);
  const lastSyncedAt   = useCalendarStore(s => s.lastSyncedAt);
  const needsReconnect = useCalendarStore(s => s.needsReconnect);

  const weekStart = useMemo(() => startOfWeek(selected), [selected]);
  const weekEnd   = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    void sync(isoDate(weekStart), isoDate(weekEnd))
      .catch(() => void load(isoDate(weekStart), isoDate(weekEnd)));
  }, [sync, load, weekStart, weekEnd]);

  const dayEvents = useMemo(
    () => events.filter(e => isSameDay(new Date(e.start_time), selected)),
    [events, selected],
  );

  const now = new Date();
  const showNowDivider = isSameDay(selected, now);
  const subtitle = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar
        title="Calendar Intel"
        subtitle={subtitle}
        dark={P.isDark}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => void sync(isoDate(weekStart), isoDate(weekEnd))}
              disabled={syncing}
              hitSlop={8}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {syncing
                ? <ActivityIndicator size="small" color={P.accent} />
                : <Text style={{ color: P.accent, fontFamily: 'Inter_700Bold', fontSize: 14 }}>⟳</Text>}
            </Pressable>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              hitSlop={8}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: P.accent, borderWidth: 0,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 22 }}>+</Text>
            </Pressable>
          </View>
        }
      />

      {needsReconnect.length > 0 ? (
        <View style={{
          marginHorizontal: 20, marginBottom: 10,
          backgroundColor: 'rgba(178,58,54,0.10)', borderRadius: Radii.sm,
          padding: 10, borderWidth: 1, borderColor: 'rgba(178,58,54,0.3)',
        }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.red }}>
            Reconnect required: {needsReconnect.join(', ')}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: P.ink2, marginTop: 2 }}>
            Sign out and back in with Google to grant a fresh token.
          </Text>
        </View>
      ) : null}

      {lastSyncedAt ? (
        <Text style={{ paddingHorizontal: 20, marginBottom: 6, fontFamily: 'Inter_500Medium', fontSize: 11, color: P.ink3 }}>
          Synced {new Date(lastSyncedAt).toLocaleTimeString()}
        </Text>
      ) : null}

      {/* Week strip */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const d = addDays(weekStart, i);
          const active = isSameDay(d, selected);
          const today = isSameDay(d, now);
          const dayHasEvents = events.some(e => isSameDay(new Date(e.start_time), d));
          return (
            <Pressable key={i} onPress={() => setSelected(d)} style={{ flex: 1 }}>
              <View style={{
                paddingVertical: 10, borderRadius: Radii.sm,
                backgroundColor: active ? P.ink : 'transparent',
                borderWidth: active ? 0 : 1,
                borderColor: P.hairline,
                alignItems: 'center',
              }}>
                <Text style={{
                  fontFamily: 'Inter_600SemiBold', fontSize: 10,
                  color: active ? (P.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)') : P.ink2,
                  letterSpacing: 0.5,
                }}>{DAY_LABELS[i]}</Text>
                <Text style={{
                  fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2,
                  color: active ? (P.isDark ? P.bg : '#fff') : today ? P.accent : P.ink,
                }}>{d.getDate()}</Text>
                {dayHasEvents ? (
                  <View style={{
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: active ? (P.isDark ? P.bg : '#fff') : C.red,
                    marginTop: 3,
                  }} />
                ) : <View style={{ height: 7 }} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading || syncing} onRefresh={() => void sync(isoDate(weekStart), isoDate(weekEnd))} tintColor={P.accent} />}
      >
        <Text style={{
          fontFamily: 'Inter_700Bold', fontSize: 11, color: P.ink,
          letterSpacing: 0.5, textTransform: 'uppercase',
          marginHorizontal: 4, marginBottom: 10, marginTop: 4,
        }}>
          {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {dayEvents.length === 0 ? (
          <View style={{
            backgroundColor: P.surface, borderRadius: Radii.md,
            padding: 18, borderWidth: 1, borderColor: P.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.ink }}>Open day</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: P.ink2, marginTop: 4 }}>
              {lastSyncedAt ? 'Nothing on the calendar.' : 'Tap ⟳ to pull events from Google Calendar.'}
            </Text>
          </View>
        ) : (
          dayEvents.map((e, idx) => {
            const eventStart = new Date(e.start_time);
            const isPast = eventStart < now;
            const isLive = showNowDivider && eventStart <= now && new Date(e.end_time) >= now;
            const nextEvent = dayEvents[idx + 1];
            const showNowAfter = showNowDivider && !isPast && idx === 0 && new Date(e.start_time) > now;
            const showNowBetween = showNowDivider && nextEvent && new Date(e.end_time) < now && new Date(nextEvent.start_time) > now;

            return (
              <View key={e.id}>
                {showNowAfter ? <NowDivider P={P} /> : null}
                <Pressable onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}>
                  <EventCard event={e} highlighted={isLive} dimmed={isPast && !isLive} P={P} />
                </Pressable>
                {showNowBetween ? <NowDivider P={P} /> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <CreateEventModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSaved={() => {
          setShowCreateModal(false);
          void load(isoDate(weekStart), isoDate(weekEnd));
        }}
      />
    </SafeAreaView>
  );
}

// ─── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({
  visible, onClose, onSaved,
}: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const P = useScreenPalette();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildIso(d: Date, t: Date): string {
    const out = new Date(d);
    out.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return out.toISOString();
  }

  function fmtTimePicker(d: Date): string {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not signed in'); return; }

      const startIso = allDay
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString()
        : buildIso(date, startTime);
      const endIso = allDay
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0).toISOString()
        : buildIso(date, endTime);

      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id,
        title: title.trim(),
        location: location.trim() || null,
        start_time: startIso,
        end_time: endIso,
        is_synced: false,
        google_event_id: null,
        company_id: null,
        meeting_type: null,
        prep_notes: null,
      });

      if (error) throw error;
      onSaved();
      // Reset form
      setTitle(''); setLocation(''); setAllDay(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline,
    borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Inter_400Regular' as const, fontSize: 15, color: P.ink,
  };

  const rowStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: P.surface, borderRadius: Radii.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: P.hairline,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
        {/* Modal header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: P.hairline,
        }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: P.ink }}>New Event</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ fontSize: 22, color: P.ink2, fontFamily: 'Inter_500Medium' }}>×</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>

            {/* Title */}
            <TextInput
              style={[inputStyle, { fontFamily: 'Inter_700Bold', fontSize: 18 }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor={P.ink3}
            />

            {/* Location */}
            <TextInput
              style={inputStyle}
              value={location}
              onChangeText={setLocation}
              placeholder="Location (optional)"
              placeholderTextColor={P.ink3}
            />

            {/* Date */}
            <Pressable onPress={() => setShowDatePicker(v => !v)}>
              <View style={rowStyle}>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink }}>Date</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.accent }}>
                  {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => { if (d) setDate(d); }}
              />
            )}

            {/* All-day toggle */}
            <View style={rowStyle}>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink }}>All day</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ false: P.hairline, true: P.accent }}
                thumbColor="#fff"
              />
            </View>

            {!allDay && (
              <>
                {/* Start time */}
                <Pressable onPress={() => { setShowStartPicker(v => !v); setShowEndPicker(false); }}>
                  <View style={rowStyle}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink }}>Start time</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.accent }}>
                      {fmtTimePicker(startTime)}
                    </Text>
                  </View>
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, t) => { if (t) setStartTime(t); }}
                  />
                )}

                {/* End time */}
                <Pressable onPress={() => { setShowEndPicker(v => !v); setShowStartPicker(false); }}>
                  <View style={rowStyle}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: P.ink }}>End time</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: P.accent }}>
                      {fmtTimePicker(endTime)}
                    </Text>
                  </View>
                </Pressable>
                {showEndPicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, t) => { if (t) setEndTime(t); }}
                  />
                )}
              </>
            )}

            {/* Save */}
            <Pressable onPress={() => { void handleSave(); }} disabled={saving} style={{ marginTop: 8 }}>
              <View style={{
                backgroundColor: P.accent, borderRadius: Radii.sm,
                paddingVertical: 14, alignItems: 'center',
                opacity: saving ? 0.7 : 1,
              }}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' }}>Save Event</Text>}
              </View>
            </Pressable>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Now Divider ─────────────────────────────────────────────────────────────

function NowDivider({ P }: { P: ScreenPalette }) {
  const now = new Date();
  return (
    <View style={{ marginVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: C.red, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 }}>
          NOW · {fmtTime(now.toISOString())}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1.5, backgroundColor: C.red, opacity: P.isDark ? 0.7 : 0.5 }} />
    </View>
  );
}

function EventCard({ event, highlighted, dimmed, P }: { event: DbCalendarEvent; highlighted: boolean; dimmed: boolean; P: ScreenPalette }) {
  // Card body uses fixed blue/indigo so events are always recognizably "events"
  // regardless of theme. Only the time gutter (which lives ON the bg) flips
  // with the palette, and never dims — past events fade their card, not their time.
  const accent = highlighted ? C.indigo : C.blue;
  const bg = highlighted ? C.indigo : C.blueSoft;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
      {/* Time gutter — high-contrast, never dimmed, theme-aware */}
      <View style={{ width: 52, paddingTop: 8, alignItems: 'flex-start' }}>
        <Text style={{
          fontFamily: 'JetBrainsMono_500Medium',
          fontSize: 14,
          color: P.ink,
          letterSpacing: -0.2,
        }}>
          {fmtTime(event.start_time)}
        </Text>
        <Text style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
          color: P.ink2,
          marginTop: 2,
          letterSpacing: 0.2,
        }}>
          {durMin(event.start_time, event.end_time)} min
        </Text>
      </View>
      {/* Card — this is what fades for past events, not the time */}
      <View style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: Radii.sm,
        paddingVertical: 10, paddingHorizontal: 12,
        borderLeftWidth: 3, borderLeftColor: accent,
        opacity: dimmed ? 0.55 : 1,
      }}>
        <Text style={{
          fontFamily: 'Inter_700Bold', fontSize: 13,
          color: highlighted ? '#fff' : C.ink,
          letterSpacing: -0.2,
        }} numberOfLines={2}>{event.title}</Text>
        {event.location ? (
          <Text style={{
            fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 3,
            color: highlighted ? 'rgba(255,255,255,0.85)' : C.ink2,
          }} numberOfLines={1}>📍 {event.location}</Text>
        ) : null}
        {event.meeting_type ? (
          <Text style={{
            fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 3,
            color: highlighted ? 'rgba(255,255,255,0.85)' : accent,
          }}>{event.meeting_type}</Text>
        ) : null}
      </View>
    </View>
  );
}
