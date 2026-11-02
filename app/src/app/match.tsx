import { BOT_LEVELS, other, winsNeeded } from '@fade/engine';
import type { BotLevel, Player, TimeControl } from '@fade/engine';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, Easing, FadeIn, FadeOut, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { GlowButton } from '@/components/GlowButton';
import { Board } from '@/game/Board';
import { MatchResult, RoundBanner, SuddenDeathBanner, TimeStamp, Vignette } from '@/game/MatchOverlays';
import { PlayerCard } from '@/game/PlayerCard';
import { playSound, preloadSounds } from '@/game/sounds';
import { OnlineStartRace, StartRace } from '@/game/StartRace';
import type { OnlineExtras } from '@/game/useOnlineMatch';
import type { MatchController } from '@/game/types';
import { useLocalMatch } from '@/game/useLocalMatch';
import { haptic, useSettings } from '@/lib/settings';
import type { AvatarId } from '@/lib/settings';
import { colors, radii, spacing, type, withAlpha } from '@/theme';

const LEVEL_NAMES: Record<BotLevel, string> = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', impossible: 'IMPOSSIBLE' };
const BOT_AVATAR: AvatarId = { glyph: 'eye', color: 'cyan' };
const colorOf = (p: Player | null) => (p === 'X' ? colors.x : p === 'O' ? colors.o : colors.text);

type Flash = { kind: 'round'; text: string; sub?: string; color: string } | { kind: 'time'; color: string } | { kind: 'sudden' };

export default function MatchRoute() {
  const params = useLocalSearchParams<{ mode?: string; level?: string; tc?: string }>();
  const mode = params.mode === 'pass' ? 'pass' : 'bot';
  const level = (BOT_LEVELS as readonly string[]).includes(params.level ?? '') ? (params.level as BotLevel) : 'medium';
  const tc: TimeControl = params.tc === 'blitz' ? 'blitz' : 'rapid';
  const ctl = useLocalMatch({ mode, level, timeControl: tc });
  return <MatchScreen ctl={ctl} />;
}

export function MatchScreen({ ctl, online }: { ctl: MatchController; online?: OnlineExtras }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const username = useSettings((s) => s.username) ?? 'You';
  const myAvatar = useSettings((s) => s.avatar);
  const { match, phase } = ctl;
  const round = match?.round ?? null;
  const [flash, setFlash] = useState<Flash | null>(null);
  const [confirm, setConfirm] = useState<'resign' | 'leave' | null>(null);
  const clock = useSharedValue(1);
  const boardSize = Math.min(width - spacing.xl * 2, 420);

  useEffect(() => preloadSounds(), []);

  const names: Record<Player, string> =
    ctl.kind === 'bot'
      ? { X: username, O: 'FADE Bot' }
      : ctl.kind === 'pass'
        ? { X: 'Player X', O: 'Player O' }
        : { X: online?.players?.X.name ?? 'X', O: online?.players?.O.name ?? 'O' };
  const avatars: Record<Player, AvatarId> =
    ctl.kind === 'bot'
      ? { X: myAvatar, O: BOT_AVATAR }
      : online?.players
        ? { X: online.players.X.avatar, O: online.players.O.avatar }
        : { X: { glyph: 'bolt', color: 'coral' }, O: { glyph: 'moon', color: 'cyan' } };

  const showFlash = (f: Flash, ms: number) => {
    setFlash(f);
    setTimeout(() => setFlash((cur) => (cur === f ? null : cur)), ms);
  };

  // Clock ring: restart for every turn, deplete on the UI thread.
  useEffect(() => {
    if (!round || phase !== 'playing') {
      cancelAnimation(clock);
      return;
    }
    // Online turns can start slightly in the future (server start pause): hold the ring full until then.
    const wait = Math.max(0, ctl.turnStartedAt - Date.now());
    const elapsed = Math.max(0, Date.now() - ctl.turnStartedAt);
    const remaining = Math.max(0, ctl.turnMs - elapsed) + wait;
    clock.value = Math.min(1, (remaining - wait) / ctl.turnMs);
    clock.value = withDelay(wait, withTiming(0, { duration: remaining - wait, easing: Easing.linear }));
    // Heartbeat haptic at 1 s left, quiet ticks in the last second.
    const t1 = setTimeout(() => {
      haptic.medium();
      playSound('tick');
    }, remaining - 1000);
    const t2 = setTimeout(() => playSound('tick'), remaining - 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [round?.ply, match?.roundNo, phase, ctl.turnStartedAt, ctl.turnMs, clock, round]);

  // Sounds, haptics and banners for what each ply did.
  const lastPly = useRef<string>('');
  useEffect(() => {
    if (!match || !round) return;
    const key = `${match.roundNo}:${round.ply}`;
    if (key === lastPly.current) return;
    lastPly.current = key;
    if (round.ply === 0) {
      playSound('whoosh');
      showFlash({ kind: 'round', text: `ROUND ${match.roundNo}`, sub: `${names[round.starter]} starts`, color: colorOf(round.starter) }, 1100);
      return;
    }
    const last = round.last;
    if (last?.kind === 'move') {
      playSound(last.player === 'X' ? 'placeX' : 'placeO');
      haptic.light();
      if (last.faded !== null) setTimeout(() => playSound('fade'), 140);
    } else if (last?.kind === 'timeout') {
      playSound('timeout');
      haptic.medium();
      showFlash({ kind: 'time', color: colorOf(last.player) }, 900);
    }
    if (round.status === 'playing' && round.ply === round.config.suddenDeathAfter) {
      playSound('sudden');
      haptic.medium();
      showFlash({ kind: 'sudden' }, 1500);
    }
    if (round.status !== 'playing') {
      const w = round.winner;
      const mine = ctl.me === null ? w !== null : w === ctl.me;
      setTimeout(() => {
        if (w && mine) {
          playSound('win');
          haptic.success();
        } else {
          playSound('lose');
          haptic.medium();
        }
      }, 120);
      const text = w === null ? 'DRAW' : ctl.me === null ? `${w} TAKES THE ROUND` : w === ctl.me ? 'ROUND WON' : 'ROUND LOST';
      const sub = round.reason === 'timeouts' ? `${names[other(w ?? 'X')]} timed out 3 times` : round.reason === 'cap' ? '60 moves, no winner' : undefined;
      setTimeout(() => showFlash({ kind: 'round', text, sub, color: colorOf(w) }, 1700), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.roundNo, round?.ply, round?.status]);

  // Match end sound.
  useEffect(() => {
    if (phase !== 'finished' || !match) return;
    const mine = ctl.me === null ? true : match.winner === ctl.me;
    playSound(mine && match.winner ? 'fanfare' : 'matchLose');
  }, [phase, match, ctl.me]);

  const onCell = (cell: number) => {
    if (!ctl.play(cell)) {
      playSound('error');
      haptic.medium();
    }
  };

  const toMove = round?.toMove ?? null;
  const interactive = phase === 'playing' && toMove !== null && (ctl.me === null || toMove === ctl.me);
  const need = match ? winsNeeded(match.config) : 3;
  const topPlayer: Player = ctl.me === 'O' ? 'X' : 'O';
  const bottomPlayer: Player = other(topPlayer);

  const card = (p: Player) => (
    <PlayerCard
      player={p}
      name={names[p]}
      tag={ctl.kind === 'bot' && p === 'O' ? `BOT · ${LEVEL_NAMES[ctl.botLevel ?? 'medium']}` : ctl.me === p ? 'YOU' : undefined}
      avatar={avatars[p]}
      wins={match?.score[p] ?? 0}
      winsNeeded={need}
      active={phase === 'playing' && toMove === p}
      clock={clock}
      turnMs={ctl.turnMs}
      flipped={ctl.kind === 'pass' && p === topPlayer}
    />
  );

  const resultInfo = () => {
    if (!match) return null;
    const w = match.winner;
    const outcome = ctl.me === null ? 'neutral' : w === null ? 'draw' : w === ctl.me ? 'win' : 'loss';
    const title =
      w === null ? 'DRAWN MATCH' : ctl.me === null ? `${names[w].toUpperCase()} WINS` : w === ctl.me ? 'YOU WIN!' : ctl.kind === 'bot' ? 'THE BOT WINS' : 'YOU LOSE';
    const reason = match.reason === 'resign' ? `${names[other(w ?? 'X')]} resigned` : match.reason === 'disconnect' ? 'Opponent disconnected' : `Best of ${match.config.bestOf}`;
    return { outcome, title, reason } as const;
  };
  const result = phase === 'finished' ? resultInfo() : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (phase === 'playing' || phase === 'roundOver' ? setConfirm('leave') : router.back())}
          hitSlop={12}
          accessibilityLabel="Leave match">
          <Text style={[type.label, styles.headerBtn]}>✕</Text>
        </Pressable>
        <Text style={type.caption}>
          {match ? `ROUND ${match.roundNo} · ${match.config.timeControl.toUpperCase()}` : 'GET READY'}
        </Text>
        <Pressable onPress={() => setConfirm('resign')} disabled={!match || phase === 'finished'} hitSlop={12} accessibilityLabel="Resign">
          <Text style={[type.label, styles.headerBtn]}>⚑</Text>
        </Pressable>
      </View>

      {card(topPlayer)}
      <View style={styles.boardWrap}>
        {round && match && (
          <Board round={round} roundKey={`${match.roundNo}`} size={boardSize} interactive={interactive} onCell={onCell} />
        )}
        {flash?.kind === 'round' && <RoundBanner text={flash.text} sub={flash.sub} color={flash.color} />}
        {flash?.kind === 'time' && <TimeStamp color={flash.color} />}
        {flash?.kind === 'sudden' && <SuddenDeathBanner />}
      </View>
      {card(bottomPlayer)}

      <Vignette clock={clock} turnMs={ctl.turnMs} color={colorOf(toMove)} active={phase === 'playing' && interactive} />

      {phase === 'race' && online && !online.aborted && (
        <OnlineStartRace goAtLocal={online.goAtLocal} names={names} me={ctl.me} starter={online.raceStarter} onTap={online.raceTap} />
      )}
      {phase === 'race' && !online && (
        <StartRace
          mode={ctl.kind === 'pass' ? 'pass' : 'bot'}
          botLevel={ctl.botLevel}
          names={names}
          onResolved={(s) => ctl.begin(s)}
        />
      )}
      {result && match && (
        <MatchResult
          outcome={result.outcome}
          title={result.title}
          winner={match.winner}
          score={match.score}
          reason={result.reason}
          onRematch={ctl.rematch}
          onHome={() => router.back()}
          rematchTitle={online?.rematchRequested ? `Waiting for ${ctl.me ? names[other(ctl.me)] : 'opponent'}…` : 'Rematch'}
          rematchDisabled={online?.rematchRequested}
          note={online?.opponentWantsRematch && !online.rematchRequested ? `${ctl.me ? names[other(ctl.me)] : 'Opponent'} wants a rematch!` : undefined}
        />
      )}
      {online?.aborted && (
        <Animated.View entering={FadeIn} style={styles.aborted}>
          <Text style={type.title}>Match cancelled</Text>
          <Text style={[type.bodyDim, styles.center]}>A player left before the first move.</Text>
          <GlowButton title="Home" variant="glass" size="md" onPress={() => router.back()} />
        </Animated.View>
      )}
      {online?.error && phase !== 'finished' && (
        <Animated.View key={online.error} entering={FadeIn} exiting={FadeOut} style={styles.toast} pointerEvents="none">
          <Text style={[type.label, styles.center]}>{online.error}</Text>
        </Animated.View>
      )}

      <BottomSheet visible={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'resign' ? 'Resign this match?' : 'Leave this match?'}>
        <Text style={[type.bodyDim, styles.center]}>
          {confirm === 'resign'
            ? ctl.kind === 'pass'
              ? `${names[toMove ?? 'X']} (to move) resigns and loses the match.`
              : 'You lose the match.'
            : ctl.kind === 'online'
              ? 'Leaving resigns: you lose the match.'
              : 'The match ends here.'}
        </Text>
        <GlowButton
          title={confirm === 'resign' ? 'Resign' : 'Leave'}
          variant="coral"
          size="md"
          onPress={() => {
            const c = confirm;
            setConfirm(null);
            if (c === 'resign') ctl.resign();
            else {
              if (ctl.kind === 'online') ctl.resign();
              router.back();
            }
          }}
        />
        <GlowButton title="Keep playing" variant="glass" size="md" onPress={() => setConfirm(null)} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { fontSize: 20, color: colors.textDim, paddingHorizontal: spacing.xs },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  aborted: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: withAlpha(colors.nightDeep, 0.94),
  },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 140,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: withAlpha(colors.alarm, 0.85),
  },
});
