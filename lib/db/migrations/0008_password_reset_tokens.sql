create table "password_reset_tokens" (
  "id" uuid primary key default gen_random_uuid() not null,
  "user_id" uuid not null references users(id) on delete cascade,
  "token_hash" varchar(128) not null,
  "expires_at" timestamp with time zone not null,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  constraint "password_reset_tokens_token_hash_unique" unique ("token_hash")
);
create index "idx_prt_token_hash" on "password_reset_tokens" ("token_hash");
create index "idx_prt_user_id" on "password_reset_tokens" ("user_id");
