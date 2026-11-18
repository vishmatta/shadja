# AGENTS.md — Shadja

Rules and context for AI coding agents working in this repo. Keep this file under ~20 KB (Antigravity truncates rule files over 24,000 bytes). Project history and decisions: `docs/HANDOFF.md` (the original handoff; frozen, never edit it) and `docs/DECISIONS.md` (living log of changes since; it wins where the two disagree, so add an entry there for each decision or merged PR).

**Backlog: GitHub Issues are the single source of truth** for feature requests, bugs, follow-ups and anything "not verified" or "still to confirm". Docs and PR descriptions record what was decided and shipped; they never hold open work on their own. When a PR leaves something undone, different from its issue, or unverified, open an issue for it (or add it to an existing one, such as the device checklist in #5) and link it from the PR and the DECISIONS.md entry. Close an issue only when its Done-when list is met or its open checks have moved to another issue.

## What this is
Shadja is a personal web app for learning Hindustani classical ragas by ear and by singing, with a Western scales mode kept behind a toggle. The only user is Vishal, an absolute beginner who practises by singing.

- Live: https://vishmatta.github.io/shadja/ (GitHub Pages, branch `main`, repo root)
- The whole app is `index.html`: vanilla JS, Web Audio API, no framework, no build step. The only external resource is Google Fonts (Eczar for display, Mukta for text).

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
- **Tuner:** `detectPitch` (McLeod normalized autocorrelation at half sample rate, 70–1000 Hz, clarity ≥ 0.7, returns `{f, rms}`), `tunerTick` running 20 times a second, `finishSeg` for after-note feedback, `verdict` (±20 cents in tune, flags notes outside the raga). The `TN` constants hold the timings: a note counts after 0.35 s, a new note needs 3 frames in a row more than 70¢ away (so one stray frame can't split a note), and the silence gate is 3× the background level (`tuner.floor`), never stricter than 0.01. Results go into `tuner.hist` (the last 6 notes, shown by `renderHist`); "Listening…" goes to `#tStatus`, so it never overwrites a result.
- **Own-sound gate (mic vs drone):** all app sound goes through `outBus()` (never straight to `ctx.destination`), and `outLevel()` measures it. When the drone starts with the tuner on, `tunerCal` spends 2 s measuring `tuner.k` (mic level ÷ output level, 25th percentile of drone-like frames). After that, a frame is ignored unless the mic is at least `TN.bleed` (1.5×) louder than `k` × the loudest output in the last 0.4 s. The "Mic settings and check" box in the tuner panel holds the cleanup switch (`state.micClean` → `echoCancellation`, default on until Vishal's device test in #17), the mic picker (`state.micId` → `deviceId: {exact}`, falling back to the default mic), the level meter, and the diagnostics from `track.getSettings()`.
- **Hold exercise:** `hold` state (session only; `HOLD` constants), `holdFrame` (called from `tunerTick` after the gates), `holdDraw`, `holdEnd`, `holdStop`, `renderHold`. Pitch-class compare, `TN.zone` for in tune.
- **Call and response:** `echoStart`, `echoTurn`, `echoAnswer`. With the tuner on, `finishSeg` pushes finished notes into `echo.sung` only while `echo.phase === 'turn'`; `echoAnswer` grades them with `checkPhrase(target, sung)` and `echoSungHtml` (tapped keys still win). `checkPhrase` must stay pure (no DOM, no state) so later features can reuse it. The "Check my singing with the mic" button (`#echoMic`) starts or stops the tuner.
- **Guided session:** the `sess` object and `SESS_STEPS` table, with `sessStart`, `sessGo`, `sessTick`, `sessNext`, `sessBack` and `sessEnd` (the last restores the saved play order, speed and loop). `state.sessMin` (5, 10 or 20) is saved. While `sess.on`, `pickSettings` saves the pre-session `mode`, `bpm` and `loop` from `sess.saved`, never the temporary ones.
- **MIDI keyboard:** `midiConnect` (Web MIDI, connects by itself once permission is granted, `midiScan` on `onstatechange`), `midiMsg` (note on/off, CC 64 sustain, CC 120/123 release all; channel 10 ignored), `midiNoteOn`, and the harmonium voice `harmOn`/`harmOff`/`harmRelease`/`harmAllOff`/`harmPedal` (voice table `harm.v`, shared chain `harmChain`, max 10 voices, 120 s safety cap). State: `state.midiOct` (-3..3) and `state.midiVol` (both saved). Pitch: `offset = midiNote + 12*midiOct - (12*(octave+1) + root)`, played at `freqOf(offset)`, and judged on the nearest on-screen key of the same sargam note (`foldKey`). MIDI notes share the tap rule path (`tapAllowed`, then `tapEcho`; `tapKey` uses the same two) and never touch tuner state. All harmonium sound goes through `outBus()`. `midiSync` (in `render()`) releases every note when Sa, octave, raga, system or `midiOct` changes.
- **Saved settings:** `saveSettings` (end of `render()` and the slider/mic handlers), `loadSettings`/`applySettings` (validate each value, before the first `render()`) and `resetSettings` (Advanced button), all on the single key `shadja:settings`. Running states and note subsets are never saved. Add any new setting to `SAVED_FIELDS` and to `applySettings`' validator.
- **Screen wake lock:** `syncWake` (called from `render()`, `visibilitychange` and the next tap) holds `navigator.wakeLock` while `practising()` is true (drone, playback, tuner or call and response) and `state.keepAwake` is on. The Advanced "Keep screen on" switch is the override; its row is hidden where the API is missing.
- **Theme (Sandhya, dusk):** colours are CSS variables on `:root` and in the two identical dark blocks (`--sky` gradient behind `.sing`, `--display` Eczar font, `--off-white` for keys outside the raga, `--root-text` for orange text). The theme rules sit under `/* Sandhya (dusk) theme */` in the `<style>` block. Keep text at WCAG AA in both themes.
- **Layout:** `.layout` is one column on phones (controls → stage → call and response → tuner → raga rules → advanced). From 800 px wide it is two columns, with the `#stage` panel (sing-along display, piano, Play buttons) pinned on the right. `fitKey`/`refit` shrink the keys (minimum 40 px) so the stage fits one screen height. Target devices: iPhone 17 Pro Max (Safari viewport about 440×763) and MacBook Air M1 (about 1440×790).

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

## Build and review loop
One issue, one branch, one PR, two roles: builder and reviewer. **Only a repo admin merges to `main` by hand.** No agent clicks merge, approves on an admin's behalf or bypasses the ruleset. The one exception is an S-size PR, which may merge through GitHub auto-merge once the enforced gate passes.

**Identity: agents post as themselves, never through an admin's account.** Each agent uses its own GitHub identity (`claude[bot]`, `chatgpt-codex-connector[bot]`, or a GitHub App per agent such as `antigravity-…[bot]` or `hermes-…[bot]`). Setup is tracked in #53. Commits carry the agent's own name and email as the author. Until an agent has its own identity, it may push its branch and open a draft PR (naming itself, e.g. "Builder: Claude", at the top of the body), but it posts **no** reviews, comments or replies through the admin's account. Its feedback goes to the admin in chat instead.

**Size decides the approvals.** The builder proposes a `size:` label on the issue before building, and the reviewer confirms it. When in doubt, size up. Any one L trait makes the PR L.

| Size | What it covers | Needs before merge |
|---|---|---|
| **S** | Docs (not AGENTS.md), README, code comments; UI wording and help text; CSS that doesn't change layout or breakpoints; a bug fix of a few lines in one function, outside the L areas. Nothing a beginner learns from changes. | Reviewer approval, all checks green. Auto-merge allowed. |
| **M** | A feature or fix inside one area; raga data and raga text; new saved settings; anything else not S or L. | Reviewer approval, checks green, and **repo admin approval**. |
| **L** | Audio and DSP (`tone`, drone, tanpura, the scheduler, `outBus`); the tuner (`detectPitch`, the gates, `TN`); the saved-settings format; service worker and offline; `.github/`, rulesets, workflows, secrets; AGENTS.md rules; the module split (#9); changes across several areas or over ~300 lines. | Same as M, plus: the repo admin approves the plan on the issue before building, and device checks are listed in #5 before merge. |

**Until #55 makes GitHub enforce sizes, treat every PR as at least M: only the repo admin merges.**

**Builder** (plans and builds; may use subagents):
1. Branch `<issue>-<slug>` from `main` (e.g. `43-hold-records`). Subagents work in the builder's checkout and never push or open branches; the builder commits.
2. Open a draft PR with "Closes #N", the size, a Verified section and a Not verified section. File anything unverified or left undone as an issue (see Backlog above).
3. Watch the PR. For each finding, push a fix as a new commit (never force-push, so the reviewer can diff since its last review) and reply "Fixed in `<sha>`" or "Not changing, because …".
4. Mark the PR ready only when the reviewer has posted "No blocking findings". Turn on auto-merge only for S, and only once the gate in #55 exists.

**Reviewer** (a separate session that doesn't share the builder's context; never pushes):
1. Check the size first; if the diff is bigger than its label, say so as a blocking finding. Then review against the issue's Done-when list, the Hard constraints, Audio rules and Testing above. Run the checks yourself rather than trusting the PR text.
2. Post one review with numbered findings, each marked **blocking** or **non-blocking**, with file and line. Use Request changes for blocking findings and Comment otherwise.
3. On new commits, re-review only what changed since your last review, and close or re-raise each finding.
4. End with Approve and "No blocking findings" when done. For M and L, approval doesn't merge; the repo admin does.

**Stop rule:** at most 3 review rounds. If a finding is still disputed after round 3, the builder summarises both positions for the repo admin in the PR and stops. Neither agent can check audio by ear or on the real iPhone; those go to #5.

## Working with Vishal
- Put the answer or result first. Be direct and dense, use short paragraphs, and bold only the anchor phrase.
- Offer at most 3 options and recommend one. State assumptions in one line. Ask at most one question.
- Push back if a request isn't the best way to learn, but always give him an override. For example, the tuner defaults to feedback after each note, and Live is his override.
- Give a one-line status before each major phase. End with done / next / blocked and one next action he can trigger in a word or two.
- Explain music concepts for an absolute beginner.
