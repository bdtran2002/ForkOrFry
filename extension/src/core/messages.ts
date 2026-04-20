export type BackgroundMessage =
  | { type: 'arm' }
  | { type: 'disarm' }
  | { type: 'reset' }
  | { type: 'demo-now' }
  | { type: 'set-idle-interval'; idleIntervalSeconds: number }
