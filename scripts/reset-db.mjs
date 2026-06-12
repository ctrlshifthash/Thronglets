// Deletes the local SQLite database. The next server start reseeds the
// six towns at Day 0 (with a few hours of pre-simulated history).
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.env.DATABASE_PATH || './data/emergence.db');
let removed = false;
for (const suffix of ['', '-wal', '-shm']) {
  const p = file + suffix;
  if (existsSync(p)) {
    rmSync(p);
    removed = true;
  }
}
console.log(removed ? `Deleted ${file} — six fresh towns will be born on next start.` : 'No database found — nothing to do.');
