import { View, ViewProps } from 'react-native';
import { Radii, Shadows } from '../../theme/tokens';
import { useScreenPalette } from '../../theme/palette';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const P = useScreenPalette();
  return (
    <View
      style={[
        {
          backgroundColor: P.surface,
          borderRadius: Radii.md,
          borderWidth: 1,
          borderColor: P.hairline,
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
