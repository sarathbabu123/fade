import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Digit({ digit, lineHeight, style, delay }: { digit: number; lineHeight: number; style: TextStyle; delay: number }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(-digit * lineHeight);
  useEffect(() => {
    const to = -digit * lineHeight;
    y.value = reduce ? to : withDelay(delay, withSpring(to, { damping: 16, stiffness: 120, mass: 0.8 }));
  }, [digit, lineHeight, reduce, delay, y]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={strip}>
        {DIGITS.map((d) => (
          <Text key={d} style={[style, { height: lineHeight, lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

interface Props {
  /** Shown as text; digits roll like an odometer, anything else (+, −, ?) is static. */
  value: string | number;
  style: TextStyle;
}

/** Odometer-style number (rating deltas, scores). Animates on the UI thread. */
export const AnimatedNumber = memo(function AnimatedNumber({ value, style }: Props) {
  const text = String(value);
  const fontSize = style.fontSize ?? 16;
  const lineHeight = Math.round(fontSize * 1.3);
  const chars = [...text];
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {chars.map((ch, i) => {
        // Key from the right so units stay units when the length changes.
        const key = chars.length - i;
        return /\d/.test(ch) ? (
          <Digit key={key} digit={Number(ch)} lineHeight={lineHeight} style={style} delay={(chars.length - 1 - i) * 40} />
        ) : (
          <Text key={`s${key}`} style={[style, { height: lineHeight, lineHeight }]}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
