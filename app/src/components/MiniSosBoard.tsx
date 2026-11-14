import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line as SvgLine } from 'react-native-svg';

import { useReduceMotion } from '@/lib/motion';
import { colors, fonts, glow, radii, withAlpha } from '@/theme';

interface Props {
  size?: number;
}

const N = 4;
const GAP = 4;

// Sample preview board:
// Row 1: [ .  S  O  S ] -> Horizontal SOS completed across (1, 2, 3)!
// Row 2: [ S  .  .  . ]
// Row 3: [ .  O  .  . ]
// Row 4: [ .  .  .  . ]
const PREVIEW_BOARD: (string | null)[] = [
  null, 'S', 'O', 'S',
  'S', null, null, null,
  null, 'O', null, null,
  null, null, null, null,
];

export const MiniSosBoard = memo(function MiniSosBoard({ size = 112 }: Props) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduce, pulse]);

  const cellSize = Math.floor((size - (N - 1) * GAP) / N);
  const actualSize = cellSize * N + (N - 1) * GAP;

  const laserStyle = useAnimatedStyle(() => {
    const opacity = reduce ? 0.9 : interpolate(pulse.value, [0, 1], [0.55, 1]);
    return { opacity };
  });

  // Center of cell 1 (Row 0, Col 1) to cell 3 (Row 0, Col 3)
  const y0 = cellSize / 2;
  const x1 = 1 * (cellSize + GAP) + cellSize / 2;
  const x3 = 3 * (cellSize + GAP) + cellSize / 2;

  return (
    <View style={[styles.wrap, { width: actualSize, height: actualSize }]}>
      <View style={[styles.grid, { width: actualSize, height: actualSize }]}>
        {PREVIEW_BOARD.map((ch, idx) => {
          const isPartOfSos = idx === 1 || idx === 2 || idx === 3;
          return (
            <View
              key={idx}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize },
                isPartOfSos && { borderColor: withAlpha(colors.coral, 0.6), backgroundColor: withAlpha(colors.coral, 0.08) },
              ]}>
              {ch ? (
                <Text
                  style={[
                    styles.text,
                    {
                      fontSize: cellSize * 0.52,
                      color: isPartOfSos ? colors.coral : colors.textDim,
                    },
                  ]}>
                  {ch}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Glowing Laser Strike */}
      <Animated.View style={[StyleSheet.absoluteFill, laserStyle]} pointerEvents="none">
        <Svg width={actualSize} height={actualSize}>
          <SvgLine
            x1={x1}
            y1={y0}
            x2={x3}
            y2={y0}
            stroke={colors.coral}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: withAlpha(colors.nightDeep, 0.9),
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    borderRadius: 6,
    backgroundColor: withAlpha(colors.hairline, 0.08),
    borderWidth: 0.5,
    borderColor: withAlpha(colors.hairline, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.displayHeavy,
  },
});
