\# Evidence



Each section proves one requirement from Section 6 of the capstone brief.



\## AI processing



\### 1. Vision output is validated against a schema; invalid responses are never trusted

Every Gemini response is parsed and checked with the Zod schema in `src/services/tagSchema.js`

(enforced in `src/services/visionService.js`). Output that fails validation throws an error, the job

retries, and it is never saved.



`npm run tag-one -- fox\_01.jpg`:

```json

{

&#x20; "tags": {

&#x20;   "subject": "red fox",

&#x20;   "category": "animal",

&#x20;   "attributes": \["red fur", "covered in snow", "close-up shot", "alert expression", "winter setting"],

&#x20;   "caption": "A close-up portrait of a red fox with snow sprinkled on its face and fur during winter.",

&#x20;   "confidence": 0.98

&#x20; },

&#x20; "flagged": false

}

```



\### 2. Low-confidence classifications are flagged instead of accepted

`hard\_04.jpg` is `wolf\_05.jpg` made dark and heavily blurred. The model guessed \*\*"red fox"\*\* (wrong)

with confidence 0.4. Because 0.4 < `CONFIDENCE\_MIN` (0.6), it was \*\*flagged\*\*, not trusted.



`npm run tag-one -- hard\_04.jpg`:

```json

{

&#x20; "tags": {

&#x20;   "subject": "red fox",

&#x20;   "category": "animal",

&#x20;   "attributes": \["blurry", "dark", "outdoor", "wildlife"],

&#x20;   "caption": "An extremely blurry image of a red fox in the dark.",

&#x20;   "confidence": 0.4

&#x20; },

&#x20; "flagged": true

}

```



\### 3. Images are processed through a batch background job with retries

pg-boss queue `tag-image` (`src/jobs/tagImageJob.js`): retryLimit 3 with exponential backoff,

one image at a time, idempotent (singletonKey per image + the worker skips images already tagged).



`POST /jobs/ingest-images` called twice:

```

{"message":"Image tagging jobs enqueued","queued":54,"alreadyQueuedOrDone":0}

{"message":"Image tagging jobs enqueued","queued":1,"alreadyQueuedOrDone":52}

```

(The 1 extra job was for the image being processed at that moment; the worker skipped it, so no

duplicate AI call was made.)



Worker log (excerpt):

```

\[tag-image] #29 fox\_01.jpg -> red fox (0.98)

\[tag-image] #42 wolf\_01.jpg -> gray wolf (0.95)

\[tag-image] #25 dog\_07.jpg -> shiba inu (0.98)

\[tag-image] #195 hard\_04.jpg -> red fox (0.35) FLAGGED

\[tag-image] #196 hard\_05.jpg -> red fox (0.45) FLAGGED

\[tag-image] #197 hard\_06.jpg -> samoyed (0.55) FLAGGED

```



`GET /jobs/status` after the batch:

