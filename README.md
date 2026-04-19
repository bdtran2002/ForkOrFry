# ForkOrFry

ForkOrFry is a Firefox extension that detects inactivity and launches a simulated “lock in or fry” takeover.

If you go idle, the extension opens a controlled, self-contained mock interface that visually walks through a fake job application using a scripted cursor and animation timeline.

Nothing is real. Nothing is submitted. It is purely a parody of not locking in.

---

## Features

- Idle detection using browser APIs  
- Fullscreen simulation mode  
- Fake cursor system (no real mouse control)  
- Scripted UI timeline (navigation, loading, form filling)  
- Typing animation with staged inputs  
- Instant exit via ESC or on-screen button  
- No external site interaction  

---

## How It Works

1. The extension monitors inactivity  
2. After a set threshold, a simulation tab opens  
3. A fake browser UI is rendered  
4. A scripted sequence plays:
   - “navigating” to a job page  
   - “loading” content  
   - “filling” out a form  
5. The simulation ends or can be exited at any time  

---

## Safety & Privacy

ForkOrFry is intentionally designed to be safe:

- Does NOT control your real mouse or keyboard  
- Does NOT access or modify external websites  
- Does NOT collect or store user data  
- Does NOT submit any forms  

All behavior is contained within a local extension page.

---

## Installation (Development)

1. Clone the repo:
   ```bash
   git clone https://github.com/yourusername/ForkOrFry.git
   cd ForkOrFry
