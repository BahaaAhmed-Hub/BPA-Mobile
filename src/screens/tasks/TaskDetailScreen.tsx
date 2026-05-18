import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTaskStore } from '../../store/taskStore';
import { C, Quadrants, QuadrantId, Radii, Shadows } from '../../theme/tokens';
import type { DbTask, DbTaskStatus } from '../../types/database';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];
const STATUS_ORDER: DbTaskStatus[] = ['todo', 'in_progress', 'done', 'deferred'];
const STATUS_LABELS: Record<DbTaskStatus, string> = { todo: 'Todo', in_progress: 'In progress', done: 'Done', deferred: 'Deferred' };

type DetailRoute = RouteProp<{ TaskDetail: { taskId: string } }, 'TaskDetail'>;

export function TaskDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<DetailRoute>();
  const taskId     = route.params.taskId;

  const task     = useTaskStore(s => s.tasks.find(t => t.id === taskId));
  const update   = useTaskStore(s => s.updateTask);
  const remove   = useTaskStore(s => s.removeTask);
  const setStat  = useTaskStore(s => s.setStatus);

  // Local edit drafts so we don't write on every keystroke
  const [title, setTitle]                 = useState(task?.title ?? '');
  const [description, setDescription]     = useState(task?.description ?? '');
  const [doneLooksLike, setDoneLooksLike] = useState(task?.done_looks_like ?? '');
  const [delegatedTo, setDelegatedTo]     = useState(task?.delegated_to ?? '');
  const [effort, setEffort]               = useState(task?.effort_minutes ? String(task.effort_minutes) : '');
  const [dueDate, setDueDate]             = useState(task?.due_date ?? '');

  const meta = useMemo(() => Quadrants[(task?.quadrant ?? 'neither') as QuadrantId], [task?.quadrant]);

  if (!task) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <Header onBack={() => navigation.goBack()} title="Not found" />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_500Medium', color: C.ink2 }}>This task has been deleted.</Text>
        </View>
      </SafeAreaView>
    );
  }

  async function saveField(patch: Partial<DbTask>) {
    await update(task!.id, patch);
  }

  async function handleDelete() {
    Alert.alert('Delete task', task!.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await remove(task!.id); navigation.goBack(); } },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header onBack={() => navigation.goBack()} title={meta.label} accent={meta.color} onDelete={handleDelete} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 20 }} keyboardShouldPersistTaps="handled">
          {/* Title (inline editable) */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            onEndEditing={() => { if (title.trim() && title !== task.title) void saveField({ title: title.trim() }); }}
            placeholder="Untitled task"
            placeholderTextColor={C.ink3}
            multiline
            style={{
              fontFamily: 'Inter_700Bold', fontSize: 26, color: C.ink, letterSpacing: -0.6, lineHeight: 32,
              paddingVertical: 4,
            }}
          />

          {/* Status pills */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_ORDER.map(s => {
              const active = task.status === s;
              const accent = s === 'done' ? C.green : s === 'in_progress' ? C.blue : s === 'deferred' ? C.slate : C.ink2;
              return (
                <Pressable key={s} onPress={() => void setStat(task.id, s)}>
                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill,
                    backgroundColor: active ? accent : C.card,
                    borderWidth: 1, borderColor: active ? accent : C.hairline,
                  }}>
                    <Text style={{
                      fontFamily: 'Inter_600SemiBold', fontSize: 12,
                      color: active ? '#fff' : accent,
                    }}>{STATUS_LABELS[s]}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <Section title="Notes">
            <TextInput
              value={description}
              onChangeText={setDescription}
              onEndEditing={() => { if (description !== (task.description ?? '')) void saveField({ description: description || null }); }}
              placeholder="What needs to happen, context, links…"
              placeholderTextColor={C.ink3}
              multiline
              style={fieldInput}
            />
          </Section>

          {/* Quadrant */}
          <Section title="Quadrant">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {QUADRANT_ORDER.map(id => {
                const m = Quadrants[id];
                const active = task.quadrant === id;
                return (
                  <Pressable key={id} onPress={() => void saveField({ quadrant: id })}>
                    <View style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill,
                      backgroundColor: active ? m.color : m.soft,
                    }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: active ? '#fff' : m.color }}>
                        {m.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Done looks like */}
          <Section title="Done looks like">
            <TextInput
              value={doneLooksLike}
              onChangeText={setDoneLooksLike}
              onEndEditing={() => { if (doneLooksLike !== (task.done_looks_like ?? '')) void saveField({ done_looks_like: doneLooksLike || null }); }}
              placeholder="The concrete artifact or outcome…"
              placeholderTextColor={C.ink3}
              multiline
              style={fieldInput}
            />
          </Section>

          {/* Inline metadata row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Section title="Effort (min)" tight>
                <TextInput
                  value={effort}
                  onChangeText={setEffort}
                  onEndEditing={() => {
                    const n = effort ? Number(effort) : null;
                    if (n !== task.effort_minutes) void saveField({ effort_minutes: Number.isFinite(n) ? n : null });
                  }}
                  placeholder="—"
                  placeholderTextColor={C.ink3}
                  keyboardType="number-pad"
                  style={{ ...fieldInput, fontFamily: 'JetBrainsMono_500Medium' }}
                />
              </Section>
            </View>
            <View style={{ flex: 1.4 }}>
              <Section title="Due (YYYY-MM-DD)" tight>
                <TextInput
                  value={dueDate}
                  onChangeText={setDueDate}
                  onEndEditing={() => { if (dueDate !== (task.due_date ?? '')) void saveField({ due_date: dueDate || null }); }}
                  placeholder="—"
                  placeholderTextColor={C.ink3}
                  autoCapitalize="none"
                  style={{ ...fieldInput, fontFamily: 'JetBrainsMono_500Medium' }}
                />
              </Section>
            </View>
          </View>

          {/* Delegated to */}
          <Section title="Delegated to">
            <TextInput
              value={delegatedTo}
              onChangeText={setDelegatedTo}
              onEndEditing={() => { if (delegatedTo !== (task.delegated_to ?? '')) void saveField({ delegated_to: delegatedTo || null }); }}
              placeholder="Name or email"
              placeholderTextColor={C.ink3}
              autoCapitalize="none"
              style={fieldInput}
            />
          </Section>

          {/* Footer meta */}
          <View style={{ paddingVertical: 12, gap: 4 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: C.ink3, letterSpacing: 0.5 }}>
              CREATED {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            {task.completed_at ? (
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: C.green, letterSpacing: 0.5 }}>
                COMPLETED {new Date(task.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onBack, title, accent, onDelete }: { onBack: () => void; title: string; accent?: string; onDelete?: () => void }) {
  return (
    <View style={{
      paddingHorizontal: 14, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <Pressable onPress={onBack} hitSlop={8} style={iconBtn}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: C.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {accent ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} /> : null}
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.ink2 }}>{title}</Text>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={iconBtn}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: C.red, lineHeight: 16 }}>⌫</Text>
        </Pressable>
      ) : <View style={{ width: 36 }} />}
    </View>
  );
}

function Section({ title, tight, children }: { title: string; tight?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ marginTop: tight ? 0 : 2 }}>{children}</View>
    </View>
  );
}

const iconBtn = {
  width: 36, height: 36, borderRadius: 18,
  alignItems: 'center' as const, justifyContent: 'center' as const,
  backgroundColor: C.card,
  borderWidth: 1, borderColor: C.hairline,
  ...Shadows.card,
};

const fieldInput = {
  backgroundColor: C.card,
  borderRadius: Radii.sm,
  borderWidth: 1, borderColor: C.hairline,
  paddingHorizontal: 14, paddingVertical: 12,
  fontFamily: 'Inter_400Regular', fontSize: 15, color: C.ink,
  minHeight: 44,
};
