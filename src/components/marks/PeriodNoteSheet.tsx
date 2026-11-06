import { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { MAX_NOTE_LENGTH, NOTE_TAGS, validateNote, type NoteTag, type PeriodNote } from '../../lib/marks/dayNotes';
import { blankDraft, draftOf, stampsOf, type NoteDraft } from '../../lib/marks/periodNotesOps';
import { usePeriodNotesStore } from '../../store/periodNotesStore';

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const asDate = (day: string, time: string) => new Date(`${day}T${time}:00`);

/** Make, change or remove a note about a stretch of time. A note is information about time, not an event: it has no guests,
 *  never clashes, is never written to Google and never marks the hour busy to anyone. */
export function PeriodNoteSheet({ date, note, startMin, onClose }: { date: string; note: PeriodNote | null; startMin: number; onClose: () => void }) {
  const P = useScreenPalette();
  const addNote = usePeriodNotesStore(s => s.addNote);
  const updateNote = usePeriodNotesStore(s => s.updateNote);
  const removeNote = usePeriodNotesStore(s => s.removeNote);
  const [d, setD] = useState<NoteDraft>(() => note ? draftOf(note) : blankDraft(date, startMin));
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setD(note ? draftOf(note) : blankDraft(date, startMin)); setWhy(null); }, [note, date, startMin]);
  const set = (p: Partial<NoteDraft>) => { setD(x => ({ ...x, ...p })); setWhy(null); };

  async function save() {
    if (busy) return;
    const { start, end } = stampsOf(d);
    const bad = validateNote({ start, end, text: d.text, tag: d.tag });
    if (bad) { setWhy(bad); return; }
    setBusy(true);
    const r = note ? await updateNote(note.id, { start, end, text: d.text, tag: d.tag ?? null }) : await addNote({ start, end, text: d.text, ...(d.tag ? { tag: d.tag } : {}) });
    setBusy(false);
    if (r.ok) onClose(); else setWhy(r.why);
  }

  function confirmRemove() {
    if (!note) return;
    Alert.alert('Remove this note?', note.text.slice(0, 80), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void removeNote(note.id).then(r => { if (r) onClose(); }); } },
    ]);
  }

  const dim = d.allDay ? { opacity: 0.4 } : undefined;
  const pick = (label: string, day: string, time: string, onDay: (v: string) => void, onTime: (v: string) => void, timesOff: boolean) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.3 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <DateTimePicker value={asDate(day, '12:00')} mode="date" display="compact" onChange={(_, v) => { if (v) onDay(dayOf(v)); }} accessibilityLabel={`${label} date`} />
        <View style={timesOff ? dim : undefined} pointerEvents={timesOff ? 'none' : 'auto'}>
          <DateTimePicker value={asDate(day, time)} mode="time" display="compact" minuteInterval={5} onChange={(_, v) => { if (v) onTime(timeOf(v)); }} accessibilityLabel={`${label} time`} />
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: P.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: UIFont.bold, fontSize: 18, color: P.ink }}>{note ? 'Change this note' : 'Add a note'}</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>
                About a stretch of time, not an event: private, no guests, never sent to Google and never marks the hour busy.
              </Text>

              {pick('FROM', d.fromDate, d.fromTime, v => set({ fromDate: v, ...(v > d.toDate ? { toDate: v } : {}) }), v => set({ fromTime: v }), d.allDay)}
              {pick('TO', d.toDate, d.toTime, v => set({ toDate: v }), v => set({ toTime: v }), d.allDay)}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>All day</Text>
                {/* An all-day note carries 00:00 to 00:00, which is no span to save once All day is turned off: offer 09:00 to 10:00. */}
                <Switch value={d.allDay} onValueChange={v => set({ allDay: v, ...(!v && d.fromTime === '00:00' && d.toTime === '00:00' ? { fromTime: '09:00', toTime: '10:00' } : {}) })} accessibilityLabel="All day" />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {NOTE_TAGS.map(t => {
                  const on = d.tag === t.id;
                  return (
                    <Pressable key={t.id} accessibilityLabel={`Reason: ${t.label}`} accessibilityState={{ selected: on }} onPress={() => set({ tag: on ? undefined : (t.id as NoteTag) })}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.bg, borderWidth: 1, borderColor: on ? P.accent : P.hairline }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: on ? P.accentInk : P.ink }}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput value={d.text} onChangeText={t => set({ text: t })} placeholder="What the note says" placeholderTextColor={P.ink3} multiline maxLength={MAX_NOTE_LENGTH} accessibilityLabel="What the note says"
                style={{ minHeight: 88, textAlignVertical: 'top', backgroundColor: P.bg, borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: UIFont.regular, fontSize: 15, color: P.ink }} />

              {why ? <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.negative }}>{why}</Text> : null}
              <Pressable accessibilityLabel={note ? 'Save the note' : 'Add the note'} onPress={() => void save()} disabled={busy}
                style={{ minHeight: 48, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent, opacity: busy ? 0.6 : 1 }}>
                <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.accentInk }}>{busy ? 'Saving…' : note ? 'Save' : 'Add note'}</Text>
              </Pressable>
              {note ? (
                <Pressable accessibilityLabel="Remove this note" onPress={confirmRemove} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.negative }}>Remove</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
