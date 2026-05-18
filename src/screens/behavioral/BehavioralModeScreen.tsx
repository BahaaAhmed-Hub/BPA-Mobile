import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBehavioralStore, MODES, BehavioralMode } from '../../store/behavioralStore';
import { C, Radii } from '../../theme/tokens';

export function BehavioralModeScreen() {
  const navigation = useNavigation();
  const { enabled, mode, setEnabled, setMode } = useBehavioralStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline,
        }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: C.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.ink2 }}>
          Behavioral OS
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 20 }}>
        <View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.red, letterSpacing: 1.5 }}>MENTOR</Text>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 26, color: C.ink, letterSpacing: -0.5, marginTop: 6 }}>
            Pick your mode.
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: C.ink2, marginTop: 8, lineHeight: 20 }}>
            Each behavioral mode reframes how your mentor talks to you and tints the visual mood of the app. Off keeps the default Navy Night theme.
          </Text>
        </View>

        {/* Master toggle */}
        <View style={{
          backgroundColor: C.card, borderRadius: Radii.md,
          borderWidth: 1, borderColor: C.hairline,
          paddingHorizontal: 16, paddingVertical: 14,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.ink }}>Behavioral Mode</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink3, marginTop: 2 }}>
              {enabled ? 'Active — login + accents reflect your mode' : 'Off — default theme everywhere'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: '#D8DDE6', true: C.green }}
            thumbColor="#fff"
          />
        </View>

        {/* Mode cards */}
        <View style={{ gap: 12, opacity: enabled ? 1 : 0.5 }}>
          {(['samurai', 'pharaoh', 'astral'] as BehavioralMode[]).map(id => {
            const m = MODES[id];
            const selected = enabled && mode === id;
            return (
              <Pressable
                key={id}
                onPress={() => { if (m.available && enabled) setMode(id); }}
                disabled={!m.available || !enabled}
              >
                <View style={{
                  borderRadius: Radii.md, overflow: 'hidden',
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? m.accentBright : C.hairline,
                }}>
                  <LinearGradient
                    colors={[m.bg, m.bg]}
                    style={{ padding: 18, position: 'relative' }}
                  >
                    {/* Glow corner */}
                    <View style={{
                      position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80,
                      backgroundColor: m.glow,
                    }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                        <View>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: m.text }}>{m.name}</Text>
                          {m.badge ? (
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: m.accentBright, letterSpacing: 2, marginTop: 2 }}>
                              {m.badge}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {!m.available ? (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                            COMING SOON
                          </Text>
                        </View>
                      ) : selected ? (
                        <View style={{
                          width: 24, height: 24, borderRadius: 12,
                          backgroundColor: m.accentBright,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: m.bg, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 13 }}>✓</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: m.textDim, marginTop: 14, lineHeight: 19 }}>
                      {m.tagline}
                    </Text>
                  </LinearGradient>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{
          padding: 14, backgroundColor: '#F7F8FB', borderRadius: Radii.sm,
        }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.ink2, lineHeight: 18 }}>
            ✦ Mode picker shipped. Full in-app theming (sidebar, cards, all surfaces re-tinted per mode) is on the roadmap — for now only the Login screen reflects your mode.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
