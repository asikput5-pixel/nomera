create table if not exists players (
  tg_id bigint primary key,
  name text not null default 'Игрок',
  save jsonb not null,
  cap numeric not null default 0,
  sp int not null default 0,
  lvl int not null default 1,
  cnt jsonb not null default '[]',
  ch numeric not null default 0,
  cl text not null default '',
  cd numeric not null default 0,
  hu jsonb not null default '[]',
  updated_at bigint not null default 0
);
create index if not exists players_cap_idx on players (cap desc);
create table if not exists uniques (
  kind text primary key,
  holder bigint,
  name text,
  num text,
  ts bigint
);
create table if not exists feed (
  id int primary key default 1,
  ev jsonb
);
create table if not exists market (
  id bigserial primary key,
  seller bigint not null,
  seller_name text,
  plate jsonb not null,
  r int not null,
  price numeric not null,
  sold boolean not null default false,
  buyer bigint,
  created_at bigint not null
);
create index if not exists market_open_idx on market (sold, created_at desc);
