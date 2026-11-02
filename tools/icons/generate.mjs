/**
 * FADE's own icon art (SVG) → PNGs for the app icon, adaptive icon and splash.
 * node tools/icons/generate.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/assets/images');
mkdirSync(out, { recursive: true });

const NIGHT = '#0B0D17';
const X = '#FF5A5F';
const O = '#3DE0FF';
const GRID = '#C4D2FF';

/** The mark artwork on a 1024 canvas; `scale` shrinks it into the adaptive-icon safe zone. */
function art(scale = 1) {
  const s = scale;
  const c = 512;
  const t = (v) => c + (v - c) * s;
  const cell = 210 * s;
  const g0 = t(512 - 105);
  const g1 = t(512 + 105);
  const lo = t(512 - 315 + 20);
  const hi = t(512 + 315 - 20);
  const cx = (col) => t(512 + (col - 1) * 210);
  const w = 34 * s;
  const x = (col, row, opacity = 1) => {
    const a = cx(col), b = cx(row), r = 62 * s;
    return `<g opacity="${opacity}" stroke="${X}" stroke-linecap="round" fill="none">
      <path d="M${a - r} ${b - r} L${a + r} ${b + r} M${a + r} ${b - r} L${a - r} ${b + r}" stroke-width="${w * 2.6}" stroke-opacity="0.16"/>
      <path d="M${a - r} ${b - r} L${a + r} ${b + r} M${a + r} ${b - r} L${a - r} ${b + r}" stroke-width="${w * 1.6}" stroke-opacity="0.32"/>
      <path d="M${a - r} ${b - r} L${a + r} ${b + r} M${a + r} ${b - r} L${a - r} ${b + r}" stroke-width="${w}"/>
    </g>`;
  };
  const o = (col, row) => {
    const a = cx(col), b = cx(row), r = 70 * s, w = 24 * s;
    return `<g stroke="${O}" fill="none">
      <circle cx="${a}" cy="${b}" r="${r}" stroke-width="${w * 2.6}" stroke-opacity="0.16"/>
      <circle cx="${a}" cy="${b}" r="${r}" stroke-width="${w * 1.6}" stroke-opacity="0.32"/>
      <circle cx="${a}" cy="${b}" r="${r}" stroke-width="${w}"/>
    </g>`;
  };
  // Dotted "next to fade" ring and a few rising particles on the fading X.
  const fa = cx(0), fb = cx(0);
  const particles = [
    [fa - 70, fb - 120, 9], [fa + 30, fb - 150, 7], [fa + 90, fb - 105, 6], [fa - 20, fb - 185, 5],
  ]
    .map(([px, py, r]) => `<circle cx="${px}" cy="${py}" r="${r * s}" fill="${X}" fill-opacity="0.55"/>`)
    .join('');
  return `
    <g stroke="${GRID}" stroke-linecap="round" stroke-opacity="0.75" stroke-width="${12 * s}">
      <path d="M${g0} ${lo} V${hi} M${g1} ${lo} V${hi} M${lo} ${g0} H${hi} M${lo} ${g1} H${hi}"/>
    </g>
    <circle cx="${fa}" cy="${fb}" r="${92 * s}" fill="none" stroke="#F4F6FF" stroke-opacity="0.45" stroke-width="${6 * s}" stroke-dasharray="${10 * s} ${16 * s}"/>
    ${x(0, 0, 0.38)}
    ${particles}
    ${x(1, 1)}
    ${o(2, 0)}
    ${o(0, 2)}
    ${x(2, 2)}`;
}

const background = `
  <defs>
    <radialGradient id="a" cx="22%" cy="18%" r="70%"><stop offset="0" stop-color="#3A1C8C" stop-opacity="0.9"/><stop offset="1" stop-color="#3A1C8C" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="85%" cy="88%" r="65%"><stop offset="0" stop-color="#0D5C8C" stop-opacity="0.85"/><stop offset="1" stop-color="#0D5C8C" stop-opacity="0"/></radialGradient>
    <radialGradient id="c" cx="80%" cy="10%" r="45%"><stop offset="0" stop-color="#7A1F63" stop-opacity="0.6"/><stop offset="1" stop-color="#7A1F63" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="${NIGHT}"/>
  <rect width="1024" height="1024" fill="url(#a)"/>
  <rect width="1024" height="1024" fill="url(#b)"/>
  <rect width="1024" height="1024" fill="url(#c)"/>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

function png(name, markup, size = 1024) {
  const r = new Resvg(markup, { fitTo: { mode: 'width', value: size } });
  writeFileSync(join(out, name), r.render().asPng());
  console.log('wrote', name);
}

// Full icon (legacy launchers, store-style): background + art.
png('icon.png', svg(background + art(0.82)));
// Adaptive icon: art only inside the 66% safe zone, background supplied separately.
png('adaptive-foreground.png', svg(art(0.56)));
png('adaptive-background.png', svg(background));
// Monochrome (Android 13 themed icons): white art.
png('adaptive-monochrome.png', svg(art(0.56).replaceAll(X, '#FFFFFF').replaceAll(O, '#FFFFFF').replaceAll(GRID, '#FFFFFF')));
// Splash mark (shown centred on the night background).
png('splash.png', svg(art(0.9)), 600);
