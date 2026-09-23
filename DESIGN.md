\# Design — AI Image Matching Engine



\## Problem

Blog posts need the right image. Matching by filename or keyword fails ("Vulpes vulpes" never

mentions "fox"), and a wrong image (a wolf on a fox article) is worse than no image. This service

understands what is in each image, matches images to posts by meaning, and \*\*refuses\*\* a match

when it is not confident — explaining why.



\## Image metadata schema

Every vision response must match this schema (validated with Zod) or it is rejected:

```json

{

&#x20; "subject": "red fox",

&#x20; "category": "animal",

&#x20; "attributes": \["orange fur", "wild", "forest"],

&#x20; "caption": "A red fox standing in a forest",

&#x20; "confidence": 0.94

}

```

\- `category` ∈ animal, plant, landscape, object, person, other

\- `confidence` 0–1; below `CONFIDENCE\_MIN` (0.6) the image is \*\*flagged\*\*, not accepted



\## Data model (PostgreSQL)

| Table | Purpose | Key constraints / indexes |

|---|---|---|

| images | file, hash, status, AI tags | `sha256` unique (idempotent ingest), index on `status` |

| posts | slug, title, body, extracted subject/category | `slug` unique |

| embeddings | vectors for images and posts (`content`, `subject`) | unique (owner\_type, owner\_id, kind, model) |

| suggestions | ranked image per post + guard decision + reasons | unique (post\_id, image\_id), index on `post\_id` |

| reviews | human approve/reject | `suggestion\_id` unique (approving twice happens once) |

| ai\_calls | cost log, one row per AI call | index on `created\_at` (daily budget check) |



Vectors are stored as `REAL\[]`; at \~50 images cosine similarity is computed in JS (no pgvector needed).



\## Matching strategy

1\. \*\*Vision (batch job):\*\* each image → Gemini Flash → validated tags.

2\. \*\*Embeddings (batch job):\*\* image `caption + subject + attributes` and post `title + body` are

&#x20;  embedded as `content`; the image subject and the post's extracted subject as `subject`.

3\. \*\*Ranking:\*\* cosine similarity between the post's content vector and each image's content vector.

4\. \*\*Guard:\*\* every candidate passes the mismatch guard before being suggested.



\## Mismatch guard rules

A candidate is \*\*accepted\*\* only if all rules pass; every failed rule adds a human-readable reason.

1\. Image not flagged — \*"Image classification uncertain (confidence 0.42 < 0.6)"\*

2\. Category matches — \*"Category mismatch: expected animal, detected object"\*

3\. Subject similarity ≥ `SUBJECT\_THRESHOLD` — \*"Subject mismatch: expected red fox, detected gray wolf"\*

4\. Content similarity ≥ `MATCH\_THRESHOLD` — \*"Similarity 0.58 below threshold 0.70"\*



If no candidate passes → \*\*"no confident match"\*\* + reasons for the top candidates.

Thresholds are tuned from the labeled eval set, not guessed (numbers recorded in BUILDLOG.md).



\## API surface

```

GET  /health

POST /jobs/ingest-images        202 — enqueue vision + embedding jobs

POST /jobs/ingest-posts         202 — enqueue post analysis + embedding jobs

GET  /jobs/status               progress counts

GET  /images, /images/:id

GET  /posts,  /posts/:id

GET  /posts/:id/images          ranked suggestions, guard applied

POST /posts/:id/check           { imageId } — force one candidate through the guard

GET  /suggestions/:id           why it was accepted / rejected

POST /suggestions/:id/approve   idempotent

POST /suggestions/:id/reject    idempotent

GET  /costs                     per-call cost log + totals

```



\## Layers

```

routes/        HTTP: URLs + Zod validation (bad input → 400, never 500)

controllers/   request → service call → response

services/      vision, embeddings, ranking, mismatch guard, cost tracking

repositories/  all SQL

jobs/          pg-boss background workers (retries, idempotent, failure alerts)

```



\## Background jobs

pg-boss (queue stored in Postgres, no Redis). Retries with backoff, concurrency 1 to respect the

Gemini free-tier rate limit, singleton key per image/post so re-running ingest does no duplicate work.

Every AI call

