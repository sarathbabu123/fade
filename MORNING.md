# Good morning, Sarath ☀️

This is the hand-off note from the overnight build. I update it after every step.

## Status
- [x] Step 1: engine + solver (3×3 chosen; report in `tools/solver/REPORT.md`)
- [x] Step 2: app shell + Neon Ink theme (screenshots not reviewed; no phone overnight)
- [ ] Step 3: offline game (board, animations, sounds, bot, pass & play)
- [ ] Step 4: Supabase (schema, RLS, anonymous auth)
- [ ] Step 5: online matches
- [ ] Step 6: challenge codes + WhatsApp share
- [ ] Step 7: ratings (first to be cut if short on time)
- [ ] Step 8: final APK + download link

## APK
- Link: _(added when the final build is uploaded)_
- WhatsApp text: _(added at the end)_

## Decisions I made overnight (please review)
All are logged in `BUILD_PLAN.md` → "v1 scope decisions", marked "decided overnight".

## Known gaps / not tested
- Real two-phone online play is not tested; I test with scripted players against the real server.

## Things to undo or keep safe
- PC sleep was disabled on AC power. To restore it:
  - `powercfg /change standby-timeout-ac 30`
  - `powercfg /change hibernate-timeout-ac 180` (or your previous value)
- **Back up `app/credentials/fade-release.jks` and `app/credentials.json`** (gitignored). Every future APK update must be signed with this same key, or phones will refuse to install it over the old one.
- A portable JDK 21 lives in `C:\Users\Sarath Babu\.fade-tools` (used for the emulator SDK tools). Java needs `-Djavax.net.ssl.trustStoreType=Windows-ROOT` on this PC because of TLS interception.
