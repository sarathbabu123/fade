/**
 * Delete test accounts (and their matches) from the live project.
 * node --experimental-strip-types tools/scripts/cleanup-test-users.ts [--also=name1,name2] [--dry]
 * Always removes usernames starting with zz_ or test_friend_. The service key is
 * fetched from the Management API at run time and kept in memory only.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_PROJECT_URL!.replace(/[\\/]+$/, '');
const ref = process.env.SUPABASE_PROJECT_REF!;
const dry = process.argv.includes('--dry');
const also = (process.argv.find((a) => a.startsWith('--also='))?.split('=')[1] ?? '').split(',').filter(Boolean);

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
});
const keys = (await keysRes.json()) as { type?: string; name?: string; api_key: string }[];
const secret = keys.find((k) => k.type === 'secret')?.api_key ?? keys.find((k) => k.name === 'service_role')?.api_key;
if (!secret) throw new Error('no service key');
const admin = createClient(url, secret, { auth: { persistSession: false } });

const { data: profiles } = await admin.from('profiles').select('id, username');
const doomed = (profiles ?? []).filter((p) => /^(zz_|test_friend_)/.test(p.username) || also.includes(p.username));
console.log(`${doomed.length} test profiles: ${doomed.map((p) => p.username).join(', ') || '(none)'}`);
if (dry || !doomed.length) process.exit(0);

const ids = doomed.map((p) => p.id);
// Matches reference profiles without cascade: remove them (moves cascade) first.
for (const col of ['player_x', 'player_o']) {
  await admin.from('matches').update({ rematch_id: null }).in(col, ids);
}
for (const col of ['player_x', 'player_o']) {
  const { error } = await admin.from('matches').delete().in(col, ids);
  if (error) console.log(`matches.${col}: ${error.message}`);
}
let deleted = 0;
for (const id of ids) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) console.log(`user ${id}: ${error.message}`);
  else deleted++;
}
console.log(`deleted ${deleted} test accounts`);
