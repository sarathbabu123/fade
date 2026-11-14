/**
 * node tools/scripts/release-apk.mjs <easBuildId>
 * Downloads a finished EAS APK and publishes it at the permanent public link
 * <SUPABASE_PROJECT_URL>/storage/v1/object/public/apk/fade.apk (plus a versioned copy).
 * Needs .env loaded (SUPABASE_PROJECT_URL, SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, EXPO_TOKEN).
 * The upload key is fetched from the Management API at run time and kept in memory only.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const id = process.argv[2];
if (!id) throw new Error('usage: release-apk.mjs <easBuildId>');
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const url = process.env.SUPABASE_PROJECT_URL.replace(/[\\/]+$/, '');
const ref = process.env.SUPABASE_PROJECT_REF;
const version = JSON.parse(readFileSync(join(root, 'app/app.json'), 'utf8')).expo.version;

let apk;
if (existsSync(join(root, 'fade-preview.apk'))) {
  console.log('Using local fade-preview.apk…');
  apk = new Uint8Array(readFileSync(join(root, 'fade-preview.apk')));
} else {
  const build = JSON.parse(
    execSync(`npx -y eas-cli@latest build:view ${id} --json --non-interactive`, { cwd: join(root, 'app'), stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
  );
  if (build.status !== 'FINISHED') throw new Error(`build ${id} is ${build.status}`);
  const apkUrl = build.artifacts?.buildUrl ?? build.artifacts?.applicationArchiveUrl;
  console.log(`build ${id} finished (v${version}), downloading…`);
  apk = new Uint8Array(await (await fetch(apkUrl)).arrayBuffer());
}
console.log(`APK ${(apk.length / 1024 / 1024).toFixed(1)} MB`);

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
});
if (!keysRes.ok) throw new Error(`api-keys: ${keysRes.status}`);
const keys = await keysRes.json();
const secret = keys.find((k) => k.type === 'secret')?.api_key ?? keys.find((k) => k.name === 'service_role')?.api_key;
if (!secret) throw new Error('no secret / service_role key available');

async function put(path) {
  const res = await fetch(`${url}/storage/v1/object/apk/${path}`, {
    method: 'POST',
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/vnd.android.package-archive',
      'x-upsert': 'true',
      'cache-control': 'max-age=60',
    },
    body: apk,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
  console.log(`uploaded ${path}`);
}
await put(`fade-${version}.apk`);
await put('fade.apk');

const publicUrl = `${url}/storage/v1/object/public/apk/fade.apk`;
const head = await fetch(publicUrl, { method: 'HEAD' });
console.log(`public link ${head.status} ${head.headers.get('content-length')} bytes: ${publicUrl}`);
