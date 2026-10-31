import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { useMailStore } from '../../store/mailStore';
import {
  ago, countsOf, groupOf, inView, keyOf, KIND_LABEL, senderOf, VIEWS, waitingOnYou, type SmartThread, type View as MailView,
} from '../../lib/mailSmart';

export function InboxScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  const { threads, loading, loaded, unavailable, loadFromDB, setHandled, mute } = useMailStore();
  const [view, setView] = useState<MailView | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmIgnore, setConfirmIgnore] = useState(false);

  useEffect(() => { void loadFromDB(); }, [loadFromDB]);

  const counts = useMemo(() => countsOf(threads), [threads]);
  // Open on what is waiting for an answer, or on everything when nothing is.
  const active: MailView = view ?? (counts.action > 0 ? 'action' : 'all');
  const shown = useMemo(() => inView(threads, active), [threads, active]);
  const waiting = threads.filter(waitingOnYou).length;
  const selected = open ? threads.find(t => keyOf(t) === open) ?? null : null;
  const blurb = VIEWS.find(v => v.id === active)?.blurb;

  function close() { setOpen(null); setConfirmIgnore(false); }

  function Chip({ children, tone = 'plain' }: { children: string; tone?: 'plain' | 'urgent' }) {
    return (
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill, backgroundColor: tone === 'urgent' ? P.negativeTint : P.field, borderWidth: 1, borderColor: tone === 'urgent' ? P.negative : P.hairline }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: tone === 'urgent' ? P.negative : P.ink2 }}>{children}</Text>
      </View>
    );
  }

  function chipsFor(t: SmartThread) {
    const out: { label: string; tone?: 'urgent' }[] = [];
    if (waitingOnYou(t)) out.push({ label: 'Waiting on you', tone: 'urgent' });
    if (KIND_LABEL[t.kind]) out.push({ label: KIND_LABEL[t.kind]! });
    if (t.replyState === 'replied') out.push({ label: 'You replied' });
    if (t.replyState === 'pending') out.push({ label: 'They replied again' });
    if (t.awaitingCustomer) out.push({ label: 'Waiting on them' });
    if (t.handled) out.push({ label: 'Handled' });
    return out;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
          <ChevronLeft size={22} color={P.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.4 }}>Mail</Text>
          <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>
            {waiting > 0 ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting on you` : 'Read from the web app’s analysis · last 30 days'}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
        {VIEWS.map(v => {
          const on = active === v.id;
          return (
            <Pressable key={v.id} onPress={() => setView(v.id)} accessibilityState={{ selected: on }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: on ? P.accent : P.surface, borderWidth: 1, borderColor: on ? P.accentBorder : P.hairline }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: on ? P.accentInk : P.ink2 }}>{v.label} · {counts[v.id]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {blurb ? <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, paddingHorizontal: 18, paddingBottom: 8 }}>{blurb}</Text> : null}

      {!loaded && loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.ink3} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={t => keyOf(t)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 8, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadFromDB()} tintColor={P.accent} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>
                {unavailable ? 'Smart mail is not set up yet' : threads.length === 0 ? 'Nothing read yet' : 'Nothing here'}
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>
                {unavailable
                  ? "This database doesn't have the smart-mail tables. Open Mail in the web app."
                  : threads.length === 0
                    ? 'Your mail is read every night for the mailboxes marked as work, and whenever you open Mail on the web.'
                    : 'Pull down to refresh.'}
              </Text>
            </View>
          }
          renderItem={({ item: t }) => {
            const chips = chipsFor(t);
            return (
              <Pressable onPress={() => setOpen(keyOf(t))} accessibilityLabel={`${senderOf(t)}: ${t.subject}`}>
                <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 13, gap: 4, minHeight: 64, opacity: t.handled ? 0.65 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.bold, fontSize: 14, color: P.ink }}>{senderOf(t)}</Text>
                    <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{ago(t.lastAt)}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 14, color: P.ink2 }}>{t.subject}</Text>
                  {t.need ? <Text numberOfLines={2} style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 18, color: P.ink3 }}>{t.need}</Text> : null}
                  {chips.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {chips.map(c => <Chip key={c.label} tone={c.tone}>{c.label}</Chip>)}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={close}>
        <Pressable onPress={close} accessibilityRole="none" style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} accessibilityRole="none">
            {selected ? (
              <View style={{ backgroundColor: P.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '86%', paddingTop: 18 }}>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink3 }}>
                    {senderOf(selected)} · {ago(selected.lastAt)} · {selected.accountEmail}
                  </Text>
                  <Text selectable style={{ fontFamily: NumFont.bold, fontSize: 19, color: P.ink, letterSpacing: -0.3 }}>{selected.subject}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {chipsFor(selected).map(c => <Chip key={c.label} tone={c.tone}>{c.label}</Chip>)}
                    {chipsFor(selected).length === 0 ? <Chip>{VIEWS.find(v => v.id === groupOf(selected))?.label ?? ''}</Chip> : null}
                  </View>
                  {selected.need ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>WHAT IT WANTS</Text>
                      <Text selectable style={{ fontFamily: UIFont.regular, fontSize: 15, lineHeight: 22, color: P.ink }}>{selected.need}</Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3 }}>
                      No summary yet — one is written the next time Mail is opened on the web.
                    </Text>
                  )}
                  {selected.draft ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>SUGGESTED REPLY</Text>
                      <View style={{ backgroundColor: P.field, borderRadius: Radii.sm + 3, borderWidth: 1, borderColor: P.hairline, padding: 12 }}>
                        <Text selectable style={{ fontFamily: UIFont.regular, fontSize: 14, lineHeight: 21, color: P.ink }}>{selected.draft}</Text>
                      </View>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>Press and hold to copy. Replying and archiving are done on the web.</Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: P.hairline }}>
                  <Pressable
                    onPress={() => {
                      if (!confirmIgnore) { setConfirmIgnore(true); return; }
                      void mute(selected); close();
                    }}
                    accessibilityLabel={confirmIgnore ? 'Confirm ignore this thread' : 'Ignore this thread'}
                    style={{ flex: 1, minHeight: 48, borderRadius: Radii.sm + 3, alignItems: 'center', justifyContent: 'center', backgroundColor: confirmIgnore ? P.negativeTint : P.field, borderWidth: 1, borderColor: confirmIgnore ? P.negative : P.hairline }}
                  >
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: confirmIgnore ? P.negative : P.ink2 }}>{confirmIgnore ? 'Tap again to ignore' : 'Ignore'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { void setHandled(selected, !selected.handled); close(); }}
                    accessibilityLabel={selected.handled ? 'Mark as not handled' : 'Mark as handled'}
                    style={{ flex: 1.4, minHeight: 48, borderRadius: Radii.sm + 3, alignItems: 'center', justifyContent: 'center', backgroundColor: P.accent, borderWidth: 1, borderColor: P.accentBorder }}
                  >
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 14, color: P.accentInk }}>{selected.handled ? 'Undo handled' : 'Mark handled'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
