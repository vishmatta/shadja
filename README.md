# Shadja

Learn Hindustani classical ragas by singing: a tanpura drone, a sing-along piano that follows each raga's rules, call and response, and a microphone tuner. Western scales are one tap away.

**Live:** https://vishmatta.github.io/shadja/

Shadja (षड्ज) is the formal name for **Sa**, the home note every other note is measured from.

## Start here
1. **Pick your Sa.** Choose a home note that sits comfortably low in your voice.
2. **Start the drone.** It keeps Sa sounding so you always hear home. *Both* (tanpura with a steady bed) is the default.
3. **Press Play and sing along.** The big display shows the note to sing now and the next ones. Try *Aroha* (going up), then *Avaroha* (coming down), then the *Pakad* (the raga's signature phrase).
4. **Turn on the tuner.** Sing a note, hold it, then stop or move to the next one. Your last notes stay on screen with how close you were.
5. **Try call and response.** The app plays a short phrase and you sing it back.

## Features
- **12 ragas** in a beginner learning order: Yaman, Bhupali, Bhairav, Kafi, Bhimpalasi, Khamaj, Bihag, Bageshree, Bhairavi, Malkauns, Todi (Miyan ki), Darbari Kanada. Each has its aroha, avaroha, pakad, vadi/samvadi (the most and second-most important notes), resting notes, time of day, and look-alike ragas to watch for.
- **A piano that follows the raga**, with sargam labels, rings on resting notes and up-only or down-only arrows. *Strict* mode keeps you to the raga's notes and directions.
- **Play orders:** aroha, avaroha, both, pakad, random phrases that follow the raga's rules, and alankars (warm-up patterns in pairs, threes and fours). Speed 40–160 notes per minute, with loop and replay.
- **Drone:** steady, tanpura (a physical model of plucked strings) or both.
- **Tuner:**
  - Feedback after each note (the default, better for training your ear) or a live needle.
  - A history of your last 6 notes.
  - It ignores the drone leaking from the speaker into the mic.
  - A *Mic settings and check* box with a mic level meter and mic choice.
- **Keeps your screen awake** while the drone, playback, tuner or call and response is running, so the drone isn't cut off when your phone locks (switch in *Advanced*).
- **Phone and desktop:** one column on a phone. On a laptop, the piano and sing-along display stay pinned on the right.
- **Light and dark mode** follow your device.
- **Western scales** (16, including major, minor, the modes, pentatonics and blues) behind the *System* switch.

## Tuner tips
- **Headphones give the cleanest reading.** Without them, the drone and piano leak into the mic.
- **With AirPods, choose the iPhone microphone** in *Mic settings and check*. Using the AirPods mic switches them to phone-call quality, which makes the drone sound thin.
- **If the drone gets quieter when you sing**, AirPods *Conversation Awareness* may be lowering it. Turn it off in Settings → your AirPods. The other likely cause is *Mic cleanup* (echo cancellation), so try it both on and off.
- **Stay quiet for 2 seconds** after starting the drone with the tuner on. The tuner is measuring how much drone reaches the mic. If you sang or moved the phone, press *Measure the drone again*.

## Privacy
Your microphone audio is analysed on your device and never recorded or sent anywhere. The app makes no network requests, except for loading the Google Fonts stylesheet.

## Requirements
- A recent Safari, Chrome, Edge or Firefox.
- The tuner needs https (the live site) or `localhost`, because browsers only allow the mic there.
- Keeping the screen awake needs Safari 16.4+ or Chrome 84+. On iPhone home-screen web apps, it needs iOS 18.4+. Where it isn't supported, the switch is hidden.

## Run it locally
Everything is in `index.html`: vanilla JavaScript and the Web Audio API, with no build step and no dependencies.

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## For contributors and AI agents
- [`AGENTS.md`](AGENTS.md): rules, code map, audio lessons and how to test. Read this first.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): the original project handoff, kept frozen as a snapshot.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): what has changed since the handoff (living log).
- [Issues](https://github.com/vishmatta/shadja/issues): planned work, labelled `priority: high`, `priority: medium` or `priority: low`.

## Licence
No licence: all rights reserved. You're welcome to read the code and try the app, but reuse needs permission.
