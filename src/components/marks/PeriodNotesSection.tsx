import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { Plus } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { usePeriodNotesStore } from '../../store/periodNotesStore';
import { NOTE_TAGS, notesOnDay, type PeriodNote } from '../../lib/marks/dayNotes';
import { hhmm } from '../../lib/marks/periodNotesOps';
import { PeriodNoteSheet } from './PeriodNoteSheet';

/** The notes that fall on one day, each with its hours (a note across midnight is cut at the edge, each side on its own day,
 *  with a mark that it continues), and a way to add one. Notes are information about time: never an event. */
export function PeriodNotesSection({ date }: { date: string }) {
  const P = useScreenPalette();
  const notes = usePeriodNotesStore(s => s.notes);
  const loadFromDB = usePeriodNotesStore(s => s.loadFromDB);
  const [editing, setEditing] = useState<{ note: PeriodNote | null } | null>(null);

  useEffect(() => { void loadFromDB(); }, [loadFromDB]);
  const segs = useMemo(() => notesOnDay(notes, date), [notes, date]);
  const startMin = useMemo(() => {
    const now = new Date();
    return date === now.toLocaleDateString('en-CA') ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15 : 9 * 60;
  }, [date]);

  return (
    <View style={{ gap: 10, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
        <Text style={{ fontFamily: UIFont.bold, fontSize: 11, color: P.ink, letterSpacing: 0.5 }}>NOTES</Text>
        <Pressable accessibilityLabel="Add a note" onPress={() => setEditing({ note: null })} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
          <Plus size={14} color={P.accentDeep} />
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.accentDeep }}>Add a note</Text>
        </Pressable>
      </View>

      {segs.length > 0 ? (
        <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
          {segs.map((s, i) => {
            const tag = NOTE_TAGS.find(t => t.id === s.note.tag)?.label;
            const hours = s.wholeDay ? 'All day' : `${s.continuesBefore ? '‹ ' : ''}${hhmm(s.startMin)}–${s.endMin >= 1440 ? '24:00' : hhmm(s.endMin)}${s.continuesAfter ? ' ›' : ''}`;
            return (
              <Pressable key={`${s.note.id}`} accessibilityLabel={`Note, ${hours}${tag ? `, ${tag}` : ''}: ${s.note.text}. Change it`} onPress={() => setEditing({ note: s.note })}
                style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < segs.length - 1 ? 1 : 0, borderColor: P.hairline }}>
                <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.ink3, width: 92 }}>{hours}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  {tag ? <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.accentDeep }}>{tag.toUpperCase()}</Text> : null}
                  <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink }}>{s.note.text}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {editing ? <PeriodNoteSheet date={date} note={editing.note} startMin={startMin} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}
