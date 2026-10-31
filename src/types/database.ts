// Mirrors the web app (BPA repo) src/types/database.ts.
// Source of truth: supabase/migrations/20240001_initial_schema.sql.
// Keep in sync when migrations change.

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  active_framework: string;
  schedule_rules: Record<string, unknown>;
  created_at: string;
}

export interface DbCompany {
  id: string;
  user_id: string;
  name: string;
  color_tag: string | null;
  calendar_id: string | null;
  is_active: boolean;
}

export type DbQuadrant =
  | 'urgent_important'
  | 'important_not_urgent'
  | 'urgent_not_important'
  | 'neither';

export type DbTaskStatus = 'todo' | 'in_progress' | 'done' | 'deferred';

export interface DbTask {
  id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  quadrant: DbQuadrant | null;
  effort_minutes: number | null;
  due_date: string | null;
  status: DbTaskStatus;
  delegated_to: string | null;
  done_looks_like: string | null;
  created_at: string;
  completed_at: string | null;
  /** Added by web migration 20240002; the web app reads this before `status`. */
  completed?: boolean;
  // Columns the web app has added since the initial schema (migrations
  // 20240002, 20260003, 20260042). Optional because a database that has not
  // run them returns none of these; the mobile app only reads them for now.
  planned_time?: string | null;
  owner_id?: string | null;
  company_tag?: string | null;
  task_type?: string | null;
  priority?: string | null;
  board_status?: string | null;
  calendar_id?: string | null;
  gcal_event_id?: string | null;
  parent_task_id?: string | null;
  captured_via?: 'voice' | 'mail' | 'manual' | null;
  urgent?: boolean;
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; size: number; source?: string; addedAt: string }[];
  links?: string[];
  project_id?: string | null;
  milestone_id?: string | null;
}

export type DbHabitFrequency = 'daily' | 'weekdays' | 'weekly';

export interface DbHabit {
  id: string;
  user_id: string;
  name: string;
  frequency: DbHabitFrequency;
  current_streak: number;
  longest_streak: number;
  is_active: boolean;
  // Columns the web app adds to a habit; absent on a database that has not run them.
  emoji?: string | null;
  color?: string | null;
  type?: string | null;
  goal?: number | null;
  unit?: string | null;
  image?: string | null;
}

export interface DbHabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
}

export interface DbEnergyLog {
  id: string;
  user_id: string;
  date: string;
  morning_level: number | null;
  afternoon_level: number | null;
  notes: string | null;
}

export interface DbCalendarEvent {
  id: string;
  user_id: string;
  company_id: string | null;
  /** Which Google calendar the event lives on, kept so an edit can be written back to it. */
  calendar_id?: string | null;
  /** The Google account the event belongs to; the write function needs one. */
  account_email?: string | null;
  account_id?: string | null;
  google_event_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_type: string | null;
  prep_notes: string | null;
  is_synced: boolean;
}

export type DbEmailClassification = 'decision' | 'fyi' | 'waiting' | 'delegate';

export interface DbEmailAction {
  id: string;
  user_id: string;
  gmail_id: string | null;
  subject: string | null;
  from_email: string | null;
  classification: DbEmailClassification | null;
  suggested_reply: string | null;
  status: string | null;
  follow_up_date: string | null;
}

export interface DbWeeklyReview {
  id: string;
  user_id: string;
  week_of: string;
  shipped_count: number | null;
  slipped_count: number | null;
  focus_hours: number | null;
  meeting_hours: number | null;
  professor_insight: string | null;
  created_at: string;
}

// ── Projects (web migration 20260042) ───────────────────────────────────────
// A goal with an end that gathers tasks and other items. A task carries its
// project on its own row (`tasks.project_id`); a milestone is a dated phase.

export type DbProjectStatus = 'idea' | 'active' | 'paused' | 'done';

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  kind: 'work' | 'personal';
  color: string | null;
  status: DbProjectStatus;
  company_id: string | null;
  start_date: string | null;
  target_date: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMilestone {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  sort_order: number;
}
