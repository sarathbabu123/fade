import type { SosPlayer, SosState } from '@fade/engine';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

interface Props {
  state: SosState;
  p1Name: string;
  p2Name: string;
}

export const SosScoreHeader = memo(function SosScoreHeader({ state, p1Name, p2Name }: Props) {
  const isP1Turn = state.toMove === 'X';

  return (
    <View style={styles.header}>
      {/* Player 1 (Coral) */}
      <View
        style={[
          styles.playerCard,
          isP1Turn && [styles.playerCardActive, { borderColor: colors.coral, boxShadow: glow(colors.coral, 16, 0.4) }],
        ]}>
        <Text style={[type.label, { color: colors.coral }]} numberOfLines={1}>
          {p1Name}
        </Text>
        <Text style={[styles.score, { color: colors.coral, textShadowColor: colors.coral }]}>
          {state.scores.X}
        </Text>
        {isP1Turn && state.status === 'playing' && <View style={[styles.turnDot, { backgroundColor: colors.coral }]} />}
      </View>

      {/* VS / Status Middle */}
      <View style={styles.middle}>
        <Text style={type.caption}>{state.config.size}×{state.config.size} SOS</Text>
        {state.lastPointsEarned > 0 && state.status === 'playing' && (
          <Animated.View key={state.ply} entering={ZoomIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.streakPill}>
            <Text style={styles.streakText}>⚡ +{state.lastPointsEarned} SOS! EXTRA TURN</Text>
          </Animated.View>
        )}
      </View>

      {/* Player 2 (Cyan) */}
      <View
        style={[
          styles.playerCard,
          !isP1Turn && [styles.playerCardActive, { borderColor: colors.cyan, boxShadow: glow(colors.cyan, 16, 0.4) }],
        ]}>
        <Text style={[type.label, { color: colors.cyan }]} numberOfLines={1}>
          {p2Name}
        </Text>
        <Text style={[styles.score, { color: colors.cyan, textShadowColor: colors.cyan }]}>
          {state.scores.O}
        </Text>
        {!isP1Turn && state.status === 'playing' && <View style={[styles.turnDot, { backgroundColor: colors.cyan }]} />}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.md,
  },
  playerCard: {
    width: 100,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: withAlpha(colors.nightDeep, 0.8),
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
  },
  playerCardActive: {
    borderWidth: 1.5,
  },
  score: {
    fontFamily: fonts.displayHeavy,
    fontSize: 28,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  turnDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  middle: {
    alignItems: 'center',
    gap: 4,
  },
  streakPill: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
  },
  streakText: {
    fontFamily: fonts.displayHeavy,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.gold,
  },
});

