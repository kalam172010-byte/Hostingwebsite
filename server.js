#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distServer = resolve(__dirname, 'dist', 'server.js');

if (existsSync(distServer)) {
  import(distServer);
} else {
  const tsxBin = resolve(__dirname, 'node_modules', '.bin', 'tsx');
  const targetScript = resolve(__dirname, 'server.ts');
  spawn(tsxBin, [targetScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
  });
}
