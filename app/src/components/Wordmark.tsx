import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';
import { colors, fonts, motion } from '@/theme';

/** "FADE" with the E pulsing like a next-to-fade mark. */
export function Wordmark({ size = 34 }: { size?: number }) {
  const reduce = useReduceMotion();
  const e = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      e.value = 0.55;
      return;
    }
    e.value = withRepeat(withTiming(0.4, { duration: motion.fadePulseMs * 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(e);
  }, [reduce, e]);
  const eStyle = useAnimatedStyle(() => ({ opacity: e.value }));
  const text = { fontFamily: fonts.displayHeavy, fontSize: size, letterSpacing: size * 0.08, lineHeight: size * 1.2 };
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="FADE">
      <Text style={[text, styles.glow, { color: colors.text }]}>FAD</Text>
      <Animated.Text style={[text, styles.glowX, { color: colors.x }, eStyle]}>E</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  glow: { textShadowColor: colors.o, textShadowRadius: 14 },
  glowX: { textShadowColor: colors.x, textShadowRadius: 16 },
});
