# Decisions since the handoff

A living log of what changed after [`HANDOFF.md`](HANDOFF.md) (2026-11-08). HANDOFF.md stays frozen as a snapshot. Where an entry here contradicts it, **this file wins**. Newest first. Each entry links to its pull request or issue.

## 2026-11-13

- **Guided practice session** ([#28](https://github.com/vishmatta/shadja/issues/28)).
  - "Start practice" in Hindustani mode runs five timed steps: Settle on Sa (20%), Sa, Pa and upper Sa (10%), Up and down the raga (20%), Warm-up pattern (20%) and The raga's signature phrase (30%). Length is 5, 10 or 20 minutes; the choice is saved as `sessMin` (default 10).
  - Step 2 uses Ma instead of Pa when the raga has no Pa.
  - Settings are restored at the end: play order, speed and loop, and the drone only if the session started it. The panel is hidden in Western mode, and changing the raga, switching to Western or Reset to defaults ends a running session.
  - Still to confirm: the step order and timings are a starting guess; and step 5 loops the pakad rather than running call and response.
- **Call and response checks the sung answer with the tuner** ([#18](https://github.com/vishmatta/shadja/issues/18)).
  - With the tuner on, the held notes it finishes during the user's turn (the same segments that feed the tuner history, in both feedback modes, after the silence and own-sound gates) are compared with the phrase by pitch class, so the right note in another octave counts. Anything sounding when the turn starts is closed off first, and nothing is collected during the call or the replay, so the app never grades its own sound.
  - `checkPhrase(target, sung)` is a pure edit-distance alignment: one missed or extra note does not turn later notes wrong, and a run of identical target notes can be met by one sung note. It returns right (with cents), wrong (with the note sung) or missed per target note, plus a count of extra notes. Chips reuse `.echo-note.ok/.no`; a "didn't hear any notes" message replaces all-missed when nothing was detected.
  - Tapped keys win: if any key was tapped during the turn the old tap check runs unchanged, and with the tuner off nothing changes. New "Check my singing with the mic" button starts or stops the tuner.
  - Unverified on a real voice, and with the drone playing through a speaker (tested with a synthetic mic only).
- **Hold a note exercise in the tuner panel** ([#29](https://github.com/vishmatta/shadja/issues/29)).
  - Pick a target note (chips for the raga or scale notes, Sa by default; reset to Sa when the raga, scale or Sa changes) and a hold length of 5, 8, 12 or 20 seconds, then sing it. The attempt starts at the first voiced frame (after the existing silence and own-sound gates, so the drone can stay on), skips the first 100 ms, and compares by pitch class, so any octave counts. It ends when the hold length is reached or after 0.6 s of quiet following at least 1 s of singing; it then re-arms once the voice has been quiet.
  - Two feedback behaviours follow the tuner mode. After each note: the bar shows time sung, with no in-tune information while singing; the attempt ends at the hold length, and counts as a success if at least 80% of it was in tune. Live: the bar fills only while in tune and pauses when you drift; the attempt ends when in-tune time reaches the hold length.
  - Result: time in tune out of the hold length, average offset ("on the note" within ±5¢, else flat or sharp), steadiness, which note was held if it was another one, and one tip. It suggests the next hold length after a success but never changes it itself. Session only: not saved; Reset to defaults and stopping the tuner end it.
  - Thresholds: in tune is `TN.zone` = ±20¢ (now shared with `verdict`), steady is a standard deviation under 12¢, and quiet for 0.6 s ends an attempt. **The 12¢ steadiness threshold and the 80% After each note success share are starting guesses, still to be confirmed by Vishal.**
- **Settings are remembered between visits** ([#6](https://github.com/vishmatta/shadja/issues/6)).
  - Saved in one `localStorage` key, `shadja:settings` (JSON with a version field), because the origin is shared with other GitHub Pages sites. Saved: system, Sa, octave, scale or raga (the one currently chosen, as the app keeps a single slot), play order, speed, loop, strict, scale-notes-only lock, accidentals, numbering, drone style and volume, tuner feedback, mic cleanup, chosen mic, keep screen on.
  - Deliberately not saved: anything running (drone, playback, tuner, call and response), enabled-note subsets, practice subset and replay order. The app always starts stopped.
  - Every value is validated on its own, so one bad value falls back to its default and the rest are kept. All storage access is in try/catch. When every setting equals its default the key is removed.
  - Advanced has a **Reset to defaults** button: stops sound and tuner, forgets the saved key and restores the startup settings.
- **Visual redesign: the "Sandhya (dusk)" theme** ([#27](https://github.com/vishmatta/shadja/pull/27)).
  - New palette (dusk purples with a saffron Sa), in light and dark.
  - Fonts **Eczar** (display) and **Mukta** (text) replace Bricolage Grotesque.
  - The sing-along display sits on a sky gradient, and the heading carries the Devanagari षड्ज.
  - Keys for notes outside the raga are now solid and quiet instead of see-through.
  - Polish pass: contrast checked to WCAG AA in both themes, visible focus rings, and the desktop stage fits one 790 px screen again.
  - *Why:* Yaman, the first raga, is an evening raga, so the app should feel like dusk. Vishal picked direction A of three mockups.
  - **Still to confirm:** how it looks on Vishal's iPhone.

## 2026-11-09

- **The repo About section and README were refreshed. HANDOFF.md stays frozen, and this file records changes instead.** *Why:* keep the original snapshot intact while giving agents an accurate current picture.
- **Tuner: a gate stops the app's own sound from fooling the tuner** ([#25](https://github.com/vishmatta/shadja/pull/25), part of [#17](https://github.com/vishmatta/shadja/issues/17)).
  - All app sound goes through `outBus()`.
  - When the drone starts with the tuner on, the tuner measures for 2 s how much drone reaches the mic. After that it ignores sound that isn't 1.5× louder than the expected leak.
  - The new *Mic settings and check* box holds Mic cleanup (echo cancellation), a mic picker, a level meter and mic diagnostics.
  - *Why:* with the drone on the speaker, the tuner reported false Sa and Pa notes while Vishal was silent.
  - **Open:** the Mic cleanup default stays **on** until Vishal's device test in #17 picks it.
- **Tuner: shorter hold and steadier note splitting** ([#24](https://github.com/vishmatta/shadja/pull/24), [#16](https://github.com/vishmatta/shadja/issues/16)).
  - *Supersedes the handoff's* "a held note needs ~0.6 s". A note now counts after **0.35 s**.
  - A new note needs 3 frames in a row (150 ms) more than 70¢ away.
  - The silence gate is 3× the room's background level, never stricter than 0.01, and the clarity cut-off is 0.7.
  - The last 6 notes stay on screen.
  - *Why:* results vanished when notes were sung back to back, and short or quiet notes were missed.
- **Screen wake lock while practising** ([#15](https://github.com/vishmatta/shadja/pull/15), closes [#3](https://github.com/vishmatta/shadja/issues/3)).
  - *Resolves the handoff's* unconfirmed "phones may pause the drone when the screen locks".
  - The lock is held while the drone, playback, tuner or call and response runs, with an Advanced switch to turn it off.
  - Still to confirm on the iPhone (#5).
- **Phone and desktop layout** ([#2](https://github.com/vishmatta/shadja/pull/2)).
  - *Resolves the handoff's* "on mobile the piano sits below the panels".
  - Phones: one column with the stage (sing-along display, piano, Play) right after the controls.
  - 800 px and wider: two columns, with the stage pinned on the right.
  - Keys shrink, with a 40 px minimum, so the stage fits one screen.
  - Target devices: iPhone 17 Pro Max and MacBook Air M1.
- **Renamed to Shadja and moved HANDOFF.md into `docs/`** ([#1](https://github.com/vishmatta/shadja/pull/1)).
  - *Supersedes the handoff's* "current page title and h1 (not yet renamed): Raga practice piano". Both now say **Shadja**.
- **The handoff's open items became GitHub issues #4–#23, with priority labels.**
  - Still open from the handoff: one file or split ([#9](https://github.com/vishmatta/shadja/issues/9), needs a decision), raga data check ([#7](https://github.com/vishmatta/shadja/issues/7)), real-device checks ([#5](https://github.com/vishmatta/shadja/issues/5)).
- **Repo locked down for a public repo.**
  - Ruleset "protect main": PRs required (0 approvals), no force-push or deletion, linear history.
  - Squash and rebase merges only; head branches deleted automatically after merge.
  - Actions limited to the owner's and GitHub's own actions, with a read-only token.
  - Secret scanning and push protection on.
  - GitHub Pages deploys from `main` with HTTPS enforced.
- **No licence (all rights reserved).** Vishal kept the default when the README was refreshed.
