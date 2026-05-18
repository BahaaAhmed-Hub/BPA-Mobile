import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, CheckSquare, Flame, Home, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { TodayScreen } from '../screens/today/TodayScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { HabitsScreen } from '../screens/habits/HabitsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { AddTaskSheet } from '../components/atoms/AddTaskSheet';
import { C, Shadows } from '../theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: C.indigo,
          tabBarInactiveTintColor: C.ink3,
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopColor: C.hairline,
            paddingTop: 6,
            height: 84,
          },
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
        <Tab.Screen name="Profile" component={ProfileScreen}
          options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} /> }} />
      </Tab.Navigator>

      {/* Center FAB — signature gradient (indigo → red) */}
      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 38, left: 0, right: 0, alignItems: 'center' }}>
        <Pressable onPress={() => setAddTaskOpen(true)} hitSlop={8}>
          <LinearGradient
            colors={['#2A3FD9', '#B23A36']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 56, height: 56, borderRadius: 28,
              alignItems: 'center', justifyContent: 'center',
              ...Shadows.pop,
            }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 28 }}>＋</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <AddTaskSheet visible={addTaskOpen} onClose={() => setAddTaskOpen(false)} />
    </View>
  );
}
