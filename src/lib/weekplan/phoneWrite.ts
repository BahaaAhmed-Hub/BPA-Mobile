// The phone's real writing for Plan week: Supabase rows and the google-calendar-write function. See write.ts for the rules.
import { supabase } from '../supabase';
import { createGoogleEvent, deleteGoogleEvent } from '../googleCalendar';
import { phoneDeps } from './phoneDeps';
import type { Company, WritableTask, WriteDeps } from './write';

const TASK_COLS = 'id, title, description, priority, due_date, calendar_id, company_id, company_tag, gcal_event_id, completed, status';

export const phoneWriteDeps: WriteDeps = {
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

  async readTask(id) {
    // `slots` is an optional column (an older project has none): ask without it rather than call a task gone.
    let r = await supabase.from('tasks').select(`${TASK_COLS}, slots`).eq('id', id).maybeSingle();
    if (r.error && /\bslots\b/.test(r.error.message)) r = await supabase.from('tasks').select(TASK_COLS).eq('id', id).maybeSingle() as typeof r;
    if (r.error) return { row: null, error: r.error.message };
    return { row: (r.data ?? null) as unknown as WritableTask | null, error: null };
  },

  async companies() {
    const r = await supabase.from('companies').select('id, name, calendar_id, account_id');
    return r.error ? null : ((r.data ?? []) as Company[]);
  },

  calendars: () => phoneDeps.calendars().then(c => ({ calendars: c.calendars.map(x => ({ id: x.id, primary: x.primary, accessRole: x.accessRole, accountEmail: x.accountEmail })), failed: c.failed })),

  async createEvent(cal, body) {
    const r = await createGoogleEvent(cal.id, body as never, { email: cal.accountEmail });
    return r.ok && r.id ? { id: r.id } : { error: r.error ?? 'Google refused it.' };
  },

  async deleteEvent(calendarId, accountEmail, eventId) {
    const r = await deleteGoogleEvent(eventId, calendarId, { email: accountEmail });
    return r.ok ? { ok: true } : { error: r.error ?? 'Google would not remove it.' };
  },

  async updateTask(id, patch) {
    let r = await supabase.from('tasks').update(patch).eq('id', id);
    // An older project without the slots column: the first block is still just gcal_event_id.
    if (r.error && /\bslots\b/.test(r.error.message) && (patch.slots?.length ?? 0) <= 1) r = await supabase.from('tasks').update({ gcal_event_id: patch.gcal_event_id }).eq('id', id);
    return { error: r.error ? r.error.message : null };
  },
};
