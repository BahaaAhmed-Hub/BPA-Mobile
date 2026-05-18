import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../lib/google';
import { C, Radii, Shadows } from '../../theme/tokens';
import { TopBar } from '../../components/atoms/TopBar';

export function ProfileScreen() {
  const user = useAuthStore(s => s.user);

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

        <SettingsRow label="Notifications" hint="Coming soon" disabled />
        <SettingsRow label="Connected Google account" hint="Calendar / Gmail sync coming in v1.1" disabled />
        <SettingsRow label="Theme" hint="Light only for now" disabled />

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

function SettingsRow({ label, hint, disabled }: { label: string; hint?: string; disabled?: boolean }) {
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: Radii.md, padding: 14,
      borderWidth: 1, borderColor: C.hairline,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      opacity: disabled ? 0.6 : 1,
    }}>
      <View>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink3, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color: C.ink3, fontSize: 18 }}>›</Text>
    </View>
  );
}
