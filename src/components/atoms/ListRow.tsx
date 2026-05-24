import { View, Text, Pressable, ViewStyle } from 'react-native';
import { C, Radii } from '../../theme/tokens';

/**
 * iOS-style grouped section list — a card with hairline dividers between rows.
 * Match Apple Calendar's event-edit grouping (white card, soft bg around it).
 */
export function ListSection({
  title, children, style,
}: { title?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {title ? (
        <Text style={{
          fontFamily: 'Inter_600SemiBold', fontSize: 12, color: C.ink3,
          letterSpacing: 0.5, marginLeft: 14, textTransform: 'uppercase',
        }}>
          {title}
        </Text>
      ) : null}
      <View style={{
        backgroundColor: C.card,
        borderRadius: Radii.md,
        borderWidth: 1, borderColor: C.hairline,
        overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  );
}

interface ListRowProps {
  label: string;
  /** Right-side display content (a value, picker preview, switch, etc.). */
  right?: React.ReactNode;
  /** Optional expanded content that renders below the row when active. */
  expanded?: React.ReactNode;
  /** When true, the row stays highlighted (used while a date picker is open). */
  active?: boolean;
  onPress?: () => void;
  /** Last row in section — no bottom hairline. */
  last?: boolean;
  /** Leading dot / pill color (e.g. calendar color). */
  accent?: string;
}

export function ListRow({ label, right, expanded, active, onPress, last, accent }: ListRowProps) {
  const inner = (
    <View>
      <View style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: active ? `${C.indigo}08` : 'transparent',
      }}>
        {accent ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} /> : null}
        <Text style={{
          fontFamily: 'Inter_500Medium', fontSize: 14,
          color: active ? C.indigo : C.ink, flex: right ? undefined : 1,
        }}>
          {label}
        </Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {expanded ? (
        <View style={{
          paddingHorizontal: 8,
          paddingBottom: 8,
          borderTopWidth: 1, borderTopColor: C.hairline,
        }}>
          {expanded}
        </View>
      ) : null}
      {!last ? <View style={{ height: 1, backgroundColor: C.hairline, marginLeft: 14 }} /> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}
