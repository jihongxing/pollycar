DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pollycar_ledger_owner') THEN
    CREATE ROLE pollycar_ledger_owner NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pollycar_ledger_runtime') THEN
    CREATE ROLE pollycar_ledger_runtime LOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pollycar_ledger_maintenance') THEN
    CREATE ROLE pollycar_ledger_maintenance NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pollycar_ledger_auditor') THEN
    CREATE ROLE pollycar_ledger_auditor NOLOGIN NOINHERIT;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS pollycar_finance AUTHORIZATION pollycar_ledger_owner;
ALTER SCHEMA pollycar_finance OWNER TO pollycar_ledger_owner;
GRANT INSERT, SELECT ON public.pollycar_outbox TO pollycar_ledger_owner;

SET ROLE pollycar_ledger_owner;

CREATE FUNCTION pollycar_finance.account_type_for_code(p_account_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN p_account_code IN (
      'ASSET_PROVIDER_RECEIVABLE',
      'ASSET_BANK_CASH',
      'ASSET_REFUND_CLEARING'
    ) THEN 'asset'
    WHEN p_account_code IN (
      'LIABILITY_PASSENGER_HELD',
      'LIABILITY_REFUND_PAYABLE',
      'LIABILITY_OPERATOR_ENTITLEMENT',
      'LIABILITY_DRIVER_PAYABLE',
      'LIABILITY_PAYOUT_CLEARING',
      'LIABILITY_TAX_PAYABLE'
    ) THEN 'liability'
    WHEN p_account_code = 'REVENUE_PLATFORM_SERVICE' THEN 'revenue'
    WHEN p_account_code IN (
      'EXPENSE_PROVIDER_FEE',
      'EXPENSE_OPERATOR_PAYOUT_FEE',
      'EXPENSE_DISPUTE'
    ) THEN 'expense'
    ELSE NULL
  END
$$;

CREATE FUNCTION pollycar_finance.account_dimensions_valid(
  p_account_code text,
  p_dimensions jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    jsonb_typeof(p_dimensions) = 'object'
    AND NOT EXISTS (
      SELECT 1
        FROM jsonb_each(p_dimensions) AS dimension_entry
       WHERE jsonb_typeof(dimension_entry.value) <> 'string'
          OR btrim(dimension_entry.value #>> '{}') = ''
    )
    AND ARRAY(
      SELECT dimension_key
        FROM jsonb_object_keys(p_dimensions) AS dimension_key
       ORDER BY dimension_key
    ) = CASE p_account_code
      WHEN 'ASSET_PROVIDER_RECEIVABLE'
        THEN ARRAY['merchant_account_id', 'provider_id']::text[]
      WHEN 'ASSET_BANK_CASH'
        THEN ARRAY['bank_account_ref', 'legal_entity_id']::text[]
      WHEN 'ASSET_REFUND_CLEARING'
        THEN ARRAY['merchant_account_id', 'provider_id']::text[]
      WHEN 'LIABILITY_PASSENGER_HELD'
        THEN ARRAY['payment_order_id', 'trip_id']::text[]
      WHEN 'LIABILITY_REFUND_PAYABLE'
        THEN ARRAY['passenger_account_id', 'refund_order_id']::text[]
      WHEN 'LIABILITY_OPERATOR_ENTITLEMENT'
        THEN ARRAY['operator_id', 'trip_id']::text[]
      WHEN 'LIABILITY_DRIVER_PAYABLE'
        THEN ARRAY['driver_account_id', 'trip_id']::text[]
      WHEN 'LIABILITY_PAYOUT_CLEARING'
        THEN ARRAY['operator_id', 'payout_order_id']::text[]
      WHEN 'LIABILITY_TAX_PAYABLE'
        THEN ARRAY['accounting_period', 'tax_type']::text[]
      WHEN 'REVENUE_PLATFORM_SERVICE'
        THEN ARRAY['accounting_period', 'city_code', 'product_code']::text[]
      WHEN 'EXPENSE_PROVIDER_FEE'
        THEN ARRAY['provider_id', 'provider_product']::text[]
      WHEN 'EXPENSE_OPERATOR_PAYOUT_FEE'
        THEN ARRAY['operator_id', 'payout_provider_id']::text[]
      WHEN 'EXPENSE_DISPUTE'
        THEN ARRAY['case_id', 'provider_id']::text[]
      ELSE ARRAY[]::text[]
    END
$$;

CREATE FUNCTION pollycar_finance.deterministic_uuid(p_value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (
    substr(md5(p_value), 1, 8) || '-' ||
    substr(md5(p_value), 9, 4) || '-' ||
    substr(md5(p_value), 13, 4) || '-' ||
    substr(md5(p_value), 17, 4) || '-' ||
    substr(md5(p_value), 21, 12)
  )::uuid
$$;

CREATE TABLE pollycar_finance.ledger_accounts (
  ledger_account_id uuid PRIMARY KEY,
  account_code text NOT NULL,
  account_type text NOT NULL,
  currency text NOT NULL CHECK (currency = 'CNY'),
  owner_type text NOT NULL CHECK (btrim(owner_type) <> ''),
  owner_id text NOT NULL CHECK (btrim(owner_id) <> ''),
  dimensions jsonb NOT NULL,
  dimension_key text GENERATED ALWAYS AS (dimensions::text) STORED,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  close_reason text,
  CHECK (account_type = pollycar_finance.account_type_for_code(account_code)),
  CHECK (pollycar_finance.account_dimensions_valid(account_code, dimensions)),
  CHECK (
    (state = 'open' AND closed_at IS NULL AND close_reason IS NULL)
    OR
    (state = 'closed' AND closed_at IS NOT NULL AND btrim(close_reason) <> '')
  ),
  UNIQUE (account_code, currency, owner_type, owner_id, dimension_key)
);

CREATE TABLE pollycar_finance.ledger_transactions (
  ledger_transaction_id uuid PRIMARY KEY,
  transaction_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'PAYMENT_SUCCEEDED',
    'PROVIDER_SETTLED_WITH_FEE',
    'REFUND_LIABILITY_CREATED',
    'REFUND_COMPLETED',
    'FULL_REVERSAL',
    'ALLOCATION_15_45_40',
    'DRIVER_PAYOUT_REQUESTED',
    'DRIVER_PAYOUT_COMPLETED'
  )),
  business_reference_type text NOT NULL CHECK (btrim(business_reference_type) <> ''),
  business_reference_id text NOT NULL CHECK (btrim(business_reference_id) <> ''),
  source_system text NOT NULL CHECK (source_system IN (
    'payment_aggregate',
    'trip_fulfillment',
    'refund_aggregate',
    'provider_settlement',
    'payout_aggregate',
    'reconciliation',
    'manual_finance'
  )),
  source_event_id text NOT NULL CHECK (btrim(source_event_id) <> ''),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  rule_version text NOT NULL CHECK (btrim(rule_version) <> ''),
  occurred_at timestamptz NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  reversal_of_transaction_id uuid REFERENCES pollycar_finance.ledger_transactions (
    ledger_transaction_id
  ),
  initiator_type text NOT NULL CHECK (initiator_type IN ('system', 'finance_manual')),
  reason_code text,
  review_reference text,
  state text NOT NULL CHECK (state = 'posted'),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  UNIQUE (source_system, source_event_id, transaction_type),
  UNIQUE (idempotency_key, transaction_type),
  CHECK (
    (transaction_type = 'FULL_REVERSAL' AND reversal_of_transaction_id IS NOT NULL)
    OR
    (transaction_type <> 'FULL_REVERSAL' AND reversal_of_transaction_id IS NULL)
  ),
  CHECK (
    transaction_type <> 'FULL_REVERSAL'
    OR (
      btrim(reason_code) <> ''
      AND (
        initiator_type <> 'finance_manual'
        OR btrim(review_reference) <> ''
      )
    )
  )
);

CREATE UNIQUE INDEX ledger_single_full_reversal_idx
  ON pollycar_finance.ledger_transactions (reversal_of_transaction_id)
  WHERE reversal_of_transaction_id IS NOT NULL;

CREATE TABLE pollycar_finance.ledger_entries (
  ledger_entry_id uuid PRIMARY KEY,
  ledger_transaction_id uuid NOT NULL REFERENCES pollycar_finance.ledger_transactions (
    ledger_transaction_id
  ),
  ledger_account_id uuid NOT NULL REFERENCES pollycar_finance.ledger_accounts (
    ledger_account_id
  ),
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency = 'CNY'),
  entry_sequence integer NOT NULL CHECK (entry_sequence > 0),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  UNIQUE (ledger_transaction_id, entry_sequence)
);

CREATE TABLE pollycar_finance.ledger_balance_projections (
  ledger_account_id uuid PRIMARY KEY REFERENCES pollycar_finance.ledger_accounts (
    ledger_account_id
  ),
  debit_total_minor bigint NOT NULL CHECK (debit_total_minor >= 0),
  credit_total_minor bigint NOT NULL CHECK (credit_total_minor >= 0),
  balance_minor bigint NOT NULL,
  last_transaction_sequence bigint NOT NULL CHECK (last_transaction_sequence > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic)
);

CREATE FUNCTION pollycar_finance.reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'LEDGER_IMMUTABLE';
END
$$;

CREATE FUNCTION pollycar_finance.protect_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE';
  END IF;

  IF OLD.state = 'open'
     AND NEW.state = 'closed'
     AND NEW.ledger_account_id = OLD.ledger_account_id
     AND NEW.account_code = OLD.account_code
     AND NEW.account_type = OLD.account_type
     AND NEW.currency = OLD.currency
     AND NEW.owner_type = OLD.owner_type
     AND NEW.owner_id = OLD.owner_id
     AND NEW.dimensions = OLD.dimensions
     AND NEW.created_at = OLD.created_at
     AND NEW.synthetic = OLD.synthetic
     AND NEW.closed_at IS NOT NULL
     AND btrim(NEW.close_reason) <> '' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LEDGER_IMMUTABLE';
END
$$;

CREATE TRIGGER ledger_transactions_immutable
BEFORE UPDATE OR DELETE ON pollycar_finance.ledger_transactions
FOR EACH ROW EXECUTE FUNCTION pollycar_finance.reject_ledger_mutation();

CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON pollycar_finance.ledger_entries
FOR EACH ROW EXECUTE FUNCTION pollycar_finance.reject_ledger_mutation();

CREATE TRIGGER ledger_accounts_protected
BEFORE UPDATE OR DELETE ON pollycar_finance.ledger_accounts
FOR EACH ROW EXECUTE FUNCTION pollycar_finance.protect_ledger_account();

CREATE FUNCTION pollycar_finance.assert_ledger_transaction_balanced(
  p_ledger_transaction_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  entry_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pollycar_finance.ledger_transactions AS ledger_transaction
     WHERE ledger_transaction.ledger_transaction_id = p_ledger_transaction_id
  ) THEN
    RETURN;
  END IF;

  SELECT count(*)
    INTO entry_count
    FROM pollycar_finance.ledger_entries AS ledger_entry
   WHERE ledger_entry.ledger_transaction_id = p_ledger_transaction_id;

  IF entry_count < 2 THEN
    RAISE EXCEPTION 'LEDGER_MINIMUM_ENTRIES_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT ledger_entry.currency
      FROM pollycar_finance.ledger_entries AS ledger_entry
     WHERE ledger_entry.ledger_transaction_id = p_ledger_transaction_id
     GROUP BY ledger_entry.currency
    HAVING sum(
      CASE ledger_entry.direction
        WHEN 'debit' THEN ledger_entry.amount_minor
        ELSE -ledger_entry.amount_minor
      END
    ) <> 0
  ) THEN
    RAISE EXCEPTION 'LEDGER_TRANSACTION_UNBALANCED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pollycar_finance.ledger_entries AS ledger_entry
      JOIN pollycar_finance.ledger_accounts AS ledger_account
        ON ledger_account.ledger_account_id = ledger_entry.ledger_account_id
     WHERE ledger_entry.ledger_transaction_id = p_ledger_transaction_id
       AND (
         ledger_account.currency <> ledger_entry.currency
         OR ledger_account.state <> 'open'
       )
  ) THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_CLOSED_OR_CURRENCY_MISMATCH';
  END IF;
END
$$;

CREATE FUNCTION pollycar_finance.ledger_balance_constraint_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  PERFORM pollycar_finance.assert_ledger_transaction_balanced(
    COALESCE(NEW.ledger_transaction_id, OLD.ledger_transaction_id)
  );
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER ledger_transaction_balance_after_transaction
AFTER INSERT ON pollycar_finance.ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pollycar_finance.ledger_balance_constraint_trigger();

CREATE CONSTRAINT TRIGGER ledger_transaction_balance_after_entry
AFTER INSERT ON pollycar_finance.ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pollycar_finance.ledger_balance_constraint_trigger();

CREATE FUNCTION pollycar_finance.close_ledger_account(
  p_ledger_account_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  IF btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_CLOSE_REASON_REQUIRED';
  END IF;

  UPDATE pollycar_finance.ledger_accounts
     SET state = 'closed',
         closed_at = now(),
         close_reason = p_reason
   WHERE ledger_account_id = p_ledger_account_id
     AND state = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_CLOSE_INVALID';
  END IF;
END
$$;

CREATE FUNCTION pollycar_finance.rebuild_ledger_balance_projections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pollycar_finance
AS $$
BEGIN
  DELETE FROM pollycar_finance.ledger_balance_projections;

  INSERT INTO pollycar_finance.ledger_balance_projections (
    ledger_account_id,
    debit_total_minor,
    credit_total_minor,
    balance_minor,
    last_transaction_sequence,
    updated_at,
    synthetic
  )
  SELECT
    ledger_entry.ledger_account_id,
    sum(CASE WHEN ledger_entry.direction = 'debit' THEN ledger_entry.amount_minor ELSE 0 END),
    sum(CASE WHEN ledger_entry.direction = 'credit' THEN ledger_entry.amount_minor ELSE 0 END),
    sum(
      CASE ledger_entry.direction
        WHEN 'debit' THEN ledger_entry.amount_minor
        ELSE -ledger_entry.amount_minor
      END
    ),
    max(ledger_transaction.transaction_sequence),
    now(),
    true
  FROM pollycar_finance.ledger_entries AS ledger_entry
  JOIN pollycar_finance.ledger_transactions AS ledger_transaction
    ON ledger_transaction.ledger_transaction_id = ledger_entry.ledger_transaction_id
  GROUP BY ledger_entry.ledger_account_id;
END
$$;

CREATE FUNCTION pollycar_finance.post_ledger_transaction(p_request jsonb)
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
  v_transaction_id uuid := (p_request->>'ledger_transaction_id')::uuid;
  v_transaction_type text := p_request->>'transaction_type';
  v_business_reference_type text := p_request->>'business_reference_type';
  v_business_reference_id text := p_request->>'business_reference_id';
  v_source_system text := p_request->>'source_system';
  v_source_event_id text := p_request->>'source_event_id';
  v_idempotency_key text := p_request->>'idempotency_key';
  v_request_digest text := p_request->>'request_digest';
  v_rule_version text := p_request->>'rule_version';
  v_occurred_at timestamptz := (p_request->>'occurred_at')::timestamptz;
  v_initiator_type text := p_request->>'initiator_type';
  v_reversal_of uuid := NULLIF(p_request->>'reversal_of_transaction_id', '')::uuid;
  v_reason_code text := p_request->>'reason_code';
  v_review_reference text := p_request->>'review_reference';
  v_entries jsonb := COALESCE(p_request->'entries', '[]'::jsonb);
  v_entry jsonb;
  v_account jsonb;
  v_account_id uuid;
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_existing_id uuid;
  v_existing_sequence bigint;
  v_existing_digest text;
  v_original pollycar_finance.ledger_transactions%ROWTYPE;
  v_entry_count integer;
  v_debit_total numeric;
  v_credit_total numeric;
BEGIN
  IF v_transaction_type NOT IN (
    'PAYMENT_SUCCEEDED',
    'PROVIDER_SETTLED_WITH_FEE',
    'REFUND_LIABILITY_CREATED',
    'REFUND_COMPLETED',
    'FULL_REVERSAL',
    'ALLOCATION_15_45_40',
    'DRIVER_PAYOUT_REQUESTED',
    'DRIVER_PAYOUT_COMPLETED'
  ) THEN
    RAISE EXCEPTION 'LEDGER_TRANSACTION_TYPE_INVALID';
  END IF;

  IF v_request_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'LEDGER_REQUEST_DIGEST_INVALID';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pollycar_ledger:idempotency:'
      || COALESCE(v_transaction_type, '')
      || ':'
      || COALESCE(v_idempotency_key, ''),
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'pollycar_ledger:source_event:'
      || COALESCE(v_transaction_type, '')
      || ':'
      || COALESCE(v_source_system, '')
      || ':'
      || COALESCE(v_source_event_id, ''),
      0
    )
  );

  SELECT
    existing_transaction.ledger_transaction_id,
    existing_transaction.transaction_sequence,
    existing_transaction.request_digest
  INTO v_existing_id, v_existing_sequence, v_existing_digest
  FROM pollycar_finance.ledger_transactions AS existing_transaction
  WHERE existing_transaction.idempotency_key = v_idempotency_key
    AND existing_transaction.transaction_type = v_transaction_type;

  IF FOUND THEN
    IF v_existing_digest <> v_request_digest THEN
      RAISE EXCEPTION 'LEDGER_IDEMPOTENCY_CONFLICT';
    END IF;

    RETURN QUERY SELECT v_existing_id, v_existing_sequence, true;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pollycar_finance.ledger_transactions AS existing_transaction
     WHERE existing_transaction.source_system = v_source_system
       AND existing_transaction.source_event_id = v_source_event_id
       AND existing_transaction.transaction_type = v_transaction_type
  ) THEN
    RAISE EXCEPTION 'LEDGER_SOURCE_EVENT_CONFLICT';
  END IF;

  IF v_transaction_type = 'FULL_REVERSAL' THEN
    IF jsonb_typeof(v_entries) <> 'array'
       OR jsonb_array_length(v_entries) <> 0
       OR v_reversal_of IS NULL
       OR btrim(COALESCE(v_reason_code, '')) = ''
       OR (
         v_initiator_type = 'finance_manual'
         AND btrim(COALESCE(v_review_reference, '')) = ''
       ) THEN
      RAISE EXCEPTION 'LEDGER_REVERSAL_INVALID';
    END IF;

    SELECT original_transaction.*
      INTO v_original
      FROM pollycar_finance.ledger_transactions AS original_transaction
     WHERE original_transaction.ledger_transaction_id = v_reversal_of
     FOR UPDATE;

    IF NOT FOUND
       OR v_original.transaction_type = 'FULL_REVERSAL'
       OR EXISTS (
         SELECT 1
           FROM pollycar_finance.ledger_transactions AS existing_reversal
          WHERE existing_reversal.reversal_of_transaction_id = v_reversal_of
       ) THEN
      RAISE EXCEPTION 'LEDGER_REVERSAL_INVALID';
    END IF;

    PERFORM 1
      FROM pollycar_finance.ledger_accounts AS ledger_account
     WHERE ledger_account.ledger_account_id IN (
       SELECT original_entry.ledger_account_id
         FROM pollycar_finance.ledger_entries AS original_entry
        WHERE original_entry.ledger_transaction_id = v_reversal_of
     )
     ORDER BY ledger_account.ledger_account_id
     FOR UPDATE;

    INSERT INTO pollycar_finance.ledger_transactions (
      ledger_transaction_id,
      transaction_type,
      business_reference_type,
      business_reference_id,
      source_system,
      source_event_id,
      idempotency_key,
      request_digest,
      rule_version,
      occurred_at,
      posted_at,
      reversal_of_transaction_id,
      initiator_type,
      reason_code,
      review_reference,
      state,
      synthetic
    )
    VALUES (
      v_transaction_id,
      v_transaction_type,
      v_business_reference_type,
      v_business_reference_id,
      v_source_system,
      v_source_event_id,
      v_idempotency_key,
      v_request_digest,
      v_rule_version,
      v_occurred_at,
      now(),
      v_reversal_of,
      v_initiator_type,
      v_reason_code,
      v_review_reference,
      'posted',
      true
    )
    RETURNING
      ledger_transactions.transaction_sequence
      INTO v_existing_sequence;

    INSERT INTO pollycar_finance.ledger_entries (
      ledger_entry_id,
      ledger_transaction_id,
      ledger_account_id,
      direction,
      amount_minor,
      currency,
      entry_sequence,
      synthetic
    )
    SELECT
      pollycar_finance.deterministic_uuid(
        v_transaction_id::text || ':' || original_entry.entry_sequence::text
      ),
      v_transaction_id,
      original_entry.ledger_account_id,
      CASE original_entry.direction WHEN 'debit' THEN 'credit' ELSE 'debit' END,
      original_entry.amount_minor,
      original_entry.currency,
      original_entry.entry_sequence,
      true
    FROM pollycar_finance.ledger_entries AS original_entry
    WHERE original_entry.ledger_transaction_id = v_reversal_of;

    INSERT INTO pollycar_finance.ledger_balance_projections (
      ledger_account_id,
      debit_total_minor,
      credit_total_minor,
      balance_minor,
      last_transaction_sequence,
      updated_at,
      synthetic
    )
    SELECT
      reversal_entry.ledger_account_id,
      sum(CASE WHEN reversal_entry.direction = 'debit' THEN reversal_entry.amount_minor ELSE 0 END),
      sum(CASE WHEN reversal_entry.direction = 'credit' THEN reversal_entry.amount_minor ELSE 0 END),
      sum(
        CASE reversal_entry.direction
          WHEN 'debit' THEN reversal_entry.amount_minor
          ELSE -reversal_entry.amount_minor
        END
      ),
      v_existing_sequence,
      now(),
      true
    FROM pollycar_finance.ledger_entries AS reversal_entry
    WHERE reversal_entry.ledger_transaction_id = v_transaction_id
    GROUP BY reversal_entry.ledger_account_id
    ON CONFLICT (ledger_account_id) DO UPDATE
      SET debit_total_minor =
            pollycar_finance.ledger_balance_projections.debit_total_minor
            + EXCLUDED.debit_total_minor,
          credit_total_minor =
            pollycar_finance.ledger_balance_projections.credit_total_minor
            + EXCLUDED.credit_total_minor,
          balance_minor =
            pollycar_finance.ledger_balance_projections.balance_minor
            + EXCLUDED.balance_minor,
          last_transaction_sequence = EXCLUDED.last_transaction_sequence,
          updated_at = now();
  ELSE
    IF jsonb_typeof(v_entries) <> 'array' THEN
      RAISE EXCEPTION 'LEDGER_MINIMUM_ENTRIES_REQUIRED';
    END IF;

    v_entry_count := jsonb_array_length(v_entries);
    IF v_entry_count < 2 THEN
      RAISE EXCEPTION 'LEDGER_MINIMUM_ENTRIES_REQUIRED';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_entries) AS requested_entry
       WHERE requested_entry->>'amount_minor' !~ '^[1-9][0-9]*$'
          OR requested_entry->>'currency' <> 'CNY'
          OR requested_entry->>'direction' NOT IN ('debit', 'credit')
    ) THEN
      RAISE EXCEPTION 'LEDGER_ENTRY_INVALID';
    END IF;

    SELECT
      sum(
        CASE WHEN requested_entry->>'direction' = 'debit'
          THEN (requested_entry->>'amount_minor')::numeric
          ELSE 0
        END
      ),
      sum(
        CASE WHEN requested_entry->>'direction' = 'credit'
          THEN (requested_entry->>'amount_minor')::numeric
          ELSE 0
        END
      )
    INTO v_debit_total, v_credit_total
    FROM jsonb_array_elements(v_entries) AS requested_entry;

    IF v_debit_total <> v_credit_total THEN
      RAISE EXCEPTION 'LEDGER_TRANSACTION_UNBALANCED';
    END IF;

    FOR v_entry IN
      SELECT requested_entry
        FROM jsonb_array_elements(v_entries) AS requested_entry
       ORDER BY (requested_entry->>'entry_sequence')::integer
    LOOP
      v_account := v_entry->'account';

      IF NOT pollycar_finance.account_dimensions_valid(
        v_account->>'account_code',
        v_account->'dimensions'
      ) THEN
        RAISE EXCEPTION 'LEDGER_ACCOUNT_DIMENSIONS_INVALID';
      END IF;

      INSERT INTO pollycar_finance.ledger_accounts (
        ledger_account_id,
        account_code,
        account_type,
        currency,
        owner_type,
        owner_id,
        dimensions,
        state,
        synthetic
      )
      VALUES (
        (v_account->>'ledger_account_id')::uuid,
        v_account->>'account_code',
        v_account->>'account_type',
        v_account->>'currency',
        v_account->>'owner_type',
        v_account->>'owner_id',
        v_account->'dimensions',
        'open',
        true
      )
      ON CONFLICT (account_code, currency, owner_type, owner_id, dimension_key)
      DO NOTHING;

      SELECT ledger_account.ledger_account_id
        INTO v_account_id
        FROM pollycar_finance.ledger_accounts AS ledger_account
       WHERE ledger_account.account_code = v_account->>'account_code'
         AND ledger_account.currency = v_account->>'currency'
         AND ledger_account.owner_type = v_account->>'owner_type'
         AND ledger_account.owner_id = v_account->>'owner_id'
         AND ledger_account.dimension_key = (v_account->'dimensions')::text;

      IF NOT FOUND OR EXISTS (
        SELECT 1
          FROM pollycar_finance.ledger_accounts AS ledger_account
         WHERE ledger_account.ledger_account_id = v_account_id
           AND ledger_account.state <> 'open'
      ) THEN
        RAISE EXCEPTION 'LEDGER_ACCOUNT_CLOSED';
      END IF;

      v_account_ids := array_append(v_account_ids, v_account_id);
    END LOOP;

    PERFORM 1
      FROM pollycar_finance.ledger_accounts AS ledger_account
     WHERE ledger_account.ledger_account_id = ANY(v_account_ids)
     ORDER BY ledger_account.ledger_account_id
     FOR UPDATE;

    INSERT INTO pollycar_finance.ledger_transactions (
      ledger_transaction_id,
      transaction_type,
      business_reference_type,
      business_reference_id,
      source_system,
      source_event_id,
      idempotency_key,
      request_digest,
      rule_version,
      occurred_at,
      posted_at,
      reversal_of_transaction_id,
      initiator_type,
      reason_code,
      review_reference,
      state,
      synthetic
    )
    VALUES (
      v_transaction_id,
      v_transaction_type,
      v_business_reference_type,
      v_business_reference_id,
      v_source_system,
      v_source_event_id,
      v_idempotency_key,
      v_request_digest,
      v_rule_version,
      v_occurred_at,
      now(),
      NULL,
      v_initiator_type,
      v_reason_code,
      v_review_reference,
      'posted',
      true
    )
    RETURNING
      ledger_transactions.transaction_sequence
      INTO v_existing_sequence;

    FOR v_entry IN
      SELECT requested_entry
        FROM jsonb_array_elements(v_entries) AS requested_entry
       ORDER BY (requested_entry->>'entry_sequence')::integer
    LOOP
      v_account := v_entry->'account';

      SELECT ledger_account.ledger_account_id
        INTO v_account_id
        FROM pollycar_finance.ledger_accounts AS ledger_account
       WHERE ledger_account.account_code = v_account->>'account_code'
         AND ledger_account.currency = v_account->>'currency'
         AND ledger_account.owner_type = v_account->>'owner_type'
         AND ledger_account.owner_id = v_account->>'owner_id'
         AND ledger_account.dimension_key = (v_account->'dimensions')::text;

      INSERT INTO pollycar_finance.ledger_entries (
        ledger_entry_id,
        ledger_transaction_id,
        ledger_account_id,
        direction,
        amount_minor,
        currency,
        entry_sequence,
        synthetic
      )
      VALUES (
        (v_entry->>'ledger_entry_id')::uuid,
        v_transaction_id,
        v_account_id,
        v_entry->>'direction',
        (v_entry->>'amount_minor')::bigint,
        v_entry->>'currency',
        (v_entry->>'entry_sequence')::integer,
        true
      );

      INSERT INTO pollycar_finance.ledger_balance_projections (
        ledger_account_id,
        debit_total_minor,
        credit_total_minor,
        balance_minor,
        last_transaction_sequence,
        updated_at,
        synthetic
      )
      VALUES (
        v_account_id,
        CASE WHEN v_entry->>'direction' = 'debit'
          THEN (v_entry->>'amount_minor')::bigint ELSE 0 END,
        CASE WHEN v_entry->>'direction' = 'credit'
          THEN (v_entry->>'amount_minor')::bigint ELSE 0 END,
        CASE WHEN v_entry->>'direction' = 'debit'
          THEN (v_entry->>'amount_minor')::bigint
          ELSE -(v_entry->>'amount_minor')::bigint END,
        v_existing_sequence,
        now(),
        true
      )
      ON CONFLICT (ledger_account_id) DO UPDATE
        SET debit_total_minor =
              pollycar_finance.ledger_balance_projections.debit_total_minor
              + EXCLUDED.debit_total_minor,
            credit_total_minor =
              pollycar_finance.ledger_balance_projections.credit_total_minor
              + EXCLUDED.credit_total_minor,
            balance_minor =
              pollycar_finance.ledger_balance_projections.balance_minor
              + EXCLUDED.balance_minor,
            last_transaction_sequence = EXCLUDED.last_transaction_sequence,
            updated_at = now();
    END LOOP;
  END IF;

  INSERT INTO public.pollycar_outbox (
    event_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at,
    available_at,
    synthetic
  )
  VALUES (
    'ledger-posted:' || v_transaction_id::text,
    'ledger_transaction',
    v_transaction_id::text,
    'finance.ledger.transaction_posted',
    jsonb_build_object(
      'ledger_transaction_id', v_transaction_id,
      'transaction_type', v_transaction_type,
      'source_system', v_source_system,
      'source_event_id', v_source_event_id
    ),
    v_occurred_at,
    now(),
    true
  );

  RETURN QUERY SELECT v_transaction_id, v_existing_sequence, false;
END
$$;

REVOKE ALL ON SCHEMA pollycar_finance FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA pollycar_finance FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pollycar_finance FROM PUBLIC;
REVOKE ALL ON public.pollycar_outbox FROM PUBLIC;

GRANT USAGE ON SCHEMA pollycar_finance TO
  pollycar_ledger_runtime,
  pollycar_ledger_maintenance,
  pollycar_ledger_auditor;

GRANT SELECT ON ALL TABLES IN SCHEMA pollycar_finance TO
  pollycar_ledger_runtime,
  pollycar_ledger_maintenance,
  pollycar_ledger_auditor;

GRANT EXECUTE ON FUNCTION pollycar_finance.post_ledger_transaction(jsonb)
  TO pollycar_ledger_runtime;
GRANT EXECUTE ON FUNCTION pollycar_finance.close_ledger_account(uuid, text)
  TO pollycar_ledger_maintenance;
GRANT EXECUTE ON FUNCTION pollycar_finance.rebuild_ledger_balance_projections()
  TO pollycar_ledger_maintenance;

RESET ROLE;
