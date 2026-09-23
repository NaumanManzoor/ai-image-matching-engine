-- Images and their AI tags
CREATE TABLE IF NOT EXISTS images (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL UNIQUE,
  sha256      TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'tagged', 'flagged', 'failed')),
  subject     TEXT,
  category    TEXT,
  attributes  TEXT[],
  caption     TEXT,
  confidence  REAL,
  flagged     BOOLEAN NOT NULL DEFAULT false,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

-- Blog posts
CREATE TABLE IF NOT EXISTS posts (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  subject     TEXT,
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'analyzed', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Embedding vectors for images and posts
CREATE TABLE IF NOT EXISTS embeddings (
  id          SERIAL PRIMARY KEY,
  owner_type  TEXT NOT NULL CHECK (owner_type IN ('image', 'post')),
  owner_id    INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('content', 'subject')),
  model       TEXT NOT NULL,
  vector      REAL[] NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, kind, model)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_owner ON embeddings(owner_type, kind);

-- Suggested image for a post, with the guard's decision
CREATE TABLE IF NOT EXISTS suggestions (
  id                  SERIAL PRIMARY KEY,
  post_id             INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_id            INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  rank                INTEGER NOT NULL,
  similarity          REAL NOT NULL,
  subject_similarity  REAL,
  decision            TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  reasons             JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, image_id)
);
CREATE INDEX IF NOT EXISTS idx_suggestions_post ON suggestions(post_id);

-- Human approve / reject (one per suggestion = idempotent)
CREATE TABLE IF NOT EXISTS reviews (
  id             SERIAL PRIMARY KEY,
  suggestion_id  INTEGER NOT NULL UNIQUE REFERENCES suggestions(id) ON DELETE CASCADE,
  action         TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cost log: one row per AI call
CREATE TABLE IF NOT EXISTS ai_calls (
  id             SERIAL PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('vision', 'embed', 'analyze')),
  model          TEXT NOT NULL,
  owner_type     TEXT,
  owner_id       INTEGER,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(12, 8) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls(created_at);