import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTaskStore } from '../../store/taskStore';
import { useCompanyStore } from '../../store/companyStore';
import { C, Quadrants, QuadrantId, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { TopBar } from '../../components/atoms/TopBar';
import { Pill } from '../../components/atoms/Pill';
import { SwipeRow } from '../../components/atoms/SwipeRow';
import { useIsTablet } from '../../lib/layout';
import type { DbTask } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const QUADRANT_ORDER: QuadrantId[] = ['urgent_important', 'important_not_urgent', 'urgent_not_important', 'neither'];

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
                      <Text style={{ color: P.ink3, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Nothing here.</Text>
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
      >
        <QuadrantHeader id={activeQuadrant} count={byQuadrant[activeQuadrant].length} />
        {byQuadrant[activeQuadrant].length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: P.ink3, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Nothing here.</Text>
          </View>
        ) : (
          byQuadrant[activeQuadrant].map(t => (
            <SwipeRow
              key={t.id}
              leftAction={{
                label: 'DONE',
                color: C.green,
                onAction: () => void setStatus(t.id, 'done'),
              }}
              rightAction={t.quadrant !== 'neither' ? {
                label: 'ELIMINATE',
                color: C.slate,
                onAction: () => void moveTo(t.id, 'neither'),
              } : {
                label: 'DELETE',
                color: C.red,
                onAction: () => void useTaskStore.getState().removeTask(t.id),
              }}
            >
              <TaskRow
                task={t}
                onOpen={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                onComplete={() => void setStatus(t.id, 'done')}
              />
            </SwipeRow>
          ))
        )}
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
            fontFamily: 'Inter_500Medium', fontSize: 13,
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
                fontFamily: 'Inter_500Medium', fontSize: 13,
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
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: P.ink, letterSpacing: -0.3 }}>{meta.label}</Text>
        <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 13, color: P.ink3 }}>· {count}</Text>
      </View>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: P.ink2 }}>{tagline[id]}</Text>
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
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: P.ink }} numberOfLines={2}>{task.title}</Text>
          {task.description ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: P.ink2, marginTop: 4 }} numberOfLines={2}>
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
