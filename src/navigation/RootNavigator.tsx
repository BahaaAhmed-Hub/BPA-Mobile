import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { handleAuthCallback } from '../lib/google';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { TabNavigator } from './TabNavigator';
import { LoadingScreen } from '../screens/LoadingScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TaskDetailScreen } from '../screens/tasks/TaskDetailScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SetupWizard, WIZARD_DONE_KEY } from '../screens/wizard/SetupWizard';
import { BehavioralModeScreen } from '../screens/behavioral/BehavioralModeScreen';
import { InboxScreen } from '../screens/inbox/InboxScreen';
import { EventDetailScreen } from '../screens/calendar/EventDetailScreen';
import { WeeklyReviewScreen } from '../screens/review/WeeklyReviewScreen';
import { EnergyLogScreen } from '../screens/energy/EnergyLogScreen';
import { AssistantScreen } from '../screens/assistant/AssistantScreen';
import { HabitDetailScreen } from '../screens/habits/HabitDetailScreen';
import { HabitEditScreen } from '../screens/habits/HabitEditScreen';
import { AppearanceScreen } from '../screens/settings/AppearanceScreen';
import { SettingsPlaceholderScreen } from '../screens/settings/SettingsPlaceholderScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { useProjectStore } from '../store/projectStore';
import { ShoppingScreen } from '../screens/shopping/ShoppingScreen';
import { useShoppingStore } from '../store/shoppingStore';
import { LibraryScreen, LibraryBookScreen } from '../screens/library/LibraryScreen';
import { useLibraryStore } from '../store/libraryStore';
import { useModuleStore } from '../store/moduleStore';
import { useMailStore } from '../store/mailStore';

export type RootStackParamList = {
  App: undefined;
  Login: undefined;
  TaskDetail: { taskId: string };
  Notifications: undefined;
  BehavioralMode: undefined;
  Inbox: undefined;
  EventDetail: { eventId: string };
  WeeklyReview: undefined;
  EnergyLog: undefined;
  PlanningAssistant: undefined;
  HabitDetail: { habitId: string };
  HabitEdit: { habitId: string };
  SettingsAppearance: undefined;
  SettingsDetail: { title: string };
  Search: undefined;
  Projects: undefined;
  Shopping: undefined;
  Library: undefined;
  LibraryBook: { bookId: string };
  ProjectDetail: { projectId: string };
};
import { refreshIfStale } from '../lib/refresh';
import { useTaskStore } from '../store/taskStore';
import { useHabitStore } from '../store/habitStore';
import { useCompanyStore } from '../store/companyStore';

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
      if (session) {
        void import('../lib/pushNotifications').then(m => m.registerForPushNotifications());
      }
      if (!session) { clearTasks(); clearHabits(); useCompanyStore.getState().clearAll(); useProjectStore.getState().clearAll(); useShoppingStore.getState().clearAll(); useLibraryStore.getState().clearAll(); useModuleStore.getState().clearAll(); useMailStore.getState().clearAll(); }
    });

    // Deep-link OAuth callback (when the in-app browser hands the URL back)
    const sub = Linking.addEventListener('url', ({ url }) => { void handleAuthCallback(url); });
    void Linking.getInitialURL().then(url => { if (url) void handleAuthCallback(url); });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, [setUser, setLoading, clearTasks, clearHabits]);

  // Coming back to the app pulls fresh data, at most once a minute and never
  // while the server is failing — see lib/refresh.ts.
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshIfStale();
    });
    return () => sub.remove();
  }, [user]);

  const [wizardChecked, setWizardChecked] = useState(false);
  const [showWizard, setShowWizard]       = useState(false);

  useEffect(() => {
    if (!user) { setWizardChecked(false); setShowWizard(false); return; }
    void AsyncStorage.getItem(WIZARD_DONE_KEY).then(v => {
      setShowWizard(v !== '1');
      setWizardChecked(true);
    });
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (user && !wizardChecked) return <LoadingScreen />;
  if (user && showWizard) return <SetupWizard onDone={() => setShowWizard(false)} />;

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
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="BehavioralMode"
              component={BehavioralModeScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Inbox"
              component={InboxScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="WeeklyReview"
              component={WeeklyReviewScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="EnergyLog"
              component={EnergyLogScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PlanningAssistant"
              component={AssistantScreen}
              options={{ presentation: 'card', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="HabitDetail"
              component={HabitDetailScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="HabitEdit"
              component={HabitEditScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Library"
              component={LibraryScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="LibraryBook"
              component={LibraryBookScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Shopping"
              component={ShoppingScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Projects"
              component={ProjectsScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ProjectDetail"
              component={ProjectDetailScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
            <Stack.Screen
              name="SettingsAppearance"
              component={AppearanceScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="SettingsDetail"
              component={SettingsPlaceholderScreen}
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
