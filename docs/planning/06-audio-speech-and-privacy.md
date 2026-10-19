# 06 — Audio, Speech and Privacy

## 1. Policy summary

1. **All core MVP audio ships as bundled, reviewed files** (every instruction, hint, praise line, story line and vocabulary word, in Arabic and English, plus mixed-mode carriers). Gameplay never depends on the network or on TTS.
2. **Dynamic TTS is optional, off by default**, parent-controlled, server-proxied, allowlisted and only for content that is not core (roadmap: e.g. speaking the child's name). Its failure falls back silently to a bundled clip or to a visual cue.
3. **The microphone records for real**, only after a parent enables it and the browser grants permission; audio stays in memory and is discarded when the child leaves the activity.
4. **Speech recognition is optional, off by default, consent-gated**, and its output is never shown as a pronunciation score or as "correct".

## 2. Audio asset policy

### 2.1 Formats and loudness

| Type | Format | Encoding | Loudness target |
|------|--------|----------|-----------------|
| Voice | MP3 | mono, 44.1 kHz, 64 kbps CBR | −16 LUFS integrated, true peak ≤ −1.5 dBTP |
| SFX | MP3 | mono, 44.1 kHz, 96 kbps | −18 LUFS (short: peak-normalised to −3 dBFS) |
| Music | MP3 | stereo, 44.1 kHz, 128 kbps, seamless loop points documented | −23 LUFS (sits under voice) |

MP3 is chosen for one universal format (every target browser decodes it), so the service worker precaches one file per clip. Clips are decoded into `AudioBuffer`s, so MP3 encoder padding is trimmed by a `startOffsetMs` field in the manifest when needed.

### 2.2 Naming and layout

`public/assets/audio/<lang>/<clipId>.mp3`, e.g. `public/assets/audio/ar/af01.a2.where_dog.mp3`. Music and SFX are language-neutral: `public/assets/audio/common/`.

### 2.3 Audio manifest entry

```json
{
  "id": "af01.a2.where_dog",
  "kind": "voice",
  "files": { "ar": "assets/audio/ar/af01.a2.where_dog.mp3", "en": "assets/audio/en/af01.a2.where_dog.mp3" },
  "transcript": { "ar": "فين الكلب؟", "en": "Where is the dog?" },
  "durationMs": { "ar": 1180, "en": 1020 },
  "source": { "ar": "recorded:voice-actor-01", "en": "tts:<vendor>:<voice>" },
  "licence": "commissioned-full-rights",
  "review": { "ar": { "status": "approved", "by": "reviewer-ar-01", "date": "2026-11-02" }, "en": { "status": "approved", "by": "reviewer-en-01", "date": "2026-11-02" } },
  "pack": "pack.animal-forest"
}
```

### 2.4 Review checklist (per clip, per language)

- [ ] Transcript matches the script exactly; correct language.
- [ ] Arabic: natural Egyptian-friendly register for carrier phrases; standard pronunciation for vocabulary words (pending 12 Q4); gender-neutral wording.
- [ ] Pacing suits a 4-year-old (≈ 2–2.5 words/s); a short pause before the target word.
- [ ] Loudness within target; no clipping (true peak check), no noise, no mouth clicks, no cut-off tails.
- [ ] Warm, friendly tone; no sarcasm or scolding intonation.
- [ ] Licence recorded; if TTS-generated, the vendor's terms allow redistribution in a product.

A script (`scripts/audio/check.ts`) automates loudness/peak/duration/missing-file checks; the human checks the rest and records approval in the manifest. Release builds refuse clips without `approved` for both languages.

## 3. `AudioPlaybackService`

```ts
interface AudioPlaybackService {
  unlock(): Promise<void>;                          // call from a user gesture; resumes AudioContext
  readonly unlocked: boolean;
  preload(clipIds: AudioClipId[], lang: Lang): Promise<PreloadReport>;  // decode into buffers; reports missing
  playVoice(seq: ResolvedAudio, opts?: { interrupt?: boolean }): VoiceHandle;   // resolves when ended/stopped
  playSfx(id: AudioClipId): void;
  playMusic(id: AudioClipId, opts?: { loop: true }): void;
  stopVoice(): void;
  pauseAll(): void; resumeAll(): void;              // used by pause/background
  setVolume(channel: 'voice' | 'sfx' | 'music', v: number): void;
  setMuted(channel: 'all' | 'music' | 'sfx' | 'voice', muted: boolean): void;
  on(event: 'voiceStart' | 'voiceEnd' | 'unavailable', cb: (e) => void): Unsubscribe;
}
```

- **One `AudioContext`** shared by the app; Phaser runs with `noAudio`.
- **Unlock:** the splash Play tap calls `unlock()`. If an `AudioContext` is still suspended later (iOS after backgrounding), the next tap anywhere calls `resume()`; the ear button pulses meanwhile.
- **Concurrent-playback policy:** one voice at a time. A new voice with `interrupt: true` (default for child-initiated replays) fades the current one out in 80 ms; otherwise it is queued. SFX polyphony capped at 4 (oldest stopped). Music ducks to 30% while a voice plays (150 ms ramps).
- **Sequences** (mixed mode, counting) play clip-by-clip with a 120 ms gap and are cancellable as a unit.
- **Nono's mouth** animation is driven by `voiceStart/voiceEnd` (and a simple amplitude envelope precomputed into the manifest for lip flap).
- **Failures:** a missing or undecodable clip emits `audio.unavailable` and resolves the handle immediately, so callers continue; the activity shows its visual cue instead.

Audio state machine (per voice channel): `idle → loading → playing → (ended | stopped | failed) → idle`, with a parallel `context: locked | running | suspended | interrupted`.

## 4. `AudioAssetResolver` and `TtsProvider`

Resolution order for any spoken line:

```
1. Bundled clip for (clipId, lang)            → precached; always tried first
2. Cached synthesized clip (Cache Storage)    → only for TTS-eligible lines
3. Server-side TTS via proxy                  → only if flag ttsDynamic + parent opt-in + online + line allowlisted
4. Fallback                                   → bundled generic line (e.g. "nono.generic.lets_go"), or visual-only cue
```

```ts
interface TtsProvider {
  readonly available: boolean;                       // false for NullTtsProvider
  synthesize(req: { templateId: TtsTemplateId; params: Record<string, string>; lang: Lang }): Promise<Blob>;
}
```

TTS proxy rules (P5, only if a provider is supplied):
- Accepts **template ids and parameters only**, never free text. Example template: `greet_by_name` with `name` restricted to ≤ 20 letters from Arabic/Latin alphabets. The proxy renders text server-side.
- Provider key in server env only; never in the client bundle; no `NEXT_PUBLIC_` secrets.
- Rate limit per install id (random, rotating, not tied to the child) and a global daily cost cap; on cap, returns 429 and the client falls back.
- No logging of parameters beyond aggregate counts. Responses cached client-side by `(templateId, params, lang, voiceVersion)`.
- The child area never exposes free-form generation or a chatbot.

## 5. `MicrophoneRecorder`

```ts
interface MicrophoneRecorder {
  readonly state: MicState;
  probe(): Promise<MicSupport>;          // secure context? mediaDevices? MediaRecorder? MIME? permission state (if Permissions API)
  requestPermission(): Promise<void>;     // user-initiated only
  start(opts: { maxMs: number }): Promise<void>;
  stop(): Promise<Recording>;             // { blob, mimeType, durationMs, peakLevel, voicedMs }
  cancel(): void;                         // stops tracks, discards data
  level$: Observable<number>;             // 0..1 for the indicator
  dispose(): void;                        // must be called on unmount
}
```

Capability selection order for `MediaRecorder.isTypeSupported`: `audio/webm;codecs=opus` → `audio/mp4;codecs=mp4a.40.2` → `audio/mp4` → `audio/ogg;codecs=opus` → `''` (browser default, accepted only if `MediaRecorder` reports a mimeType after start). None → `unsupported`.

`getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })`.

### 5.1 Microphone state machine

```
                     probe()
 (init) ───────────────────────────────▶ unsupported           (no secure context / no mediaDevices / no MediaRecorder / no MIME)
   │
   ▼
 permission_unknown ──requestPermission()──▶ requesting_permission ──granted──▶ ready
   │  ▲                                         │        │
   │  └─────────────── (retry later) ───────────┘        ├──denied──▶ denied
   │                                                     └──15 s no answer──▶ timed_out
   │ (Permissions API says granted)
   └──────────────────────────────────────────────────────────────▶ ready
 ready ──start()──▶ recording ──stop() / maxMs──▶ stopping ──▶ processing ──▶ feedback ──(again)──▶ ready
                       │                            │              │
                       ├──cancel()/PAUSE/unmount──▶ cancelled ──▶ ready (tracks stopped, data discarded)
                       └──track ended / error──▶ recoverable_error ──retry──▶ ready | ──skip──▶ (activity skipped)
 denied, unsupported: terminal for this session → activity uses "say it with Nono" mode
```

Rules:
- Permission is requested only after a child tap on the mic button **and** after the parent has turned the microphone on. Before the browser prompt appears, Nono shows a picture of the prompt so a parent can help.
- The stream is opened at `start()` and **all tracks are stopped** at `stopping`, `cancelled`, `recoverable_error` and `dispose()`. A watchdog stops tracks if `stop()` doesn't resolve within 1 s.
- Recording indicator visible in every state from `recording` to `stopping`.
- `maxMs` default 5000; minimum meaningful recording 400 ms (shorter → treated as `recorded_silence` with "let's hold it a bit longer" hint, no error).
- iOS Safari: recording can lower playback volume or route audio to the earpiece while the stream is open; the stream is closed immediately after each recording to restore playback. Verified manually on device (09 §5).

## 6. `SpeechRecognitionProvider`

```ts
interface SpeechRecognitionProvider {
  readonly id: 'none' | 'web-speech' | 'vendor-x';
  supports(lang: 'ar-EG' | 'ar' | 'en-US'): SupportInfo;   // { supported, onDevice: boolean | 'unknown', sendsAudioOffDevice: boolean }
  recognize(rec: Recording, expected: string[], lang): Promise<RecognitionResult>; // { alternatives: {text, confidence?}[] } | { unavailable: reason }
}
```

- MVP default: `NullSpeechRecognitionProvider` (`id: 'none'`).
- The browser Web Speech API is **not** assumed private: in Chrome it may send audio to a server unless on-device processing is available and selected. It is treated as off-device unless the browser reports on-device processing for that language, and is consent-gated either way.
- Arabic child speech recognition is known to be weak; even when enabled, recognition only changes *which encouraging line* plays, never completion or mastery.
- Enabling requires: a configured provider in the build, the parent consent screen (vendor, what is sent, retention, deletion), and a per-profile toggle.

## 7. `SpeechFeedbackService`

Maps a `SpeechAttemptResult` to honest, encouraging feedback:

| Result | Meaning | Child feedback (example) | Evidence written |
|--------|---------|--------------------------|------------------|
| `recorded_voice_detected` | Real recording, local VAD found ≥ 300 ms of voice | Nono: "سمعتك! نسمع صوتك؟ / I heard you! Want to hear yourself?" → "hear me" button | `speech_attempt` (voiced) |
| `recorded_silence` | Real recording, no voice detected | "مش سامع كويس… نقرّب ونقول تاني؟ / I couldn't hear that… shall we come closer and try again?" | `speech_attempt` (silent) |
| `recognized_match` | Consented recognition returned one of the expected words | Same as voice detected, plus Nono's happy dance; **no** "correct" wording | `speech_attempt` (voiced, recognizerAgreed=true) |
| `recognized_no_match` | Recognition ran, no expected word | Identical to `recorded_voice_detected` | `speech_attempt` (voiced, recognizerAgreed=false) |
| `prompt_only` | Mic off/denied/unsupported | "يلا نقولها مع بعض! / Let's say it together!" then praise for trying; no claim of hearing | `speech_prompt_only` |
| `unavailable` | Recorder error mid-way | "نجرب تاني؟ / Shall we try again?" + skip | none |

Voice activity detection: an `AnalyserNode` RMS envelope on the live stream (the same feed as the level meter), threshold adaptive to the first 200 ms noise floor; computed on-device; no audio leaves memory.

Parent dashboard copy for speech: "Speaking tries: 6 (voice heard in 5)". Never "pronunciation score", "accuracy" or "correct".

## 8. Privacy and consent

| Data | Default | Where | Retention |
|------|---------|-------|-----------|
| Child voice recording | Captured only when a parent has enabled the mic | Memory (`Blob` + object URL) | Until the activity ends or the route changes; then the object URL is revoked and references dropped. Never written to IndexedDB, Cache Storage or disk |
| Speech recognition audio | Not sent | — | If enabled: sent to the named vendor per their terms, shown to the parent before consent |
| Profile | Display name (optional), age band, avatar | IndexedDB | Until deleted |
| Progress, evidence, stickers | Yes | IndexedDB | Until deleted |
| Analytics | Local event queue only | IndexedDB | Rolling 90 days; never uploaded in MVP |
| Identifiers | Random local ids | IndexedDB | No device fingerprint, no ad id |

- **Consent screen** (parent first run and `/parent/voice`): plain language; separate toggles for microphone and recognition; recognition toggle only exists when a provider is configured; consent record `{ type, granted, at, policyVersion }` stored locally; withdrawing consent takes effect immediately.
- **No training:** child voice is never used to train models. If a vendor's default terms permit training, that vendor is not used unless the setting can be contractually disabled and the parent is told.
- **Security:** CSP blocks third-party origins; `Permissions-Policy: microphone=(self)`; no third-party scripts in the app; secrets only server-side.
- **Regulatory context:** design aims to align with COPPA principles, the UK Age Appropriate Design Code, GDPR-K and Egypt's Personal Data Protection Law No. 151/2020 by collecting the minimum and keeping data on device. This is not legal advice; a legal review is needed before any data leaves the device (roadmap).

## 9. Offline behaviour

- Voice/SFX/music for all bundled levels are in the precache manifest per world pack.
- Offline + TTS line → resolver skips step 3 → fallback.
- Offline + recognition enabled → provider reports `unavailable` → feedback uses VAD only.
- Missing clip (corrupt cache) → visual cue, `audio.unavailable` logged, SW revalidates the pack on next online launch.

## 10. Acceptance (Given/When/Then)

1. Given the mic is disabled by the parent, when a speaking activity runs, then `getUserMedia` is never called and the activity completes in `prompt_only` mode.
2. Given permission granted and a fake audio stream with a 1 kHz tone, when recording 2 s, then the result is `recorded_voice_detected` and "hear me" plays a non-empty blob.
3. Given a fake silent stream, then the result is `recorded_silence` and the feedback line asks to try again.
4. Given recording in progress, when the route changes, then every track has `readyState === 'ended'` within 1 s and the object URL is revoked.
5. Given no supported MIME, then state is `unsupported` and no recording UI appears.
6. Given `ttsDynamic` off, then no request to the TTS proxy origin is made during a full playthrough (network log).
7. Given IndexedDB and Cache Storage are inspected after 10 speaking activities, then no audio blobs exist.
8. Given the voice clip for an instruction 404s, when the activity starts, then it remains completable and an `audio.unavailable` event is logged.
