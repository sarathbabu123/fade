import type { Player } from '@fade/engine';
import { StyleSheet, Text, View } from 'react-native';
import { interpolateColor, useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import type { AvatarId } from '@/lib/settings';
import { colors, glow, radii, spacing, type, withAlpha } from '@/theme';

interface Props {
  player: Player;
  name: string;
  tag?: string;
  avatar: AvatarId;
  wins: number;
  winsNeeded: number;
  active: boolean;
  /** Remaining fraction of the current turn (1 → 0), animated on the UI thread. */
  clock: SharedValue<number>;
  turnMs: number;
  /** Rotate 180° (pass & play: the far player reads it the right way up). */
  flipped?: boolean;
}

/** Avatar with the shot-clock ring, name and round pips. */
export function PlayerCard({ player, name, tag, avatar, wins, winsNeeded, active, clock, turnMs, flipped }: Props) {
  const color = player === 'X' ? colors.x : colors.o;
  const amberAt = turnMs > 0 ? 1000 / turnMs : 0;
  const redAt = turnMs > 0 ? 500 / turnMs : 0;
  const ring = useDerivedValue(() => (active ? clock.value : 1));
  const ringColor = useDerivedValue(() => {
    if (!active) return withAlpha(color, 0.25);
    const v = clock.value;
    if (v <= redAt) return colors.alarm;
    if (v <= amberAt) return interpolateColor(v, [redAt, amberAt], [colors.alarm, colors.amber]);
    return color;
  });

  return (
    <View style={[styles.card, active && { borderColor: withAlpha(color, 0.6), boxShadow: glow(color, 20, 0.3) }, flipped && styles.flipped]}>
      <Avatar avatar={avatar} size={46} ring={ring} ringColor={ringColor} dimmed={!active} />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <Text style={[styles.mark, { color }]}>{player}</Text>
          <Text style={type.label} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {tag ? <Text style={type.caption}>{tag}</Text> : null}
      </View>
      <View style={styles.pips} accessibilityLabel={`${wins} of ${winsNeeded} rounds`}>
        {Array.from({ length: winsNeeded }, (_, i) => (
          <View key={i} style={[styles.pip, i < wins && { backgroundColor: color, borderColor: color, boxShadow: glow(color, 8, 0.6) }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.glass,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: { ...type.heading, fontSize: 15 },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.hairlineBright },
});
