import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../lib/google';
import { useBehavioralStore, MODES } from '../../store/behavioralStore';
import { C, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';
import type { RootStackParamList } from '../../navigation/RootNavigator';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(s => s.user);
  const enabled = useBehavioralStore(s => s.enabled);
  const mode    = useBehavioralStore(s => s.mode);
  const modeMeta = enabled ? MODES[mode] : MODES.default;

  async function handleSignOut() {
    Alert.alert('Sign out', 'You\'ll need to sign in again next time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <TopBar title="Profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 16 }}>
        <View style={{
          backgroundColor: C.card, borderRadius: Radii.md, padding: 20,
          borderWidth: 1, borderColor: C.hairline,
          alignItems: 'center', gap: 10,
          ...Shadows.card,
        }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: C.indigoSoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 28, color: C.indigo }}>
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: C.ink }}>
            {user?.name ?? 'Operator'}
          </Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: C.ink3 }}>{user?.email ?? ''}</Text>
        </View>

        <SettingsRow
          label="Behavioral OS"
          hint={enabled ? `${modeMeta.emoji}  ${modeMeta.name} mode` : 'Off · default theme'}
          onPress={() => navigation.navigate('BehavioralMode')}
        />
        <SettingsRow label="Notifications" hint="Push alerts coming in v1.2" disabled />
        <SettingsRow label="Connected Google account" hint="Calendar / Gmail sync coming soon" disabled />

        <Pressable onPress={handleSignOut}>
          <View style={{
            backgroundColor: 'rgba(178,58,54,0.08)',
            borderRadius: Radii.md, padding: 16, alignItems: 'center',
            borderWidth: 1, borderColor: 'rgba(178,58,54,0.18)',
          }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: C.red }}>Sign out</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({
  label, hint, onPress, disabled,
}: {
  label: string; hint?: string; onPress?: () => void; disabled?: boolean;
}) {
  const inner = (
    <View style={{
      backgroundColor: C.card, borderRadius: Radii.md, padding: 14,
      borderWidth: 1, borderColor: C.hairline,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      opacity: disabled ? 0.6 : 1,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink3, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color: C.ink3, fontSize: 18 }}>›</Text>
    </View>
  );
  if (disabled || !onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}
