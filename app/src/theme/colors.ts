/** Neon Ink palette (PRD §7.1). Dark theme only in v1. */
export const colors = {
  night: '#0B0D17',
  nightDeep: '#06070E',

  x: '#FF5A5F',
  o: '#3DE0FF',
  /** Second stops for X / O gradients. */
  xHot: '#FF8A4C',
  oHot: '#5B8CFF',
  gold: '#FFC94A',
  ratingDown: '#B33A3A',
  amber: '#FFB547',
  alarm: '#FF3B47',

  text: '#F4F6FF',
  textDim: 'rgba(244, 246, 255, 0.64)',
  textFaint: 'rgba(244, 246, 255, 0.38)',
  onAccent: '#140A0C',

  glass: 'rgba(255, 255, 255, 0.055)',
  glassStrong: 'rgba(255, 255, 255, 0.10)',
  glassPressed: 'rgba(255, 255, 255, 0.14)',
  hairline: 'rgba(255, 255, 255, 0.12)',
  hairlineBright: 'rgba(255, 255, 255, 0.24)',
  highlight: 'rgba(255, 255, 255, 0.07)',
  scrim: 'rgba(3, 4, 10, 0.72)',
  transparent: 'transparent',

  /** Aurora blobs behind every screen. */
  aurora: ['#3A1C8C', '#0D5C8C', '#7A1F63', '#14496B'] as const,
  grid: 'rgba(196, 210, 255, 0.7)',
} as const;

/** Avatar palette: 8 neon colours. */
export const avatarColors = {
  coral: '#FF5A5F',
  cyan: '#3DE0FF',
  gold: '#FFC94A',
  violet: '#A78BFA',
  lime: '#A3FF6A',
  pink: '#FF6AD5',
  orange: '#FF9F43',
  mint: '#5CFFC8',
} as const;

export type AvatarColor = keyof typeof avatarColors;

/** Hex colour + alpha (0–1) as an 8-digit hex string. */
export function withAlpha(hex: string, alpha: number): string {
  'worklet';
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
