import { applySosMove, botSosMove, createSosGame } from '@fade/engine';
import type { SosLetter, SosState } from '@fade/engine';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlowButton } from '@/components/GlowButton';
import { Screen } from '@/components/Screen';
import { playSound } from '@/game/sounds';
import { SosBoard } from '@/game/sos/SosBoard';
import { SosLetterToggle } from '@/game/sos/SosLetterToggle';
import { SosScoreHeader } from '@/game/sos/SosScoreHeader';
import { haptic, useSettings } from '@/lib/settings';
import { colors, radii, spacing, type, withAlpha } from '@/theme';

export default function SosMatchScreen() {
  const params = useLocalSearchParams<{ mode?: 'bot' | 'pass'; level?: 'easy' | 'medium' | 'hard'; size?: string }>();
  const mode = params.mode ?? 'bot';
  const botLevel = params.level ?? 'medium';
  const size = (params.size === '4' ? 4 : 5) as 4 | 5;

  const myName = useSettings((s) => s.username) ?? 'Player 1';
  const opponentName = mode === 'bot' ? `Bot (${botLevel.toUpperCase()})` : 'Player 2';

  const [state, setState] = useState<SosState>(() => createSosGame({ size, timeControl: 'rapid' }, 'X'));
  const [selectedLetter, setSelectedLetter] = useState<SosLetter>('S');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const botThinking = useRef(false);

  // Handle player cell tap
  const handleCellPress = useCallback(
    (cell: number) => {
      if (state.status !== 'playing') return;
      if (mode === 'bot' && state.toMove === 'O') return;

      try {
        const next = applySosMove(state, cell, selectedLetter);
        if (next.lastPointsEarned > 0) {
          playSound('fanfare');
          haptic.success();
        } else {
          playSound(selectedLetter === 'S' ? 'placeX' : 'placeO');
          haptic.selection();
        }
        setState(next);
      } catch {
        playSound('error');
      }
    },
    [state, selectedLetter, mode],
  );

  // Bot Turn Effect
  useEffect(() => {
    if (mode !== 'bot' || state.status !== 'playing' || state.toMove !== 'O') return;
    if (botThinking.current) return;

    botThinking.current = true;
    const timer = setTimeout(() => {
      try {
        const action = botSosMove(state, botLevel);
        const next = applySosMove(state, action.cell, action.letter);
        if (next.lastPointsEarned > 0) {
          playSound('fanfare');
          haptic.medium();
        } else {
          playSound(action.letter === 'S' ? 'placeX' : 'placeO');
        }
        setState(next);
      } catch {
        // Fallback
      } finally {
        botThinking.current = false;
      }
    }, 650);

    return () => {
      clearTimeout(timer);
      botThinking.current = false;
    };
  }, [state, mode, botLevel]);

  const activeColor = state.toMove === 'X' ? colors.coral : colors.cyan;
  const isFinished = state.status === 'finished';

  const restartMatch = () => {
    setState(createSosGame({ size, timeControl: 'rapid' }, 'X'));
    setSelectedLetter('S');
  };

  return (
    <Screen>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => (isFinished ? router.back() : setShowExitConfirm(true))} hitSlop={10} accessibilityRole="button">
          <Text style={[type.label, styles.backText]}>‹ Leave</Text>
        </Pressable>
        <Text style={type.label}>SOS DUEL</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Score Header */}
      <SosScoreHeader state={state} p1Name={myName} p2Name={opponentName} />

      {/* Board */}
      <View style={styles.boardContainer}>
        <SosBoard state={state} onCellPress={handleCellPress} disabled={mode === 'bot' && state.toMove === 'O'} />
      </View>

      {/* Letter Selector */}
      {state.status === 'playing' && (
        <SosLetterToggle selectedLetter={selectedLetter} onSelect={setSelectedLetter} playerColor={activeColor} />
      )}

      {/* Exit Confirmation BottomSheet */}
      <BottomSheet visible={showExitConfirm} onClose={() => setShowExitConfirm(false)} title="Leave Match?">
        <Text style={[type.bodyDim, styles.modalText]}>Leaving will end the current match.</Text>
        <GlowButton
          title="Leave match"
          variant="coral"
          size="md"
          onPress={() => {
            setShowExitConfirm(false);
            router.back();
          }}
        />
        <GlowButton title="Keep playing" variant="glass" size="md" onPress={() => setShowExitConfirm(false)} />
      </BottomSheet>

      {/* Game Finished Overlay */}
      {isFinished && (
        <BottomSheet visible={isFinished} onClose={() => {}} title={state.winner === 'draw' ? 'Draw Match!' : state.winner === 'X' ? `${myName} Wins!` : `${opponentName} Wins!`}>
          <Text style={[type.bodyDim, styles.modalText]}>
            Final Score: {myName} ({state.scores.X}) — {opponentName} ({state.scores.O})
          </Text>
          <GlowButton title="Play Again" variant="cyan" size="md" onPress={restartMatch} />
          <GlowButton title="Back to Home" variant="glass" size="md" onPress={() => router.back()} />
        </BottomSheet>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.textDim,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalText: {
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: spacing.sm,
  },
});

