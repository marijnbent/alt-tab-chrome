import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const distDir = join(rootDir, 'dist');
const stagingDir = join(distDir, 'package');
const manifestPath = join(rootDir, 'manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
const archiveName = `alt-tab-chrome-v${version}.zip`;
const archivePath = join(distDir, archiveName);

const filesToPackage = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'icons',
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const file of filesToPackage) {
  const sourcePath = join(rootDir, file);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required file: ${file}`);
  }

  cpSync(sourcePath, join(stagingDir, file), { recursive: true });
}

writeFileSync(join(distDir, '.gitkeep'), '');

execFileSync('zip', ['-r', archivePath, '.'], {
  cwd: stagingDir,
  stdio: 'inherit',
});

console.log(`Created ${archiveName}`);
