import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { C, Quadrants, QuadrantId, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import { Pill } from '../../components/atoms/Pill';
import type { DbTask } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];

export function TasksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tasks      = useTaskStore(s => s.tasks);
  const load       = useTaskStore(s => s.loadFromDB);
  const loading    = useTaskStore(s => s.loading);
  const setStatus  = useTaskStore(s => s.setStatus);

  useEffect(() => { void load(); }, [load]);

  const byQuadrant = useMemo(() => {
    const groups: Record<QuadrantId, DbTask[]> = {
      urgent_important: [], important_not_urgent: [], urgent_not_important: [], neither: [],
    };
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'deferred') continue;
      const q = (t.quadrant ?? 'neither') as QuadrantId;
      groups[q].push(t);
    }
    return groups;
  }, [tasks]);

  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantId>('urgent_important');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar title="Task Command" subtitle="Eisenhower matrix" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
      >
        {QUADRANT_ORDER.map(q => {
          const meta = Quadrants[q];
          const active = activeQuadrant === q;
          const count = byQuadrant[q].length;
          return (
            <Pressable key={q} onPress={() => setActiveQuadrant(q)}>
              <View style={{
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: Radii.pill,
                backgroundColor: active ? meta.color : meta.soft,
                flexDirection: 'row', gap: 6, alignItems: 'center',
              }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: active ? '#fff' : meta.color }}>
                  {meta.label}
                </Text>
                <View style={{
                  paddingHorizontal: 6, paddingVertical: 1,
                  borderRadius: Radii.pill,
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#fff',
                }}>
                  <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: active ? '#fff' : meta.color }}>
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
        <QuadrantHeader id={activeQuadrant} count={byQuadrant[activeQuadrant].length} />
        {byQuadrant[activeQuadrant].length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: C.ink3, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Nothing here.</Text>
          </View>
        ) : (
          byQuadrant[activeQuadrant].map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={() => navigation.navigate('TaskDetail', { taskId: t.id })}
              onComplete={() => void setStatus(t.id, 'done')}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuadrantHeader({ id, count }: { id: QuadrantId; count: number }) {
  const meta = Quadrants[id];
  const tagline: Record<QuadrantId, string> = {
    urgent_important:    'Do now. Crisis-level. Costs more if you wait.',
    important_not_urgent:'Schedule. The work that builds the future.',
    urgent_not_important:'Delegate. Someone else can do this.',
    neither:             'Eliminate. Be honest — does this matter?',
  };
  return (
    <View style={{ paddingVertical: 8, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} />
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: C.ink, letterSpacing: -0.3 }}>{meta.label}</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 13, color: C.ink3 }}>· {count}</Text>
      </View>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2 }}>{tagline[id]}</Text>
    </View>
  );
}

function TaskRow({ task, onOpen, onComplete }: { task: DbTask; onOpen: () => void; onComplete: () => void }) {
  const q = Quadrants[(task.quadrant ?? 'neither') as QuadrantId];
  return (
    <Pressable onPress={onOpen}>
      <View style={{
        backgroundColor: C.card, borderRadius: Radii.md,
        borderWidth: 1, borderColor: C.hairline, padding: 14,
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        ...Shadows.card,
      }}>
        <Pressable onPress={onComplete} hitSlop={8}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: q.color }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }} numberOfLines={2}>{task.title}</Text>
          {task.description ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, marginTop: 4 }} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {task.effort_minutes ? <Pill label={`${task.effort_minutes}m`} color={C.ink2} soft="#EEF1F6" small /> : null}
            {task.due_date ? <Pill label={task.due_date} color={C.ink2} soft="#EEF1F6" small /> : null}
            {task.delegated_to ? <Pill label={`→ ${task.delegated_to}`} color={C.green} soft={C.greenSoft} small /> : null}
          </View>
        </View>
        <Text style={{ color: C.ink3, fontSize: 22, lineHeight: 22 }}>›</Text>
      </View>
    </Pressable>
  );
}
