import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { useCompanyStore } from '../../store/companyStore';
import { C, Quadrants, QuadrantId, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { TopBar } from '../../components/atoms/TopBar';
import { Pill } from '../../components/atoms/Pill';
import { SwipeRow } from '../../components/atoms/SwipeRow';
import { useIsTablet } from '../../lib/layout';
import type { DbTask, DbTaskStatus } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];

// ─── DraggableTaskList ───────────────────────────────────────────────────────

interface DraggableTaskListProps {
  tasks: DbTask[];
  onReorder: (newIds: string[]) => void;
  onPress: (taskId: string) => void;
  onSwipeLeft: (taskId: string) => void;
  setStatus: (id: string, s: DbTaskStatus) => void;
}

function DraggableTaskList({ tasks, onReorder, onPress, onSwipeLeft, setStatus }: DraggableTaskListProps) {
  const P = useScreenPalette();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function enterDrag(id: string) {
    setDraggingId(id);
    // Auto-cancel after 5 seconds
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = setTimeout(() => {
      setDraggingId(null);
    }, 5000);
  }

  function cancelDrag() {
    setDraggingId(null);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
  }

  function moveToPosition(targetId: string) {
    if (!draggingId || draggingId === targetId) { cancelDrag(); return; }
    const ids = tasks.map(t => t.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx   = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { cancelDrag(); return; }
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    onReorder(next);
    cancelDrag();
  }

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
  }, []);

  if (tasks.length === 0) {
    return (
      <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={{ color: P.ink3, fontFamily: UIFont.medium, fontSize: 14 }}>Nothing here.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {/* Drag mode banner */}
      {draggingId !== null && (
        <View style={{
          backgroundColor: C.indigo,
          borderRadius: Radii.md,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: '#fff', flex: 1 }}>
            Tap a row to move here
          </Text>
          <Pressable onPress={cancelDrag} hitSlop={10}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: '#fff' }}>✕</Text>
          </Pressable>
        </View>
      )}

      {tasks.map(t => {
        const isDragging  = draggingId === t.id;
        const inDragMode  = draggingId !== null;

        const rowBorderColor  = isDragging ? C.indigo : P.hairline;
        const rowBorderWidth  = isDragging ? 2 : 1;
        const rowBorderStyle  = isDragging ? 'dashed' : 'solid';

        if (inDragMode && !isDragging) {
          // In drag mode: tap this row to move the dragged task here
          return (
            <Pressable key={t.id} onPress={() => moveToPosition(t.id)}>
              <View style={{
                backgroundColor: P.surface,
                borderRadius: Radii.md,
                borderWidth: 2,
                borderColor: 'transparent',
                padding: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                ...Shadows.card,
                opacity: 0.7,
              }}>
                {/* Drag handle (inactive) */}
                <View style={{
                  width: 28,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: P.ink3, fontFamily: UIFont.bold, fontSize: 16 }}>⠿</Text>
                </View>
                <TaskRowContent task={t} />
              </View>
            </Pressable>
          );
        }

        if (inDragMode && isDragging) {
          // The dragged row — highlighted, not tappable
          return (
            <View key={t.id} style={{
              backgroundColor: P.surface,
              borderRadius: Radii.md,
              borderWidth: rowBorderWidth,
              borderColor: rowBorderColor,
              borderStyle: rowBorderStyle,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              ...Shadows.card,
            }}>
              {/* Drag handle (active) */}
              <View style={{
                width: 28,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ color: C.indigo, fontFamily: UIFont.bold, fontSize: 16 }}>⠿</Text>
              </View>
              <TaskRowContent task={t} />
            </View>
          );
        }

        // Normal (no drag active): swipe + tap to open, long-press handle to drag
        return (
          <SwipeRow
            key={t.id}
            leftAction={{
              label: 'DONE',
              color: C.green,
              onAction: () => setStatus(t.id, 'done'),
            }}
            rightAction={t.quadrant !== 'neither' ? {
              label: 'ELIMINATE',
              color: C.slate,
              onAction: () => onSwipeLeft(t.id),
            } : {
              label: 'DELETE',
              color: C.red,
              onAction: () => void useTaskStore.getState().removeTask(t.id),
            }}
          >
            <Pressable onPress={() => onPress(t.id)}>
              <View style={{
                backgroundColor: P.surface,
                borderRadius: Radii.md,
                borderWidth: rowBorderWidth,
                borderColor: rowBorderColor,
                borderStyle: rowBorderStyle,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                ...Shadows.card,
              }}>
                {/* Drag handle — long-press to enter drag mode */}
                <Pressable
                  onLongPress={() => enterDrag(t.id)}
                  delayLongPress={300}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={{ width: 28, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: C.slate, fontFamily: UIFont.bold, fontSize: 16 }}>⠿</Text>
                </Pressable>
                <TaskRowContent task={t} />
              </View>
            </Pressable>
          </SwipeRow>
        );
      })}
    </View>
  );
}

// Shared inner content of a task row (no interaction — parent handles that)
function TaskRowContent({ task }: { task: DbTask }) {
  const P = useScreenPalette();
  const q = Quadrants[(task.quadrant ?? 'neither') as QuadrantId];
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: q.color, marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }} numberOfLines={2}>{task.title}</Text>
        {task.description ? (
          <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 4 }} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {task.effort_minutes ? <Pill label={`${task.effort_minutes}m`} color={P.ink2} soft={P.isDark ? `${P.ink}15` : '#EEF1F6'} small /> : null}
          {task.due_date ? <Pill label={task.due_date} color={P.ink2} soft={P.isDark ? `${P.ink}15` : '#EEF1F6'} small /> : null}
          {task.delegated_to ? <Pill label={`→ ${task.delegated_to}`} color={C.green} soft={C.greenSoft} small /> : null}
        </View>
      </View>
      <Text style={{ color: P.ink3, fontSize: 22, lineHeight: 22 }}>›</Text>
    </View>
  );
}

// ─── TasksScreen ─────────────────────────────────────────────────────────────

export function TasksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();

  const tasks      = useTaskStore(s => s.tasks);
  const load       = useTaskStore(s => s.loadFromDB);
  const loading    = useTaskStore(s => s.loading);
  const setStatus  = useTaskStore(s => s.setStatus);
  const moveTo     = useTaskStore(s => s.moveToQuadrant);

  const companies     = useCompanyStore(s => s.companies);
  const loadCompanies = useCompanyStore(s => s.loadFromDB);

  useEffect(() => { void load(); void loadCompanies(); }, [load, loadCompanies]);

  const [companyFilter, setCompanyFilter] = useState<string | null>(null);

  const byQuadrant = useMemo(() => {
    const groups: Record<QuadrantId, DbTask[]> = {
      urgent_important: [], important_not_urgent: [], urgent_not_important: [], neither: [],
    };
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'deferred') continue;
      if (companyFilter && t.company_id !== companyFilter) continue;
      const q = (t.quadrant ?? 'neither') as QuadrantId;
      groups[q].push(t);
    }
    return groups;
  }, [tasks, companyFilter]);

  // ── Local ordering state (mobile drag-and-drop) ──────────────────────────
  const [localOrders, setLocalOrders] = useState<Record<string, string[]>>({});

  // Initialize any quadrant that doesn't have a local order yet
  useEffect(() => {
    setLocalOrders(prev => {
      const next = { ...prev };
      let changed = false;
      for (const q of QUADRANT_ORDER) {
        if (!next[q]) {
          next[q] = byQuadrant[q].map(t => t.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [byQuadrant]);

  function getOrderedTasks(quadrant: QuadrantId): DbTask[] {
    const qTasks = byQuadrant[quadrant];
    const order  = localOrders[quadrant];
    if (!order) return qTasks;
    const map = Object.fromEntries(qTasks.map(t => [t.id, t]));
    return order.map(id => map[id]).filter(Boolean) as DbTask[];
  }

  function setQuadrantOrder(quadrant: QuadrantId, ids: string[]) {
    setLocalOrders(prev => ({ ...prev, [quadrant]: ids }));
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantId>('urgent_important');
  const tablet = useIsTablet();

  if (tablet) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
        <TopBar title="Task Command" subtitle="Eisenhower matrix" />
        <CompanyFilterRow
          companies={companies}
          companyFilter={companyFilter}
          setCompanyFilter={setCompanyFilter}
          P={P}
        />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20, paddingBottom: 120,
            maxWidth: 1300, alignSelf: 'center', width: '100%',
          }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {QUADRANT_ORDER.map(q => (
              <View key={q} style={{ width: '48.5%', minHeight: 360 }}>
                <QuadrantHeader id={q} count={byQuadrant[q].length} />
                <View style={{ gap: 10, marginTop: 8 }}>
                  {byQuadrant[q].length === 0 ? (
                    <View style={{
                      padding: 24, alignItems: 'center',
                      backgroundColor: P.surface, borderRadius: Radii.md,
                      borderWidth: 1, borderColor: P.hairline, borderStyle: 'dashed',
                    }}>
                      <Text style={{ color: P.ink3, fontFamily: UIFont.medium, fontSize: 13 }}>Nothing here.</Text>
                    </View>
                  ) : (
                    byQuadrant[q].map(t => (
                      <SwipeRow
                        key={t.id}
                        leftAction={{ label: 'DONE', color: C.green, onAction: () => void setStatus(t.id, 'done') }}
                        rightAction={t.quadrant !== 'neither'
                          ? { label: 'ELIMINATE', color: C.slate, onAction: () => void moveTo(t.id, 'neither') }
                          : { label: 'DELETE',    color: C.red,   onAction: () => void useTaskStore.getState().removeTask(t.id) }}
                      >
                        <TaskRow
                          task={t}
                          onOpen={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                          onComplete={() => void setStatus(t.id, 'done')}
                        />
                      </SwipeRow>
                    ))
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar title="Task Command" subtitle="Eisenhower matrix" />
      <CompanyFilterRow
        companies={companies}
        companyFilter={companyFilter}
        setCompanyFilter={setCompanyFilter}
        P={P}
      />

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
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? '#fff' : meta.color }}>
                  {meta.label}
                </Text>
                <View style={{
                  paddingHorizontal: 6, paddingVertical: 1,
                  borderRadius: Radii.pill,
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#fff',
                }}>
                  <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: active ? '#fff' : meta.color }}>
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
      >
        <QuadrantHeader id={activeQuadrant} count={byQuadrant[activeQuadrant].length} />
        <DraggableTaskList
          tasks={getOrderedTasks(activeQuadrant)}
          onReorder={(ids) => setQuadrantOrder(activeQuadrant, ids)}
          onPress={(id) => navigation.navigate('TaskDetail', { taskId: id })}
          onSwipeLeft={(id) => void moveTo(id, 'neither')}
          setStatus={setStatus}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type ScreenPalette = ReturnType<typeof useScreenPalette>;

function CompanyFilterRow({
  companies, companyFilter, setCompanyFilter, P,
}: {
  companies: import('../../types/database').DbCompany[];
  companyFilter: string | null;
  setCompanyFilter: (id: string | null) => void;
  P: ScreenPalette;
}) {
  if (companies.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
    >
      {/* All pill */}
      <Pressable onPress={() => setCompanyFilter(null)}>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1,
          backgroundColor: companyFilter === null ? P.ink : 'transparent',
          borderColor: companyFilter === null ? P.ink : P.hairline,
        }}>
          <Text style={{
            fontFamily: UIFont.medium, fontSize: 13,
            color: companyFilter === null ? P.bg : P.ink2,
          }}>All</Text>
        </View>
      </Pressable>
      {companies.map(company => {
        const active = companyFilter === company.id;
        const activeColor = company.color_tag ?? P.accent;
        return (
          <Pressable
            key={company.id}
            onPress={() => setCompanyFilter(active ? null : company.id)}
          >
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1,
              backgroundColor: active ? activeColor : 'transparent',
              borderColor: active ? activeColor : P.hairline,
            }}>
              <Text style={{
                fontFamily: UIFont.medium, fontSize: 13,
                color: active ? '#fff' : P.ink2,
              }}>{company.name}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function QuadrantHeader({ id, count }: { id: QuadrantId; count: number }) {
  const P = useScreenPalette();
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
        <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: P.ink, letterSpacing: -0.3 }}>{meta.label}</Text>
        <Text style={{ fontFamily: NumFont.medium, fontSize: 13, color: P.ink3 }}>· {count}</Text>
      </View>
      <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2 }}>{tagline[id]}</Text>
    </View>
  );
}

// Used only in the tablet layout — unchanged
function TaskRow({ task, onOpen, onComplete }: { task: DbTask; onOpen: () => void; onComplete: () => void }) {
  const P = useScreenPalette();
  const q = Quadrants[(task.quadrant ?? 'neither') as QuadrantId];
  return (
    <Pressable onPress={onOpen}>
      <View style={{
        backgroundColor: P.surface, borderRadius: Radii.md,
        borderWidth: 1, borderColor: P.hairline, padding: 14,
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        ...Shadows.card,
      }}>
        <Pressable onPress={onComplete} hitSlop={8}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: q.color }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }} numberOfLines={2}>{task.title}</Text>
          {task.description ? (
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 4 }} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {task.effort_minutes ? <Pill label={`${task.effort_minutes}m`} color={P.ink2} soft={P.isDark ? `${P.ink}15` : '#EEF1F6'} small /> : null}
            {task.due_date ? <Pill label={task.due_date} color={P.ink2} soft={P.isDark ? `${P.ink}15` : '#EEF1F6'} small /> : null}
            {task.delegated_to ? <Pill label={`→ ${task.delegated_to}`} color={C.green} soft={C.greenSoft} small /> : null}
          </View>
        </View>
        <Text style={{ color: P.ink3, fontSize: 22, lineHeight: 22 }}>›</Text>
      </View>
    </Pressable>
  );
}
