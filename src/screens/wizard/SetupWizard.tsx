import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/atoms/Logo';
import { C, Radii } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';

export const WIZARD_DONE_KEY = 'bpa-wizard-done';
export const WIZARD_PREFS_KEY = 'bpa-wizard-prefs';

interface WizardPrefs {
  vows: string[];
  contexts: string[];
  permissions: {
    notifications: boolean;
    calendar: boolean;
    focus: boolean;
    windDown: boolean;
  };
}

const DEFAULT_PREFS: WizardPrefs = {
  vows: [],
  contexts: ['Work', 'Personal'],
  permissions: { notifications: true, calendar: true, focus: false, windDown: true },
};

const VOWS = [
  { e: '🌅', t: 'I do the hard thing first' },
  { e: '🧘', t: 'I protect quiet mornings' },
  { e: '💪', t: 'I move my body daily' },
  { e: '📚', t: 'I read every day' },
  { e: '🤝', t: 'I respond, not react' },
  { e: '🌙', t: 'I sleep before midnight' },
  { e: '📵', t: 'I limit social media' },
  { e: '🥗', t: 'I eat clean' },
];

const CONTEXTS = [
  { name: 'Work',         col: C.indigo },
  { name: 'Side project', col: C.green  },
  { name: 'Personal',     col: C.orange },
  { name: 'Family',       col: C.violet },
  { name: 'Health',       col: C.red    },
  { name: 'Learning',     col: C.blue   },
];

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [prefs, setPrefs] = useState<WizardPrefs>(DEFAULT_PREFS);

  async function finish() {
    await AsyncStorage.multiSet([
      [WIZARD_DONE_KEY, '1'],
      [WIZARD_PREFS_KEY, JSON.stringify(prefs)],
    ]);
    // Persist schedule preferences to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ schedule_rules: prefs as unknown as Record<string, unknown> }).eq('id', user.id);
    }
    onDone();
  }

  async function skip() { await finish(); }

  if (step === 0) return <StepWelcome onGo={() => setStep(1)} onSkip={() => void skip()} />;
  if (step === 1) return (
    <StepVows
      prefs={prefs}
      setPrefs={setPrefs}
      onBack={() => setStep(0)}
      onNext={() => setStep(2)}
      onSkip={() => void skip()}
    />
  );
  if (step === 2) return (
    <StepContexts
      prefs={prefs}
      setPrefs={setPrefs}
      onBack={() => setStep(1)}
      onNext={() => setStep(3)}
      onSkip={() => void skip()}
    />
  );
  return (
    <StepPermissions
      prefs={prefs}
      setPrefs={setPrefs}
      onBack={() => setStep(2)}
      onFinish={() => void finish()}
    />
  );
}

function PageDots({ active, dark = false }: { active: number; dark?: boolean }) {
  const P = useScreenPalette();
  const baseColor = dark ? 'rgba(255,255,255,0.25)' : P.hairline;
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={{
            width: i === active ? 24 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i === active ? (dark ? '#fff' : P.accent) : baseColor,
          }}
        />
      ))}
    </View>
  );
}

function Step1Header({ step, onBack, onSkip }: { step: number; onBack: () => void; onSkip?: () => void }) {
  const P = useScreenPalette();
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onBack} hitSlop={8} style={{
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
      }}>
        <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink2 }}>
        Step {step} of 4
      </Text>
      {onSkip ? (
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.accent }}>Skip</Text>
        </Pressable>
      ) : <View style={{ width: 36 }} />}
    </View>
  );
}

// ─── Step 1 — Welcome ────────────────────────────────────────────────

function StepWelcome({ onGo, onSkip }: { onGo: () => void; onSkip: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E1F' }}>
      <View style={{
        position: 'absolute', top: -100, right: -80, width: 320, height: 320, borderRadius: 160,
        backgroundColor: 'rgba(178,58,54,0.4)',
      }} />
      <View style={{
        position: 'absolute', bottom: -100, left: -80, width: 320, height: 320, borderRadius: 160,
        backgroundColor: 'rgba(42,63,217,0.3)',
      }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: 28 }}><Logo size={48} /></View>
        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center' }}>
          <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.6 }}>
            ✦ THE PROFESSOR
          </Text>
          <Text style={{
            fontFamily: NumFont.bold, fontSize: 38, color: '#fff',
            letterSpacing: -1, lineHeight: 42, marginTop: 12,
          }}>
            Your daily{'\n'}discipline coach.
          </Text>
          <Text style={{
            fontFamily: UIFont.regular, fontSize: 16, color: 'rgba(255,255,255,0.7)',
            lineHeight: 22, marginTop: 18,
          }}>
            A gentle, samurai-inspired companion for everything you want to ship and become.
          </Text>

          <View style={{ marginTop: 36, gap: 10 }}>
            {[
              { icon: '🎯', t: 'Eisenhower-style task focus' },
              { icon: '✦', t: 'AI mentor that knows your week' },
              { icon: '🔥', t: 'Habits, streaks, and rank' },
            ].map((f, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 10, paddingHorizontal: 14,
                borderRadius: Radii.sm,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 14 }}>{f.icon}</Text>
                </View>
                <Text style={{ fontFamily: UIFont.medium, fontSize: 14, color: '#fff' }}>{f.t}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 28, paddingBottom: 40, gap: 16 }}>
          <PageDots active={0} dark />
          <Pressable onPress={onGo}>
            <LinearGradient
              colors={['#3A4FE3', '#B23A36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 15, paddingHorizontal: 22, borderRadius: Radii.sm, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>Get started</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onSkip}>
            <Text style={{ textAlign: 'center', fontFamily: UIFont.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              Skip setup for now
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Step 2 — Vows ───────────────────────────────────────────────────

function StepVows({
  prefs, setPrefs, onBack, onNext, onSkip,
}: {
  prefs: WizardPrefs; setPrefs: (p: WizardPrefs) => void;
  onBack: () => void; onNext: () => void; onSkip: () => void;
}) {
  const togglePick = (label: string) => {
    const set = new Set(prefs.vows);
    if (set.has(label)) set.delete(label); else set.add(label);
    setPrefs({ ...prefs, vows: Array.from(set) });
  };

  const P = useScreenPalette();
  const picks = prefs.vows.length;
  const canNext = picks >= 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      <Step1Header step={2} onBack={onBack} onSkip={onSkip} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.negative, letterSpacing: 1.6 }}>IDENTITY</Text>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 28, color: P.ink, letterSpacing: -0.7, lineHeight: 32, marginTop: 8 }}>
          What kind of person{'\n'}do you want to be?
        </Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink2, marginTop: 10, lineHeight: 20 }}>
          Pick 3–5 vows. Your mentor will gently hold you to them.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
          {VOWS.map(v => {
            const selected = prefs.vows.includes(v.t);
            return (
              <Pressable key={v.t} onPress={() => togglePick(v.t)} style={{ width: '48.5%' }}>
                <View style={{
                  padding: 14, borderRadius: Radii.sm,
                  backgroundColor: selected ? P.accentTint : P.surface,
                  borderWidth: 1.5, borderColor: selected ? P.accentBorder : P.hairline,
                  position: 'relative',
                }}>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>{v.e}</Text>
                  <Text style={{ fontFamily: UIFont.semiBold, fontSize: 13, color: P.ink, lineHeight: 17 }}>
                    {v.t}
                  </Text>
                  {selected ? (
                    <View style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: P.accentInk, fontFamily: UIFont.bold, fontSize: 11, lineHeight: 11 }}>✓</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}>
        <PageDots active={1} />
        <Pressable
          onPress={canNext ? onNext : undefined}
          disabled={!canNext}
          style={{
            backgroundColor: canNext ? P.accent : P.hairline,
            paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center',
            borderWidth: canNext ? 1 : 0, borderColor: P.accentBorder,
          }}
        >
          <Text style={{ color: canNext ? P.accentInk : P.ink3, fontFamily: UIFont.bold, fontSize: 15 }}>
            {picks ? `${picks} selected · Continue` : 'Pick at least 3'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Step 3 — Contexts ────────────────────────────────────────────────

function StepContexts({
  prefs, setPrefs, onBack, onNext, onSkip,
}: {
  prefs: WizardPrefs; setPrefs: (p: WizardPrefs) => void;
  onBack: () => void; onNext: () => void; onSkip: () => void;
}) {
  const toggle = (name: string) => {
    const set = new Set(prefs.contexts);
    if (set.has(name)) set.delete(name); else set.add(name);
    setPrefs({ ...prefs, contexts: Array.from(set) });
  };
  const P = useScreenPalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      <Step1Header step={3} onBack={onBack} onSkip={onSkip} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.negative, letterSpacing: 1.6 }}>CONTEXTS</Text>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 28, color: P.ink, letterSpacing: -0.7, lineHeight: 32, marginTop: 8 }}>
          The hats{'\n'}you wear.
        </Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink2, marginTop: 10, lineHeight: 20 }}>
          Each context gets its own color so tasks stay sorted by life lane.
        </Text>

        <View style={{ marginTop: 22, gap: 8 }}>
          {CONTEXTS.map(c => {
            const on = prefs.contexts.includes(c.name);
            return (
              <Pressable key={c.name} onPress={() => toggle(c.name)}>
                <View style={{
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderRadius: Radii.sm,
                  backgroundColor: on ? P.surface : P.field,
                  borderWidth: 1.5, borderColor: on ? c.col : P.hairline,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  opacity: on ? 1 : 0.6,
                }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.col }} />
                  <Text style={{ flex: 1, fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink }}>{c.name}</Text>
                  <Toggle on={on} color={c.col} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}>
        <PageDots active={2} />
        <Pressable
          onPress={onNext}
          style={{ backgroundColor: P.accent, paddingVertical: 14, borderRadius: Radii.sm, alignItems: 'center',
            borderWidth: 1, borderColor: P.accentBorder }}
        >
          <Text style={{ color: P.accentInk, fontFamily: UIFont.bold, fontSize: 15 }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Toggle({ on, color }: { on: boolean; color: string }) {
  return (
    <View style={{
      width: 44, height: 26, borderRadius: 13,
      backgroundColor: on ? color : '#D8DDE6',
      padding: 2,
      flexDirection: 'row',
      justifyContent: on ? 'flex-end' : 'flex-start',
    }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
    </View>
  );
}

// ─── Step 4 — Permissions ─────────────────────────────────────────────

function StepPermissions({
  prefs, setPrefs, onBack, onFinish,
}: {
  prefs: WizardPrefs; setPrefs: (p: WizardPrefs) => void;
  onBack: () => void; onFinish: () => void;
}) {
  const perms = [
    { key: 'notifications', icon: '🔔', t: 'Notifications', sub: 'Daily brief, gentle nudges, streak reminders' },
    { key: 'calendar',      icon: '📅', t: 'Calendar access', sub: 'See your meetings, suggest focus blocks' },
    { key: 'focus',         icon: '⏱',  t: 'Focus mode', sub: 'Mute distractions during your blocks' },
    { key: 'windDown',      icon: '🌙', t: 'Wind-down', sub: 'Switch to night mode after 9pm' },
  ] as const;

  const P = useScreenPalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
      <Step1Header step={4} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.negative, letterSpacing: 1.6 }}>PERMISSIONS</Text>
        <Text style={{ fontFamily: NumFont.bold, fontSize: 28, color: P.ink, letterSpacing: -0.7, lineHeight: 32, marginTop: 8 }}>
          Let's set the{'\n'}guardrails.
        </Text>
        <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink2, marginTop: 10, lineHeight: 20 }}>
          Choose what your mentor can do for you. You can change any of these later.
        </Text>

        <View style={{
          marginTop: 22, backgroundColor: P.surface, borderRadius: Radii.md,
          borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
        }}>
          {perms.map((p, i) => (
            <View key={p.key} style={{
              paddingHorizontal: 16, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderBottomWidth: i < perms.length - 1 ? 1 : 0,
              borderBottomColor: P.hairline,
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: P.accentTint,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16 }}>{p.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{p.t}</Text>
                <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, marginTop: 1, lineHeight: 16 }}>{p.sub}</Text>
              </View>
              <Switch
                value={prefs.permissions[p.key]}
                onValueChange={v => setPrefs({ ...prefs, permissions: { ...prefs.permissions, [p.key]: v } })}
                trackColor={{ false: P.hairline, true: P.positive }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <View style={{
          marginTop: 16, padding: 14, backgroundColor: P.accentTint,
          borderRadius: Radii.sm, borderWidth: 1, borderColor: P.accentBorder,
        }}>
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink2, lineHeight: 18 }}>
            ✦ Your mentor never sends messages without your permission. Quiet by default.
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}>
        <PageDots active={3} />
        <Pressable onPress={onFinish}>
          <LinearGradient
            colors={['#3A4FE3', '#B23A36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 15, paddingHorizontal: 22, borderRadius: Radii.sm, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontFamily: UIFont.bold, fontSize: 15 }}>You're set — let's begin</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
