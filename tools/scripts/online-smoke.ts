/**
 * End-to-end check against the real Supabase project with two anonymous players.
 * node --experimental-strip-types tools/scripts/online-smoke.ts
 * Needs SUPABASE_PROJECT_URL and SUPABASE_PUBLISHABLE_KEY in the environment (.env).
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { legalMoves } from '../../packages/engine/src/index.ts';
import type { MatchState, Player } from '../../packages/engine/src/index.ts';

const url = process.env.SUPABASE_PROJECT_URL!.replace(/[\\/]+$/, '');
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${what}`);
  if (!ok) failures++;
};

interface Player_ {
  name: string;
  sb: SupabaseClient;
  uid: string;
  offset: number;
}

async function player(name: string): Promise<Player_> {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`sign-in failed: ${error?.message}`);
  const uid = data.user.id;
  const username = `zz_${name}_${uid.slice(0, 6)}`;
  const { error: pe } = await sb.from('profiles').insert({ id: uid, username, avatar_glyph: 'bolt', avatar_color: 'cyan' });
  if (pe) throw new Error(`profile insert failed: ${pe.message}`);
  return { name, sb, uid, offset: 0 };
}

const rtts: number[] = [];
async function call(p: Player_, body: Record<string, unknown>) {
  const t0 = Date.now();
  const { data: session } = await p.sb.auth.getSession();
  const res = await fetch(`${url}/functions/v1/fade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${session.session!.access_token}`, 'x-region': 'eu-central-1' },
    body: JSON.stringify(body),
  });
  const t1 = Date.now();
  const json = (await res.json()) as Record<string, unknown> & { ok: boolean; serverNow: number; error?: string };
  rtts.push(t1 - t0);
  p.offset = json.serverNow - (t0 + t1) / 2;
  return { status: res.status, ...json };
}

const serverNow = (p: Player_) => Date.now() + p.offset;

async function main() {
  console.log('Signing in two anonymous players…');
  const a = await player('alice');
  const b = await player('bob');
  check(a.uid !== b.uid, 'two distinct anonymous accounts');

  console.log('RLS: clients cannot write server-owned tables');
  const ins = await a.sb.from('matches').insert({ player_x: a.uid, player_o: b.uid, time_control: 'rapid' });
  check(!!ins.error, 'insert into matches is rejected');
  const fr = await a.sb.from('friendships').insert({ user_a: a.uid < b.uid ? a.uid : b.uid, user_b: a.uid < b.uid ? b.uid : a.uid });
  check(!!fr.error, 'insert into friendships is rejected');
  const ch = await a.sb.from('challenges').insert({ code: 'ABCDEF', from_id: a.uid, time_control: 'rapid' });
  check(!!ch.error, 'insert into challenges is rejected');
  const mv = await a.sb.from('moves').insert({ match_id: '00000000-0000-0000-0000-000000000000', round_no: 1, ply: 1, player: 'X', kind: 'move', cell: 4 });
  check(!!mv.error, 'insert into moves is rejected');
  const other = await a.sb.from('profiles').update({ username: 'hacked_name' }).eq('id', b.uid).select();
  check(!other.error && (other.data?.length ?? 0) === 0, "can't edit someone else's profile");
  const own = await a.sb.from('profiles').update({ avatar_color: 'gold' }).eq('id', a.uid).select();
  check((own.data?.length ?? 0) === 1, 'can edit own profile');

  console.log('Challenge by code');
  const created = await call(a, { action: 'create-challenge', timeControl: 'blitz' });
  check(created.ok && /^[A-Z]{6}$/.test(String(created.code)), `create-challenge → ${created.code}`);
  const self = await call(a, { action: 'accept-challenge', code: created.code });
  check(!self.ok, `can't accept your own code (${self.error})`);
  const wrong = await call(b, { action: 'accept-challenge', code: 'ZZZZZZ' });
  check(!wrong.ok, `unknown code rejected (${wrong.error})`);

  // Bob subscribes to realtime before joining.
  let realtimeEvents = 0;
  const accepted = await call(b, { action: 'accept-challenge', code: String(created.code).toLowerCase() });
  check(accepted.ok && typeof accepted.matchId === 'string', 'friend joins with the code (case-insensitive)');
  const matchId = String(accepted.matchId);
  const again = await call(b, { action: 'accept-challenge', code: created.code });
  check(!again.ok, 'a code works only once');
  const channel = b.sb
    .channel(`m-${matchId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, () => realtimeEvents++)
    .subscribe();
  const friends = await a.sb.from('friendships').select('*');
  check((friends.data?.length ?? 0) >= 1, 'joining by code made them friends');
  const peek = await b.sb.from('matches').select('id').eq('id', matchId);
  check(peek.data?.length === 1, 'players can read their match');

  console.log('Start race');
  let m = (await call(a, { action: 'tick', matchId })).match as Record<string, any>;
  const goAt = Date.parse(m.race.goAt);
  await sleep(Math.max(0, goAt - serverNow(a)) + 50);
  await call(a, { action: 'race-tap', matchId, tap: { kind: 'tap', reactionMs: 240 } });
  m = (await call(b, { action: 'race-tap', matchId, tap: { kind: 'tap', reactionMs: 330 } })).match as Record<string, any>;
  check(m.status === 'active' && m.state?.firstStarter === 'X', 'faster tap (Alice, X) starts round 1');

  console.log('Playing a full blitz match (random legal moves, one deliberate timeout)…');
  const seat: Record<Player, Player_> = { X: a, O: b };
  let didTimeout = false;
  let rejected = 0;
  for (let i = 0; i < 400; i++) {
    m = (await call(a, { action: 'tick', matchId })).match as Record<string, any>;
    if (m.status !== 'active') break;
    const s = m.state as MatchState;
    if (s.status !== 'playing') {
      await sleep(Math.max(50, Date.parse(m.next_round_at) - serverNow(a) + 50));
      continue;
    }
    const start = Date.parse(m.turn_started_at);
    if (serverNow(a) < start) await sleep(start - serverNow(a) + 20);
    const p = seat[s.round.toMove];
    if (!didTimeout && s.roundNo === 1 && s.round.ply === 2) {
      // Let this turn's clock run out, then have the opponent claim it.
      didTimeout = true;
      await sleep(start + m.turn_ms + 1000 - serverNow(a));
      const t = (await call(seat[s.round.toMove === 'X' ? 'O' : 'X'], { action: 'tick', matchId })).match as Record<string, any>;
      const last = (t.state as MatchState).round.last;
      check(last?.kind === 'timeout' || (t.state as MatchState).round.ply > s.round.ply, 'missed turn is applied as a timeout by tick');
      continue;
    }
    const moves = legalMoves(s.round);
    const cell = moves[Math.floor(Math.random() * moves.length)]!;
    const r = await call(p, { action: 'move', matchId, roundNo: s.roundNo, ply: s.round.ply, cell });
    if (!r.ok) rejected++;
  }
  check(m.status === 'finished', `match finished (${m.winner ?? 'draw'} won, ${m.state?.score?.X}–${m.state?.score?.O}, reason ${m.ended_reason})`);
  check(rejected <= 2, `moves accepted (${rejected} rejected)`);

  const wrongTurn = await call(a, { action: 'move', matchId, roundNo: 1, ply: 0, cell: 4 });
  check(!wrongTurn.ok, `moves after the end are rejected (${wrongTurn.error})`);
  const { count } = await a.sb.from('moves').select('*', { count: 'exact', head: true }).eq('match_id', matchId);
  check((count ?? 0) > 0, `move log written (${count} plies)`);

  console.log('Ratings updated after match');
  const { data: ratA } = await a.sb.from('ratings').select('*').eq('user_id', a.uid).eq('time_control', 'blitz').single();
  const { data: ratB } = await b.sb.from('ratings').select('*').eq('user_id', b.uid).eq('time_control', 'blitz').single();
  check(!!ratA && ratA.games === 1, `Alice rated: ${ratA?.rating} (rd ${ratA?.rd})`);
  check(!!ratB && ratB.games === 1, `Bob rated: ${ratB?.rating} (rd ${ratB?.rd})`);
  const { data: histA } = await a.sb.from('rating_history').select('*').eq('user_id', a.uid);
  check((histA?.length ?? 0) === 1, 'rating history recorded for Alice');

  console.log('Rematch');
  const r1 = await call(a, { action: 'rematch', matchId });
  check(r1.ok && !r1.rematchId, 'one player asking does not start a rematch');
  const r2 = await call(b, { action: 'rematch', matchId });
  check(r2.ok && typeof r2.rematchId === 'string', 'both asking creates the rematch');
  const rm = (await call(b, { action: 'tick', matchId: r2.rematchId })).match as Record<string, any>;
  check(rm.player_x === b.uid, 'colours swap in the rematch');
  const res = await call(a, { action: 'resign', matchId: r2.rematchId });
  check(res.ok && (res.match as any).status === 'aborted', 'leaving during the start race aborts the rematch');

  await sleep(500);
  check(realtimeEvents > 5, `realtime delivered ${realtimeEvents} match updates to the opponent`);
  await b.sb.removeChannel(channel);

  const sorted = [...rtts].sort((x, y) => x - y);
  console.log(`Function round trip: median ${sorted[Math.floor(sorted.length / 2)]} ms, p90 ${sorted[Math.floor(sorted.length * 0.9)]} ms (${rtts.length} calls)`);
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
