import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const SETTINGS_CONTENT: Record<string, { sections: Array<{ title?: string; rows: Array<{ label: string; hint?: string; value?: string }> }> }> = {
  Profile: {
    sections: [{
      title: 'YOU',
      rows: [
        { label: 'Name', value: 'Bahaa Ahmed' },
        { label: 'Email', value: 'eng.bahaa.a@gmail.com' },
        { label: 'Timezone', value: 'Africa/Cairo' },
      ],
    }, {
      title: 'WORKING DAY',
      rows: [
        { label: 'Day starts', value: '08:00' },
        { label: 'Day ends', value: '18:00' },
        { label: 'No-meeting day', value: 'Wednesday' },
        { label: 'Work week', value: 'M T W T F' },
      ],
    }],
  },
  Billing: {
    sections: [{
      title: 'PLAN',
      rows: [
        { label: 'Current plan', value: 'Plus · EGP 249/mo' },
        { label: 'Payment method', value: 'Visa ·· 4417' },
        { label: 'Next charge', value: '22 Oct 2026' },
        { label: 'Invoices', hint: '14 available', value: '›' },
      ],
    }],
  },
  Accounts: {
    sections: [{
      title: 'CONNECTED ACCOUNTS',
      rows: [
        { label: 'bahaa@dx-technologies.com', hint: 'Primary · Mail, Calendar, Drive' },
        { label: 'bahaa@teradix.sa', hint: 'Mail, Calendar' },
        { label: 'eng.bahaa.a@gmail.com', hint: 'Mail only' },
      ],
    }, {
      title: 'COMPANIES',
      rows: [
        { label: 'DX Technologies', hint: '@dx-technologies.com · primary' },
        { label: 'Teradix', hint: '@teradix.sa' },
        { label: 'Alraya', hint: 'No domain set' },
      ],
    }],
  },
  Schedule: {
    sections: [{
      title: 'FOCUS HOURS',
      rows: [
        { label: 'Deep work', hint: 'Held every weekday 09:00–11:00' },
        { label: 'No-meeting day', hint: 'Nothing is booked Wednesday' },
        { label: 'Decline outside working hours', hint: 'After 18:00 or before 08:00' },
      ],
    }, {
      title: 'BUFFERS',
      rows: [
        { label: 'Before a meeting', value: '10 min' },
        { label: 'After a meeting', value: '5 min' },
        { label: 'Travel', hint: 'Added when location changes', value: 'Auto' },
      ],
    }],
  },
  Integrations: {
    sections: [{
      title: 'CONNECTED',
      rows: [
        { label: '📝 Notion', hint: 'Bahaa · 4 databases · Tasks, meetings, weekly review' },
        { label: '🎯 Asana', hint: 'DX Technologies workspace · 3 projects' },
      ],
    }, {
      title: 'AVAILABLE',
      rows: [
        { label: '📋 Linear', hint: 'Not connected' },
        { label: '📊 Google Sheets', hint: 'Not connected' },
        { label: '💬 Slack', hint: 'Not connected' },
      ],
    }],
  },
  TasksConfig: {
    sections: [{
      title: 'BOARD STATUSES',
      rows: [
        { label: 'Backlog' }, { label: 'Planned' },
        { label: 'In Progress' }, { label: 'Blocked' }, { label: 'Done' },
      ],
    }, {
      title: 'TASK TYPES',
      rows: [
        { label: 'Meeting' }, { label: 'Call' }, { label: 'Follow-up' }, { label: 'Email' },
      ],
    }],
  },
  HabitsConfig: {
    sections: [{
      title: 'MEASUREMENT',
      rows: [
        { label: 'Done / not done', hint: 'Binary — kept or missed' },
        { label: 'Measurable', hint: 'A number toward a target' },
      ],
    }, {
      title: 'RULES',
      rows: [
        { label: 'A miss restarts the streak', hint: 'History is kept either way' },
        { label: 'Freeze on pause', hint: 'Streak freezes, history keeps' },
      ],
    }],
  },
  Automation: {
    sections: [{
      title: 'RULES THAT RUN WITHOUT ASKING',
      rows: [
        { label: 'Draft replies for Needs you mail', hint: 'When a thread sits over 4 hours' },
        { label: 'Archive newsletters after a week', hint: 'When a campaign is unread and 7 days old' },
        { label: 'Book focus time', hint: 'When a task over 45 min has no slot' },
        { label: 'Decline outside hours', hint: 'When an invitation lands after 18:00' },
        { label: 'File receipts to the ledger', hint: 'When a notification carries an amount' },
      ],
    }, {
      title: 'SAFETY',
      rows: [
        { label: 'Tell me after it acts', hint: 'A line in the morning brief' },
        { label: 'Undo window', value: '30 min' },
      ],
    }],
  },
  NotificationsConfig: {
    sections: [{
      title: 'WHAT REACHES YOU',
      rows: [
        { label: 'Mail that needs an answer', hint: 'Only the Needs you class' },
        { label: 'Meeting starting', hint: '10 minutes before' },
        { label: 'A clash appears', hint: 'As soon as one is detected' },
        { label: 'Habit at risk', hint: 'Late afternoon, only if behind' },
        { label: 'Budget over', hint: 'When a rule crosses its limit' },
      ],
    }, {
      title: 'WHERE',
      rows: [
        { label: 'Push to this iPhone', hint: 'Enabled' },
        { label: 'Email digest', hint: 'Morning brief · 08:00' },
      ],
    }],
  },
  DataPrivacy: {
    sections: [{
      title: 'THIS DEVICE',
      rows: [
        { label: 'Lock the finances', hint: 'Face ID, after 5 minutes idle' },
        { label: 'Lock after 5 minutes idle', hint: '' },
        { label: 'Hide figures in the app switcher', hint: '' },
      ],
    }, {
      title: 'WHAT LEAVES THE DEVICE',
      rows: [
        { label: 'Share usage analytics', hint: 'Helps improve Professor' },
        { label: 'Crash reporting', hint: 'Automatic error reports' },
        { label: 'Mail bodies sent to the model', hint: 'Only the thread you open' },
      ],
    }],
  },
  FinanceSettings: {
    sections: [{
      title: 'ENVELOPE STYLE',
      rows: [
        { label: 'Dial + trend' }, { label: 'Proportional mosaic' },
        { label: 'Till slips' }, { label: 'Double rings' },
      ],
    }, {
      title: 'FIGURES',
      rows: [
        { label: 'Base currency', value: 'EGP' },
        { label: 'Decimals', value: 'Off' },
        { label: 'Negative style', value: 'Bracketed' },
      ],
    }],
  },
};

export function SettingsPlaceholderScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'SettingsDetail'>>();
  const P = useScreenPalette();
  const { title } = route.params;
  const content = SETTINGS_CONTENT[title];

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
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>
        {content ? (
          content.sections.map((section, si) => (
            <View key={si}>
              {section.title && (
                <Text style={{
                  fontFamily: UIFont.semiBold, fontSize: 11,
                  color: P.ink4, letterSpacing: 1.6, textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  {section.title}
                </Text>
              )}
              <View style={{
                backgroundColor: P.surface, borderRadius: Radii.md,
                borderWidth: 1, borderColor: P.hairline, overflow: 'hidden',
              }}>
                {section.rows.map((row, ri) => (
                  <View key={ri} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: ri < section.rows.length - 1 ? 1 : 0,
                    borderColor: P.hairline,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: UIFont.semiBold, fontSize: 14, color: P.ink }}>{row.label}</Text>
                      {row.hint ? (
                        <Text style={{ fontFamily: UIFont.regular, fontSize: 12, color: P.ink3, marginTop: 2 }}>{row.hint}</Text>
                      ) : null}
                    </View>
                    {row.value && (
                      <Text style={{ fontFamily: UIFont.regular, fontSize: 14, color: P.ink3 }}>{row.value}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={{
            padding: 32, alignItems: 'center', backgroundColor: P.surface,
            borderRadius: Radii.md, borderWidth: 1, borderColor: P.hairline,
          }}>
            <Text style={{ fontFamily: UIFont.semiBold, fontSize: 15, color: P.ink2 }}>Coming soon</Text>
            <Text style={{ fontFamily: UIFont.regular, fontSize: 13, color: P.ink3, marginTop: 6, textAlign: 'center' }}>
              {title} configuration will be available in the next release.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
