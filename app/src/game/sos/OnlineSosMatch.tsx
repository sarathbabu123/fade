import type { SosLetter, SosState } from '@fade/engine';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlowButton } from '@/components/GlowButton';
import { Screen } from '@/components/Screen';
import { playSound } from '@/game/sounds';
import { OnlineStartRace } from '@/game/StartRace';
import type { useOnlineMatch } from '@/game/useOnlineMatch';
import { haptic } from '@/lib/settings';
import { colors, spacing, type } from '@/theme';

import { SosBoard } from './SosBoard';
import { SosLetterToggle } from './SosLetterToggle';
import { SosScoreHeader } from './SosScoreHeader';

interface Props {
  ctl: ReturnType<typeof useOnlineMatch>;
}

export function OnlineSosMatch({ ctl }: Props) {
  const { phase, me, online } = ctl;
  const sosState = online.sosState;
  const [selectedLetter, setSelectedLetter] = useState<SosLetter>('S');
  const [showConfirm, setShowConfirm] = useState<'leave' | 'resign' | null>(null);

  const p1Name = online.players?.X.name ?? 'Player 1';
  const p2Name = online.players?.O.name ?? 'Player 2';
  const isMyTurn = sosState?.status === 'playing' && sosState.toMove === me;
  const activeColor = sosState?.toMove === 'X' ? colors.coral : colors.cyan;

  // Sound effects on score updates
  useEffect(() => {
    if (!sosState) return;
    if (sosState.lastPointsEarned > 0) {
      playSound('fanfare');
      if (sosState.lastScoredBy === me) haptic.success();
      else haptic.medium();
    }
  }, [sosState?.ply, me]);

  const handleCellPress = useCallback(
    (cell: number) => {
      if (!isMyTurn || !sosState) return;
      const ok = online.playSos(cell, selectedLetter);
      if (ok) {
        playSound(selectedLetter === 'S' ? 'placeX' : 'placeO');
        haptic.selection();
      }
    },
    [isMyTurn, sosState, selectedLetter, online],
  );

  if (phase === 'race') {
    return (
      <OnlineStartRace
        goAtLocal={online.goAtLocal}
        names={{ X: p1Name, O: p2Name }}
        me={me}
        starter={online.raceStarter}
        onTap={online.raceTap}
      />
    );
  }

  if (!sosState) {
    return null;
  }

  const isFinished = phase === 'finished' || sosState.status === 'finished';
  const winner = sosState.winner;
  const winnerTitle =
    winner === 'draw'
      ? 'Draw Match!'
      : winner === me
        ? 'You Win!'
        : `${winner === 'X' ? p1Name : p2Name} Wins!`;

  return (
    <Screen>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (isFinished ? router.back() : setShowConfirm('resign'))}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={[type.label, styles.backText]}>
            {isFinished ? '‹ Back' : '‹ Resign'}
          </Text>
        </Pressable>
        <Text style={type.label}>SOS ONLINE DUEL</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Online Error Toast */}
      {online.error && (
        <View style={styles.errorBanner}>
          <Text style={[type.caption, { color: colors.coral }]}>{online.error}</Text>
        </View>
      )}

      {/* Score Header */}
      <SosScoreHeader state={sosState} p1Name={p1Name} p2Name={p2Name} />

      {/* Turn indicator */}
      {!isFinished && (
        <View style={styles.turnIndicator}>
          <View style={[styles.dot, { backgroundColor: activeColor }]} />
          <Text style={[type.label, { color: isMyTurn ? colors.gold : colors.textDim }]}>
            {isMyTurn ? 'YOUR TURN — TAP A CELL' : `WAITING FOR ${sosState.toMove === 'X' ? p1Name : p2Name}…`}
          </Text>
        </View>
      )}

      {/* Board */}
      <View style={styles.boardContainer}>
        <SosBoard state={sosState} onCellPress={handleCellPress} disabled={!isMyTurn} />
      </View>

      {/* Letter Selector */}
      {!isFinished && (
        <SosLetterToggle
          selectedLetter={selectedLetter}
          onSelect={setSelectedLetter}
          playerColor={isMyTurn ? activeColor : colors.hairline}
        />
      )}

      {/* Resign Bottom Sheet */}
      <BottomSheet
        visible={showConfirm === 'resign'}
        onClose={() => setShowConfirm(null)}
        title="Resign Match?">
        <Text style={[type.bodyDim, styles.modalText]}>
          Resigning will forfeit the match and count as a loss.
        </Text>
        <GlowButton
          title="Resign match"
          variant="coral"
          size="md"
          onPress={() => {
            setShowConfirm(null);
            ctl.resign();
          }}
        />
        <GlowButton
          title="Keep playing"
          variant="glass"
          size="md"
          onPress={() => setShowConfirm(null)}
        />
      </BottomSheet>

      {/* Game Finished Overlay */}
      {isFinished && (
        <BottomSheet visible={isFinished} onClose={() => {}} title={winnerTitle}>
          <Text style={[type.bodyDim, styles.modalText]}>
            Final Score: {p1Name} ({sosState.scores.X}) — {p2Name} ({sosState.scores.O})
          </Text>
          <GlowButton
            title={
              online.rematchRequested
                ? 'Waiting for opponent…'
                : online.opponentWantsRematch
                  ? 'Accept Rematch'
                  : 'Request Rematch'
            }
            variant="cyan"
            size="md"
            disabled={online.rematchRequested}
            onPress={() => ctl.rematch()}
          />
          <GlowButton
            title="Back to Home"
            variant="glass"
            size="md"
            onPress={() => router.replace('/(tabs)')}
          />
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
  errorBanner: {
    backgroundColor: colors.glass,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
