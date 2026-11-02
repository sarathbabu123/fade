import { botReactionMs, resolveStartRace, START_RACE } from '@fade/engine';
import type { BotLevel, Player, RaceTap } from '@fade/engine';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { haptic } from '@/lib/settings';
import { colors, fonts, spacing, type, withAlpha } from '@/theme';

import { playSound } from './sounds';

type Stage = 'ready' | 'go' | 'result';

interface Props {
  mode: 'bot' | 'pass';
  botLevel: BotLevel | null;
  /** Names to announce the starter. */
  names: Record<Player, string>;
  onResolved: (starter: Player) => void;
}

/**
 * "GET READY… GO!": the fastest tap after GO starts round 1 (BUILD_PLAN decision).
 * Vs the bot the whole screen is your button; in pass & play X taps the bottom half
 * and O the top half.
 */
export function StartRace({ mode, botLevel, names, onResolved }: Props) {
  const [stage, setStage] = useState<Stage>('ready');
  const [starter, setStarter] = useState<Player | null>(null);
  const [falseStart, setFalseStart] = useState<Player | null>(null);
  const goAt = useRef(0);
  const taps = useRef<Record<Player, RaceTap>>({ X: { kind: 'none' }, O: { kind: 'none' } });
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    const s = resolveStartRace(taps.current.X, taps.current.O, Math.random() < 0.5 ? 'X' : 'O');
    setStarter(s);
    setStage('result');
    haptic.medium();
    setTimeout(() => onResolved(s), 1100);
  };

  useEffect(() => {
    playSound('ready');
    const delay = 1400 + Math.random() * 1400;
    const go = setTimeout(() => {
      goAt.current = performance.now();
      setStage('go');
      playSound('go');
      haptic.light();
      if (mode === 'bot' && botLevel) {
        // Never a disguised human: the bot's reaction is just a timer.
        setTimeout(() => {
          if (taps.current.O.kind === 'none') taps.current.O = { kind: 'tap', reactionMs: botReactionMs(botLevel, Math.random) };
          if (taps.current.X.kind !== 'none') finish();
        }, botReactionMs(botLevel, Math.random));
      }
    }, delay);
    const windowEnd = setTimeout(finish, delay + START_RACE.windowMs);
    return () => {
      clearTimeout(go);
      clearTimeout(windowEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (p: Player) => {
    if (done.current || taps.current[p].kind !== 'none') return;
    if (goAt.current === 0) {
      taps.current[p] = { kind: 'falseStart' };
      setFalseStart(p);
      playSound('error');
      haptic.medium();
    } else {
      taps.current[p] = { kind: 'tap', reactionMs: performance.now() - goAt.current };
      haptic.light();
    }
    const other = p === 'X' ? 'O' : 'X';
    if (taps.current[other].kind !== 'none') finish();
  };

  const label =
    stage === 'ready' ? 'GET READY…' : stage === 'go' ? 'GO!' : `${names[starter!].toUpperCase()} STARTS`;
  const labelColor = stage === 'go' ? colors.gold : stage === 'result' ? (starter === 'X' ? colors.x : colors.o) : colors.text;

  const center = (
    <Animated.View key={stage} entering={ZoomIn.springify().damping(12)} style={styles.center} pointerEvents="none">
      <Text style={[styles.big, { color: labelColor, textShadowColor: labelColor }]}>{label}</Text>
      {stage !== 'result' && <Text style={type.bodyDim}>{mode === 'bot' ? 'Tap first after GO to move first' : 'Fastest tap after GO moves first'}</Text>}
      {falseStart && stage !== 'result' && (
        <Text style={[type.label, { color: colors.alarm }]}>False start: {names[falseStart]}!</Text>
      )}
    </Animated.View>
  );

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.root]}>
      {mode === 'pass' ? (
        <>
          <Pressable style={[styles.half, styles.top]} onPressIn={() => tap('O')} accessibilityLabel={`${names.O} tap here`}>
            <Text style={[type.heading, styles.flipped, { color: colors.o }]}>O · TAP HERE</Text>
          </Pressable>
          <Pressable style={[styles.half, styles.bottom]} onPressIn={() => tap('X')} accessibilityLabel={`${names.X} tap here`}>
            <Text style={[type.heading, { color: colors.x }]}>X · TAP HERE</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPressIn={() => tap('X')} accessibilityLabel="Tap after GO" />
      )}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {center}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: withAlpha(colors.nightDeep, 0.88), zIndex: 20 },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { borderBottomWidth: 1, borderColor: colors.hairline, backgroundColor: withAlpha(colors.o, 0.05) },
  bottom: { backgroundColor: withAlpha(colors.x, 0.05) },
  flipped: { transform: [{ rotate: '180deg' }] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  big: { fontFamily: fonts.displayHeavy, fontSize: 38, letterSpacing: 2, textShadowRadius: 18, textAlign: 'center' },
});

interface OnlineProps {
  /** GO time on this phone's clock (server time minus measured offset). */
  goAtLocal: number;
  names: Record<Player, string>;
  me: Player | null;
  /** Known once the server resolved the race. */
  starter: Player | null;
  onTap: (tap: RaceTap) => void;
}

/** Online start race: GO is scheduled by the server; the reaction is measured on this phone. */
export function OnlineStartRace({ goAtLocal, names, me, starter, onTap }: OnlineProps) {
  const [stage, setStage] = useState<Stage>(() => (Date.now() >= goAtLocal ? 'go' : 'ready'));
  const [mine, setMine] = useState<RaceTap | null>(null);
  const goPerf = useRef(0);

  useEffect(() => {
    playSound('ready');
    const wait = Math.max(0, goAtLocal - Date.now());
    const id = setTimeout(() => {
      goPerf.current = performance.now();
      setStage('go');
      playSound('go');
      haptic.light();
    }, wait);
    return () => clearTimeout(id);
  }, [goAtLocal]);

  useEffect(() => {
    if (starter) {
      setStage('result');
      haptic.medium();
    }
  }, [starter]);

  const tap = () => {
    if (mine || starter || !me) return;
    const t: RaceTap = goPerf.current === 0 ? { kind: 'falseStart' } : { kind: 'tap', reactionMs: performance.now() - goPerf.current };
    setMine(t);
    if (t.kind === 'falseStart') playSound('error');
    haptic.light();
    onTap(t);
  };

  const label =
    stage === 'result' && starter
      ? `${starter === me ? 'YOU START' : `${names[starter].toUpperCase()} STARTS`}`
      : stage === 'go'
        ? 'GO!'
        : 'GET READY…';
  const labelColor = stage === 'go' ? colors.gold : stage === 'result' ? (starter === 'X' ? colors.x : colors.o) : colors.text;
  const hint =
    stage === 'result'
      ? ''
      : mine?.kind === 'falseStart'
        ? 'False start! Waiting for your opponent…'
        : mine?.kind === 'tap'
          ? `${Math.round(mine.reactionMs)} ms · waiting for your opponent…`
          : 'Tap first after GO to move first';

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.root]}>
      <Pressable style={StyleSheet.absoluteFill} onPressIn={tap} accessibilityLabel="Tap after GO" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View key={stage} entering={ZoomIn.springify().damping(12)} style={styles.center}>
          <Text style={[styles.big, { color: labelColor, textShadowColor: labelColor }]}>{label}</Text>
          {hint ? <Text style={[type.bodyDim, mine?.kind === 'falseStart' && { color: colors.alarm }]}>{hint}</Text> : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
