'use strict';

// Owns a throwaway PostgreSQL container, API and (in interactive mode) Vite.
// No .env file is written; inherited provider credentials are explicitly cleared.
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { requirePassword } = require('../prisma/seedDemo');
const { verifyWorkflow } = require('./verify-workflow');

const root = path.resolve(__dirname, '..');
const clientRoot = path.resolve(root, '../client');
const verify = process.argv.includes('--verify');
const name = `munisolve-demo-${randomBytes(6).toString('hex')}`;
const children = new Set();
let containerCreated = false;
let finishing;

const env = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_EXPIRES_IN: '1h',
  DEMO_PASSWORD: verify ? `${randomBytes(20).toString('hex')}Aa1!` : requirePassword(),
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', RESEND_API_KEY: '',
  WEATHER_API_KEY: '', GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_ID: '',
  RESEND_FROM_EMAIL: '',
};

function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = launch(command, args, options);
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(check, description) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

function cleanup() {
  if (finishing) return finishing;
  finishing = (async () => {
    for (const child of children) child.kill();
    if (containerCreated) await run('docker', ['rm', '-f', name], { stdio: 'ignore' });
    console.log('Demo processes stopped and the disposable database removed.');
  })();
  return finishing;
}

async function main() {
  await run('docker', ['run', '--rm', '-d', '--name', name,
    '--label', 'munisolve.disposable-demo=true', '-p', '127.0.0.1::5432',
    '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=munisolve_demo', 'postgres:16-alpine']);
  containerCreated = true;
  const mapping = await run('docker', ['port', name, '5432/tcp']);
  const dbPort = Number(mapping.split(':').at(-1));
  if (!Number.isInteger(dbPort) || dbPort < 1) throw new Error('Could not determine the local database port.');
  env.DATABASE_URL = `postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:${dbPort}/munisolve_demo`;
  await waitFor(async () => {
    try { await run('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); return true; }
    catch { return false; }
  }, 'PostgreSQL');
  await run(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push'], { stdio: 'inherit' });
  await run(process.execPath, ['prisma/seedDemo.js'], { stdio: 'inherit' });
  env.PORT = String(await availablePort());
  env.CLIENT_URL = `http://127.0.0.1:${await availablePort()}`;
  const api = launch(process.execPath, ['scripts/start-demo-server.js'], { stdio: 'inherit' });
  api.once('error', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  api.once('exit', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  await waitFor(async () => {
    if (api.exitCode !== null) throw new Error('Demo API stopped before it became ready.');
    try { return (await fetch(`http://127.0.0.1:${env.PORT}/health`)).ok; } catch { return false; }
  }, 'demo API');
  const baseURL = `http://127.0.0.1:${env.PORT}/api`;
  if (verify) {
    await verifyWorkflow(baseURL, env.DEMO_PASSWORD);
    return;
  }
  env.VITE_API_URL = baseURL;
  env.VITE_DEMO_MODE = 'true';
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
    '--port', new URL(env.CLIENT_URL).port, '--strictPort'], { cwd: clientRoot, stdio: 'inherit' });
  vite.once('error', (error) => { console.error(error.message); if (!finishing) cleanup().then(() => process.exit(1)); });
  vite.once('exit', () => { if (!finishing) cleanup().then(() => process.exit(1)); });
  console.log(`\nSynthetic demo: ${env.CLIENT_URL}/login`);
  console.log('Use the four demo.*@example.com accounts and your DEMO_PASSWORD.');
  console.log('No email, AI or weather credentials are configured. Stop with Ctrl+C to remove this database.');
  await new Promise(() => {});
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => cleanup().then(() => process.exit(0)).catch(() => process.exit(1)));
}
main().then(cleanup).catch(async (error) => {
  console.error('Demo failed:', error.message);
  await cleanup().catch(() => console.error(`Remove the demo container manually: docker rm -f ${name}`));
  process.exitCode = 1;
});
