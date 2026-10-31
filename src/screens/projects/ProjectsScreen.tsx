import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import { useProjectStore } from '../../store/projectStore';
import { useTaskStore } from '../../store/taskStore';
import { drawableColor, progressOf, STATUS_LABEL } from '../../lib/projects';
import type { DbProject, DbProjectStatus } from '../../types/database';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Filter = 'open' | 'done' | 'all';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'open', label: 'Open' }, { id: 'done', label: 'Done' }, { id: 'all', label: 'All' }];

export const todayKey = () => new Date().toLocaleDateString('en-CA');

export function whenText(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft > 0) return daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`;
  return `${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue`;
}

export function ProjectsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const P = useScreenPalette();
  const projects = useProjectStore(s => s.projects);
  const milestones = useProjectStore(s => s.milestones);
  const loading = useProjectStore(s => s.loading);
  const unavailable = useProjectStore(s => s.unavailable);
  const load = useProjectStore(s => s.loadFromDB);
  const tasks = useTaskStore(s => s.tasks);
  const loadTasks = useTaskStore(s => s.loadFromDB);
  const [filter, setFilter] = useState<Filter>('open');
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    void (async () => { await Promise.all([load(), tasks.length === 0 ? loadTasks() : Promise.resolve()]); setLoadedOnce(true); })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayKey();
  const shown = useMemo(() => projects.filter(p => filter === 'all' ? true : filter === 'done' ? p.status === 'done' : p.status !== 'done'), [projects, filter]);

  const statusTone = (s: DbProjectStatus) =>
    s === 'active' ? { bg: P.positiveTint, fg: P.positive } : s === 'done' ? { bg: P.field, fg: P.ink3 } : s === 'paused' ? { bg: P.accentTint, fg: P.accentDeep } : { bg: P.field, fg: P.ink2 };

  function renderItem({ item: p }: { item: DbProject }) {
    const g = progressOf(p, tasks, milestones, today);
    const color = drawableColor(p.color, P.accent);
    const tone = statusTone(p.status);
    const when = whenText(g.daysLeft);
    const overdue = g.daysLeft !== null && g.daysLeft < 0 && p.status !== 'done';
    return (
      <Pressable
        onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
        accessibilityLabel={`${p.name}, ${STATUS_LABEL[p.status]}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, padding: 14, gap: 10, borderLeftWidth: 4, borderLeftColor: color, ...Shadows.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: NumFont.bold, fontSize: 17, color: P.ink, letterSpacing: -0.3 }}>{p.name}</Text>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radii.pill, backgroundColor: tone.bg }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: tone.fg }}>{STATUS_LABEL[p.status]}</Text>
            </View>
            <ChevronRight size={16} color={P.ink3} />
          </View>

          {g.taskRatio !== null ? (
            <View style={{ gap: 5 }}>
              <View style={{ height: 6, backgroundColor: P.hairline, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(g.taskRatio * 100)}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
              <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>
                {g.tasksDone} of {g.tasksTotal} tasks done
                {g.milestonesTotal > 0 ? ` · ${g.milestonesDone} of ${g.milestonesTotal} milestones` : ''}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>
              No tasks yet{g.milestonesTotal > 0 ? ` · ${g.milestonesDone} of ${g.milestonesTotal} milestones` : ''}
            </Text>
          )}

          {(when || g.nextMilestone) ? (
            <View style={{ gap: 2 }}>
              {when ? <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: overdue ? P.negative : P.ink2 }}>{p.kind === 'work' ? 'Work' : 'Personal'} · {when}</Text> : null}
              {g.nextMilestone ? <Text numberOfLines={1} style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>Next: {g.nextMilestone.title}</Text> : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
          <ChevronLeft size={22} color={P.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: NumFont.bold, fontSize: 20, color: P.ink, letterSpacing: -0.4 }}>Projects</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>{projects.filter(p => p.status !== 'done').length} open · create and edit on the web</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} accessibilityState={{ selected: active }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radii.pill, backgroundColor: active ? P.accent : P.surface, borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.accentInk : P.ink2 }}>{f.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!loadedOnce && loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={P.ink3} /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 10, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={P.accent} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>
                {unavailable ? 'Projects is not set up yet' : projects.length === 0 ? 'No projects yet' : `No ${filter === 'done' ? 'finished' : 'open'} projects`}
              </Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 13, lineHeight: 19, color: P.ink3, textAlign: 'center' }}>
                {unavailable ? "This database doesn't have the projects tables. Turn Projects on in the web app." : 'Projects you create on the web appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
