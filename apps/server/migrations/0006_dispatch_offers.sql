CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS pollycar_driver_dispatch_presence (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pollycar_dispatch_offers (
  record_key text PRIMARY KEY,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pollycar_synthetic_trips_one_active_immediate_driver
  ON pollycar_synthetic_trips (driver_account_id)
  WHERE driver_account_id IS NOT NULL
    AND timing_mode = 'immediate'
    AND trip_state IN ('accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'safety_frozen');

ALTER TABLE pollycar_synthetic_trips
  ADD COLUMN IF NOT EXISTS driver_occupied_window tstzrange;

UPDATE pollycar_synthetic_trips
   SET driver_occupied_window = CASE
     WHEN timing_mode = 'scheduled' AND requested_pickup_starts_at IS NOT NULL
     THEN tstzrange(
       requested_pickup_starts_at - interval '30 minutes',
       requested_pickup_starts_at
         + make_interval(mins => COALESCE(estimated_duration_minutes, 60) + 15),
       '[)'
     )
     ELSE NULL
   END;

ALTER TABLE pollycar_synthetic_trips
  DROP CONSTRAINT IF EXISTS pollycar_synthetic_trips_driver_schedule_exclusion;

ALTER TABLE pollycar_synthetic_trips
  ADD CONSTRAINT pollycar_synthetic_trips_driver_schedule_exclusion
  EXCLUDE USING gist (
    driver_account_id WITH =,
    driver_occupied_window WITH &&
  )
  WHERE (
    driver_account_id IS NOT NULL
    AND timing_mode = 'scheduled'
    AND trip_state IN ('reserved', 'preparing', 'driver_en_route', 'driver_arrived', 'in_progress', 'safety_frozen')
  );
