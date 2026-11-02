import { Canvas, Circle, DashPathEffect, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/motion';
import { colors, motion, withAlpha } from '@/theme';

export type Cell = 'X' | 'O' | null;

interface Props {
  cells: readonly Cell[];
  size: number;
  /** Cells whose mark is next to fade: pulse + dotted ring. */
  fading?: readonly number[];
  /** Winning line cells: drawn brighter. */
  line?: readonly number[];
}

function Mark({ kind, cx, cy, s, opacity }: { kind: 'X' | 'O'; cx: number; cy: number; s: number; opacity: SharedValue<number> | number }) {
  const color = kind === 'X' ? colors.x : colors.o;
  const path = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const r = s * 0.27;
    if (kind === 'X') {
      p.moveTo(cx - r, cy - r).lineTo(cx + r, cy + r);
      p.moveTo(cx + r, cy - r).lineTo(cx - r, cy + r);
    } else {
      p.addCircle(cx, cy, r * 1.08);
    }
    return p.detach();
  }, [kind, cx, cy, s]);
  const w = Math.max(3, s * 0.085);
  return (
    <Group opacity={opacity}>
      <Path path={path} color={withAlpha(color, 0.14)} style="stroke" strokeWidth={w * 3.4} strokeCap="round" />
      <Path path={path} color={withAlpha(color, 0.3)} style="stroke" strokeWidth={w * 2} strokeCap="round" />
      <Path path={path} color={color} style="stroke" strokeWidth={w} strokeCap="round" />
    </Group>
  );
}

/**
 * Small Skia board for onboarding demos and the gallery. The full match board
 * (Phase 2) grows out of this. All motion runs on the UI thread.
 */
export const MiniBoard = memo(function MiniBoard({ cells, size, fading = [], line = [] }: Props) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(1);
  const breathe = useSharedValue(0.7);

  useEffect(() => {
    if (reduce) {
      pulse.value = 0.6;
      breathe.value = 0.7;
      return;
    }
    pulse.value = withRepeat(withTiming(0.45, { duration: motion.fadePulseMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = 0.6;
    breathe.value = withRepeat(withTiming(0.8, { duration: motion.breatheMs / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(breathe);
    };
  }, [reduce, pulse, breathe]);

  const n = Math.round(Math.sqrt(cells.length));
  const cs = size / n;
  const inset = cs * 0.12;
  const gridOpacity = useDerivedValue(() => breathe.value);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group opacity={gridOpacity}>
        {Array.from({ length: n - 1 }, (_, i) => {
          const p = cs * (i + 1);
          return (
            <Group key={i}>
              <Line p1={vec(p, inset)} p2={vec(p, size - inset)} color={colors.grid} strokeWidth={1.5} strokeCap="round" />
              <Line p1={vec(inset, p)} p2={vec(size - inset, p)} color={colors.grid} strokeWidth={1.5} strokeCap="round" />
            </Group>
          );
        })}
      </Group>
      {cells.map((cell, i) => {
        if (!cell) return null;
        const cx = (i % n) * cs + cs / 2;
        const cy = Math.floor(i / n) * cs + cs / 2;
        const isFading = fading.includes(i);
        return (
          <Group key={i}>
            {isFading && (
              <Circle cx={cx} cy={cy} r={cs * 0.42} color={withAlpha(colors.text, 0.35)} style="stroke" strokeWidth={1.2}>
                <DashPathEffect intervals={[2, 5]} />
              </Circle>
            )}
            {line.includes(i) && <Circle cx={cx} cy={cy} r={cs * 0.4} color={withAlpha(cell === 'X' ? colors.x : colors.o, 0.12)} />}
            <Mark kind={cell} cx={cx} cy={cy} s={cs} opacity={isFading ? pulse : 1} />
          </Group>
        );
      })}
    </Canvas>
  );
});
