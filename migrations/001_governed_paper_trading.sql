BEGIN;

CREATE TABLE IF NOT EXISTS finance_market_events (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,provider TEXT NOT NULL,provider_contract_ref TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  symbol TEXT NOT NULL,price NUMERIC(24,8) NOT NULL CHECK(price>0),volume NUMERIC(24,8) NOT NULL CHECK(volume>=0),
  source_timestamp TIMESTAMPTZ NOT NULL,ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_hash CHAR(64) NOT NULL,provenance JSONB NOT NULL,PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,provider,external_event_id)
);

CREATE TABLE IF NOT EXISTS finance_limit_policies (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','active','retired')),
  max_order_notional NUMERIC(24,8) NOT NULL CHECK(max_order_notional>0),
  max_gross_exposure NUMERIC(24,8) NOT NULL CHECK(max_gross_exposure>0),
  max_net_exposure NUMERIC(24,8) NOT NULL CHECK(max_net_exposure>0),
  max_daily_loss NUMERIC(24,8) NOT NULL CHECK(max_daily_loss>0),
  min_liquidity NUMERIC(24,8) NOT NULL CHECK(min_liquidity>0),
  max_staleness_seconds INTEGER NOT NULL CHECK(max_staleness_seconds>0),
  max_risk_snapshot_staleness_seconds INTEGER NOT NULL CHECK(max_risk_snapshot_staleness_seconds>0),
  min_cash_reserve NUMERIC(24,8) NOT NULL CHECK(min_cash_reserve>=0),
  payload_hash CHAR(64) NOT NULL,idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,approved_by TEXT,reason TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,account_ref,version),
  UNIQUE(tenant_id,account_ref,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_limit
  ON finance_limit_policies(tenant_id,account_ref) WHERE state='active';

CREATE TABLE IF NOT EXISTS finance_kill_switch_events (
  seq BIGSERIAL PRIMARY KEY,tenant_id TEXT NOT NULL,account_ref TEXT NOT NULL,enabled BOOLEAN NOT NULL,
  actor_id TEXT NOT NULL,reason TEXT NOT NULL,idempotency_key TEXT NOT NULL,request_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,account_ref,idempotency_key)
);

CREATE TABLE IF NOT EXISTS finance_limit_policy_events (
  seq BIGSERIAL PRIMARY KEY,tenant_id TEXT NOT NULL,policy_id UUID NOT NULL,actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN('created','approved','retired')),details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(tenant_id,policy_id) REFERENCES finance_limit_policies(tenant_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_risk_snapshots (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,provider TEXT NOT NULL,
  provider_contract_ref TEXT NOT NULL,
  external_event_id TEXT NOT NULL,gross_exposure NUMERIC(24,8) NOT NULL CHECK(gross_exposure>=0),
  net_exposure NUMERIC(24,8) NOT NULL,
  daily_pnl NUMERIC(24,8) NOT NULL,available_cash NUMERIC(24,8) NOT NULL CHECK(available_cash>=0),
  custody_account_ref TEXT NOT NULL,source_timestamp TIMESTAMPTZ NOT NULL,
  payload_hash CHAR(64) NOT NULL,provenance JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,provider,external_event_id)
);

CREATE TABLE IF NOT EXISTS finance_paper_orders (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,custody_account_ref TEXT NOT NULL,
  client_order_id TEXT NOT NULL,symbol TEXT NOT NULL,side TEXT NOT NULL CHECK(side IN('buy','sell')),
  quantity NUMERIC(24,8) NOT NULL CHECK(quantity>0),limit_price NUMERIC(24,8) NOT NULL CHECK(limit_price>0),
  filled_quantity NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK(filled_quantity>=0 AND filled_quantity<=quantity),
  state TEXT NOT NULL CHECK(state IN('risk_rejected','paper_approved','partially_filled','filled','corrected','cancelled')),
  risk_result JSONB NOT NULL,market_event_id UUID NOT NULL,limit_policy_id UUID NOT NULL,risk_snapshot_id UUID NOT NULL,
  request_hash CHAR(64) NOT NULL,idempotency_key TEXT NOT NULL,created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,account_ref,client_order_id),
  UNIQUE(tenant_id,account_ref,idempotency_key),
  FOREIGN KEY(tenant_id,market_event_id) REFERENCES finance_market_events(tenant_id,id),
  FOREIGN KEY(tenant_id,limit_policy_id) REFERENCES finance_limit_policies(tenant_id,id),
  FOREIGN KEY(tenant_id,risk_snapshot_id) REFERENCES finance_risk_snapshots(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS finance_operation_rejections (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,request_hash CHAR(64) NOT NULL,failures JSONB NOT NULL,actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,account_ref,idempotency_key)
);

CREATE TABLE IF NOT EXISTS finance_order_events (
  seq BIGSERIAL PRIMARY KEY,tenant_id TEXT NOT NULL,order_id UUID NOT NULL,actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,reason TEXT,details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(tenant_id,order_id) REFERENCES finance_paper_orders(tenant_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_fills (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,order_id UUID NOT NULL,provider TEXT NOT NULL,
  provider_contract_ref TEXT NOT NULL,external_fill_id TEXT NOT NULL,
  quantity NUMERIC(24,8) NOT NULL,price NUMERIC(24,8) NOT NULL CHECK(price>0),fee_amount NUMERIC(24,8) NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,payload_hash CHAR(64) NOT NULL,provenance JSONB NOT NULL,
  correction_of UUID,recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,provider,external_fill_id),
  CHECK((correction_of IS NULL AND quantity>0 AND fee_amount>=0)
    OR (correction_of IS NOT NULL AND quantity<0 AND fee_amount<=0)),
  FOREIGN KEY(tenant_id,order_id) REFERENCES finance_paper_orders(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,correction_of) REFERENCES finance_fills(tenant_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_journals (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,order_id UUID,fill_id UUID,journal_type TEXT NOT NULL,
  reversal_of UUID,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES finance_paper_orders(tenant_id,id),
  FOREIGN KEY(tenant_id,fill_id) REFERENCES finance_fills(tenant_id,id),
  FOREIGN KEY(tenant_id,reversal_of) REFERENCES finance_journals(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS finance_ledger_entries (
  seq BIGSERIAL PRIMARY KEY,tenant_id TEXT NOT NULL,journal_id UUID NOT NULL,ledger_account TEXT NOT NULL,
  signed_amount NUMERIC(24,8) NOT NULL,currency TEXT NOT NULL DEFAULT 'USD',details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(tenant_id,journal_id) REFERENCES finance_journals(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE(tenant_id,journal_id,ledger_account,currency)
);

CREATE TABLE IF NOT EXISTS finance_corporate_actions (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,provider TEXT NOT NULL,provider_contract_ref TEXT NOT NULL,
  external_action_id TEXT NOT NULL,
  symbol TEXT NOT NULL,action_type TEXT NOT NULL CHECK(action_type IN('split','dividend','merger','symbol_change')),
  effective_at TIMESTAMPTZ NOT NULL,source_timestamp TIMESTAMPTZ NOT NULL,terms JSONB NOT NULL,
  provenance JSONB NOT NULL,payload_hash CHAR(64) NOT NULL,recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,provider,external_action_id)
);

CREATE TABLE IF NOT EXISTS finance_reconciliations (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,provider TEXT NOT NULL,
  provider_contract_ref TEXT NOT NULL,external_event_id TEXT NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,internal_notional NUMERIC(24,8) NOT NULL,
  provider_notional NUMERIC(24,8) NOT NULL,difference NUMERIC(24,8) NOT NULL,
  status TEXT NOT NULL CHECK(status IN('matched','exception')),evidence JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,provider,external_event_id)
);

CREATE TABLE IF NOT EXISTS finance_scenario_runs (
  tenant_id TEXT NOT NULL,id UUID NOT NULL,account_ref TEXT NOT NULL,name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,request_hash CHAR(64) NOT NULL,input JSONB NOT NULL,result JSONB NOT NULL,
  result_hash CHAR(64) NOT NULL,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,account_ref,idempotency_key)
);

CREATE INDEX IF NOT EXISTS finance_market_lookup ON finance_market_events(tenant_id,symbol,source_timestamp DESC);
CREATE INDEX IF NOT EXISTS finance_order_state_lookup ON finance_paper_orders(tenant_id,account_ref,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS finance_fill_order_lookup ON finance_fills(tenant_id,order_id,created_at);
CREATE INDEX IF NOT EXISTS finance_reconciliation_lookup ON finance_reconciliations(tenant_id,account_ref,source_timestamp DESC);

CREATE OR REPLACE FUNCTION finance_immutable_records() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance audit and ledger records are immutable';
END
$$;
DROP TRIGGER IF EXISTS finance_order_events_immutable ON finance_order_events;
CREATE TRIGGER finance_order_events_immutable BEFORE UPDATE OR DELETE ON finance_order_events
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_ledger_entries_immutable ON finance_ledger_entries;
CREATE TRIGGER finance_ledger_entries_immutable BEFORE UPDATE OR DELETE ON finance_ledger_entries
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_kill_events_immutable ON finance_kill_switch_events;
CREATE TRIGGER finance_kill_events_immutable BEFORE UPDATE OR DELETE ON finance_kill_switch_events
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_market_events_immutable ON finance_market_events;
CREATE TRIGGER finance_market_events_immutable BEFORE UPDATE OR DELETE ON finance_market_events
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_risk_snapshots_immutable ON finance_risk_snapshots;
CREATE TRIGGER finance_risk_snapshots_immutable BEFORE UPDATE OR DELETE ON finance_risk_snapshots
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_fills_immutable ON finance_fills;
CREATE TRIGGER finance_fills_immutable BEFORE UPDATE OR DELETE ON finance_fills
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_journals_immutable ON finance_journals;
CREATE TRIGGER finance_journals_immutable BEFORE UPDATE OR DELETE ON finance_journals
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_limit_policy_events_immutable ON finance_limit_policy_events;
CREATE TRIGGER finance_limit_policy_events_immutable BEFORE UPDATE OR DELETE ON finance_limit_policy_events
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_corporate_actions_immutable ON finance_corporate_actions;
CREATE TRIGGER finance_corporate_actions_immutable BEFORE UPDATE OR DELETE ON finance_corporate_actions
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_reconciliations_immutable ON finance_reconciliations;
CREATE TRIGGER finance_reconciliations_immutable BEFORE UPDATE OR DELETE ON finance_reconciliations
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_scenario_runs_immutable ON finance_scenario_runs;
CREATE TRIGGER finance_scenario_runs_immutable BEFORE UPDATE OR DELETE ON finance_scenario_runs
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();
DROP TRIGGER IF EXISTS finance_operation_rejections_immutable ON finance_operation_rejections;
CREATE TRIGGER finance_operation_rejections_immutable BEFORE UPDATE OR DELETE ON finance_operation_rejections
FOR EACH ROW EXECUTE FUNCTION finance_immutable_records();

CREATE OR REPLACE FUNCTION finance_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total NUMERIC(24,8); bad_currency TEXT;
BEGIN
  SELECT currency,SUM(signed_amount) INTO bad_currency,total FROM finance_ledger_entries
  WHERE tenant_id=NEW.tenant_id AND journal_id=NEW.journal_id
  GROUP BY currency HAVING SUM(signed_amount)<>0 LIMIT 1;
  IF bad_currency IS NOT NULL THEN
    RAISE EXCEPTION 'finance journal % is unbalanced by % %',NEW.journal_id,total,bad_currency;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS finance_ledger_balanced ON finance_ledger_entries;
CREATE CONSTRAINT TRIGGER finance_ledger_balanced AFTER INSERT ON finance_ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_balanced_journal();

COMMIT;
