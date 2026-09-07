import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const workdir = fileURLToPath(new URL('./', import.meta.url));
const cli = fileURLToPath(new URL('../../../node_modules/supabase/dist/supabase.js', import.meta.url));
const project = 'worky-security-e2e';
const container = `supabase_db_${project}`;
const apiUrl = 'http://127.0.0.1:55321';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
let started = false;

function command(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, windowsHide: true,
      env: process.env, ...options, stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end();
  });
}
function checked(result, label) {
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status})`);
  return result.stdout;
}
const supabase = args => command(process.execPath, [cli, ...args, '--workdir', workdir]);
function sql(source, label) {
  const result = spawnSync('docker', ['exec','-i',container,'psql','-X','-qAt',
    '-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],
    { input: source, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  return checked(result, label).trim();
}
async function requireFreePort(port) {
  const server = createServer();
  await new Promise((resolve,reject) => {
    server.once('error', () => reject(new Error(`Local port ${port} is already occupied`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => server.close(resolve));
}
try {
  if (!existsSync(chromium.executablePath())) throw new Error('Chromium is not installed; installation needs approval');
  for (const port of [3000,55321,55322]) await requireFreePort(port);
  const containers = checked(await command('docker',['ps','-a','--format','{{.Names}}']), 'Docker check');
  const volumes = checked(await command('docker',['volume','ls','--format','{{.Name}}']), 'volume check');
  if ([containers,volumes].some(text => text.split(/\r?\n/).some(name => name.endsWith(`_${project}`)))) {
    throw new Error('Existing fixture resources found; refusing to overwrite them');
  }
  console.log('Starting separate local Supabase Auth/API stack on port 55321.');
  started = true;
  const start = await supabase(['start','--exclude','storage-api,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,mailpit,supavisor']);
  checked(start, 'local Supabase start');
  console.log('Local Auth/API stack started (CLI credentials suppressed).');
  const status = JSON.parse(checked(await supabase(['status','--output','json']), 'local status'));
  if (status.API_URL !== apiUrl || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('Unexpected local API address or missing local credentials');
  }
  const admin = createClient(apiUrl, status.SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  let migrationCount = 0;
  for (const file of readdirSync(new URL('../../migrations/', import.meta.url)).filter(x=>x.endsWith('.sql')).sort()) {
    sql(`BEGIN; ${read(`../../migrations/${file}`)} COMMIT;`, `migration ${file}`);
    migrationCount++;
  }
  sql("NOTIFY pgrst, 'reload schema';", 'reload API schema');
  console.log(`${migrationCount} migrations applied without exclusions to the local fixture.`);
  // Reuse the public demo login contract without printing its credentials or
  // copying the historical production-specific Auth ID.
  const login = read('../../../src/app/login/page.tsx');
  const match = login.match(/signInWithPassword\(\{\s*email:\s*"([^"]+)",\s*password:\s*"([^"]+)"/);
  if (!match) throw new Error('Demo login contract changed; update local fixture');
  const email = `local-calendar-${randomUUID()}@example.test`;
  const password = randomUUID();
  for (const [accountEmail,accountPassword] of [[match[1],match[2]],[email,password]]) {
    const result = await admin.auth.admin.createUser({ email: accountEmail,
      password: accountPassword, email_confirm: true });
    if (result.error || !result.data.user) throw new Error('Local synthetic Auth account creation failed');
    const { error } = await admin.from('user_settings').insert({ user_id: result.data.user.id });
    if (error) throw new Error('Local account settings seed failed');
  }
  console.log('Two local Auth accounts and minimal settings created; no production rows imported.');
  const env = { ...process.env };
  // Override every dotenv name before Next loads .env.local, without logging or
  // passing any of its values to child processes. Real integrations are mocked.
  for (const file of readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name))) {
    for (const line of readFileSync(`${root}/${file}`,'utf8').split(/\r?\n/)) {
      const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
      if (key) env[key] = '';
    }
  }
  Object.assign(env, {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: '', E2E_TEST_EMAIL: email, E2E_TEST_PASSWORD: password,
    WORKY_LOCAL_SECURITY_E2E: '1', NEXT_TELEMETRY_DISABLED: '1',
  });
  console.log('Running guest smoke and three Calendar scenarios against local API.');
  const result = await command(process.execPath, ['node_modules/@playwright/test/cli.js',
    'test','--config=playwright.local-security.config.ts'], { env });
  // Only forward controlled reporter lines; never raw application/Playwright logs.
  for (const line of result.stdout.split(/\r?\n/)) {
    if (/^(PASSED|FAILED|TIMEDOUT|SKIPPED|INTERRUPTED) [a-z-]+\.spec\.ts:\d+$/.test(line) ||
        /^(Browser suite:|Failure category:|Failure source:|Runner error)/.test(line)) console.log(line);
  }
  checked(result, 'local browser E2E');
  const count = sql('SELECT count(*) FROM public.calendar_events;', 'local cleanup verification');
  if (count !== '0') throw new Error('Calendar tests left synthetic rows behind');
  console.log('PASS local calendar cleanup: 0 rows remain.');
} finally {
  if (started) {
    checked(await supabase(['stop','--project-id',project,'--no-backup']), 'local fixture cleanup');
    console.log('Removed the isolated local Supabase stack and its disposable volumes.');
  }
}
