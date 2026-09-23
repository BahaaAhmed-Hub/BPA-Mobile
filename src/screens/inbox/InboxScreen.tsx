import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  Modal, TextInput, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import type { DbEmailAction, DbEmailClassification } from '../../types/database';
import { UIFont, NumFont } from '../../theme/typography';

const CLASS_META: Record<DbEmailClassification, { label: string; bucketLabel: string; color: string; soft: string; icon: string }> = {
  decision: { label: 'Decision', bucketLabel: 'Needs you', color: C.red,    soft: 'rgba(178,58,54,0.10)', icon: '⚡' },
  delegate: { label: 'Delegate', bucketLabel: 'Needs you', color: C.green,  soft: C.greenSoft,            icon: '🤝' },
  waiting:  { label: 'Waiting',  bucketLabel: 'Worth knowing', color: C.orange, soft: C.orangeSoft,       icon: '⏳' },
  fyi:      { label: 'FYI',      bucketLabel: 'FYI',       color: C.slate,  soft: '#EEF1F6',              icon: '👁' },
};

type Bucket = 'all' | 'needs_you' | 'worth_knowing' | 'fyi';
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'all',           label: 'All mail' },
  { id: 'needs_you',     label: 'Needs you' },
  { id: 'worth_knowing', label: 'Worth knowing' },
  { id: 'fyi',           label: 'FYI' },
];

function bucketOf(a: DbEmailAction): Bucket {
  const k = a.classification ?? 'fyi';
  if (k === 'decision' || k === 'delegate') return 'needs_you';
  if (k === 'waiting') return 'worth_knowing';
  return 'fyi';
}

function isNewsletter(a: DbEmailAction): boolean {
  const sub = (a.subject ?? '').toLowerCase();
  const from = (a.from_email ?? '').toLowerCase();
  return sub.includes('newsletter') || sub.includes('morning brew') || from.includes('noreply') || from.includes('no-reply');
}

function isInvitation(a: DbEmailAction): boolean {
  const sub = (a.subject ?? '').toLowerCase();
  return sub.includes('invitation') || sub.includes('invite') || sub.includes('1:1');
}

// ── Thread sheet ──────────────────────────────────────────────────────────────
function ThreadSheet({ email, onClose, onHandle }: {
  email: DbEmailAction;
  onClose: () => void;
  onHandle: () => void;
}) {
  const P = useScreenPalette();
  const k = email.classification ?? 'fyi';
  const meta = CLASS_META[k];
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // Simulate sample thread messages
  const senderName = email.from_email?.split('@')[0]?.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') ?? 'Sender';

  return (
    <View style={{ backgroundColor: P.surface, borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg, paddingBottom: 36 }}>
      {/* Handle */}
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.hairline }} />
      </View>

      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
        {/* Thread header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill,
              backgroundColor: meta.soft,
            }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: meta.color, letterSpacing: 0.8 }}>
                {meta.label.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 19, color: P.ink, letterSpacing: -0.4, lineHeight: 24 }}>
            {email.subject ?? '(no subject)'}
          </Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>
            {senderName} · {email.from_email}
          </Text>
        </View>

        {/* THE SHORT VERSION */}
        {email.suggested_reply ? (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <View style={{
              backgroundColor: '#1F1A14', borderRadius: Radii.md, padding: 16,
            }}>
              <Text style={{
                fontFamily: UIFont.semiBold, fontSize: 11,
                color: 'rgba(253,248,231,0.5)', letterSpacing: 1.6, textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                The short version
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: '#FDF8E7', lineHeight: 20 }}>
                {email.suggested_reply}
              </Text>
            </View>
          </View>
        ) : null}

        {/* WHAT IT ASKS OF YOU */}
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={{
            fontFamily: UIFont.semiBold, fontSize: 11,
            color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8,
          }}>
            What it asks of you
          </Text>
          <View style={{
            backgroundColor: P.field, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.hairline, gap: 0, overflow: 'hidden',
          }}>
            {[
              { icon: meta.icon, label: meta.label, action: k === 'decision' ? 'Make a decision' : k === 'delegate' ? 'Delegate to someone' : 'Review and file' },
              { icon: '✉️', label: 'Reply', action: 'Draft a reply below' },
            ].map((row, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: i < 1 ? 1 : 0, borderColor: P.hairline,
              }}>
                <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{row.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>{row.label}</Text>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 1 }}>{row.action}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* THE THREAD */}
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={{
            fontFamily: UIFont.semiBold, fontSize: 11,
            color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8,
          }}>
            The thread
          </Text>
          <View style={{ gap: 10 }}>
            {/* Sample sender message */}
            <View style={{
              backgroundColor: P.field, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline, padding: 14,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>{senderName}</Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3 }}>6h ago</Text>
              </View>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, lineHeight: 19 }}>
                {email.subject ? `Regarding "${email.subject}" — please review and let me know your thoughts.` : 'Message content would appear here.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Reply compose */}
        {replying ? (
          <View style={{ marginHorizontal: 20, marginBottom: 8, gap: 8 }}>
            <Text style={{
              fontFamily: UIFont.semiBold, fontSize: 11,
              color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
            }}>
              Your reply
            </Text>
            <TextInput
              autoFocus
              multiline
              value={replyText}
              onChangeText={setReplyText}
              placeholder={email.suggested_reply ? `${email.suggested_reply.slice(0, 60)}…` : 'Type your reply…'}
              placeholderTextColor={P.ink3}
              style={{
                backgroundColor: P.field, borderRadius: Radii.md,
                borderWidth: 1, borderColor: P.hairline,
                padding: 14, fontFamily: UIFont.regular, fontSize: 14,
                color: P.ink, minHeight: 80, textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setReplying(false)} style={{ flex: 1, paddingVertical: 11, borderRadius: Radii.sm, borderWidth: 1, borderColor: P.hairline, alignItems: 'center' }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink2 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { setReplying(false); onHandle(); onClose(); }}
                style={({ pressed }) => ({
                  flex: 2, backgroundColor: pressed ? P.accentDeep : P.accent,
                  paddingVertical: 11, borderRadius: Radii.sm,
                  borderWidth: 1, borderColor: P.accentBorder, alignItems: 'center',
                })}
              >
                <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.accentInk }}>Send reply</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ marginHorizontal: 20, marginBottom: 8, flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setReplying(true)}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: pressed ? P.accentTint : P.surface,
                paddingVertical: 12, borderRadius: Radii.sm,
                borderWidth: 1, borderColor: P.hairline, alignItems: 'center',
              })}
            >
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>✉️ Reply</Text>
            </Pressable>
            <Pressable
              onPress={() => { onHandle(); onClose(); }}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: pressed ? P.accentDeep : P.accent,
                paddingVertical: 12, borderRadius: Radii.sm,
                borderWidth: 1, borderColor: P.accentBorder, alignItems: 'center',
              })}
            >
              <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.accentInk }}>Mark done ✓</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Newsletter sheet ──────────────────────────────────────────────────────────
function NewsletterSheet({ email, onClose }: { email: DbEmailAction; onClose: () => void }) {
  const P = useScreenPalette();
  const senderName = email.from_email?.split('@')[0]?.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') ?? 'Newsletter';

  return (
    <View style={{ backgroundColor: P.surface, borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg, paddingBottom: 36 }}>
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.hairline }} />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <Text style={{
          fontFamily: UIFont.semiBold, fontSize: 11,
          color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
        }}>
          Newsletter
        </Text>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3, lineHeight: 26 }}>
          {email.subject ?? senderName}
        </Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, lineHeight: 19 }}>
          {email.suggested_reply ?? 'Read the full newsletter for highlights, charts, and analysis.'}
        </Text>

        {/* Why this is here */}
        <View style={{ backgroundColor: P.field, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 14 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>
            Why this is here
          </Text>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, lineHeight: 18 }}>
            It carries a List-Unsubscribe header and the sender is a campaign address — so it is a newsletter, not a receipt.
          </Text>
        </View>

        {/* Actions */}
        <View style={{ gap: 8, paddingBottom: 8 }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: pressed ? P.field : P.surface,
              borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.md,
              paddingVertical: 12, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            })}
          >
            <Text style={{ fontSize: 16 }}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
                Archive every {senderName.split(' ')[0]} from now on
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 11, color: P.ink3, marginTop: 1 }}>
                Keeps arriving, stops showing up here
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: pressed ? P.negativeTint : P.surface,
              borderWidth: 1, borderColor: P.hairline, borderRadius: Radii.md,
              paddingVertical: 12, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            })}
          >
            <Text style={{ fontSize: 16 }}>🚫</Text>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.negative }}>Unsubscribe</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink3 }}>Just archive</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Invitation sheet ──────────────────────────────────────────────────────────
function InvitationSheet({ email, onClose }: { email: DbEmailAction; onClose: () => void }) {
  const P = useScreenPalette();
  const [response, setResponse] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const senderName = email.from_email?.split('@')[0]?.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') ?? 'Organiser';

  return (
    <View style={{ backgroundColor: P.surface, borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg, paddingBottom: 36 }}>
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.hairline }} />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <Text style={{
          fontFamily: UIFont.semiBold, fontSize: 11,
          color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
        }}>
          Invitation
        </Text>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
            {email.subject?.replace(/^(invitation|invite):\s*/i, '') ?? senderName}
          </Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>
            {email.follow_up_date ? `📅 ${email.follow_up_date}` : 'Date not specified'} · {senderName}
          </Text>
        </View>

        {/* RSVP row */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['yes', 'maybe', 'no'] as const).map(opt => {
            const active = response === opt;
            const color = opt === 'yes' ? P.positive : opt === 'maybe' ? C.orange : P.negative;
            return (
              <Pressable key={opt} onPress={() => setResponse(opt)} style={{ flex: 1 }}>
                <View style={{
                  paddingVertical: 11, borderRadius: Radii.md,
                  borderWidth: 1,
                  borderColor: active ? color : P.hairline,
                  backgroundColor: active ? `${color}18` : P.field,
                  alignItems: 'center',
                }}>
                  <Text style={{
                    fontFamily: UIFont.semiBold, fontSize: 14,
                    color: active ? color : P.ink2, textTransform: 'capitalize',
                  }}>
                    {opt}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Note */}
        <View style={{ padding: 12, backgroundColor: P.field, borderRadius: Radii.sm, borderWidth: 1, borderColor: P.hairline }}>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, lineHeight: 17 }}>
            ✦ An invitation is answered by responding, never by writing back — so there is no reply box here.
          </Text>
        </View>

        {/* Confirm */}
        <Pressable
          onPress={onClose}
          disabled={!response}
          style={({ pressed }) => ({
            backgroundColor: response ? (pressed ? P.accentDeep : P.accent) : P.field,
            borderRadius: Radii.md, paddingVertical: 14,
            borderWidth: 1, borderColor: response ? P.accentBorder : P.hairline,
            alignItems: 'center',
          })}
        >
          <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: response ? P.accentInk : P.ink3 }}>
            {response ? `Respond — ${response}` : 'Select a response'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function InboxScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  const actions  = useEmailActionsStore(s => s.actions);
  const load     = useEmailActionsStore(s => s.loadFromDB);
  const loading  = useEmailActionsStore(s => s.loading);
  const setStat  = useEmailActionsStore(s => s.setStatus);

  const [bucket, setBucket] = useState<Bucket>('all');
  const [previewing, setPreviewing] = useState<DbEmailAction | null>(null);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => bucket === 'all'
      ? actions
      : actions.filter(a => bucketOf(a) === bucket),
    [actions, bucket],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: actions.length };
    for (const a of actions) {
      const b = bucketOf(a);
      c[b] = (c[b] ?? 0) + 1;
    }
    return c;
  }, [actions]);

  function renderSheet(email: DbEmailAction) {
    if (isInvitation(email)) return <InvitationSheet email={email} onClose={() => setPreviewing(null)} />;
    if (isNewsletter(email))  return <NewsletterSheet email={email} onClose={() => setPreviewing(null)} />;
    return (
      <ThreadSheet
        email={email}
        onClose={() => setPreviewing(null)}
        onHandle={() => void setStat(email.id, 'handled')}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
        }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 18, color: P.ink, letterSpacing: -0.3 }}>Inbox</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 1 }}>
            {actions.length === 0 ? 'No items yet' : `${counts['needs_you'] ?? 0} want an answer · ${actions.length} in`}
          </Text>
        </View>
      </View>

      {/* Bucket filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}
      >
        {BUCKETS.map(b => {
          const active = bucket === b.id;
          const count = counts[b.id] ?? (b.id === 'all' ? actions.length : 0);
          return (
            <Pressable key={b.id} onPress={() => setBucket(b.id)}>
              <View style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill,
                backgroundColor: active ? P.accent : P.surface,
                borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? P.accentInk : P.ink }}>
                  {b.label}
                </Text>
                {count > 0 && (
                  <View style={{
                    paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.pill,
                    backgroundColor: active ? 'rgba(0,0,0,0.12)' : P.field,
                  }}>
                    <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: active ? P.accentInk : P.ink3 }}>
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
      >
        {filtered.length === 0 ? (
          <View style={{
            backgroundColor: P.surface, borderRadius: Radii.md,
            padding: 18, borderWidth: 1, borderColor: P.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>
              {bucket === 'needs_you' ? 'Nothing needs you right now' : bucket === 'worth_knowing' ? 'Nothing to read right now' : 'Quiet inbox'}
            </Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 4 }}>
              {actions.length === 0
                ? 'Once Gmail triage is wired, classified emails will land here. Populate email_actions in Supabase to see entries.'
                : 'No items match this filter.'}
            </Text>
          </View>
        ) : (
          filtered.map(a => (
            <ActionRow
              key={a.id}
              action={a}
              onPreview={() => setPreviewing(a)}
              onMark={s => void setStat(a.id, s)}
            />
          ))
        )}
      </ScrollView>

      {/* Thread / Newsletter / Invitation sheet */}
      <Modal visible={!!previewing} animationType="slide" transparent onRequestClose={() => setPreviewing(null)}>
        <TouchableWithoutFeedback onPress={() => setPreviewing(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,18,32,0.55)' }}>
            <TouchableWithoutFeedback>
              <View>{previewing ? renderSheet(previewing) : null}</View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

function ActionRow({
  action, onPreview, onMark,
}: {
  action: DbEmailAction;
  onPreview: () => void;
  onMark: (s: string | null) => void;
}) {
  const P = useScreenPalette();
  const k = action.classification ?? 'fyi';
  const meta = CLASS_META[k];
  const done = action.status === 'handled';

  // Badge label
  const badgeLabel = isInvitation(action)
    ? 'INVITATION'
    : isNewsletter(action)
    ? 'NEWSLETTER'
    : meta.bucketLabel.toUpperCase();
  const badgeSoft = isInvitation(action) ? 'rgba(100,130,220,0.12)'
    : isNewsletter(action) ? '#EEF1F6'
    : meta.soft;
  const badgeColor = isInvitation(action) ? C.blue
    : isNewsletter(action) ? C.slate
    : meta.color;

  return (
    <Pressable onPress={onPreview}>
      <View style={{
        backgroundColor: P.surface, borderRadius: Radii.md, padding: 14,
        borderWidth: 1, borderColor: P.hairline,
        position: 'relative', overflow: 'hidden',
        ...Shadows.card,
        opacity: done ? 0.55 : 1,
      }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: meta.color }} />
        <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 6 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: meta.soft, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 14, color: meta.color }}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.ink, letterSpacing: -0.2 }} numberOfLines={1}>
              {action.subject ?? '(no subject)'}
            </Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, marginTop: 3 }} numberOfLines={1}>
              {action.from_email ?? 'unknown sender'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill, backgroundColor: badgeSoft }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: badgeColor, letterSpacing: 0.4 }}>
                  {badgeLabel}
                </Text>
              </View>
              {action.follow_up_date ? (
                <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: P.ink3 }}>
                  ⏱ {action.follow_up_date}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => onMark(done ? null : 'handled')} hitSlop={8}>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              borderWidth: 2, borderColor: done ? P.positive : P.hairline,
              backgroundColor: done ? P.positive : 'transparent',
              alignItems: 'center', justifyContent: 'center', marginTop: 4,
            }}>
              {done ? <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 12, lineHeight: 12 }}>✓</Text> : null}
            </View>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
