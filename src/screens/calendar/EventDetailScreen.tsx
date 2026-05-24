import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { InlineEdit } from '../../components/atoms/InlineEdit';
import type { DbCalendarEvent } from '../../types/database';

type DetailRoute = RouteProp<{ EventDetail: { eventId: string } }, 'EventDetail'>;

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function durLabel(startIso: string, endIso: string): string {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function EventDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<DetailRoute>();
  const eventId    = route.params.eventId;

  const event   = useCalendarStore(s => s.events.find(e => e.id === eventId));
  const update  = useCalendarStore(s => s.updateEvent);

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Header onBack={() => navigation.goBack()} />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_500Medium', color: C.ink2 }}>Event not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGoogleSourced = event.id.startsWith('google:');
  async function save(patch: Partial<DbCalendarEvent>) {
    const res = await update(event!.id, patch);
    if (!res.ok && res.reason === 'google-readonly') {
      // Optimistic in-memory update already applied; just leave a console hint
      console.log('[EventDetail] Google event edit kept in-memory; write-back to Google not wired yet.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Source badge */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill,
              backgroundColor: isGoogleSourced ? C.blueSoft : C.indigoSoft,
              flexDirection: 'row', gap: 6, alignItems: 'center',
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isGoogleSourced ? C.blue : C.indigo }} />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: isGoogleSourced ? C.blue : C.indigo, letterSpacing: 0.4 }}>
                {isGoogleSourced ? 'GOOGLE CALENDAR' : 'LOCAL EVENT'}
              </Text>
            </View>
          </View>

          {/* Title — large, tap-to-edit */}
          <InlineEdit
            label="Title"
            value={event.title}
            placeholder="Untitled event"
            onSave={v => save({ title: v ?? '(untitled)' })}
          />

          {/* When (computed — derived, read-only block) */}
          <View style={{
            backgroundColor: C.card, borderRadius: Radii.md, padding: 14,
            borderWidth: 1, borderColor: C.hairline, ...Shadows.card,
          }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2, marginBottom: 6 }}>
              WHEN
            </Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: C.ink }}>
              {fmtDateTime(event.start_time)}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: C.ink3, marginTop: 2 }}>
              {durLabel(event.start_time, event.end_time)} · ends {fmtDateTime(event.end_time)}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: C.ink3, marginTop: 8 }}>
              Time editing on mobile arrives with a native date/time picker in a follow-up.
            </Text>
          </View>

          <InlineEdit
            label="Location"
            value={event.location}
            placeholder="Tap to add location"
            autoCapitalize="words"
            onSave={v => save({ location: v })}
          />

          <InlineEdit
            label="Meeting type"
            value={event.meeting_type}
            placeholder="e.g. one_on_one, standup, video"
            autoCapitalize="none"
            onSave={v => save({ meeting_type: v })}
          />

          <InlineEdit
            label="Prep notes"
            value={event.prep_notes}
            placeholder="Agenda, links, what to read before the meeting…"
            multiline
            onSave={v => save({ prep_notes: v })}
          />

          {isGoogleSourced ? (
            <View style={{
              padding: 12, backgroundColor: '#F7F8FB', borderRadius: Radii.sm,
            }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink2, lineHeight: 18 }}>
                ✦ This is a Google Calendar event. Edits are kept locally for this session — writing back to Google ships when the google-calendar-write Edge Function is wired into mobile.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={{
      paddingHorizontal: 14, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <Pressable onPress={onBack} hitSlop={8} style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: C.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.ink2 }}>
        Event
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}
