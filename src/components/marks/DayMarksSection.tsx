import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from '../atoms/Pressable';
import { Plus } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useDayMarksStore } from '../../store/dayMarksStore';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useModuleStore } from '../../store/moduleStore';
import { moduleIsOff } from '../../lib/entitlements';
import { marksOnDay, type DayMark } from '../../lib/marks/dayNotes';
import { dayCandidates, type Candidate } from '../../lib/marks/dayCandidates';
import { candidateFacts } from '../../lib/marks/facts';
import { dismiss, loadDismissed, skipFor } from '../../lib/marks/dismissed';
import { DayMarkSheet } from './DayMarkSheet';

const todayIso = () => new Date().toLocaleDateString('en-CA');

/** The marks on one day, a way to make one, and for a day that has happened a few true things worth keeping. Nothing is
 *  written until Keep: the app proposes, the person keeps. */
export function DayMarksSection({ date }: { date: string }) {
  const P = useScreenPalette();
  const marks = useDayMarksStore(s => s.marks);
  const loadFromDB = useDayMarksStore(s => s.loadFromDB);
  const addMark = useDayMarksStore(s => s.addMark);
  const tasks = useTaskStore(s => s.tasks);
  const habits = useHabitStore(s => s.habits);
  const logsByHabit = useHabitStore(s => s.logsByHabit);
  const books = useLibraryStore(s => s.books);
  const modules = useModuleStore(s => s.modules);
  const [editing, setEditing] = useState<{ mark: DayMark | null } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => { void loadFromDB(); void loadDismissed().then(setDismissed); }, [loadFromDB]);

  const here = useMemo(() => marksOnDay(marks, date), [marks, date]);

  // A day that has not happened has nothing true to offer, and a card saying "nothing" is never drawn.
  const offers: Candidate[] = useMemo(() => {
    if (date > todayIso()) return [];
    const kept = new Set(here.filter(m => m.source).map(m => `${m.source!.kind}:${m.source!.id}`));
    const skip = new Set([...kept, ...skipFor(dismissed, date)]);
    return dayCandidates(candidateFacts(date, {
      tasks, habits, logsByHabit, books,
      tasksOff: moduleIsOff(modules, 'tasks'), habitsOff: moduleIsOff(modules, 'habits'), libraryOff: moduleIsOff(modules, 'library'),
    }), skip, 4);
  }, [date, here, tasks, habits, logsByHabit, books, modules, dismissed]);

  async function keep(c: Candidate) { await addMark({ date, emoji: c.emoji, text: c.text, source: c.source }); }
  async function notThis(c: Candidate) { await dismiss(date, c.source); setDismissed(await loadDismissed()); }

  return (
    <View style={{ gap: 10, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
        <Text style={{ fontFamily: UIFont.bold, fontSize: 11, color: P.ink, letterSpacing: 0.5 }}>MARKS</Text>
        <Pressable accessibilityLabel="Mark this day" onPress={() => setEditing({ mark: null })} hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
          <Plus size={14} color={P.accentDeep} />
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.accentDeep }}>Mark this day</Text>
        </Pressable>
      </View>

      {here.length > 0 ? (
        <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
          {here.map((m, i) => (
            <Pressable key={m.id} accessibilityLabel={`${m.kind === 'achievement' ? 'Achievement' : 'Highlight'}: ${m.text || m.emoji}. Change it`} onPress={() => setEditing({ mark: m })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < here.length - 1 ? 1 : 0, borderColor: P.hairline }}>
              <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              <Text style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 14, color: m.text ? P.ink : P.ink3 }}>{m.text || 'Flag'}</Text>
              {m.kind === 'achievement' ? <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink3 }}>kept</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {offers.length > 0 ? (
        <View style={{ backgroundColor: P.accentTint, borderRadius: Radii.md, borderWidth: 1, borderColor: P.accentBorder, padding: 14, gap: 12 }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 11, color: P.accentDeep, letterSpacing: 1 }}>WORTH MARKING?</Text>
          {offers.map(c => (
            <View key={`${c.source.kind}:${c.source.id}`} style={{ gap: 6 }}>
              {/* The words get the whole line: a title you cannot read is not one you can decide on. */}
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{c.emoji}  {c.text}</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>{c.why}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable accessibilityLabel={`Keep: ${c.text}`} onPress={() => void keep(c)}
                  style={{ minHeight: 40, paddingHorizontal: 18, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent }}>
                  <Text style={{ fontFamily: UIFont.bold, fontSize: 13, color: P.accentInk }}>Keep</Text>
                </Pressable>
                <Pressable accessibilityLabel={`Not this: ${c.text}`} onPress={() => void notThis(c)}
                  style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2 }}>Not this</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {editing ? <DayMarkSheet date={date} mark={editing.mark} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}
