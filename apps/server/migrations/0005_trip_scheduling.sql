ALTER TABLE pollycar_synthetic_trips
  ADD COLUMN IF NOT EXISTS timing_mode text NOT NULL DEFAULT 'immediate'
    CHECK (timing_mode IN ('immediate', 'scheduled')),
  ADD COLUMN IF NOT EXISTS requested_pickup_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_pickup_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes BETWEEN 1 AND 240);

ALTER TABLE pollycar_synthetic_trips
  DROP CONSTRAINT IF EXISTS pollycar_synthetic_trips_schedule_window_check;

ALTER TABLE pollycar_synthetic_trips
  ADD CONSTRAINT pollycar_synthetic_trips_schedule_window_check CHECK (
    (timing_mode = 'immediate' AND requested_pickup_starts_at IS NULL AND requested_pickup_ends_at IS NULL)
    OR
    (
      timing_mode = 'scheduled'
      AND requested_pickup_starts_at IS NOT NULL
      AND requested_pickup_ends_at = requested_pickup_starts_at + interval '10 minutes'
    )
  );

CREATE INDEX IF NOT EXISTS pollycar_synthetic_trips_scheduled_pickup_idx
  ON pollycar_synthetic_trips (requested_pickup_starts_at, requested_pickup_ends_at)
  WHERE timing_mode = 'scheduled'
    AND trip_state IN ('scheduled', 'reserved', 'preparing', 'driver_en_route', 'driver_arrived', 'in_progress');

CREATE INDEX IF NOT EXISTS pollycar_synthetic_trips_driver_schedule_idx
  ON pollycar_synthetic_trips (driver_account_id, requested_pickup_starts_at)
  WHERE driver_account_id IS NOT NULL
    AND timing_mode = 'scheduled'
    AND trip_state IN ('reserved', 'preparing', 'driver_en_route', 'driver_arrived', 'in_progress');
