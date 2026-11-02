/**
 * A scripted online opponent for manual testing of the real app.
 * node --experimental-strip-types tools/scripts/friend-bot.ts <CODE> [--think=1200]
 * Joins the challenge, taps in the start race, then plays random legal moves on its turns.
 */
import { createClient } from '@supabase/supabase-js';
import { legalMoves } from '../../packages/engine/src/index.ts';
import type { MatchState } from '../../packages/engine/src/index.ts';

const code = process.argv[2];
const think = Number(process.argv.find((a) => a.startsWith('--think='))?.split('=')[1] ?? 1200);
if (!code) throw new Error('usage: friend-bot.ts <CODE>');
const url = process.env.SUPABASE_PROJECT_URL!.replace(/[\\/]+$/, '');
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: auth } = await sb.auth.signInAnonymously();
const uid = auth.user!.id;
await sb.from('profiles').insert({ id: uid, username: `test_friend_${uid.slice(0, 4)}`, avatar_glyph: 'comet', avatar_color: 'mint' });
let offset = 0;

async function call(action: string, body: Record<string, unknown> = {}) {
  const { data } = await sb.auth.getSession();
  const t0 = Date.now();
  const res = await fetch(`${url}/functions/v1/fade`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${data.session!.access_token}`, 'Content-Type': 'application/json', 'x-region': 'eu-central-1' },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await res.json()) as any;
  offset = json.serverNow - (t0 + Date.now()) / 2;
  if (!json.ok) console.log(`  ${action} → ${json.error}`);
  return json;
}
const now = () => Date.now() + offset;

const joined = await call('accept-challenge', { code });
if (!joined.ok) process.exit(1);
const matchId = joined.matchId as string;
console.log(`joined match ${matchId} as O`);

let m = (await call('tick', { matchId })).match;
await sleep(Math.max(0, Date.parse(m.race.goAt) - now()) + 350);
m = (await call('race-tap', { matchId, tap: { kind: 'tap', reactionMs: 330 } })).match;
console.log('race tap sent (330 ms)');

let lastLog = '';
for (;;) {
  await sleep(500);
  m = (await call('tick', { matchId })).match;
  if (m.status === 'finished' || m.status === 'aborted') break;
  const s = m.state as MatchState | null;
  if (!s) continue;
  const line = `round ${s.roundNo} ply ${s.round.ply} score ${s.score.X}-${s.score.O} ${s.status}`;
  if (line !== lastLog) console.log(line);
  lastLog = line;
  if (m.status !== 'active' || s.status !== 'playing' || s.round.toMove !== 'O') continue;
  const start = Date.parse(m.turn_started_at);
  await sleep(Math.max(0, start - now()) + think);
  const moves = legalMoves(s.round);
  await call('move', { matchId, roundNo: s.roundNo, ply: s.round.ply, cell: moves[Math.floor(Math.random() * moves.length)] });
}
console.log(`match over: ${m.status}, winner ${m.winner ?? 'none'}, reason ${m.ended_reason}`);
