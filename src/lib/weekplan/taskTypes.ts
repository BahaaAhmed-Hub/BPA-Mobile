// Ported verbatim from the web app's supabase/functions/_shared/taskTypes.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── What kind of work a task is ─────────────────────────────────────────────
//
//  One definition for the app and the bots. The app's task panel shows `taskType ?? inferTaskType(title)`; the Insights screen groups by
//  that label; and the bots answering "where did my week go, by type" have to say the same words — so the classifier and the labels
//  live here, pure, and `src/types/index.ts` re-exports them.

export type TaskType = 'meeting' | 'call' | 'followup' | 'email' | 'research' | 'study' | 'deepwork' | 'do'
export const TASK_TYPES: readonly TaskType[] = ['meeting', 'call', 'followup', 'email', 'research', 'study', 'deepwork', 'do']

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  meeting: 'Meeting / Schedule', call: 'Call', followup: 'Follow-up', email: 'Email', research: 'Research', study: 'Study', deepwork: 'Deep work', do: 'Do',
}

/** Keyword-based task type classifier. Used as default when taskType is not manually set. */
export function inferTaskType(title: string): TaskType {
  const t = title.toLowerCase()
  // Meeting / Schedule — broad set of collaboration keywords
  if (/meeting|sync|standup|stand.?up|1:1|one.on.one|interview|check.?in|debrief|catch.?up|kickoff|kick.?off|appointment|review.*with|scheduled.*call|join.*call|schedule.*with|briefing|workshop|webinar|🤝|💬|📅/.test(t)) return 'meeting'
  // Call — phone / video
  if (/\bcall\b|\bcalled\b|\bcalling\b|phone|dial|zoom|teams|skype|hangout|facetime|📞/.test(t)) return 'call'
  // Follow-up
  if (/follow.?up|follow up|check back|get back to|circle back|ping/.test(t)) return 'followup'
  // Email / messaging
  if (/\bemail\b|\be-mail\b|\bmail\b|send.*to|reply|respond|draft|inbox|gmail|outlook|message|slack|✉/.test(t)) return 'email'
  // Research / analysis
  if (/research|investigate|analy[sz]e|analysis|explore|look into|benchmark|evaluate|compare|audit|assess/.test(t)) return 'research'
  // Study / learning
  if (/\bstudy\b|\blearn\b|\bread\b|reading|course|training|practice|tutorial|docs|documentation|watch.*video|📚/.test(t)) return 'study'
  // Deep work — focused making, not admin
  if (/deep work|focus block|write|writing|design|build|implement|refactor|prep(are)? for|draft the|model|plan the/.test(t)) return 'deepwork'
  return 'do'
}
