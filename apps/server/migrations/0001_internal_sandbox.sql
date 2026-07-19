CREATE TABLE IF NOT EXISTS pollycar_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_records (
  namespace text NOT NULL,
  record_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, record_key)
);

CREATE TABLE IF NOT EXISTS pollycar_review_tasks (
  task_id text PRIMARY KEY,
  task_version integer NOT NULL CHECK (task_version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_outbox (
  event_id text PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic)
);

CREATE INDEX IF NOT EXISTS pollycar_outbox_pending_idx
  ON pollycar_outbox (available_at, occurred_at)
  WHERE published_at IS NULL;
