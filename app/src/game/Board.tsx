import { BlurMask, Canvas, Circle, DashPathEffect, Group, Line, Path, Points, Skia, vec } from '@shopify/react-native-skia';
import type { SkPoint } from '@shopify/react-native-skia';
import { nextToFade } from '@fade/engine';
import type { Player, RoundState } from '@fade/engine';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';
import { colors, motion, radii, withAlpha } from '@/theme';

const colorOf = (p: Player) => (p === 'X' ? colors.x : colors.o);

interface VisualMark {
  key: string;
  player: Player;
  cell: number;
}

interface Burst {
  key: string;
  cell: number;
  player: Player;
  kind: 'fade' | 'shatter';
}

/** Placement: X draws two strokes (120 ms each), O sweeps 360° (220 ms), both pop 0.85 → 1. */
function Mark({ mark, cs, n, pulse, fading, reduce }: { mark: VisualMark; cs: number; n: number; pulse: SharedValue<number>; fading: boolean; reduce: boolean }) {
  const cx = (mark.cell % n) * cs + cs / 2;
  const cy = Math.floor(mark.cell / n) * cs + cs / 2;
  const r = cs * 0.27;
  const draw = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(reduce ? 1 : 0.85);

  useEffect(() => {
    if (reduce) return;
    draw.value = withTiming(1, { duration: mark.player === 'X' ? 240 : 220, easing: Easing.out(Easing.quad) });
    pop.value = withSpring(1, { damping: 9, stiffness: 320 });
  }, [draw, pop, mark.player, reduce]);

  const [a, b] = useMemo(() => {
    if (mark.player === 'X') {
      return [
        Skia.PathBuilder.Make().moveTo(cx - r, cy - r).lineTo(cx + r, cy + r).detach(),
        Skia.PathBuilder.Make().moveTo(cx + r, cy - r).lineTo(cx - r, cy + r).detach(),
      ];
    }
    // Start at 12 o'clock, sweep clockwise.
    const o = Skia.PathBuilder.Make().addArc({ x: cx - r * 1.08, y: cy - r * 1.08, width: r * 2.16, height: r * 2.16 }, -90, 359.9).detach();
    return [o, null];
  }, [mark.player, cx, cy, r]);

  const endA = useDerivedValue(() => (mark.player === 'X' ? Math.min(1, draw.value * 2) : draw.value));
  const endB = useDerivedValue(() => Math.max(0, draw.value * 2 - 1));
  const transform = useDerivedValue(() => [{ scale: pop.value }]);
  const opacity = useDerivedValue(() => (fading ? pulse.value : 1));
  const color = colorOf(mark.player);
  const w = Math.max(4, cs * 0.075);

  return (
    <Group origin={vec(cx, cy)} transform={transform} opacity={fading ? opacity : undefined}>
      {fading && (
        <Circle cx={cx} cy={cy} r={cs * 0.41} color={withAlpha(colors.text, 0.4)} style="stroke" strokeWidth={1.3}>
          <DashPathEffect intervals={[2.5, 5]} />
        </Circle>
      )}
      {[a, b].map((p, i) =>
        p ? (
          <Group key={i}>
            {/* Glow: two soft wide strokes (cheaper than a blur filter, no layer artifacts). */}
            <Path path={p} color={withAlpha(color, fading ? 0.08 : 0.14)} style="stroke" strokeWidth={w * 3.4} strokeCap="round" end={i === 0 ? endA : endB} />
            <Path path={p} color={withAlpha(color, fading ? 0.16 : 0.3)} style="stroke" strokeWidth={w * 2} strokeCap="round" end={i === 0 ? endA : endB} />
            <Path path={p} color={color} style="stroke" strokeWidth={w} strokeCap="round" end={i === 0 ? endA : endB} />
          </Group>
        ) : null,
      )}
    </Group>
  );
}

const PARTICLES = 16;

/** A faded mark dissolves into glowing particles that drift up (450 ms); a timeout shatters it. */
function BurstFx({ burst, cs, n, onDone }: { burst: Burst; cs: number; n: number; onDone: (key: string) => void }) {
  const cx = (burst.cell % n) * cs + cs / 2;
  const cy = Math.floor(burst.cell / n) * cs + cs / 2;
  const t = useSharedValue(0);
  const seeds = useMemo(
    () => Array.from({ length: PARTICLES }, (_, i) => ({ a: (i / PARTICLES) * Math.PI * 2 + Math.random() * 0.6, d: 0.3 + Math.random() * 0.7 })),
    [],
  );
  const shatter = burst.kind === 'shatter';
  useEffect(() => {
    t.value = withTiming(1, { duration: shatter ? 520 : 450, easing: Easing.out(Easing.cubic) });
    const id = setTimeout(() => onDone(burst.key), 600);
    return () => clearTimeout(id);
  }, [t, burst.key, onDone, shatter]);

  const points = useDerivedValue<SkPoint[]>(() => {
    const out: SkPoint[] = [];
    const spread = cs * (shatter ? 0.55 : 0.35);
    for (const s of seeds) {
      const x = cx + Math.cos(s.a) * spread * s.d * t.value;
      const y = shatter
        ? cy + Math.sin(s.a) * spread * s.d * t.value + cs * 0.35 * t.value * t.value
        : cy + Math.sin(s.a) * spread * 0.5 * s.d * t.value - cs * 0.45 * t.value * s.d;
      out.push({ x, y });
      if (shatter) out.push({ x: x + Math.cos(s.a) * 6, y: y + Math.sin(s.a) * 6 });
    }
    return out;
  });
  const opacity = useDerivedValue(() => 1 - t.value);
  const color = shatter ? colors.text : colorOf(burst.player);
  return (
    <Group opacity={opacity}>
      <Points points={points} mode={shatter ? 'lines' : 'points'} color={withAlpha(color, 0.9)} style="stroke" strokeWidth={shatter ? 2 : 5} strokeCap="round">
        <BlurMask blur={shatter ? 1 : 3} style="solid" />
      </Points>
    </Group>
  );
}

interface Props {
  round: RoundState;
  /** Changes every round; resets visuals. */
  roundKey: string;
  size: number;
  /** Which player's taps are accepted right now (null = none). */
  interactive: boolean;
  onCell: (cell: number) => void;
}

/** Track marks with stable keys (for mount animations) and fade bursts, from each ply's `last`. */
function useVisuals(round: RoundState, roundKey: string) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const placedAt = useRef(new Map<string, number>());
  const seenPly = useRef(-1);
  const keyRef = useRef(roundKey);

  if (keyRef.current !== roundKey) {
    keyRef.current = roundKey;
    placedAt.current = new Map();
    seenPly.current = -1;
  }

  const last = round.last;
  useEffect(() => {
    if (round.ply === seenPly.current) return;
    seenPly.current = round.ply;
    if (last?.faded != null) {
      const b: Burst = { key: `${roundKey}:${round.ply}`, cell: last.faded, player: last.player, kind: last.kind === 'timeout' ? 'shatter' : 'fade' };
      setBursts((xs) => [...xs, b]);
    }
  }, [round.ply, last, roundKey]);

  const marks: VisualMark[] = [];
  for (const player of ['X', 'O'] as const) {
    for (const cell of round.marks[player]) {
      const id = `${player}:${cell}`;
      if (!placedAt.current.has(id)) placedAt.current.set(id, round.ply);
      marks.push({ key: `${roundKey}:${id}:${placedAt.current.get(id)}`, player, cell });
    }
  }
  // Forget cells that are no longer occupied so a re-placement gets a fresh key.
  for (const id of [...placedAt.current.keys()]) {
    const [p, c] = id.split(':') as [Player, string];
    if (!round.marks[p].includes(Number(c))) placedAt.current.delete(id);
  }
  const done = useRef((key: string) => setBursts((xs) => xs.filter((b) => b.key !== key))).current;
  return { marks, bursts, done };
}

export const Board = memo(function Board({ round, roundKey, size, interactive, onCell }: Props) {
  const reduce = useReduceMotion();
  const n = round.config.n;
  const cs = size / n;
  const inset = cs * 0.1;
  const { marks, bursts, done } = useVisuals(round, roundKey);

  const pulse = useSharedValue(1);
  const breathe = useSharedValue(0.7);
  const appear = useSharedValue(reduce ? 1 : 0);
  const beam = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(withTiming(0.45, { duration: motion.fadePulseMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withRepeat(withSequence(withTiming(0.6, { duration: 0 }), withTiming(0.8, { duration: motion.breatheMs / 2, easing: Easing.inOut(Easing.sin) })), -1, true);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(breathe);
    };
  }, [reduce, pulse, breathe]);

  // Board appears: grid draws in each round.
  useEffect(() => {
    if (reduce) return;
    appear.value = 0;
    appear.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [roundKey, appear, reduce]);

  // Win: beam through the line (250 ms) and a 6 px shake.
  const line = round.line;
  useEffect(() => {
    if (!line) {
      beam.value = 0;
      return;
    }
    beam.value = withTiming(1, { duration: reduce ? 0 : 250, easing: Easing.out(Easing.quad) });
    if (!reduce) {
      shake.value = withDelay(
        200,
        withSequence(withTiming(6, { duration: 40 }), withTiming(-6, { duration: 60 }), withTiming(4, { duration: 50 }), withTiming(-2, { duration: 40 }), withTiming(0, { duration: 40 })),
      );
    }
  }, [line, beam, shake, reduce]);

  const gridOpacity = useDerivedValue(() => breathe.value * appear.value);
  const gridScale = useDerivedValue(() => [{ scale: 0.9 + 0.1 * appear.value }]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const fadeX = nextToFade(round, 'X');
  const fadeO = nextToFade(round, 'O');

  const beamPath = useMemo(() => {
    if (!line) return null;
    const c = (i: number) => vec((i % n) * cs + cs / 2, Math.floor(i / n) * cs + cs / 2);
    const a = c(line[0]!);
    const b = c(line[line.length - 1]!);
    const dx = (b.x - a.x) * 0.12;
    const dy = (b.y - a.y) * 0.12;
    return Skia.PathBuilder.Make().moveTo(a.x - dx, a.y - dy).lineTo(b.x + dx, b.y + dy).detach();
  }, [line, n, cs]);
  const beamColor = round.winner ? colorOf(round.winner) : colors.text;
  const dimmed = round.status !== 'playing' && round.winner === null;

  return (
    <Animated.View style={[{ width: size, height: size }, shakeStyle]}>
      <Canvas style={{ width: size, height: size, opacity: dimmed ? 0.55 : 1 }}>
        <Group opacity={gridOpacity} origin={vec(size / 2, size / 2)} transform={gridScale}>
          {Array.from({ length: n - 1 }, (_, i) => {
            const p = cs * (i + 1);
            return (
              <Group key={i}>
                <Line p1={vec(p, inset)} p2={vec(p, size - inset)} color={withAlpha(colors.grid, 0.18)} strokeWidth={6} strokeCap="round" />
                <Line p1={vec(inset, p)} p2={vec(size - inset, p)} color={withAlpha(colors.grid, 0.18)} strokeWidth={6} strokeCap="round" />
                <Line p1={vec(p, inset)} p2={vec(p, size - inset)} color={colors.grid} strokeWidth={2} strokeCap="round" />
                <Line p1={vec(inset, p)} p2={vec(size - inset, p)} color={colors.grid} strokeWidth={2} strokeCap="round" />
              </Group>
            );
          })}
        </Group>
        {line?.map((c) => (
          <Circle key={`flash${c}`} cx={(c % n) * cs + cs / 2} cy={Math.floor(c / n) * cs + cs / 2} r={cs * 0.42} color={withAlpha(beamColor, 0.14)} />
        ))}
        {marks.map((m) => (
          <Mark key={m.key} mark={m} cs={cs} n={n} pulse={pulse} reduce={reduce} fading={round.status === 'playing' && (m.cell === fadeX || m.cell === fadeO)} />
        ))}
        {!reduce && bursts.map((b) => <BurstFx key={b.key} burst={b} cs={cs} n={n} onDone={done} />)}
        {beamPath && (
          <Group>
            <Path path={beamPath} color={withAlpha(beamColor, 0.8)} style="stroke" strokeWidth={cs * 0.12} strokeCap="round" end={beam}>
              <BlurMask blur={cs * 0.08} style="normal" />
            </Path>
            <Path path={beamPath} color={colors.text} style="stroke" strokeWidth={cs * 0.035} strokeCap="round" end={beam} />
          </Group>
        )}
      </Canvas>
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: n * n }, (_, c) => (
          <Pressable
            key={c}
            disabled={!interactive}
            onPressIn={() => onCell(c)}
            accessibilityRole="button"
            accessibilityLabel={`Cell ${Math.floor(c / n) + 1}, ${(c % n) + 1}`}
            style={[styles.cell, { left: (c % n) * cs, top: Math.floor(c / n) * cs, width: cs, height: cs }]}
          />
        ))}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cell: { position: 'absolute', borderRadius: radii.md },
});
