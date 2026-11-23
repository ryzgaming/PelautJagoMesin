import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const base = '/alur/';
const source = new URL('../apps/alur-workflow/dist/', import.meta.url);
const output = new URL('../dist/alur/', import.meta.url);

execFileSync(process.execPath, [
  process.env.npm_execpath,
  'run', 'build', '--workspace', 'alur-workflow', '--', '--base', base,
], { stdio: 'inherit' });

await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
await mkdir(new URL('form/', output));
await copyFile(new URL('index.html', output), new URL('form/index.html', output));
