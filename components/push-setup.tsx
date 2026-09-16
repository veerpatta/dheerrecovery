'use client'

import { useEffect, useState } from 'react'
import { removePushDevice, sendTestPush, setPushKind } from '@/lib/actions'
import {
  isIOS,
  isStandalone,
  pushSupported,
  subscribeThisDevice,
  unsubscribeThisDevice,
  VAPID_PUBLIC_KEY,
} from '@/lib/push-client'
import { useAction } from './chrome'

export interface PushDevice {
  id: string
  label: string | null
  lang: string
  supportsActions: boolean
  lastSeenAt: string | null
  endpoint: string
}

const KINDS = [
  {
    key: 'morning' as const,
    en: 'Morning',
    hi: 'सुबह',
    whenEn: '7:00 am · the day’s greeting, and the therapy question',
    whenHi: 'सुबह 7:00 · दिन का अभिवादन और थेरेपी का सवाल',
  },
  {
    key: 'evening' as const,
    en: 'Evening wrap',
    hi: 'रात की समीक्षा',
    whenEn: '9:45 pm · only when a dose is still unrecorded',
    whenHi: 'रात 9:45 · तभी जब कोई खुराक दर्ज न हुई हो',
  },
  {
    key: 'weight' as const,
    en: 'Weekly weight',
    hi: 'साप्ताहिक वज़न',
    whenEn: 'Mondays, 8:00 am',
    whenHi: 'सोमवार, सुबह 8:00',
  },
  {
    key: 'bloods' as const,
    en: 'Blood tests',
    hi: 'खून की जाँच',
    whenEn: 'The review the 15 September sheet ordered',
    whenHi: '15 सितम्बर की पर्ची पर लिखी समीक्षा',
  },
  {
    key: 'milestones' as const,
    en: 'Course milestones',
    hi: 'कोर्स के पड़ाव',
    whenEn: 'Days 1, 7, 14, 21, 28, 35 and 42',
    whenHi: 'दिन 1, 7, 14, 21, 28, 35 और 42',
  },
]

/**
 * Alerts, on this phone and across the record.
 *
 * Two different things share one card because they read as one idea to a
 * caregiver: whether *this* phone is allowed to buzz, and which alerts the
 * record sends at all. The first is a browser permission tied to one device;
 * the second is a column, shared by every device.
 */
export function PushSetup({
  devices,
  enabled,
}: {
  devices: PushDevice[]
  enabled: Record<'morning' | 'evening' | 'weight' | 'bloods' | 'milestones', boolean>
}) {
  const { run, busy } = useAction()
  const [state, setState] = useState<'checking' | 'unsupported' | 'off' | 'on' | 'denied'>(
    'checking',
  )
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!pushSupported()) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (cancelled) return
      setEndpoint(sub?.endpoint ?? null)
      setState(sub ? 'on' : 'off')
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setError(null)
    const result = await subscribeThisDevice()
    if (result.ok) {
      setEndpoint(result.endpoint)
      setState('on')
      return
    }
    setState(result.reason === 'denied' ? 'denied' : 'off')
    setError(
      result.reason === 'no-key'
        ? 'Alert keys are not set on the server yet.'
        : result.reason === 'denied'
          ? 'Notifications are blocked for this site in the browser’s settings.'
          : 'Could not turn alerts on for this phone.',
    )
  }

  async function disable() {
    await unsubscribeThisDevice()
    setEndpoint(null)
    setState('off')
  }

  const iosNeedsInstall = isIOS() && !isStandalone()

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <p className="eyebrow">
          <span className="lang-en">Alerts on this phone</span>
          <span className="lang-hi">इस फ़ोन पर सूचनाएँ</span>
        </p>
        <h2 className="mt-1 text-[15px] font-extrabold text-navy">
          <span className="lang-en">Reminders that arrive with the app closed</span>
          <span className="lang-hi">ऐप बंद होने पर भी आने वाली सूचनाएँ</span>
        </h2>
      </div>

      {state === 'checking' ? (
        <p className="text-[11.5px] text-muted">Checking this phone…</p>
      ) : state === 'unsupported' ? (
        <p className="note">
          {iosNeedsInstall
            ? 'On an iPhone, alerts need this page added to the Home Screen first — see the card above.'
            : 'This browser cannot receive alerts. Chrome on Android, or an iPhone with this page added to the Home Screen, both can.'}
        </p>
      ) : state === 'denied' ? (
        <p className="note note-warn">
          Notifications are blocked for this site. Re-enable them in the browser’s
          site settings, then reload this page.
        </p>
      ) : state === 'on' ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-xl bg-mint px-3 py-2.5 text-xs leading-relaxed font-medium text-teal">
            <span className="lang-en">
              This phone is on. Alerts arrive whether or not the app is open.
            </span>
            <span className="lang-hi">
              यह फ़ोन चालू है। ऐप खुला हो या न हो, सूचनाएँ आएँगी।
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !endpoint}
              onClick={() =>
                endpoint &&
                run(() => sendTestPush(endpoint), 'Test notification sent ✓')
              }
              className="btn-ghost h-11 flex-1"
            >
              <span className="lang-en">Send a test</span>
              <span className="lang-hi">परीक्षण भेजें</span>
            </button>
            <button
              type="button"
              onClick={disable}
              className="h-11 flex-1 rounded-xl border border-line bg-white text-xs font-bold text-muted transition active:scale-95"
            >
              <span className="lang-en">Turn off on this phone</span>
              <span className="lang-hi">इस फ़ोन पर बंद करें</span>
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={enable} className="btn-primary h-12 w-full">
          <span className="lang-en">Turn on alerts on this phone</span>
          <span className="lang-hi">इस फ़ोन पर सूचनाएँ चालू करें</span>
        </button>
      )}

      {error ? (
        <p className="text-[11.5px] font-semibold text-coral">{error}</p>
      ) : null}
      {!VAPID_PUBLIC_KEY ? (
        <p className="text-[11.5px] text-muted">
          Alert keys are not configured on the server, so nothing can be sent yet.
        </p>
      ) : null}

      <div className="border-t border-line pt-3">
        <p className="eyebrow">
          <span className="lang-en">What gets sent</span>
          <span className="lang-hi">क्या भेजा जाता है</span>
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          <span className="lang-en">
            These apply to every phone on the record. There is deliberately no
            alert for each individual dose — the evening wrap covers anything
            left unrecorded.
          </span>
          <span className="lang-hi">
            ये सभी फ़ोन पर लागू होते हैं। हर खुराक के लिए अलग सूचना जानबूझकर नहीं
            है — रात की समीक्षा बाकी सब बता देती है।
          </span>
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {KINDS.map((k) => (
            <li
              key={k.key}
              className="flex items-start justify-between gap-3 rounded-xl bg-paper px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold text-navy">
                  <span className="lang-en">{k.en}</span>
                  <span className="lang-hi">{k.hi}</span>
                </span>
                <span className="block text-[11px] text-muted">
                  <span className="lang-en">{k.whenEn}</span>
                  <span className="lang-hi">{k.whenHi}</span>
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled[k.key]}
                aria-label={`${k.en} alerts`}
                disabled={busy}
                onClick={() =>
                  run(
                    () => setPushKind({ kind: k.key, on: !enabled[k.key] }),
                    enabled[k.key] ? `${k.en} alerts off` : `${k.en} alerts on ✓`,
                  )
                }
                className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
                  enabled[k.key] ? 'border-teal bg-teal' : 'border-line bg-white'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                    enabled[k.key] ? 'translate-x-[22px]' : 'translate-x-[3px]'
                  } ${enabled[k.key] ? '' : 'border border-line'}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {devices.length ? (
        <div className="border-t border-line pt-3">
          <p className="eyebrow">
            <span className="lang-en">Phones receiving alerts</span>
            <span className="lang-hi">सूचनाएँ पाने वाले फ़ोन</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2"
              >
                <span className="min-w-0 text-[12px] text-ink">
                  <strong className="font-bold text-navy">
                    {d.label ?? 'A device'}
                  </strong>
                  {d.endpoint === endpoint ? ' · this phone' : ''}
                  <span className="block text-[11px] text-muted">
                    {d.lang === 'hi' ? 'हिंदी' : 'English'}
                    {d.supportsActions ? ' · buttons' : ' · tap to open'}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => removePushDevice(d.id), 'Device removed')}
                  className="shrink-0 py-0.5 text-[11px] font-bold text-muted hover:text-coral"
                  aria-label={`Stop sending alerts to ${d.label ?? 'this device'}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
