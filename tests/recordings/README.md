# Real recordings

WAV files saved with **Settings → Diagnostic audio → Record** go here. Name each file
after the in-tune note that was played, e.g. `E2.wav`, `A2-acoustic.wav`, `E4-iphone.wav`.
`tests/recordings.test.ts` replays every file and checks that it reads in tune
(mean within ±2 cents of the note at A4 = 440 Hz).
