import { copyFileSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  copyFileSync(
    new URL('../.env.example', import.meta.url),
    new URL('../backend/.env', import.meta.url),
    constants.COPYFILE_EXCL,
  );
  console.log('Created backend/.env');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
for (const command of ['db:generate', 'db:prepare', 'db:deploy', 'db:seed', 'db:analyze']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', command], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Setup complete. Run npm run dev.');
