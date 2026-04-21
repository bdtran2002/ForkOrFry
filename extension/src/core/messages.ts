export type BackgroundMessage =
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'reset' }
  | { type: 'demo-now' }
  | { type: 'close-surface' }
  | { type: 'open-full-tab' }
  | { type: 'move-to-full-tab' }
  | { type: 'set-idle-interval'; idleIntervalSeconds: number }
