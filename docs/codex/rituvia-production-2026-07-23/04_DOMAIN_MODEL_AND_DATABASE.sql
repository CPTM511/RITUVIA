-- RITUVIA production schema skeleton.
-- Adapt to existing migrations; do not apply blindly or duplicate equivalent tables.

create extension if not exists pgcrypto;

create type auth_identity_type as enum ('email','google','apple','passkey','wallet');
create type order_status as enum ('created','checkout_created','pending','paid','failed','expired','refund_requested','refunded','partially_refunded','disputed','cancelled');
create type payment_provider as enum ('stripe','coinbase_checkout');
create type credit_type as enum ('subscription_credit','promotional_credit','purchased_credit','refund_adjustment');
create type credit_direction as enum ('grant','reserve','release','consume','reverse','expire');
create type reservation_status as enum ('active','consumed','released','expired');
create type entitlement_type as enum ('plus','permanent_object');
create type subscription_status as enum ('trialing','active','past_due','grace_period','paused','cancel_at_period_end','cancelled','expired','refunded');
create type generation_status as enum ('reserved','generating','validating','completed','failed','blocked','timed_out','cancelled');

create table users (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','locked','deletion_pending','deleted')),
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  identity_type auth_identity_type not null,
  provider_subject_hash text not null,
  email_normalized text,
  verified_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(identity_type, provider_subject_hash)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  auth_level smallint not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_prefix_hash text,
  user_agent_hash text
);
create index sessions_user_active_idx on sessions(user_id, expires_at) where revoked_at is null;

create table email_login_tokens (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  token_hash text not null unique,
  redirect_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_ip_hash text
);

create table passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  credential_id bytea not null unique,
  public_key bytea not null,
  sign_count bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table wallet_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  chain_family text not null default 'evm',
  address_normalized text not null,
  provider_hint text,
  is_primary boolean not null default false,
  verified_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(chain_family, address_normalized)
);

create table wallet_auth_nonces (
  id uuid primary key default gen_random_uuid(),
  nonce_hash text not null unique,
  session_binding_hash text not null,
  domain text not null,
  uri text not null,
  chain_id bigint not null,
  request_id uuid not null unique,
  issued_at timestamptz not null,
  not_before timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  address_normalized text,
  purpose text not null check (purpose in ('sign_in','link_wallet','step_up'))
);

create table tarot_cards (
  id smallint primary key,
  code text not null unique,
  content_version text not null,
  reviewed_content jsonb not null,
  active boolean not null default true
);

create table daily_tarot_draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  anonymous_subject_hash text,
  local_date date not null,
  timezone text not null,
  card_id smallint not null references tarot_cards(id),
  orientation text not null check (orientation in ('upright','reversed')),
  content_version text not null,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (anonymous_subject_hash is not null))
);
create unique index daily_tarot_user_unique on daily_tarot_draws(user_id, local_date) where user_id is not null;
create unique index daily_tarot_anon_unique on daily_tarot_draws(anonymous_subject_hash, local_date) where anonymous_subject_hash is not null;

create table readings (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  anonymous_subject_hash text,
  method text not null check (method in ('tarot','numerology','astrology')),
  fact_payload jsonb not null,
  content_version text not null,
  encrypted_context bytea,
  encryption_key_version text,
  created_at timestamptz not null default now(),
  check ((user_id is not null) or (anonymous_subject_hash is not null))
);
create index readings_user_created_idx on readings(user_id, created_at desc);

create table deep_readings (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_reading_id uuid references readings(id) on delete set null,
  product_code text not null,
  status generation_status not null,
  reservation_id uuid,
  encrypted_context bytea,
  encrypted_result bytea,
  encryption_key_version text,
  prompt_version text not null,
  safety_policy_version text not null,
  provider text,
  model text,
  input_tokens bigint,
  output_tokens bigint,
  cost_microunits bigint,
  content_hash text,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table intentions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_reading_id uuid references readings(id) on delete set null,
  encrypted_text bytea not null,
  encrypted_action bytea not null,
  encryption_key_version text not null,
  status text not null default 'active' check (status in ('active','completed','archived')),
  revisit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  intention_id uuid references intentions(id) on delete set null,
  ritual_session_id uuid,
  encrypted_text bytea not null,
  encryption_key_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table revisits (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  intention_id uuid not null references intentions(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','archived','cancelled')),
  encrypted_reflection bytea,
  encryption_key_version text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table catalog_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  payload jsonb not null,
  effective_at timestamptz not null,
  retired_at timestamptz,
  approved_by text not null,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_code text not null,
  catalog_version text not null,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor >= 0),
  status order_status not null default 'created',
  idempotency_key text not null,
  terms_version text not null,
  country_policy_version text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  unique(user_id, idempotency_key)
);

create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider payment_provider not null,
  provider_checkout_id text not null,
  provider_customer_id text,
  status text not null,
  amount_minor bigint not null,
  currency text not null,
  crypto_network text,
  crypto_asset text,
  crypto_wallet_address text,
  transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_checkout_id)
);

create table provider_events (
  id uuid primary key default gen_random_uuid(),
  provider payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  signature_timestamp timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  error_code text,
  unique(provider, provider_event_id)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  provider_subscription_id text not null unique,
  plan_code text not null,
  status subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  credit_type credit_type not null,
  direction credit_direction not null,
  amount integer not null check (amount > 0),
  reason text not null,
  product_code text,
  order_id uuid references orders(id),
  subscription_id uuid references subscriptions(id),
  reservation_id uuid,
  generation_id uuid,
  source_entry_id uuid references credit_ledger(id),
  idempotency_key text not null,
  expires_at timestamptz,
  terms_version text not null,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create table credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_code text not null,
  amount integer not null check (amount > 0),
  status reservation_status not null default 'active',
  idempotency_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  unique(user_id, idempotency_key)
);

alter table deep_readings add constraint deep_readings_reservation_fk foreign key (reservation_id) references credit_reservations(id);
alter table credit_ledger add constraint credit_ledger_reservation_fk foreign key (reservation_id) references credit_reservations(id);

create table credit_projection (
  user_id uuid primary key references users(id),
  subscription_available integer not null default 0 check (subscription_available >= 0),
  promotional_available integer not null default 0 check (promotional_available >= 0),
  purchased_available integer not null default 0 check (purchased_available >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  entitlement_type entitlement_type not null,
  product_code text not null,
  source_order_id uuid references orders(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, entitlement_type, product_code)
);

create table ritual_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_code text not null,
  source_ledger_id uuid not null references credit_ledger(id),
  status text not null default 'available' check (status in ('available','reserved','consumed','reversed')),
  reserved_at timestamptz,
  consumed_at timestamptz,
  ritual_session_id uuid,
  created_at timestamptz not null default now()
);

create table ritual_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references users(id),
  intention_id uuid references intentions(id) on delete set null,
  object_code text not null,
  ritual_pass_id uuid references ritual_passes(id),
  status text not null check (status in ('setup','active','paused','completed','abandoned')),
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table journal_entries add constraint journal_ritual_fk foreign key (ritual_session_id) references ritual_sessions(id) on delete set null;
alter table ritual_passes add constraint ritual_pass_session_fk foreign key (ritual_session_id) references ritual_sessions(id);

create table ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  version text not null,
  prompt_hash text not null,
  schema_version text not null,
  approved_at timestamptz not null,
  retired_at timestamptz,
  unique(product_code, version)
);

create table ai_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  deep_reading_id uuid not null references deep_readings(id) on delete cascade,
  provider text not null,
  model text not null,
  attempt_no integer not null,
  status text not null,
  request_hash text not null,
  response_hash text,
  input_tokens bigint,
  output_tokens bigint,
  latency_ms bigint,
  cost_microunits bigint,
  failure_code text,
  created_at timestamptz not null default now(),
  unique(deep_reading_id, attempt_no)
);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  actor_type text not null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  consent_type text not null,
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_exceptions jsonb not null default '[]',
  evidence_hash text
);

-- Application roles should not receive UPDATE or DELETE on credit_ledger, provider_events or audit_events.
-- Add ownership RLS policies only after the application connection strategy is defined and tested.
