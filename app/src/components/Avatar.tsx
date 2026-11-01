import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { AvatarId } from '@/lib/settings';
import { avatarColors, colors, withAlpha } from '@/theme';

import { glyphs } from './glyphs';
import type { GlyphName } from './glyphs';

const pathCache = new Map<GlyphName, SkPath>();
function glyphPath(name: GlyphName): SkPath {
  let p = pathCache.get(name);
  if (!p) {
    p = Skia.Path.MakeFromSVGString(glyphs[name])!;
    pathCache.set(name, p);
  }
  return p;
}

interface Props {
  avatar: AvatarId;
  size?: number;
  /**
   * Clock ring slot: fraction of the ring shown (1 = full, 0 = empty). Animate it
   * with a shared value so the ring depletes on the UI thread.
   */
  ring?: SharedValue<number> | number;
  ringColor?: SharedValue<string> | string;
  /** Dim the avatar (e.g. opponent waiting). */
  dimmed?: boolean;
}

/** Glyph avatar in a neon disc, with an optional clock ring (PRD §6 Match screen). */
export const Avatar = memo(function Avatar({ avatar, size = 56, ring, ringColor, dimmed }: Props) {
  const color = avatarColors[avatar.color];
  const pad = ring !== undefined ? 6 : 2;
  const box = size + pad * 2;
  const c = box / 2;
  const r = size / 2;
  const scale = (size * 0.56) / 24;
  const offset = c - 12 * scale;

  const ringPath = useMemo(() => {
    return Skia.PathBuilder.Make().addCircle(c, c, r + 3.5).detach();
  }, [c, r]);

  return (
    <Canvas style={{ width: box, height: box, opacity: dimmed ? 0.5 : 1 }}>
      <Circle cx={c} cy={c} r={r} color={withAlpha(color, 0.13)} />
      <Circle cx={c} cy={c} r={r - 0.75} color={withAlpha(color, 0.45)} style="stroke" strokeWidth={1.5} />
      <Group transform={[{ translateX: offset }, { translateY: offset }, { scale }]}>
        <Path
          path={glyphPath(avatar.glyph)}
          color={withAlpha(color, 0.7)}
          style="stroke"
          strokeWidth={2.4}
          strokeJoin="round"
          strokeCap="round">
          <BlurMask blur={2.5} style="solid" />
        </Path>
        <Path
          path={glyphPath(avatar.glyph)}
          color={colors.text}
          style="stroke"
          strokeWidth={1.3}
          strokeJoin="round"
          strokeCap="round"
        />
      </Group>
      {ring !== undefined && (
        <Group origin={{ x: c, y: c }} transform={[{ rotate: -Math.PI / 2 }]}>
          <Path path={ringPath} color={colors.hairline} style="stroke" strokeWidth={3} />
          <Path path={ringPath} color={ringColor ?? color} style="stroke" strokeWidth={3} strokeCap="round" start={0} end={ring}>
            <BlurMask blur={3} style="solid" />
          </Path>
        </Group>
      )}
    </Canvas>
  );
});
