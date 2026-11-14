/** npm run sync-engine: copy packages/engine/src and rating into supabase/functions/_shared (generated). */
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
for (const pkg of ['engine', 'rating']) {
  const src = join(root, 'packages', pkg, 'src');
  const out = join(root, 'supabase/functions/_shared', pkg);
  rmSync(out, { recursive: true, force: true });
  cpSync(src, out, { recursive: true });
  console.log(`synced ${pkg} → ${out}`);
}

