// The facts "Worth marking?" is built from, gathered from the phone's own data. The rules are the shared dayCandidates.ts;
// this only turns the phone's rows into the facts it takes. A module that is off offers nothing from it.
import type { CandidateFacts } from './dayCandidates';
import type { DbHabit, DbHabitLog, DbTask } from '../../types/database';
import type { Book } from '../library';

/** A timestamp as the reader's own calendar day, which is what "finished that day" means. */
export const localDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-CA') : null;
};

export function candidateFacts(date: string, src: {
  tasks: DbTask[]; habits: DbHabit[]; logsByHabit: Record<string, DbHabitLog[]>; books: Book[];
  tasksOff?: boolean; habitsOff?: boolean; libraryOff?: boolean;
}): CandidateFacts {
  return {
    date,
    tasks: src.tasksOff ? [] : src.tasks
      .filter(t => t.completed || t.status === 'done')
      .map(t => ({ id: t.id, title: t.title, completedAt: localDay(t.completed_at), priority: t.priority ?? null })),
    habits: src.habitsOff ? [] : src.habits.map(h => ({
      id: h.id, name: h.name, frequency: h.frequency, active: h.is_active !== false,
      // Every day the habit was FINISHED (a tick, or a goal met): the store records `completed` only when it was.
      doneOn: (src.logsByHabit[h.id] ?? []).filter(l => l.completed).map(l => l.date),
    })),
    books: src.libraryOff ? [] : src.books.map(b => ({ id: b.id, title: b.title, finishedOn: b.status === 'finished' ? (b.finished_on ?? null) : null })),
  };
}
