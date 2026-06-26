/**
 * Upload release artifacts to Cloudflare R2.
 *
 * Run via `npm run publish:mac`, which sources `.env.release` first so these
 * env vars are populated:
 *   R2_ACCESS_KEY_ID       — R2 token Access Key ID
 *   R2_SECRET_ACCESS_KEY   — R2 token Secret Access Key
 *   R2_ENDPOINT            — S3 API endpoint (https://<accountid>.r2.cloudflarestorage.com)
 *   R2_BUCKET              — bucket name (e.g. arco-updates)
 *
 * Uploads from ./dist in this order (deliberate — the manifest goes LAST so
 * clients never see a `latest-mac.yml` pointing at a zip that's still
 * uploading). Artifact names are derived from `package.json` → `version`:
 *   1. Arco-<version>-arm64-mac.zip       (auto-update payload)
 *   2. Arco-<version>-arm64.dmg           (new-user installer)
 *   3. Arco-<version>-arm64-mac.zip.blockmap (delta-update chunk map)
 *   4. latest-mac.yml                     (manifest electron-updater polls)
 *
 * Uses @aws-sdk/lib-storage's Upload class for streamed multipart uploads
 * with progress reporting — handles large DMGs (~200MB) without buffering
 * the whole file in memory.
 */
import { createReadStream, statSync, existsSync, readFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const DIST_DIR = join(ROOT_DIR, 'dist')

/** Artifact names follow electron-builder's default: Arco-<version>-arm64-* */
function readPackageVersion() {
  const pkgPath = join(ROOT_DIR, 'package.json')
  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (!version) {
    console.error(`error: no "version" field in ${pkgPath}`)
    process.exit(1)
  }
  return version
}

function releaseArtifactPaths(version) {
  const zip = join(DIST_DIR, `Arco-${version}-arm64-mac.zip`)
  const dmg = join(DIST_DIR, `Arco-${version}-arm64.dmg`)
  const blockmap = join(DIST_DIR, `Arco-${version}-arm64-mac.zip.blockmap`)
  return { zip, dmg, blockmap }
}

function requireArtifact(path, label, version) {
  if (!existsSync(path)) {
    console.error(`error: ${label} not found at ${path}`)
    console.error(`       Expected version ${version} from package.json.`)
    console.error("       Run 'npm run release:mac' after bumping the version.")
    process.exit(1)
  }
  return path
}

const UPDATE_MANIFEST_URL = 'https://updates.arco.chat/latest-mac.yml'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`error: ${name} not set — source .env.release first`)
    process.exit(1)
  }
  return value
}

const R2_ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY')
const R2_ENDPOINT = requireEnv('R2_ENDPOINT')
const R2_BUCKET = requireEnv('R2_BUCKET')

if (!existsSync(DIST_DIR)) {
  console.error(`error: ${DIST_DIR} not found. Run 'npm run release:mac' first.`)
  process.exit(1)
}

const MANIFEST = join(DIST_DIR, 'latest-mac.yml')
if (!existsSync(MANIFEST)) {
  console.error(`error: ${MANIFEST} not found. The 'zip' target must be enabled in electron-builder.yml.`)
  process.exit(1)
}

const version = readPackageVersion()
const { zip, dmg, blockmap } = releaseArtifactPaths(version)

requireArtifact(zip, 'Auto-update zip', version)
requireArtifact(dmg, 'DMG installer', version)
// blockmap is optional for delta updates — upload when present.

const CONTENT_TYPES = {
  '.dmg': 'application/x-apple-diskimage',
  '.zip': 'application/zip',
  '.yml': 'application/x-yaml',
  '.blockmap': 'application/octet-stream'
}

function contentTypeFor(name) {
  for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
    if (name.endsWith(ext)) return type
  }
  return 'application/octet-stream'
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const s3 = new S3Client({
  region: 'auto', // R2 ignores region but the SDK requires one
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
})

async function uploadFile(localPath) {
  const key = basename(localPath)
  const size = statSync(localPath).size

  process.stdout.write(`→ ${key} (${formatBytes(size)})\n`)

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: createReadStream(localPath),
      ContentType: contentTypeFor(key),
      ContentLength: size
    }
  })

  let lastPercent = -1
  upload.on('httpUploadProgress', ({ loaded, total }) => {
    if (!total) return
    const percent = Math.floor((loaded / total) * 100)
    // Only log on whole 10% steps to keep output tidy.
    if (percent >= lastPercent + 10) {
      lastPercent = percent
      process.stdout.write(`  ${percent}%\n`)
    }
  })

  await upload.done()
  process.stdout.write(`  ✓ done\n`)
}

/** Fetch the public manifest and print it so we know the release is live. */
async function verifyLiveManifest(expectedVersion) {
  console.log('Verifying live manifest...')
  console.log(`  GET ${UPDATE_MANIFEST_URL}`)
  console.log()

  const res = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`manifest request failed (${res.status} ${res.statusText})`)
  }

  const body = await res.text()
  console.log(body.trimEnd())
  console.log()

  const match = body.match(/^version:\s*(\S+)/m)
  const liveVersion = match?.[1]

  if (liveVersion === expectedVersion) {
    console.log(`✓ Live manifest reports version ${liveVersion}`)
    return
  }

  console.warn(
    `⚠ Expected version ${expectedVersion} but live manifest shows ${liveVersion ?? '(missing)'}`
  )
  console.warn('  CDN propagation can take a few seconds — re-run the GET above if this looks stale.')
}

async function main() {
  console.log(`Uploading v${version} release artifacts to R2 bucket '${R2_BUCKET}'...`)
  console.log()

  // Manifest goes LAST. Order of the rest is the natural read order for an
  // update client (zip first, then blockmap, then dmg for completeness).
  await uploadFile(zip)
  if (existsSync(blockmap)) {
    await uploadFile(blockmap)
  }
  await uploadFile(dmg)
  await uploadFile(MANIFEST)

  console.log()
  await verifyLiveManifest(version)
}

main().catch((err) => {
  console.error('error:', err?.message ?? err)
  process.exit(1)
})
