# Evidence

Each section proves one requirement from Section 6 of the capstone brief.
All outputs below are real responses from the running service.

## AI processing

### 1. Vision output is validated against a schema; invalid responses are never trusted
Every Gemini response is parsed and checked with the Zod schema in `src/services/tagSchema.js`
(enforced in `src/services/visionService.js`). Output that fails validation throws an error,
the job retries, and it is never saved.

`npm run tag-one -- fox_01.jpg`:
```json
{
  "tags": {
    "subject": "red fox",
    "category": "animal",
    "attributes": ["red fur", "covered in snow", "close-up shot", "alert expression", "winter setting"],
    "caption": "A close-up portrait of a red fox with snow sprinkled on its face and fur during winter.",
    "confidence": 0.98
  },
  "flagged": false
}
```

### 2. Low-confidence classifications are flagged instead of accepted
`hard_04.jpg` is `wolf_05.jpg` made dark and heavily blurred. The model guessed **"red fox"** (wrong)
with confidence 0.4. Because 0.4 < `CONFIDENCE_MIN` (0.6), it was **flagged**, not trusted.

`npm run tag-one -- hard_04.jpg`:
```json
{
  "tags": {
    "subject": "red fox",
    "category": "animal",
    "attributes": ["blurry", "dark", "outdoor", "wildlife"],
    "caption": "An extremely blurry image of a red fox in the dark.",
    "confidence": 0.4
  },
  "flagged": true
}
```

### 3. Images are processed through a batch background job with retries
pg-boss queue `tag-image` (`src/jobs/tagImageJob.js`): retryLimit 3 with exponential backoff,
one image at a time, idempotent (singletonKey per image + the worker skips images already tagged).

`POST /jobs/ingest-images` called twice:
```
{"message":"Image tagging jobs enqueued","queued":54,"alreadyQueuedOrDone":0}
{"message":"Image tagging jobs enqueued","queued":1,"alreadyQueuedOrDone":52}
```
The 1 extra job was for the image being processed at that moment; the worker skipped it,
so no duplicate AI call was made.

Worker log (excerpt):
```
[tag-image] #29 fox_01.jpg -> red fox (0.98)
[tag-image] #42 wolf_01.jpg -> gray wolf (0.95)
[tag-image] #25 dog_07.jpg -> shiba inu (0.98)
[tag-image] #195 hard_04.jpg -> red fox (0.35) FLAGGED
[tag-image] #196 hard_05.jpg -> red fox (0.45) FLAGGED
[tag-image] #197 hard_06.jpg -> samoyed (0.55) FLAGGED
```
Final job status and the per-call cost log are in sections 8 and 9 at the end of this file.

## Matching system

### 4. Posts return ranked image suggestions: the fox post ranks a fox first
`GET /posts/1/images` ("The Behavior of Red Foxes"): all top 5 are red fox images; `fox_06.jpg` is suggested.
```json
{
  "post": {
    "id": 1,
    "slug": "red-fox-behavior",
    "title": "The Behavior of Red Foxes",
    "subject": "red fox",
    "category": "animal"
  },
  "result": "match",
  "suggestion": {
    "rank": 1,
    "imageId": 34,
    "filename": "fox_06.jpg",
    "subject": "red fox",
    "caption": "A close-up portrait of a red fox with bright orange fur and alert eyes against a snowy background.",
    "confidence": 0.99,
    "similarity": 0.86,
    "subjectSimilarity": 1,
    "decision": "accepted",
    "reasons": [],
    "passed": [
      "Confident classification (0.99)",
      "Category matches (animal)",
      "Subject \"red fox\" appears in the image description",
      "Content similarity 0.86 >= 0.73"
    ],
    "suggestionId": 1
  },
  "reasons": [],
  "candidates": [
    {
      "rank": 1,
      "imageId": 34,
      "filename": "fox_06.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox with bright orange fur and alert eyes against a snowy background.",
      "confidence": 0.99,
      "similarity": 0.86,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.99)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.86 >= 0.73"
      ],
      "suggestionId": 1
    },
    {
      "rank": 2,
      "imageId": 37,
      "filename": "fox_09.jpg",
      "subject": "red fox",
      "caption": "A red fox sits attentively in the snow among bare branches during daylight.",
      "confidence": 0.98,
      "similarity": 0.857,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.86 >= 0.73"
      ],
      "suggestionId": 2
    },
    {
      "rank": 3,
      "imageId": 29,
      "filename": "fox_01.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox with snow sprinkled on its face and fur during winter.",
      "confidence": 0.98,
      "similarity": 0.848,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.85 >= 0.73"
      ],
      "suggestionId": 3
    },
    {
      "rank": 4,
      "imageId": 31,
      "filename": "fox_03.jpg",
      "subject": "red fox",
      "caption": "A red fox with snow dusting its fur looks attentively ahead in a winter landscape.",
      "confidence": 0.99,
      "similarity": 0.848,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.99)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.85 >= 0.73"
      ],
      "suggestionId": 4
    },
    {
      "rank": 5,
      "imageId": 38,
      "filename": "fox_10.jpg",
      "subject": "red fox",
      "caption": "A red fox sits alertly in a snowy forest amidst thin bare trees.",
      "confidence": 0.98,
      "similarity": 0.845,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.85 >= 0.73"
      ],
      "suggestionId": 5
    }
  ],
  "thresholds": {
    "MATCH_THRESHOLD": 0.73,
    "SUBJECT_THRESHOLD": 0.88,
    "CONFIDENCE_MIN": 0.6
  }
}
```

### 5. Semantic matching works for equivalent concepts: "Vulpes vulpes" matches red fox
`GET /posts/2/images` ("What Vulpes vulpes Eats"): the post never says "fox", yet red fox images rank highest.
Rank 1 is `hard_04.jpg`, a blurry wolf the model mis-tagged as "red fox" (confidence 0.35). The guard
**rejects** it as uncertain and suggests `fox_07.jpg` instead: the best-scoring candidate was wrong,
and the guard caught it.
```json
{
  "post": {
    "id": 2,
    "slug": "vulpes-vulpes-diet",
    "title": "What Vulpes vulpes Eats",
    "subject": "red fox",
    "category": "animal"
  },
  "result": "match",
  "suggestion": {
    "rank": 2,
    "imageId": 35,
    "filename": "fox_07.jpg",
    "subject": "red fox",
    "caption": "A close-up portrait of a red fox showcasing its striking amber eyes and detailed facial features.",
    "confidence": 0.98,
    "similarity": 0.795,
    "subjectSimilarity": 1,
    "decision": "accepted",
    "reasons": [],
    "passed": [
      "Confident classification (0.98)",
      "Category matches (animal)",
      "Subject \"red fox\" appears in the image description",
      "Content similarity 0.79 >= 0.73"
    ],
    "suggestionId": 12
  },
  "reasons": [],
  "candidates": [
    {
      "rank": 1,
      "imageId": 195,
      "filename": "hard_04.jpg",
      "subject": "red fox",
      "caption": "A blurry and dark image of a red fox in the wild.",
      "confidence": 0.35,
      "similarity": 0.797,
      "subjectSimilarity": 1,
      "decision": "rejected",
      "reasons": [
        "Image classification uncertain (confidence 0.35 < 0.6)"
      ],
      "passed": [
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.8 >= 0.73"
      ],
      "suggestionId": 11
    },
    {
      "rank": 2,
      "imageId": 35,
      "filename": "fox_07.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox showcasing its striking amber eyes and detailed facial features.",
      "confidence": 0.98,
      "similarity": 0.795,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.79 >= 0.73"
      ],
      "suggestionId": 12
    },
    {
      "rank": 3,
      "imageId": 34,
      "filename": "fox_06.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox with bright orange fur and alert eyes against a snowy background.",
      "confidence": 0.99,
      "similarity": 0.794,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.99)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.79 >= 0.73"
      ],
      "suggestionId": 13
    },
    {
      "rank": 4,
      "imageId": 29,
      "filename": "fox_01.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox with snow sprinkled on its face and fur during winter.",
      "confidence": 0.98,
      "similarity": 0.792,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.79 >= 0.73"
      ],
      "suggestionId": 14
    },
    {
      "rank": 5,
      "imageId": 37,
      "filename": "fox_09.jpg",
      "subject": "red fox",
      "caption": "A red fox sits attentively in the snow among bare branches during daylight.",
      "confidence": 0.98,
      "similarity": 0.791,
      "subjectSimilarity": 1,
      "decision": "accepted",
      "reasons": [],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)",
        "Subject \"red fox\" appears in the image description",
        "Content similarity 0.79 >= 0.73"
      ],
      "suggestionId": 15
    }
  ],
  "thresholds": {
    "MATCH_THRESHOLD": 0.73,
    "SUBJECT_THRESHOLD": 0.88,
    "CONFIDENCE_MIN": 0.6
  }
}
```

## Safety layer

### 6. The mismatch guard rejects the wolf on the fox post, with a human-readable reason
`POST /posts/1/check` with `{"imageId": 42}` (`wolf_01.jpg`): content similarity passes (0.77), but the
subject rule fails, so the wolf is **REJECTED**.
```json
{
  "post": {
    "id": 1,
    "title": "The Behavior of Red Foxes",
    "subject": "red fox",
    "category": "animal"
  },
  "candidate": {
    "imageId": 42,
    "filename": "wolf_01.jpg",
    "subject": "gray wolf",
    "caption": "A gray wolf stands alert near a tree in a forest setting.",
    "confidence": 0.95,
    "similarity": 0.773,
    "subjectSimilarity": 0.831,
    "decision": "rejected",
    "reasons": [
      "Subject mismatch: expected red fox, detected gray wolf (subject similarity 0.83 < 0.88)"
    ],
    "passed": [
      "Confident classification (0.95)",
      "Category matches (animal)",
      "Content similarity 0.77 >= 0.73"
    ]
  },
  "result": "REJECTED"
}
```

### 7. When no image clears the bar, the answer is "no confident match" with reasons
`GET /posts/11/images` ("Caring for Pet Goldfish"): there is no goldfish in the corpus, so every candidate is
rejected and the reasons are listed.
```json
{
  "post": {
    "id": 11,
    "slug": "pet-goldfish-care",
    "title": "Caring for Pet Goldfish",
    "subject": "goldfish",
    "category": "animal"
  },
  "result": "no confident match",
  "suggestion": null,
  "reasons": [
    "dog_01.jpg: Subject mismatch: expected goldfish, detected golden retriever (subject similarity 0.85 < 0.88); Content similarity 0.71 below threshold 0.73",
    "dog_09.jpg: Subject mismatch: expected goldfish, detected pug (subject similarity 0.82 < 0.88); Content similarity 0.71 below threshold 0.73",
    "fox_01.jpg: Subject mismatch: expected goldfish, detected red fox (subject similarity 0.8 < 0.88); Content similarity 0.7 below threshold 0.73"
  ],
  "candidates": [
    {
      "rank": 1,
      "imageId": 19,
      "filename": "dog_01.jpg",
      "subject": "golden retriever",
      "caption": "A cute golden retriever puppy sits outdoors with a yellow flower in its mouth.",
      "confidence": 0.98,
      "similarity": 0.707,
      "subjectSimilarity": 0.85,
      "decision": "rejected",
      "reasons": [
        "Subject mismatch: expected goldfish, detected golden retriever (subject similarity 0.85 < 0.88)",
        "Content similarity 0.71 below threshold 0.73"
      ],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)"
      ],
      "suggestionId": 6
    },
    {
      "rank": 2,
      "imageId": 27,
      "filename": "dog_09.jpg",
      "subject": "pug",
      "caption": "A close-up portrait of a black pug wearing a denim jacket against a plain background.",
      "confidence": 0.98,
      "similarity": 0.706,
      "subjectSimilarity": 0.824,
      "decision": "rejected",
      "reasons": [
        "Subject mismatch: expected goldfish, detected pug (subject similarity 0.82 < 0.88)",
        "Content similarity 0.71 below threshold 0.73"
      ],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)"
      ],
      "suggestionId": 7
    },
    {
      "rank": 3,
      "imageId": 29,
      "filename": "fox_01.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox with snow sprinkled on its face and fur during winter.",
      "confidence": 0.98,
      "similarity": 0.704,
      "subjectSimilarity": 0.8,
      "decision": "rejected",
      "reasons": [
        "Subject mismatch: expected goldfish, detected red fox (subject similarity 0.8 < 0.88)",
        "Content similarity 0.7 below threshold 0.73"
      ],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)"
      ],
      "suggestionId": 8
    },
    {
      "rank": 4,
      "imageId": 35,
      "filename": "fox_07.jpg",
      "subject": "red fox",
      "caption": "A close-up portrait of a red fox showcasing its striking amber eyes and detailed facial features.",
      "confidence": 0.98,
      "similarity": 0.703,
      "subjectSimilarity": 0.8,
      "decision": "rejected",
      "reasons": [
        "Subject mismatch: expected goldfish, detected red fox (subject similarity 0.8 < 0.88)",
        "Content similarity 0.7 below threshold 0.73"
      ],
      "passed": [
        "Confident classification (0.98)",
        "Category matches (animal)"
      ],
      "suggestionId": 9
    },
    {
      "rank": 5,
      "imageId": 26,
      "filename": "dog_08.jpg",
      "subject": "husky",
      "caption": "A brown and white husky with striking blue eyes sits facing slightly away from the camera against a dark background.",
      "confidence": 0.99,
      "similarity": 0.702,
      "subjectSimilarity": 0.798,
      "decision": "rejected",
      "reasons": [
        "Subject mismatch: expected goldfish, detected husky (subject similarity 0.8 < 0.88)",
        "Content similarity 0.7 below threshold 0.73"
      ],
      "passed": [
        "Confident classification (0.99)",
        "Category matches (animal)"
      ],
      "suggestionId": 10
    }
  ],
  "thresholds": {
    "MATCH_THRESHOLD": 0.73,
    "SUBJECT_THRESHOLD": 0.88,
    "CONFIDENCE_MIN": 0.6
  }
}
```

## Live system state

### 8. All images tagged by the batch job (GET /jobs/status)
```json
{"images":{"pending":0,"tagged":51,"flagged":3,"failed":0,"total":54},"posts":{"pending":0,"analyzed":12,"failed":0},"embedded":{"image":54,"post":12}}
```

### 9. Vision and embedding costs are tracked per call (GET /costs)
One row per AI call. cost_usd is the equivalent paid-tier price; actual spend is $0 on the free tier. ```json
One row per AI call. cost_usd is the equivalent paid-tier price; actual spend is $0 on the free tier.
```json
{"note":"cost_usd is the equivalent paid-tier price; actual spend is $0 on the free tier","total":{"calls":225,"failed":88,"input_tokens":79752,"output_tokens":5668,"cost_usd":0.0375499},"byKind":[{"kind":"analyze","calls":12,"succeeded":12,"failed":0,"input_tokens":2172,"output_tokens":239,"cost_usd":0.0012491},{"kind":"embed","calls":152,"succeeded":66,"failed":86,"input_tokens":3638,"output_tokens":0,"cost_usd":0.0005457},{"kind":"vision","calls":61,"succeeded":59,"failed":2,"input_tokens":73942,"output_tokens":5429,"cost_usd":0.0357551}],"calls":[{"id":225,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":24,"input_tokens":43,"output_tokens":0,"cost_usd":0.00000645,"status":"success","error":null,"created_at":"2026-09-23T13:22:05.810Z"},{"id":224,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":23,"input_tokens":54,"output_tokens":0,"cost_usd":0.0000081,"status":"success","error":null,"created_at":"2026-09-23T13:21:58.932Z"},{"id":223,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":22,"input_tokens":62,"output_tokens":0,"cost_usd":0.0000093,"status":"success","error":null,"created_at":"2026-09-23T13:21:52.017Z"},{"id":222,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":10,"input_tokens":42,"output_tokens":0,"cost_usd":0.0000063,"status":"success","error":null,"created_at":"2026-09-23T13:21:45.215Z"},{"id":221,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":4,"input_tokens":102,"output_tokens":0,"cost_usd":0.0000153,"status":"success","error":null,"created_at":"2026-09-23T13:11:36.964Z"},{"id":220,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":5,"input_tokens":96,"output_tokens":0,"cost_usd":0.0000144,"status":"success","error":null,"created_at":"2026-09-23T13:11:30.006Z"},{"id":219,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":43,"input_tokens":46,"output_tokens":0,"cost_usd":0.0000069,"status":"success","error":null,"created_at":"2026-09-23T13:11:29.179Z"},{"id":218,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":35,"input_tokens":51,"output_tokens":0,"cost_usd":0.00000765,"status":"success","error":null,"created_at":"2026-09-23T13:11:27.402Z"},{"id":217,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":3,"input_tokens":106,"output_tokens":0,"cost_usd":0.0000159,"status":"success","error":null,"created_at":"2026-09-23T13:11:13.414Z"},{"id":216,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":12,"input_tokens":101,"output_tokens":0,"cost_usd":0.00001515,"status":"success","error":null,"created_at":"2026-09-23T13:10:54.367Z"},{"id":215,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":12,"input_tokens":177,"output_tokens":20,"cost_usd":0.0001031,"status":"success","error":null,"created_at":"2026-09-23T13:10:53.744Z"},{"id":214,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":11,"input_tokens":96,"output_tokens":0,"cost_usd":0.0000144,"status":"success","error":null,"created_at":"2026-09-23T13:10:46.478Z"},{"id":213,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":11,"input_tokens":183,"output_tokens":20,"cost_usd":0.0001049,"status":"success","error":null,"created_at":"2026-09-23T13:10:45.976Z"},{"id":212,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":32,"input_tokens":41,"output_tokens":0,"cost_usd":0.00000615,"status":"success","error":null,"created_at":"2026-09-23T13:10:42.971Z"},{"id":211,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":26,"input_tokens":58,"output_tokens":0,"cost_usd":0.0000087,"status":"success","error":null,"created_at":"2026-09-23T13:10:40.940Z"},{"id":210,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":25,"input_tokens":54,"output_tokens":0,"cost_usd":0.0000081,"status":"success","error":null,"created_at":"2026-09-23T13:10:39.234Z"},{"id":209,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":28,"input_tokens":46,"output_tokens":0,"cost_usd":0.0000069,"status":"success","error":null,"created_at":"2026-09-23T13:10:32.965Z"},{"id":208,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":29,"input_tokens":49,"output_tokens":0,"cost_usd":0.00000735,"status":"success","error":null,"created_at":"2026-09-23T13:10:30.915Z"},{"id":207,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":10,"input_tokens":90,"output_tokens":0,"cost_usd":0.0000135,"status":"success","error":null,"created_at":"2026-09-23T13:10:29.792Z"},{"id":206,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":10,"input_tokens":182,"output_tokens":20,"cost_usd":0.0001046,"status":"success","error":null,"created_at":"2026-09-23T13:10:29.254Z"},{"id":205,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":27,"input_tokens":50,"output_tokens":0,"cost_usd":0.0000075,"status":"success","error":null,"created_at":"2026-09-23T13:10:29.177Z"},{"id":204,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":9,"input_tokens":101,"output_tokens":0,"cost_usd":0.00001515,"status":"success","error":null,"created_at":"2026-09-23T13:10:21.978Z"},{"id":203,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":9,"input_tokens":185,"output_tokens":19,"cost_usd":0.000103,"status":"success","error":null,"created_at":"2026-09-23T13:10:21.495Z"},{"id":202,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":22,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:10:12.990Z"},{"id":201,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":24,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:56.649Z"},{"id":200,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":5,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:53.841Z"},{"id":199,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":10,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:48.725Z"},{"id":198,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":4,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:46.980Z"},{"id":197,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":23,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:42.682Z"},{"id":196,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":3,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:40.533Z"},{"id":195,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":1,"input_tokens":105,"output_tokens":0,"cost_usd":0.00001575,"status":"success","error":null,"created_at":"2026-09-23T13:09:33.777Z"},{"id":194,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":8,"input_tokens":99,"output_tokens":0,"cost_usd":0.00001485,"status":"success","error":null,"created_at":"2026-09-23T13:09:26.437Z"},{"id":193,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":8,"input_tokens":175,"output_tokens":22,"cost_usd":0.0001075,"status":"success","error":null,"created_at":"2026-09-23T13:09:25.894Z"},{"id":192,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":4,"input_tokens":44,"output_tokens":0,"cost_usd":0.0000066,"status":"success","error":null,"created_at":"2026-09-23T13:09:24.663Z"},{"id":191,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":38,"input_tokens":45,"output_tokens":0,"cost_usd":0.00000675,"status":"success","error":null,"created_at":"2026-09-23T13:09:20.779Z"},{"id":190,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":40,"input_tokens":48,"output_tokens":0,"cost_usd":0.0000072,"status":"success","error":null,"created_at":"2026-09-23T13:09:18.835Z"},{"id":189,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":41,"input_tokens":40,"output_tokens":0,"cost_usd":0.000006,"status":"success","error":null,"created_at":"2026-09-23T13:09:12.683Z"},{"id":188,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":46,"input_tokens":48,"output_tokens":0,"cost_usd":0.0000072,"status":"success","error":null,"created_at":"2026-09-23T13:09:10.738Z"},{"id":187,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":43,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:08.477Z"},{"id":186,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":35,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:09:06.533Z"},{"id":185,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":39,"input_tokens":45,"output_tokens":0,"cost_usd":0.00000675,"status":"success","error":null,"created_at":"2026-09-23T13:09:04.698Z"},{"id":184,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":37,"input_tokens":46,"output_tokens":0,"cost_usd":0.0000069,"status":"success","error":null,"created_at":"2026-09-23T13:09:02.959Z"},{"id":183,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":47,"input_tokens":48,"output_tokens":0,"cost_usd":0.0000072,"status":"success","error":null,"created_at":"2026-09-23T13:08:54.969Z"},{"id":182,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":6,"input_tokens":102,"output_tokens":0,"cost_usd":0.0000153,"status":"success","error":null,"created_at":"2026-09-23T13:08:48.418Z"},{"id":181,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":197,"input_tokens":41,"output_tokens":0,"cost_usd":0.00000615,"status":"success","error":null,"created_at":"2026-09-23T13:08:45.985Z"},{"id":180,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":196,"input_tokens":45,"output_tokens":0,"cost_usd":0.00000675,"status":"success","error":null,"created_at":"2026-09-23T13:08:44.020Z"},{"id":179,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":195,"input_tokens":28,"output_tokens":0,"cost_usd":0.0000042,"status":"success","error":null,"created_at":"2026-09-23T13:08:41.928Z"},{"id":178,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":7,"input_tokens":99,"output_tokens":0,"cost_usd":0.00001485,"status":"success","error":null,"created_at":"2026-09-23T13:08:41.863Z"},{"id":177,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":7,"input_tokens":175,"output_tokens":20,"cost_usd":0.0001025,"status":"success","error":null,"created_at":"2026-09-23T13:08:41.346Z"},{"id":176,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":51,"input_tokens":47,"output_tokens":0,"cost_usd":0.00000705,"status":"success","error":null,"created_at":"2026-09-23T13:08:39.962Z"},{"id":175,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":50,"input_tokens":50,"output_tokens":0,"cost_usd":0.0000075,"status":"success","error":null,"created_at":"2026-09-23T13:08:37.969Z"},{"id":174,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":49,"input_tokens":42,"output_tokens":0,"cost_usd":0.0000063,"status":"success","error":null,"created_at":"2026-09-23T13:08:36.083Z"},{"id":173,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":48,"input_tokens":41,"output_tokens":0,"cost_usd":0.00000615,"status":"success","error":null,"created_at":"2026-09-23T13:08:34.177Z"},{"id":172,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":25,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:31.924Z"},{"id":171,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":47,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:29.873Z"},{"id":170,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":29,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:27.932Z"},{"id":169,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":24,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:25.774Z"},{"id":168,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":46,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:23.830Z"},{"id":167,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":43,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:21.836Z"},{"id":166,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":41,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:20.353Z"},{"id":165,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":5,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:19.429Z"},{"id":164,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":37,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:17.588Z"},{"id":163,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":28,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:15.539Z"},{"id":162,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":26,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:13.521Z"},{"id":161,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":4,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:12.981Z"},{"id":160,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":23,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:11.548Z"},{"id":159,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":36,"input_tokens":43,"output_tokens":0,"cost_usd":0.00000645,"status":"success","error":null,"created_at":"2026-09-23T13:08:09.706Z"},{"id":158,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":32,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:07.485Z"},{"id":157,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":1,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:06.534Z"},{"id":156,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":40,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:05.606Z"},{"id":155,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":39,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:03.558Z"},{"id":154,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":22,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:01.489Z"},{"id":153,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":6,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:08:00.070Z"},{"id":152,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":6,"input_tokens":180,"output_tokens":19,"cost_usd":0.0001015,"status":"success","error":null,"created_at":"2026-09-23T13:07:59.585Z"},{"id":151,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":38,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:59.558Z"},{"id":150,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":35,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:57.517Z"},{"id":149,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":27,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:55.466Z"},{"id":148,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":17,"input_tokens":53,"output_tokens":0,"cost_usd":0.00000795,"status":"success","error":null,"created_at":"2026-09-23T13:07:53.834Z"},{"id":147,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":34,"input_tokens":51,"output_tokens":0,"cost_usd":0.00000765,"status":"success","error":null,"created_at":"2026-09-23T13:07:51.582Z"},{"id":146,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":45,"input_tokens":41,"output_tokens":0,"cost_usd":0.00000615,"status":"success","error":null,"created_at":"2026-09-23T13:07:49.536Z"},{"id":145,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":44,"input_tokens":46,"output_tokens":0,"cost_usd":0.0000069,"status":"success","error":null,"created_at":"2026-09-23T13:07:47.590Z"},{"id":144,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":20,"input_tokens":48,"output_tokens":0,"cost_usd":0.0000072,"status":"success","error":null,"created_at":"2026-09-23T13:07:45.541Z"},{"id":143,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":43,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:43.367Z"},{"id":142,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":42,"input_tokens":40,"output_tokens":0,"cost_usd":0.000006,"status":"success","error":null,"created_at":"2026-09-23T13:07:41.592Z"},{"id":141,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":41,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:39.493Z"},{"id":140,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":40,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:37.537Z"},{"id":139,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":3,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:37.192Z"},{"id":138,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":39,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:35.398Z"},{"id":137,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":38,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:33.357Z"},{"id":136,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":37,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:31.341Z"},{"id":135,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":5,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:30.790Z"},{"id":134,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":5,"input_tokens":177,"output_tokens":19,"cost_usd":0.0001006,"status":"success","error":null,"created_at":"2026-09-23T13:07:30.282Z"},{"id":133,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":36,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:29.358Z"},{"id":132,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":35,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:27.616Z"},{"id":131,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":34,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:25.358Z"},{"id":130,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":32,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:23.328Z"},{"id":129,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":29,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:21.364Z"},{"id":128,"kind":"embed","model":"gemini-embedding-001","owner_type":"post","owner_id":4,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:19.836Z"},{"id":127,"kind":"embed","model":"gemini-embedding-001","owner_type":"image","owner_id":28,"input_tokens":0,"output_tokens":0,"cost_usd":0,"status":"error","error":"{\"error\":{\"code\":429,\"message\":\"Resource exhausted. Please try again later. Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details.\",\"status\":\"RESOURCE_EXHAUSTED\"}}","created_at":"2026-09-23T13:07:19.359Z"},{"id":126,"kind":"analyze","model":"gemini-3.5-flash-lite","owner_type":"post","owner_id":4,"input_tokens":182,"output_tokens":20,"cost_usd":0.0001046,"status":"success","error":null,"created_at":"2026-09-23T13:07:19.324Z"}]}
```

## Backend

### 10. Review workflow: inspect why, approve, reject (idempotent)
`GET /suggestions/1` explains the choice; approving twice records one review; bad input returns 400.
```json
{"id":1,"decision":"accepted","rank":1,"scores":{"similarity":0.85972273,"subjectSimilarity":1},"reasons":[],"post":{"id":1,"slug":"red-fox-behavior","title":"The Behavior of Red Foxes","subject":"red fox","category":"animal"},"image":{"id":34,"filename":"fox_06.jpg","subject":"red fox","category":"animal","attributes":["red fur","white chest","close-up portrait","alert expression","snowy background"],"caption":"A close-up portrait of a red fox with bright orange fur and alert eyes against a snowy background.","confidence":0.99,"flagged":false},"review":{"action":"approve","note":"Correct red fox image","reviewedAt":"2026-09-23T13:45:27.919Z"}}
{"message":"Suggestion 1 was already approved (no change)","review":{"id":1,"suggestion_id":1,"action":"approve","note":"Correct red fox image","created_at":"2026-09-23T13:45:27.919Z"}}
{"message":"Suggestion 6 was already rejected (no change)","review":{"id":3,"suggestion_id":6,"action":"reject","note":"A dog is not a goldfish","created_at":"2026-09-23T13:45:56.808Z"}}
{"error":"Invalid request","details":[{"field":"id","message":"Invalid input: expected number, received NaN"}]}
```
