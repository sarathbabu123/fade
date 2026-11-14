import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/settings';
import { colors, glow, motion, radii, spacing, type } from '@/theme';

export type GlowButtonVariant = 'coral' | 'cyan' | 'gold' | 'glass' | 'ghost';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onPress?: () => void;
  variant?: GlowButtonVariant;
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const GRADIENTS: Record<'coral' | 'cyan' | 'gold', readonly [string, string]> = {
  coral: [colors.x, colors.xHot],
  cyan: [colors.o, colors.oHot],
  gold: [colors.gold, colors.xHot],
};

const HEIGHT = { lg: 68, md: 54, sm: 40 } as const;

/** Squashes to 0.96 on press and springs back, with a selection haptic (PRD §7.2). */
export function GlowButton({ title, subtitle, icon, onPress, variant = 'coral', size = 'lg', disabled, style }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const solid = variant === 'coral' || variant === 'cyan' || variant === 'gold';
  const fg = solid ? colors.onAccent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(motion.press.scale, { duration: 70 });
        haptic.selection();
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 110 });
      }}
      style={style}>
      <Animated.View
        style={[
          styles.base,
          { height: HEIGHT[size], borderRadius: size === 'sm' ? radii.pill : radii.lg },
          solid && { boxShadow: glow(GRADIENTS[variant][0], 22, 0.5) },
          variant === 'glass' && styles.glass,
          disabled && styles.disabled,
          animated,
        ]}>
        {solid && (
          <LinearGradient
            colors={GRADIENTS[variant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: size === 'sm' ? radii.pill : radii.lg }]}
          />
        )}
        <View style={[styles.row, size === 'sm' && styles.rowSmall, !icon && styles.rowCentered]}>
          {icon}
          <View style={[styles.texts, !icon && styles.textsCentered]}>
            <Text style={[type.label, size === 'lg' && styles.labelLarge, { color: fg }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[type.bodyDim, styles.subtitle, solid && { color: colors.onAccent, opacity: 0.7 }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', overflow: 'visible' },
  glass: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.hairline },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  rowSmall: { paddingHorizontal: spacing.lg, gap: spacing.sm, justifyContent: 'center' },
  rowCentered: { justifyContent: 'center' },
  texts: { flexShrink: 1 },
  textsCentered: { alignItems: 'center' },
  labelLarge: { fontSize: 18 },
  subtitle: { fontSize: 13, lineHeight: 17, marginTop: 1 },
});
