/**
 * FADE's own avatar glyphs: neon line art on a 24×24 grid, drawn as strokes.
 * Path strings work in both Skia (Path.MakeFromSVGString) and react-native-svg.
 */
export const glyphs = {
  bolt: 'M13.5 2.5 L5.5 13.5 H11.5 L10.5 21.5 L18.5 10.5 H12.5 Z',
  crown: 'M3.5 18 L5 7.5 L9.5 12 L12 5 L14.5 12 L19 7.5 L20.5 18 Z M5 21 H19',
  moon: 'M19.5 14.6 A8 8 0 1 1 9.4 4.5 A6.4 6.4 0 0 0 19.5 14.6 Z',
  star: 'M12 3 L14.5 9.2 L21 9.6 L16 13.8 L17.6 20.4 L12 16.8 L6.4 20.4 L8 13.8 L3 9.6 L9.5 9.2 Z',
  eye: 'M2.5 12 C5.5 7 8.6 5 12 5 C15.4 5 18.5 7 21.5 12 C18.5 17 15.4 19 12 19 C8.6 19 5.5 17 2.5 12 Z M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 Z',
  flame:
    'M12 2.5 C13 6.5 17.5 8.5 17.5 14 A5.5 5.5 0 0 1 6.5 14 C6.5 11 8.5 9.5 9 7 C10.5 8.5 11 10 11 11.5 C12.8 10 13 6.5 12 2.5 Z',
  wave: 'M2.5 9 C5 5.5 8 5.5 10.5 9 C13 12.5 16 12.5 18.5 9 L21.5 7 M2.5 16 C5 12.5 8 12.5 10.5 16 C13 19.5 16 19.5 18.5 16 L21.5 14',
  diamond: 'M7.5 3.5 H16.5 L21 9 L12 21 L3 9 Z M3 9 H21 M9.5 9 L12 21 L14.5 9 M7.5 3.5 L9.5 9 M16.5 3.5 L14.5 9',
  comet: 'M19.5 15 A4.5 4.5 0 1 1 10.5 15 A4.5 4.5 0 1 1 19.5 15 Z M11.8 11.8 L3.5 3.5 M10.7 15.6 L2.5 11.5 M15.6 10.7 L11.5 2.5',
  ghost: 'M5 21 V10.5 A7 7 0 0 1 19 10.5 V21 L16.7 19.2 L14.3 21 L12 19.2 L9.7 21 L7.3 19.2 Z M9.5 10 V12 M14.5 10 V12',
  planet: 'M17 12 A5 5 0 1 1 7 12 A5 5 0 1 1 17 12 Z M4.5 15.5 C1.5 18.8 8 17.8 13.5 14.8 C19 11.8 23.2 6.6 19.6 7.4',
  spiral: 'M12 12 C12 11 13.5 11 13.5 12.2 C13.5 14 10.5 14 10.5 11.8 C10.5 8.8 15.5 8.8 15.5 12.4 C15.5 16.6 8.5 16.6 8.5 11.6 C8.5 6 17.5 6 17.5 12.6 C17.5 19.2 6.5 19.2 6.5 11.4',
} as const;

export type GlyphName = keyof typeof glyphs;

export const glyphNames = Object.keys(glyphs) as GlyphName[];
