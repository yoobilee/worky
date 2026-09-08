// Targeted PostgreSQL tests only. Never reads .env or accepts a database URL.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const image = 'public.ecr.aws/supabase/postgres:17.6.1.165';
const name = `worky-security-test-${randomUUID()}`;
const database = 'worky_security_fixture';
let created = false;
let passed = 0;
function docker(args, input) {
  return spawnSync('docker', args, { input, encoding: 'utf8', timeout: 120000,
    maxBuffer: 4 * 1024 * 1024, windowsHide: true });
}
function check(result, label) {
  if (result.error || result.status !== 0) {
    // Suppress SQL/error detail, which can contain test rows or identifiers.
    const code = result.stderr?.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1];
    const connection = /server closed|connection|not running/.test(result.stderr ?? '');
    throw new Error(`${label} failed${code ? ` (SQLSTATE ${code})` : ''}${connection ? ' (connection unavailable)' : ''}`);
  }
  return result.stdout.trim();
}
function sql(source, db = database) {
  return docker(['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', db], source);
}
function run(source, label) { return check(sql(source), label); }
function pass(label) { passed++; console.log(`PASS ${label}`); }
function expectFailure(source, state, label) {
  const result = sql(source);
  if (result.status === 0 || !result.stderr?.includes(`ERROR:  ${state}:`)) {
    throw new Error(`${label}: expected SQLSTATE ${state}`);
  }
  pass(label);
}
function assertSQL(expression, label, prefix = '') {
  run(`BEGIN; ${prefix} DO $$ BEGIN IF (${expression}) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'assertion failed'; END IF; END $$; ROLLBACK;`, label);
  pass(label);
}
const actorA = randomUUID(), actorB = randomUUID();
const memberA = randomUUID(), memberB = randomUUID();
const deskA = randomUUID(), deskB = randomUUID();
const todoEmptyA = randomUUID(), todoNonEmptyA = randomUUID(), todoEmptyB = randomUUID();
const preservedReader = randomUUID(), preservedAnnouncement = randomUUID();
const asA = `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '${actorA}';`;
const restore = read('../../migrations/20260906000000_restore_missing_public_tables.sql');
const reconcile = read('../../migrations/20260906007500_restore_remaining_public_schema.sql');
const harden = read('../../migrations/20260906010000_public_api_least_privileges.sql');
const deleteEmptyTodo = read('../../migrations/20260908000000_delete_empty_todo_function.sql');
const schemaQuery = read('./schema-snapshot.sql');
const expectedSchema = JSON.parse(read('./production-schema.json'));

try {
  check(docker(['image', 'inspect', image]), 'required locally cached image');
  check(docker(['run', '--detach', '--pull=never', '--name', name,
    '--label', 'worky.test=security-fixture', '--network', 'none', '--no-healthcheck',
    '--tmpfs', '/var/lib/postgresql/data:rw',
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'PGDATA=/var/lib/postgresql/data',
    image, 'postgres', '-c', "listen_addresses=", '-c', 'wal_level=logical']), 'container start');
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    // The image initially serves a temporary socket while provisioning roles.
    const result = docker(['logs', name]);
    if (result.stdout?.includes('PostgreSQL init process complete') &&
        sql('SELECT 1', 'postgres').status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('local PostgreSQL readiness timeout');
  check(sql(`CREATE DATABASE ${database} OWNER postgres TEMPLATE template0;`, 'postgres'), 'fixture database');
  run(read('./bootstrap.sql'), 'minimal platform contract');
  console.log('Target: isolated container, no network/host ports, synthetic Auth contract.');
  const migrations = readdirSync(new URL('../../migrations/', import.meta.url)).filter(x => x.endsWith('.sql')).sort();
  let seedSql;
  for (const file of migrations) {
    if (file >= '20260906000000_restore_missing_public_tables.sql') continue;
    if (file === '20260806000000_seed_guest_demo_data.sql') seedSql = read(`../../migrations/${file}`);
    run(`BEGIN; ${read(`../../migrations/${file}`)} COMMIT;`, file);
  }
  assertSQL("NOT EXISTS (SELECT 1 FROM public.todos UNION ALL SELECT 1 FROM public.memos UNION ALL SELECT 1 FROM public.clients UNION ALL SELECT 1 FROM public.calendar_events UNION ALL SELECT 1 FROM public.glossary UNION ALL SELECT 1 FROM public.usage_stats UNION ALL SELECT 1 FROM public.qa_histories)", 'absent Auth account skips complete demo seed');
  const designatedGuest = seedSql?.match(/auth\.users WHERE id = '([0-9a-f-]{36})'/)?.[1];
  if (!seedSql || !designatedGuest) throw new Error('guest seed contract not found');
  run(`INSERT INTO auth.users VALUES ('${designatedGuest}'); ${seedSql}`, 'present guest seed branch');
  assertSQL(`EXISTS (SELECT 1 FROM public.todos WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.memos WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.clients WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.calendar_events WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.glossary WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.usage_stats WHERE user_id='${designatedGuest}') AND EXISTS (SELECT 1 FROM public.qa_histories WHERE user_id='${designatedGuest}')`, 'present Auth account receives complete demo seed');
  run(`SET ROLE service_role; SELECT public.reset_guest_demo_data(); RESET ROLE; DELETE FROM auth.users WHERE id='${designatedGuest}';`, 'service-role demo reset and cleanup');
  assertSQL("NOT EXISTS (SELECT 1 FROM public.todos UNION ALL SELECT 1 FROM public.memos UNION ALL SELECT 1 FROM public.clients UNION ALL SELECT 1 FROM public.calendar_events UNION ALL SELECT 1 FROM public.glossary UNION ALL SELECT 1 FROM public.usage_stats UNION ALL SELECT 1 FROM public.qa_histories)", 'demo fixture cleanup cascades');
  expectFailure(`BEGIN; ${harden} ROLLBACK;`, 'P0001', 'missing prerequisite fails closed');
  run(`BEGIN; ${restore} COMMIT;`, 'restore schema');
  run(read('../../migrations/20260906005000_restore_user_settings_columns.sql'), 'restore settings columns');
  run(`INSERT INTO auth.users VALUES ('${preservedReader}');
    INSERT INTO public.announcements(id,title,content) VALUES ('${preservedAnnouncement}','fixture','fixture');
    INSERT INTO public.announcement_reads(user_id,announcement_id) VALUES ('${preservedReader}','${preservedAnnouncement}');`, 'pre-reconciliation announcement read fixture');
  run(`BEGIN; ${reconcile} COMMIT;`, 'restore remaining public schema');
  assertSQL(`EXISTS (
      SELECT 1 FROM public.announcement_reads
      WHERE user_id='${preservedReader}' AND announcement_id='${preservedAnnouncement}' AND id IS NOT NULL
    )`, 'announcement read row preserved during primary key restoration');
  assertSQL(`EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid='public.announcement_reads'::regclass
        AND constraint_row.contype='p'
        AND constraint_row.conkey=ARRAY[(SELECT attnum::smallint FROM pg_catalog.pg_attribute WHERE attrelid='public.announcement_reads'::regclass AND attname='id')]::smallint[]
    ) AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid='public.announcement_reads'::regclass
        AND constraint_row.contype='u'
        AND constraint_row.conkey=ARRAY[
          (SELECT attnum::smallint FROM pg_catalog.pg_attribute WHERE attrelid='public.announcement_reads'::regclass AND attname='user_id'),
          (SELECT attnum::smallint FROM pg_catalog.pg_attribute WHERE attrelid='public.announcement_reads'::regclass AND attname='announcement_id')
        ]::smallint[]
    )`, 'announcement read primary and unique keys match production');
  assertSQL(`(
      SELECT count(*)=1 FROM pg_catalog.pg_policy
      WHERE polrelid='public.announcement_reads'::regclass AND polcmd='*'
        AND polroles=ARRAY[0]::oid[] AND polqual IS NOT NULL AND polwithcheck IS NOT NULL
    ) AND (
      SELECT count(*)=1 FROM pg_catalog.pg_policy
      WHERE polrelid='public.qa_histories'::regclass AND polcmd='*'
        AND polroles=ARRAY[0]::oid[] AND polqual IS NOT NULL AND polwithcheck IS NOT NULL
    )`, 'owner policies include production-equivalent update paths');
  assertSQL(`(
      SELECT column_default='gen_random_uuid()' AND is_nullable='NO'
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='announcement_reads' AND column_name='id'
    ) AND (
      SELECT column_default='''patch''::text'
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='announcements' AND column_name='type'
    ) AND (
      SELECT is_nullable='YES'
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='announcements' AND column_name='is_active'
    )`, 'announcement column metadata matches production');
  assertSQL(`(
      SELECT count(*)=3 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='clients'
        AND column_name IN ('group_name','kakao_chat_name','report_template')
        AND data_type='text' AND is_nullable='YES' AND column_default IS NULL
    ) AND (
      SELECT count(*)=1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_settings' AND column_name='language'
        AND data_type='text' AND is_nullable='NO' AND column_default='''ko''::text'
    ) AND (
      SELECT count(*)=1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_settings' AND column_name='speed_dial_custom'
        AND data_type='jsonb' AND is_nullable='YES' AND column_default='''[]''::jsonb'
    )`, 'client and settings columns match production');
  run(`BEGIN; ${reconcile} COMMIT;`, 'repeat remaining public schema restoration');
  run(`DELETE FROM auth.users WHERE id='${preservedReader}';
    DELETE FROM public.announcements WHERE id='${preservedAnnouncement}';`, 'reconciliation fixture cleanup');
  const actual = JSON.parse(run(schemaQuery, 'schema snapshot'));
  for (const key of Object.keys(expectedSchema)) {
    // Canonicalize array order independently of database locale/collation.
    const ordered = (rows) => rows.map(row => Object.fromEntries(Object.entries(row).sort()))
      .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    if (!isDeepStrictEqual(ordered(actual[key]), ordered(expectedSchema[key]))) {
      throw new Error(`production metadata mismatch: ${key}`);
    }
    pass(`production metadata matches: ${key}`);
  }
  run(`BEGIN; ${restore} COMMIT;`, 'repeat restore');
  assertSQL('(SELECT count(*) FROM pg_policies WHERE schemaname=\'public\' AND tablename IN (\'members\',\'data_cleaner_history\',\'seating_desks\',\'user_notifications\')) = 15', 'restore preserves 15 policies on rerun');
  run(`INSERT INTO auth.users VALUES ('${actorA}'), ('${actorB}');
    INSERT INTO public.members(id,user_id,name) VALUES ('${memberA}','${actorA}','fixture'), ('${memberB}','${actorB}','fixture');
    INSERT INTO public.seating_desks(id,user_id,member_id) VALUES ('${deskA}','${actorA}','${memberA}'), ('${deskB}','${actorB}','${memberB}');`, 'synthetic fixture');
  run(`BEGIN; ${asA} INSERT INTO public.seating_desks(user_id,member_id) VALUES ('${actorA}','${memberB}'); ROLLBACK;`, 'baseline vulnerability');
  pass('cross-owner insert succeeds before hardening (vulnerability reproduced)');
  expectFailure(`BEGIN; UPDATE public.seating_desks SET member_id='${memberB}' WHERE id='${deskA}'; ${harden} ROLLBACK;`, 'P0001', 'existing cross-owner reference blocks migration');
  const serviceACL = () => run("SELECT coalesce(jsonb_agg(jsonb_build_array(table_name,privilege_type) ORDER BY table_name,privilege_type),'[]') FROM information_schema.table_privileges WHERE table_schema='public' AND grantee='service_role'", 'service grants');
  const beforeService = serviceACL();
  run(`BEGIN; ${harden} COMMIT;`, 'apply hardening');
  run(`BEGIN; ${harden} COMMIT;`, 'repeat hardening');
  pass('hardening applies and reruns');
  assertSQL("(SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='seating_desks' AND permissive='RESTRICTIVE' AND roles=ARRAY['authenticated']::name[]) = 2", 'two restrictive authenticated seating guards exist');
  if (serviceACL() !== beforeService) throw new Error('service_role ACL changed');
  pass('service_role ACL unchanged');
  const grants = {
    announcements: ['SELECT'], announcement_reads: ['SELECT','INSERT','UPDATE'],
    calendar_events: ['SELECT','INSERT','UPDATE','DELETE'], clients: ['SELECT','INSERT','UPDATE','DELETE'],
    data_cleaner_history: ['SELECT','INSERT','DELETE'], glossary: ['SELECT','INSERT','UPDATE','DELETE'],
    issues: ['SELECT','INSERT','UPDATE'], members: ['SELECT','INSERT','UPDATE','DELETE'],
    memos: ['SELECT','INSERT','UPDATE'], qa_histories: ['SELECT','INSERT','UPDATE'],
    seating_desks: ['SELECT','INSERT','UPDATE','DELETE'], todos: ['SELECT','INSERT','UPDATE'],
    usage_stats: ['SELECT','INSERT','UPDATE'], user_notifications: ['SELECT','INSERT','UPDATE'],
    user_settings: ['SELECT','INSERT','UPDATE'],
  };
  const expressions = [];
  for (const [table, allowed] of Object.entries(grants)) {
    for (const role of ['anon','authenticated']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) {
        const wanted = role === 'anon' ? table === 'user_settings' && privilege === 'SELECT' : allowed.includes(privilege);
        expressions.push(`has_table_privilege('${role}','public.${table}','${privilege}') = ${wanted}`);
      }
    }
  }
  assertSQL(expressions.join(' AND '), '240 effective anon/authenticated table privileges match');
  assertSQL("NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)", 'all fixture public tables have RLS');
  assertSQL(`(SELECT count(*) FROM public.members)=1 AND (SELECT count(*) FROM public.seating_desks)=1`, 'authenticated cannot read other owner rows', asA);
  run(`BEGIN; ${asA} INSERT INTO public.seating_desks(user_id,member_id) VALUES ('${actorA}','${memberA}'), ('${actorA}',NULL); UPDATE public.seating_desks SET x=10,member_id=NULL WHERE id='${deskA}'; UPDATE public.seating_desks SET member_id='${memberA}' WHERE id='${deskA}'; ROLLBACK;`, 'valid desk CRUD');
  pass('same-owner and NULL member INSERT/UPDATE allowed');
  expectFailure(`BEGIN; ${asA} INSERT INTO public.seating_desks(user_id,member_id) VALUES ('${actorA}','${memberB}');`, '42501', 'cross-owner INSERT denied');
  expectFailure(`BEGIN; ${asA} UPDATE public.seating_desks SET member_id='${memberB}' WHERE id='${deskA}';`, '42501', 'cross-owner UPDATE denied');
  expectFailure(`BEGIN; ${asA} INSERT INTO public.seating_desks(user_id) VALUES ('${actorB}');`, '42501', 'spoofed desk owner INSERT denied');
  expectFailure(`BEGIN; ${asA} UPDATE public.seating_desks SET user_id='${actorB}' WHERE id='${deskA}';`, '42501', 'desk owner transfer denied');
  expectFailure(`BEGIN; ${asA} UPDATE public.members SET user_id='${actorB}' WHERE id='${memberA}';`, '42501', 'member owner transfer denied');
  expectFailure(`BEGIN; ${asA} INSERT INTO public.seating_desks(user_id,member_id) VALUES ('${actorA}','${randomUUID()}');`, '42501', 'nonexistent member reference denied');
  assertSQL(`(SELECT member_id IS NULL FROM public.seating_desks WHERE id='${deskA}')`, 'member DELETE sets own desk reference NULL', `${asA} DELETE FROM public.members WHERE id='${memberA}';`);
  assertSQL(`(SELECT count(*) FROM public.seating_desks WHERE id='${deskA}')=0`, 'own desk DELETE allowed', `${asA} DELETE FROM public.seating_desks WHERE id='${deskA}';`);
  assertSQL(`(SELECT count(*) FROM public.seating_desks WHERE id='${deskB}')=1 AND (SELECT x FROM public.seating_desks WHERE id='${deskB}')=0`, 'other-owner UPDATE/DELETE have no effect', `${asA} UPDATE public.seating_desks SET x=99 WHERE id='${deskB}'; DELETE FROM public.seating_desks WHERE id='${deskB}'; RESET ROLE;`);
  run(`BEGIN; ${asA} INSERT INTO public.user_notifications(user_id,title,content) VALUES ('${actorA}','fixture','fixture'); UPDATE public.user_notifications SET is_read=true WHERE user_id='${actorA}'; ROLLBACK;`, 'notification writes');
  pass('notification INSERT/UPDATE allowed');
  run(`INSERT INTO public.announcements(id,title,content) VALUES ('${preservedAnnouncement}','fixture','fixture');
    BEGIN; ${asA}
    INSERT INTO public.announcement_reads(user_id,announcement_id) VALUES ('${actorA}','${preservedAnnouncement}');
    INSERT INTO public.announcement_reads(user_id,announcement_id) VALUES ('${actorA}','${preservedAnnouncement}')
      ON CONFLICT (user_id,announcement_id) DO UPDATE SET read_at=EXCLUDED.read_at;
    ROLLBACK;
    DELETE FROM public.announcements WHERE id='${preservedAnnouncement}';`, 'announcement read owner upsert');
  pass('announcement read INSERT/UPDATE upsert allowed');
  run(`BEGIN; ${asA}
    INSERT INTO public.qa_histories(user_id,title,messages) VALUES ('${actorA}','fixture','[]'::jsonb);
    UPDATE public.qa_histories SET title='updated' WHERE user_id='${actorA}';
    ROLLBACK;`, 'Q&A history owner update');
  pass('Q&A history UPDATE allowed');
  expectFailure(`BEGIN; ${asA} INSERT INTO public.user_notifications(user_id,title,content) VALUES ('${actorB}','fixture','fixture');`, '42501', 'cross-owner notification INSERT denied');
  run(`BEGIN; ${asA} INSERT INTO public.calendar_events(user_id,title,date) VALUES ('${actorA}','fixture','2030-01-01'); UPDATE public.calendar_events SET title='updated' WHERE user_id='${actorA}'; DELETE FROM public.calendar_events WHERE user_id='${actorA}'; ROLLBACK;`, 'calendar SQL CRUD');
  pass('calendar SQL CRUD and updated_at trigger execute');
  run(`BEGIN; ${deleteEmptyTodo} COMMIT;`, 'apply delete_empty_todo function');
  run(`BEGIN; ${deleteEmptyTodo} COMMIT;`, 'repeat delete_empty_todo function');
  pass('delete_empty_todo function applies and reruns');
  assertSQL("has_function_privilege('authenticated','public.delete_empty_todo(uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.delete_empty_todo(uuid)','EXECUTE')", 'delete_empty_todo EXECUTE limited to authenticated');
  run(`INSERT INTO public.todos(id,user_id,date,todos) VALUES
    ('${todoEmptyA}','${actorA}','2030-02-01','[]'::jsonb),
    ('${todoNonEmptyA}','${actorA}','2030-02-02','[{"id":"x","text":"t","completed":false,"createdAt":1}]'::jsonb),
    ('${todoEmptyB}','${actorB}','2030-02-03','[]'::jsonb);`, 'delete_empty_todo fixture');
  expectFailure(`BEGIN; SET LOCAL ROLE anon; SELECT public.delete_empty_todo('${todoEmptyA}');`, '42501', 'anon cannot execute delete_empty_todo');
  assertSQL(`(SELECT count(*) FROM public.todos WHERE id='${todoEmptyB}')=1`, 'cross-owner delete_empty_todo denied (no effect)', `${asA} SELECT public.delete_empty_todo('${todoEmptyB}');`);
  assertSQL(`(SELECT count(*) FROM public.todos WHERE id='${todoNonEmptyA}')=1`, 'non-empty own row delete_empty_todo denied (no effect)', `${asA} SELECT public.delete_empty_todo('${todoNonEmptyA}');`);
  assertSQL(`(SELECT public.delete_empty_todo('${todoEmptyA}'))`, 'own empty row delete_empty_todo returns true', asA);
  assertSQL(`(SELECT count(*) FROM public.todos WHERE id='${todoEmptyA}')=0`, 'own empty row delete_empty_todo removes row', `${asA} SELECT public.delete_empty_todo('${todoEmptyA}');`);
  expectFailure(`BEGIN; ${asA} DELETE FROM public.todos WHERE id='${todoEmptyB}';`, '42501', 'direct todos DELETE still denied for authenticated');
  expectFailure(`BEGIN; ${asA} DELETE FROM public.user_notifications;`, '42501', 'notification DELETE denied');
  expectFailure('BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.members;', '42501', 'anon table read denied');
  assertSQL('(SELECT count(*) FROM public.user_settings)=0', 'anon keep-alive SELECT allowed without rows', 'SET LOCAL ROLE anon;');
  assertSQL('(SELECT count(*) FROM public.members)=2', 'service_role bypass retained', 'SET LOCAL ROLE service_role;');
  assertSQL('NOT EXISTS(SELECT 1 FROM public.members) AND NOT EXISTS(SELECT 1 FROM public.seating_desks)', 'Auth deletion cascades', 'DELETE FROM auth.users;');
  run('CREATE TABLE public.future_table(id integer); CREATE SEQUENCE public.future_sequence; CREATE FUNCTION public.future_function() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;', 'future default objects');
  assertSQL("NOT has_table_privilege('anon','public.future_table','SELECT') AND NOT has_table_privilege('authenticated','public.future_table','INSERT') AND NOT has_sequence_privilege('anon','public.future_sequence','USAGE') AND NOT has_sequence_privilege('authenticated','public.future_sequence','USAGE') AND has_table_privilege('service_role','public.future_table','SELECT')", 'future table/sequence client grants removed, service retained');
  assertSQL("has_function_privilege('anon','public.future_function()','EXECUTE')", 'known limitation: future function EXECUTE remains accessible');
  assertSQL("has_function_privilege('anon','public.schema_revoke_probe()','EXECUTE')", 'schema-scoped function REVOKE cannot remove global PUBLIC EXECUTE', "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated; CREATE FUNCTION public.schema_revoke_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';");
  console.log(`${passed} targeted PostgreSQL checks passed; CLI/API/browser validation is tracked separately.`);
} finally {
  if (created) {
    // Exact container created by this run, verified before removing its tmpfs data.
    const label = check(docker(['inspect','--format','{{index .Config.Labels "worky.test"}}',name]), 'cleanup ownership');
    if (label !== 'security-fixture') throw new Error('refusing cleanup of unrelated container');
    check(docker(['rm','--force','--volumes',name]), 'fixture cleanup');
    console.log('Removed this run\'s disposable container and synthetic test data.');
  }
}
