// Owns a throwaway PostgreSQL container, API and (in interactive mode) Vite.
// No .env file is written; inherited provider credentials are explicitly cleared.

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { requirePassword } from '../prisma/seedDemo';
import { verifyWorkflow } from './verify-workflow';

const root = path.resolve(__dirname, '..');
const clientRoot = path.resolve(root, '../client');
const verify = process.argv.includes('--verify');
const name = `munisolve-demo-${randomBytes(6).toString('hex')}`;
const children = new Set<ChildProcess>();
let containerCreated = false;
let finishing: Promise<void> | undefined;

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_EXPIRES_IN: '1h',
  TICK_SECRET: randomBytes(16).toString('hex'),
  AUTO_ASSIGN_ENABLED: 'true',
  DEMO_PASSWORD: verify ? `${randomBytes(20).toString('hex')}Aa1!` : requirePassword(),
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', RESEND_API_KEY: '',
  WEATHER_ENABLED: 'false', GEO_ENABLED: 'false',
  GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_ID: '',
  RESEND_FROM_EMAIL: '',
};

function launch(command: string, args: string[], options: Record<string, unknown> = {}): ChildProcess {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function run(command: string, args: string[], options: Record<string, unknown> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = launch(command, args, options);
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitFor(check: () => Promise<boolean>, description: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

function cleanup(): Promise<void> {
  if (finishing) return finishing;
  finishing = (async () => {
    for (const child of children) child.kill();
    if (containerCreated) await run('docker', ['rm', '-f', name], { stdio: 'ignore' });
    console.log('Demo processes stopped and the disposable database removed.');
  })();
  return finishing;
}

async function main(): Promise<void> {
  await run('docker', ['run', '--rm', '-d', '--name', name,
    '--label', 'munisolve.disposable-demo=true', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=munisolve_demo', 'postgres:16-alpine']);
  containerCreated = true;
  const mapping = await run('docker', ['port', name, '5432/tcp']);
  const dbPort = Number(mapping.split(':').at(-1));
  if (!Number.isInteger(dbPort) || dbPort < 1) throw new Error('Could not determine the local database port.');
  env.DATABASE_URL = `postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:${dbPort}/munisolve_demo`;
  env.DIRECT_URL = env.DATABASE_URL;
  await waitFor(async () => {
    try { await run('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); return true; }
    catch { return false; }
  }, 'PostgreSQL');
  await run(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit' });
  await run(process.execPath, [
    require.resolve('prisma/build/index.js'), 'migrate', 'diff',
    '--from-url', env.DATABASE_URL as string,
    '--to-schema-datamodel', 'prisma/schema.prisma',
    '--exit-code',
  ], { stdio: 'inherit' });
  await run(process.execPath, ['--import', 'tsx', 'prisma/seedDemo.ts'], { stdio: 'inherit' });
  env.PORT = String(await availablePort());
  env.CLIENT_URL = `http://127.0.0.1:${await availablePort()}`;
  const api = launch(process.execPath, ['--import', 'tsx', 'scripts/start-demo-server.ts'], { stdio: 'inherit' });
  api.once('error', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  api.once('exit', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  await waitFor(async () => {
    if (api.exitCode !== null) throw new Error('Demo API stopped before it became ready.');
    try { return (await fetch(`http://127.0.0.1:${env.PORT}/health`)).ok; } catch { return false; }
  }, 'demo API');
  const baseURL = `http://127.0.0.1:${env.PORT}/api`;
  if (verify) {
    await verifyWorkflow(baseURL, env.DEMO_PASSWORD as string, env.TICK_SECRET as string);
    return;
  }
  env.VITE_API_URL = baseURL;
  env.VITE_DEMO_MODE = 'true';
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
    '--port', new URL(env.CLIENT_URL as string).port, '--strictPort'], { cwd: clientRoot, stdio: 'inherit' });
  vite.once('error', (error) => { console.error(error.message); if (!finishing) cleanup().then(() => process.exit(1)); });
  vite.once('exit', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  console.log(`\nSynthetic demo: ${env.CLIENT_URL}/login`);
  console.log('Use the four demo.*@example.com accounts and your DEMO_PASSWORD.');
  console.log('No email, AI, weather or geocoding providers are configured. Stop with Ctrl+C to remove this database.');
  await new Promise(() => {});
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => cleanup().then(() => process.exit(0)).catch(() => process.exit(1)));
}
main().then(cleanup).catch(async (error: Error) => {
  console.error('Demo failed:', error.message);
  await cleanup().catch(() => console.error(`Remove the demo container manually: docker rm -f ${name}`));
  process.exitCode = 1;
});
