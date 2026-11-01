import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, glow, radii, spacing, withAlpha } from '@/theme';

interface Props {
  children: ReactNode;
  /** Optional neon edge glow. */
  glowColor?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Frosted glass surface: translucent fill, hairline edge and a top highlight.
 * No real-time blur: blurring an animated aurora every frame is too costly on
 * mid-range Android, and over a dark background the translucency reads the same.
 */
export function GlassCard({ children, glowColor, padded = true, style }: Props) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        glowColor ? { borderColor: withAlpha(glowColor, 0.33), boxShadow: glow(glowColor, 24, 0.28) } : null,
        style,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.highlight, colors.transparent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  padded: { padding: spacing.lg },
});
