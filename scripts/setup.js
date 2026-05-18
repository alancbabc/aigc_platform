import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'server', 'data');

const dirs = [
  path.join(dataDir, 'history'),
  path.join(dataDir, 'outputs'),
];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[setup] created ${dir}`);
}

const usersFile = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]', 'utf-8');
  console.log('[setup] created users.json');
}

console.log('[setup] Data directories initialized successfully.');
