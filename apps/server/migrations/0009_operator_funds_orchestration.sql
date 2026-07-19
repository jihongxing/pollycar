SET ROLE pollycar_ledger_owner;

CREATE FUNCTION pollycar_finance.post_runtime_ledger_transaction(p_request jsonb)
RETURNS TABLE (
  ledger_transaction_id uuid,
  transaction_sequence bigint,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
DECLARE
  v_transaction_type text := p_request->>'transaction_type';
  v_reconciliation_run_id text := p_request->>'reconciliation_run_id';
BEGIN
  IF v_transaction_type = 'ALLOCATION_15_45_40' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      v_reconciliation_run_id, 'settlement'
    );
  ELSIF v_transaction_type IN (
    'DRIVER_PAYOUT_REQUESTED', 'DRIVER_PAYOUT_COMPLETED'
  ) THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      v_reconciliation_run_id, 'payout'
    );
  END IF;

  RETURN QUERY
  SELECT *
    FROM pollycar_finance.post_ledger_transaction(p_request);
END
$$;

CREATE TABLE pollycar_finance.driver_operator_memberships (
  membership_id text PRIMARY KEY,
  driver_account_id text NOT NULL,
  operator_entity_id text NOT NULL,
  city_code text NOT NULL,
  vehicle_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'ended')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state = 'active' AND effective_to IS NULL)
    OR (state = 'ended' AND effective_to IS NOT NULL AND effective_to > effective_from)
  )
);

CREATE UNIQUE INDEX driver_operator_memberships_one_active
  ON pollycar_finance.driver_operator_memberships (
    driver_account_id, city_code, vehicle_id
  )
  WHERE state = 'active';

CREATE TABLE pollycar_finance.financial_allocations (
  allocation_id text PRIMARY KEY,
  payment_order_id text NOT NULL,
  trip_id text NOT NULL UNIQUE,
  driver_account_id text NOT NULL,
  operator_entity_id text NOT NULL,
  business_date date NOT NULL,
  allocable_fare_minor bigint NOT NULL CHECK (allocable_fare_minor > 0),
  platform_share_minor bigint NOT NULL CHECK (platform_share_minor >= 0),
  operator_share_minor bigint NOT NULL CHECK (operator_share_minor >= 0),
  driver_share_minor bigint NOT NULL CHECK (driver_share_minor > 0),
  rule_version text NOT NULL CHECK (rule_version = 'allocation-15-45-40-v1'),
  ledger_transaction_id uuid NOT NULL UNIQUE REFERENCES pollycar_finance.ledger_transactions (
    ledger_transaction_id
  ),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    platform_share_minor + operator_share_minor + driver_share_minor
      = allocable_fare_minor
  ),
  CHECK (
    platform_share_minor = floor(allocable_fare_minor::numeric * 1500 / 10000)
  ),
  CHECK (
    operator_share_minor = floor(allocable_fare_minor::numeric * 4500 / 10000)
  )
);

CREATE TABLE pollycar_finance.operator_settlement_batches (
  settlement_batch_id text PRIMARY KEY,
  operator_entity_id text NOT NULL,
  business_date date NOT NULL,
  reconciliation_run_id text NOT NULL REFERENCES pollycar_finance.reconciliation_runs (
    reconciliation_run_id
  ),
  state text NOT NULL CHECK (state IN ('ready', 'succeeded')),
  allocation_ids jsonb NOT NULL,
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  prepared_by text NOT NULL,
  reviewed_by text,
  provider_batch_id text,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (operator_entity_id, business_date),
  CHECK (
    jsonb_typeof(allocation_ids) = 'array'
    AND jsonb_array_length(allocation_ids) > 0
  ),
  CHECK (
    (state = 'ready' AND reviewed_by IS NULL AND provider_batch_id IS NULL
      AND completed_at IS NULL)
    OR
    (state = 'succeeded' AND btrim(reviewed_by) <> ''
      AND btrim(provider_batch_id) <> '' AND completed_at IS NOT NULL
      AND prepared_by <> reviewed_by)
  )
);

CREATE TABLE pollycar_finance.driver_payout_batches (
  payout_batch_id text PRIMARY KEY,
  operator_entity_id text NOT NULL,
  driver_account_id text NOT NULL,
  business_date date NOT NULL,
  reconciliation_run_id text NOT NULL REFERENCES pollycar_finance.reconciliation_runs (
    reconciliation_run_id
  ),
  state text NOT NULL CHECK (
    state IN ('awaiting_review', 'approved', 'processing', 'succeeded')
  ),
  allocation_ids jsonb NOT NULL,
  gross_payable_minor bigint NOT NULL CHECK (gross_payable_minor > 0),
  payout_fee_minor bigint NOT NULL DEFAULT 0 CHECK (payout_fee_minor >= 0),
  prepared_by text NOT NULL,
  reviewed_by text,
  requested_ledger_transaction_id uuid UNIQUE REFERENCES pollycar_finance.ledger_transactions (
    ledger_transaction_id
  ),
  completed_ledger_transaction_id uuid UNIQUE REFERENCES pollycar_finance.ledger_transactions (
    ledger_transaction_id
  ),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (operator_entity_id, driver_account_id, business_date),
  CHECK (
    jsonb_typeof(allocation_ids) = 'array'
    AND jsonb_array_length(allocation_ids) > 0
  ),
  CHECK (
    (state = 'awaiting_review' AND reviewed_by IS NULL
      AND requested_ledger_transaction_id IS NULL
      AND completed_ledger_transaction_id IS NULL)
    OR
    (state = 'approved' AND btrim(reviewed_by) <> ''
      AND prepared_by <> reviewed_by
      AND requested_ledger_transaction_id IS NULL
      AND completed_ledger_transaction_id IS NULL)
    OR
    (state = 'processing' AND btrim(reviewed_by) <> ''
      AND prepared_by <> reviewed_by
      AND requested_ledger_transaction_id IS NOT NULL
      AND completed_ledger_transaction_id IS NULL)
    OR
    (state = 'succeeded' AND btrim(reviewed_by) <> ''
      AND prepared_by <> reviewed_by
      AND requested_ledger_transaction_id IS NOT NULL
      AND completed_ledger_transaction_id IS NOT NULL
      AND completed_at IS NOT NULL)
  )
);

CREATE TABLE pollycar_finance.operator_settlement_batch_items (
  settlement_batch_id text NOT NULL REFERENCES pollycar_finance.operator_settlement_batches (
    settlement_batch_id
  ),
  allocation_id text NOT NULL UNIQUE REFERENCES pollycar_finance.financial_allocations (
    allocation_id
  ),
  PRIMARY KEY (settlement_batch_id, allocation_id)
);

CREATE TABLE pollycar_finance.driver_payout_batch_items (
  payout_batch_id text NOT NULL REFERENCES pollycar_finance.driver_payout_batches (
    payout_batch_id
  ),
  allocation_id text NOT NULL UNIQUE REFERENCES pollycar_finance.financial_allocations (
    allocation_id
  ),
  PRIMARY KEY (payout_batch_id, allocation_id)
);

CREATE TABLE pollycar_finance.operator_fund_cases (
  fund_case_id text PRIMARY KEY,
  operator_entity_id text NOT NULL,
  case_type text NOT NULL CHECK (
    case_type IN (
      'settlement_blocked', 'payout_overdue', 'payout_unknown',
      'funds_insufficient', 'refund_recovery'
    )
  ),
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  state text NOT NULL CHECK (state IN ('open', 'resolved')),
  reason_code text NOT NULL,
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE FUNCTION pollycar_finance.apply_operator_funds_command(p_command jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
DECLARE
  v_command_type text := p_command->>'command_type';
BEGIN
  IF v_command_type = 'create_membership' THEN
    INSERT INTO pollycar_finance.driver_operator_memberships (
      membership_id, driver_account_id, operator_entity_id, city_code,
      vehicle_id, state, effective_from, synthetic
    )
    VALUES (
      p_command->>'membership_id', p_command->>'driver_account_id',
      p_command->>'operator_entity_id', p_command->>'city_code',
      p_command->>'vehicle_id', 'active',
      (p_command->>'effective_from')::timestamptz, true
    );
  ELSIF v_command_type = 'save_allocation' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM pollycar_finance.ledger_transactions AS ledger_transaction
       WHERE ledger_transaction.ledger_transaction_id =
             (p_command->>'ledger_transaction_id')::uuid
         AND ledger_transaction.transaction_type = 'ALLOCATION_15_45_40'
         AND ledger_transaction.business_reference_type = 'financial_allocation'
         AND ledger_transaction.business_reference_id = p_command->>'allocation_id'
    ) THEN
      RAISE EXCEPTION 'ALLOCATION_LEDGER_TRANSACTION_INVALID';
    END IF;
    INSERT INTO pollycar_finance.financial_allocations (
      allocation_id, payment_order_id, trip_id, driver_account_id,
      operator_entity_id, business_date, allocable_fare_minor,
      platform_share_minor, operator_share_minor, driver_share_minor,
      rule_version, ledger_transaction_id, synthetic
    )
    VALUES (
      p_command->>'allocation_id', p_command->>'payment_order_id',
      p_command->>'trip_id', p_command->>'driver_account_id',
      p_command->>'operator_entity_id', (p_command->>'business_date')::date,
      (p_command->>'allocable_fare_minor')::bigint,
      (p_command->>'platform_share_minor')::bigint,
      (p_command->>'operator_share_minor')::bigint,
      (p_command->>'driver_share_minor')::bigint,
      p_command->>'rule_version', (p_command->>'ledger_transaction_id')::uuid, true
    );
  ELSIF v_command_type = 'create_settlement_batch' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      p_command->>'reconciliation_run_id', 'settlement'
    );
    IF (
      SELECT count(*)
        FROM pollycar_finance.financial_allocations AS allocation
       WHERE allocation.allocation_id IN (
         SELECT jsonb_array_elements_text(p_command->'allocation_ids')
       )
         AND allocation.operator_entity_id = p_command->>'operator_entity_id'
    ) <> jsonb_array_length(p_command->'allocation_ids') THEN
      RAISE EXCEPTION 'SETTLEMENT_ALLOCATION_SET_INVALID';
    END IF;
    INSERT INTO pollycar_finance.operator_settlement_batches (
      settlement_batch_id, operator_entity_id, business_date,
      reconciliation_run_id, state, allocation_ids, gross_amount_minor,
      prepared_by, synthetic
    )
    VALUES (
      p_command->>'settlement_batch_id', p_command->>'operator_entity_id',
      (p_command->>'business_date')::date, p_command->>'reconciliation_run_id',
      'ready', p_command->'allocation_ids',
      (
        SELECT sum(allocation.operator_share_minor + allocation.driver_share_minor)
          FROM pollycar_finance.financial_allocations AS allocation
         WHERE allocation.allocation_id IN (
           SELECT jsonb_array_elements_text(p_command->'allocation_ids')
         )
      ),
      p_command->>'prepared_by', true
    );
    INSERT INTO pollycar_finance.operator_settlement_batch_items (
      settlement_batch_id, allocation_id
    )
    SELECT p_command->>'settlement_batch_id', jsonb_array_elements_text(
      p_command->'allocation_ids'
    );
  ELSIF v_command_type = 'complete_settlement_batch' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      (
        SELECT reconciliation_run_id
          FROM pollycar_finance.operator_settlement_batches
         WHERE settlement_batch_id = p_command->>'settlement_batch_id'
      ),
      'settlement'
    );
    UPDATE pollycar_finance.operator_settlement_batches
       SET state = 'succeeded',
           reviewed_by = p_command->>'reviewed_by',
           provider_batch_id = p_command->>'provider_batch_id',
           completed_at = now()
     WHERE settlement_batch_id = p_command->>'settlement_batch_id'
       AND state = 'ready'
       AND prepared_by <> p_command->>'reviewed_by';
    IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_BATCH_TRANSITION_INVALID'; END IF;
  ELSIF v_command_type = 'create_payout_batch' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      p_command->>'reconciliation_run_id', 'payout'
    );
    IF (
      SELECT count(*)
        FROM pollycar_finance.financial_allocations AS allocation
       WHERE allocation.allocation_id IN (
         SELECT jsonb_array_elements_text(p_command->'allocation_ids')
       )
         AND allocation.operator_entity_id = p_command->>'operator_entity_id'
         AND allocation.driver_account_id = p_command->>'driver_account_id'
    ) <> jsonb_array_length(p_command->'allocation_ids') THEN
      RAISE EXCEPTION 'PAYOUT_ALLOCATION_SET_INVALID';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM pollycar_finance.financial_allocations AS allocation
       WHERE allocation.allocation_id IN (
         SELECT jsonb_array_elements_text(p_command->'allocation_ids')
       )
         AND allocation.business_date + 1 <> (p_command->>'business_date')::date
    ) THEN
      RAISE EXCEPTION 'PAYOUT_BATCH_NOT_T_PLUS_ONE';
    END IF;
    INSERT INTO pollycar_finance.driver_payout_batches (
      payout_batch_id, operator_entity_id, driver_account_id, business_date,
      reconciliation_run_id, state, allocation_ids, gross_payable_minor,
      payout_fee_minor, prepared_by, synthetic
    )
    VALUES (
      p_command->>'payout_batch_id', p_command->>'operator_entity_id',
      p_command->>'driver_account_id', (p_command->>'business_date')::date,
      p_command->>'reconciliation_run_id', 'awaiting_review',
      p_command->'allocation_ids',
      (
        SELECT sum(allocation.driver_share_minor)
          FROM pollycar_finance.financial_allocations AS allocation
         WHERE allocation.allocation_id IN (
           SELECT jsonb_array_elements_text(p_command->'allocation_ids')
         )
      ),
      0, p_command->>'prepared_by', true
    );
    INSERT INTO pollycar_finance.driver_payout_batch_items (
      payout_batch_id, allocation_id
    )
    SELECT p_command->>'payout_batch_id', jsonb_array_elements_text(
      p_command->'allocation_ids'
    );
  ELSIF v_command_type = 'approve_payout_batch' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      (
        SELECT reconciliation_run_id
          FROM pollycar_finance.driver_payout_batches
         WHERE payout_batch_id = p_command->>'payout_batch_id'
      ),
      'payout'
    );
    UPDATE pollycar_finance.driver_payout_batches
       SET state = 'approved',
           reviewed_by = p_command->>'reviewed_by'
     WHERE payout_batch_id = p_command->>'payout_batch_id'
       AND state = 'awaiting_review'
       AND prepared_by <> p_command->>'reviewed_by';
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_BATCH_REVIEW_INVALID'; END IF;
  ELSIF v_command_type = 'mark_payout_requested' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      (
        SELECT reconciliation_run_id
          FROM pollycar_finance.driver_payout_batches
         WHERE payout_batch_id = p_command->>'payout_batch_id'
      ),
      'payout'
    );
    IF NOT EXISTS (
      SELECT 1
        FROM pollycar_finance.ledger_transactions AS ledger_transaction
       WHERE ledger_transaction.ledger_transaction_id =
             (p_command->>'ledger_transaction_id')::uuid
         AND ledger_transaction.transaction_type = 'DRIVER_PAYOUT_REQUESTED'
         AND ledger_transaction.business_reference_type = 'driver_payout'
         AND ledger_transaction.business_reference_id = p_command->>'payout_batch_id'
    ) THEN
      RAISE EXCEPTION 'PAYOUT_REQUEST_LEDGER_TRANSACTION_INVALID';
    END IF;
    UPDATE pollycar_finance.driver_payout_batches
       SET state = 'processing',
           requested_ledger_transaction_id =
             (p_command->>'ledger_transaction_id')::uuid
     WHERE payout_batch_id = p_command->>'payout_batch_id'
       AND state = 'approved';
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_BATCH_REQUEST_INVALID'; END IF;
  ELSIF v_command_type = 'mark_payout_completed' THEN
    PERFORM pollycar_finance.assert_reconciliation_action_allowed(
      (
        SELECT reconciliation_run_id
          FROM pollycar_finance.driver_payout_batches
         WHERE payout_batch_id = p_command->>'payout_batch_id'
      ),
      'payout'
    );
    IF NOT EXISTS (
      SELECT 1
        FROM pollycar_finance.ledger_transactions AS ledger_transaction
       WHERE ledger_transaction.ledger_transaction_id =
             (p_command->>'ledger_transaction_id')::uuid
         AND ledger_transaction.transaction_type = 'DRIVER_PAYOUT_COMPLETED'
         AND ledger_transaction.business_reference_type = 'driver_payout'
         AND ledger_transaction.business_reference_id = p_command->>'payout_batch_id'
    ) THEN
      RAISE EXCEPTION 'PAYOUT_COMPLETE_LEDGER_TRANSACTION_INVALID';
    END IF;
    UPDATE pollycar_finance.driver_payout_batches
       SET state = 'succeeded',
           completed_ledger_transaction_id =
             (p_command->>'ledger_transaction_id')::uuid,
           payout_fee_minor = (p_command->>'payout_fee_minor')::bigint,
           completed_at = now()
     WHERE payout_batch_id = p_command->>'payout_batch_id'
       AND state = 'processing';
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_BATCH_COMPLETE_INVALID'; END IF;
  ELSIF v_command_type = 'create_fund_case' THEN
    INSERT INTO pollycar_finance.operator_fund_cases (
      fund_case_id, operator_entity_id, case_type, reference_type,
      reference_id, amount_minor, state, reason_code, evidence_reference,
      synthetic
    )
    VALUES (
      p_command->>'fund_case_id', p_command->>'operator_entity_id',
      p_command->>'case_type', p_command->>'reference_type',
      p_command->>'reference_id', (p_command->>'amount_minor')::bigint,
      'open', p_command->>'reason_code', p_command->>'evidence_reference', true
    );
  ELSE
    RAISE EXCEPTION 'OPERATOR_FUNDS_COMMAND_INVALID';
  END IF;
END
$$;

REVOKE ALL ON
  pollycar_finance.driver_operator_memberships,
  pollycar_finance.financial_allocations,
  pollycar_finance.operator_settlement_batches,
  pollycar_finance.driver_payout_batches,
  pollycar_finance.operator_settlement_batch_items,
  pollycar_finance.driver_payout_batch_items,
  pollycar_finance.operator_fund_cases
FROM PUBLIC;
REVOKE ALL ON FUNCTION pollycar_finance.apply_operator_funds_command(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pollycar_finance.post_ledger_transaction(jsonb)
  FROM pollycar_ledger_runtime;
REVOKE ALL ON FUNCTION pollycar_finance.post_runtime_ledger_transaction(jsonb)
  FROM PUBLIC;

GRANT SELECT ON
  pollycar_finance.driver_operator_memberships,
  pollycar_finance.financial_allocations,
  pollycar_finance.operator_settlement_batches,
  pollycar_finance.driver_payout_batches,
  pollycar_finance.operator_settlement_batch_items,
  pollycar_finance.driver_payout_batch_items,
  pollycar_finance.operator_fund_cases
TO pollycar_ledger_runtime, pollycar_ledger_maintenance, pollycar_ledger_auditor;

GRANT EXECUTE ON FUNCTION pollycar_finance.apply_operator_funds_command(jsonb)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.post_runtime_ledger_transaction(jsonb)
  TO pollycar_ledger_runtime;

RESET ROLE;
