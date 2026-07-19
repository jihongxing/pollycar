SET ROLE pollycar_ledger_owner;

CREATE TABLE pollycar_finance.reconciliation_runs (
  reconciliation_run_id text PRIMARY KEY,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  merchant_id text NOT NULL CHECK (btrim(merchant_id) <> ''),
  business_date date NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('payment', 'refund', 'settlement', 'fee')),
  source_file_id text NOT NULL CHECK (btrim(source_file_id) <> ''),
  source_file_digest text NOT NULL UNIQUE CHECK (source_file_digest ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN (
    'created', 'validating', 'matching', 'differences_found', 'balanced', 'failed', 'closed'
  )),
  expected_count bigint NOT NULL CHECK (expected_count >= 0),
  expected_amount_minor bigint NOT NULL CHECK (expected_amount_minor >= 0),
  actual_count bigint NOT NULL CHECK (actual_count >= 0),
  actual_amount_minor bigint NOT NULL CHECK (actual_amount_minor >= 0),
  difference_count bigint NOT NULL,
  difference_amount_minor bigint NOT NULL,
  statement_signature_verified boolean NOT NULL,
  control_totals_verified boolean NOT NULL,
  sources_complete boolean NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    state NOT IN ('balanced', 'closed')
    OR (
      difference_count = 0
      AND difference_amount_minor = 0
      AND statement_signature_verified
      AND control_totals_verified
      AND sources_complete
    )
  )
);

CREATE TABLE pollycar_finance.reconciliation_facts (
  reconciliation_fact_id text PRIMARY KEY,
  reconciliation_run_id text NOT NULL REFERENCES pollycar_finance.reconciliation_runs (
    reconciliation_run_id
  ),
  source text NOT NULL CHECK (source IN (
    'business_order', 'payment_aggregate', 'ledger', 'provider_statement'
  )),
  record_type text NOT NULL CHECK (record_type IN ('payment', 'refund', 'settlement', 'fee')),
  business_date date NOT NULL,
  merchant_id text NOT NULL,
  internal_order_id text NOT NULL,
  provider_order_id text NOT NULL,
  provider_event_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  currency text NOT NULL CHECK (currency = 'CNY'),
  state text NOT NULL,
  occurred_at timestamptz NOT NULL,
  settled_at timestamptz NOT NULL,
  source_digest text NOT NULL,
  late boolean NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  UNIQUE (reconciliation_run_id, source, source_digest)
);

CREATE TABLE pollycar_finance.reconciliation_items (
  reconciliation_item_id text PRIMARY KEY,
  reconciliation_run_id text NOT NULL REFERENCES pollycar_finance.reconciliation_runs (
    reconciliation_run_id
  ),
  difference_type text NOT NULL,
  internal_reference text NOT NULL,
  provider_reference text NOT NULL,
  internal_amount_minor bigint NOT NULL,
  provider_amount_minor bigint NOT NULL,
  difference_amount_minor bigint NOT NULL,
  currency text NOT NULL CHECK (currency = 'CNY'),
  state text NOT NULL CHECK (state IN ('open', 'resolved')),
  risk_level text NOT NULL CHECK (risk_level IN ('medium', 'high', 'critical')),
  details jsonb NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_type text,
  resolved_by text,
  reviewed_by text,
  resolution_evidence_reference text,
  CHECK (
    (state = 'open' AND resolved_at IS NULL AND resolution_type IS NULL
      AND resolved_by IS NULL AND reviewed_by IS NULL
      AND resolution_evidence_reference IS NULL)
    OR
    (state = 'resolved' AND resolved_at IS NOT NULL
      AND btrim(resolution_type) <> ''
      AND btrim(resolved_by) <> ''
      AND btrim(reviewed_by) <> ''
      AND btrim(resolution_evidence_reference) <> ''
      AND resolved_by <> reviewed_by)
  )
);

CREATE INDEX reconciliation_items_open_idx
  ON pollycar_finance.reconciliation_items (reconciliation_run_id, risk_level)
  WHERE state = 'open';

CREATE TABLE pollycar_finance.reconciliation_recovery_actions (
  recovery_action_id text PRIMARY KEY,
  reconciliation_run_id text NOT NULL REFERENCES pollycar_finance.reconciliation_runs (
    reconciliation_run_id
  ),
  reconciliation_item_id text NOT NULL REFERENCES pollycar_finance.reconciliation_items (
    reconciliation_item_id
  ),
  action_type text NOT NULL CHECK (action_type IN (
    'query_original_request',
    'recheck_next_batch',
    'create_duplicate_payment_refund_case',
    'repair_missing_ledger_idempotently',
    'investigate_orphan_provider_payment'
  )),
  state text NOT NULL CHECK (state IN ('pending', 'failed', 'completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code text,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reconciliation_item_id, action_type)
);

CREATE TABLE pollycar_finance.financial_business_days (
  business_date date PRIMARY KEY,
  state text NOT NULL CHECK (state = 'closed'),
  prepared_by text NOT NULL CHECK (btrim(prepared_by) <> ''),
  reviewed_by text NOT NULL CHECK (btrim(reviewed_by) <> ''),
  closed_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  CHECK (prepared_by <> reviewed_by)
);

CREATE FUNCTION pollycar_finance.record_reconciliation_evaluation(p_request jsonb)
RETURNS TABLE (reconciliation_run_id text, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
DECLARE
  v_run jsonb := p_request->'run';
  v_run_id text := v_run->>'reconciliation_run_id';
  v_source_digest text := v_run->>'source_file_digest';
  v_existing_id text;
  v_record jsonb;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pollycar_reconciliation:file:' || COALESCE(v_source_digest, ''), 0)
  );

  SELECT existing_run.reconciliation_run_id
    INTO v_existing_id
    FROM pollycar_finance.reconciliation_runs AS existing_run
   WHERE existing_run.source_file_digest = v_source_digest;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing_id, true;
    RETURN;
  END IF;

  INSERT INTO pollycar_finance.reconciliation_runs (
    reconciliation_run_id, provider, merchant_id, business_date, record_type,
    source_file_id, source_file_digest, state, expected_count, expected_amount_minor,
    actual_count, actual_amount_minor, difference_count, difference_amount_minor,
    statement_signature_verified, control_totals_verified, sources_complete, synthetic,
    completed_at
  )
  VALUES (
    v_run_id,
    v_run->>'provider',
    v_run->>'merchant_id',
    (v_run->>'business_date')::date,
    v_run->>'record_type',
    v_run->>'source_file_id',
    v_source_digest,
    v_run->>'state',
    (v_run->>'expected_count')::bigint,
    (v_run->>'expected_amount_minor')::bigint,
    (v_run->>'actual_count')::bigint,
    (v_run->>'actual_amount_minor')::bigint,
    (v_run->>'difference_count')::bigint,
    (v_run->>'difference_amount_minor')::bigint,
    (v_run->>'statement_signature_verified')::boolean,
    (v_run->>'control_totals_verified')::boolean,
    (v_run->>'sources_complete')::boolean,
    true,
    CASE WHEN v_run->>'state' IN ('balanced', 'differences_found', 'failed') THEN now() END
  );

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_request->'facts')
  LOOP
    INSERT INTO pollycar_finance.reconciliation_facts (
      reconciliation_fact_id, reconciliation_run_id, source, record_type, business_date,
      merchant_id, internal_order_id, provider_order_id, provider_event_id,
      amount_minor, fee_minor, currency, state, occurred_at, settled_at,
      source_digest, late, synthetic
    )
    VALUES (
      v_record->>'reconciliation_fact_id', v_run_id, v_record->>'source',
      v_record->>'record_type', (v_record->>'business_date')::date,
      v_record->>'merchant_id', v_record->>'internal_order_id',
      v_record->>'provider_order_id', v_record->>'provider_event_id',
      (v_record->>'amount_minor')::bigint, (v_record->>'fee_minor')::bigint,
      v_record->>'currency', v_record->>'state',
      (v_record->>'occurred_at')::timestamptz, (v_record->>'settled_at')::timestamptz,
      v_record->>'source_digest', (v_record->>'late')::boolean, true
    );
  END LOOP;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_request->'differences')
  LOOP
    INSERT INTO pollycar_finance.reconciliation_items (
      reconciliation_item_id, reconciliation_run_id, difference_type,
      internal_reference, provider_reference, internal_amount_minor,
      provider_amount_minor, difference_amount_minor, currency, state,
      risk_level, details, synthetic
    )
    VALUES (
      v_record->>'reconciliation_item_id', v_run_id, v_record->>'difference_type',
      v_record->>'internal_reference', v_record->>'provider_reference',
      (v_record->>'internal_amount_minor')::bigint,
      (v_record->>'provider_amount_minor')::bigint,
      (v_record->>'difference_amount_minor')::bigint,
      v_record->>'currency', v_record->>'state', v_record->>'risk_level',
      v_record->'details', true
    );
  END LOOP;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_request->'recovery_actions')
  LOOP
    INSERT INTO pollycar_finance.reconciliation_recovery_actions (
      recovery_action_id, reconciliation_run_id, reconciliation_item_id,
      action_type, state, attempts, synthetic
    )
    VALUES (
      v_record->>'recovery_action_id', v_run_id,
      v_record->>'reconciliation_item_id', v_record->>'action_type',
      v_record->>'state', (v_record->>'attempts')::integer, true
    );
  END LOOP;

  RETURN QUERY SELECT v_run_id, false;
END
$$;

CREATE FUNCTION pollycar_finance.close_reconciliation_run(p_run_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  UPDATE pollycar_finance.reconciliation_runs AS run
     SET state = 'closed',
         completed_at = now()
   WHERE run.reconciliation_run_id = p_run_id
     AND run.state = 'balanced'
     AND run.difference_count = 0
     AND run.difference_amount_minor = 0
     AND run.statement_signature_verified
     AND run.control_totals_verified
     AND run.sources_complete
     AND NOT EXISTS (
       SELECT 1
         FROM pollycar_finance.reconciliation_items AS item
        WHERE item.reconciliation_run_id = run.reconciliation_run_id
          AND item.state <> 'resolved'
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECONCILIATION_RUN_NOT_BALANCED';
  END IF;
END
$$;

CREATE FUNCTION pollycar_finance.assert_reconciliation_action_allowed(
  p_run_id text,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  IF p_action NOT IN ('settlement', 'payout', 'close')
     OR NOT EXISTS (
       SELECT 1
         FROM pollycar_finance.reconciliation_runs AS run
        WHERE run.reconciliation_run_id = p_run_id
          AND run.state = 'closed'
          AND run.difference_count = 0
          AND run.difference_amount_minor = 0
          AND run.statement_signature_verified
          AND run.control_totals_verified
          AND run.sources_complete
          AND NOT EXISTS (
            SELECT 1
              FROM pollycar_finance.reconciliation_items AS item
             WHERE item.reconciliation_run_id = run.reconciliation_run_id
               AND item.state <> 'resolved'
          )
     ) THEN
    RAISE EXCEPTION 'RECONCILIATION_ACTION_BLOCKED';
  END IF;
END
$$;

CREATE FUNCTION pollycar_finance.close_financial_business_date(
  p_business_date date,
  p_prepared_by text,
  p_reviewed_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  IF btrim(p_prepared_by) = ''
     OR btrim(p_reviewed_by) = ''
     OR p_prepared_by = p_reviewed_by THEN
    RAISE EXCEPTION 'RECONCILIATION_REVIEWER_MUST_DIFFER';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pollycar_finance.reconciliation_runs
     WHERE business_date = p_business_date
  )
  OR EXISTS (
    SELECT 1
      FROM pollycar_finance.reconciliation_runs
     WHERE business_date = p_business_date
       AND state <> 'closed'
  ) THEN
    RAISE EXCEPTION 'RECONCILIATION_RUNS_NOT_CLOSED';
  END IF;

  INSERT INTO pollycar_finance.financial_business_days (
    business_date, state, prepared_by, reviewed_by, synthetic
  )
  VALUES (p_business_date, 'closed', p_prepared_by, p_reviewed_by, true)
  ON CONFLICT (business_date) DO NOTHING;
END
$$;

CREATE FUNCTION pollycar_finance.record_reconciliation_recovery_result(
  p_recovery_action_id text,
  p_succeeded boolean,
  p_error_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  UPDATE pollycar_finance.reconciliation_recovery_actions
     SET state = CASE WHEN p_succeeded THEN 'completed' ELSE 'failed' END,
         attempts = attempts + 1,
         last_error_code = CASE WHEN p_succeeded THEN NULL ELSE p_error_code END,
         updated_at = now()
   WHERE recovery_action_id = p_recovery_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECONCILIATION_RECOVERY_NOT_FOUND';
  END IF;
END
$$;

CREATE FUNCTION pollycar_finance.resolve_reconciliation_item(
  p_reconciliation_item_id text,
  p_resolution_type text,
  p_resolved_by text,
  p_reviewed_by text,
  p_resolution_evidence_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
DECLARE
  v_run_id text;
BEGIN
  IF COALESCE(btrim(p_resolution_type), '') = ''
     OR COALESCE(btrim(p_resolved_by), '') = ''
     OR COALESCE(btrim(p_reviewed_by), '') = ''
     OR COALESCE(btrim(p_resolution_evidence_reference), '') = '' THEN
    RAISE EXCEPTION 'RECONCILIATION_RESOLUTION_EVIDENCE_REQUIRED';
  END IF;
  IF p_resolved_by = p_reviewed_by THEN
    RAISE EXCEPTION 'RECONCILIATION_REVIEWER_MUST_DIFFER';
  END IF;

  UPDATE pollycar_finance.reconciliation_items
     SET state = 'resolved',
         resolved_at = now(),
         resolution_type = p_resolution_type,
         resolved_by = p_resolved_by,
         reviewed_by = p_reviewed_by,
         resolution_evidence_reference = p_resolution_evidence_reference
   WHERE reconciliation_item_id = p_reconciliation_item_id
     AND state = 'open'
  RETURNING reconciliation_run_id INTO v_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECONCILIATION_ITEM_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pollycar_finance.reconciliation_items
     WHERE reconciliation_run_id = v_run_id
       AND state = 'open'
  ) THEN
    UPDATE pollycar_finance.reconciliation_runs
       SET state = 'balanced',
           difference_count = 0,
           difference_amount_minor = 0,
           completed_at = now()
     WHERE reconciliation_run_id = v_run_id
       AND statement_signature_verified
       AND control_totals_verified
       AND sources_complete;
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA pollycar_finance FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pollycar_finance FROM PUBLIC;

GRANT SELECT ON
  pollycar_finance.reconciliation_runs,
  pollycar_finance.reconciliation_facts,
  pollycar_finance.reconciliation_items,
  pollycar_finance.reconciliation_recovery_actions,
  pollycar_finance.financial_business_days
TO pollycar_ledger_runtime, pollycar_ledger_maintenance, pollycar_ledger_auditor;

GRANT EXECUTE ON FUNCTION pollycar_finance.record_reconciliation_evaluation(jsonb)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.close_reconciliation_run(text)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.assert_reconciliation_action_allowed(text, text)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.close_financial_business_date(date, text, text)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.record_reconciliation_recovery_result(text, boolean, text)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.resolve_reconciliation_item(text, text, text, text, text)
  TO pollycar_ledger_runtime;

RESET ROLE;
