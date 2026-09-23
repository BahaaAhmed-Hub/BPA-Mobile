import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@bpa/theme';

const THEMES = [
  {
    id: 'sunlit',
    name: 'Sunlit Bento',
    desc: 'Warm cream and golden accents. Default.',
    bg: '#F7F4EA', accent: '#F5D14E', ink: '#191712',
  },
  {
    id: 'glass',
    name: 'Glass & Depth',
    desc: 'Dark violet. For night owls and focus sessions.',
    bg: '#0B0A12', accent: '#A78BFA', ink: '#E8E4FF',
  },
];

const DENSITY = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'cosy',        label: 'Cosy' },
  { id: 'compact',     label: 'Compact' },
];

export function AppearanceScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  const [selectedTheme, setSelectedTheme] = useState(P.isDark ? 'glass' : 'sunlit');
  const [density, setDensity] = useState('comfortable');

  async function applyTheme(id: string) {
    setSelectedTheme(id);
    await AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
        }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: NumFont.bold, fontSize: 15, color: P.ink }}>
          Appearance
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>
        {/* Theme */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Theme
          </Text>
          <View style={{ gap: 10 }}>
            {THEMES.map(t => {
              const active = selectedTheme === t.id;
              return (
                <Pressable key={t.id} onPress={() => void applyTheme(t.id)}>
                  <View style={{
                    borderRadius: Radii.md, overflow: 'hidden',
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? P.accent : P.hairline,
                    ...Shadows.card,
                  }}>
                    {/* Preview swatch */}
                    <View style={{
                      backgroundColor: t.bg, height: 56,
                      paddingHorizontal: 14, justifyContent: 'center',
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                    }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.accent }} />
                      <Text style={{ fontFamily: NumFont.bold, fontSize: 14, color: t.ink }}>{t.name}</Text>
                      {active && (
                        <View style={{
                          marginLeft: 'auto', width: 20, height: 20, borderRadius: 10,
                          backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: t.bg, fontSize: 11, fontFamily: UIFont.bold }}>✓</Text>
                        </View>
                      )}
                    </View>
                    {/* Info */}
                    <View style={{
                      backgroundColor: P.surface, paddingHorizontal: 14, paddingVertical: 10,
                      borderTopWidth: 1, borderColor: P.hairline,
                    }}>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2 }}>{t.desc}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 8, lineHeight: 17 }}>
            ✦ The theme takes full effect on the next app launch. Accent colour follows your theme.
          </Text>
        </View>

        {/* Density */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            How much fits on screen
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DENSITY.map(d => {
              const active = density === d.id;
              return (
                <Pressable key={d.id} onPress={() => setDensity(d.id)} style={{ flex: 1 }}>
                  <View style={{
                    paddingVertical: 11, borderRadius: Radii.md,
                    borderWidth: 1, borderColor: active ? P.accentBorder : P.hairline,
                    backgroundColor: active ? P.accentTint : P.field,
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 12, color: active ? P.ink : P.ink2 }}>
                      {d.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Text size */}
        <View style={{
          backgroundColor: P.surface, borderRadius: Radii.md,
          borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 14,
          }}>
            <View>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>Text size</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>Default</Text>
            </View>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink3 }}>›</Text>
          </View>
          <View style={{ height: 1, backgroundColor: P.hairline, marginHorizontal: 16 }} />
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 14,
          }}>
            <View>
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>Reduce motion</Text>
              <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>Simpler transitions</Text>
            </View>
            <Switch
              value={false}
              trackColor={{ false: P.hairline, true: P.positive }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
