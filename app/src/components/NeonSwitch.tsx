import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/settings';
import { colors, glow, motion, radii, spacing, type, withAlpha } from '@/theme';

interface SwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
  label: string;
}

export function NeonSwitch({ value, onChange, accent = colors.o, label }: SwitchProps) {
  const t = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    t.value = withSpring(value ? 1 : 0, motion.spring);
  }, [value, t]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [colors.glassStrong, withAlpha(accent, 0.35)]),
    borderColor: interpolateColor(t.value, [0, 1], [colors.hairline, accent]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * 20 }],
    backgroundColor: interpolateColor(t.value, [0, 1], [colors.textDim, colors.text]),
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        haptic.selection();
        onChange(!value);
      }}
      hitSlop={8}>
      <Animated.View style={[styles.track, value && { boxShadow: glow(accent, 12, 0.35) }, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}

/** Two-to-four way choice (e.g. Blitz / Rapid). */
export function Segmented<T extends string>({ options, value, onChange, accent = colors.x }: SegmentedProps<T>) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.selection();
              onChange(o.value);
            }}
            style={[
              styles.segment,
              on && { backgroundColor: withAlpha(accent, 0.16), borderColor: accent, boxShadow: glow(accent, 14, 0.3) },
            ]}>
            <Text style={[type.label, { color: on ? colors.text : colors.textDim }]}>{o.label}</Text>
            {o.hint ? <Text style={[type.caption, styles.hint]}>{o.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: radii.pill, borderWidth: 1, padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10 },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
    gap: 2,
  },
  hint: { letterSpacing: 0.6 },
});
