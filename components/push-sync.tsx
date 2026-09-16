'use client'

import { useEffect } from 'react'
import { pushSupported, syncSubscription } from '@/lib/push-client'

/**
 * Keeps a subscribed device's row honest, silently, on every app open.
 *
 * Three things drift otherwise. A service worker cannot read `localStorage`,
 * so the only way it knows which language to render a notification in is the
 * `lang` stored against its subscription — and that goes stale the moment
 * somebody taps the language toggle. iOS rotates a subscription when a
 * Home-Screen app has gone unopened for a few weeks, and without a refresh
 * the phone just goes quiet with nothing to say why. And `lastSeenAt` is what
 * tells the Settings device list which phones are still real.
 *
 * Renders nothing, asks for no permission, and does nothing at all on a
 * device that has not already subscribed.
 */
export function PushSync() {
  useEffect(() => {
    if (!pushSupported()) return

    let cancelled = false

    const sync = async () => {
      // Deliberately `getRegistration`, not `register`: this must never install
      // a worker on a device that has not opted in.
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (!sub || cancelled) return
      await syncSubscription(sub)
    }

    void sync()
    window.addEventListener('dheer-lang-change', sync)
    return () => {
      cancelled = true
      window.removeEventListener('dheer-lang-change', sync)
    }
  }, [])

  return null
}
