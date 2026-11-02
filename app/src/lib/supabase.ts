import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/** Public values only (rule 7): the project URL and the publishable key. */
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const supabaseConfigured = url.length > 0 && key.length > 0;

export const supabase = createClient(url || 'https://invalid.supabase.co', key || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 20 } },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Server clock minus local clock, refreshed on every function call. */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;
export const toLocalTime = (serverMs: number) => serverMs - clockOffset;

export class GameServerError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Call the `fade` game function. Pinned to Frankfurt (next to the database): from
 * India this cut round trips from ~0.85–2.7 s to ~0.55 s (BUILD_PLAN).
 */
export async function callFade<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new GameServerError('Not signed in yet', 401);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/fade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${token}`,
        'x-region': 'eu-central-1',
      },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new GameServerError('No connection. Check your internet.', 0);
  }
  const t1 = Date.now();
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; serverNow?: number; error?: string } & T;
  if (typeof json.serverNow === 'number') {
    // Smooth the offset so one slow response doesn't jerk the clocks.
    const sample = json.serverNow - (t0 + t1) / 2;
    clockOffset = clockOffset === 0 ? sample : clockOffset * 0.7 + sample * 0.3;
  }
  if (!res.ok || !json.ok) throw new GameServerError(json.error ?? `Server error ${res.status}`, res.status);
  return json;
}
