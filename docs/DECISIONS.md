# Decisions since the handoff

A living log of what changed after [`HANDOFF.md`](HANDOFF.md) (2026-11-08). HANDOFF.md stays frozen as a snapshot. Where an entry here contradicts it, **this file wins**. Newest first. Each entry links to its pull request or issue.

## 2026-11-20

- **A test checks every raga against the raga grammar** ([#66](https://github.com/vishmatta/shadja/issues/66)). `tests/raga-rules.test.mjs` lifts `RAGAS` out of `index.html` and checks 8 rules: 5 to 7 notes, Sa present, Ma or Pa present, no natural and altered form of one note back to back, vadi/samvadi/rest are raga notes, notes fit the thaat (a `THAATS` table of the 10 thaats lives in the test), vadi and samvadi a 4th or 5th apart (warning only), pakad uses raga notes. All 12 current ragas pass; no data changed.
  - **Notes are counted as swaras, not pitch classes** (rule 1): Ma and Ma♯ in one raga count as one note, as in jati counting. *Why:* by pitch class, Bihag (both Ma) and Khamaj (both Ni) have 8 notes and would fail, though both are Sampurna (7).
  - **Thaat allow-list:** Bihag's passing Ma♯ (Bilawal thaat) and Khamaj's shuddha Ni in aroha (Khamaj thaat has only Ni♭). Each has its reason in the file. **Open:** confirming swara counting and both exceptions against a primary source is tracked on [#7](https://github.com/vishmatta/shadja/issues/7).

## 2026-11-18

- **The ~300-line L threshold counts app code only** ([#55](https://github.com/vishmatta/shadja/issues/55)). Lines under `tests/` and `docs/` don't count toward it, because they can't break the app; every other L trait still applies (e.g. `.github/` and AGENTS.md rules are L at any size). *Why:* PR #64 added 661 lines of tests with no app change, and the line rule alone made it L. Decided by Vishal.
- **Committed headless tests for the tuner, hold exercise and call and response** ([#23](https://github.com/vishmatta/shadja/issues/23)).
  - `tests/` holds them, outside the app: the site loads nothing from it and there is still no build step. `cd tests && npm test` runs 26 tests in about 2 minutes; `tests/README.md` covers first-time setup (`npm ci`, `npx playwright install chromium`) and CI.
  - Voices are synthesised from a seed (`tests/voices.mjs`), not recorded, so every run hears the same audio and no audio files are committed. Chromium's fake mic plays them (`--use-file-for-fake-audio-capture`), and the tests check what is on screen.
  - **Drone bleed** is the app's real output fed back into the mic 60 ms late at half level, the same method #25 used; the test also checks the measured leak, so it can't pass on silence.
  - `checkPhrase` is lifted from `index.html` by its source text and unit-tested in Node, which relies on it staying pure.
  - `SHADJA_SITE=<dir>` runs the suite against another copy of the app. Deliberately broken copies (old minimum hold, no 3-frame rule, own-sound gate off, looser steadiness, no legato sharing in `checkPhrase`) each fail the matching test.
  - Playwright is pinned (1.63.0) with its lockfile committed. Running the tests in CI is [#56](https://github.com/vishmatta/shadja/issues/56); tests for the rest of the app are [#63](https://github.com/vishmatta/shadja/issues/63), which the module split (#61) depends on.
- **Branch names: a platform-assigned branch is fine; the PR title carries the issue number.** Cloud sessions are given `claude/…` branch names and told to push only there, which clashed with the `<issue>-<slug>` rule. The PR title now starts with the issue number (e.g. "#23: …"), so the link stays visible either way.
- **Build and review loop, PR sizes, and agents post as themselves** (AGENTS.md, [#53](https://github.com/vishmatta/shadja/issues/53), [#55](https://github.com/vishmatta/shadja/issues/55)).
  - One issue, one branch, one PR. A builder agent builds and answers findings with new commits; a separate reviewer agent reviews, re-reviews only new commits, and marks findings blocking or non-blocking. At most 3 rounds, then the repo admin decides.
  - **Size decides the approvals.** S (docs, wording, small fixes outside risky areas): reviewer approval and green checks, auto-merge allowed. M (a feature or fix in one area, raga data): plus repo admin approval. L (audio, tuner, storage format, workflows, AGENTS.md rules, big or cross-area changes): plus admin sign-off on the plan before building. The size is computed from the diff, not just claimed; enforcing it is #55. Until then every PR is at least M.
  - Raga data and raga text are always at least M; the repo admin looks over merged S PRs once a week (both decided by Vishal on #55).
  - **Only a repo admin merges to `main` by hand;** S PRs may merge through auto-merge once the gate exists. Agents never merge, approve for the admin or bypass the ruleset.
  - Agents use their own GitHub identities (`claude[bot]`, `chatgpt-codex-connector[bot]`, or a GitHub App per agent), never the admin's account. Until an agent has one, it may push and open a draft PR but posts no reviews or comments; setup is #53.
  - *Why:* Vishal wants to see which agent wrote what, and wants low-risk work to flow without him while keeping a say on changes that can break the app. GitHub doesn't let an account review its own PR, so a reviewer posting as Vishal could only comment.
- **Code structure: split `index.html` into native ES modules, with no build step** ([#9](https://github.com/vishmatta/shadja/issues/9)).
  - `index.html`, `style.css` and a `js/` folder of modules, one per existing script section. GitHub Pages serves them as is.
  - Type checks (`// @ts-check`) and the committed tests from #23 run only in GitHub Actions; nothing the site loads is built.
  - Order: #23 tests first, then a split with no behaviour changes, then features such as #44. Not started.
  - *Supersedes the handoff's* open "restructure into multiple files or keep one file". *Why:* the file reached ~140 KB, past the ~120 KB point #9 set for revisiting, and the Profile screen (#44) is the first second screen. A framework or bundler was not chosen.
- **GitHub Issues are the single source of truth for open work.** Every feature request, bug, follow-up and unverified check lives in an issue; this file and PR descriptions link to them instead of holding them. Untracked items from PR notes and this file became #45–#51, Vishal's new requests became #42–#44, and the device checks for #27 and #37–#41 were added to #5. *Why:* open items were scattered across PR "not verified" sections and this log, and several closed issues still had unchecked device tests.

## 2026-11-16

- **MIDI keyboard input with a harmonium voice.**
  - A MIDI keyboard (built for an Arturia MiniLab MkII) plays a harmonium: two reeds an octave apart, held for as long as the key is down, with a sustain pedal. Keys play their real pitch (your Sa is the key matching the Sa you picked), and a "Keyboard octave" stepper (-3 to +3, saved as `midiOct`) and a "Harmonium volume" slider (saved as `midiVol`) sit in a new "MIDI keyboard" panel.
  - MIDI notes go through the same rule path as the on-screen keys (`tapAllowed`): strict mode, aroha and avaroha moves, "Play scale notes only", the practice subset and call and response all apply, and a blocked note makes no sound.
  - It connects with no click once the browser has remembered permission, and picks up a keyboard plugged in later. The tuner is untouched: MIDI never reads or changes tuner state, and the harmonium goes through the shared output bus so the tuner's own-sound gate hears it as app sound.
  - Web MIDI needs Chrome or Edge; Safari does not support it.
  - Still to confirm: the harmonium sound by ear, and the MiniLab MkII and pedal on the real device (#5).
  - **Open:** with the drone off, the tuner hears the harmonium as your voice (#42).

## 2026-11-13

- **Guided practice session** ([#28](https://github.com/vishmatta/shadja/issues/28)).
  - "Start practice" in Hindustani mode runs five timed steps: Settle on Sa (20%), Sa, Pa and upper Sa (10%), Up and down the raga (20%), Warm-up pattern (20%) and The raga's signature phrase (30%). Length is 5, 10 or 20 minutes; the choice is saved as `sessMin` (default 10).
  - Step 2 uses Ma instead of Pa when the raga has no Pa.
  - Settings are restored at the end: play order, speed and loop, and the drone only if the session started it. The panel is hidden in Western mode, and changing the raga, switching to Western or Reset to defaults ends a running session.
  - Still to confirm: the step order and timings are a starting guess (#50); step 5 loops the pakad rather than running call and response (#46); steps change mid-phrase and mid-session changes are lost (#45); on a phone the steps and the piano aren't on screen together (#47).
- **Call and response checks the sung answer with the tuner** ([#18](https://github.com/vishmatta/shadja/issues/18)).
  - With the tuner on, the held notes it finishes during the user's turn (the same segments that feed the tuner history, in both feedback modes, after the silence and own-sound gates) are compared with the phrase by pitch class, so the right note in another octave counts. Anything sounding when the turn starts is closed off first, and nothing is collected during the call or the replay, so the app never grades its own sound.
  - `checkPhrase(target, sung)` is a pure edit-distance alignment: one missed or extra note does not turn later notes wrong, and a run of identical target notes can be met by one sung note. It returns right (with cents), wrong (with the note sung) or missed per target note, plus a count of extra notes. Chips reuse `.echo-note.ok/.no`; a "didn't hear any notes" message replaces all-missed when nothing was detected.
  - Tapped keys win: if any key was tapped during the turn the old tap check runs unchanged, and with the tuner off nothing changes. New "Check my singing with the mic" button starts or stops the tuner.
  - Unverified on a real voice, and with the drone playing through a speaker (tested with a synthetic mic only) (#5).
- **Hold a note exercise in the tuner panel** ([#29](https://github.com/vishmatta/shadja/issues/29)).
  - Pick a target note (chips for the raga or scale notes, Sa by default; reset to Sa when the raga, scale or Sa changes) and a hold length of 5, 8, 12 or 20 seconds, then sing it. The attempt starts at the first voiced frame (after the existing silence and own-sound gates, so the drone can stay on), skips the first 100 ms, and compares by pitch class, so any octave counts. It ends when the hold length is reached or after 0.6 s of quiet following at least 1 s of singing; it then re-arms once the voice has been quiet.
  - Two feedback behaviours follow the tuner mode. After each note: the bar shows time sung, with no in-tune information while singing; the attempt ends at the hold length, and counts as a success if at least 80% of it was in tune. Live: the bar fills only while in tune and pauses when you drift; the attempt ends when in-tune time reaches the hold length.
  - Result: time in tune out of the hold length, average offset ("on the note" within ±5¢, else flat or sharp), steadiness, which note was held if it was another one, and one tip. It suggests the next hold length after a success but never changes it itself. Session only: not saved; Reset to defaults and stopping the tuner end it.
  - Thresholds: in tune is `TN.zone` = ±20¢ (now shared with `verdict`), steady is a standard deviation under 12¢, and quiet for 0.6 s ends an attempt. **The 12¢ steadiness threshold and the 80% After each note success share are starting guesses, still to be confirmed by Vishal** (#50, #5).
- **Settings are remembered between visits** ([#6](https://github.com/vishmatta/shadja/issues/6)).
  - Saved in one `localStorage` key, `shadja:settings` (JSON with a version field), because the origin is shared with other GitHub Pages sites. Saved: system, Sa, octave, scale or raga (the one currently chosen, as the app keeps a single slot), play order, speed, loop, strict, scale-notes-only lock, accidentals, numbering, drone style and volume, tuner feedback, mic cleanup, chosen mic, keep screen on.
  - Deliberately not saved: anything running (drone, playback, tuner, call and response), enabled-note subsets, practice subset and replay order. The app always starts stopped.
  - Every value is validated on its own, so one bad value falls back to its default and the rest are kept. All storage access is in try/catch. When every setting equals its default the key is removed.
  - Advanced has a **Reset to defaults** button: stops sound and tuner, forgets the saved key and restores the startup settings.
  - **Open:** the raga and the Western scale share one saved slot (#49); saved mic not checked on the iPhone (#5).
- **Visual redesign: the "Sandhya (dusk)" theme** ([#27](https://github.com/vishmatta/shadja/pull/27)).
  - New palette (dusk purples with a saffron Sa), in light and dark.
  - Fonts **Eczar** (display) and **Mukta** (text) replace Bricolage Grotesque.
  - The sing-along display sits on a sky gradient, and the heading carries the Devanagari षड्ज.
  - Keys for notes outside the raga are now solid and quiet instead of see-through.
  - Polish pass: contrast checked to WCAG AA in both themes, visible focus rings, and the desktop stage fits one 790 px screen again.
  - *Why:* Yaman, the first raga, is an evening raga, so the app should feel like dusk. Vishal picked direction A of three mockups.
  - **Still to confirm:** how it looks on Vishal's iPhone (#5). Desktop Play buttons sit below a 790 px window until the stage pins (#48).

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
  - **Open:** overflow on small phones and in landscape (#48).
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
