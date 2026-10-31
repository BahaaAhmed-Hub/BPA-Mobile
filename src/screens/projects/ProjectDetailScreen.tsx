import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft, ChevronRight, Circle } from 'lucide-react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import { useProjectStore } from '../../store/projectStore';
import { useTaskStore } from '../../store/taskStore';
import { drawableColor, progressOf, STATUS_LABEL, tasksOf } from '../../lib/projects';
import { isOpenTask } from '../../lib/tasks';
import { todayKey, whenText } from './ProjectsScreen';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export function ProjectDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ProjectDetail'>>();
  const P = useScreenPalette();
  const project = useProjectStore(s => s.projects.find(p => p.id === params.projectId));
  const allMilestones = useProjectStore(s => s.milestones);
  const tasks = useTaskStore(s => s.tasks);
  const today = todayKey();

  const milestones = useMemo(() => allMilestones.filter(m => m.project_id === params.projectId), [allMilestones, params.projectId]);
  const mine = useMemo(() => (project ? tasksOf(project, tasks) : []), [project, tasks]);
  const open = mine.filter(t => isOpenTask(t));
  const done = mine.filter(t => !isOpenTask(t) && t.status !== 'deferred');

  const back = (
    <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back"
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline }}>
      <ChevronLeft size={22} color={P.ink} />
    </Pressable>
  );

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
        <View style={{ padding: 14 }}>{back}</View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 16, color: P.ink }}>This project is no longer here</Text>
        </View>
      </SafeAreaView>
    );
  }

  const g = progressOf(project, tasks, allMilestones, today);
  const color = drawableColor(project.color, P.accent);
  const when = whenText(g.daysLeft);
  const overdue = g.daysLeft !== null && g.daysLeft < 0 && project.status !== 'done';

  const section = (title: string, right?: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 6 }}>
      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, letterSpacing: 1.4, color: P.ink4 }}>{title}</Text>
      {right ? <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: P.ink2 }}>{right}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {back}
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>Project · edit on the web</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 12 }}>
        <View style={{ gap: 8 }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: color }} />
          <Text style={{ fontFamily: NumFont.bold, fontSize: 26, color: P.ink, letterSpacing: -0.6 }}>{project.name}</Text>
          <Text style={{ fontFamily: UIFont.medium, fontSize: 13, color: P.ink3 }}>
            {STATUS_LABEL[project.status]} · {project.kind === 'work' ? 'Work' : 'Personal'}
            {project.start_date ? ` · started ${fmtDate(project.start_date)}` : ''}
          </Text>
          {project.target_date ? (
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: overdue ? P.negative : P.ink2 }}>
              Target {fmtDate(project.target_date)}{when ? ` · ${when}` : ''}
            </Text>
          ) : null}
          {project.notes ? <Text selectable style={{ fontFamily: UIFont.regular, fontSize: 14, lineHeight: 21, color: P.ink2, marginTop: 4 }}>{project.notes}</Text> : null}
        </View>

        {/* Progress */}
        <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, padding: 14, gap: 12, borderWidth: 1, borderColor: P.hairline, ...Shadows.card }}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>Tasks</Text>
              <Text style={{ fontFamily: NumFont.semiBold, fontSize: 13, color: P.ink2 }}>{g.tasksDone} of {g.tasksTotal}</Text>
            </View>
            <View style={{ height: 6, backgroundColor: P.hairline, borderRadius: 3, overflow: 'hidden' }}>
              {g.taskRatio !== null ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(g.taskRatio * 100)}%`, backgroundColor: color, borderRadius: 3 }} /> : null}
            </View>
          </View>
          {g.milestonesTotal > 0 ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink }}>Milestones</Text>
                <Text style={{ fontFamily: NumFont.semiBold, fontSize: 13, color: P.ink2 }}>{g.milestonesDone} of {g.milestonesTotal}</Text>
              </View>
              <View style={{ height: 6, backgroundColor: P.hairline, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((g.milestonesDone / g.milestonesTotal) * 100)}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
            </View>
          ) : null}
        </View>

        {milestones.length > 0 ? (
          <>
            {section('MILESTONES')}
            <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
              {milestones.map((m, i) => {
                const late = !m.done && !!m.due_date && m.due_date < today;
                return (
                  <View key={m.id} accessible accessibilityLabel={`${m.title}, ${m.done ? 'done' : 'not done'}${m.due_date ? `, due ${fmtDate(m.due_date)}` : ''}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < milestones.length - 1 ? 1 : 0, borderBottomColor: P.hairline }}>
                    {m.done ? <Check size={18} color={P.positive} /> : <Circle size={18} color={late ? P.negative : P.ink4} />}
                    <Text style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 14, color: m.done ? P.ink3 : P.ink, textDecorationLine: m.done ? 'line-through' : 'none' }}>{m.title}</Text>
                    {m.due_date ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: late ? P.negative : P.ink3 }}>{fmtDate(m.due_date)}</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {section('OPEN TASKS', open.length ? String(open.length) : undefined)}
        {open.length === 0 ? (
          <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, paddingHorizontal: 2 }}>{mine.length === 0 ? 'No tasks in this project yet.' : 'Nothing left open.'}</Text>
        ) : (
          <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
            {open.map((t, i) => (
              <Pressable key={t.id} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, minHeight: 48, borderBottomWidth: i < open.length - 1 ? 1 : 0, borderBottomColor: P.hairline }}>
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 14, color: P.ink }}>{t.title}</Text>
                {t.due_date ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: t.due_date < today ? P.negative : P.ink3 }}>{fmtDate(t.due_date)}</Text> : null}
                <ChevronRight size={14} color={P.ink4} />
              </Pressable>
            ))}
          </View>
        )}

        {done.length > 0 ? (
          <>
            {section('DONE', String(done.length))}
            <View style={{ gap: 6, paddingHorizontal: 2 }}>
              {done.slice(0, 8).map(t => (
                <Text key={t.id} numberOfLines={1} style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, textDecorationLine: 'line-through' }}>{t.title}</Text>
              ))}
              {done.length > 8 ? <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: P.ink3 }}>and {done.length - 8} more</Text> : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
