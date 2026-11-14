import type { SosCell, SosLetter, SosLine, SosPlayer, SosState } from '@fade/engine';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Line as SvgLine } from 'react-native-svg';

import { colors, fonts, glow, radii, spacing, withAlpha } from '@/theme';

interface Props {
  state: SosState;
  onCellPress: (cellIndex: number) => void;
  disabled?: boolean;
}

const GAP = 8;

export const SosBoard = memo(function SosBoard({ state, onCellPress, disabled }: Props) {
  const { width } = useWindowDimensions();
  const N = state.config.size;
  const boardSize = Math.min(width - spacing.xl * 2, 380);
  const cellSize = Math.floor((boardSize - (N - 1) * GAP) / N);
  const actualBoardSize = cellSize * N + (N - 1) * GAP;

  const cellCenter = (index: number) => {
    const r = Math.floor(index / N);
    const c = index % N;
    return {
      x: c * (cellSize + GAP) + cellSize / 2,
      y: r * (cellSize + GAP) + cellSize / 2,
    };
  };

  return (
    <View style={[styles.boardWrap, { width: actualBoardSize, height: actualBoardSize }]}>
      {/* 1. Grid Cells */}
      <View style={[styles.grid, { width: actualBoardSize, height: actualBoardSize }]}>
        {state.board.map((cell, idx) => {
          const isOccupied = cell !== null;
          const playerColor = cell?.player === 'X' ? colors.coral : colors.cyan;

          return (
            <Pressable
              key={idx}
              disabled={disabled || isOccupied || state.status !== 'playing'}
              onPress={() => onCellPress(idx)}
              style={({ pressed }) => [
                styles.cell,
                { width: cellSize, height: cellSize },
                isOccupied && styles.cellOccupied,
                isOccupied && { borderColor: withAlpha(playerColor, 0.45) },
                pressed && !isOccupied && styles.cellPressed,
              ]}
              accessibilityLabel={`Cell ${idx + 1}, ${isOccupied ? cell.letter : 'empty'}`}>
              {isOccupied && (
                <Text
                  style={[
                    styles.letterText,
                    {
                      fontSize: cellSize * 0.52,
                      color: playerColor,
                      textShadowColor: playerColor,
                    },
                  ]}>
                  {cell.letter}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 2. Laser Strike Lines Overlay */}
      {state.lines.length > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {state.lines.map((l) => {
            const p1 = cellCenter(l.cells[0]);
            const p2 = cellCenter(l.cells[2]);
            const strokeColor = l.player === 'X' ? colors.coral : colors.cyan;

            return (
              <SvgLine
                key={l.id}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={strokeColor}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.92}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  boardWrap: {
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    borderRadius: radii.sm,
    backgroundColor: withAlpha(colors.nightDeep, 0.7),
    borderWidth: 1,
    borderColor: withAlpha(colors.hairline, 0.7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOccupied: {
    backgroundColor: withAlpha(colors.nightDeep, 0.95),
  },
  cellPressed: {
    backgroundColor: withAlpha(colors.hairline, 0.2),
    borderColor: colors.gold,
  },
  letterText: {
    fontFamily: fonts.displayHeavy,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

