import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type, withAlpha } from '@/theme';

import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: string;
  rating: number;
  /** Fewer than 10 rated games: shown with a "?" (PRD §4). */
  provisional?: boolean;
  /** Last change, e.g. +14 or -9. */
  delta?: number;
  active?: boolean;
}

export function RatingChip({ label, rating, provisional, delta, active }: Props) {
  const up = delta !== undefined && delta > 0;
  return (
    <View style={[styles.chip, active && styles.active]}>
      <Text style={type.caption}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        <AnimatedNumber value={Math.round(rating)} style={styles.rating} />
        {provisional && <Text style={[styles.rating, styles.provisional]}>?</Text>}
        {delta !== undefined && delta !== 0 && (
          <Text style={[styles.delta, { color: up ? colors.gold : colors.ratingDown }]}>
            {up ? '▲' : '▼'} {Math.abs(delta)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.glass,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  active: {
    borderColor: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.08),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rating: { ...type.numberSmall, fontSize: 17 },
  provisional: { color: colors.textFaint },
  delta: { ...type.caption, letterSpacing: 0.4, marginLeft: spacing.xs },
});
