import { View, Text } from 'react-native';
import { C } from '../../theme/tokens';
import { Logo } from './Logo';

interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  dark?: boolean;
}

export function TopBar({ title, subtitle, right, dark = false }: TopBarProps) {
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
            fontFamily: 'Inter_700Bold',
            color: dark ? '#fff' : C.ink,
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
              color: dark ? 'rgba(255,255,255,0.6)' : C.ink3,
              marginTop: 2,
              fontFamily: 'Inter_500Medium',
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
