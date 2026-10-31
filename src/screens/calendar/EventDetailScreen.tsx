import { useState, useRef } from 'react';
import { LinkPreviews } from '../../components/atoms/LinkPreviews';
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCalendarStore } from '../../store/calendarStore';
import { C, Radii } from '../../theme/tokens';
import { ListRow, ListSection } from '../../components/atoms/ListRow';
import type { DbCalendarEvent } from '../../types/database';
import { UIFont, NumFont } from '../../theme/typography';
import { useProjectStore } from '../../store/projectStore';
import { useTaskStore } from '../../store/taskStore';
import { notify } from '../../store/feedbackStore';
import { projectOfEvent, drawableColor } from '../../lib/projects';
import { placementForNew } from '../../lib/tasks';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type DetailRoute = RouteProp<{ EventDetail: { eventId: string } }, 'EventDetail'>;

const dayFmt  = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function isAllDay(startIso: string, endIso: string): boolean {
  const s = new Date(startIso); const e = new Date(endIso);
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59;
}

export function EventDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const projects = useProjectStore(s => s.projects);
  const links    = useProjectStore(s => s.links);
  const addTask  = useTaskStore(s => s.addTask);
  const [followOpen, setFollowOpen] = useState(false);
  const [followTitle, setFollowTitle] = useState('');

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Header onBack={() => navigation.goBack()} />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: UIFont.medium, color: C.ink2 }}>Event not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGoogleSourced = event.id.startsWith('google:');
  const project = projectOfEvent(event.google_event_id, links, projects);
  const allDay = isAllDay(event.start_time, event.end_time);

  /** A task that came out of this meeting. Its description says where from, the way the web's follow-ups do. */
  async function makeFollowUp() {
    const title = followTitle.trim();
    if (!title) return;
    const s = new Date(event!.start_time); const e = new Date(event!.end_time);
    const day = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
    const created = await addTask({
      title,
      description: `From "${event!.title}" · ${day}${allDay ? '' : ` · ${t(s)} – ${t(e)}`}`,
      quadrant: placementForNew(null),
    });
    if (created) { notify('success', `Added "${title}" to Do`); setFollowOpen(false); setFollowTitle(''); }
  }

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
                    fontFamily: UIFont.bold, fontSize: 20, color: C.ink,
                    padding: 0, letterSpacing: -0.3,
                  }}
                />
              </View>
            </Pressable>
            <View style={{ height: 1, backgroundColor: C.hairline, marginLeft: 14 }} />
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 16, marginTop: 2 }}>📍</Text>
              <TextInput
                value={locationDraft}
                onChangeText={setLocationDraft}
                onBlur={() => void commitLocation()}
                placeholder="Location or URL"
                placeholderTextColor={C.ink3}
                autoCapitalize="words"
                multiline
                style={{
                  fontFamily: UIFont.medium, fontSize: 15, color: C.ink,
                  padding: 0, flex: 1, minHeight: 20,
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
                  <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: openPicker === 'start' ? C.indigo : C.ink2 }}>
                    {dayFmt.format(new Date(event.start_time))}
                  </Text>
                  {!allDay ? (
                    <Text style={{ fontFamily: NumFont.medium, fontSize: 14, color: openPicker === 'start' ? C.indigo : C.ink }}>
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
                  <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: openPicker === 'end' ? C.indigo : C.ink2 }}>
                    {dayFmt.format(new Date(event.end_time))}
                  </Text>
                  {!allDay ? (
                    <Text style={{ fontFamily: NumFont.medium, fontSize: 14, color: openPicker === 'end' ? C.indigo : C.ink }}>
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
                <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: C.ink2 }}>
                  {isGoogleSourced ? 'Google Calendar' : 'Local'}
                </Text>
              }
            />
          </ListSection>

          {/* Project — read-only; linking is done on the web */}
          {project ? (
            <ListSection>
              <ListRow
                label="Project"
                accent={drawableColor(project.color, C.indigo)}
                last
                onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                right={<Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 14, color: C.ink2 }}>{project.name} ›</Text>}
              />
            </ListSection>
          ) : null}

          {/* What came out of it */}
          <ListSection>
            <ListRow
              label="Make a follow-up task"
              last
              active={followOpen}
              onPress={() => { setFollowOpen(o => !o); if (!followTitle) setFollowTitle(`Follow up: ${event.title}`); }}
              right={<Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: C.ink3 }}>{followOpen ? '▴' : '▾'}</Text>}
              expanded={followOpen ? (
                <View style={{ paddingHorizontal: 6, paddingTop: 8, gap: 10 }}>
                  <TextInput
                    value={followTitle} onChangeText={setFollowTitle} autoFocus
                    placeholder="What needs to happen?" placeholderTextColor={C.ink3} accessibilityLabel="Follow-up task"
                    returnKeyType="done" onSubmitEditing={() => void makeFollowUp()}
                    style={{ fontFamily: UIFont.medium, fontSize: 15, color: C.ink, minHeight: 44, paddingHorizontal: 10, borderRadius: Radii.sm, backgroundColor: C.field, borderWidth: 1, borderColor: C.hairline }}
                  />
                  <Pressable onPress={() => void makeFollowUp()} accessibilityLabel="Add follow-up task" disabled={!followTitle.trim()}
                    style={{ minHeight: 46, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: followTitle.trim() ? C.indigo : C.hairline }}>
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: followTitle.trim() ? '#fff' : C.ink3 }}>Add task</Text>
                  </Pressable>
                </View>
              ) : undefined}
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
                  fontFamily: UIFont.regular, fontSize: 15, color: C.ink,
                  padding: 0, minHeight: 72,
                }}
              />
              <LinkPreviews text={notesDraft} />
            </View>
          </ListSection>

          {isGoogleSourced ? (
            <View style={{ padding: 12, backgroundColor: 'rgba(47,110,214,0.07)', borderRadius: Radii.sm }}>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: C.ink2, lineHeight: 18 }}>
                ✦ Changes to this Google Calendar event are written back to Google automatically.
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
        <Text style={{ fontFamily: UIFont.medium, fontSize: 17, color: C.indigo }}>‹ Calendar</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
    </View>
  );
}
