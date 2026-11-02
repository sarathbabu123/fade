import { useEffect, useState } from 'react';

import { supabase, supabaseConfigured } from './supabase';
import { useSettings } from './settings';

export type AccountStatus = 'offline' | 'signing-in' | 'ready' | 'error';

let inflight: Promise<string | null> | null = null;

/** Make sure there is an anonymous session; returns the user id. */
export function ensureSignedIn(): Promise<string | null> {
  if (!supabaseConfigured) return Promise.resolve(null);
  inflight ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user.id;
    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return created.user?.id ?? null;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export type SaveProfileResult = { ok: true } | { ok: false; reason: 'taken' | 'offline' | 'error'; message: string };

/** Create or update this player's public profile (username + avatar). */
export async function saveProfile(): Promise<SaveProfileResult> {
  const { username, avatar } = useSettings.getState();
  if (!username) return { ok: false, reason: 'error', message: 'Pick a username first' };
  let uid: string | null;
  try {
    uid = await ensureSignedIn();
  } catch {
    return { ok: false, reason: 'offline', message: 'No connection' };
  }
  if (!uid) return { ok: false, reason: 'offline', message: 'Online play is not set up' };
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, username, avatar_glyph: avatar.glyph, avatar_color: avatar.color, last_seen_at: new Date().toISOString() });
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'taken', message: `“${username}” is taken. Try another name.` };
    return { ok: false, reason: 'error', message: error.message };
  }
  useSettings.getState().set({ userId: uid, profileSynced: true });
  return { ok: true };
}

/**
 * Keeps the account alive in the background: signs in, syncs the profile if it
 * changed while offline, and bumps last_seen_at (presence) every minute.
 */
export function useAccount(): AccountStatus {
  const [status, setStatus] = useState<AccountStatus>(supabaseConfigured ? 'signing-in' : 'offline');
  const onboarded = useSettings((s) => s.onboarded);
  const synced = useSettings((s) => s.profileSynced);

  useEffect(() => {
    if (!supabaseConfigured || !onboarded) return;
    let alive = true;
    const run = async () => {
      try {
        const uid = await ensureSignedIn();
        if (!alive) return;
        if (!useSettings.getState().profileSynced) {
          const r = await saveProfile();
          if (!r.ok) console.warn('[fade] profile sync:', r.reason, r.message);
          if (!r.ok && r.reason === 'taken') {
            // Picked offline and taken since: keep it unique with a short suffix.
            const base = (useSettings.getState().username ?? 'player').slice(0, 12);
            useSettings.getState().set({ username: `${base}_${Math.floor(Math.random() * 900 + 100)}` });
            await saveProfile();
          }
        } else if (uid) {
          await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid);
        }
        if (alive) setStatus('ready');
      } catch (e) {
        console.warn('[fade] account sync failed:', (e as Error)?.message ?? e);
        if (alive) setStatus('error');
      }
    };
    void run();
    const id = setInterval(run, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [onboarded, synced]);

  return status;
}
