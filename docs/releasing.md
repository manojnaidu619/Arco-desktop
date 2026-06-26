# Releasing Arco

Operational runbook for shipping a new macOS release: code-signed, notarized
by Apple, and auto-updated via Cloudflare R2.

> **Audience:** the developer doing the release, and AI agents asked to
> prepare or troubleshoot one. Read this end-to-end the first time. After
> that, the [Release checklist](#release-checklist) section is enough.

---

## How the pieces fit together

```
  ┌───────────────┐   npm run release:mac    ┌──────────────────────┐
  │  Your Mac     │  ───────────────────────▶│ Apple notary service │
  │  (Keychain +  │                          │ (scans + staples)    │
  │   .p8 key)    │  ◀───────────────────────└──────────────────────┘
  └──────┬────────┘
         │ npm run publish:mac
         ▼
  ┌───────────────┐                          ┌──────────────────────┐
  │ Cloudflare R2 │  ◀───── poll ────────────│ Installed Arco       │
  │ updates.arco. │                          │ (electron-updater)   │
  │ chat          │                          └──────────────────────┘
  └───────────────┘
```

- **Code signing** uses a _Developer ID Application_ certificate from your
  login Keychain (Team ID `Z6N26D2QCX`). Auto-discovered by electron-builder
  via `CSC_IDENTITY_AUTO_DISCOVERY=true`.
- **Notarization** uses an App Store Connect API key (`.p8` file +
  Key ID + Issuer ID). Read from env vars at build time; never committed.
- **Distribution + auto-update** is a static `latest-mac.yml` + `.zip` +
  `.dmg` hosted at `https://updates.arco.chat` (Cloudflare R2 bucket
  `arco-updates`, served via a custom domain).
- **The installed app** polls `https://updates.arco.chat/latest-mac.yml` on
  launch and every 4 hours. When a newer version is found, it shows
  [`src/components/UpdateDialog.tsx`](../src/components/UpdateDialog.tsx).

### Key files

| File                                                                  | Purpose                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| [electron-builder.yml](../electron-builder.yml)                       | Packaging, signing, notarize, publish target                   |
| [build/entitlements.mac.plist](../build/entitlements.mac.plist)       | Hardened-runtime entitlements (JIT, etc.)                      |
| [electron/updater.ts](../electron/updater.ts)                         | Main-process auto-update wiring                                |
| [src/components/UpdateDialog.tsx](../src/components/UpdateDialog.tsx) | Renderer update UI                                             |
| [scripts/upload-release.mjs](../scripts/upload-release.mjs)           | Uploads dist/ artifacts to R2 (Node, via `@aws-sdk/client-s3`) |
| [scripts/verify-release.sh](../scripts/verify-release.sh)             | Auto-runs after `release:mac`; checks signature + notarization |
| `.env.release` (gitignored)                                           | Apple + R2 secrets, sourced by `release:mac` and `publish:mac` |
| [.env.release.example](../.env.release.example)                       | Template for `.env.release`                                    |

---

## One-time setup (already done — reference only)

Skip this section unless you're setting up a new dev machine or rotating
credentials.

### Apple side

1. **Developer ID Application certificate** created at
   https://developer.apple.com/account/resources/certificates/list →
   _Developer ID Application_ → _G2 Sub-CA_. Installed in login Keychain.
   Verify with `security find-identity -v -p codesigning`.
2. **Apple Developer ID G2 intermediate certificate** installed from
   https://www.apple.com/certificateauthority/ (otherwise Keychain shows
   "not trusted").
3. **App Store Connect API key** created at
   https://appstoreconnect.apple.com/access/integrations/api → Team Keys →
   _Developer_ access. `.p8` downloaded **once** (no second chance) and
   stored at `~/Documents/arco-certificates/AuthKey_<KeyID>.p8`.
4. **Team ID** `Z6N26D2QCX` — hard-coded in [electron-builder.yml](../electron-builder.yml).

### Cloudflare R2 side

1. Bucket `arco-updates` created.
2. Custom domain `updates.arco.chat` bound to the bucket (public read).
3. R2 API token with **Object Read & Write** on `arco-updates`. Access
   Key ID + Secret stored in `.env.release` locally.

### Local env file

`.env.release` exists in the repo root (gitignored) and contains real
values for: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`,
`CSC_IDENTITY_AUTO_DISCOVERY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ENDPOINT`, `R2_BUCKET`. See [.env.release.example](../.env.release.example).

---

## Testing the update flow locally

Before publishing to R2, you can rehearse the entire auto-update flow on your
own machine — no real release, no R2 churn. This catches bugs in the dialog
UI, the download/install handoff, and any regression in the updater wiring
itself.

### How it works

The auto-updater normally polls the URL baked into [electron-builder.yml](../electron-builder.yml)
(`https://updates.arco.chat`). For testing, [electron/updater.ts](../electron/updater.ts)
honors an `ARCO_UPDATE_FEED_URL` env var: when present, the updater calls
`autoUpdater.setFeedURL()` to redirect to that URL instead.

The override only kicks in when the env var is set **at app launch**. That
means production users (who double-click the dock icon) never see it — they
always hit the real R2 feed. The override exists purely so a developer
launching the app from Terminal can point it at a local HTTP server.

### One-time prerequisite

You need an already-installed older version to upgrade from. Build it once
and forget about it:

```bash
# Make sure package.json version is the "old" one, e.g. 0.1.0
npm run release:mac
open dist/Arco-0.1.0-arm64.dmg
# Drag Arco into /Applications, then eject the DMG.
```

### Test recipe (run every time you want to test an update)

1. **Bump `package.json` version** to the candidate, e.g. `0.1.0` → `0.1.1`.
2. **Build the new version:**
    ```bash
    npm run release:mac
    ```
    This produces `dist/Arco-0.1.1-arm64-mac.zip`, the `.dmg`, the
    `.blockmap`, and `latest-mac.yml`.
3. **Serve `dist/` over HTTP** in a separate terminal:
    ```bash
    cd dist && python3 -m http.server 8080
    ```
    Any static server works — `npx serve -p 8080`, `caddy file-server`, etc.
4. **Quit any running copy of Arco** (Cmd+Q or `pkill -x Arco`). The
   override is read at process start; relaunching is mandatory.
5. **Launch the installed v0.1.0 with the override:**
    ```bash
    ARCO_UPDATE_FEED_URL=http://localhost:8080 \
      /Applications/Arco.app/Contents/MacOS/Arco
    ```
    > Launching the binary directly (not via `open`) keeps the env var in
    > scope. `open -a Arco` would drop it.
6. **Watch the flow.** Within ~5 seconds:
    - "Update available" dialog appears → click **Download**
    - Progress bar advances as the zip streams from localhost
    - "Restart and install" appears → click it
    - App quits, swaps itself in place, relaunches as v0.1.1
7. **Verify** the title bar / About dialog shows the new version.

### Verifying the test setup is working

If the dialog doesn't appear, sanity-check each link in the chain:

```bash
# 1. Is the local server actually serving the manifest?
curl http://localhost:8080/latest-mac.yml
# Should return YAML with `version: 0.1.1`.

# 2. Was the env var actually set when you launched?
# Run this in the same terminal you launched the app from:
env | grep ARCO_UPDATE_FEED_URL

# 3. Look at the updater's logs. electron-updater writes to:
#   ~/Library/Logs/Arco/main.log
tail -f ~/Library/Logs/Arco/main.log
```

The log will show lines like `checking for update`, `update available`, and
either the download progress or the exact error if something fails.

### Gotchas

- **The installed v0.1.0 must itself have been built with this version of
  `electron/updater.ts`.** If you installed a build from before the
  `ARCO_UPDATE_FEED_URL` override existed, the env var will be ignored.
  Rebuild and reinstall the "old" version first.
- **Code signatures still get verified.** The updater rejects an unsigned or
  badly-signed zip even from localhost. If you're testing on a build that
  failed notarization, the install step will fail with a signature error.
- **Don't `open -a Arco`** — that hands off to `launchd`, which spawns the
  process in a clean environment and drops your env vars. Always launch the
  binary inside the `.app` directly, as shown above.
- **Re-installs don't reset the updater's cache.** If you re-test against
  the same version number, the updater may say "up to date" because it
  remembers it already downloaded that version. Bump the version each iteration.
- **The override is dev-only by design.** Releasing the override mechanism
  is intentional — but a malicious user can't exploit it because: (1) they
  have to set an env var before launch, which requires terminal access, and
  (2) all downloaded updates still must pass code-signature verification.

---

## Day-to-day development

Nothing changes from before. Signing only happens at release time.

```bash
npm run dev          # iterate locally
```

You don't need `.env.release` or any Apple credentials for `npm run dev` or
`npm run dist:mac` (unsigned local build).

---

## Release checklist

### 1. Bump the version

```bash
npm pkg set version=<NEW_VERSION>
```

e.g. `npm pkg set version=0.1.1`. This updates `package.json` → `"version"`
in place (equivalent to editing it by hand). Follow semver:

- Patch (`0.1.0` → `0.1.1`) — bug fixes only
- Minor (`0.1.1` → `0.2.0`) — new features, backwards-compatible
- Major (`0.2.0` → `1.0.0`) — breaking changes

> The installed client compares its own version to `latest-mac.yml.version`
> using semver. If you don't bump, the update won't trigger.

### 2. Commit and tag

```bash
git add package.json
git commit -m "Release v<NEW_VERSION>"
git tag v<NEW_VERSION>
git push && git push --tags
```

Tags aren't required for the updater (R2 is the source of truth), but they
give you a clean rollback point in git.

### 3. Build, sign, notarize

```bash
npm run release:mac
```

This sources `.env.release`, runs `electron-vite build`, then
`electron-builder --mac --arm64 --publish never`. Takes **5–10 minutes** —
most of that is Apple's notarization service scanning the bundle on their
servers.

Watch the log for these stages:

1. `signing` — your local cert signs every binary
2. `notarizing` — bundle uploaded to Apple, status polled
3. `stapling` — notary ticket attached to the .app so it works offline

Produces in `dist/`:

- `Arco-<version>-arm64.dmg` — new-user installer
- `Arco-<version>-arm64-mac.zip` — what existing users download to update
- `Arco-<version>-arm64-mac.zip.blockmap` — enables delta updates
- `latest-mac.yml` — the manifest installed clients poll

### 4. Automatic signature + notarization verification

**You don't need to run anything for this step** — it happens automatically.
`release:mac` has a `postrelease:mac` npm hook that runs
[scripts/verify-release.sh](../scripts/verify-release.sh) as soon as the
build finishes. The script runs four checks against
`dist/mac-arm64/Arco.app`:

| #   | Check                 | Tool                                | What it proves                                                                                             |
| --- | --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Signature details     | `codesign -dv --verbose=4`          | Identity, Team ID, and runtime flags are what you expect (informational)                                   |
| 2   | Signature integrity   | `codesign --verify --deep --strict` | Every binary (including nested frameworks and native modules) is signed by the same identity, no tampering |
| 3   | Gatekeeper assessment | `spctl -a -vvv -t install`          | macOS itself would accept this app — the closest proxy for "what a user's Mac will do"                     |
| 4   | Notarization ticket   | `stapler validate`                  | Apple's notary ticket is stapled into the bundle, so Gatekeeper can verify offline                         |

If all four pass, you see:

```
Verification passed. Safe to publish with 'npm run publish:mac'.
```

If any fail, the script exits non-zero, so the whole `release:mac` command
fails — meaning you cannot accidentally proceed to `publish:mac` with a
broken build. The script prints which specific check failed and a hint
about likely cause (e.g. "notarization may have failed").

You can also re-run the verifier any time without rebuilding:

```bash
bash scripts/verify-release.sh
```

### 5. Smoke-test the app itself

Verification confirms the bundle is signed and notarized, but it doesn't
exercise the app. Open the DMG, drag to Applications, launch. Click around
for 2–3 minutes. Catches anything that broke in the packaged build but
worked in dev (CSP violations, missing native modules, broken file paths).

### 6. Publish to R2

```bash
npm run publish:mac
```

Sources `.env.release` and runs [scripts/upload-release.mjs](../scripts/upload-release.mjs)
(Node, using `@aws-sdk/client-s3` against R2's S3-compatible endpoint — no external CLI required).
The script uploads in a deliberate order:

1. `*-mac.zip` (the update payload)
2. `*.dmg`
3. `*.blockmap`
4. `latest-mac.yml` **last**

> **Why order matters:** if the manifest landed first, a client polling
> mid-upload would see a `latest-mac.yml` pointing at a `.zip` that hasn't
> finished uploading and the download would fail. Manifest goes last so no
> client ever sees a broken state.

### 7. Verify the update is live

```bash
curl https://updates.arco.chat/latest-mac.yml
```

Should show the new `version`. Then launch a still-installed older copy of
Arco — within ~5 seconds the update dialog should appear.

---

## Rules and gotchas

### You cannot roll back a release

R2 is a CDN, not a versioned release feed. Once clients have updated to
v0.1.1, they will never see v0.1.0 again — even if you replace
`latest-mac.yml`. If a release is broken, **ship v0.1.2 with the fix.**

### Never reuse a version number

`electron-updater` keys off the version string. If you publish v0.1.1, find
a bug, edit code, and re-publish under v0.1.1, clients that already pulled
the first build will not pull the new one. Always bump.

### `.env.release` is single-source

It is gitignored and never leaves the machine that does releases. If you
need to release from a second machine, copy it manually over a secure
channel. Do not paste secrets into chat, commits, or PR descriptions.

### The `.p8` key is one-time download

App Store Connect only lets you download the `.p8` once. If lost, revoke
the key in ASC and generate a new one. Keep an encrypted backup somewhere
durable (1Password, encrypted external drive).

### Notarization failures

Apple's notary will reject builds for:

- Binaries not signed with the hardened runtime → check [electron-builder.yml](../electron-builder.yml) has `hardenedRuntime: true`.
- Missing entitlements for JIT or unsigned executable memory → check [build/entitlements.mac.plist](../build/entitlements.mac.plist).
- A native dependency shipping with bad metadata. Look at the rejection log Apple emails; it names the offending file.

To inspect a notarization rejection:

```bash
xcrun notarytool log <SUBMISSION_ID> \
  --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER"
```

The submission ID is in the electron-builder log when notarization fails.

### Dev mode does not auto-update

[electron/updater.ts](../electron/updater.ts) returns early when `isDev()`.
You can only test auto-update with a packaged, signed, installed build.

### Architecture

Releases are **arm64 only** (Apple Silicon). Intel Macs cannot install.
Changing this means updating the `target.arch` array in
[electron-builder.yml](../electron-builder.yml) and rebuilding as universal
or x64.

---

## Common operations

### Inspect the live manifest

```bash
curl -s https://updates.arco.chat/latest-mac.yml
```

### Force the installed app to check for updates immediately

Open DevTools in a packaged build (you can't — DevTools are dev-only), or
restart the app. The first check fires 5 seconds after launch.

### Delete a bad release from R2 (does NOT roll back clients)

In the Cloudflare dashboard → R2 → bucket `arco-updates` → delete the
specific objects. Only useful if **no clients have updated yet** and you
want to abort. Otherwise, ship a higher version.

### Rotate the ASC API key

1. ASC → Users and Access → Integrations → revoke old key.
2. Generate new key, download `.p8`, update `.env.release` with new path
   and IDs.
3. Re-run a release to confirm.

### Rotate the R2 token

1. Cloudflare → R2 → Manage API Tokens → revoke old token.
2. Create new token (Object R/W on `arco-updates`), update
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in `.env.release`.

### Rotate the Developer ID certificate

Only needed when the cert expires (5 years from issue). Repeat the cert
creation flow at https://developer.apple.com → install in Keychain. Team
ID stays the same. No code changes needed.

---

## Glossary

- **Code signing** — attaching a cryptographic signature to every binary in
  the `.app` so macOS can verify it came from you and hasn't been tampered with.
- **Notarization** — Apple's automated malware scan. Returns a "ticket" you
  staple to the `.app` so users don't see the "unidentified developer"
  warning.
- **Hardened runtime** — a macOS opt-in security mode that restricts what
  the app can do at runtime (no unsigned code injection, etc.). Required
  for notarization. Electron needs specific exemptions, in
  [build/entitlements.mac.plist](../build/entitlements.mac.plist).
- **Stapling** — embedding the notarization ticket into the `.app` so it
  works offline. Done automatically by electron-builder.
- **`latest-mac.yml`** — the manifest electron-updater polls. Contains
  version, file names, SHA512 hashes, release date.
- **Blockmap** — a sidecar file that lets electron-updater download only
  the changed chunks of the update zip instead of the whole thing.
- **Team ID** — your 10-character Apple developer team identifier
  (`Z6N26D2QCX` for Arco).
