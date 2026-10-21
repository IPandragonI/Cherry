# Cherry 🍒

Mobile-first guitar tuner PWA with a chord library and a chord finder. Everything runs in the
browser: no backend, no account; preferences live in `localStorage`. UI in French and English.

- **Tuner** (`/`) — starts listening on its own; live pitch detection (AudioWorklet + McLeod
  Pitch Method) with median + adaptive EMA smoothing, auto/manual string mode, 11 preset
  tunings + custom tunings, adjustable A4 (415–466 Hz), four unbranded headstock models (jazz,
  open book, 6-in-line, acoustic) zoomed on the nut, three fingerboard skins, a mic on/off
  toggle with input level ring, in-tune haptics, Karplus-Strong reference tones, screen wake lock.
- **Chords** (`/chords`) — 204 chords (12 roots × 17 qualities, 724 voicings), SVG diagrams,
  voicing carousel, strum playback, favorites.
- **Finder** (`/finder`) — tap a 12-fret board, get the chord name with alternatives and
  slash chords, following the current tuning.
- **Settings** (`/settings`) — theme (system/light/dark), reference pitch, language, demo
  mode, clear local data.

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
| `pnpm icons`         | Regenerate icons + splash logo from `new.png` (the source logo)       |
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
  components/          tuner/ (Gauge, Neck, Readout, StringPills, pickers), chords/, finder/, ui/
  lib/
    audio/             pitch-worklet, engine (mic + wake lock), useTuner, Karplus-Strong, demo
    pitch/             biquad filters, PitchAnalyzer (pitchy), PitchTracker (median + stability gate)
    music/             notes/cents, tunings, chord formulas, recognizer, shape generator, chords.json
    i18n/              FR/EN dictionaries + useT()
  store/               Zustand stores: settings, custom tunings, favorites
tests/                 Vitest unit tests
e2e/                   Playwright smoke tests
scripts/               worklet bundler, chord generator, icon generator
```

The detection pipeline is pure TypeScript shared by the worklet and the tests: all input
channels summed (stereo interfaces) → high-pass 50 Hz, 50/60 Hz hum notches, low-pass 1 kHz →
level gate relative to an adaptive noise floor (works down to ~−80 dBFS desktop mics) →
McLeod Pitch Method restricted to 55 Hz–1.2 kHz (so strings ringing along can't produce a
"common period" far below the played note) on 4096-sample windows every 1024 samples →
outliers ignored unless 3 frames confirm a jump → 7-frame median → adaptive EMA in cents →
hold through short dropouts. `tests/scenarios.test.ts` covers a quiet desktop mic with hum
and a phone hearing other open strings ring along. The UI adds in-tune hysteresis (enter ≤ 3 cents, leave > 5 cents) and
eases the bubble on screen.

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
  Offline). All four routes are precached.
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
- Screen Wake Lock needs iOS 16.4+, and `navigator.vibrate` isn't supported on iOS, so the
  in-tune haptic is Android-only.
- Install from Safari's **Share → Add to Home Screen**. There is no install prompt.
