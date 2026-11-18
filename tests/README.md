# Shadja tests

Headless tests for the tuner, the hold exercise and call and response (#23). They live here, outside the app: nothing in `tests/` is loaded by the live site, and there is no build step.

## Run them
From the repo root:

```bash
cd tests && npm test
```

The suite takes about 2 minutes. It ends with `# pass N` and `# fail 0`.

## First time on a new machine
You need Node 20 or newer, Python 3 (for `python3 -m http.server`) and a Chromium that matches the pinned Playwright version.

```bash
cd tests
npm ci                              # installs the pinned playwright from package-lock.json
npx playwright install chromium     # downloads the matching Chromium (about 150 MB, once)
npm test
```

On Linux CI images, use `npx playwright install --with-deps chromium` instead. It also installs the system libraries Chromium needs.

## In CI (GitHub Actions, #56)
A job checks out the repo, sets up Node, then runs the same three steps:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
  working-directory: tests
- run: npx playwright install --with-deps chromium
  working-directory: tests
- run: npm test
  working-directory: tests
```

The tags above (`@v4`) are for reading only. #56 pins each action to a full commit SHA (with the tag in a comment, e.g. `actions/checkout@<sha> # v4`) and gives the job a read-only `GITHUB_TOKEN`; copy that, not this snippet.

Python 3 is already on GitHub's Ubuntu runners.

## How it works
- **`voices.mjs`** makes synthetic singing voices from a seed, so every run gets the same audio. Each voice is a list of held notes, rests, scoops, vibrato or a voice crack, at known offsets from Sa (C3, the app's default). `npm run voices` writes them all to `tests/.out/` as WAVs you can listen to.
- **`harness.mjs`** serves the repo with `python3 -m http.server` and launches headless Chromium with a fake mic. `--use-file-for-fake-audio-capture=<wav>%noloop` plays the voice once, starting when the app opens the mic. An init script wraps `getUserMedia` so tests can:
  - record the constraints the app asked for;
  - feed the app's real output back into the mic 60 ms late (drone bleed from a speaker);
  - sing extra audio into the mic on demand (call and response).
- Tests check what is on screen: the note history chips, the status line, the hold bar and result, and the call-and-response result. The app's code all sits inside one closure, so its internals aren't reachable. The one exception is `checkPhrase`, which is pure: `echo.test.mjs` lifts its source text out of `index.html` and runs it in Node.

| File | Covers |
|---|---|
| `tuner.test.mjs` | Held notes at known cents, legato runs, a 0.4 s note, a too-short note, a scoop, a voice crack, vibrato, quiet humming, silence, drone bleed, Live mode, Western mode, mic cleanup and mic choice (#16, #17) |
| `hold.test.mjs` | The hold exercise: steady, 40¢ flat in Live mode, wobbly (#29) |
| `echo.test.mjs` | `checkPhrase` unit cases, and one phrase sung back into the mic (#18) |

## Testing another copy of the app
`SHADJA_SITE=<dir> npm test` serves `<dir>` instead of the repo root. Use it to check that the tests catch a deliberate break, or to run the same suite before and after the module split (#61).

## When a test fails
- Run one test by name: `node --test --test-name-pattern="vibrato" tuner.test.mjs`.
- Listen to the voice: `npm run voices`, then open `tests/.out/<name>.wav`.
- Timing in headless Chromium is less steady than on a phone. If a test is flaky, make the test voice longer or clearer, not the tuner's thresholds looser.
