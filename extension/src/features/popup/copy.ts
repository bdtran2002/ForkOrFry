export const popupCopy = {
  title: 'Arm the fryer',
  lede:
    'Firefox-only local parody. Idle detection opens a takeover tab; nothing is injected, submitted, or sent anywhere.',
  intervalLabel: 'Idle interval',
  intervalOptions: [
    { value: 60, label: '1 min' },
    { value: 120, label: '2 min' },
    { value: 300, label: '5 min' },
    { value: 600, label: '10 min' },
  ],
  status: {
    armedOpen: 'Armed. The takeover tab is already open.',
    armedClosed: 'Armed. Firefox idle will open the takeover tab.',
    disarmed: 'Disarmed. The prank is paused until you arm it.',
  },
  labels: {
    mode: 'Mode',
    takeoverTab: 'Takeover tab',
    lastTrigger: 'Last trigger',
  },
  buttons: {
    arm: 'Arm',
    demo: 'Demo now',
    disarm: 'Disarm',
    reset: 'Clear state',
  },
  helper: 'Clear state removes the stored idle timestamp and closes any open takeover tab.',
  notYet: 'Not yet',
  armed: 'Armed',
  disarmed: 'Disarmed',
  open: 'Open',
  closed: 'Closed',
} as const
