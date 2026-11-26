-- P0.1: extensions required by docs/PLAN.md §11 and §12.3.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;
