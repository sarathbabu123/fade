import {
  Canvas,
  Circle,
  Fill,
  FractalNoise,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';
import { colors, withAlpha } from '@/theme';

const LOOP_MS = 28_000;

interface BlobSpec {
  color: string;
  /** Centre as a fraction of the screen, plus drift amplitude. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Radius as a fraction of screen height. */
  r: number;
  /** Phase offset (0–1) so blobs don't move in lockstep. */
  phase: number;
}

const BLOBS: BlobSpec[] = [
  { color: colors.aurora[0], x: 0.15, y: 0.12, dx: 0.18, dy: 0.06, r: 0.42, phase: 0 },
  { color: colors.aurora[1], x: 0.9, y: 0.32, dx: 0.12, dy: 0.1, r: 0.38, phase: 0.33 },
  { color: colors.aurora[2], x: 0.3, y: 0.85, dx: 0.2, dy: 0.05, r: 0.4, phase: 0.6 },
  { color: colors.aurora[3], x: 0.75, y: 0.95, dx: 0.1, dy: 0.08, r: 0.3, phase: 0.8 },
];

function Blob({ spec, t, w, h }: { spec: BlobSpec; t: { value: number }; w: number; h: number }) {
  const c = useDerivedValue(() => {
    const a = (t.value + spec.phase) * Math.PI * 2;
    return vec(w * (spec.x + spec.dx * Math.sin(a)), h * (spec.y + spec.dy * Math.cos(a * 0.7)));
  });
  const r = spec.r * h;
  return (
    <Circle c={c} r={r}>
      <RadialGradient c={c} r={r} colors={[withAlpha(spec.color, 0.55), withAlpha(spec.color, 0)]} />
    </Circle>
  );
}

/**
 * Slow aurora + fine film grain (PRD §7.1). The aurora animates on the UI thread;
 * grain lives on a separate static canvas so it is drawn once.
 */
export const AuroraBackground = memo(function AuroraBackground() {
  const { width: w, height: h } = useWindowDimensions();
  const reduce = useReduceMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      cancelAnimation(t);
      return;
    }
    t.value = withRepeat(withTiming(t.value + 1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, t]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={w} height={h}>
          <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[colors.night, colors.nightDeep]} />
        </Rect>
        <Group blendMode="screen">
          {BLOBS.map((b, i) => (
            <Blob key={i} spec={b} t={t} w={w} h={h} />
          ))}
        </Group>
      </Canvas>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill opacity={0.07} blendMode="overlay">
          <FractalNoise freqX={0.85} freqY={0.85} octaves={2} />
        </Fill>
      </Canvas>
    </View>
  );
});
