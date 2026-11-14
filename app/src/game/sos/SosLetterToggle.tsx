import type { SosLetter, SosPlayer } from '@fade/engine';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/lib/settings';
import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

interface Props {
  selectedLetter: SosLetter;
  onSelect: (letter: SosLetter) => void;
  playerColor: string;
}

export const SosLetterToggle = memo(function SosLetterToggle({ selectedLetter, onSelect, playerColor }: Props) {
  const select = (letter: SosLetter) => {
    if (selectedLetter !== letter) {
      haptic.selection();
      onSelect(letter);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={type.caption}>CHOOSE LETTER TO PLACE</Text>
      <View style={styles.pill}>
        <Pressable
          onPress={() => select('S')}
          style={[
            styles.segment,
            selectedLetter === 'S' && [
              styles.segmentActive,
              { borderColor: playerColor, backgroundColor: withAlpha(playerColor, 0.15) },
            ],
          ]}
          accessibilityRole="button"
          accessibilityLabel="Select S">
          <Text
            style={[
              styles.letter,
              selectedLetter === 'S' && { color: playerColor, textShadowColor: playerColor },
            ]}>
            S
          </Text>
        </Pressable>

        <Pressable
          onPress={() => select('O')}
          style={[
            styles.segment,
            selectedLetter === 'O' && [
              styles.segmentActive,
              { borderColor: playerColor, backgroundColor: withAlpha(playerColor, 0.15) },
            ],
          ]}
          accessibilityRole="button"
          accessibilityLabel="Select O">
          <Text
            style={[
              styles.letter,
              selectedLetter === 'O' && { color: playerColor, textShadowColor: playerColor },
            ]}>
            O
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: withAlpha(colors.nightDeep, 0.8),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
    gap: 6,
  },
  segment: {
    width: 68,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    borderWidth: 1,
  },
  letter: {
    fontFamily: fonts.displayHeavy,
    fontSize: 24,
    color: colors.textDim,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});

