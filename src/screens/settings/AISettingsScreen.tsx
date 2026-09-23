import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii, Shadows } from '../../theme/tokens';

const MODELS = [
  { id: 'sonnet', name: 'Sonnet 4.5', desc: 'Fast · balanced · default for everything', recommended: true },
  { id: 'opus',   name: 'Opus 4.1',   desc: 'Deeper reasoning · weekly read and planning' },
  { id: 'haiku',  name: 'Haiku',      desc: 'Instant · triage and quick replies' },
];

const AUTONOMY = [
  { id: 'suggest', label: 'Suggest', desc: 'It tells you what it would do' },
  { id: 'draft',   label: 'Draft & hold', desc: 'It writes the reply and waits for you' },
  { id: 'act',     label: 'Act', desc: 'It sends, files and books without asking' },
];

const TONE = [
  { id: 'direct', label: 'Direct' },
  { id: 'formal', label: 'Formal' },
  { id: 'warm',   label: 'Warm' },
];

export function AISettingsScreen() {
  const navigation = useNavigation();
  const P = useScreenPalette();
  const [model, setModel] = useState('sonnet');
  const [autonomy, setAutonomy] = useState('suggest');
  const [tone, setTone] = useState('direct');

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
          AI
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>
        {/* Model */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Model
          </Text>
          <View style={{ gap: 8 }}>
            {MODELS.map(m => {
              const active = model === m.id;
              return (
                <Pressable key={m.id} onPress={() => setModel(m.id)}>
                  <View style={{
                    backgroundColor: P.surface, borderRadius: Radii.md,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? P.accent : P.hairline,
                    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                    ...Shadows.card,
                  }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>{m.name}</Text>
                        {m.recommended && (
                          <View style={{
                            paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill,
                            backgroundColor: P.accentTint, borderWidth: 1, borderColor: P.accentBorder,
                          }}>
                            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 9, color: P.ink, letterSpacing: 0.6 }}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>{m.desc}</Text>
                    </View>
                    {active && (
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: P.accentInk, fontSize: 11, fontFamily: UIFont.bold }}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 8 }}>
            Opus for the weekly read, Haiku for triage — you can set it per job.
          </Text>
        </View>

        {/* Autonomy */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            How far it may go
          </Text>
          <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
            {AUTONOMY.map((opt, i) => {
              const active = autonomy === opt.id;
              return (
                <Pressable key={opt.id} onPress={() => setAutonomy(opt.id)}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: i < AUTONOMY.length - 1 ? 1 : 0, borderColor: P.hairline,
                    backgroundColor: active ? P.accentTint : P.surface,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{opt.label}</Text>
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>{opt.desc}</Text>
                    </View>
                    {active && (
                      <View style={{
                        width: 18, height: 18, borderRadius: 9,
                        backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: P.accentInk, fontSize: 10, fontFamily: UIFont.bold }}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tone */}
        <View>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            What it may write
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TONE.map(t => {
              const active = tone === t.id;
              return (
                <Pressable key={t.id} onPress={() => setTone(t.id)} style={{ flex: 1 }}>
                  <View style={{
                    paddingVertical: 11, borderRadius: Radii.md, borderWidth: 1,
                    borderColor: active ? P.accentBorder : P.hairline,
                    backgroundColor: active ? P.accentTint : P.field,
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: active ? P.ink : P.ink2 }}>
                      {t.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Safety note */}
        <View style={{ padding: 14, backgroundColor: P.field, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline }}>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, lineHeight: 18 }}>
            ✦ A sign-in alert never offers a draft — only a person writing to you, or an invitation, can be something you owe an answer to.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
