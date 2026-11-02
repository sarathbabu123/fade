// FADE game server: the only writer of matches, moves, challenges and friendships.
// All rules come from the shared engine (supabase/functions/_shared/engine, generated).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6';
import {
  createMatch,
  DEFAULT_MATCH_CONFIG,
  deserialize,
  MATCH_TIMING,
  matchMove,
  matchTimeout,
  resign,
  resolveStartRace,
  START_RACE,
  startNextRound,
  turnClockMs,
} from '../_shared/engine/index.ts';
import type { MatchState, Player, RaceTap, TimeControl } from '../_shared/engine/index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Verify user JWTs locally against the project's public keys (no auth-server hop per call).
const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** Countdown before GO, so both phones are on the race screen. */
const RACE_LEAD_MS = 3500;
/** Pause after the race result / between rounds before the clock starts. */
const START_PAUSE_MS = 1500;
const ROUND_PAUSE_MS = 2200;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they look like 1 and 0)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface MatchRow {
  id: string;
  player_x: string;
  player_o: string;
  time_control: TimeControl;
  rated: boolean;
  status: 'race' | 'active' | 'finished' | 'aborted';
  race: { goAt?: string; taps?: Partial<Record<Player, RaceTap>>; starter?: Player };
  state: MatchState | null;
  turn_started_at: string | null;
  turn_ms: number | null;
  next_round_at: string | null;
  winner: Player | null;
  ended_reason: string | null;
  rematch: Partial<Record<Player, boolean>>;
  rematch_id: string | null;
  version: number;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : 0);
const iso = (t: number) => new Date(t).toISOString();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function loadMatch(id: string): Promise<MatchRow> {
  const { data, error } = await admin.from('matches').select('*').eq('id', id).single();
  if (error || !data) throw new HttpError(404, 'match not found');
  return data as MatchRow;
}

function seatOf(m: MatchRow, uid: string): Player {
  if (m.player_x === uid) return 'X';
  if (m.player_o === uid) return 'O';
  throw new HttpError(403, 'not your match');
}

/** Write with an optimistic version check. Returns null if someone else wrote first. */
async function save(m: MatchRow, patch: Partial<MatchRow>): Promise<MatchRow | null> {
  const { data, error } = await admin
    .from('matches')
    .update({ ...patch, version: m.version + 1, updated_at: iso(Date.now()) })
    .eq('id', m.id)
    .eq('version', m.version)
    .select('*');
  if (error) throw new HttpError(500, error.message);
  return (data?.[0] as MatchRow) ?? null;
}

/** Apply an engine state to the row: clocks, round pause and match end. */
function withState(state: MatchState, turnStart: number): Partial<MatchRow> {
  const patch: Partial<MatchRow> = { state };
  if (state.status === 'playing') {
    patch.turn_started_at = iso(turnStart);
    patch.turn_ms = turnClockMs(state);
    patch.next_round_at = null;
  } else if (state.status === 'roundOver') {
    patch.next_round_at = iso(turnStart + ROUND_PAUSE_MS);
    patch.turn_started_at = null;
  } else {
    patch.status = state.status === 'aborted' ? 'aborted' : 'finished';
    patch.winner = state.winner;
    patch.ended_reason = state.reason;
    patch.turn_started_at = null;
    patch.next_round_at = null;
  }
  return patch;
}

async function logPly(matchId: string, before: MatchState, after: MatchState) {
  const last = after.round.last;
  if (!last) return;
  await admin.from('moves').insert({
    match_id: matchId,
    round_no: before.roundNo,
    ply: after.round.ply,
    player: last.player,
    kind: last.kind,
    cell: last.cell,
  });
}

/**
 * Advance everything that is due by `now`: resolve the start race, apply missed
 * timeouts (each turn starts when the previous one ended), start the next round.
 */
function catchUp(m: MatchRow, now: number): { patch: Partial<MatchRow>; plies: [MatchState, MatchState][] } | null {
  let patch: Partial<MatchRow> = {};
  const plies: [MatchState, MatchState][] = [];
  let changed = false;

  if (m.status === 'race') {
    const goAt = ms(m.race.goAt ?? null);
    const taps = m.race.taps ?? {};
    const bothIn = taps.X && taps.O;
    if (!bothIn && now < goAt + START_RACE.windowMs) return null;
    const starter = resolveStartRace(taps.X ?? { kind: 'none' }, taps.O ?? { kind: 'none' }, Math.random() < 0.5 ? 'X' : 'O');
    const state = createMatch({ ...DEFAULT_MATCH_CONFIG, timeControl: m.time_control }, starter);
    patch = { status: 'active', race: { ...m.race, starter }, ...withState(state, now + START_PAUSE_MS) };
    return { patch, plies };
  }
  if (m.status !== 'active' || !m.state) return null;

  let state = m.state;
  let turnStart = ms(m.turn_started_at);
  let turnMs = m.turn_ms ?? 0;
  let nextRound = ms(m.next_round_at);
  for (let guard = 0; guard < 200; guard++) {
    if (state.status === 'playing' && now > turnStart + turnMs + MATCH_TIMING.moveGraceMs) {
      const next = matchTimeout(state);
      plies.push([state, next]);
      const deadline = turnStart + turnMs;
      state = next;
      changed = true;
      if (state.status === 'playing') {
        turnStart = deadline;
        turnMs = turnClockMs(state);
      } else if (state.status === 'roundOver') {
        nextRound = deadline + ROUND_PAUSE_MS;
      }
      continue;
    }
    if (state.status === 'roundOver' && now >= nextRound) {
      state = startNextRound(state);
      changed = true;
      turnStart = nextRound;
      turnMs = turnClockMs(state);
      continue;
    }
    break;
  }
  if (!changed) return null;
  patch = withState(state, state.status === 'playing' ? turnStart : nextRound - ROUND_PAUSE_MS);
  if (state.status === 'roundOver') patch.next_round_at = iso(nextRound);
  return { patch, plies };
}

/** Run `fn` against the latest row, retrying on version conflicts. */
async function mutate(id: string, fn: (m: MatchRow, now: number) => Promise<Partial<MatchRow> | null> | Partial<MatchRow> | null) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let m = await loadMatch(id);
    const now = Date.now();
    // Always settle anything overdue first so actions see the true current state.
    const due = catchUp(m, now);
    if (due) {
      const saved = await save(m, due.patch);
      if (!saved) continue;
      for (const [a, b] of due.plies) await logPly(m.id, a, b);
      m = saved;
    }
    const patch = await fn(m, now);
    if (!patch) return m;
    const saved = await save(m, patch);
    if (saved) return saved;
  }
  throw new HttpError(409, 'busy, try again');
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

async function newMatch(x: string, o: string, tc: TimeControl): Promise<MatchRow> {
  const { data, error } = await admin
    .from('matches')
    .insert({ player_x: x, player_o: o, time_control: tc, race: { goAt: iso(Date.now() + RACE_LEAD_MS), taps: {} } })
    .select('*')
    .single();
  if (error) throw new HttpError(500, error.message);
  return data as MatchRow;
}

type Body = Record<string, unknown> & { action?: string };

async function handle(uid: string, body: Body) {
  switch (body.action) {
    case 'ping':
      return {};

    case 'create-challenge': {
      const tc: TimeControl = body.timeControl === 'blitz' ? 'blitz' : 'rapid';
      const toId = typeof body.toId === 'string' ? body.toId : null;
      // Cancel this user's older open challenges so only one code is live.
      await admin.from('challenges').update({ status: 'cancelled' }).eq('from_id', uid).eq('status', 'open');
      for (let i = 0; i < 5; i++) {
        const code = randomCode();
        const { error } = await admin.from('challenges').insert({ code, from_id: uid, to_id: toId, time_control: tc });
        if (!error) return { code, expiresInMs: 10 * 60 * 1000 };
      }
      throw new HttpError(500, 'could not create a code');
    }

    case 'cancel-challenge': {
      await admin.from('challenges').update({ status: 'cancelled' }).eq('code', String(body.code ?? '')).eq('from_id', uid).eq('status', 'open');
      return {};
    }

    case 'accept-challenge': {
      const code = String(body.code ?? '').toUpperCase().replace(/[^A-Z]/g, '');
      const { data: ch } = await admin.from('challenges').select('*').eq('code', code).maybeSingle();
      if (!ch) throw new HttpError(404, 'No challenge with that code');
      if (ch.from_id === uid) throw new HttpError(400, "That's your own code. Send it to a friend!");
      if (ch.status !== 'open') throw new HttpError(410, 'That code has already been used');
      if (Date.parse(ch.expires_at) < Date.now()) throw new HttpError(410, 'That code has expired');
      if (ch.to_id && ch.to_id !== uid) throw new HttpError(403, 'That challenge is for someone else');
      const match = await newMatch(ch.from_id, uid, ch.time_control);
      const { data: claimed } = await admin
        .from('challenges')
        .update({ status: 'accepted', match_id: match.id })
        .eq('code', code)
        .eq('status', 'open')
        .select('code');
      if (!claimed?.length) {
        await admin.from('matches').delete().eq('id', match.id);
        throw new HttpError(410, 'That code has already been used');
      }
      const [a, b] = [ch.from_id, uid].sort();
      await admin.from('friendships').upsert({ user_a: a, user_b: b }, { onConflict: 'user_a,user_b', ignoreDuplicates: true });
      return { matchId: match.id };
    }

    case 'race-tap': {
      const id = String(body.matchId);
      const tap = body.tap as RaceTap;
      return {
        match: await mutate(id, (m, now) => {
          const me = seatOf(m, uid);
          if (m.status !== 'race' || m.race.taps?.[me]) return null;
          let t: RaceTap = { kind: 'none' };
          if (tap?.kind === 'falseStart') t = { kind: 'falseStart' };
          else if (tap?.kind === 'tap' && Number.isFinite(tap.reactionMs)) {
            // Phone-measured reaction (BUILD_PLAN decision). Sanity check: GO must have
            // happened, and the reaction can't be earlier than GO by the server clock.
            const goAt = ms(m.race.goAt ?? null);
            const sinceGo = now - goAt;
            t = sinceGo < -MATCH_TIMING.moveGraceMs ? { kind: 'falseStart' } : { kind: 'tap', reactionMs: Math.max(0, Math.min(tap.reactionMs, START_RACE.windowMs)) };
          }
          const taps = { ...(m.race.taps ?? {}), [me]: t };
          const race = { ...m.race, taps };
          if (taps.X && taps.O) {
            const starter = resolveStartRace(taps.X, taps.O, Math.random() < 0.5 ? 'X' : 'O');
            const state = createMatch({ ...DEFAULT_MATCH_CONFIG, timeControl: m.time_control }, starter);
            return { status: 'active', race: { ...race, starter }, ...withState(state, now + START_PAUSE_MS) };
          }
          return { race };
        }),
      };
    }

    case 'move': {
      const id = String(body.matchId);
      const cell = Number(body.cell);
      const log: { plies?: [MatchState, MatchState] } = {};
      const match = await mutate(id, (m, now) => {
        const me = seatOf(m, uid);
        if (m.status !== 'active' || !m.state) throw new HttpError(409, 'match is not active');
        const s = deserialize(JSON.stringify(m.state));
        if (s.status !== 'playing') throw new HttpError(409, 'round is not in play');
        if (s.round.toMove !== me) throw new HttpError(409, 'not your turn');
        if (body.roundNo !== s.roundNo || body.ply !== s.round.ply) throw new HttpError(409, 'out of sync');
        if (now < ms(m.turn_started_at) - MATCH_TIMING.moveGraceMs) throw new HttpError(409, 'turn has not started');
        let next: MatchState;
        try {
          next = matchMove(s, cell);
        } catch (e) {
          throw new HttpError(400, (e as Error).message);
        }
        log.plies = [s, next];
        return withState(next, now);
      });
      if (log.plies) await logPly(id, log.plies[0], log.plies[1]);
      return { match };
    }

    case 'tick': {
      const id = String(body.matchId);
      return { match: await mutate(id, (m) => (seatOf(m, uid), null)) };
    }

    case 'resign': {
      const id = String(body.matchId);
      return {
        match: await mutate(id, (m) => {
          const me = seatOf(m, uid);
          if (m.status === 'finished' || m.status === 'aborted') return null;
          if (m.status === 'race' || !m.state) {
            return { status: 'aborted', ended_reason: 'aborted' };
          }
          return withState(resign(m.state, me), Date.now());
        }),
      };
    }

    case 'rematch': {
      const id = String(body.matchId);
      const made: { row?: MatchRow } = {};
      const match = await mutate(id, async (m) => {
        const me = seatOf(m, uid);
        if (m.status !== 'finished' && m.status !== 'aborted') throw new HttpError(409, 'match still running');
        if (m.rematch_id) return null;
        const rematch = { ...m.rematch, [me]: true };
        if (rematch.X && rematch.O) {
          // Swap colours for the rematch.
          made.row = await newMatch(m.player_o, m.player_x, m.time_control);
          return { rematch, rematch_id: made.row.id };
        }
        return { rematch };
      });
      return { match, rematchId: match.rematch_id ?? made.row?.id ?? null };
    }

    default:
      throw new HttpError(400, 'unknown action');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const serverNow = Date.now();
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'sign in first');
    let uid: string;
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: `${SUPABASE_URL}/auth/v1`, audience: 'authenticated' });
      uid = String(payload.sub);
    } catch {
      throw new HttpError(401, 'sign in first');
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const result = await handle(uid, body);
    return json({ ok: true, serverNow, ...result });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ ok: false, serverNow, error: (e as Error).message }, status);
  }
});
