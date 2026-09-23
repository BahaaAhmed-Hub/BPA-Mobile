import { useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { useHabitStore } from '../../store/habitStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useFinanceStore } from '../../store/financeStore';
import { useEmailActionsStore } from '../../store/emailActionsStore';
import { Radii, Shadows, C } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type ResultKind = 'task' | 'habit' | 'event' | 'transaction' | 'email';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  meta?: string;
  accentColor?: string;
}

const KIND_META: Record<ResultKind, { label: string; color: string; emoji: string }> = {
  task:        { label: 'TASK',        color: C.indigo,  emoji: '✅' },
  habit:       { label: 'HABIT',       color: C.green,   emoji: '🔥' },
  event:       { label: 'EVENT',       color: C.blue,    emoji: '📅' },
  transaction: { label: 'TRANSACTION', color: C.orange,  emoji: '💸' },
  email:       { label: 'MAIL',        color: C.red,     emoji: '✉️' },
};

function highlight(text: string, query: string): string {
  return text; // plain text; bold matching done by opacity trick in component
}

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');

  const tasks        = useTaskStore(s => s.tasks);
  const habits       = useHabitStore(s => s.habits);
  const events       = useCalendarStore(s => s.events);
  const transactions = useFinanceStore(s => s.transactions);
  const emailActions = useEmailActionsStore(s => s.actions);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchResult[] = [];

    // Tasks
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)) {
        out.push({
          id: t.id, kind: 'task',
          title: t.title,
          subtitle: t.description ?? undefined,
          meta: t.status,
        });
      }
    }

    // Habits
    for (const h of habits) {
      if (h.name.toLowerCase().includes(q)) {
        out.push({
          id: h.id, kind: 'habit',
          title: h.name,
          subtitle: h.frequency,
          meta: `${h.current_streak}d streak`,
        });
      }
    }

    // Calendar events
    for (const e of events) {
      if (
        e.title.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q)
      ) {
        const d = new Date(e.start_time);
        out.push({
          id: e.id, kind: 'event',
          title: e.title,
          subtitle: e.location ?? undefined,
          meta: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    // Transactions
    for (const t of transactions) {
      if (
        (t.payee ?? '').toLowerCase().includes(q) ||
        (t.note ?? '').toLowerCase().includes(q)
      ) {
        out.push({
          id: t.id, kind: 'transaction',
          title: t.payee ?? 'Transaction',
          subtitle: t.note ?? undefined,
          meta: `${t.currency} ${t.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} · ${t.date}`,
        });
      }
    }

    // Email actions
    for (const a of emailActions) {
      if ((a.subject ?? '').toLowerCase().includes(q)) {
        out.push({
          id: a.id, kind: 'email',
          title: a.subject ?? '(no subject)',
          subtitle: a.classification ?? undefined,
          meta: a.follow_up_date ?? undefined,
        });
      }
    }

    return out.slice(0, 40);
  }, [query, tasks, habits, events, transactions, emailActions]);

  // Group by kind
  const byKind = useMemo(() => {
    const acc: Partial<Record<ResultKind, SearchResult[]>> = {};
    for (const r of results) {
      (acc[r.kind] ??= []).push(r);
    }
    return acc;
  }, [results]);

  const kindOrder: ResultKind[] = ['task', 'event', 'habit', 'transaction', 'email'];

  function handleResultPress(result: SearchResult) {
    switch (result.kind) {
      case 'task':
        navigation.navigate('TaskDetail', { taskId: result.id });
        break;
      case 'habit':
        navigation.navigate('HabitDetail', { habitId: result.id });
        break;
      case 'event':
        navigation.navigate('EventDetail', { eventId: result.id });
        break;
      default:
        break;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Search bar row */}
        <View style={{
          paddingHorizontal: 14, paddingVertical: 10,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          borderBottomWidth: 1, borderBottomColor: P.hairline,
        }}>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: P.surface, borderRadius: Radii.md,
            borderWidth: 1, borderColor: P.hairline,
            paddingHorizontal: 12, paddingVertical: 10,
          }}>
            <Text style={{ fontSize: 16, color: P.ink3 }}>🔍</Text>
            <TextInput
              ref={inputRef}
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search everything…"
              placeholderTextColor={P.ink3}
              returnKeyType="search"
              style={{
                flex: 1,
                fontFamily: UIFont.medium, fontSize: 16,
                color: P.ink, padding: 0,
              }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Text style={{ fontSize: 18, color: P.ink3, lineHeight: 20 }}>×</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.accent }}>Cancel</Text>
          </Pressable>
        </View>

        {/* Results */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, gap: 20 }}
        >
          {query.trim().length < 2 ? (
            /* Empty state — recent items hint */
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
              <Text style={{ fontSize: 36 }}>🔎</Text>
              <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3 }}>
                Search everything
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink3, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                Tasks, habits, calendar events, transactions and mail — all in one place.
              </Text>
              {/* Module pills */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                {kindOrder.map(k => (
                  <View key={k} style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill,
                    backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}>
                    <Text style={{ fontSize: 13 }}>{KIND_META[k].emoji}</Text>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>
                      {KIND_META[k].label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : results.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink2 }}>Nothing found</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3 }}>
                Try a different word or phrase.
              </Text>
            </View>
          ) : (
            kindOrder.map(kind => {
              const group = byKind[kind];
              if (!group || group.length === 0) return null;
              const meta = KIND_META[kind];
              return (
                <View key={kind}>
                  <Text style={{
                    fontFamily: UIFont.semiBold, fontSize: 11,
                    color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
                    marginBottom: 8,
                  }}>
                    {meta.label} · {group.length}
                  </Text>
                  <View style={{
                    backgroundColor: P.surface, borderRadius: Radii.md,
                    borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
                    ...Shadows.card,
                  }}>
                    {group.map((result, ri) => (
                      <Pressable
                        key={result.id}
                        onPress={() => handleResultPress(result)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          paddingHorizontal: 14, paddingVertical: 13,
                          borderBottomWidth: ri < group.length - 1 ? 1 : 0,
                          borderColor: P.hairline,
                        }}>
                          <View style={{
                            width: 34, height: 34, borderRadius: 10,
                            backgroundColor: `${meta.color}18`,
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}
                              numberOfLines={1}
                            >
                              {result.title}
                            </Text>
                            {result.subtitle ? (
                              <Text
                                style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 1 }}
                                numberOfLines={1}
                              >
                                {result.subtitle}
                              </Text>
                            ) : null}
                          </View>
                          {result.meta ? (
                            <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }} numberOfLines={1}>
                              {result.meta}
                            </Text>
                          ) : null}
                          <Text style={{ color: P.ink3, fontSize: 16 }}>›</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
