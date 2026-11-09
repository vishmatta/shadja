# Handoff: Shadja raga practice web app
2026-11-08 · for a new AI session · kind: code

_State snapshot for a new AI session. Trust it over assumptions; settled decisions stay settled._

## Objective
Continue building Shadja, a personal Hindustani-first raga practice web app (Western scales kept) for Vishal, an absolute beginner self-learning Hindustani classical music by singing. Audience is only Vishal.

## Current state
Shadja is one static file, index.html (~82 KB, vanilla JS, Web Audio API, no build step, no dependencies except Google Fonts), in repo vishmatta/shadja (branch main, 1 commit, index.html only) and live on GitHub Pages. The page title and h1 still say 'Raga practice piano'; the rename to Shadja has not been made. Built and tested headlessly: Hindustani mode (default, raga Yaman) and Western mode; 12 ragas with aroha/avaroha/pakad/vadi/samvadi/thaat/time/resting notes/watch-outs/look-alikes; 18-key vertical piano in raga mode (lower Pa to upper Sa) with sargam labels, resting-note rings and up/down-only arrows; Strict mode; play orders (Aroha, Avaroha, Aroha + avaroha, Pakad, Random by the rules, alankar Pairs/Threes/Fours); lookahead playback engine with speed 40-160 notes/min, loop and stop; sing-along display; Replay order; call and response with optional tap scoring; Practice subset (opt-in); drone with Steady, Tanpura (physical model) and Both (default); microphone tuner with 'After each note' (default) and 'Live' feedback. No uncommitted work. The claude.ai artifact copy is frozen and cannot use the mic. There are no failing tests and no test suite in the repo; earlier checks ran in a scratch environment (jsdom with a mocked AudioContext, plus offline Node DSP measurements) and were not committed.

## Decisions (settled, do not reopen)
- **Hindustani-first, but keep the full Western scales mode behind the System toggle**: Vishal wants the tool focused on Hindustani classical music without deleting the Western side
- **Design for an absolute beginner who practises by singing**: Stated by Vishal; drives sing-along, drone and tuner priority and plain-language text
- **Name is Shadja**: Vishal's choice (the formal name for Sa, the home note) over SwarLabs and Chalan
- **Host on GitHub Pages at https://vishmatta.github.io/shadja/**: The claude.ai artifact viewer blocks the microphone; the tuner needs a normal https page
- **Raga data: 12 ragas in learning order starting with Yaman; notes are semitone offsets from Sa (negative = lower octave, 12 = upper Sa); null in a pakad array marks a breath**: Common textbook (Bhatkhande-style) forms; learning order suits a beginner
- **Strict mode (default on) merges 'raga notes only' and the aroha/avaroha tap check**: Two related switches would confuse a beginner
- **Raga mode locks notes to the full raga; the note stepper is only available behind an opt-in Practice subset with a warning**: Turning notes off changes the raga's identity
- **Readouts split into going-up and going-down rows; raga mode adds lower Pa to Ni keys below Sa**: A merged set hid direction rules (e.g. Khamaj Ni vs Ni-flat); lower-octave phrase notes were flashing on the wrong keys
- **Random by the rules is a random walk over moves found in the aroha, avaroha and pakad segments, entering through the first aroha note with an outgoing move, avoiding early returns to Sa and resolving to Sa**: Keeps generated phrases inside the raga's movement rules
- **Replay order persists across root changes but resets on scale/raga or enabled-note changes**: Order is stored as numbers relative to the root
- **Defaults: numbering 1-12, octave 3, drone style Both, tuner feedback 'After each note'**: Requested by Vishal (numbering, octave, Both); delayed feedback trains the ear better, with Live as his override
- **Tanpura uses Vishal's Karplus-Strong code with fixes: +0.5-sample tuning correction, one-sided jivari without the sin term, per-string choke, 50 ms end fade, compressor, audio-clock scheduling, pure-ratio second string (3/4, 2/3, 15/16), buffer cache**: The original was up to +2.7 cents sharp, had a fixed ~1.1 kHz artifact, could clip, drifted on timers and could not stop
- **Tanpura brightness balanced by measurement: upper strings pluck smoothing 0.78, jivari 0.28, low-pass 2000 Hz; low Sa 0.8, 0.25, 1500 Hz**: Vishal heard the low Sa as harsh, then as too soft; the measured values make all four strings similarly bright
- **Both mode: steady bed gain 0.45 and tanpura session gain 2.76**: Measured: tanpura alone is about 10 dB quieter than Steady; this puts the steady bed ~6 dB under the tanpura at Steady's loudness
- **Tuner: in-tune zone +/-20 cents, equal-temperament targets, 70-cent hysteresis, a held note needs ~0.6 s, range 70-1000 Hz, flags notes outside the raga**: Raga intonation differs from piano tuning by up to ~15-20 cents; hysteresis stops flicker

## Dead ends (do not retry)
- **Highlights on Play scale were one note off**: Visual timers drifted from the audio clock; fixed by scheduling on the audio clock plus output latency. Keep visuals tied to the audio clock
- **Yaman 'Random, by the rules' played only one note**: The walk started on Sa, which has no outgoing move in Yaman's phrases; fixed with the aroha entry note
- **Original synth tanpura (sawtooth plucks)**: Hard for Vishal to follow; replaced by the physical model
- **First low Sa fix (smoothing 0.85, jivari 0.2, low-pass 1100 Hz)**: Over-softened it so the other strings sounded harsh; replaced by the balanced values
- **Darkening the low Sa with a low-pass inside the string loop**: Detuned it by about -2.5 cents; a filter after the string was used instead
- **Using the microphone inside the claude.ai artifact viewer**: Blocked by the viewer; not fixable there, which is why the app moved to GitHub Pages
- **Names Riyaz, SurTaal, SwarShala**: Already used by existing apps

## Artifacts
- **index.html (the whole app)** at `https://github.com/vishmatta/shadja`: final, current live version
- **Live site** at `https://vishmatta.github.io/shadja/`: live
- **claude.ai artifact copy** at `https://claude.ai/artifact/4693HdsF24ibYTk2hrfkXb`: frozen; Vishal asked for no more changes to it; superseded by the repo
- **raga-practice-piano.html (downloaded copy)** at `Vishal's device`: superseded by index.html in the repo

## Verbatim essentials (use exactly)
- **Repo**: `https://github.com/vishmatta/shadja`
- **Live site**: `https://vishmatta.github.io/shadja/`
- **Frozen artifact**: `https://claude.ai/artifact/4693HdsF24ibYTk2hrfkXb`
- **Current page title and h1 (not yet renamed)**: `Raga practice piano`
- **Sargam labels used in the UI**: `Sa, Re♭, Re, Ga♭, Ga, Ma, Ma♯, Pa, Dha♭, Dha, Ni♭, Ni`
- **Raga order in the app**: `Yaman, Bhupali, Bhairav, Kafi, Bhimpalasi, Khamaj, Bihag, Bageshree, Bhairavi, Malkauns, Todi (Miyan ki), Darbari Kanada`

## Working preferences (follow these)
- Line 1 is the answer or result; direct, dense, action-first; short paragraphs; bold only anchor phrases
- Give at most 3 options and recommend one; state assumptions in one line; ask at most one question
- Say what was verified and what was assumed; check specifics (versions, numbers, platform behaviour) instead of recalling them
- One-line status before each major phase; end with done / next / blocked and one next action triggerable in a word or two
- Push back when a request isn't the best way to learn, but always leave Vishal an override
- Test changes before claiming they work: Vishal caught real bugs (highlight off by one note, random walk playing one note)
- Explain music concepts in plain language for an absolute beginner

## Open items
- **Next step:** Ask Vishal which task to start with, proposing the page title and h1 rename from 'Raga practice piano' to 'Shadja' as a small first task
- **Then:**
  - Phase 3 options planned earlier: ornament playback (andolan on Darbari Ga♭ and Bhairav Re♭, meend slides), just-intonation toggle, 'raga for now' by time of day, saved progress in localStorage
  - Restructure the single file (it was patched repeatedly rather than restructured); keep it buildless unless Vishal agrees otherwise
  - Offered but not accepted: level-match Tanpura-alone (about 10 dB quieter than Steady), adjust the Both balance, MIDI export of the last phrase, a drone register option for the low Sa
- **Blocked:**
  - Tuner verification on a real device (unblocks: Vishal opens https://vishmatta.github.io/shadja/ on his phone and confirms the mic prompt and readings)

## Unresolved (ask before assuming)
- Whether to restructure into multiple files or keep one file

## Unconfirmed (do not rely on these)
- The tuner has not been confirmed working on GitHub Pages; it was only tested headlessly with a simulated microphone
- Raga details (resting notes, watch-outs, look-alikes, pakad breaks) come from Claude's knowledge, not checked against a source
- The Both balance ('steady about 6 dB under tanpura') is a judgment call Vishal has not adjusted
- Phones may pause the drone when the screen locks; on mobile the piano sits below the panels, so call-and-response tap-back needs scrolling
