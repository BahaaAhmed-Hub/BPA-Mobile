import type { DbMilestone, DbProject, DbProjectStatus, DbTask } from '../types/database';
import { isOpenTask, hasTitle } from './tasks';

export const STATUS_LABEL: Record<DbProjectStatus, string> = { idea: 'Idea', active: 'Active', paused: 'Paused', done: 'Done' };

/** The web stores a colour as text that can be a CSS variable, which a phone cannot draw. */
export const drawableColor = (c: string | null | undefined, fallback: string): string =>
  c && !c.startsWith('var(') ? c : fallback;

/** A task belongs to a project only if that project still exists — the database has no foreign key (tasks are
 *  pushed in batches, so a task can reach the server before its project), so a task whose project is gone
 *  reads as unassigned. */
export const tasksOf = (project: Pick<DbProject, 'id'>, tasks: DbTask[]): DbTask[] =>
  tasks.filter(t => t.project_id === project.id && hasTitle(t));

export interface Progress {
  tasksOpen: number;
  tasksDone: number;
  tasksTotal: number;
  milestonesDone: number;
  milestonesTotal: number;
  /** The nearest milestone not yet done that has a date. */
  nextMilestone: DbMilestone | null;
  /** 0..1 of tasks finished, or null when the project has none yet. */
  taskRatio: number | null;
  /** Whole days until the target date (negative once passed), or null with no target. */
  daysLeft: number | null;
}

export function progressOf(project: DbProject, tasks: DbTask[], milestones: DbMilestone[], today: string): Progress {
  const mine = tasksOf(project, tasks);
  const done = mine.filter(t => !isOpenTask(t) && t.status !== 'deferred').length;
  const dropped = mine.filter(t => t.status === 'deferred').length;
  const total = mine.length - dropped; // a task given up on is not part of the work
  const ms = milestones.filter(m => m.project_id === project.id);
  const next = ms.filter(m => !m.done && m.due_date).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0] ?? null;
  const days = project.target_date
    ? Math.round((Date.parse(`${project.target_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    : null;
  return {
    tasksOpen: total - done,
    tasksDone: done,
    tasksTotal: total,
    milestonesDone: ms.filter(m => m.done).length,
    milestonesTotal: ms.length,
    nextMilestone: next,
    taskRatio: total > 0 ? done / total : null,
    daysLeft: days,
  };
}
