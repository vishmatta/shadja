# AGENTS.md — Shadja

Rules and context for AI coding agents working in this repo. Keep this file under ~20 KB (Antigravity truncates rule files over 24,000 bytes). Full project history and decisions: `docs/HANDOFF.md`.

## What this is
Shadja is a personal web app for learning Hindustani classical ragas by ear and by singing, with a Western scales mode kept behind a toggle. The only user is Vishal, an absolute beginner who practises by singing.

- Live: https://vishmatta.github.io/shadja/ (GitHub Pages, branch `main`, repo root)
- The whole app is `index.html`: vanilla JS, Web Audio API, no framework, no build step. The only external resource is Google Fonts (Bricolage Grotesque).

## Hard constraints
- Hindustani-first. Never remove or break Western mode (`state.system === 'western'`).
- Keep it deployable by pushing to `main`: static files only, served from `/shadja/`. Don't add a build step, bundler or framework without asking Vishal first.
- The tuner needs a secure context (https or localhost) for microphone access.
- Don't load remote audio or scripts; sounds are synthesized in Web Audio.
- Mobile-first: test layouts around 380 px wide. Support light and dark mode through the CSS variables on `:root`.
- Keep `aria-*` labels and `aria-pressed` states on every control.
- User-facing text is plain language for a beginner, with sargam terms explained.

## Code map (all in `index.html`)
- **Data:** `SCALES` (Western intervals) and `RAGAS`. Each raga has `thaat`, `time`, `vadi`, `samvadi`, `rest`, `aroha`, `avaroha`, `pakad`, plus beginner text `summary`, `feel`, `watch`, `look` and an optional `note`. Notes are semitone offsets from Sa: 0 = Sa, 12 = upper Sa, negative = lower octave. `null` in a `pakad` array is a breath (pause). The object key order is the beginner learning order shown in the raga list.
- **State:** the `state` object holds the system, root (Sa), scale or raga, octave, mode, enabled notes, strict, subset, drone and tuner settings. `render()` rebuilds the UI from state.
- **Note logic:** `scaleNotes`, `rank`, `setAuto`, `ragaInfo` (up/down note sets), `buildSeq` (sequence for each play order), `ragaWalk` (random phrases that only use moves found in aroha, avaroha and pakad segments).
- **Playback:** `startSeq`, `schedulePlay`, `stopPlay` and `play` form a lookahead scheduler on the AudioContext clock. `tone` plays one note. `singShow` updates the sing-along display.
- **Drone:** `setDrone` handles three styles: `steady` (sustained oscillators: `startSteady`, `updateSteady`), `tanpura` (Karplus-Strong physical model: `ksBuffer`, `tanPluck`, `scheduleDrone`, `tanBody`) and `both` (steady gain 0.45 under tanpura session gain 2.76).
- **Tuner:** `detectPitch` (McLeod normalized autocorrelation at half sample rate, 70–1000 Hz), `tunerTick` running 20 times a second, `finishSeg` for after-note feedback, `verdict` (±20 cents in tune, flags notes outside the raga).
- **Call and response:** `echoStart`, `echoTurn`, `echoAnswer`.

## Audio rules (learned the hard way)
- Schedule sound and visuals on `ctx.currentTime` plus output latency, never on bare `setTimeout`/`setInterval` timing. Visual highlights drifted a note off before this was fixed.
- Verify pitch numerically after any DSP change. The tanpura string uses a `+0.5`-sample correction and measures 0.00 cents. A low-pass inside the string loop detuned it by -2.5 cents, so filter after the string instead.
- Balance levels and brightness by measurement, not by ear guesses: render offline in Node and compare RMS and the energy above 1.5 kHz.
- Every new sound path goes through `droneGain` (drone) or the shared `ctx`, and must stop cleanly.

## Testing
There is no test suite yet. Before saying a change works:
1. Syntax-check the inline script, e.g. `new Function(script)` in Node.
2. Run a headless check with jsdom and a mocked `AudioContext` (oscillators, gains, filters, buffers, an analyser with synthetic voice input). Click controls and assert on the DOM and on scheduled notes.
3. For DSP changes, port the function to Node and measure pitch error (cents), peaks and decay.
4. Serve locally with `python3 -m http.server` and open http://localhost:8000. localhost counts as a secure context, so the mic works there.

Say what you verified and what you didn't: audio quality on Vishal's phone can only be confirmed by Vishal.

## Working with Vishal
- Put the answer or result first. Be direct and dense, use short paragraphs, and bold only the anchor phrase.
- Offer at most 3 options and recommend one. State assumptions in one line. Ask at most one question.
- Push back if a request isn't the best way to learn, but always give him an override. For example, the tuner defaults to feedback after each note, and Live is his override.
- Give a one-line status before each major phase. End with done / next / blocked and one next action he can trigger in a word or two.
- Explain music concepts for an absolute beginner.
