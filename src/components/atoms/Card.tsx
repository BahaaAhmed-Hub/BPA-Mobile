import { View, ViewProps } from 'react-native';
import { C, Radii, Shadows } from '../../theme/tokens';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: C.card,
          borderRadius: Radii.md,
          borderWidth: 1,
          borderColor: C.hairline,
          padding: padded ? 16 : 0,
        },
        Shadows.card,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
