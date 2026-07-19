import { type PropsWithChildren, useEffect, useRef } from "react";
import { Animated, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

import { resolveMotionProfile } from "./motion";
import { useReducedMotion } from "./use-reduced-motion";

export function MotionView({
  children,
  style,
  accessibilityLabel,
  accessibilityRole,
  pointerEvents,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: ViewProps["accessibilityRole"];
  pointerEvents?: ViewProps["pointerEvents"];
}>) {
  const reduceMotion = useReducedMotion();
  const profile = resolveMotionProfile(reduceMotion);
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: profile.enterDurationMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [profile.enterDurationMs, progress, reduceMotion]);

  if (reduceMotion) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        pointerEvents={pointerEvents}
        style={style}
      >
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      pointerEvents={pointerEvents}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [profile.enterTranslateY, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
