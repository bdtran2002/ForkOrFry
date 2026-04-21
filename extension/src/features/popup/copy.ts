export const popupCopy = {
  title: 'Idle trigger + local game pane',
  lede:
    'Firefox-only local shell. After Firefox detects idle, renewed activity reopens the local game pane. Nothing is sent anywhere.',
  intervalLabel: 'Idle interval',
  intervalOptions: [
    { value: 60, label: '1 min' },
    { value: 120, label: '2 min' },
    { value: 300, label: '5 min' },
    { value: 600, label: '10 min' },
  ],
  status: {
    armedReady: 'Armed. Firefox is waiting for the next idle period.',
    waitingForActivity: 'Idle detected. The next return to activity will open or refocus the local game pane.',
    surfaceOpen: 'The local game pane is open. The next idle → activity cycle will refocus it.',
    disarmed: 'Disarmed. Idle triggers are paused.',
  },
  labels: {
    mode: 'Trigger mode',
    pane: 'Game pane',
    awaitingActivity: 'Awaiting activity',
    lastTrigger: 'Last trigger / open',
  },
  buttons: {
    arm: 'Arm idle trigger',
    demo: 'Open pane now',
    disarm: 'Pause trigger',
    reset: 'Clear state',
  },
  helper: 'Clear state closes any open game pane and removes the stored idle/activity checkpoint.',
  notYet: 'Not yet',
  armed: 'Armed',
  disarmed: 'Paused',
  open: 'Open',
  closed: 'Closed',
  yes: 'Yes',
  no: 'No',
} as const
