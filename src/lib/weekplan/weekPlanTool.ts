// Ported verbatim from the web app's supabase/functions/_shared/weekPlanTool.ts at BPA@c6b42ed.
// The web shares this file between the app and its bots (Telegram, Siri) so every door plans the same week;
// the phone does the same. Change it on the web first, then re-copy: do not edit here.
// ─── The week planner, as a tool the assistant, Telegram and Siri all have ───
//
// Two tools: `plan_week` reads and proposes (it writes NOTHING), `commit_week_plan` puts chosen blocks on the
// calendar and always asks first. The definitions and the words live here once; each door runs them in its own world
// (`src/lib/weekPlanTool.ts` for the app, `weekPlanKit.ts` for the bots) through the same `planFromData`.

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object' as const, properties, required })

/** Things to fit in that are not tasks. The same argument on both tools: a plan is for exactly the activities it was made with. */
const ACTIVITIES = {
  type: 'array',
  description: 'Things to fit in that are not tasks, e.g. gym three times a week, study two hours daily. Pass the SAME list again to commit_week_plan.',
  items: obj({
    title: { type: 'string' },
    minutes: { type: 'number', description: 'Per session, 5–480. Default 60.' },
    times_per_week: { type: 'number', description: '1–7, on different days.' },
    daily: { type: 'boolean', description: 'Once on each day they plan on.' },
    days: { type: 'array', items: { type: 'string' }, description: 'Only these days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.' },
    time_of_day: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
  }, ['title']),
}

/** Tasks the planner would leave out (brain dump, delegated, due later…) that the user asked to have planned anyway. */
const INCLUDE = {
  type: 'array',
  description: 'Titles of open tasks to plan even though the planner would leave them out (still in the brain dump, delegated, due after next week…). Use after the user says "plan X too". Pass the SAME list again to commit_week_plan.',
  items: { type: 'string' },
}

export const WEEK_TOOLS = [
  {
    name: 'plan_week',
    description: 'Propose a week of time blocks: where the user\'s open tasks, Ideal Week and weekly goals could go, inside their working hours, around their calendar, their Ideal Week and their prayer times, with the reason for each. It writes NOTHING. Use it for "plan my week / next week" and "when could I fit X in". Say the plan back in your own words, by day, and ask which blocks to add.',
    input_schema: obj({ week: { type: 'string', enum: ['this', 'next'], description: 'Which week. Default next.' }, activities: ACTIVITIES, include_tasks: INCLUDE }),
  },
  {
    name: 'commit_week_plan',
    description: 'Put blocks from a plan_week plan on the user\'s own calendar (nobody is invited). The user is asked to approve it. Only call it after the user has seen the plan and said what to add. Pass: week; plan_hash exactly as plan_week gave it; blocks — the label of each block you are adding, copied exactly from the start of its line in the plan, in the plan\'s order; and ids (the [id …] values) ONLY if adding some of the blocks rather than all.',
    input_schema: obj({
      week: { type: 'string', enum: ['this', 'next'] },
      plan_hash: { type: 'string' },
      blocks: { type: 'array', items: { type: 'string' }, description: 'The label of each block, exactly as in the plan.' },
      ids: { type: 'array', items: { type: 'string' }, description: 'Only to add some blocks: their [id …] values.' },
      activities: ACTIVITIES,
      include_tasks: INCLUDE,
    }, ['week', 'plan_hash', 'blocks']),
  },
]
export const WEEK_NAMES = new Set(WEEK_TOOLS.map(t => t.name))

/** What each prompt says about planning a week. */
export const WEEK_RULES = `
PLANNING A WEEK:
- "Plan my week / next week", "when can I fit X" → call plan_week and say the plan back: by day, the times, what each block is and why in a few words. plan_week writes NOTHING — never say anything is on the calendar after it.
- Only when the user says to add some or all of it, call commit_week_plan with the plan_hash from the plan and, in blocks, the label of each block copied exactly from the start of its line. The user is asked to approve; then do not say it is done — say you have asked for their OK. If it says NOT DONE (the week changed, or the list did not match), call plan_week again and show the new plan.
- Things that are not tasks ("gym three times a week", "study two hours a day") go in plan_week's activities. Pass the SAME activities to commit_week_plan, or it will not match the plan.
- plan_week lists, by name, the tasks it left out and why (brain dump, delegated, due later…). If the user wants one planned anyway, pass its title in include_tasks — on commit_week_plan too.
- A block marked as squeezed into the gap around a meeting has no other room; say so rather than hiding it.
- If plan_week says it could not read the calendar, say so and do not guess at a plan. Say which times are in which time zone when it names one.`
