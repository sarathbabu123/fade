import type { TextStyle } from 'react-native';

import { colors } from './colors';

export { avatarColors, colors, withAlpha } from './colors';
export type { AvatarColor } from './colors';

/** Font family names as registered with expo-font in the root layout. */
export const fonts = {
  display: 'Unbounded_700Bold',
  displayHeavy: 'Unbounded_800ExtraBold',
  displayMedium: 'Unbounded_500Medium',
  ui: 'SpaceGrotesk_400Regular',
  uiMedium: 'SpaceGrotesk_500Medium',
  uiBold: 'SpaceGrotesk_700Bold',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radii = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;

/** Clocks and ratings: digits must not jiggle. */
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 44, letterSpacing: 2, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, color: colors.text },
  heading: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 0.4, color: colors.text },
  number: { fontFamily: fonts.display, fontSize: 28, color: colors.text, ...tabular },
  numberSmall: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text, ...tabular },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyDim: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: colors.textDim },
  label: { fontFamily: fonts.uiBold, fontSize: 16, letterSpacing: 0.3, color: colors.text },
  caption: { fontFamily: fonts.uiMedium, fontSize: 12, letterSpacing: 1.2, color: colors.textFaint },
} satisfies Record<string, TextStyle>;

/** Soft outer glows (RN boxShadow), never hard drop shadows. */
export function glow(color: string, radius = 18, strength = 0.55): string {
  'worklet';
  const a = Math.round(strength * 255)
    .toString(16)
    .padStart(2, '0');
  return `0 0 ${radius}px ${color.slice(0, 7)}${a}`;
}

export const motion = {
  press: { scale: 0.97 },
  spring: { damping: 28, stiffness: 220, mass: 1 },
  springSoft: { damping: 26, stiffness: 180 },
  /** Grid lines breathe 0.6 ↔ 0.8 over 4 s. */
  breatheMs: 4000,
  /** Next-to-fade pulse at ~1.2 Hz. */
  fadePulseMs: 420,
  screenSlide: 8,
} as const;
