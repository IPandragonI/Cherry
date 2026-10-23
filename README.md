# Cherry 🍒

Mobile-first guitar tuner PWA with a chord library and a chord finder. Everything runs in the
browser: no backend, no account; preferences live in `localStorage`. UI in French and English.

- **Tuner** (`/`) — explains the microphone on first visit, then listens on its own; live
  pitch detection (AudioWorklet + McLeod Pitch Method + phase-vocoder partials) that follows
  a turning peg in real time; auto / manual / chromatic modes; 19 presets for guitar (6, 7,
  8 strings), bass (4, 5 strings) and ukulele, custom tunings with per-string cent offsets;
  adjustable A4 (415–466 Hz, to 0.1 Hz); needle or strobe display; four unbranded headstock
  models zoomed on the nut, three fingerboard skins; a tick on each string once in tune;
  a mic on/off toggle with input level ring; Karplus-Strong reference tones and a sustained
  reference drone; in-tune haptics and chime; screen wake lock.
- **Chords** (`/chords`) — 204 chords (12 roots × 17 qualities, 724 voicings), SVG diagrams,
  root and type chosen side by side from two menus, voicing carousel, strum playback,
  favorites.
- **Finder** (`/finder`) — tap a 12-fret board, get the chord name with alternatives and
  slash chords, following the current tuning.
- **Metronome** (`/metronome`) — 30–250 BPM, tap tempo, 2–6 beats per bar with accented
  downbeat, clicks scheduled on the audio clock from a worker timer (keeps time in a
  background tab), visual beat.
- **Settings** (`/settings`) — theme, reference pitch, interface language, note notation
  (letters / solfège), deviation display (needle / strobe), microphone choice and
  sensitivity, precise mode, left-handed mode, in-tune chime, demo mode, audio diagnostic
  with WAV recorder, credits (`/settings/credits`), clear local data. Settings are validated
  when loaded and stay in sync across tabs.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 + daisyUI v5 (custom
`cherry` / `cherry-dark` themes in `src/app/globals.css`) · Zustand (`persist`) · Serwist
(`@serwist/turbopack`) · pitchy · Vitest · Playwright · ESLint + Prettier.

## Getting started

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

| Script               | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `pnpm dev` / `build` | Run Next (`next.config.ts` bundles the audio worklet on every start)  |
| `pnpm start`         | Serve the production build                                            |
| `pnpm check`         | Lint + type-check + unit tests                                        |
| `pnpm test`          | Vitest: note/cents math, pitch detection on synthetic signals, chords |
| `pnpm test:e2e`      | Playwright tests (needs `pnpm build`; serves it on port 3100)         |
| `pnpm chords`        | Regenerate `src/lib/music/chords.json` from the shape templates       |
| `pnpm icons`         | Regenerate the icons and logo from `new.png` (the source logo)        |
| `pnpm format`        | Prettier                                                              |

First Playwright run: `pnpm exec playwright install chromium`. The `desktop-mic` project
feeds desktop Chromium a generated stereo WAV (guitar on the right channel only) as a fake
microphone, as a regression test for desktop audio interfaces.

### Developing without a microphone

Turn on **Settings → Demo mode**. The tuner then simulates the selected string with a
deviation slider and an "auto sweep" that swings into tune, which is handy for UI work and
screenshots.

## Project layout

```
src/
  app/                 root layout (fonts, pre-hydration theme script), manifest, sw.ts
    (tabs)/            tuner page + chords/ finder/ settings/ with the shared tab bar
    serwist/[path]/    route that builds and serves the service worker
  components/          tuner/ (Gauge, Strobe, Neck, Readout, pickers), chords/, finder/, settings/, ui/
  lib/
    audio/             pitch-worklet, pitch-worker, engine (mic), output (shared playback
                       context), tonePlayer, metronome, screenAwake, useTuner, Karplus-Strong, demo
    pitch/             biquad filters, PitchAnalyzer, partials (phase vocoder), PitchTracker,
                       range (band per tuning)
    music/             notes/cents, tunings, chord formulas, recognizer, shape generator, chords.json
    i18n/              FR/EN dictionaries + useT()
  store/               Zustand stores: settings, custom tunings, favorites
tests/                 Vitest unit tests
e2e/                   Playwright smoke tests
scripts/               worklet bundler, chord generator, icon generator
```

Audio runs on three threads: the AudioWorklet only mixes the input channels and forwards
samples; a Web Worker (`src/lib/audio/pitch-worker.ts`) runs the analysis; the page only
draws. The analysis is pure TypeScript shared by the worker and the tests:

1. High-pass 50 Hz, 50/60 Hz hum notches, low-pass 1 kHz; level gate relative to an
   adaptive noise floor (works down to ~−80 dBFS desktop mics); ~85 ms skipped after each
   pluck. The band follows the tuning (`src/lib/pitch/range.ts`): a bass widens it down to
   ~28 Hz with the high-pass moved under its low B.
2. **Which note:** McLeod Pitch Method restricted to 55 Hz–1.2 kHz (4096-sample windows,
   every 1024 samples; the worklet forwards 256-sample chunks).
3. **Exact frequency:** each of the first harmonics is measured in an 8192-point spectrum
   from its phase advance over up to 170 ms (phase vocoder); harmonics that disagree fade
   out of the estimate. The value shown is the **perceived pitch**: led by the 2nd to 4th
   harmonics, as the ear's is, rather than by the fundamental, which an acoustic guitar's
   body pulls a few cents flat. Nothing is shown when no harmonic consensus confirms the
   pitch. Until that spectrum is clear of the previous note (~230 ms after a pluck), the
   same measurement runs on the 4096-point spectrum of the period window, so a reading
   appears ~160 ms after the pluck; the precise value then replaces it at once.
4. Tracker: outliers ignored unless 3 frames confirm a jump, 7-frame median, EMA that speeds up when the pitch moves steadily;
   a note is only shown shortly after a pluck (or sound rising out of silence), and its
   value freezes once it has decayed by ~18 dB, so the quiet tail and strings ringing
   along never move the gauge.
5. **Turning a peg:** the precise value averages ~170 ms, so on its own it trails a moving
   string by that much. The same partials are also measured over two hops of phase in the
   short spectrum (noisier, ~55 ms behind); a least-squares line through the last five
   such values tells a real move (steady slope, well above its own scatter) from noise.
   During a move the display follows that line, projected two frames ahead, then hands
   back to the precise value once the pitch has rested. Measured on synthetic peg turns
   (`tests/glide.test.ts`): ≤4 cents behind at 120 cents/s, ≤2 at 40 cents/s, ≤3 cents of
   overshoot when the peg stops; with a noisy signal it falls back on the steady reading.
6. Display: the last value stays on screen for 4 s after the note fades, and changes under
   1 cent are not shown (`src/lib/audio/readingHold.ts`); the needle glides with a 25 ms
   spring.

By default the gauge number is in tenths of the cents (−10 cents shows −1, like popular tuner apps) up to ±100, on a logarithmic scale compressed around the centre (−1 sits 4 % of the way to the edge, ±100 at the edge) and a string is in tune within ±8 cents (left beyond ±10); **Settings → Precise mode** shows cents and is in tune within ±3 (left beyond ±5). Accuracy tests:
`tests/calibration.test.ts`, `tests/accuracy.test.ts`, `tests/acoustic.test.ts` (an
in-tune acoustic guitar on all six strings), `tests/scenarios.test.ts`. Real recordings
saved with **Settings → Diagnostic audio → Record** can be dropped in `tests/recordings/`
(named after the note, e.g. `E2.wav`) and are replayed by `tests/recordings.test.ts`.

## Deploy to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project**, import the repo. The defaults work: framework Next.js,
   install command `pnpm install`, build command `pnpm build` (which bundles the worklet).
3. Deploy. Each deploy's commit SHA (`VERCEL_GIT_COMMIT_SHA`) versions the precached pages,
   so installed apps pick up the new version on their next launch.

CLI alternative: `pnpm dlx vercel` (preview) / `pnpm dlx vercel --prod`.

## Testing the PWA

- The service worker is **disabled in `pnpm dev`**. Test offline behaviour with
  `pnpm build && pnpm start`, open the app once, then go offline (DevTools → Network →
  Offline). Every route is precached. A new deploy waits until the user taps **Update** in
  the prompt that appears, instead of taking over open pages.
- The microphone and service worker need a **secure context**: `localhost` works; on a
  phone use the Vercel deployment or an HTTPS tunnel (e.g.
  `cloudflared tunnel --url http://localhost:3000`). Plain `http://192.168.x.x` will show the
  "HTTPS required" state.
- Chrome/Android: the install prompt appears from the address bar menu. Lighthouse's PWA
  checks can be run against `pnpm start`.

### iOS Safari caveats

- The tuner requests the microphone as soon as it opens, then creates the AudioContext while
  capture is active, which Safari and Chrome allow without a tap. If a browser still keeps
  audio paused (Firefox does until the first interaction), the tuner shows **Tap to start
  listening**, and any tap or key press on the page resumes it.
- The microphone permission is asked again after each reload in Safari, and in a
  home-screen web app it may be asked on each launch.
- Safari suspends audio when the app goes to the background. Cherry resumes the context when
  it becomes visible again, but you may need to tap Start again after a phone call.
- The screen stays on while the tuner is shown: Screen Wake Lock, re-taken whenever the OS
  drops it, plus a silent looping video (NoSleep.js technique) in home-screen apps, where
  iOS before 18.4 ignores the wake lock. Low Power Mode can still let the screen sleep.
- `navigator.vibrate` isn't supported on iOS, so the in-tune haptic is Android-only.
- Install from Safari's **Share → Add to Home Screen**. There is no install prompt.
