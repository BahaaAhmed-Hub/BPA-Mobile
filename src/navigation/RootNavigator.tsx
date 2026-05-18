import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { handleAuthCallback } from '../lib/google';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { TabNavigator } from './TabNavigator';
import { LoadingScreen } from '../screens/LoadingScreen';
import { TaskDetailScreen } from '../screens/tasks/TaskDetailScreen';

export type RootStackParamList = {
  App: undefined;
  Login: undefined;
  TaskDetail: { taskId: string };
};
import { useTaskStore } from '../store/taskStore';
import { useHabitStore } from '../store/habitStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user      = useAuthStore(s => s.user);
  const loading   = useAuthStore(s => s.loading);
  const setUser   = useAuthStore(s => s.setUser);
  const setLoading= useAuthStore(s => s.setLoading);
  const clearTasks  = useTaskStore(s => s.clearAll);
  const clearHabits = useHabitStore(s => s.clearAll);

  useEffect(() => {
    // Initial session check
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '', name: u.user_metadata?.full_name as string | undefined, avatarUrl: u.user_metadata?.avatar_url as string | undefined } : null);
      setLoading(false);
    });

    // Listen for sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '', name: u.user_metadata?.full_name as string | undefined, avatarUrl: u.user_metadata?.avatar_url as string | undefined } : null);
      setLoading(false);
      if (!session) { clearTasks(); clearHabits(); }
    });

    // Deep-link OAuth callback (when the in-app browser hands the URL back)
    const sub = Linking.addEventListener('url', ({ url }) => { void handleAuthCallback(url); });
    void Linking.getInitialURL().then(url => { if (url) void handleAuthCallback(url); });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, [setUser, setLoading, clearTasks, clearHabits]);

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="App" component={TabNavigator} />
            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
