import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AlertCircle, ArrowUp, Check, ChevronLeft, Sparkles, SquarePen } from 'lucide-react-native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import { Markdown } from '../../components/atoms/Markdown';
import { notify } from '../../store/feedbackStore';
import { useAssistant } from '../../lib/assistant/useAssistant';
import type { Bubble } from '../../lib/assistant/chatView';

const STARTERS = ['Plan my day', 'What should I focus on?', 'Review my week'];

/** What a tool call reads as in the thread. Past tense once it has run. */
const TOOL_LABELS: Record<string, [string, string]> = {
  list_calendar_events: ['Reading your calendar', 'Read your calendar'],
  create_calendar_event: ['Creating an event', 'Created an event'],
  update_calendar_event: ['Changing an event', 'Changed an event'],
  delete_calendar_event: ['Deleting an event', 'Deleted an event'],
  list_tasks: ['Reading your tasks', 'Read your tasks'],
  create_task: ['Creating a task', 'Created a task'],
  update_task: ['Updating a task', 'Updated a task'],
  complete_task: ['Completing a task', 'Completed a task'],
  delete_task: ['Deleting a task', 'Deleted a task'],
  list_habits: ['Reading your habits', 'Read your habits'],
  create_habit: ['Creating a habit', 'Created a habit'],
  update_habit: ['Updating a habit', 'Updated a habit'],
  delete_habit: ['Removing a habit', 'Removed a habit'],
  log_habit_completion: ['Logging a habit', 'Logged a habit'],
  get_productivity_summary: ['Checking your day', 'Checked your day'],
};

/** "claude-sonnet-4-6" → "Sonnet 4.6"; anything else is shown as it is. */
export function modelLabel(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(id);
  if (!m) return id;
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
}

const KIND_NOTE = {
  destructive: "This can't be undone",
  outward: 'Other people will see this',
  money: 'This changes your finances',
} as const;

export function AssistantScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  const a = useAssistant();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Bubble>>(null);

  // A problem is said once, in the app's own banner; the typed text stays so it can be sent again.
  useEffect(() => { if (a.problem) { notify('error', a.problem); a.dismissProblem(); } }, [a.problem]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [a.bubbles.length, a.busy, !!a.approval]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSend(text: string) {
    const t = text.trim();
    if (!t || a.busy) return;
    if (await a.send(t)) setInput('');
  }

  const name = a.settings?.name || 'Assistant';
  const colors = { ink: P.ink, muted: P.ink3, link: P.accentDeep, chip: P.field };
  const empty = a.loaded && a.bubbles.length === 0 && !a.busy;
  const canSend = input.trim().length > 0 && !a.busy;

  function renderBubble({ item: b }: { item: Bubble }) {
    if (b.role === 'user') {
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: P.accent, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text selectable style={{ fontFamily: UIFont.medium, fontSize: 15, lineHeight: 21, color: P.accentInk }}>{b.content}</Text>
        </View>
      );
    }
    if (b.role === 'tool') {
      const [running, done] = TOOL_LABELS[b.tool ?? ''] ?? ['Working', 'Done'];
      const failed = b.state === 'failed';
      return (
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 32, borderRadius: Radii.pill, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline }}>
          {b.state === 'running' ? <ActivityIndicator size="small" color={P.ink3} />
            : failed ? <AlertCircle size={14} color={P.negative} /> : <Check size={14} color={P.positive} />}
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink2 }}>
            {b.state === 'running' ? `${running}…` : failed ? `${running} — didn't work` : done}
          </Text>
        </View>
      );
    }
    if (b.role === 'error') {
      return (
        <View accessibilityRole="alert" style={{ alignSelf: 'flex-start', maxWidth: '92%', flexDirection: 'row', gap: 8, backgroundColor: P.negativeTint, borderColor: P.negative, borderWidth: 1, borderRadius: 14, padding: 12 }}>
          <AlertCircle size={16} color={P.negative} style={{ marginTop: 2 }} />
          <Text selectable style={{ flex: 1, fontFamily: UIFont.regular, fontSize: 14, lineHeight: 20, color: P.ink }}>{b.content}</Text>
        </View>
      );
    }
    return (
      <View style={{ alignSelf: 'flex-start', maxWidth: '94%', backgroundColor: P.surface, borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: P.hairline, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Markdown text={b.content} colors={colors} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}
        >
          <ChevronLeft size={22} color={P.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: NumFont.bold, fontSize: 17, color: P.ink, letterSpacing: -0.3 }}>{name}</Text>
          {a.settings && (
            <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>
              {modelLabel(a.settings.model)}{a.settings.fromAccount ? '' : ' · default'}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => void a.newChat()} disabled={a.bubbles.length === 0}
          accessibilityRole="button" accessibilityLabel="New conversation"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline, opacity: a.bubbles.length === 0 ? 0.4 : 1 }}
        >
          <SquarePen size={18} color={P.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {!a.loaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.ink3} /></View>
        ) : empty ? (
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 18 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: P.accentTint, borderWidth: 1, borderColor: P.accentBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color={P.accentDeep} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: NumFont.bold, fontSize: 26, color: P.ink, letterSpacing: -0.6 }}>How can I help?</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 15, lineHeight: 22, color: P.ink2 }}>
                Ask about your day, or tell me what to do. I can read and change your tasks, habits and calendar.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {STARTERS.map(s => (
                <Pressable
                  key={s} onPress={() => void onSend(s)} accessibilityRole="button"
                  style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: Radii.md, backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={a.bubbles}
            keyExtractor={b => b.id}
            renderItem={renderBubble}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={a.busy && !a.approval ? (
              <View accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                <ActivityIndicator size="small" color={P.ink3} />
                <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>Thinking…</Text>
              </View>
            ) : null}
          />
        )}

        {/* Approval card — what is about to happen, with its real arguments. */}
        {a.approval && (
          <View accessibilityRole="alert" style={{ marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: Radii.md, backgroundColor: P.surface, borderWidth: 1, borderColor: a.approval.kind === 'destructive' ? P.negative : P.accentBorder, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color={a.approval.kind === 'destructive' ? P.negative : P.accentDeep} />
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, letterSpacing: 0.4, color: a.approval.kind === 'destructive' ? P.negative : P.accentDeep }}>
                {KIND_NOTE[a.approval.kind].toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 16, color: P.ink }}>{a.approval.title}</Text>
            {a.approval.lines.length > 0 && (
              <View style={{ gap: 4 }}>
                {a.approval.lines.map(l => (
                  <View key={l.label} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ width: 96, fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>{l.label}</Text>
                    <Text style={{ flex: 1, fontFamily: UIFont.regular, fontSize: 13, color: P.ink }}>{l.value}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => a.approval?.resolve(false)} accessibilityRole="button"
                style={{ flex: 1, minHeight: 46, borderRadius: Radii.sm + 3, alignItems: 'center', justifyContent: 'center', backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline }}
              >
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={() => a.approval?.resolve(true)} accessibilityRole="button"
                style={{ flex: 1, minHeight: 46, borderRadius: Radii.sm + 3, alignItems: 'center', justifyContent: 'center', backgroundColor: a.approval.kind === 'destructive' ? P.negative : P.accent }}
              >
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: a.approval.kind === 'destructive' ? '#fff' : P.accentInk }}>
                  {a.approval.kind === 'destructive' ? 'Delete' : 'Approve'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Message box */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: P.hairline, backgroundColor: P.bg }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${name}`}
            placeholderTextColor={P.ink4}
            multiline
            accessibilityLabel="Message"
            style={{ flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline, fontFamily: UIFont.regular, fontSize: 15, color: P.ink }}
          />
          <Pressable
            onPress={() => void onSend(input)} disabled={!canSend}
            accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !canSend }}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? P.accent : P.field, borderWidth: 1, borderColor: canSend ? P.accentBorder : P.hairline }}
          >
            <ArrowUp size={20} color={canSend ? P.accentInk : P.ink4} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
