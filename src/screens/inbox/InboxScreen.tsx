import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import type { DbEmailAction, DbEmailClassification } from '../../types/database';

const CLASS_META: Record<DbEmailClassification, { label: string; color: string; soft: string; icon: string }> = {
  decision: { label: 'Decision', color: C.red,    soft: 'rgba(178,58,54,0.10)', icon: '⚡' },
  delegate: { label: 'Delegate', color: C.green,  soft: C.greenSoft,            icon: '🤝' },
  waiting:  { label: 'Waiting',  color: C.orange, soft: C.orangeSoft,           icon: '⏳' },
  fyi:      { label: 'FYI',      color: C.slate,  soft: '#EEF1F6',              icon: '👁' },
};

const FILTER_ORDER: Array<DbEmailClassification | 'all'> = ['all', 'decision', 'delegate', 'waiting', 'fyi'];

export function InboxScreen() {
  const navigation = useNavigation();
  const actions  = useEmailActionsStore(s => s.actions);
  const load     = useEmailActionsStore(s => s.loadFromDB);
  const loading  = useEmailActionsStore(s => s.loading);
  const setStat  = useEmailActionsStore(s => s.setStatus);

  const [filter, setFilter] = useState<DbEmailClassification | 'all'>('all');
  const [previewing, setPreviewing] = useState<DbEmailAction | null>(null);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => filter === 'all'
      ? actions
      : actions.filter(a => a.classification === filter),
    [actions, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: actions.length };
    for (const a of actions) {
      const k = a.classification ?? 'fyi';
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [actions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline,
        }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: C.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: C.ink, letterSpacing: -0.3 }}>Inbox</Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: C.ink3, marginTop: 1 }}>
            {actions.length === 0 ? 'No items yet' : `${actions.length} action${actions.length === 1 ? '' : 's'} triaged`}
          </Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}
      >
        {FILTER_ORDER.map(f => {
          const active = filter === f;
          const meta = f === 'all' ? null : CLASS_META[f];
          const label = f === 'all' ? 'All' : meta!.label;
          const color = meta?.color ?? C.ink;
          const count = counts[f] ?? 0;
          return (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill,
                backgroundColor: active ? color : C.card,
                borderWidth: active ? 0 : 1, borderColor: C.hairline,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? '#fff' : color }}>{label}</Text>
                <View style={{
                  paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.pill,
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#fff',
                }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: active ? '#fff' : color }}>
                    {count}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={C.indigo} />}
      >
        {filtered.length === 0 ? (
          <View style={{
            backgroundColor: C.card, borderRadius: Radii.md,
            padding: 18, borderWidth: 1, borderColor: C.hairline,
            ...Shadows.card,
          }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.ink }}>Quiet inbox</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, marginTop: 4 }}>
              {actions.length === 0
                ? 'Once Gmail triage is wired, classified emails will land here for review. For now this reads from email_actions in Supabase — populate it from the web app or seed manually to see entries.'
                : 'No items match this filter.'}
            </Text>
          </View>
        ) : (
          filtered.map(a => <ActionRow key={a.id} action={a} onPreview={() => setPreviewing(a)} onMark={s => void setStat(a.id, s)} />)
        )}
      </ScrollView>

      {/* Suggested reply preview */}
      <Modal visible={!!previewing} animationType="slide" transparent onRequestClose={() => setPreviewing(null)}>
        <Pressable onPress={() => setPreviewing(null)} style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.55)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: C.card, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.hairline }} />
              </View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: C.ink }} numberOfLines={2}>
                {previewing?.subject ?? '(no subject)'}
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: C.ink3 }} numberOfLines={1}>
                From {previewing?.from_email ?? 'unknown sender'}
              </Text>
              <View style={{
                backgroundColor: C.bg, borderRadius: Radii.sm, padding: 14,
                borderWidth: 1, borderColor: C.hairline,
              }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>
                  SUGGESTED REPLY
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: C.ink, marginTop: 8, lineHeight: 20 }}>
                  {previewing?.suggested_reply ?? '— No suggestion generated. Generate one from the web app or wait for the next AI triage pass.'}
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
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
  const k = action.classification ?? 'fyi';
  const meta = CLASS_META[k];
  const done = action.status === 'handled';
  return (
    <Pressable onPress={onPreview}>
      <View style={{
        backgroundColor: C.card, borderRadius: Radii.md, padding: 14,
        borderWidth: 1, borderColor: C.hairline,
        position: 'relative', overflow: 'hidden',
        ...Shadows.card,
        opacity: done ? 0.55 : 1,
      }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: meta.color }} />
        <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 6 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: meta.soft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 14, color: meta.color }}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>
              {action.subject ?? '(no subject)'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink2, marginTop: 3 }} numberOfLines={1}>
              {action.from_email ?? 'unknown sender'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill,
                backgroundColor: meta.soft,
              }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: meta.color, letterSpacing: 0.4 }}>
                  {meta.label.toUpperCase()}
                </Text>
              </View>
              {action.follow_up_date ? (
                <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: C.ink3 }}>
                  ⏱ {action.follow_up_date}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => onMark(done ? null : 'handled')} hitSlop={8}>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              borderWidth: 2, borderColor: done ? C.green : C.hairline,
              backgroundColor: done ? C.green : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginTop: 4,
            }}>
              {done ? <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 12 }}>✓</Text> : null}
            </View>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
