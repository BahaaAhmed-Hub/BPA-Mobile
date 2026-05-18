import { View, Text } from 'react-native';
import { C, Radii } from '../../theme/tokens';

interface PillProps {
  label: string;
  color?: string;
  soft?: string;
  small?: boolean;
}

export function Pill({ label, color = C.ink, soft = C.indigoSoft, small = false }: PillProps) {
  return (
    <View
      style={{
        backgroundColor: soft,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 2 : 4,
        borderRadius: Radii.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color,
          fontFamily: 'Inter_600SemiBold',
          fontSize: small ? 10 : 11,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
