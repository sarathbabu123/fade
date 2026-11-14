import { applySosMove, matchMove, START_RACE } from '@fade/engine';
import type { MatchState, Player, RaceTap, SosLetter, SosState } from '@fade/engine';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AvatarId } from '@/lib/settings';
import { useSettings } from '@/lib/settings';
import { callFade, GameServerError, serverNow, supabase, toLocalTime } from '@/lib/supabase';
import type { AvatarColor } from '@/theme';

import type { GlyphName } from '@/components/glyphs';

import { playSound } from './sounds';
import type { MatchController, MatchPhase } from './types';

/** Row of public.matches as the client sees it. */
export interface MatchRow {
  id: string;
  player_x: string;
  player_o: string;
  time_control: 'blitz' | 'rapid';
  status: 'race' | 'active' | 'finished' | 'aborted';
  race: { game?: 'fade' | 'sos'; goAt?: string; taps?: Partial<Record<Player, RaceTap>>; starter?: Player };
  state: MatchState | SosState | null;
  turn_started_at: string | null;
  turn_ms: number | null;
  next_round_at: string | null;
  winner: Player | null;
  ended_reason: string | null;
  rematch: Partial<Record<Player, boolean>>;
  rematch_id: string | null;
  version: number;
}

export interface OnlinePlayer {
  name: string;
  avatar: AvatarId;
}

export interface OnlineExtras {
  isSos: boolean;
  game: 'fade' | 'sos';
  sosState: SosState | null;
  playSos: (cell: number, letter: SosLetter) => boolean;
  /** Local-clock time of GO for the start race. */
  goAtLocal: number;
  raceTap: (tap: RaceTap) => void;
  /** Set once the server resolved the race. */
  raceStarter: Player | null;
  players: Record<Player, OnlinePlayer> | null;
  rematchRequested: boolean;
  opponentWantsRematch: boolean;
  /** Last error shown to the player (rejected move, connection). */
  error: string | null;
  aborted: boolean;
}

/** After the server's grace, either player can ask the server to apply a missed timeout. */
const TICK_SLACK_MS = 1100;

export function useOnlineMatch(matchId: string): MatchController & { online: OnlineExtras } {
  const settingsUserId = useSettings((s) => s.userId);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSessionUserId(data.session?.user.id ?? null));
  }, []);
  const userId = sessionUserId ?? settingsUserId;
  // Local time of my last optimistic move: the opponent's clock starts then, not at the old turn start.
  const [optimisticAt, setOptimisticAt] = useState(0);
  const [row, setRow] = useState<MatchRow | null>(null);
  const [optimistic, setOptimistic] = useState<MatchState | null>(null);
  const [players, setPlayers] = useState<Record<Player, OnlinePlayer> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const rowRef = useRef<MatchRow | null>(null);
  const lastUpdate = useRef(0);

  const accept = useCallback((next: MatchRow | null | undefined) => {
    if (!next) return;
    const cur = rowRef.current;
    if (cur && next.version < cur.version) return;
    rowRef.current = next;
    lastUpdate.current = Date.now();
    setRow(next);
    setOptimistic(null);
  }, []);

  // Initial load (also measures the server clock offset), realtime, and a polling fallback.
  useEffect(() => {
    let alive = true;
    void callFade<{ match: MatchRow }>('tick', { matchId })
      .then((r) => alive && accept(r.match))
      .catch(() => {
        // Initial sync tick failure is not fatal — realtime and polling will sync.
      });
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) =>
        accept(payload.new as MatchRow),
      )
      .subscribe();
    const poll = setInterval(async () => {
      if (Date.now() - lastUpdate.current < 2500) return;
      const { data } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (alive) accept(data as MatchRow | null);
    }, 1500);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [matchId, accept]);

  // Both players' public profiles.
  const px = row?.player_x;
  const po = row?.player_o;
  useEffect(() => {
    if (!px || !po) return;
    void supabase
      .from('profiles')
      .select('id, username, avatar_glyph, avatar_color')
      .in('id', [px, po])
      .then(({ data }) => {
        const get = (id: string): OnlinePlayer => {
          const p = data?.find((d) => d.id === id);
          return {
            name: p?.username ?? 'Player',
            avatar: { glyph: (p?.avatar_glyph ?? 'bolt') as GlyphName, color: (p?.avatar_color ?? 'violet') as AvatarColor },
          };
        };
        setPlayers({ X: get(px), O: get(po) });
      });
  }, [px, po]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(id);
  }, [error]);

  const me: Player | null = row && userId ? (row.player_x === userId ? 'X' : row.player_o === userId ? 'O' : null) : null;
  const state = optimistic ?? row?.state ?? null;

  // Ask the server to apply anything overdue: race window, opponent's timeout, next round.
  useEffect(() => {
    if (!row) return;
    let dueAt = 0;
    if (row.status === 'race' && row.race.goAt) dueAt = toLocalTime(Date.parse(row.race.goAt)) + START_RACE.windowMs + 300;
    else if (row.status === 'active' && row.state?.status === 'playing' && row.turn_started_at && row.turn_ms)
      dueAt = toLocalTime(Date.parse(row.turn_started_at)) + row.turn_ms + TICK_SLACK_MS;
    else if (row.status === 'active' && row.state?.status === 'roundOver' && row.next_round_at)
      dueAt = toLocalTime(Date.parse(row.next_round_at)) + 150;
    if (!dueAt) return;
    const id = setTimeout(
      () => {
        void callFade<{ match: MatchRow }>('tick', { matchId }).then((r) => accept(r.match)).catch(() => {});
      },
      Math.max(0, dueAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [row, matchId, accept]);

  // Rematch accepted by both: follow it.
  const rematchId = row?.rematch_id;
  useEffect(() => {
    if (rematchId) router.replace({ pathname: '/online/[id]', params: { id: rematchId } });
  }, [rematchId]);

  const isSos = row?.race?.game === 'sos';

  const playSos = useCallback(
    (cell: number, letter: SosLetter) => {
      const r = rowRef.current;
      const s = r?.state as SosState | null;
      if (!r || !s || r.status !== 'active' || s.status !== 'playing' || s.toMove !== me) return false;
      let next: SosState;
      try {
        next = applySosMove(s, cell, letter);
      } catch {
        return false;
      }
      if (r.turn_started_at && Date.now() < toLocalTime(Date.parse(r.turn_started_at)) - 200) return false;
      setOptimistic(next as any);
      setOptimisticAt(Date.now());
      void callFade<{ match: MatchRow }>('move', { matchId, cell, letter, ply: s.ply })
        .then((res) => accept(res.match))
        .catch((e: GameServerError) => {
          setOptimistic(null);
          if (e.status === 409) {
            setError('Too slow: move missed the clock');
          } else if (e.status === 0) {
            setError('Connection hiccup — syncing...');
          }
          playSound('error');
          void callFade<{ match: MatchRow }>('tick', { matchId }).then((res) => accept(res.match)).catch(() => {});
        });
      return true;
    },
    [matchId, me, accept],
  );

  const play = useCallback(
    (cell: number) => {
      const r = rowRef.current;
      const s = r?.state as MatchState | null;
      if (!r || !s || r.status !== 'active' || s.status !== 'playing' || s.round?.toMove !== me) return false;
      let next: MatchState;
      try {
        next = matchMove(s, cell);
      } catch {
        return false;
      }
      // During the server's start pause the turn hasn't begun yet: don't send a move it will reject.
      if (r.turn_started_at && Date.now() < toLocalTime(Date.parse(r.turn_started_at)) - 200) return false;
      // Show the mark immediately; the server confirms (or we roll back).
      setOptimistic(next);
      setOptimisticAt(Date.now());
      void callFade<{ match: MatchRow }>('move', { matchId, roundNo: s.roundNo, ply: s.round.ply, cell })
        .then((res) => accept(res.match))
        .catch((e: GameServerError) => {
          setOptimistic(null);
          if (e.status === 409) {
            setError('Too slow: move missed the clock');
          } else if (e.status === 0) {
            setError('Connection hiccup — syncing...');
          }
          playSound('error');
          void callFade<{ match: MatchRow }>('tick', { matchId }).then((res) => accept(res.match)).catch(() => {});
        });
      return true;
    },
    [matchId, me, accept],
  );

  const raceTap = useCallback(
    (tap: RaceTap) => {
      void callFade<{ match: MatchRow }>('race-tap', { matchId, tap })
        .then((r) => accept(r.match))
        .catch(() => {
          // Benign race conditions (race already decided / started) do not need an error banner
        });
    },
    [matchId, accept],
  );

  const resign = useCallback(() => {
    void callFade<{ match: MatchRow }>('resign', { matchId })
      .then((r) => accept(r.match))
      .catch(() => {});
  }, [matchId, accept]);

  const rematch = useCallback(() => {
    setRematchRequested(true);
    void callFade<{ match: MatchRow; rematchId: string | null }>('rematch', { matchId })
      .then((r) => accept(r.match))
      .catch(() => {
        setError('Could not request rematch. Try again.');
      });
  }, [matchId, accept]);

  let phase: MatchPhase = 'race';
  if (row?.status === 'finished' || row?.status === 'aborted') phase = 'finished';
  else if (row?.status === 'active' && state) {
    if (isSos) {
      const s = state as SosState;
      phase = s.status === 'playing' ? 'playing' : 'finished';
    } else {
      const s = state as MatchState;
      phase = s.status === 'playing' ? 'playing' : s.status === 'roundOver' ? 'roundOver' : 'finished';
    }
  }

  // The clock: turn start in local time. During the server's start pause it sits full.
  const turnStartedAt = optimistic ? optimisticAt : row?.turn_started_at ? toLocalTime(Date.parse(row.turn_started_at)) : 0;
  const opp: Player = me === 'O' ? 'X' : 'O';

  return {
    kind: 'online',
    match: row?.status === 'aborted' || isSos ? null : (state as MatchState),
    phase,
    me,
    turnStartedAt,
    turnMs: row?.turn_ms ?? 0,
    botLevel: null,
    begin: () => {},
    play,
    resign,
    rematch,
    online: {
      isSos,
      game: isSos ? 'sos' : 'fade',
      sosState: isSos ? (state as SosState) : null,
      playSos,
      goAtLocal: row?.race.goAt ? toLocalTime(Date.parse(row.race.goAt)) : Date.now() + 3000,
      raceTap,
      raceStarter: row?.status === 'race' ? null : (row?.race.starter ?? null),
      players,
      rematchRequested,
      opponentWantsRematch: !!row?.rematch?.[opp],
      error,
      aborted: row?.status === 'aborted',
    },
  };
}

export { serverNow };
