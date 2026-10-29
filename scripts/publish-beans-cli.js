#!/usr/bin/env node
// Publishes the staged per-platform beans CLI packages (see
// fetch-beans-binaries.js). Usage:
//   node scripts/fetch-beans-binaries.js
//   node scripts/publish-beans-cli.js [--dry-run]

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STAGE_DIR = resolve(ROOT, 'build/beans-cli');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const provenance = process.argv.includes('--provenance');
  const entries = (await readdir(STAGE_DIR, { withFileTypes: true })).filter(e => e.isDirectory());
  if (entries.length === 0) {
    throw new Error(`No staged packages in ${STAGE_DIR}. Run fetch-beans-binaries.js first.`);
  }

  for (const entry of entries) {
    const pkgDir = join(STAGE_DIR, entry.name);
    const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
    const args = ['publish', pkgDir, '--access', 'public'];
    if (provenance) args.push('--provenance');
    if (dryRun) args.push('--dry-run');
    console.log(`${dryRun ? '[dry-run] ' : ''}Publishing ${pkg.name}@${pkg.version}...`);
    await execFileAsync('npm', args, { stdio: 'inherit' });
  }

  console.log(dryRun ? 'Dry run complete.' : 'All platform packages published.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
