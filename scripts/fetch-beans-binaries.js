#!/usr/bin/env node
// Downloads beans CLI release assets from hmans/beans, verifies checksums,
// and stages per-platform npm packages under build/beans-cli/ for publishing.
// Usage: node scripts/fetch-beans-binaries.js [--version 0.4.2] [--out dir]

import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGETS = [
  { suffix: 'darwin-arm64', asset: 'beans_Darwin_arm64.tar.gz', os: 'darwin', cpu: 'arm64', ext: '' },
  { suffix: 'darwin-x64', asset: 'beans_Darwin_x86_64.tar.gz', os: 'darwin', cpu: 'x64', ext: '' },
  { suffix: 'linux-arm64', asset: 'beans_Linux_arm64.tar.gz', os: 'linux', cpu: 'arm64', ext: '' },
  { suffix: 'linux-x64', asset: 'beans_Linux_x86_64.tar.gz', os: 'linux', cpu: 'x64', ext: '' },
  { suffix: 'win32-x64', asset: 'beans_Windows_x86_64.zip', os: 'win32', cpu: 'x64', ext: '.exe' },
];

function parseArgs(argv) {
  const args = { version: null, out: resolve(ROOT, 'build/beans-cli') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--version' && argv[i + 1]) { args.version = argv[i + 1]; i += 1; }
    if (argv[i] === '--out' && argv[i + 1]) { args.out = resolve(argv[i + 1]); i += 1; }
  }
  return args;
}

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

async function verifyChecksum(checksumsPath, assetName, filePath) {
  const checksums = await readFile(checksumsPath, 'utf8');
  const expected = checksums
    .split('\n')
    .map(line => line.trim().split(/\s+/))
    .find(parts => parts.length === 2 && parts[1] === assetName)?.[0];
  if (!expected) throw new Error(`No checksum found for ${assetName}`);
  const { stdout } = await execFileAsync('shasum', ['-a', '256', filePath]);
  const actual = stdout.trim().split(/\s+/)[0];
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`);
  }
}

async function extractBinary(archivePath, outDir, binaryExt) {
  const extractDir = join(outDir, '.extract');
  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });
  if (archivePath.endsWith('.zip')) {
    await execFileAsync('unzip', ['-o', archivePath, '-d', extractDir]);
  } else {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractDir]);
  }
  // Locate the beans binary anywhere in the extracted tree.
  const { stdout } = await execFileAsync('find', [extractDir, '-type', 'f', '-name', `beans${binaryExt}`]);
  const match = stdout.trim().split('\n')[0];
  if (!match) throw new Error(`beans binary not found in ${archivePath}`);
  const dest = join(outDir, `beans${binaryExt}`);
  await execFileAsync('cp', [match, dest]);
  if (!binaryExt) await chmod(dest, 0o755);
  await rm(extractDir, { recursive: true, force: true });
  return dest;
}

async function main() {
  const { version, out } = parseArgs(process.argv.slice(2));
  const rootPkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const cliVersion = version ?? rootPkg.beansCli?.version;
  if (!cliVersion) throw new Error('No beans CLI version: pass --version or set beansCli.version in package.json');

  const repo = rootPkg.beansCli?.repository ?? 'hmans/beans';
  const releasePrefix = rootPkg.beansCli?.releasePrefix ?? 'beans_';
  const baseUrl = `https://github.com/${repo}/releases/download/v${cliVersion}`;

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const tmp = join(tmpdir(), `beans-cli-fetch-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  const checksumsPath = join(tmp, `${releasePrefix}${cliVersion}_checksums.txt`);
  await downloadTo(`${baseUrl}/${releasePrefix}${cliVersion}_checksums.txt`, checksumsPath);

  const rootOptionalDeps = {};

  for (const target of TARGETS) {
    const pkgName = `@voxslopuli/beans-cli-${target.suffix}`;
    const archivePath = join(tmp, target.asset);
    await downloadTo(`${baseUrl}/${target.asset}`, archivePath);
    await verifyChecksum(checksumsPath, target.asset, archivePath);

    const pkgDir = join(out, target.suffix);
    const binDir = join(pkgDir, 'bin');
    await mkdir(binDir, { recursive: true });
    const binaryPath = await extractBinary(archivePath, binDir, target.ext);

    const pkg = {
      name: pkgName,
      version: cliVersion,
      description: `beans CLI binary (${target.suffix}) for @voxslopuli/beans-mcp`,
      license: 'MIT',
      repository: { type: 'git', url: `git+https://github.com/${repo}.git` },
      os: [target.os],
      cpu: [target.cpu],
      bin: { beans: `bin/beans${target.ext}` },
      files: ['bin'],
    };
    await writeFile(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    rootOptionalDeps[pkgName] = cliVersion;
    console.log('Staged', pkgName, '->', binaryPath);
  }

  await rm(tmp, { recursive: true, force: true });

  console.log('\nStaged packages in', out);
  console.log('\nSynchronize package.json optionalDependencies with:');
  console.log(JSON.stringify(rootOptionalDeps, null, 2));
  if (!existsSync(join(out, '.gitkeep'))) {
    console.log('\nReminder: verify staged binaries (run each with --version) before publishing.');
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
