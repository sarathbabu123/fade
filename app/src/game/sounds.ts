import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { useSettings } from '@/lib/settings';

/** Our own synthesised sounds (tools/sounds/generate.mjs). */
const SOURCES = {
  placeX: require('../../assets/sounds/place-x.wav'),
  placeO: require('../../assets/sounds/place-o.wav'),
  fade: require('../../assets/sounds/fade.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  timeout: require('../../assets/sounds/timeout.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
  matchLose: require('../../assets/sounds/match-lose.wav'),
  sudden: require('../../assets/sounds/sudden.wav'),
  go: require('../../assets/sounds/go.wav'),
  ready: require('../../assets/sounds/ready.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  error: require('../../assets/sounds/error.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Partial<Record<SoundName, number>> = { tick: 0.35, whoosh: 0.5, fade: 0.7, ready: 0.6 };

let players: Partial<Record<SoundName, AudioPlayer>> | null = null;

/** Create every player once, so the first play has no load delay. */
export function preloadSounds(): void {
  if (players) return;
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  players = {};
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name] ?? 1;
      players[name] = p;
    } catch {
      // A missing sound must never break the game.
    }
  }
}

export function playSound(name: SoundName): void {
  if (!useSettings.getState().sound) return;
  if (!players) preloadSounds();
  const p = players?.[name];
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    // ignore
  }
}
