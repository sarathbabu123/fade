import { BlurMask, Canvas, Group, Path, Points, Skia } from '@shopify/react-native-skia';
import type { SkPoint } from '@shopify/react-native-skia';
import type { Player } from '@fade/engine';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { glyphs } from '@/components/glyphs';
import { GlowButton } from '@/components/GlowButton';
import { useReduceMotion } from '@/lib/motion';
import { colors, fonts, glow, radii, spacing, type, withAlpha } from '@/theme';

const colorOf = (p: Player | null) => (p === 'X' ? colors.x : p === 'O' ? colors.o : colors.text);

/** "ROUND 2" at a round's start, or the round's result at its end. */
export function RoundBanner({ text, sub, color }: { text: string; sub?: string; color: string }) {
  return (
    <Animated.View entering={ZoomIn.duration(220).easing(Easing.out(Easing.quad))} exiting={FadeOut.duration(200)} style={styles.bannerWrap} pointerEvents="none">
      <View style={[styles.banner, { borderColor: withAlpha(color, 0.6), boxShadow: glow(color, 28, 0.35) }]}>
        <Text style={[styles.bannerText, { color, textShadowColor: color }]}>{text}</Text>
        {sub ? <Text style={type.bodyDim}>{sub}</Text> : null}
      </View>
    </Animated.View>
  );
}

/** "TIME" slams in and fades when a player times out. */
export function TimeStamp({ color }: { color: string }) {
  return (
    <Animated.View entering={ZoomIn.duration(180).easing(Easing.out(Easing.quad))} exiting={FadeOut.duration(300)} style={styles.stampWrap} pointerEvents="none">
      <Text style={[styles.stamp, { color, borderColor: color, textShadowColor: color }]}>TIME</Text>
    </Animated.View>
  );
}

/** "SUDDEN DEATH" sweeps across the screen. */
export function SuddenDeathBanner() {
  const { width } = useWindowDimensions();
  const x = useSharedValue(-width);
  useEffect(() => {
    x.value = withSequence(withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 700 }), withTiming(width, { duration: 350, easing: Easing.in(Easing.cubic) }));
  }, [x, width]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <Animated.View style={[styles.sudden, style]}>
        <Text style={styles.suddenText}>SUDDEN DEATH</Text>
      </Animated.View>
    </View>
  );
}

/** Screen-edge vignette that pulses in the player's colour in the last 0.5 s. */
export function Vignette({ clock, turnMs, color, active }: { clock: SharedValue<number>; turnMs: number; color: string; active: boolean }) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 160 }), -1, true);
  }, [pulse]);
  const threshold = turnMs > 0 ? 500 / turnMs : 0;
  const style = useAnimatedStyle(() => {
    const on = active && clock.value > 0 && clock.value <= threshold;
    return { opacity: on ? (reduce ? 0.6 : 0.35 + 0.5 * pulse.value) : 0 };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { boxShadow: `inset 0 0 70px 10px ${withAlpha(color, 0.75)}` }, style]} />;
}

const CONFETTI = 70;

function Confetti({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) });
  }, [t]);
  const seeds = useMemo(
    () => Array.from({ length: CONFETTI }, () => ({ x: Math.random(), v: 0.6 + Math.random() * 0.8, sway: Math.random() * Math.PI * 2, c: Math.floor(Math.random() * 3) })),
    [],
  );
  const at = (k: number, tv: number) => {
    'worklet';
    const out: SkPoint[] = [];
    for (const s of seeds) if (s.c === k) out.push({ x: s.x * width + Math.sin(s.sway + tv * 8) * 18, y: -20 + tv * s.v * height });
    return out;
  };
  const a = useDerivedValue(() => at(0, t.value));
  const b = useDerivedValue(() => at(1, t.value));
  const c = useDerivedValue(() => at(2, t.value));
  const opacity = useDerivedValue(() => 1 - Math.max(0, t.value - 0.75) * 4);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={opacity}>
        <Points points={a} mode="points" color={colors.gold} style="stroke" strokeWidth={7} strokeCap="square" />
        <Points points={b} mode="points" color={colors.x} style="stroke" strokeWidth={6} strokeCap="round" />
        <Points points={c} mode="points" color={colors.o} style="stroke" strokeWidth={6} strokeCap="square" />
      </Group>
    </Canvas>
  );
}

const crownPath = Skia.Path.MakeFromSVGString(glyphs.crown)!;

function Crown({ color }: { color: string }) {
  return (
    <Canvas style={{ width: 96, height: 96 }}>
      <Group transform={[{ scale: 4 }]}>
        <Path path={crownPath} color={withAlpha(color, 0.8)} style="stroke" strokeWidth={1.6} strokeJoin="round">
          <BlurMask blur={1.6} style="normal" />
        </Path>
        <Path path={crownPath} color={color} style="stroke" strokeWidth={0.9} strokeJoin="round" />
      </Group>
    </Canvas>
  );
}

interface ResultProps {
  /** 'win' | 'loss' | 'draw' from the local player's side; 'neutral' in pass & play. */
  outcome: 'win' | 'loss' | 'draw' | 'neutral';
  title: string;
  winner: Player | null;
  score: Record<Player, number>;
  reason: string;
  onRematch: () => void;
  onHome: () => void;
  rematchTitle?: string;
  rematchDisabled?: boolean;
  /** Extra line under the score, e.g. "Sam wants a rematch!". */
  note?: string;
}

/** Full-screen match result: crown drop + confetti for a win, a calm card for a loss. */
export function MatchResult({ outcome, title, winner, score, reason, onRematch, onHome, rematchTitle, rematchDisabled, note }: ResultProps) {
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const color = outcome === 'loss' ? colors.textDim : winner ? colorOf(winner) : colors.text;
  const celebrate = outcome === 'win' || (outcome === 'neutral' && winner !== null);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[StyleSheet.absoluteFill, styles.result]}>
      {celebrate && !reduce && <Confetti width={width} height={height} />}
      <View style={styles.resultBody}>
        {celebrate && (
          <Animated.View entering={reduce ? FadeIn : SlideInUp.duration(280).easing(Easing.out(Easing.quad))}>
            <Crown color={colors.gold} />
          </Animated.View>
        )}
        <Text style={[styles.resultTitle, { color, textShadowColor: color }]}>{title}</Text>
        <View style={styles.score}>
          <AnimatedNumber value={score.X} style={{ ...type.number, fontSize: 48, color: colors.x }} />
          <Text style={[type.number, styles.dash]}>–</Text>
          <AnimatedNumber value={score.O} style={{ ...type.number, fontSize: 48, color: colors.o }} />
        </View>
        <Text style={type.bodyDim}>{reason}</Text>
        {note ? <Text style={[type.label, { color: colors.gold }]}>{note}</Text> : null}
        <View style={styles.buttons}>
          <GlowButton title={rematchTitle ?? 'Rematch'} disabled={rematchDisabled} variant={outcome === 'loss' ? 'coral' : 'cyan'} onPress={onRematch} />
          <GlowButton title="Home" variant="glass" size="md" onPress={onHome} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  banner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.xl,
    borderWidth: 1,
    backgroundColor: withAlpha(colors.nightDeep, 0.9),
    alignItems: 'center',
    gap: spacing.xs,
  },
  bannerText: { fontFamily: fonts.displayHeavy, fontSize: 26, letterSpacing: 1.5, textShadowRadius: 14 },
  stampWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 11 },
  stamp: {
    fontFamily: fonts.displayHeavy,
    fontSize: 54,
    letterSpacing: 6,
    borderWidth: 4,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    textShadowRadius: 16,
    transform: [{ rotate: '-8deg' }],
  },
  sudden: {
    width: '100%',
    paddingVertical: spacing.md,
    backgroundColor: withAlpha(colors.coral, 0.22),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: withAlpha(colors.coral, 0.6),
    alignItems: 'center',
  },
  suddenText: { fontFamily: fonts.displayHeavy, fontSize: 24, letterSpacing: 4, color: colors.coral },
  result: { backgroundColor: withAlpha(colors.nightDeep, 0.92), zIndex: 30, justifyContent: 'center' },
  resultBody: { alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  resultTitle: { fontFamily: fonts.displayHeavy, fontSize: 34, letterSpacing: 1.5, textShadowRadius: 18, textAlign: 'center' },
  score: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dash: { fontSize: 40, color: colors.textFaint },
  buttons: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
});
