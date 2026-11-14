import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sub?: string;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function NeonLoader({ size = 'md', label, sub }: Props) {
  const dim = size === 'sm' ? 36 : size === 'md' ? 60 : 84;
  const strokeWidth = size === 'sm' ? 2.5 : 3.5;
  const r1 = (dim - strokeWidth) / 2;
  const r2 = r1 * 0.72;

  const rot1 = useSharedValue(0);
  const rot2 = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    rot1.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    rot2.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [rot1, rot2, pulse]);

  const spinStyle1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot1.value * 360}deg` }],
  }));

  const spinStyle2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `-${rot2.value * 360}deg` }],
  }));

  const centerDotStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.25]);
    const opacity = interpolate(pulse.value, [0, 1], [0.6, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const c1Circ = 2 * Math.PI * r1;
  const c2Circ = 2 * Math.PI * r2;

  return (
    <View style={styles.container}>
      <View style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer Ring: Cyan / O */}
        <AnimatedSvg
          width={dim}
          height={dim}
          style={[StyleSheet.absoluteFill, spinStyle1]}
          pointerEvents="none">
          <Circle
            cx={dim / 2}
            cy={dim / 2}
            r={r1}
            stroke={colors.cyan}
            strokeWidth={strokeWidth}
            strokeDasharray={`${c1Circ * 0.65} ${c1Circ * 0.35}`}
            strokeLinecap="round"
            fill="transparent"
            opacity={0.9}
          />
        </AnimatedSvg>

        {/* Inner Ring: Coral / X */}
        <AnimatedSvg
          width={dim}
          height={dim}
          style={[StyleSheet.absoluteFill, spinStyle2]}
          pointerEvents="none">
          <Circle
            cx={dim / 2}
            cy={dim / 2}
            r={r2}
            stroke={colors.coral}
            strokeWidth={strokeWidth}
            strokeDasharray={`${c2Circ * 0.55} ${c2Circ * 0.45}`}
            strokeLinecap="round"
            fill="transparent"
            opacity={0.9}
          />
        </AnimatedSvg>

        {/* Center Glowing Core */}
        <Animated.View
          style={[
            styles.core,
            { width: dim * 0.22, height: dim * 0.22, borderRadius: (dim * 0.22) / 2 },
            centerDotStyle,
          ]}
        />
      </View>

      {label ? <Text style={styles.label}>{label}</Text> : null}
      {sub ? <Text style={type.bodyDim}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  core: {
    backgroundColor: colors.gold,
    boxShadow: glow(colors.gold, 14, 0.8),
  },
  label: {
    fontFamily: fonts.displayHeavy,
    fontSize: 16,
    letterSpacing: 1.2,
    color: colors.text,
    textAlign: 'center',
  },
});
