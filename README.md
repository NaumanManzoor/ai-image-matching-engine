\# AI Image Matching Engine – FlyRank Internship Project



Final capstone project for the \*\*FlyRank Backend AI Engineering Internship\*\*.



Blog posts need the right image. Keyword matching fails ("Vulpes vulpes" never says "fox"), and a

wrong image (a wolf on a fox article) is worse than no image. This service:



1\. \*\*Understands every image\*\* with a vision model and stores validated, structured tags.

2\. \*\*Matches images to posts by meaning\*\* using embeddings, not keywords.

3\. \*\*Refuses bad matches\*\* with a mismatch guard, and explains why in plain language.

4\. Runs all AI work as \*\*background batch jobs\*\* with retries, and \*\*logs the cost of every AI call\*\*.

5\. Lets a human \*\*approve or reject\*\* a suggestion and \*\*inspect why\*\* it was chosen.



\*\*Result:\*\* top-1 precision \*\*12/12 = 100%\*\* on the labeled eval set (see \[Evaluation](#evaluation) for the honest caveats).



\## Architecture



```

Images ─(batch job)→ Gemini vision → {subject, category, attributes, caption, confidence}

&#x20;                        │  Zod-validated; confidence < 0.6 → flagged

&#x20;                        └→ embed(content + subject) ──────────────→ image vectors ┐

&#x20;                                                                                  │

Posts ──(batch job)→ Gemini: extract {subject, category}                           │

&#x20;                        └→ embed(title + body, subject) ──────────→ post vectors  ┤

&#x20;                                                                                  │

GET /posts/:id/images                                                              │

&#x20; → cosine similarity ranking (post vector × every image vector) ←─────────────────┘

&#x20;     → top 5 candidates → Mismatch Guard (confidence + category + subject + similarity)

&#x20;         ├─ first accepted candidate → suggestion (ranked, with reasons)

&#x20;         └─ none accepted → "no confident match" + reasons

&#x20;               → Review API: inspect why / approve / reject

```



Code is layered: `routes/` (HTTP + Zod validation) → `controllers/` → `services/` (AI, ranking,

guard, costs) → `repositories/` (all SQL). Background workers live in `jobs/` (pg-boss, queue stored in Postgres).



\## The mismatch guard



A candidate image is accepted only if \*\*all four rules pass\*\*. Every failed rule adds a readable reason.



| Rule | Rejects when | Example reason |

|---|---|---|

| Confident classification | image confidence < 0.6 (flagged) | `Image classification uncertain (confidence 0.35 < 0.6)` |

| Category match | post and image categories differ | `Category mismatch: expected animal, detected object` |

| Subject match | subject similarity < 0.88 and the post's subject isn't named in the image description | `Subject mismatch: expected red fox, detected gray wolf (subject similarity 0.83 < 0.88)` |

| Content similarity | post↔image similarity < 0.73 | `Content similarity 0.71 below threshold 0.73` |



Thresholds were \*\*set from data\*\*, not guessed: `npm run similarities` prints every post↔image score,

and the chosen cut-offs sit between the right and wrong groups (numbers in \[BUILDLOG.md](BUILDLOG.md)).



A real example from this corpus: on the \*"What Vulpes vulpes Eats"\* post, the highest-scoring image was

`hard\_04.jpg`, a dark, blurred \*\*wolf\*\* that the vision model wrongly tagged as "red fox" (confidence 0.35).

The guard rejected it as uncertain and suggested a real fox photo instead. The best-scoring candidate was

wrong, and the system caught it.



\## Run it (clean machine)



Requirements: \*\*Docker Desktop\*\* and a free \*\*Gemini API key\*\* from \[aistudio.google.com](https://aistudio.google.com) (no credit card).



```bash

git clone https://github.com/NaumanManzoor/ai-image-matching-engine.git

cd ai-image-matching-engine

cp .env.example .env          # Windows CMD: copy .env.example .env

\# edit .env and set GEMINI\_API\_KEY



docker compose up --build -d                  # starts Postgres + API + background workers

docker compose exec app npm run seed          # loads 54 images + 12 blog posts

curl -X POST http://localhost:3000/jobs/ingest-images   # tag + embed all images (batch job)

curl -X POST http://localhost:3000/jobs/ingest-posts    # analyze + embed all posts (batch job)

curl http://localhost:3000/jobs/status        # wait until pending = 0 and embedded = {image: 54, post: 12}

```



The batch jobs take about \*\*10 minutes\*\*, because they are deliberately rate-limited to stay inside the Gemini

free tier. If a call hits a rate limit, the job retries with backoff; re-running an ingest call only

queues what is still missing.



Then try it:



```bash

curl http://localhost:3000/posts/1/images                     # fox post → a fox image

curl -X POST http://localhost:3000/posts/1/check \\

&#x20;    -H "Content-Type: application/json" -d '{"filename": "wolf\_01.jpg"}'   # → REJECTED + reason

curl http://localhost:3000/posts/11/images                    # goldfish post → "no confident match"

docker compose exec app npm run eval                          # → Top-1 precision

curl http://localhost:3000/costs                              # per-call cost log

```



\## API



| Method | Path | Purpose |

|---|---|---|

| GET | `/health` | API + database status |

| POST | `/jobs/ingest-images` | Enqueue tagging + embedding for images (202) |

| POST | `/jobs/ingest-posts` | Enqueue analysis + embedding for posts (202) |

| GET | `/jobs/status` | Progress counts |

| GET | `/images`, `/images/:id` | Images with their AI tags |

| GET | `/posts`, `/posts/:id` | Posts with extracted subject/category |

| POST | `/posts` | Create a post `{slug, title, body}`; it is processed in the background |

| GET | `/posts/:id/images` | Ranked suggestions with the guard applied |

| POST | `/posts/:id/check` | Force one candidate through the guard: `{imageId}` or `{filename}` |

| GET | `/suggestions/:id` | Why a suggestion was accepted or rejected |

| POST | `/suggestions/:id/approve` | Human approval (idempotent), optional `{note}` |

| POST | `/suggestions/:id/reject` | Human rejection (idempotent), optional `{note}` |

| GET | `/costs` | Per-call AI cost log with totals |



Bad input returns a clean \*\*400\*\* with field-level details; unknown IDs return \*\*404\*\*; never a 500.



\## Evaluation



`eval/labels.json` holds 12 hand-labeled posts: 10 animal posts (correct = an image of the right animal)

and 2 posts with no suitable image (correct = "no confident match").



```

docker compose exec app npm run eval

Top-1 precision: 12/12 = 100.0%

```



\*\*Caveat:\*\* the thresholds were tuned on these same 12 posts, and 12 is a small set, so this number is

optimistic. A held-out set of new posts would give a fairer estimate.



\## Production concerns



\- \*\*Never trust model output:\*\* Gemini structured output (JSON schema) + Zod validation; invalid output is retried, never saved.

\- \*\*Background jobs:\*\* pg-boss queues with 3 retries and exponential backoff; permanent failures log an `ALERT` line and mark the item `failed`.

\- \*\*Idempotency:\*\* unique keys on image hash, post slug, embeddings, suggestions and reviews; jobs use a singleton key and skip work already done. Approving twice records one review.

\- \*\*Cost control:\*\* every AI call writes one `ai\_calls` row (tokens + equivalent cost); a daily call budget refuses calls once exceeded. Actual spend: \*\*$0\*\* on the free tier.

\- \*\*Secrets:\*\* the API key lives only in `.env` (git-ignored); `.env.example` has placeholders.



\## Project structure



```

src/

&#x20; routes/        HTTP routes + Zod request validation

&#x20; controllers/   request → service → response

&#x20; services/      vision, post analysis, embeddings, ranking, mismatch guard, matching, costs

&#x20; repositories/  all SQL

&#x20; jobs/          pg-boss workers: tag-image, embed-image, process-post

&#x20; db/            connection pool + migration runner

migrations/      SQL schema (tables, unique constraints, indexes)

scripts/         seed, eval, threshold tuning, corpus tools

corpus/          54 images (Unsplash, resized to 512px), see corpus/CREDITS.md

eval/            labeled evaluation set

```



\## Limitations



\- \*\*Small eval set\*\* (12 posts) used for both tuning and evaluation, so precision is optimistic.

\- \*\*Narrow corpus:\*\* 54 images of five animals. Categories beyond these (plants, landscapes) are supported by the schema but untested.

\- \*\*Vision model mistakes:\*\* the model can be confidently wrong on unusual photos; the guard only catches mistakes that show up as low confidence or mismatched subjects.

\- \*\*Free-tier rate limits\*\* make a full ingest take about 10 minutes, and heavy use can hit 429 errors (handled by retries).

\- \*\*Brute-force similarity:\*\* vectors are compared in memory, which is fine for \~50 images; a larger corpus would need a vector index (e.g. pgvector).

\- \*\*Estimated embedding tokens:\*\* the Gemini API returns no token counts for embeddings, so their cost is estimated at \~4 characters per token.

\- \*\*No UI:\*\* the review workflow is API-only, as allowed by the brief.



\## Documents



\- \[DESIGN.md](DESIGN.md): one-page design (schema, data model, guard rules, API)

\- \[EVIDENCE.md](EVIDENCE.md): one real proof per requirement

\- \[BUILDLOG.md](BUILDLOG.md): where AI helped, where it was wrong, what I changed

\- \[capstone.yaml](capstone.yaml): run/seed/test commands and probes for the evaluator



\## Tech stack



Node.js · Express · PostgreSQL · pg-boss · Zod · Google Gemini (`gemini-3.5-flash-lite`, `gemini-embedding-001`) · sharp · Docker Compose



\## License



MIT, see \[LICENSE](LICENSE).

