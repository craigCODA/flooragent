import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

if (process.platform === 'win32') {
  const pkg =
    process.arch === 'x64'
      ? '@esbuild/win32-x64'
      : process.arch === 'arm64'
        ? '@esbuild/win32-arm64'
        : process.arch === 'ia32'
          ? '@esbuild/win32-ia32'
          : null;

  if (pkg) {
    try {
      process.env.ESBUILD_BINARY_PATH = require.resolve(`${pkg}/esbuild.exe`);
    } catch {
      // Fall back to esbuild's default resolution.
    }
  }
}

const vitePkgJson = require.resolve('vite/package.json');
const viteBin = path.join(path.dirname(vitePkgJson), 'bin', 'vite.js');
await import(pathToFileURL(viteBin).href);
