import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { useFeedbackStore, type NoticeKind } from '../../store/feedbackStore';
import { useScreenPalette } from '../../theme/palette';
import { UIFont } from '../../theme/typography';
import { Radii } from '../../theme/tokens';

const LABEL: Record<NoticeKind, string> = {
  error: 'Error',
  success: 'Done',
  info: 'Note',
};

// One line at the top of whatever screen is open. The kind is carried by the
// icon and a spoken label as well as the colour, so it does not rely on colour.
export function FeedbackBanner() {
  const P = useScreenPalette();
  const insets = useSafeAreaInsets();
  const notice = useFeedbackStore(s => s.notice);
  const dismiss = useFeedbackStore(s => s.dismiss);

  useEffect(() => {
    if (notice) {
      void AccessibilityInfo.announceForAccessibility(`${LABEL[notice.kind]}. ${notice.message}`);
    }
  }, [notice]);

  if (!notice) return null;

  const tone =
    notice.kind === 'error' ? P.negative : notice.kind === 'success' ? P.positive : P.accentDeep;
  const Icon =
    notice.kind === 'error' ? AlertCircle : notice.kind === 'success' ? CheckCircle2 : Info;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 1000 }}
    >
      <Animated.View
        key={notice.id}
        entering={FadeInUp.duration(180)}
        exiting={FadeOutUp.duration(140)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${LABEL[notice.kind]}. ${notice.message}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 14,
          paddingRight: 4,
          minHeight: 48,
          backgroundColor: P.surface,
          borderRadius: Radii.sm + 3,
          borderWidth: 1,
          borderColor: tone,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Icon size={18} color={tone} />
        <Text
          style={{ flex: 1, fontFamily: UIFont.medium, fontSize: 13, lineHeight: 18, color: P.ink, paddingVertical: 10 }}
        >
          {notice.message}
        </Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={4}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} color={P.ink3} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
