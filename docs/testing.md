# Testing conventions

## Module tests vs. adapter tests

Every JSON-contract stateless module (`coding-standards.md`) gets tested at two separate levels,
deliberately not blended:

- **Module tests** (`packages/<name>/src/*.spec.ts`) — plain fixtures in, asserted output out. No
  DB mock, no queue mock, no `jest.mock()` of any kind for modules with zero external dependencies
  (`packages/editing-rhythm`, `packages/emoji-suggester`, `packages/fusion-engine`'s own scoring
  math). For modules with an injected `deps` (subprocess, LLM client), the test fakes `deps`
  directly (e.g. `deps.execFile`, `deps.openai`) — never `jest.mock()`s the underlying module the
  dependency wraps. This is the concrete payoff of dependency injection here: testability without
  mocking machinery.
- **Adapter tests** (`apps/worker/src/workers/*.worker.spec.ts`) — mock the *module* itself (e.g.
  `jest.mock('@speedora/facial-intelligence', ...)`), assert only orchestration: was the module
  called with the right narrowed input, was the result persisted in the right shape, did a
  detector failure get caught without failing the job, did the right queue get enqueued next.
  Pure/synchronous derive functions (`deriveEditingRhythmFeatures`, `computeSpeakingRate`,
  cutlist's merge functions) are deliberately **left real** (`jest.requireActual`) even inside
  adapter tests — they're pure enough that re-mocking them would just hide a real integration bug.

This split means a module's own logic never needs re-testing from inside a worker spec file, and a
worker spec never needs to re-derive a module's internal math to build its expected fixtures — it
computes real values by hand (or runs the real function once to get them) and pins them.

## Stale-fixture risk when adding a new Fusion Engine signal

Every `render-clip.worker.spec.ts` test that asserts an exact `prisma.clip.update()` payload (not
`expect.objectContaining`) must be updated whenever a new Fusion Engine signal/feature is added,
even in tests that don't otherwise touch that signal — the `highlightBreakdown` array and the
persisted `data` object both grow a new key/entries for *every* signal, including weight-0 ones,
on every render. This has caused real, repeatedly-recurring stale-test failures across the AI
Fusion roadmap (most recently: 6 tests broke when the `editingRhythm` signal was wired in, because
several exact-equality fixtures weren't updated at the same time as the feature). When adding a
new signal, grep `render-clip.worker.spec.ts` for every exact `data: {...}` / `highlightBreakdown:
[...]` block, not just the tests that were written to exercise the new signal directly.

## "Verified against real Postgres" pattern

Every new Prisma migration/column in this project has been verified with a real round-trip against
a dev Postgres instance (create → read → clear to `Prisma.JsonNull` where applicable → cascade-
delete) via a one-off script, run once and then deleted — not just written and assumed correct.
This is separate from and in addition to the unit test suite; unit tests mock Prisma, this
verification step doesn't.

## Known, honestly-documented verification gaps

Every module that shells out to `ffmpeg` (stderr parsing: `astats`, `showinfo`, `blackdetect`,
`signalstats`/`metadata=print`) or to a Python subprocess (MediaPipe, pyannote, transformers,
OpenCV, Tesseract) has, at various points in this project's history, only been testable against
**hand-written fixtures** — the development sandbox has not always had real `ffmpeg`/Python/model
binaries available. This is called out explicitly in each module's own documentation
(`ai/vision.md`, `ai/audio.md`, `ai/ocr.md`) rather than silently assumed correct. Where a real
end-to-end run *has* happened (many modules have, once real binaries/API keys became available in
a session — real TTS-generated test audio for diarization/vocal-emotion, a real Pexels/Pixabay/
Unsplash API key for B-roll, a real Playwright browser session for the OCR Review UI), that's noted
in the relevant doc as a verified path, not assumed from the unverified ones. Treat "unit tests
pass" and "verified against the real external system" as two separate claims — this codebase does
not conflate them, and neither should changes to it.

## Full-monorepo verification

Because `packages/shared` types (and, more subtly, `packages/contracts` Zod schemas feeding
`packages/fusion-engine`) are consumed transitively by every app, always run the **full** monorepo
build and test suite (`pnpm -r build`, `pnpm -r test`) after a shared-type change — not just the
app you meant to touch. See `coding-standards.md`'s TS2742 and `apps/web` exhaustive-map gotchas,
both of which are specifically the kind of failure that only shows up in a package/app you didn't
directly edit.
