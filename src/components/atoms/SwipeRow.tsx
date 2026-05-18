import { useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { C, Radii } from '../../theme/tokens';

export interface SwipeAction {
  label: string;
  color: string;
  textColor?: string;
  onAction: () => void;
}

interface SwipeRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;   // revealed by swiping right (finger moves right)
  rightAction?: SwipeAction;  // revealed by swiping left (finger moves left)
}

export function SwipeRow({ children, leftAction, rightAction }: SwipeRowProps) {
  const ref = useRef<Swipeable>(null);

  const renderLeft = leftAction
    ? (_progress: Animated.AnimatedInterpolation<number>, drag: Animated.AnimatedInterpolation<number>) => {
        const scale = drag.interpolate({ inputRange: [0, 80], outputRange: [0.6, 1], extrapolate: 'clamp' });
        return (
          <View style={{
            backgroundColor: leftAction.color,
            justifyContent: 'center',
            paddingHorizontal: 20,
            borderTopLeftRadius: Radii.md,
            borderBottomLeftRadius: Radii.md,
          }}>
            <Animated.Text style={{
              fontFamily: 'Inter_700Bold', fontSize: 14,
              color: leftAction.textColor ?? '#fff', letterSpacing: 0.4,
              transform: [{ scale }],
            }}>
              {leftAction.label}
            </Animated.Text>
          </View>
        );
      }
    : undefined;

  const renderRight = rightAction
    ? (_progress: Animated.AnimatedInterpolation<number>, drag: Animated.AnimatedInterpolation<number>) => {
        const scale = drag.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.6], extrapolate: 'clamp' });
        return (
          <RectButton onPress={() => { rightAction.onAction(); ref.current?.close(); }}>
            <View style={{
              backgroundColor: rightAction.color,
              justifyContent: 'center',
              paddingHorizontal: 20,
              borderTopRightRadius: Radii.md,
              borderBottomRightRadius: Radii.md,
              height: '100%',
            }}>
              <Animated.Text style={{
                fontFamily: 'Inter_700Bold', fontSize: 14,
                color: rightAction.textColor ?? '#fff', letterSpacing: 0.4,
                transform: [{ scale }],
              }}>
                {rightAction.label}
              </Animated.Text>
            </View>
          </RectButton>
        );
      }
    : undefined;

  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      onSwipeableOpen={direction => {
        if (direction === 'left' && leftAction) {
          leftAction.onAction();
          // Auto-close after action so the row springs back
          setTimeout(() => ref.current?.close(), 120);
        }
        if (direction === 'right' && rightAction) {
          rightAction.onAction();
          setTimeout(() => ref.current?.close(), 120);
        }
      }}
      containerStyle={{ borderRadius: Radii.md, backgroundColor: C.bg }}
    >
      {children}
    </Swipeable>
  );
}
