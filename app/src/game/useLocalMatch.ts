import {
  botThinkMs,
  chooseBotAction,
  createMatch,
  DEFAULT_MATCH_CONFIG,
  matchMove,
  matchTimeout,
  resign as engineResign,
  startNextRound,
  turnClockMs,
} from '@fade/engine';
import type { BotLevel, MatchState, Player, TimeControl } from '@fade/engine';
import { useCallback, useEffect, useRef, useState } from 'react';

import { botTable } from './botTable';
import type { MatchController, MatchPhase } from './types';

const ROUND_PAUSE_MS = 2200;

export interface LocalMatchOptions {
  mode: 'bot' | 'pass';
  level: BotLevel;
  timeControl: TimeControl;
}

/** Offline match: vs the bot (human is X) or pass & play on one phone. */
export function useLocalMatch({ mode, level, timeControl }: LocalMatchOptions): MatchController {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [phase, setPhase] = useState<MatchPhase>('race');
  const [turnStartedAt, setTurnStartedAt] = useState(0);
  const matchRef = useRef<MatchState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const commit = useCallback((m: MatchState) => {
    matchRef.current = m;
    setMatch(m);
    setPhase(m.status === 'playing' ? 'playing' : m.status === 'roundOver' ? 'roundOver' : 'finished');
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const begin = useCallback(
    (starter: Player) => {
      commit(createMatch({ ...DEFAULT_MATCH_CONFIG, timeControl }, starter));
    },
    [commit, timeControl],
  );

  const ply = match?.round.ply;
  const roundNo = match?.roundNo;
  const status = match?.status;

  // Each turn: start the clock, schedule the timeout, and let the bot think.
  useEffect(() => {
    clearTimers();
    const m = matchRef.current;
    if (!m) return;
    if (m.status === 'roundOver') {
      timers.current.push(setTimeout(() => commit(startNextRound(matchRef.current!)), ROUND_PAUSE_MS));
      return;
    }
    if (m.status !== 'playing') return;
    const ms = turnClockMs(m);
    setTurnStartedAt(Date.now());
    timers.current.push(
      setTimeout(() => {
        const cur = matchRef.current;
        if (cur && cur.status === 'playing' && cur.round.ply === m.round.ply && cur.roundNo === m.roundNo) commit(matchTimeout(cur));
      }, ms),
    );
    if (mode === 'bot' && m.round.toMove === 'O') {
      const rand = Math.random;
      const action = chooseBotAction(m.round, level, botTable(), rand);
      if (action !== 'timeout') {
        timers.current.push(
          setTimeout(() => {
            const cur = matchRef.current;
            if (cur && cur.status === 'playing' && cur.round.ply === m.round.ply && cur.roundNo === m.roundNo) commit(matchMove(cur, action));
          }, botThinkMs(ms, rand)),
        );
      }
      // A deliberate timeout: the bot just lets the clock run out.
    }
  }, [ply, roundNo, status, mode, level, commit]);

  const play = useCallback(
    (cell: number) => {
      const m = matchRef.current;
      if (!m || m.status !== 'playing') return false;
      if (mode === 'bot' && m.round.toMove !== 'X') return false;
      try {
        commit(matchMove(m, cell));
        return true;
      } catch {
        return false;
      }
    },
    [commit, mode],
  );

  const resign = useCallback(() => {
    const m = matchRef.current;
    if (!m || m.status === 'finished' || m.status === 'aborted') return;
    clearTimers();
    // Vs the bot you resign as X; in pass & play the player to move resigns.
    commit(engineResign(m, mode === 'bot' ? 'X' : m.round.toMove));
  }, [commit, mode]);

  const rematch = useCallback(() => {
    clearTimers();
    matchRef.current = null;
    setMatch(null);
    setPhase('race');
  }, []);

  return {
    kind: mode,
    match,
    phase,
    me: mode === 'bot' ? 'X' : null,
    turnStartedAt,
    turnMs: match ? turnClockMs(match) : 0,
    botLevel: mode === 'bot' ? level : null,
    begin,
    play,
    resign,
    rematch,
  };
}
