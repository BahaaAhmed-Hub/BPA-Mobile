import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../../store/taskStore';
import { C, Quadrants, QuadrantId, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import { Pill } from '../../components/atoms/Pill';
import type { DbTask } from '../../types/database';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];

export function TasksScreen() {
  const tasks   = useTaskStore(s => s.tasks);
  const load    = useTaskStore(s => s.loadFromDB);
  const loading = useTaskStore(s => s.loading);
  const move    = useTaskStore(s => s.moveToQuadrant);
  const remove  = useTaskStore(s => s.removeTask);
  const setStatus = useTaskStore(s => s.setStatus);

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

      {/* Quadrant selector chips */}
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
              <View
                style={{
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: Radii.pill,
                  backgroundColor: active ? meta.color : meta.soft,
                  flexDirection: 'row', gap: 6, alignItems: 'center',
                }}
              >
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

      {/* Active quadrant body */}
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
              onComplete={() => void setStatus(t.id, 'done')}
              onMove={(q) => void move(t.id, q)}
              onDelete={() => {
                Alert.alert('Delete task', t.title, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => void remove(t.id) },
                ]);
              }}
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

function TaskRow({
  task,
  onComplete,
  onMove,
  onDelete,
}: {
  task: DbTask;
  onComplete: () => void;
  onMove: (q: QuadrantId) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const q = Quadrants[(task.quadrant ?? 'neither') as QuadrantId];

  return (
    <Pressable onPress={() => setExpanded(e => !e)}>
      <View
        style={{
          backgroundColor: C.card,
          borderRadius: Radii.md,
          borderWidth: 1, borderColor: C.hairline,
          padding: 14, gap: 10,
          ...Shadows.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Pressable onPress={onComplete} hitSlop={8}>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              borderWidth: 2, borderColor: q.color,
            }} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{task.title}</Text>
            {task.description ? (
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink2, marginTop: 4 }} numberOfLines={expanded ? undefined : 2}>
                {task.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {task.effort_minutes ? <Pill label={`${task.effort_minutes}m`} color={C.ink2} soft="#EEF1F6" small /> : null}
              {task.due_date ? <Pill label={task.due_date} color={C.ink2} soft="#EEF1F6" small /> : null}
              {task.delegated_to ? <Pill label={`→ ${task.delegated_to}`} color={C.green} soft={C.greenSoft} small /> : null}
            </View>
          </View>
        </View>

        {expanded && (
          <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.hairline }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: C.ink3, letterSpacing: 1.2 }}>MOVE TO</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {QUADRANT_ORDER.filter(id => id !== task.quadrant).map(id => {
                const m = Quadrants[id];
                return (
                  <Pressable key={id} onPress={() => onMove(id)}>
                    <View style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill,
                      backgroundColor: m.soft,
                    }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: m.color }}>{m.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={onDelete}>
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill,
                  backgroundColor: 'rgba(178,58,54,0.08)',
                }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.red }}>Delete</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
