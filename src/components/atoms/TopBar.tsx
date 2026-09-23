import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { Logo } from './Logo';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useScreenPalette } from '../../theme/palette';
import { UIFont, NumFont } from '../../theme/typography';

interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Force dark text/icons regardless of palette (e.g. Login hero). */
  dark?: boolean;
}

export function TopBar({ title, subtitle, right, dark: forceDark }: TopBarProps) {
  const P = useScreenPalette();
  const dark = forceDark ?? P.isDark;

  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Logo size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 17,
            fontFamily: UIFont.bold,
            color: dark ? '#fff' : P.ink,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: dark ? 'rgba(255,255,255,0.6)' : P.ink3,
              marginTop: 2,
              fontFamily: UIFont.medium,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <NotificationsBell dark={dark} P={P} />}
    </View>
  );
}

function NotificationsBell({ dark, P }: { dark: boolean; P: ReturnType<typeof useScreenPalette> }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : P.surface,
          borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.1)' : P.hairline,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Bell size={16} color={dark ? '#fff' : P.ink} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
