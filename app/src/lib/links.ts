import { Linking, Share } from 'react-native';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

/** Permanent direct download link for the latest APK (public GitHub Release CDN). */
export const APK_URL = 'https://github.com/sarathbabu123/fade/releases/latest/download/fade.apk';

export function challengeMessage(code: string, from: string | null, timeControl: 'rapid' | 'blitz'): string {
  const clock = timeControl === 'blitz' ? 'Blitz, 3 s a move' : 'Rapid, 8 s a move';
  return [
    `⚡ ${from ?? 'A friend'} challenged you to FADE!`,
    `Tic-tac-toe where your oldest mark fades. ${clock}.`,
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
