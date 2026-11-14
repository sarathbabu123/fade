import { Linking, Share } from 'react-native';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

/** Permanent direct download link for the latest APK (public GitHub Release CDN). */
export const APK_URL = 'https://github.com/sarathbabu123/fade/releases/latest/download/fade.apk';

export function challengeMessage(code: string, from: string | null, timeControl: 'rapid' | 'blitz', game: 'fade' | 'sos' = 'fade'): string {
  const clock = timeControl === 'blitz' ? 'Blitz, 3 s a move' : 'Rapid, 8 s a move';
  const title = game === 'sos' ? 'SOS DUEL' : 'FADE';
  const subtitle = game === 'sos'
    ? `Tactical grid battle. Form S-O-S in any line to score and take extra turns. ${clock}.`
    : `Tic-tac-toe where your oldest mark fades. ${clock}.`;
  return [
    `⚡ ${from ?? 'A friend'} challenged you to ${title}!`,
    subtitle,
    ``,
    `Your code: *${code}*`,
    ``,
    `1. Get the app (Android): ${APK_URL}`,
    `2. Open FADE → Enter a code → ${code}`,
    ``,
    `The code works for 10 minutes.`,
  ].join('\n');
}

/** Open WhatsApp with the text prefilled; fall back to the system share sheet. */
export async function shareOnWhatsApp(text: string): Promise<void> {
  try {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  } catch {
    await Share.share({ message: text });
  }
}
