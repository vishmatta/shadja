# Shadja

A personal practice app for learning Hindustani classical ragas by singing, with Western scales one tap away.

**Live:** https://vishmatta.github.io/shadja/

- 12 ragas with their rules: aroha, avaroha, pakad, vadi/samvadi, resting notes and time of day
- A vertical piano that follows each raga's up/down rules, with Strict mode
- Raga phrases, rule-following random phrases, alankar exercises and call and response
- Drone: steady, tanpura (physical model) or both
- Microphone tuner with feedback after each note, or live

Everything is in `index.html` (vanilla JS and Web Audio, no build). To run it locally: `python3 -m http.server`, then open http://localhost:8000.
