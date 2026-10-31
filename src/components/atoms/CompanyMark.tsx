import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { UIFont } from '../../theme/typography';
import { logoSource, initialsOf } from '../../lib/companyLogo';

/** A company's circle: its real logo where there is one, otherwise its initials on its own tint. */
export function CompanyMark({ name, logo, color, size = 22 }: { name: string; logo?: string | null; color?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : logoSource(logo);
  const tint = color || '#9B9180';
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: `${tint}30`, alignItems: 'center', justifyContent: 'center' }}>
      {src ? (
        <Image source={{ uri: src }} onError={() => setBroken(true)} resizeMode="cover" style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontFamily: UIFont.bold, fontSize: Math.max(9, size * 0.4), color: tint }}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}
