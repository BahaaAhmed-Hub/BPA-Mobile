import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import type { DbCalendarEvent } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // Sunday
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

  useEffect(() => {
    // Try Google sync first — falls back to Supabase rows on error/no token.
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar
        title="Calendar Intel"
        subtitle={subtitle}
        right={
          <Pressable
            onPress={() => void sync(isoDate(weekStart), isoDate(weekEnd))}
            disabled={syncing}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {syncing
              ? <ActivityIndicator size="small" color={C.indigo} />
              : <Text style={{ color: C.indigo, fontFamily: 'Inter_700Bold', fontSize: 14 }}>⟳</Text>}
          </Pressable>
        }
      />

      {needsReconnect.length > 0 ? (
        <View style={{
          marginHorizontal: 20, marginBottom: 10,
          backgroundColor: 'rgba(178,58,54,0.08)', borderRadius: Radii.sm,
          padding: 10, borderWidth: 1, borderColor: 'rgba(178,58,54,0.2)',
        }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.red }}>
            Reconnect required: {needsReconnect.join(', ')}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: C.ink2, marginTop: 2 }}>
            Sign out and back in with Google to grant a fresh token.
          </Text>
        </View>
      ) : null}

      {lastSyncedAt ? (
        <Text style={{ paddingHorizontal: 20, marginBottom: 6, fontFamily: 'Inter_500Medium', fontSize: 11, color: C.ink3 }}>
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
                backgroundColor: active ? C.ink : 'transparent',
                borderWidth: active ? 0 : 1,
                borderColor: C.hairline,
                alignItems: 'center',
              }}>
                <Text style={{
                  fontFamily: 'Inter_600SemiBold', fontSize: 10,
                  color: active ? 'rgba(255,255,255,0.6)' : C.ink3,
                  letterSpacing: 0.5,
                }}>{DAY_LABELS[i]}</Text>
                <Text style={{
                  fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2,
                  color: active ? '#fff' : today ? C.indigo : C.ink,
                }}>{d.getDate()}</Text>
                {dayHasEvents ? (
                  <View style={{
                    width: 4, height: 4, borderRadius: 2,
                    backgroundColor: active ? '#fff' : C.red,
                    marginTop: 3,
                  }} />
                ) : <View style={{ height: 7 }} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Timeline */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading || syncing} onRefresh={() => void sync(isoDate(weekStart), isoDate(weekEnd))} tintColor={C.indigo} />}
      >
        <Text style={{
          fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink,
          letterSpacing: 0.5, textTransform: 'uppercase',
          marginHorizontal: 4, marginBottom: 10, marginTop: 4,
        }}>
          {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {dayEvents.length === 0 ? (
          <View style={{
            backgroundColor: C.card, borderRadius: Radii.md,
            padding: 18, borderWidth: 1, borderColor: C.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.ink }}>Open day</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, marginTop: 4 }}>
              {lastSyncedAt
                ? 'Nothing on the calendar.'
                : 'Tap ⟳ to pull events from Google Calendar.'}
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
                {showNowAfter ? <NowDivider /> : null}
                <Pressable onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}>
                  <EventCard event={e} highlighted={isLive} dimmed={isPast && !isLive} />
                </Pressable>
                {showNowBetween ? <NowDivider /> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NowDivider() {
  const now = new Date();
  return (
    <View style={{ marginVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: C.red, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 }}>
          NOW · {fmtTime(now.toISOString())}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1.5, backgroundColor: C.red, opacity: 0.5 }} />
    </View>
  );
}

function EventCard({ event, highlighted, dimmed }: { event: DbCalendarEvent; highlighted: boolean; dimmed: boolean }) {
  const accent = highlighted ? C.indigo : C.blue;
  const bg = highlighted ? C.indigo : C.blueSoft;
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8, opacity: dimmed ? 0.5 : 1 }}>
      <View style={{ width: 44, paddingTop: 8, alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, color: C.ink }}>
          {fmtTime(event.start_time)}
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: C.ink3, marginTop: 2 }}>
          {durMin(event.start_time, event.end_time)}m
        </Text>
      </View>
      <View style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: Radii.sm,
        paddingVertical: 10, paddingHorizontal: 12,
        borderLeftWidth: 3, borderLeftColor: accent,
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
