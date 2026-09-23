import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
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

type ViewMode = 'list' | 'matrix' | 'board';

// ── Board columns ─────────────────────────────────────────────────────────────
interface BoardColumn {
  id: string;
  label: string;
  filter: (t: DbTask) => boolean;
  toStatus: DbTaskStatus;
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    filter: t => t.status === 'todo' && !t.due_date,
    toStatus: 'todo',
  },
  {
    id: 'planned',
    label: 'Planned',
    filter: t => t.status === 'todo' && !!t.due_date,
    toStatus: 'todo',
  },
  {
    id: 'in_review',
    label: 'In Review',
    filter: t => t.status === 'in_progress',
    toStatus: 'in_progress',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    filter: t => t.status === 'deferred',
    toStatus: 'deferred',
  },
  {
    id: 'done',
    label: 'Done',
    filter: t => t.status === 'done',
    toStatus: 'done',
  },
];

function priorityLabel(t: DbTask): string | null {
  if (t.quadrant === 'urgent_important')    return 'P0';
  if (t.quadrant === 'important_not_urgent') return 'P1';
  if (t.quadrant === 'urgent_not_important') return 'P2';
  return null;
}

function priorityColor(label: string): string {
  if (label === 'P0') return '#C62828';
  if (label === 'P1') return '#E65100';
  return '#2E7D32';
}

// ── AI parse simulation ───────────────────────────────────────────────────────
interface ParsedTask {
  company: string | null;
  type: 'Email' | 'Call' | 'Meeting' | 'Task';
  date: string | null;
  time: string | null;
  priority: 'P0' | 'P1' | 'P2' | null;
}

function parseNaturalLanguage(text: string): ParsedTask | null {
  if (text.trim().length < 4) return null;
  const lower = text.toLowerCase();
  const type: ParsedTask['type'] =
    lower.includes('email') || lower.includes('send') ? 'Email' :
    lower.includes('call')  || lower.includes('phone') ? 'Call' :
    lower.includes('meeting') || lower.includes('meet') ? 'Meeting' : 'Task';

  // Company: look for capitalised words after "for"
  const forMatch = text.match(/\bfor\s+([A-Z][a-zA-Z]+)/);
  const company = forMatch ? forMatch[1] : null;

  // Date words
  const today = new Date();
  let date: string | null = null;
  if (lower.includes('tomorrow')) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } else if (lower.includes('today')) {
    date = today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Time
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let time: string | null = null;
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const priority: ParsedTask['priority'] =
    lower.includes('urgent') || lower.includes('asap') ? 'P0' :
    lower.includes('important') ? 'P1' : null;

  return { company, type, date, time, priority };
}

// ── New Task Sheet ─────────────────────────────────────────────────────────────
function NewTaskSheet({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, parsed: ParsedTask | null) => void;
}) {
  const P = useScreenPalette();
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseNaturalLanguage(text), [text]);

  function handleSave() {
    if (!text.trim()) return;
    onSave(text.trim(), parsed);
    setText('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={{
                backgroundColor: P.surface, borderTopLeftRadius: Radii.lg,
                borderTopRightRadius: Radii.lg,
                paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
                borderTopWidth: 1, borderColor: P.hairline,
              }}>
                {/* Drag handle */}
                <View style={{ alignItems: 'center', paddingBottom: 10 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: P.hairline }} />
                </View>

                {/* Header */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 20, paddingBottom: 16,
                }}>
                  <Text style={{ fontFamily: NumFont.bold, fontSize: 18, color: P.ink, letterSpacing: -0.3 }}>
                    New task
                  </Text>
                  <Pressable onPress={onClose} hitSlop={8}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: P.field, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.ink2, lineHeight: 16 }}>✕</Text>
                    </View>
                  </Pressable>
                </View>

                {/* Input */}
                <View style={{ paddingHorizontal: 20 }}>
                  <TextInput
                    autoFocus
                    multiline
                    value={text}
                    onChangeText={setText}
                    placeholder="Type it the way you would say it"
                    placeholderTextColor={P.ink3}
                    style={{
                      fontFamily: UIFont.regular,
                      fontSize: 16,
                      color: P.ink,
                      minHeight: 72,
                      textAlignVertical: 'top',
                      paddingTop: 0,
                    }}
                  />
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 6 }}>
                    e.g. "Email Nawaf the revised scope tomorrow 9am for Teradix"
                  </Text>
                </View>

                {/* READ AS section */}
                {parsed && (
                  <View style={{ marginTop: 20 }}>
                    <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                      <Text style={{
                        fontFamily: UIFont.semiBold, fontSize: 11,
                        color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
                      }}>
                        Read as
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
                      <View style={{
                        backgroundColor: P.field, borderRadius: Radii.md,
                        borderWidth: 1, borderColor: P.hairline,
                        padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
                      }}>
                        {parsed.company && (
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill,
                            backgroundColor: P.accentTint, borderWidth: 1, borderColor: P.accentBorder,
                          }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink }}>
                              {parsed.company}
                            </Text>
                          </View>
                        )}
                        <View style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill,
                          backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
                        }}>
                          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>
                            {parsed.type}
                          </Text>
                        </View>
                        {parsed.date && (
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill,
                            backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
                          }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>
                              {parsed.date}
                            </Text>
                          </View>
                        )}
                        {parsed.time && (
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill,
                            backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
                          }}>
                            <Text style={{ fontFamily: NumFont.medium, fontSize: 12, color: P.ink2 }}>
                              {parsed.time}
                            </Text>
                          </View>
                        )}
                        {parsed.priority && (
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill,
                            backgroundColor: `${priorityColor(parsed.priority)}18`,
                            borderWidth: 1, borderColor: `${priorityColor(parsed.priority)}40`,
                          }}>
                            <Text style={{
                              fontFamily: UIFont.bold, fontSize: 12,
                              color: priorityColor(parsed.priority),
                            }}>
                              {parsed.priority}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Save button */}
                <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                  <Pressable
                    onPress={handleSave}
                    disabled={!text.trim()}
                    style={({ pressed }) => ({
                      backgroundColor: text.trim() ? (pressed ? P.accentDeep : P.accent) : P.field,
                      borderRadius: Radii.md, paddingVertical: 14, alignItems: 'center',
                      borderWidth: 1, borderColor: text.trim() ? P.accentBorder : P.hairline,
                    })}
                  >
                    <Text style={{
                      fontFamily: UIFont.bold, fontSize: 15,
                      color: text.trim() ? P.accentInk : P.ink3,
                    }}>
                      Add task
                    </Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────
function BoardCard({ task, onPress }: { task: DbTask; onPress: () => void }) {
  const P = useScreenPalette();
  const companies = useCompanyStore(s => s.companies);
  const company = companies.find(c => c.id === task.company_id);
  const priority = priorityLabel(task);

  return (
    <Pressable onPress={onPress}>
      <View style={{
        backgroundColor: P.surface, borderRadius: Radii.md,
        borderWidth: 1, borderColor: P.hairline,
        padding: 14, marginBottom: 8,
        ...Shadows.card,
      }}>
        <Text style={{
          fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink,
          lineHeight: 18, marginBottom: 10,
        }} numberOfLines={3}>
          {task.title}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {company && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill,
              backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline,
            }}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink2 }}>
                {company.name}
              </Text>
            </View>
          )}
          {task.due_date && (
            <View style={{
              paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.pill,
              backgroundColor: P.field, borderWidth: 1, borderColor: P.hairline,
              flexDirection: 'row', gap: 3, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 9 }}>📅</Text>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 11, color: P.ink3 }}>
                {task.due_date.slice(5)}
              </Text>
            </View>
          )}
          {priority && (
            <View style={{
              paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.pill,
              backgroundColor: `${priorityColor(priority)}18`,
              borderWidth: 1, borderColor: `${priorityColor(priority)}40`,
            }}>
              <Text style={{
                fontFamily: UIFont.bold, fontSize: 10,
                color: priorityColor(priority),
              }}>
                {priority}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Board view ────────────────────────────────────────────────────────────────
function BoardView({ tasks, onPress }: { tasks: DbTask[]; onPress: (id: string) => void }) {
  const P = useScreenPalette();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
    >
      {BOARD_COLUMNS.map(col => {
        const colTasks = tasks.filter(col.filter);
        return (
          <View key={col.id} style={{ width: 220 }}>
            {/* Column header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 2, paddingBottom: 12,
            }}>
              <Text style={{
                fontFamily: UIFont.semiBold, fontSize: 11,
                color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', flex: 1,
              }}>
                {col.label}
              </Text>
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill,
                backgroundColor: P.field,
              }}>
                <Text style={{ fontFamily: NumFont.medium, fontSize: 11, color: P.ink3 }}>
                  {colTasks.length}
                </Text>
              </View>
            </View>

            {/* Cards */}
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {colTasks.length === 0 ? (
                <View style={{
                  height: 64, borderRadius: Radii.md, borderWidth: 1,
                  borderColor: P.hairline, borderStyle: 'dashed',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3 }}>
                    Empty
                  </Text>
                </View>
              ) : (
                colTasks.map(t => (
                  <BoardCard key={t.id} task={t} onPress={() => onPress(t.id)} />
                ))
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── DraggableTaskList ────────────────────────────────────────────────────────

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
          return (
            <Pressable key={t.id} onPress={() => moveToPosition(t.id)}>
              <View style={{
                backgroundColor: P.surface, borderRadius: Radii.md,
                borderWidth: 2, borderColor: 'transparent',
                padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                ...Shadows.card, opacity: 0.7,
              }}>
                <View style={{ width: 28, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: P.ink3, fontFamily: UIFont.bold, fontSize: 16 }}>⠿</Text>
                </View>
                <TaskRowContent task={t} />
              </View>
            </Pressable>
          );
        }

        if (inDragMode && isDragging) {
          return (
            <View key={t.id} style={{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: rowBorderWidth, borderColor: rowBorderColor, borderStyle: rowBorderStyle,
              padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
              ...Shadows.card,
            }}>
              <View style={{ width: 28, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.indigo, fontFamily: UIFont.bold, fontSize: 16 }}>⠿</Text>
              </View>
              <TaskRowContent task={t} />
            </View>
          );
        }

        return (
          <SwipeRow
            key={t.id}
            leftAction={{ label: 'DONE', color: C.green, onAction: () => setStatus(t.id, 'done') }}
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
                backgroundColor: P.surface, borderRadius: Radii.md,
                borderWidth: rowBorderWidth, borderColor: rowBorderColor, borderStyle: rowBorderStyle,
                padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                ...Shadows.card,
              }}>
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

// ─── TasksScreen ──────────────────────────────────────────────────────────────

export function TasksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();

  const tasks      = useTaskStore(s => s.tasks);
  const load       = useTaskStore(s => s.loadFromDB);
  const loading    = useTaskStore(s => s.loading);
  const setStatus  = useTaskStore(s => s.setStatus);
  const moveTo     = useTaskStore(s => s.moveToQuadrant);
  const addTask    = useTaskStore(s => s.addTask);

  const companies     = useCompanyStore(s => s.companies);
  const loadCompanies = useCompanyStore(s => s.loadFromDB);

  useEffect(() => { void load(); void loadCompanies(); }, [load, loadCompanies]);

  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [showNewTask, setShowNewTask] = useState(false);

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

  const activeTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'done' && (!companyFilter || t.company_id === companyFilter)),
    [tasks, companyFilter],
  );

  const [localOrders, setLocalOrders] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setLocalOrders(prev => {
      const next = { ...prev };
      let changed = false;
      for (const q of QUADRANT_ORDER) {
        if (!next[q]) { next[q] = byQuadrant[q].map(t => t.id); changed = true; }
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

  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantId>('urgent_important');
  const tablet = useIsTablet();

  async function handleNewTask(title: string, parsed: ParsedTask | null) {
    const company = parsed?.company
      ? companies.find(c => c.name.toLowerCase() === parsed.company!.toLowerCase())
      : null;
    await addTask({
      title,
      due_date: parsed?.date ? new Date().toISOString().slice(0, 10) : undefined,
      company_id: company?.id ?? null,
    });
  }

  const VIEW_TABS: { id: ViewMode; label: string }[] = [
    { id: 'list', label: 'List' },
    { id: 'matrix', label: 'Matrix' },
    { id: 'board', label: 'Board' },
  ];

  if (tablet) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
        <TopBar title="Tasks" subtitle="Eisenhower matrix" />
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
      <TopBar
        title="Tasks"
        subtitle={`${activeTasks.length} active`}
        right={
          <Pressable
            onPress={() => setShowNewTask(true)}
            hitSlop={8}
          >
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

      {/* View tabs: List | Matrix | Board */}
      <View style={{
        flexDirection: 'row', gap: 6,
        paddingHorizontal: 20, paddingBottom: 10,
      }}>
        {VIEW_TABS.map(tab => {
          const active = viewMode === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setViewMode(tab.id)}>
              <View style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radii.pill,
                backgroundColor: active ? P.accent : P.surface,
                borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline,
              }}>
                <Text style={{
                  fontFamily: UIFont.semiBold, fontSize: 13,
                  color: active ? P.accentInk : P.ink2,
                }}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <CompanyFilterRow
        companies={companies}
        companyFilter={companyFilter}
        setCompanyFilter={setCompanyFilter}
        P={P}
      />

      {/* Board view (horizontal scroll outside of main scroll) */}
      {viewMode === 'board' ? (
        <BoardView
          tasks={companyFilter ? tasks.filter(t => t.company_id === companyFilter) : tasks}
          onPress={id => navigation.navigate('TaskDetail', { taskId: id })}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 10 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
        >
          {viewMode === 'list' ? (
            <>
              <View style={{ paddingVertical: 8 }}>
                <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: P.ink, letterSpacing: -0.3 }}>
                  All tasks
                </Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink2, marginTop: 4 }}>
                  {activeTasks.length} active · swipe to complete or remove
                </Text>
              </View>
              {activeTasks.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: P.ink3, fontFamily: UIFont.medium, fontSize: 14 }}>No tasks. Add one above.</Text>
                </View>
              ) : (
                activeTasks.map(t => (
                  <SwipeRow
                    key={t.id}
                    leftAction={{ label: 'DONE', color: C.green, onAction: () => void setStatus(t.id, 'done') }}
                    rightAction={{ label: 'DELETE', color: C.red, onAction: () => void useTaskStore.getState().removeTask(t.id) }}
                  >
                    <TaskRow
                      task={t}
                      onOpen={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                      onComplete={() => void setStatus(t.id, 'done')}
                    />
                  </SwipeRow>
                ))
              )}
            </>
          ) : (
            /* Matrix view */
            <>
              {/* Quadrant pills */}
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4, gap: 8 }}
                style={{ marginBottom: 8, marginHorizontal: -20, paddingHorizontal: 0 }}
              >
                <View style={{ width: 20 }} />
                {QUADRANT_ORDER.map(q => {
                  const meta = Quadrants[q];
                  const active = activeQuadrant === q;
                  const count = byQuadrant[q].length;
                  return (
                    <Pressable key={q} onPress={() => setActiveQuadrant(q)}>
                      <View style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill,
                        backgroundColor: active ? meta.color : meta.soft,
                        flexDirection: 'row', gap: 6, alignItems: 'center',
                      }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? '#fff' : meta.color }}>
                          {meta.label}
                        </Text>
                        <View style={{
                          paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.pill,
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
                <View style={{ width: 12 }} />
              </ScrollView>

              <QuadrantHeader id={activeQuadrant} count={byQuadrant[activeQuadrant].length} />
              <DraggableTaskList
                tasks={getOrderedTasks(activeQuadrant)}
                onReorder={(ids) => setQuadrantOrder(activeQuadrant, ids)}
                onPress={(id) => navigation.navigate('TaskDetail', { taskId: id })}
                onSwipeLeft={(id) => void moveTo(id, 'neither')}
                setStatus={setStatus}
              />
            </>
          )}
        </ScrollView>
      )}

      <NewTaskSheet
        visible={showNewTask}
        onClose={() => setShowNewTask(false)}
        onSave={handleNewTask}
      />
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
      horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
    >
      <Pressable onPress={() => setCompanyFilter(null)}>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1,
          backgroundColor: companyFilter === null ? P.ink : 'transparent',
          borderColor: companyFilter === null ? P.ink : P.hairline,
        }}>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: companyFilter === null ? P.bg : P.ink2 }}>
            All
          </Text>
        </View>
      </Pressable>
      {companies.map(company => {
        const active = companyFilter === company.id;
        const activeColor = company.color_tag ?? P.accent;
        return (
          <Pressable key={company.id} onPress={() => setCompanyFilter(active ? null : company.id)}>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1,
              backgroundColor: active ? activeColor : 'transparent',
              borderColor: active ? activeColor : P.hairline,
            }}>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: active ? '#fff' : P.ink2 }}>
                {company.name}
              </Text>
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
