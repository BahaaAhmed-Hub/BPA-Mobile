import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Pressable } from '../../components/atoms/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useCompanyStore } from '../../store/companyStore';
import { CompanyMark } from '../../components/atoms/CompanyMark';
import { scheduleView, yesNo, minutes } from '../../lib/settingsView';

interface Row { label: string; hint?: string; value?: string | null; mark?: { logo?: string | null; color?: string | null } }
interface Section { title?: string; rows: Row[] }

interface Account { email: string; name: string | null; is_primary: boolean }
interface Loaded { name: string | null; email: string | null; framework: string | null; rules: unknown; accounts: Account[] }

const FRAMEWORKS: Record<string, string> = {};

export function SettingsPlaceholderScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'SettingsDetail'>>();
  const P = useScreenPalette();
  const { title } = route.params;
  const authUser = useAuthStore(s => s.user);
  const companies = useCompanyStore(s => s.companies);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [u, a] = await Promise.all([
        supabase.from('users').select('full_name, email, active_framework, schedule_rules').maybeSingle(),
        supabase.from('google_accounts').select('email, name, is_primary').order('is_primary', { ascending: false }),
      ]);
      if (!live) return;
      if (u.error) { setFailed(true); return; }
      const row = u.data as { full_name?: string | null; email?: string | null; active_framework?: string | null; schedule_rules?: unknown } | null;
      setData({
        name: row?.full_name ?? null, email: row?.email ?? authUser?.email ?? null,
        framework: row?.active_framework ?? null, rules: row?.schedule_rules ?? {},
        accounts: (a.data ?? []) as Account[],
      });
    })();
    return () => { live = false; };
  }, [authUser?.email]);

  const s = scheduleView(data?.rules);
  const sections: Section[] = [];
  if (data) {
    if (title === 'Profile') {
      sections.push({ title: 'YOU', rows: [
        { label: 'Name', value: data.name }, { label: 'Email', value: data.email },
        { label: 'Framework', value: data.framework ? (FRAMEWORKS[data.framework] ?? data.framework) : null },
        { label: 'Timezone', value: s.timezone },
      ] });
      sections.push({ title: 'WORKING WEEK', rows: [{ label: 'Work week', value: s.workWeek }] });
    } else if (title === 'Accounts') {
      sections.push({ title: 'CONNECTED GOOGLE ACCOUNTS', rows: data.accounts.map(a => ({
        label: a.email, hint: [a.is_primary ? 'Primary' : null, a.name].filter(Boolean).join(' · ') || undefined,
      })) });
      sections.push({ title: 'COMPANIES', rows: companies.map(c => ({ label: c.name, mark: { logo: c.logo_url, color: c.color_tag } })) });
    } else if (title === 'Schedule') {
      sections.push({ title: 'FOCUS & HOURS', rows: [
        { label: 'Focus hours', value: s.focus },
        { label: 'Earliest meeting', value: s.earliestMeeting },
        { label: 'End of day', value: s.endOfDay },
        { label: 'Protect focus time', value: yesNo(s.protectFocus) },
        { label: 'Decline early invitations', value: yesNo(s.autoDeclineEarly) },
      ] });
      sections.push({ title: 'BUFFERS', rows: [
        { label: 'Between meetings', value: minutes(s.bufferMins) },
        { label: 'When travel is needed', value: minutes(s.physicalBufferMins) },
      ] });
    }
  }
  // A value the web never saved is not drawn as a choice.
  const shown = sections.map(sec => ({ ...sec, rows: sec.rows.filter(r => r.value !== null || r.hint || sec.title?.startsWith('CONNECTED') || sec.title === 'COMPANIES') }))
    .filter(sec => sec.rows.length > 0);

  const heading = { Profile: 'Profile', Accounts: 'Accounts & companies', Schedule: 'Schedule rules' }[title] ?? title;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
          backgroundColor: P.surface, borderWidth: 1, borderColor: P.hairline,
        }}>
          <Text style={{ fontFamily: UIFont.bold, fontSize: 22, color: P.ink, lineHeight: 22, marginTop: -3 }}>‹</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: NumFont.bold, fontSize: 15, color: P.ink }}>{heading}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>
        {!data && !failed && <ActivityIndicator color={P.ink3} style={{ marginTop: 40 }} />}
        {failed && (
          <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, textAlign: 'center', marginTop: 40 }}>
            Couldn't load this right now. Check your connection and open it again.
          </Text>
        )}
        {shown.map((section, si) => (
          <View key={si}>
            {section.title && (
              <Text style={{ fontFamily: UIFont.semiBold, fontSize: 11, color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>
                {section.title}
              </Text>
            )}
            <View style={{ backgroundColor: P.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline, overflow: 'hidden' }}>
              {section.rows.map((row, ri) => (
                <View key={ri} style={{
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
                  borderBottomWidth: ri < section.rows.length - 1 ? 1 : 0, borderColor: P.hairline,
                }}>
                  {row.mark ? <CompanyMark name={row.label} logo={row.mark.logo} color={row.mark.color} size={32} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{row.label}</Text>
                    {row.hint ? <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>{row.hint}</Text> : null}
                  </View>
                  {row.value ? <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink3, maxWidth: '55%', textAlign: 'right' }}>{row.value}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ))}
        {data && (
          <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, textAlign: 'center', lineHeight: 17 }}>
            These are read from your account. Change them in the web app.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
