# Build Log

Where AI helped, where it was wrong, what I changed, and the numbers behind my decisions.

## Setup
- Gemini test failed with 404: `gemini-2.5-flash` is no longer available to new users. The error suggested `gemini-3.6-flash`; switched `VISION_MODEL` in `.env` and `.env.example`. Model names live in env, so no code change was needed.
- Docker CLI couldn't connect until Docker Desktop's engine was started.
- Moved the project out of OneDrive (Desktop path) to `%USERPROFILE%\projects` to avoid syncing node_modules.

## Phase 2 — Image understanding pipeline
- Vision output is validated twice: Gemini structured output (JSON schema) + Zod on our side. Invalid output throws → the job retries → after 4 attempts the image is marked failed with an ALERT log.
- The prompt tells the model to drop confidence below 0.6 for blurry/far/foggy/silhouette images; those are saved as `flagged`.
- First real test hit 503 "model experiencing high demand" on `gemini-3.6-flash`. The failed call was still logged in `ai_calls`. Switched `VISION_MODEL` to `gemini-3.5-flash-lite`, pinned to the exact version (not the `gemini-flash-lite-latest` alias) so results stay reproducible.
- The downloaded "hard" photos (hard_01–03) were still recognised with high confidence (0.85–0.95), so I generated harder test cases (hard_04–06) by degrading existing corpus images with sharp: darkness + blur, tiny + fog, silhouette (`scripts/make-hard-images.js`).
- Calling ingest twice queued 54, then 1. The extra job was for the image being processed at that moment (pg-boss `stately` policy allows one queued + one active job per key). No second AI call was made, because the worker skips images already tagged/flagged.
- Windows CMD QuickEdit paused the server when its window was clicked; disabled QuickEdit.
- Result: 54 images → 51 tagged, 3 flagged, 0 failed. All 10 foxes → "red fox", all 10 wolves → "gray wolf", dogs tagged by breed (husky, shiba inu,                                                                                


## Phase 4 — Production layer
- Review API: GET /suggestions/:id explains the decision (scores, reasons, tags); approve/reject is recorded once (UNIQUE suggestion_id), a repeat is a no-op, and a conflicting second review returns 409.
- Fixed a message typo ("rejectd") by mapping actions to past tense instead of appending "d".
- Eval: top-1 precision 12/12 = 100% on eval/labels.json (10 animal posts + 2 no-match posts).
- Limitation: thresholds were tuned on the same 12 posts and the set is small, so this number is optimistic; a held-out set of new posts would give a fairer estimate.
- GitHub push protection blocked a push because the real API key had been pasted into .env.example. The push was rejected, so the key was never public. Fixed by resetting the unpushed commits (git reset --soft origin/main), restoring the placeholder and re-committing; checked with git grep --cached "AIza".
