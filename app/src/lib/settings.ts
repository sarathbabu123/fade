import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AvatarColor } from '@/theme';
import type { GlyphName } from '@/components/glyphs';

export interface AvatarId {
  glyph: GlyphName;
  color: AvatarColor;
}

interface SettingsState {
  sound: boolean;
  haptics: boolean;
  /** App-level reduce motion; the OS setting is respected on top of this. */
  reduceMotion: boolean;
  /** Local profile until Supabase auth lands (Phase 3). */
  username: string | null;
  avatar: AvatarId;
  onboarded: boolean;
  timeControl: 'rapid' | 'blitz';
  rated: boolean;
  botLevel: 'easy' | 'medium' | 'hard' | 'impossible';
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      reduceMotion: false,
      username: null,
      avatar: { glyph: 'bolt', color: 'violet' },
      onboarded: false,
      timeControl: 'rapid',
      rated: true,
      botLevel: 'medium',
      set: (patch) => set(patch),
    }),
    {
      name: 'fade-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** Haptics that respect the user's toggle. Fire-and-forget. */
export const haptic = {
  selection() {
    if (useSettings.getState().haptics) void Haptics.selectionAsync();
  },
  light() {
    if (useSettings.getState().haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium() {
    if (useSettings.getState().haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  success() {
    if (useSettings.getState().haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};

/** True once persisted settings have loaded from storage. */
export function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSettings.persist.hasHydrated());
  useEffect(() => {
    if (useSettings.persist.hasHydrated()) setHydrated(true);
    return useSettings.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
