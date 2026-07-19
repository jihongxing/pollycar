CREATE TABLE IF NOT EXISTS pollycar_phone_accounts (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  phone_digest text GENERATED ALWAYS AS (payload->>'phoneDigest') STORED,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_digest)
);

CREATE TABLE IF NOT EXISTS pollycar_phone_challenges (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  phone_digest text GENERATED ALWAYS AS (payload->>'phoneDigest') STORED,
  challenge_state text GENERATED ALWAYS AS (payload->>'state') STORED,
  sent_at text GENERATED ALWAYS AS (payload->>'sentAt') STORED,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pollycar_phone_challenge_rate_idx
  ON pollycar_phone_challenges (phone_digest, sent_at DESC);

CREATE TABLE IF NOT EXISTS pollycar_auth_devices (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_refresh_sessions (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  account_id text GENERATED ALWAYS AS (payload->>'accountId') STORED,
  device_id text GENERATED ALWAYS AS (payload->>'deviceId') STORED,
  refresh_token_digest text GENERATED ALWAYS AS (payload->>'refreshTokenDigest') STORED,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (refresh_token_digest)
);

CREATE INDEX IF NOT EXISTS pollycar_refresh_account_device_idx
  ON pollycar_refresh_sessions (account_id, device_id);

CREATE TABLE IF NOT EXISTS pollycar_account_sessions (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  account_id text GENERATED ALWAYS AS (payload->>'accountId') STORED,
  token_digest text GENERATED ALWAYS AS (payload->>'tokenDigest') STORED,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_digest)
);

CREATE INDEX IF NOT EXISTS pollycar_account_session_account_idx
  ON pollycar_account_sessions (account_id, updated_at DESC);
