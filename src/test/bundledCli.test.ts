import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPATIBLE_BEANS_VERSION } from '../server/BeansMcpServer';
import { resolveBundledBeansCli } from '../server/bundledCli';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('resolveBundledBeansCli', () => {
  it('returns null for unsupported platform/arch combinations', () => {
    expect(resolveBundledBeansCli('sunos', 'x64')).toBeNull();
    expect(resolveBundledBeansCli('aix', 'ppc64')).toBeNull();
  });

  it('returns a path or null for the current platform without throwing', () => {
    const result = resolveBundledBeansCli();
    expect(result === null || result.includes('beans-cli-')).toBe(true);
  });
});

describe('beansCli version pin', () => {
  it('matches the supported beans CLI version constant', async () => {
    const pkg = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8'));
    expect(pkg.beansCli?.version).toBe(COMPATIBLE_BEANS_VERSION);

    const optionalDeps = pkg.optionalDependencies ?? {};
    const depVersions = new Set(Object.values(optionalDeps));
    expect(depVersions.size).toBe(1);
    expect(depVersions.values().next().value).toBe(COMPATIBLE_BEANS_VERSION);

    // Five platform packages: darwin/linux/win32 coverage.
    expect(Object.keys(optionalDeps).sort()).toEqual([
      '@voxslopuli/beans-cli-darwin-arm64',
      '@voxslopuli/beans-cli-darwin-x64',
      '@voxslopuli/beans-cli-linux-arm64',
      '@voxslopuli/beans-cli-linux-x64',
      '@voxslopuli/beans-cli-win32-x64',
    ]);
  });
});
