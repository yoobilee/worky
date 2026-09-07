# Supabase security: local validation design

Production is inspected exclusively through supabase-readonly metadata SELECTs.
No production migration or data mutation is performed by this work.

## Separate migrations

1. `20260906000000_restore_missing_public_tables.sql`: reproduce members,
   data_cleaner_history, seating_desks, and user_notifications, including column
   order, types, defaults, nullability, named PK/FK constraints, and 15 existing
   owner policies. Preserve legacy contacts_pkey and contacts_user_id_fkey names.
   All four tables have RLS enabled without FORCE, only PK indexes, and no
   additional UNIQUE/CHECK constraints. No privilege hardening belongs here.
2. `20260906005000_restore_user_settings_columns.sql`: reproduce five missing
   settings columns discovered during local browser validation. Preserve their
   nullable types/defaults; local ordinal positions differ because ALTER appends
   columns after the already-recorded GitHub columns. No table rebuild is done.
3. `20260906007500_restore_remaining_public_schema.sql`: reproduce the remaining
   hosted application schema used by announcements, Q&A updates, clients,
   language selection, and speed-dial customization. Preserve announcement read
   rows while restoring its hosted primary/unique key shape and owner policies.
4. `20260906010000_public_api_least_privileges.sql`: explicitly reduce client
   privileges and add restrictive INSERT/UPDATE seating member-owner guards.
   Keep notification INSERT because the browser uses it. Preserve service_role.

The metadata was rechecked on 2026-09-07. CREATE IF NOT EXISTS and policy-name
checks do not prove existing definitions match; compare catalogs after applying.
Do not copy production rows or reproduce excessive client grants solely to make
ACL snapshots equal. Report intended security differences separately.

## Reproducibility and validation

- First run the complete migration history on a fresh local stack.
- The historical 20260806000000 seed originally required a pre-existing fixed
  guest Auth account. Its demo-only block now exits with NOTICE when that account
  is absent. Never import the production account to bypass local setup.
- Use a clearly identified isolated local fixture for subsequent targeted SQL
  tests if full-history replay fails. This is not full-history success.
- Compare columns, constraints, indexes and original policies before hardening;
  compare allowed privileges and extra restrictive policies after hardening.
- Exercise same-owner and NULL member references, denied cross-owner INSERT and
  UPDATE, and deletion of a member with ON DELETE SET NULL using synthetic rows.
- Exercise anon/authenticated role privileges and ensure no destructive table
  privileges remain. Verify service_role behavior independently.
- Check future function privileges: schema-scoped REVOKE cannot remove the
  built-in global PUBLIC EXECUTE default. Do not claim function opt-in is solved
  until an actual new-function privilege test proves it. A global default change
  affects other schemas and requires a separately reviewed scope decision.
- Keep supabase_admin defaults and clients publication unchanged. The internal
  role is environment-specific; external clients cannot be ruled out from code.

Local SQL success does not prove hosted-role permissions, production rollout,
or application E2E behavior. Keep those validation results separate.

## Observed full-history attempt (2026-09-07)

- Supabase CLI: 2.116.0; Docker server: 29.7.2.
- `supabase start` downloaded the stack, initialized PostgreSQL 17.6.1.165,
  seeded platform roles, and passed the first ten repository migrations.
- `20260806000000_seed_guest_demo_data.sql` failed at statement 0 with SQLSTATE
  P0001 because its prerequisite guest Auth account does not exist in a fresh DB.
- CLI exit code: 1. It reported stopping containers. The restoration and security
  migrations were not reached. This is a failed full-history replay, not a pass.
- No production data was imported and no history entry was skipped or repaired.
- Production column/constraint/index/policy/ACL metadata was rechecked via
  supabase-readonly SELECTs and matches the restoration draft on static review.
- At this initial attempt, runtime schema comparison, role/RLS behavioral tests,
  application E2E, and hosted rollout validation remained unperformed. See the
  subsequent targeted results below.

The user selected the isolated synthetic-fixture approach, then the demo-only
migration was amended after both branches were covered by local tests. Adding a
late CREATE migration alone could not repair the earlier seed failure.

## Targeted fixture results (2026-09-07)

Run `npm run test:db:security` with Docker Desktop running and the previously
downloaded `public.ecr.aws/supabase/postgres:17.6.1.165` image available. The runner
uses `--pull=never`; it does not install tools or download images. It creates a
uniquely named container with no network, no published ports, and tmpfs database
storage. It uses `docker exec` and container-local psql, never a connection URL,
project link, or .env credentials. Cleanup removes only the container it created
after checking its test label, along with its disposable data/anonymous volumes.
Abrupt termination of the runner can leave its labeled container for inspection.

The harness uses the image's roles and a separate empty database. Its minimal
Auth fixture contains only the users PK and auth.uid()/auth.role() contracts;
it does not reproduce GoTrue, Auth migrations, sessions, PostgREST, or Realtime.
All row fixtures are synthetic. Output contains pass labels and counts, not rows.

The fixture executes every repository migration in filename order. It exercises
the absent-account seed path during that pass, then injects a synthetic user with
the designated local ID to exercise the present-account path and reset function.
It does not create or repair a migration-history table; Supabase CLI replay is
verified independently below.

40 checks passed, including:

- Exact metadata comparison against `supabase/tests/security/production-schema.json`,
  obtained using the read-only `schema-snapshot.sql` SELECT through
  `mcp__supabase_readonly__execute_sql`. The snapshot contains schema metadata only:
  34 columns, 9 constraints, 4 indexes, 15 original policies, RLS/FORCE flags,
  owners, publication membership, and absence of non-internal triggers.
- The cross-owner INSERT vulnerability reproduced before hardening. After
  hardening, cross-owner INSERT/UPDATE, nonexistent member references, spoofed
  desk ownership, and owner transfers of desks/members are denied.
- Same-owner/NULL desk references work; deleting a member clears its desk FK;
  other-owner rows remain hidden and cannot be updated/deleted; Auth deletion
  cascades; notification INSERT/UPDATE and calendar SQL CRUD/triggers work.
- All 240 effective table privilege checks (15 tables x 2 roles x 8 privileges)
  match the allowed matrix. service_role grants/bypass remain unchanged.
- Missing prerequisites and existing cross-owner references abort application.
  Both new migrations can be rerun in this fixture. The runner uses explicit
  transactions for migration application and rolls back negative test cases.
- Future postgres-created table/sequence client grants are removed. Future
  function EXECUTE remains accessible: a real function test confirms that a
  schema-scoped REVOKE cannot remove the global PUBLIC default.

The initial harness attempts exposed readiness timing during the image's
temporary initialization server and a missing auth.role() fixture helper.
Both harness issues were corrected before the successful fresh-container run.

The hardening draft now raises an exception for missing required tables instead
of skipping them. Its ineffective function-default REVOKE was removed, with an
explicit explanation of the deferred global-default review. supabase_admin
defaults and publication membership remain unchanged. A production catalog-only
SELECT confirmed no explicit column ACLs on the 15 in-scope tables at inspection.
Future column grants or global/inherited grants require renewed auditing.

## Remaining validation and decisions

- Unit tests: 7 passed across 2 files (`npm run test:unit`).
- Production build: passed (`npm run build`), including lint/type checks and
  generation of 34 static pages. The command used process-local loopback Supabase
  URL and placeholder client/server keys to avoid production DB access. This
  build output is for verification and must not be deployed with those values.
- Guest and Calendar CRUD browser E2E were not covered by the PostgreSQL-only
  fixture. Subsequent local Auth/API results are recorded below.
- Clean full-history replay: passed twice through Supabase CLI, first with
  `supabase start` and then `supabase db reset`; all 22 migrations applied.
- Hosted migration-runner privileges, full production-schema parity outside
  these four tables, external Realtime consumers, and rollout behavior are not
  validated by this fixture.
- Function defaults and supabase_admin defaults need a separate scope review.
  New sensitive functions should revoke EXECUTE explicitly in their migration.
- At validation time there was no commit, push, PR creation, production DB
  change, or publication change. Delivery actions are tracked separately.

## Local Auth/API browser fixture

`npm run test:e2e:local-security` starts the separate `worky-security-e2e`
Supabase project under `supabase/tests/e2e-stack`, with API port 55321 and DB
port 55322. It refuses existing fixture containers/volumes or occupied ports.
The normal Worky project configuration and historical migrations are preserved.
The local stack uses PostgreSQL, GoTrue, PostgREST, Kong, and Realtime.

The runner applies all 22 repository migrations without exclusions, then creates
two synthetic accounts via the local Auth admin API. Account IDs are newly
generated; no production Auth
rows or fixed production account ID are imported. The guest account follows the
existing public demo login contract. A distinct synthetic account runs Calendar
CRUD. Settings are seeded through the local admin API.

The browser process receives only local Supabase credentials. Dotenv variable
names are overridden before Next loads them; their stored values are not passed
to the browser-test process. Existing tests mock external AI/weather requests.
`playwright.local-security.config.ts` requires the local-run marker and exact
loopback API URL, rejects server reuse, and disables traces/screenshots/video.
The reporter exposes status and source locations only. Raw assertion payloads,
credentials, URLs with query strings, and row values are not logged.

The runner verifies Calendar row cleanup and stops only its own project with
`--no-backup`, removing disposable fixture volumes. It does not install Chromium;
if no installed executable is found it stops before starting the stack. An
abruptly interrupted runner may need its specific local project cleaned up.

## Browser validation results (2026-09-07)

The first real local-stack run passed all three Calendar scenarios but timed out
in guest navigation. The guest was logged in and on Home; an onboarding overlay
blocked the calendar link. Investigation found that five columns requested by
getSettings() were missing from repository migrations, so its API error returned
null and was interpreted as a new account. Empty fixture data alone was not the
cause. `custom_field_keys` was already recorded by the earlier clients custom
fields migration.

Read-only production catalog queries confirmed these nullable columns and defaults:

| Column | Type | Default |
| --- | --- | --- |
| join_date | date | none |
| leave_standard | text | 'fiscal_year'::text |
| used_leaves | numeric (unbounded) | 0 |
| employment_type | text | 'new'::text |
| granted_leaves | numeric (unbounded) | 0 |

No additional CHECK/UNIQUE/FK constraint covers these columns. The new separate
schema-only migration restores them without modifying the application or the
existing E2E scenarios. Local column order differs from production because the
restored columns are appended; logical named-column behavior is verified, not
whole-table ordinal parity for user_settings.

After that restoration, a fresh local Auth/API run passed all four scenarios:
Calendar CRUD with real local persistence, duplicate-delete protection, failed
update/zero-row-delete handling, and guest login/Home/calendar navigation.
Calendar cleanup left 0 rows. All five local Supabase containers and disposable
volumes were removed. SQL security checks later passed with seed coverage (40);
unit tests passed
again (7). The production build also passed again with loopback-only Supabase
configuration and placeholder keys. `git diff --check` passed.

A separate `tsc --noEmit` check initially reported three diagnostics in the
Calendar E2E: the ws transport constructor type and two locator element click
types. Explicit runtime-compatible casts now document those boundaries;
`tsc --noEmit` passes. Browser behavior is rechecked after the type-only edit.

## Historical seed repair

The failure is an ordering dependency: the historical seed is a migration that
requires a particular Auth account before any demo INSERT can succeed. Normal
seed files run only after all migrations, so merely adding `supabase/seed.sql`
does not fix the earlier failure. See the
[official seed execution order](https://supabase.com/docs/guides/local-development/seeding-your-database).

Implemented and verified behavior:

1. The historical demo-only migration wraps the entire demo-data insertion block
   in a guard. If its designated account is absent, it emits a clear NOTICE and
   returns without demo inserts. It preserves the existing insertion behavior
   when that account exists. Removing only the
   initial exception would leave later FK failures and is insufficient.
2. Local demo/test accounts are provisioned through local Auth after migrations;
   their synthetic data uses the returned local account IDs.
3. The production reset function's fixed target, service-role-only execution,
   and `.github/workflows/reset-guest-demo.yml` schedule remain unchanged.
4. Both seed branches, a fresh `supabase start`, a subsequent `supabase db reset`,
   and the local Auth/API browser flows pass without migration exclusions.

This amendment changes only fresh replay of an already-deployed migration. No
production migration-history row is deleted, renamed, repaired, or reapplied.
