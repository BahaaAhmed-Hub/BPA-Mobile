import { useState } from 'react';
import { Pressable as RNPressable, type LayoutChangeEvent, type PressableProps } from 'react-native';

// The app's Pressable. It is React Native's, with two things every button here
// should have and most did not:
//  - a role, so a screen reader announces a button rather than nothing;
//  - a touch area of at least 44pt. The control keeps the size it is drawn at
//    (a 36pt circle stays 36pt); the extra is invisible, which is how the
//    platform guidelines ask small controls to be made reachable.
// A caller that sets `hitSlop` or `accessibilityRole` itself is left alone.
const MIN = 44;

export function Pressable({ hitSlop, accessibilityRole = 'button', onLayout, ...rest }: PressableProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const measure = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    onLayout?.(e);
  };

  let slop = hitSlop;
  if (slop === undefined && size) {
    const dx = size.w < MIN ? Math.ceil((MIN - size.w) / 2) : 0;
    const dy = size.h < MIN ? Math.ceil((MIN - size.h) / 2) : 0;
    if (dx || dy) slop = { left: dx, right: dx, top: dy, bottom: dy };
  }
  return <RNPressable accessibilityRole={accessibilityRole} hitSlop={slop} onLayout={measure} {...rest} />;
}
