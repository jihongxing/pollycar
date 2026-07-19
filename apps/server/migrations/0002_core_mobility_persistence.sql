CREATE TABLE IF NOT EXISTS pollycar_synthetic_trips (
  trip_id text PRIMARY KEY,
  trip_version integer NOT NULL CHECK (trip_version > 0),
  passenger_account_id text NOT NULL,
  driver_account_id text,
  trip_state text NOT NULL,
  quota_policy text CHECK (quota_policy IN ('base', 'flex')),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pollycar_synthetic_trips_passenger_idx
  ON pollycar_synthetic_trips (passenger_account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS pollycar_synthetic_trips_driver_active_idx
  ON pollycar_synthetic_trips (driver_account_id, trip_state)
  WHERE driver_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pollycar_idempotency_keys (
  namespace text NOT NULL,
  idempotency_key text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  PRIMARY KEY (namespace, idempotency_key)
);

CREATE INDEX IF NOT EXISTS pollycar_idempotency_aggregate_idx
  ON pollycar_idempotency_keys (namespace, aggregate_id);

CREATE TABLE IF NOT EXISTS pollycar_driver_quota_occupancies (
  trip_id text PRIMARY KEY REFERENCES pollycar_synthetic_trips (trip_id),
  driver_account_id text NOT NULL,
  quota_policy text NOT NULL CHECK (quota_policy IN ('base', 'flex')),
  occupancy_state text NOT NULL CHECK (occupancy_state IN ('occupied', 'released', 'finalized')),
  occupied_at timestamptz NOT NULL,
  released_at timestamptz,
  finalized_at timestamptz,
  reason text,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pollycar_driver_quota_window_idx
  ON pollycar_driver_quota_occupancies (driver_account_id, occupied_at DESC)
  WHERE occupancy_state IN ('occupied', 'finalized');

CREATE TABLE IF NOT EXISTS pollycar_goodwill_cancellations (
  record_id text PRIMARY KEY,
  record_version integer NOT NULL CHECK (record_version > 0),
  account_id text NOT NULL,
  trip_id text NOT NULL REFERENCES pollycar_synthetic_trips (trip_id),
  actor text NOT NULL CHECK (actor IN ('passenger', 'driver')),
  record_state text NOT NULL CHECK (record_state IN ('reserved', 'consumed', 'restored')),
  reserved_at timestamptz NOT NULL,
  consumed_at timestamptz,
  restored_at timestamptz,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS pollycar_goodwill_window_idx
  ON pollycar_goodwill_cancellations (account_id, actor, consumed_at DESC)
  WHERE record_state = 'consumed';
