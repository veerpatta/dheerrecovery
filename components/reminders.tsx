'use client'

import { useEffect, useRef, useState } from 'react'
import { prettyTime } from '@/lib/time'

export interface ReminderSlot {
  id: string
  brand: string
  label: string
  time: string
}

/**
 * Browser notifications while the site is open, matching the original app.
 * SOS is deliberately excluded — it has no schedule to remind against.
 */
export function ReminderRunner({
  slots,
  leadMinutes,
}: {
  slots: ReminderSlot[]
  leadMinutes: number
}) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const fired = useRef(new Set<string>())

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (permission !== 'granted') return

    const tick = () => {
      const now = new Date()
      const hm = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const [h, m] = hm.split(':').map(Number)
      const nowMin = h * 60 + m

      for (const s of slots) {
        const [sh, sm] = s.time.slice(0, 5).split(':').map(Number)
        const target = sh * 60 + sm - leadMinutes
        const key = `${day}-${s.id}`
        if (nowMin === target && !fired.current.has(key)) {
          fired.current.add(key)
          new Notification(`${s.brand} in ${leadMinutes} minutes`, {
            body: `${prettyTime(s.time)} · ${s.label}`,
            tag: key,
          })
        }
      }
    }

    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [permission, slots, leadMinutes])

  async function enable() {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }

  return (
    <div className="space-y-2">
      {permission === 'granted' ? (
        <p className="rounded-xl bg-mint px-3 py-2.5 text-xs leading-relaxed font-medium text-teal">
          Alerts are on. Reminders appear {leadMinutes} minutes before each routine
          dose while this site is open in a tab.
        </p>
      ) : permission === 'denied' ? (
        <p className="rounded-xl bg-coral-soft px-3 py-2.5 text-xs leading-relaxed text-ink">
          Notifications are blocked for this site. Re-enable them in the browser’s
          site settings, then reload.
        </p>
      ) : (
        <button type="button" onClick={enable} className="btn-primary w-full">
          Enable alerts
        </button>
      )}
    </div>
  )
}
