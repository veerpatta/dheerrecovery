/**
 * Checks the parts of web push that can be verified without a real phone.
 *
 * A true end-to-end test is not possible here and it is worth saying why: a
 * Chromium launched under automation has no connection to Apple's or Google's
 * push service, so `pushManager.subscribe()` fails with "permission denied"
 * however the permission is granted. Receiving a real notification has to be
 * checked on a real device — see the Alerts section of the README.
 *
 * What is checkable is everything on this side of the push service:
 *
 *   1. the VAPID keys are a valid pair and `web-push` will sign with them,
 *   2. a payload actually encrypts to a real subscription's keys,
 *   3. the service worker is served correctly and handles the events it must,
 *   4. the copy renders in both languages without an undefined creeping in.
 *
 * Usage: node scripts/push-check.mjs            (crypto + copy only)
 *        BASE_URL=http://127.0.0.1:3111 node scripts/push-check.mjs   (+ the worker)
 */
import { createECDH, randomBytes } from 'node:crypto'
import webpush from 'web-push'

const BASE = process.env.BASE_URL ?? ''

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// ------------------------------------------------------------- VAPID ----

const pub = process.env.VAPID_PUBLIC_KEY
const priv = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT

check('VAPID keys are set', Boolean(pub && priv && subject))
check(
  'the public key reaches the browser bundle',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY === pub,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'matches' : 'NEXT_PUBLIC_VAPID_PUBLIC_KEY unset',
)

if (pub && priv && subject) {
  try {
    webpush.setVapidDetails(subject, pub, priv)
    check('web-push accepts the key pair', true)
  } catch (e) {
    check('web-push accepts the key pair', false, e.message)
  }

  /*
   * A synthetic subscription with a real P-256 keypair — exactly the shape a
   * browser produces. If the payload encrypts against it, it will encrypt
   * against a phone's, because nothing in that path knows the difference.
   */
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const fake = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/push-check',
    keys: {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  }

  try {
    const details = webpush.generateRequestDetails(
      fake,
      JSON.stringify({ kind: 'test', title: 'Test', body: 'Body', badge: 0 }),
      { TTL: 60 },
    )
    check(
      'a payload encrypts to a subscription',
      Buffer.isBuffer(details.body) && details.body.length > 0,
      `${details.body.length} bytes, ${details.headers['Content-Encoding']}`,
    )
    check(
      'the request is signed with VAPID',
      String(details.headers.Authorization ?? '').startsWith('vapid'),
    )
  } catch (e) {
    check('a payload encrypts to a subscription', false, e.message)
  }
}

// -------------------------------------------------------------- copy ----

const copy = await import('../lib/notify/copy.ts').catch(() => null)
if (!copy) {
  // Plain node cannot import TypeScript; the build covers this instead.
  console.log('SKIP  copy deck — run through the build, not plain node')
} else {
  const langs = ['en', 'hi']
  let bad = 0
  for (const line of copy.MORNING_LINES) {
    for (const l of langs) if (!line[l] || /undefined/.test(line[l])) bad++
  }
  check('every morning line exists in both languages', bad === 0, `${bad} gaps`)
}

// ------------------------------------------------------ service worker ----

if (BASE) {
  const res = await fetch(`${BASE}/sw.js`)
  const body = await res.text()
  check('the service worker is served', res.ok, `${res.status} ${res.headers.get('content-type')}`)
  check(
    'it is served as JavaScript',
    /javascript|ecmascript/.test(res.headers.get('content-type') ?? ''),
    res.headers.get('content-type') ?? 'no content-type',
  )
  for (const event of ['push', 'notificationclick', 'pushsubscriptionchange']) {
    check(`it handles "${event}"`, body.includes(`addEventListener('${event}'`))
  }
  // Every push must show something, or the browser eventually revokes the
  // permission. The fallback is what guarantees that for a malformed payload.
  check('it has a fallback for an unreadable payload', /FALLBACK/.test(body))

  const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) => r.json())
  check(
    'the manifest lists the PNG icons an install needs',
    manifest.icons.some((i) => i.sizes === '192x192') &&
      manifest.icons.some((i) => i.sizes === '512x512'),
  )
  check('the manifest is standalone (required for iOS push)', manifest.display === 'standalone')
  check(
    'the apple touch icon is served',
    (await fetch(`${BASE}/apple-touch-icon.png`)).ok,
  )
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
