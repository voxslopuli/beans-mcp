import { createRequire } from 'node:module';
import { join } from 'node:path';

const PLATFORM_PACKAGES: Record<string, string> = {
  'darwin-arm64': '@voxslopuli/beans-cli-darwin-arm64',
  'darwin-x64': '@voxslopuli/beans-cli-darwin-x64',
  'linux-arm64': '@voxslopuli/beans-cli-linux-arm64',
  'linux-x64': '@voxslopuli/beans-cli-linux-x64',
  'win32-x64': '@voxslopuli/beans-cli-win32-x64',
};

/**
 * Resolve the beans CLI binary bundled via platform optionalDependencies
 * (esbuild-style). Returns null when no platform package is installed, so
 * callers can fall back to PATH / --cli-path.
 */
export function resolveBundledBeansCli(
  platform: string = process.platform,
  arch: string = process.arch,
): string | null {
  const packageName = PLATFORM_PACKAGES[`${platform}-${arch}`];
  if (!packageName) {
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    const pkg = require(pkgJsonPath) as { bin?: Record<string, string> | string };
    const binEntry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.beans;
    if (!binEntry) {
      return null;
    }
    return join(pkgJsonPath, '..', binEntry);
  } catch {
    return null;
  }
}
