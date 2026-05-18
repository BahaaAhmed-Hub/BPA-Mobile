import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle } from '../../lib/google';
import { supabase } from '../../lib/supabase';
import { C, Radii } from '../../theme/tokens';
import { Logo } from '../../components/atoms/Logo';
import { MODES, useBehavioralStore } from '../../store/behavioralStore';

export function LoginScreen() {
  const [signing, setSigning] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const enabled = useBehavioralStore(s => s.enabled);
  const mode    = useBehavioralStore(s => s.mode);
  const T = enabled ? MODES[mode] : MODES.default;

  async function handleGoogle() {
    setSigning(true);
    try { await signInWithGoogle(); }
    catch (e) { Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Unknown error'); }
    finally { setSigning(false); }
  }

  async function handleEmail() {
    if (!email || !password) return;
    setSigning(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigning(false);
    if (error) Alert.alert('Sign-in failed', error.message);
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Mode-aware atmospheric glows */}
      <LinearGradient
        colors={[T.glow, 'transparent']}
        style={{ position: 'absolute', top: -120, left: -100, width: 420, height: 420, borderRadius: 210 }}
      />
      <LinearGradient
        colors={[T.glow, 'transparent']}
        style={{ position: 'absolute', bottom: -100, right: -80, width: 360, height: 360, borderRadius: 180 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, paddingHorizontal: 28, paddingTop: 32, justifyContent: 'space-between' }}
        >
          {/* Brand */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Logo size={44} />
            <View>
              <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold', fontSize: 20, letterSpacing: -0.3 }}>
                The Professor
              </Text>
              {T.badge ? (
                <Text style={{ color: T.accentBright, fontFamily: 'Inter_700Bold', fontSize: 10, marginTop: 3, letterSpacing: 2 }}>
                  {T.badge}
                </Text>
              ) : (
                <Text style={{ color: T.textDim, fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2, letterSpacing: 1.4 }}>
                  BPA · DAILY DISCIPLINE
                </Text>
              )}
            </View>
          </View>

          {/* Hero copy */}
          <View>
            <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold', fontSize: 40, letterSpacing: -1.5, lineHeight: 44 }}>
              {T.id === 'samurai' ? 'Discipline.' : T.id === 'pharaoh' ? 'Build Your' : T.id === 'astral' ? 'Think in' : 'Your AI Executive'}
            </Text>
            <Text style={{ color: T.accentBright, fontFamily: 'Inter_800ExtraBold', fontSize: 40, letterSpacing: -1.5, lineHeight: 44, marginTop: 4 }}>
              {T.id === 'samurai' ? 'Precision. Mastery.' : T.id === 'pharaoh' ? 'Legacy.' : T.id === 'astral' ? 'Horizons.' : 'Operating System'}
            </Text>
            <Text style={{ color: T.textDim, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 18, maxWidth: 320 }}>
              {T.tagline}
            </Text>
          </View>

          {/* Auth actions */}
          <View style={{ gap: 12, paddingBottom: 12 }}>
            {showEmail && (
              <View style={{ gap: 10, marginBottom: 6 }}>
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={`${T.text}60`}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{ ...inputStyle, color: T.text }}
                />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={`${T.text}60`}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={{ ...inputStyle, color: T.text }}
                />
                <Pressable
                  onPress={handleEmail}
                  disabled={signing}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? T.accent : T.accentBright,
                    paddingVertical: 14,
                    borderRadius: Radii.sm,
                    alignItems: 'center',
                    opacity: signing ? 0.7 : 1,
                  })}
                >
                  {signing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: T.bg, fontFamily: 'Inter_700Bold', fontSize: 15 }}>Sign in with email</Text>}
                </Pressable>
              </View>
            )}

            <Pressable
              onPress={handleGoogle}
              disabled={signing}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                paddingVertical: 15,
                paddingHorizontal: 24,
                borderRadius: Radii.sm,
                backgroundColor: pressed ? `${T.accent}40` : `${T.accent}22`,
                borderWidth: 1.5,
                borderColor: `${T.accentBright}80`,
                opacity: signing ? 0.7 : 1,
              })}
            >
              <GoogleG />
              <Text style={{ color: T.text, fontFamily: 'Inter_700Bold', fontSize: 15 }}>
                {signing ? 'Redirecting…' : 'Continue with Google'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setShowEmail(s => !s)}>
              <Text style={{ color: T.textDim, fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' }}>
                {showEmail ? 'Hide email sign-in' : 'Use email and password instead'}
              </Text>
            </Pressable>

            <Text style={{ color: T.textDim, opacity: 0.6, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              Your data is isolated and encrypted. Only you can access it.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderRadius: Radii.sm,
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: '#E8EAF6',
  fontFamily: 'Inter_500Medium',
  fontSize: 15,
} as const;

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <Path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" />
    </Svg>
  );
}

export { C };
