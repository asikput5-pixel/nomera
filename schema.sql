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
create table if not exists feed (id int primary key default 1, ev jsonb);
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
create table if not exists supply (
  kind text not null,
  region text not null,
  cap int not null,
  taken int not null default 0,
  primary key (kind, region)
);
create table if not exists cfg (key text primary key, val jsonb);
create table if not exists duels (
  id bigserial primary key,
  creator bigint not null,
  creator_name text,
  stake numeric not null,
  status text not null default 'open',
  opponent bigint,
  opp_name text,
  winner bigint,
  created_at bigint not null
);
create index if not exists duels_open_idx on duels (status, created_at desc);
create table if not exists cw (week text not null, clan text not null, pts int not null default 0, primary key (week, clan));
create table if not exists refs (invitee bigint primary key, inviter bigint not null, paid boolean not null default false, created_at bigint not null);
create index if not exists refs_inviter_idx on refs (inviter);
alter table players add column if not exists uname text;
alter table players add column if not exists seen bigint not null default 0;
alter table players add column if not exists play bigint not null default 0;
create index if not exists players_uname_idx on players (uname);
create table if not exists clans (name text primary key, treasury numeric not null default 0);
create table if not exists goal (week text primary key, total int not null default 0);
