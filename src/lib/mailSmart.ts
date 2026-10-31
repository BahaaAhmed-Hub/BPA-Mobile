// The smart mail view, as the phone reads it. Ported from the web app's mailSmart.ts, mailSmartSync.ts
// (rowToThread, visibleThreads) and mailNeeds.ts (groupOf).
//
// The server's nightly pass (and the web app, when opened) reads each mailbox, tells a person from a newsletter,
// works out whether you have replied, and files every thread under a section. The phone holds no mail token and
// makes no judgement of its own: it shows what that analysis stored, by the same visibility rules, so the phone,
// the web and the assistant agree about what needs you.

export type SmartSection = 'action' | 'attention' | 'radar' | 'fyi';
export type ReplyState = 'replied' | 'pending' | 'none';
export type MailKind = 'invitation' | 'cancelled' | 'security' | 'update' | 'reply';

/** A row of `mail_smart_threads`, as the database returns it. */
export interface SmartRow {
  account_email: string;
  thread_id: string;
  last_message_id: string;
  last_at: string;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  section: SmartSection;
  reply_state: ReplyState;
  need: string | null;
  draft: string | null;
  direct: boolean;
  addressed_to: boolean;
  bottleneck: boolean;
  awaiting_customer: boolean;
  handled_at: string | null;
  kind: MailKind | null;
  muted: boolean | null;
  archived_at: string | null;
  acknowledged_at: string | null;
}

export interface SmartThread {
  accountEmail: string;
  threadId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  lastAt: number;
  section: SmartSection;
  replyState: ReplyState;
  need: string;
  draft: string;
  bottleneck: boolean;
  awaitingCustomer: boolean;
  /** Dealt with AS OF that moment: a message arriving after it is not. */
  handled: boolean;
  kind: MailKind;
  muted: boolean;
  /** When it was archived, or null. Compared against `lastAt` rather than read as a flag. */
  archivedAt: number | null;
  acknowledged: boolean;
}

export const keyOf = (t: { accountEmail: string; threadId: string }) => `${t.accountEmail}|${t.threadId}`;

export function rowToThread(r: SmartRow): SmartThread {
  return {
    accountEmail: r.account_email, threadId: r.thread_id,
    subject: r.subject ?? '(no subject)', fromName: r.from_name ?? '', fromEmail: r.from_email ?? '',
    lastAt: new Date(r.last_at).getTime(),
    section: r.section, replyState: r.reply_state,
    need: r.need ?? '', draft: r.draft ?? '',
    bottleneck: r.bottleneck, awaitingCustomer: r.awaiting_customer,
    handled: !!r.handled_at && new Date(r.handled_at).getTime() >= new Date(r.last_at).getTime(),
    kind: r.kind ?? 'reply', muted: !!r.muted,
    archivedAt: r.archived_at ? new Date(r.archived_at).getTime() : null,
    acknowledged: !!r.acknowledged_at,
  };
}

export const WINDOW_DAYS = 30;
export const windowStart = (now = Date.now()): number => now - WINDOW_DAYS * 86_400_000;

/** Newest first inside a section, with the ones you are holding up first. */
export function orderThreads(a: Pick<SmartThread, 'bottleneck' | 'lastAt'>, b: Pick<SmartThread, 'bottleneck' | 'lastAt'>): number {
  if (a.bottleneck !== b.bottleneck) return a.bottleneck ? -1 : 1;
  return b.lastAt - a.lastAt;
}

/** The threads the smart view would show. */
export function visibleThreads(all: SmartThread[], from: number): SmartThread[] {
  return all
    .filter(t => t.lastAt >= from)
    // Ignored means ignored: a new message on a muted thread does not undo the decision.
    .filter(t => !t.muted)
    // Archived, and nothing has happened since. Compared against the thread's own newest message, so a REPLY to
    // something you archived brings it back — which is what Gmail does with the thread itself.
    .filter(t => !(t.archivedAt !== null && t.archivedAt >= t.lastAt))
    .sort(orderThreads);
}

/** Which section a thread is shown under. Handled is always FYI: that is where "done" goes. */
export const groupOf = (t: SmartThread): SmartSection => (t.handled ? 'fyi' : t.section);

/** A person is actually waiting on you. */
export const waitingOnYou = (t: SmartThread): boolean => t.bottleneck && !t.handled;

export type View = 'action' | 'attention' | 'radar' | 'fyi' | 'all';
export const VIEWS: { id: View; label: string; blurb: string }[] = [
  { id: 'action', label: 'To answer', blurb: 'You owe somebody an answer, a decision or a reply.' },
  { id: 'attention', label: 'Worth knowing', blurb: 'You should know — nothing to answer.' },
  { id: 'radar', label: 'On your radar', blurb: 'Not for you yet, but worth keeping an eye on.' },
  { id: 'fyi', label: 'FYI', blurb: 'Newsletters, notices and anything you have dealt with.' },
  { id: 'all', label: 'All', blurb: 'Everything in the last 30 days.' },
];

/** A count prints even when it is 0: blank reads as "not known", a nought as "none". */
export function countsOf(threads: SmartThread[]): Record<View, number> {
  const c: Record<View, number> = { action: 0, attention: 0, radar: 0, fyi: 0, all: threads.length };
  for (const t of threads) c[groupOf(t)]++;
  return c;
}

export const inView = (threads: SmartThread[], view: View): SmartThread[] =>
  view === 'all' ? threads : threads.filter(t => groupOf(t) === view);

/** "Name" or the address, never both — the name is the part anybody reads. */
export const senderOf = (t: Pick<SmartThread, 'fromName' | 'fromEmail'>): string => t.fromName.trim() || t.fromEmail || 'Unknown sender';

export const KIND_LABEL: Record<MailKind, string | null> = {
  invitation: 'Invitation', cancelled: 'Called off', security: 'Security', update: 'Update', reply: null,
};

/** How old, in the words a mail client uses. */
export function ago(ms: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - ms) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
