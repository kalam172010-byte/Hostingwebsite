#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distServer = resolve(__dirname, 'dist', 'server.js');

if (existsSync(distServer)) {
  // Production bundle exists: run node dist/server.js
  const child = spawn(process.execPath, [distServer, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
} else {
  // If not built yet, run tsx server.ts
  const tsxBin = resolve(__dirname, 'node_modules', '.bin', 'tsx');
  const targetScript = resolve(__dirname, 'server.ts');
  const child = spawn(tsxBin, [targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}
