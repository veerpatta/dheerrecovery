/*
 * The contract between the server that sends a push and `public/sw.js` that
 * receives it. The service worker is plain JavaScript outside the TypeScript
 * build, so nothing here is enforced across that boundary — which is exactly
 * why it is written down in one place. Change a field name and `sw.js` has to
 * change with it.
 */

export type NotifyKind =
  | 'morning'
  | 'evening'
  | 'weight'
  | 'bloods'
  | 'milestone'
  | 'test'

export type Lang = 'en' | 'hi'

/** What a button on the notification does when tapped. */
export type PushActionId =
  | 'therapy-yes'
  | 'therapy-no'
  | 'open'

export interface PushAction {
  action: PushActionId
  title: string
}

export interface PushPayload {
  kind: NotifyKind
  title: string
  body: string
  /** Where tapping the notification body goes. Always set — on iOS it is the
   *  only way to act on a notification, because iOS renders no buttons. */
  url: string
  /** `notification_log.id`. The action route uses it to check the alert is
   *  still for today and has not already been acted on. */
  logId: string | null
  careDate: string
  /** Groups a re-send with its original rather than stacking a second one. */
  tag: string
  actions: PushAction[]
  /** Unrecorded-dose count for `navigator.setAppBadge`. 0 clears it. */
  badge: number
}

/** POST body of /api/push/action, sent by the service worker. */
export interface PushActionRequest {
  logId: string
  careDate: string
  action: PushActionId
}

export interface PushActionResponse {
  ok: boolean
  /** Shown by the service worker as a follow-up notification. */
  message?: string
  /** True when the alert is no longer for today — the SW opens the app. */
  stale?: boolean
  url?: string
}
