import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  Modal, TextInput, Alert, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHabitStore } from '../../store/habitStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { TopBar } from '../../components/atoms/TopBar';
import { SwipeRow } from '../../components/atoms/SwipeRow';
import type { DbHabit, DbHabitFrequency } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type ViewMode = 'table' | 'wall';

const HABIT_EMOJIS = [
  '🏃','💪','🏋️','🚴','🤸','🏊','🧘','🚶','⚽','🎾',
  '💧','🍎','🥗','🥦','🍵','🫐','📚','🧠','✍️','📝',
  '📖','🔬','🎯','🔥','⚡','🌅','💤','🧹','💊','🎸',
];

const FREQ_OPTIONS: { id: DbHabitFrequency; label: string }[] = [
  { id: 'daily',    label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly',   label: 'Weekly' },
];

// ── New Habit Wizard ──────────────────────────────────────────────────────────
function NewHabitWizard({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, emoji: string, freq: DbHabitFrequency) => void;
}) {
  const P = useScreenPalette();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏃');
  const [freq, setFreq] = useState<DbHabitFrequency>('daily');

  function reset() {
    setStep(1); setName(''); setEmoji('🏃'); setFreq('daily');
  }

  function handleClose() { reset(); onClose(); }

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim(), emoji, freq);
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <TouchableWithoutFeedback>
            <View style={{
              backgroundColor: P.surface,
              borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg,
              paddingTop: 10, paddingBottom: 36,
              borderTopWidth: 1, borderColor: P.hairline,
            }}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingBottom: 12 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.hairline }} />
              </View>

              {/* Header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 20, paddingBottom: 6,
              }}>
                <View>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                    New habit · {step} of 2
                  </Text>
                  <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.3, marginTop: 2 }}>
                    {step === 1 ? 'What it is' : 'What counts'}
                  </Text>
                </View>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: P.field, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.ink2, lineHeight: 16 }}>✕</Text>
                  </View>
                </Pressable>
              </View>

              {step === 1 ? (
                <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 16 }}>
                  {/* Selected emoji preview + name */}
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{
                      width: 56, height: 56, borderRadius: Radii.nav,
                      backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </View>
                    <TextInput
                      autoFocus
                      placeholder="Evening walk"
                      placeholderTextColor={P.ink3}
                      value={name}
                      onChangeText={setName}
                      style={{
                        flex: 1, fontFamily: UIFont.medium, fontSize: 18,
                        color: P.ink, borderBottomWidth: 1, borderColor: P.hairline,
                        paddingVertical: 8,
                      }}
                    />
                  </View>

                  {/* Emoji picker */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {HABIT_EMOJIS.map(e => (
                      <Pressable key={e} onPress={() => setEmoji(e)}>
                        <View style={{
                          width: 40, height: 40, borderRadius: Radii.chip,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: emoji === e ? P.accentTint : P.field,
                          borderWidth: 1, borderColor: emoji === e ? P.accentBorder : P.hairline,
                        }}>
                          <Text style={{ fontSize: 20 }}>{e}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={() => setStep(2)}
                    disabled={!name.trim()}
                    style={({ pressed }) => ({
                      backgroundColor: name.trim() ? (pressed ? P.accentDeep : P.accent) : P.field,
                      borderRadius: Radii.md, paddingVertical: 14, alignItems: 'center',
                      borderWidth: 1, borderColor: name.trim() ? P.accentBorder : P.hairline,
                    })}
                  >
                    <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: name.trim() ? P.accentInk : P.ink3 }}>
                      Next →
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 16 }}>
                  {/* Frequency */}
                  <View>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
                      How often
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {FREQ_OPTIONS.map(opt => {
                        const active = freq === opt.id;
                        return (
                          <Pressable key={opt.id} onPress={() => setFreq(opt.id)} style={{ flex: 1 }}>
                            <View style={{
                              paddingVertical: 11, borderRadius: Radii.md,
                              borderWidth: 1,
                              borderColor: active ? P.accentBorder : P.hairline,
                              backgroundColor: active ? P.accentTint : P.field,
                              alignItems: 'center',
                            }}>
                              <Text style={{
                                fontFamily: UIFont.semiBold, fontSize: 13,
                                color: active ? P.ink : P.ink2,
                              }}>
                                {opt.label}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Reminder note */}
                  <View style={{
                    padding: 14, backgroundColor: P.field,
                    borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline,
                  }}>
                    <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, lineHeight: 18 }}>
                      ✦ A miss restarts the streak. The history is kept either way.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => setStep(1)}
                      style={{ flex: 1, paddingVertical: 14, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink2 }}>← Back</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSave}
                      style={({ pressed }) => ({
                        flex: 2, backgroundColor: pressed ? P.accentDeep : P.accent,
                        paddingVertical: 14, borderRadius: Radii.md,
                        borderWidth: 1, borderColor: P.accentBorder, alignItems: 'center',
                      })}
                    >
                      <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.accentInk }}>
                        Create habit
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Wall card ─────────────────────────────────────────────────────────────────
function WallCard({ habit, done, onToggle, onPress }: {
  habit: DbHabit;
  done: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const P = useScreenPalette();
  const emoji = habit.name.match(/^\p{Emoji}/u)?.[0] ?? '🎯';

  return (
    <Pressable onPress={onPress} style={{ flex: 1, margin: 4 }}>
      <View style={{
        backgroundColor: P.surface, borderRadius: Radii.md,
        borderWidth: 1, borderColor: done ? P.accentBorder : P.hairline,
        padding: 14, gap: 10,
        ...Shadows.card,
      }}>
        {/* Top: emoji + streak badge */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 32 }}>{emoji}</Text>
          {habit.current_streak > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: done ? P.accentTint : P.field,
              borderRadius: Radii.pill, paddingHorizontal: 8, paddingVertical: 3,
              borderWidth: 1, borderColor: done ? P.accentBorder : P.hairline,
            }}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
              <Text style={{ fontFamily: NumFont.bold, fontSize: 12, color: done ? P.ink : P.ink2 }}>
                {habit.current_streak}d
              </Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink, lineHeight: 17 }} numberOfLines={2}>
          {habit.name.replace(/^\p{Emoji}\s*/u, '')}
        </Text>

        {/* Frequency */}
        <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>
          {habit.frequency}
        </Text>

        {/* Toggle button */}
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => ({
            paddingVertical: 8, borderRadius: Radii.sm,
            backgroundColor: done ? P.positive : pressed ? P.accentTint : P.field,
            borderWidth: 1, borderColor: done ? P.positive : P.hairline,
            alignItems: 'center',
          })}
        >
          <Text style={{
            fontFamily: UIFont.semiBold, fontSize: 12,
            color: done ? '#fff' : P.ink2,
          }}>
            {done ? '✓ Done' : 'Mark done'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── HabitsScreen ──────────────────────────────────────────────────────────────
export function HabitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();

  const habits           = useHabitStore(s => s.habits);
  const load             = useHabitStore(s => s.loadFromDB);
  const loading          = useHabitStore(s => s.loading);
  const toggleToday      = useHabitStore(s => s.toggleToday);
  const addHabit         = useHabitStore(s => s.addHabit);
  const removeHabit      = useHabitStore(s => s.removeHabit);
  const isCompletedToday = useHabitStore(s => s.isCompletedToday);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [adding, setAdding] = useState(false);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(name: string, _emoji: string, freq: DbHabitFrequency) {
    await addHabit(name, freq);
  }

  const doneCount = habits.filter(h => isCompletedToday(h.id)).length;

  const VIEW_TABS: { id: ViewMode; label: string }[] = [
    { id: 'table', label: 'Table' },
    { id: 'wall',  label: 'Wall' },
  ];

  // Wall view: 2 columns of cards
  const wallPairs: [DbHabit, DbHabit | null][] = [];
  for (let i = 0; i < habits.length; i += 2) {
    wallPairs.push([habits[i], habits[i + 1] ?? null]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar
        title="Habits"
        subtitle={`${doneCount} / ${habits.length || 0} today`}
        right={
          <Pressable onPress={() => setAdding(true)} hitSlop={8}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: P.accentBorder,
            }}>
              <Text style={{ color: P.accentInk, fontSize: 22, lineHeight: 24, marginTop: -2 }}>+</Text>
            </View>
          </Pressable>
        }
      />

      {/* View tabs */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10 }}>
        {VIEW_TABS.map(tab => {
          const active = viewMode === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setViewMode(tab.id)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radii.pill,
                backgroundColor: active ? P.accent : P.surface,
                borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline,
              }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.accentInk : P.ink2 }}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
      >
        {habits.length === 0 && !loading ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink2 }}>No habits yet</Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, textAlign: 'center' }}>
              Tap + to add one. Daily, weekdays, or weekly.
            </Text>
          </View>
        ) : viewMode === 'wall' ? (
          /* Wall view */
          wallPairs.map((pair, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 0 }}>
              <WallCard
                habit={pair[0]}
                done={isCompletedToday(pair[0].id)}
                onToggle={() => void toggleToday(pair[0].id)}
                onPress={() => navigation.navigate('HabitDetail', { habitId: pair[0].id })}
              />
              {pair[1] ? (
                <WallCard
                  habit={pair[1]}
                  done={isCompletedToday(pair[1]!.id)}
                  onToggle={() => void toggleToday(pair[1]!.id)}
                  onPress={() => navigation.navigate('HabitDetail', { habitId: pair[1]!.id })}
                />
              ) : <View style={{ flex: 1, margin: 4 }} />}
            </View>
          ))
        ) : (
          /* Table view */
          habits.map(h => {
            const done = isCompletedToday(h.id);
            return (
              <SwipeRow
                key={h.id}
                leftAction={{ label: done ? 'UNDO' : 'DONE', color: done ? C.slate : C.green, onAction: () => void toggleToday(h.id) }}
                rightAction={{
                  label: 'ARCHIVE', color: C.red,
                  onAction: () => Alert.alert('Archive habit', h.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive', style: 'destructive', onPress: () => void removeHabit(h.id) },
                  ]),
                }}
              >
                <Pressable onPress={() => navigation.navigate('HabitDetail', { habitId: h.id })}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: P.surface, borderRadius: Radii.md,
                    borderWidth: 1, borderColor: done ? P.accentBorder : P.hairline,
                    padding: 14, ...Shadows.card,
                  }}>
                    <Pressable onPress={() => void toggleToday(h.id)} hitSlop={8}>
                      <View style={{
                        width: 28, height: 28, borderRadius: 8,
                        borderWidth: 2, borderColor: done ? P.positive : P.hairline,
                        backgroundColor: done ? P.positive : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {done ? <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 16, lineHeight: 16 }}>✓</Text> : null}
                      </View>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>{h.name}</Text>
                      <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3, marginTop: 2 }}>{h.frequency}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: NumFont.bold, fontSize: 17, color: h.current_streak > 0 ? P.positive : P.ink3 }}>
                        {h.current_streak}
                      </Text>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 10, color: P.ink4, letterSpacing: 1 }}>STREAK</Text>
                    </View>
                    <Text style={{ color: P.ink3, fontSize: 22, lineHeight: 22 }}>›</Text>
                  </View>
                </Pressable>
              </SwipeRow>
            );
          })
        )}
      </ScrollView>

      <NewHabitWizard
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}
