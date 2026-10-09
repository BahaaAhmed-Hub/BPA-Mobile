import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, CheckSquare, Flame, Home, User, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { TodayScreen } from '../screens/today/TodayScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { HabitsScreen } from '../screens/habits/HabitsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { AddTaskSheet } from '../components/atoms/AddTaskSheet';
import { AddEventSheet } from '../components/atoms/AddEventSheet';
import { AddExpenseSheet } from '../components/atoms/AddExpenseSheet';
import { C, Shadows } from '../theme/tokens';
import { UIFont } from '../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsTablet } from '../lib/layout';

const Tab = createBottomTabNavigator();

const TAB_H = 84;

type Sheet = 'task' | 'event' | 'expense' | null;

const DIAL_ITEMS: { id: Sheet; label: string; color: string; Icon: typeof CheckSquare }[] = [
  { id: 'task',    label: 'Task',    color: C.violet,   Icon: CheckSquare },
  { id: 'event',   label: 'Event',   color: C.cat4,     Icon: CalendarDays },
  { id: 'expense', label: 'Expense', color: C.negative, Icon: Wallet },
];

export function TabNavigator() {
  const [dialOpen, setDialOpen]   = useState(false);
  const [sheet, setSheet]         = useState<Sheet>(null);
  const tablet = useIsTablet();

  function openSheet(id: Sheet) {
    setDialOpen(false);
    setSheet(id);
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        // @ts-expect-error tabBarPosition: 'left' is supported in v7 but not yet typed
        tabBarPosition={tablet ? 'left' : 'bottom'}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: C.indigo,
          tabBarInactiveTintColor: C.ink3,
          tabBarLabelStyle: tablet
            ? { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 4 }
            : { fontFamily: 'Inter_500Medium', fontSize: 11 },
          tabBarStyle: tablet
            ? {
                backgroundColor: C.card,
                borderRightWidth: 1,
                borderRightColor: C.hairline,
                width: 220,
                paddingTop: 16,
              }
            : {
                backgroundColor: C.card,
                borderTopColor: C.hairline,
                paddingTop: 6,
                height: TAB_H,
              },
          tabBarItemStyle: tablet
            ? { paddingVertical: 4, marginHorizontal: 8, borderRadius: 12 }
            : undefined,
        }}
      >
        <Tab.Screen name="Today" component={TodayScreen}
          options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} /> }} />
        <Tab.Screen name="Tasks" component={TasksScreen}
          options={{ tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size - 2} /> }} />
        <Tab.Screen name="Calendar" component={CalendarScreen}
          options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size - 2} /> }} />
        <Tab.Screen name="Habits" component={HabitsScreen}
          options={{ tabBarIcon: ({ color, size }) => <Flame color={color} size={size - 2} /> }} />
        <Tab.Screen name="Finance" component={FinanceScreen}
          options={{ tabBarIcon: ({ color, size }) => <Wallet color={color} size={size - 2} /> }} />
        <Tab.Screen name="Profile" component={ProfileScreen}
          options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} /> }} />
      </Tab.Navigator>

      {/* Speed-dial backdrop — dismiss on outside tap */}
      {dialOpen && (
        <Pressable
          onPress={() => setDialOpen(false)}
          style={{ position: 'absolute', inset: 0 }}
        />
      )}

      {/* FAB + speed-dial — floats above the tab bar */}
      {!tablet && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: TAB_H + 12, left: 0, right: 0, alignItems: 'center' }}
        >
          {/* Speed-dial options (visible when open) */}
          {dialOpen && (
            <View style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {DIAL_ITEMS.map(({ id, label, color, Icon }) => (
                <Pressable
                  key={id}
                  onPress={() => openSheet(id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: C.card,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 24,
                    opacity: pressed ? 0.8 : 1,
                    ...Shadows.card,
                  })}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: `${color}18`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={color} />
                  </View>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: C.ink }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Main FAB */}
          <Pressable onPress={() => setDialOpen(o => !o)} hitSlop={8}>
            <LinearGradient
              colors={dialOpen ? ['#B23A36', '#2A3FD9'] : ['#2A3FD9', '#B23A36']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                width: 56, height: 56, borderRadius: 28,
                alignItems: 'center', justifyContent: 'center',
                ...Shadows.pop,
              }}
            >
              <Text style={{
                color: '#fff',
                fontFamily: 'Inter_700Bold',
                fontSize: 28,
                lineHeight: 30,
                transform: [{ rotate: dialOpen ? '45deg' : '0deg' }],
              }}>
                ＋
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* Tablet FAB (bottom-right) */}
      {tablet && (
        <View style={{ position: 'absolute', bottom: 32, right: 32 }}>
          <Pressable onPress={() => setDialOpen(o => !o)} hitSlop={8}>
            <LinearGradient
              colors={['#2A3FD9', '#B23A36']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                width: 56, height: 56, borderRadius: 28,
                alignItems: 'center', justifyContent: 'center',
                ...Shadows.pop,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 30 }}>＋</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <AddTaskSheet    visible={sheet === 'task'}    onClose={() => setSheet(null)} />
      <AddEventSheet   visible={sheet === 'event'}   onClose={() => setSheet(null)} />
      <AddExpenseSheet visible={sheet === 'expense'} onClose={() => setSheet(null)} />
    </View>
  );
}
