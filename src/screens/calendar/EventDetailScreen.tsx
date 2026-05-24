import { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii } from '../../theme/tokens';
import { ListRow, ListSection } from '../../components/atoms/ListRow';
import type { DbCalendarEvent } from '../../types/database';

type DetailRoute = RouteProp<{ EventDetail: { eventId: string } }, 'EventDetail'>;

const dayFmt  = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function isAllDay(startIso: string, endIso: string): boolean {
  const s = new Date(startIso); const e = new Date(endIso);
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59;
}

export function EventDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<DetailRoute>();
  const eventId    = route.params.eventId;

  const event   = useCalendarStore(s => s.events.find(e => e.id === eventId));
  const update  = useCalendarStore(s => s.updateEvent);

  // Which field's inline picker is open ('start' | 'end' | null)
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

  // Edit drafts for text fields — commit on blur
  const [titleDraft, setTitleDraft]       = useState(event?.title ?? '');
  const [locationDraft, setLocationDraft] = useState(event?.location ?? '');
  const [notesDraft, setNotesDraft]       = useState(event?.prep_notes ?? '');
  const titleRef = useRef<TextInput>(null);

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
  const allDay = isAllDay(event.start_time, event.end_time);

  async function save(patch: Partial<DbCalendarEvent>) {
    await update(event!.id, patch);
  }

  async function commitTitle() {
    const v = titleDraft.trim();
    if (v && v !== event!.title) await save({ title: v });
  }
  async function commitLocation() {
    const v = locationDraft.trim();
    if (v !== (event!.location ?? '')) await save({ location: v.length === 0 ? null : v });
  }
  async function commitNotes() {
    const v = notesDraft;
    if (v !== (event!.prep_notes ?? '')) await save({ prep_notes: v.length === 0 ? null : v });
  }

  function onChangeStart(_: unknown, picked?: Date) {
    if (!picked) return;
    const startMs = picked.getTime();
    const endMs   = new Date(event!.end_time).getTime();
    const next: Partial<DbCalendarEvent> = { start_time: picked.toISOString() };
    if (endMs <= startMs) {
      // Auto-bump end to keep duration positive (default 1h)
      next.end_time = new Date(startMs + 60 * 60_000).toISOString();
    }
    void save(next);
  }
  function onChangeEnd(_: unknown, picked?: Date) {
    if (!picked) return;
    const startMs = new Date(event!.start_time).getTime();
    if (picked.getTime() <= startMs) return;
    void save({ end_time: picked.toISOString() });
  }

  function setAllDay(v: boolean) {
    if (v) {
      const d = new Date(event!.start_time);
      const s = new Date(d); s.setHours(0,  0,  0, 0);
      const e = new Date(d); e.setHours(23, 59, 0, 0);
      void save({ start_time: s.toISOString(), end_time: e.toISOString() });
    } else {
      const d = new Date(event!.start_time);
      const s = new Date(d); s.setHours(9,  0, 0, 0);
      const e = new Date(d); e.setHours(10, 0, 0, 0);
      void save({ start_time: s.toISOString(), end_time: e.toISOString() });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 22 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title + location card — Apple Calendar groups these visually */}
          <ListSection>
            <Pressable onPress={() => titleRef.current?.focus()}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 14, minHeight: 56 }}>
                <TextInput
                  ref={titleRef}
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  onBlur={() => void commitTitle()}
                  placeholder="Title"
                  placeholderTextColor={C.ink3}
                  style={{
                    fontFamily: 'Inter_700Bold', fontSize: 20, color: C.ink,
                    padding: 0, letterSpacing: -0.3,
                  }}
                />
              </View>
            </Pressable>
            <View style={{ height: 1, backgroundColor: C.hairline, marginLeft: 14 }} />
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 }}>
              <TextInput
                value={locationDraft}
                onChangeText={setLocationDraft}
                onBlur={() => void commitLocation()}
                placeholder="Location"
                placeholderTextColor={C.ink3}
                autoCapitalize="words"
                style={{
                  fontFamily: 'Inter_500Medium', fontSize: 15, color: C.ink,
                  padding: 0,
                }}
              />
            </View>
          </ListSection>

          {/* When */}
          <ListSection>
            <ListRow
              label="All-day"
              right={
                <Switch
                  value={allDay}
                  onValueChange={setAllDay}
                  trackColor={{ false: '#D8DDE6', true: C.green }}
                  thumbColor="#fff"
                />
              }
            />
            <ListRow
              label="Starts"
              active={openPicker === 'start'}
              onPress={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
              right={
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: openPicker === 'start' ? C.indigo : C.ink2 }}>
                    {dayFmt.format(new Date(event.start_time))}
                  </Text>
                  {!allDay ? (
                    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 14, color: openPicker === 'start' ? C.indigo : C.ink }}>
                      {timeFmt.format(new Date(event.start_time))}
                    </Text>
                  ) : null}
                </View>
              }
              expanded={
                openPicker === 'start' ? (
                  <DateTimePicker
                    value={new Date(event.start_time)}
                    mode={allDay ? 'date' : 'datetime'}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={onChangeStart}
                    style={{ alignSelf: 'stretch' }}
                  />
                ) : undefined
              }
            />
            <ListRow
              label="Ends"
              last
              active={openPicker === 'end'}
              onPress={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
              right={
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: openPicker === 'end' ? C.indigo : C.ink2 }}>
                    {dayFmt.format(new Date(event.end_time))}
                  </Text>
                  {!allDay ? (
                    <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 14, color: openPicker === 'end' ? C.indigo : C.ink }}>
                      {timeFmt.format(new Date(event.end_time))}
                    </Text>
                  ) : null}
                </View>
              }
              expanded={
                openPicker === 'end' ? (
                  <DateTimePicker
                    value={new Date(event.end_time)}
                    mode={allDay ? 'date' : 'datetime'}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={onChangeEnd}
                    minimumDate={new Date(event.start_time)}
                    style={{ alignSelf: 'stretch' }}
                  />
                ) : undefined
              }
            />
          </ListSection>

          {/* Calendar / meeting type */}
          <ListSection>
            <ListRow
              label="Calendar"
              accent={isGoogleSourced ? C.blue : C.indigo}
              last
              right={
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: C.ink2 }}>
                  {isGoogleSourced ? 'Google Calendar' : 'BPA · Local'}
                </Text>
              }
            />
          </ListSection>

          {/* Notes */}
          <ListSection title="Notes">
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 96 }}>
              <TextInput
                value={notesDraft}
                onChangeText={setNotesDraft}
                onBlur={() => void commitNotes()}
                placeholder="Add notes, links, or prep…"
                placeholderTextColor={C.ink3}
                multiline
                textAlignVertical="top"
                style={{
                  fontFamily: 'Inter_400Regular', fontSize: 15, color: C.ink,
                  padding: 0, minHeight: 72,
                }}
              />
            </View>
          </ListSection>

          {isGoogleSourced ? (
            <View style={{ padding: 12, backgroundColor: '#F7F8FB', borderRadius: Radii.sm }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink2, lineHeight: 18 }}>
                ✦ Editing a Google Calendar event. Changes are kept locally for this session — writing back to Google ships when the google-calendar-write Edge Function is wired into mobile.
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
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 17, color: C.indigo }}>‹ Calendar</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
    </View>
  );
}
