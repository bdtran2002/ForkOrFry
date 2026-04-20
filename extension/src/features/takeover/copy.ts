export const takeoverCopy = {
  eyebrow: 'ForkOrFry local parody',
  banner: 'LOCAL DEMO · FAKE CURSOR · NO NETWORK · NO REAL SUBMISSION',
  title: 'Drive-thru destiny simulator',
  lede:
    'A playful, local-only onboarding loop that pretends to prep a crew member, then politely reveals it was theater all along.',
  sessionStatus: 'Session status',
  booting: 'Booting fake onboarding...',
  stepPill: (step: number) => `Step ${step} of 5`,
  stepLabels: ['Briefing', 'Profile', 'Preferences', 'Receipt', 'Done'],
  logTitle: 'Fake activity log',
  completionTitle: 'Simulation complete',
  completionBody:
    'Nothing was submitted. Nothing left this tab. The onboarding storyline simply reached its tiny dramatic finale.',
  complete: 'Complete',
  buttons: {
    reset: 'Reset',
    dismiss: 'Dismiss takeover',
  },
  note: 'This page never submits anything and never talks to the network.',
  fields: [
    { label: 'Employee alias', value: 'Night Fry Ace' },
    { label: 'Shift vibe', value: 'mildly chaotic' },
    { label: 'Sauce alignment', value: 'ultra ranch' },
    { label: 'Bagging confidence', value: '100%' },
  ],
  logs: [
    'Local session opened.',
    'Loaded fake crew profile template.',
    'Queued pretend preferences and badge colors.',
    'Verified nothing is being sent anywhere.',
    'Finalizing the theatrical checkout sequence.',
  ],
  stepStatuses: [
    'Booting fake onboarding...',
    'Collecting a delightfully fictional profile...',
    'Confirming pretend preferences...',
    'Reviewing the local-only receipt preview...',
    'Wrapping up the simulation with no side effects...',
  ],
  completeStatus: 'Simulation complete. Local-only and safely over the top.',
} as const
