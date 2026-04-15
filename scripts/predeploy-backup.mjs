import fs from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();
const backupRoot = path.join(projectRoot, 'backups');

const EXCLUDE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'backups',
]);

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyRecursive(src, dst) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await ensureDir(dst);
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE.has(entry.name)) continue;
      await copyRecursive(path.join(src, entry.name), path.join(dst, entry.name));
    }
    return;
  }

  await ensureDir(path.dirname(dst));
  await fs.copyFile(src, dst);
}

function timestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

async function main() {
  const target = path.join(backupRoot, `snapshot-${timestamp()}`);
  await ensureDir(target);
  await copyRecursive(projectRoot, target);
  console.log(`[backup] Created backup at: ${target}`);
}

main().catch((err) => {
  console.error('[backup] Failed:', err);
  process.exit(1);
});
