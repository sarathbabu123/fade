import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';
import { colors, radii, withAlpha } from '@/theme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Shimmering neon skeleton placeholder for smooth loading states.
 */
export function NeonSkeleton({ width = '100%', height = 20, borderRadius = radii.sm, style }: Props) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [reduce, progress]);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = reduce ? 0.35 : interpolate(progress.value, [0, 0.5, 1], [0.25, 0.55, 0.25]);
    return { opacity };
  });

  return (
    <View
      style={[
        styles.base,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            withAlpha(colors.hairline, 0.1),
            withAlpha(colors.o, 0.2),
            withAlpha(colors.hairline, 0.1),
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** A standard list skeleton card with avatar + text lines. */
export function FriendSkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <NeonSkeleton width={44} height={44} borderRadius={22} />
      <View style={styles.skeletonTextCol}>
        <NeonSkeleton width="60%" height={16} />
        <NeonSkeleton width="35%" height={12} />
      </View>
      <NeonSkeleton width={76} height={32} borderRadius={radii.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: withAlpha(colors.nightDeep, 0.7),
    borderColor: withAlpha(colors.hairline, 0.4),
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: withAlpha(colors.nightDeep, 0.6),
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 14,
  },
  skeletonTextCol: {
    flex: 1,
    gap: 8,
  },
});
