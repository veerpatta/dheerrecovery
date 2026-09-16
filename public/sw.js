/*
 * Dheer Recovery service worker.
 *
 * Deliberately plain JavaScript in `public/`, which Next serves verbatim and
 * does not bundle. A service worker has to be served from the scope it
 * controls with its own stable URL; routing it through the build for the sake
 * of TypeScript would buy nothing here, because the only contract it has is
 * the payload shape in lib/notify/types.ts and that is written down there.
 *
 * It deliberately does NOT cache anything. This app is a shared medical
 * record where every page is force-dynamic — serving a stale dose list from a
 * cache would be worse than being offline, because it would look current.
 * This worker exists for push and for notification taps, nothing else.
 */

const VERSION = 'v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/** Shown when a push arrives that we cannot read — see the try/catch below. */
const FALLBACK = {
  title: 'Dheer Recovery',
  body: 'Open the app to see today’s chart.',
  url: '/',
  tag: 'fallback',
  actions: [],
  badge: 0,
  logId: null,
}

self.addEventListener('push', (event) => {
  /*
   * Chrome DevTools' "Push" button sends an unencrypted plain string, and a
   * malformed payload must never leave the worker in a state where it shows
   * nothing at all: both Chrome and iOS require a visible notification for
   * every push received, and a worker that silently swallows one is how a
   * site loses its notification permission.
   */
  let data = FALLBACK
  try {
    if (event.data) data = { ...FALLBACK, ...event.data.json() }
  } catch {
    // keep FALLBACK
  }

  const options = {
    body: data.body,
    // iOS ignores `icon` and draws the Home-Screen icon instead; Android uses
    // this one. `badge` is the monochrome status-bar silhouette, Android only.
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    // Replaces an earlier alert of the same kind on the same day rather than
    // stacking a second copy — the one thing that makes a retry safe.
    tag: data.tag,
    renotify: true,
    requireInteraction: false,
    data,
    // iOS renders no buttons at all and does not throw; Android shows two.
    // Every notification is therefore fully actionable by tapping its body.
    actions: (data.actions || []).slice(0, 2),
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, options)
      if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
        try {
          if (data.badge > 0) await self.navigator.setAppBadge(data.badge)
          else await self.navigator.clearAppBadge()
        } catch {
          // Badging is unsupported on most desktops. Never fail the push.
        }
      }
    })(),
  )
})

/** Focus an existing tab on `url` if there is one, otherwise open it. */
async function openApp(url) {
  const all = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  const target = new URL(url, self.location.origin)
  const same = all.find((c) => new URL(c.url).pathname === target.pathname)
  if (same) return same.focus()
  const anyWindow = all[0]
  if (anyWindow && 'navigate' in anyWindow) {
    await anyWindow.focus()
    return anyWindow.navigate(target.href)
  }
  return self.clients.openWindow(target.href)
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || FALLBACK
  const action = event.action || 'open'
  event.notification.close()

  event.waitUntil(
    (async () => {
      // Close sibling alerts of the same kind on this device, so acting on one
      // phone does not leave a stale copy sitting in the tray beside it.
      for (const n of await self.registration.getNotifications({ tag: data.tag })) {
        n.close()
      }

      if (action === 'open' || !data.logId) {
        return openApp(data.url || '/')
      }

      let result = null
      try {
        const res = await fetch('/api/push/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            logId: data.logId,
            careDate: data.careDate,
            action,
          }),
        })
        result = await res.json()
      } catch {
        // Offline, or the app is down. Fall through to opening it.
      }

      /*
       * A stale alert — one left on a lock screen overnight — must not write
       * anything. The server says so and the worker opens the app instead, so
       * the caregiver sees the real state rather than a silent no-op.
       */
      if (!result || result.stale || !result.ok) {
        await self.registration.showNotification('Dheer Recovery', {
          body: (result && result.message) || 'Open the app to record this.',
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          tag: `${data.tag}-result`,
        })
        return openApp((result && result.url) || data.url || '/')
      }

      return self.registration.showNotification('Dheer Recovery', {
        body: result.message,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `${data.tag}-result`,
      })
    })(),
  )
})

/*
 * Push services rotate a subscription from time to time, and iOS does it
 * routinely when a Home-Screen app has gone unopened for a while. Without
 * this the device goes quiet and nothing says why.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || (await self.registration.pushManager.getSubscription())
      const key = old && old.options && old.options.applicationServerKey
      if (!key) return
      const fresh = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          subscription: fresh.toJSON(),
          replaces: old ? old.endpoint : null,
        }),
      })
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.source?.postMessage(VERSION)
})
