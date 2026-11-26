begin;
select plan(3);

select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('pg_net', 'pg_net is installed');
select has_extension('pgcrypto', 'pgcrypto is installed');

select * from finish();
rollback;
