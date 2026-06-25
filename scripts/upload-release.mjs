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
 * uploading):
 *   1. Arco-<version>-arm64-mac.zip       (auto-update payload)
 *   2. Arco-<version>-arm64.dmg           (new-user installer)
 *   3. Arco-<version>-arm64-mac.zip.blockmap (delta-update chunk map)
 *   4. latest-mac.yml                     (manifest electron-updater polls)
 *
 * Uses @aws-sdk/lib-storage's Upload class for streamed multipart uploads
 * with progress reporting — handles large DMGs (~200MB) without buffering
 * the whole file in memory.
 */
import { createReadStream, statSync, existsSync, readdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')

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

const files = readdirSync(DIST_DIR)
const dmg = files.find((f) => f.endsWith('.dmg'))
const zip = files.find((f) => f.endsWith('-mac.zip'))
const blockmap = files.find((f) => f.endsWith('-mac.zip.blockmap'))

if (!dmg || !zip) {
  console.error(`error: could not find .dmg or *-mac.zip in ${DIST_DIR}`)
  process.exit(1)
}

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

async function main() {
  console.log(`Uploading release artifacts to R2 bucket '${R2_BUCKET}'...`)
  console.log()

  // Manifest goes LAST. Order of the rest is the natural read order for an
  // update client (zip first, then blockmap, then dmg for completeness).
  await uploadFile(join(DIST_DIR, zip))
  if (blockmap) {
    await uploadFile(join(DIST_DIR, blockmap))
  }
  await uploadFile(join(DIST_DIR, dmg))
  await uploadFile(MANIFEST)

  console.log()
  console.log('Done. Verify with:')
  console.log('  curl https://updates.arco.chat/latest-mac.yml')
}

main().catch((err) => {
  console.error('error:', err?.message ?? err)
  process.exit(1)
})
