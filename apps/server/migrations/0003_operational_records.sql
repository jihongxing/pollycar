CREATE TABLE IF NOT EXISTS pollycar_background_tasks (
  task_id text PRIMARY KEY,
  task_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  maximum_attempts integer NOT NULL CHECK (maximum_attempts > 0),
  task_status text NOT NULL CHECK (task_status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pollycar_background_tasks_claim_idx
  ON pollycar_background_tasks (task_status, created_at)
  WHERE task_status = 'pending';

CREATE TABLE IF NOT EXISTS pollycar_trip_chats (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_message_centers (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_location_lifecycle (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_identity_verifications (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_safety_cases (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_temporary_chats (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_audit_log (
  audit_id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'denied', 'succeeded', 'failed')),
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pollycar_audit_subject_idx
  ON pollycar_audit_log (subject_type, subject_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS pollycar_identity_audit_idx
  ON pollycar_audit_log (subject_id, occurred_at DESC)
  WHERE subject_type IN ('adult_eligibility', 'identity_verification', 'account_session');
