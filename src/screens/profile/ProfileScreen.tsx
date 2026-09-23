import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../lib/google';
import { useBehavioralStore, MODES } from '../../store/behavioralStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { TopBar } from '../../components/atoms/TopBar';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { UIFont, NumFont } from '../../theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SECTIONS: Array<{
  eyebrow: string;
  rows: Array<{
    label: string;
    hint?: string;
    route?: keyof RootStackParamList;
    routeParams?: Record<string, string>;
    onPress?: (nav: Nav) => void;
    isDanger?: boolean;
  }>;
}> = [
  {
    eyebrow: 'YOU',
    rows: [
      { label: 'Profile', hint: 'Name, timezone, work week & framework', route: 'SettingsDetail', routeParams: { title: 'Profile' } },
      { label: 'Billing', hint: 'Plan, payment method and invoices', route: 'SettingsDetail', routeParams: { title: 'Billing' } },
    ],
  },
  {
    eyebrow: 'WORKSPACE',
    rows: [
      { label: 'Accounts & companies', hint: 'Connected Google accounts and companies', route: 'SettingsDetail', routeParams: { title: 'Accounts' } },
      { label: 'AI', hint: 'Model, autonomy and tone', route: 'SettingsAI' },
      { label: 'Schedule rules', hint: 'Focus hours, buffers, protections', route: 'SettingsDetail', routeParams: { title: 'Schedule' } },
      { label: 'Integrations', hint: 'Notion, Asana and more', route: 'SettingsDetail', routeParams: { title: 'Integrations' } },
      { label: 'Tasks', hint: 'Board statuses and task types', route: 'SettingsDetail', routeParams: { title: 'TasksConfig' } },
      { label: 'Habits', hint: 'Configure daily habits', route: 'SettingsDetail', routeParams: { title: 'HabitsConfig' } },
      { label: 'Automation', hint: 'Rules that run without asking you', route: 'SettingsDetail', routeParams: { title: 'Automation' } },
      { label: 'Notifications', hint: 'What reaches you, where, and when', route: 'SettingsDetail', routeParams: { title: 'NotificationsConfig' } },
    ],
  },
  {
    eyebrow: 'DISPLAY',
    rows: [
      { label: 'Appearance', hint: 'Accent colour, theme and density', route: 'SettingsAppearance' },
      { label: 'Behavioral OS', hint: 'Mentor persona and accent tint', route: 'BehavioralMode' },
    ],
  },
  {
    eyebrow: 'TOOLS',
    rows: [
      { label: 'Inbox', hint: 'Triaged email actions', route: 'Inbox' },
      { label: 'Weekly Review', hint: 'Shipped, slipped, focus & meeting hours', route: 'WeeklyReview' },
      { label: 'Energy Log', hint: 'Daily morning & afternoon energy', route: 'EnergyLog' },
      { label: 'Planning Assistant', hint: 'AI executive coaching · ask anything', route: 'PlanningAssistant' },
      { label: 'Notifications', hint: 'Activity signals', route: 'Notifications' },
    ],
  },
  {
    eyebrow: 'DATA',
    rows: [
      { label: 'Data & privacy', hint: 'Where your data sits and how long', route: 'SettingsDetail', routeParams: { title: 'DataPrivacy' } },
      { label: 'Finance settings', hint: 'Envelope style, figures, dates & alerts', route: 'SettingsDetail', routeParams: { title: 'FinanceSettings' } },
    ],
  },
];

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const P = useScreenPalette();
  const user     = useAuthStore(s => s.user);
  const enabled  = useBehavioralStore(s => s.enabled);
  const mode     = useBehavioralStore(s => s.mode);
  const modeMeta = enabled ? MODES[mode] : MODES.default;

  async function handleSignOut() {
    Alert.alert('Sign out', "You'll need to sign in again next time.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  const initials = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();
  const displayName = user?.name ?? 'Operator';
  const company = displayName.includes('@') ? displayName.split('@')[1]?.split('.')[0] : 'DX Technologies';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 18 }}>

        {/* Identity card */}
        <View style={{
          backgroundColor: '#1F1A14', borderRadius: Radii.md, padding: 18,
          flexDirection: 'row', alignItems: 'center', gap: 14,
          ...Shadows.card,
        }}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: `${P.accent}30`,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: P.accent,
          }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 22, color: P.accent }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: NumFont.bold, fontSize: 17, color: '#FDF8E7', letterSpacing: -0.3 }}>
              {displayName}
            </Text>
            <Text style={{ fontFamily: UIFont.medium, fontSize: 12, color: 'rgba(253,248,231,0.5)', marginTop: 2 }}>
              {user?.email ?? ''}{company ? ` · ${company}` : ''}
            </Text>
          </View>
          {enabled && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill,
              backgroundColor: `${modeMeta.accentBright}22`, borderWidth: 1, borderColor: `${modeMeta.accentBright}40`,
            }}>
              <Text style={{ fontFamily: UIFont.bold, fontSize: 10, color: modeMeta.accentBright, letterSpacing: 1.2 }}>
                {modeMeta.emoji} {modeMeta.name.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Settings sections */}
        {SECTIONS.map(section => (
          <View key={section.eyebrow}>
            <Text style={{
              fontFamily: UIFont.semiBold, fontSize: 11,
              color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              {section.eyebrow}
            </Text>
            <View style={{
              backgroundColor: P.surface, borderRadius: Radii.md,
              borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
            }}>
              {section.rows.map((row, ri) => {
                function handlePress() {
                  if (row.onPress) { row.onPress(navigation); return; }
                  if (!row.route) return;
                  if (row.route === 'SettingsDetail' && row.routeParams) {
                    navigation.navigate('SettingsDetail', row.routeParams as { title: string });
                  } else if (row.route === 'SettingsAI') {
                    navigation.navigate('SettingsAI');
                  } else if (row.route === 'SettingsAppearance') {
                    navigation.navigate('SettingsAppearance');
                  } else if (row.route === 'BehavioralMode') {
                    navigation.navigate('BehavioralMode');
                  } else if (row.route === 'Inbox') {
                    navigation.navigate('Inbox');
                  } else if (row.route === 'WeeklyReview') {
                    navigation.navigate('WeeklyReview');
                  } else if (row.route === 'EnergyLog') {
                    navigation.navigate('EnergyLog');
                  } else if (row.route === 'PlanningAssistant') {
                    navigation.navigate('PlanningAssistant');
                  } else if (row.route === 'Notifications') {
                    navigation.navigate('Notifications');
                  }
                }

                return (
                  <Pressable key={ri} onPress={handlePress}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 13,
                      borderBottomWidth: ri < section.rows.length - 1 ? 1 : 0,
                      borderColor: P.hairline,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: row.isDanger ? P.negative : P.ink }}>
                          {row.label}
                        </Text>
                        {row.hint ? (
                          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>
                            {row.hint}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={{ color: P.ink3, fontSize: 18 }}>›</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <Pressable onPress={handleSignOut}>
          <View style={{
            backgroundColor: P.negativeTint, borderRadius: Radii.md,
            padding: 16, alignItems: 'center',
            borderWidth: 1, borderColor: `${P.negative}30`,
          }}>
            <Text style={{ fontFamily: UIFont.bold, fontSize: 15, color: P.negative }}>Sign out</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
