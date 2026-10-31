import type { ComponentType } from 'react';
import { Image, Text } from 'react-native';
import * as Lucide from 'lucide-react-native';

type LineIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface GlyphProps {
  /** What the database holds: an emoji, `lucide:CarFront`, or a picture (`data:…` / `http…`). */
  icon?: string | null;
  /** Size of an emoji or a line icon. */
  size?: number;
  /** Size of a picture, which fills its box rather than sitting small inside it. */
  box?: number;
  color?: string;
  fallback?: string;
}

/** The web app keeps an icon in one plain string field and draws it three ways
 *  (`CategoryGlyph`). Printing the string as text shows "data" for a bank's
 *  logo and "lucide:CarFront" for a line icon. */
export function Glyph({ icon, size = 18, box, color = '#191712', fallback = '' }: GlyphProps) {
  const value = icon || fallback;

  if (value.startsWith('lucide:')) {
    const Line = (Lucide as unknown as Record<string, LineIcon | undefined>)[value.slice('lucide:'.length)];
    if (Line) return <Line size={size} color={color} strokeWidth={1.75} />;
    return fallback ? <Text style={{ fontSize: size }}>{fallback}</Text> : null;
  }

  if (value.startsWith('data:') || value.startsWith('http')) {
    const side = box ?? size * 1.6;
    return (
      <Image
        source={{ uri: value }}
        accessibilityIgnoresInvertColors
        style={{ width: side, height: side, borderRadius: Math.round(side * 0.28) }}
        resizeMode="cover"
      />
    );
  }

  return <Text style={{ fontSize: size }}>{value}</Text>;
}
