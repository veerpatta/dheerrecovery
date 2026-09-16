/*
 * Browser-side push helpers, shared by the Settings card and the sync shim.
 *
 * No `server-only`, no schema import — this runs in the page. Everything here
 * is guarded, because the three platforms behave differently enough that an
 * unguarded property access is a white screen on one of them:
 *
 *   Android Chrome — everything works, two action buttons are shown.
 *   iOS Home Screen — push works, `actions` are silently ignored.
 *   iOS Safari tab — `Notification` is not defined at all.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; touch points are what give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** True when running from the Home Screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Whether this browser can do web push at all.
 *
 * On iOS the honest test is simply whether `Notification` exists: Safari does
 * not expose it in a tab, only in a Home-Screen web app. That single check is
 * more reliable than sniffing the version.
 */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

/** iOS renders no buttons on a notification; everywhere else shows two. */
export function supportsActions(): boolean {
  if (typeof Notification === 'undefined') return false
  const max = (Notification as unknown as { maxActions?: number }).maxActions
  return typeof max === 'number' ? max > 0 : !isIOS()
}

export function currentLang(): 'en' | 'hi' {
  try {
    return localStorage.getItem('dheer-lang') === 'hi' ? 'hi' : 'en'
  } catch {
    return 'en'
  }
}

/** A name a caregiver will recognise in the device list. */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

/** VAPID keys travel as base64url; `applicationServerKey` wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

/** Tell the server about this device. Safe to call on every app open. */
export async function syncSubscription(
  sub: globalThis.PushSubscription,
  replaces?: string | null,
): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        lang: currentLang(),
        label: deviceLabel(),
        supportsActions: supportsActions(),
        replaces: replaces ?? null,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function subscribeThisDevice(): Promise<
  { ok: true; endpoint: string } | { ok: false; reason: string }
> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-key' }

  // Must happen inside the user gesture that called this.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: permission }

  const reg = await registerWorker()
  if (!reg) return { ok: false, reason: 'no-worker' }
  await navigator.serviceWorker.ready

  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      // Required everywhere, and the reason every push must show something.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

  const ok = await syncSubscription(sub)
  return ok ? { ok: true, endpoint: sub.endpoint } : { ok: false, reason: 'sync-failed' }
}

export async function unsubscribeThisDevice(): Promise<boolean> {
  const reg = await navigator.serviceWorker?.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return true
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
  } catch {
    // Still unsubscribe locally — a row that fails twice is pruned anyway.
  }
  return sub.unsubscribe()
}
