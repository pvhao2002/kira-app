import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.LOG_DIR || '../logs';
const file = path.join(dir, `kira-queue-v2-${process.env.INSTANCE_ID || 'local'}.log`);
// ponytail: one-step rotation at 10MB (file + file.1), like Spring's default size cap; use logrotate if history matters.
const MAX_BYTES = 10 * 1024 * 1024;
let fd = null;
let size = 0;

// Sync writes so lines logged right before process.exit(...) still reach the file Promtail reads.
function open() {
  fd = fs.openSync(file, 'a');
  size = fs.fstatSync(fd).size;
}

// Under `node --test` stay console-only so tests never create log files.
try {
  if (process.env.NODE_TEST_CONTEXT) throw new Error('test run');
  fs.mkdirSync(dir, { recursive: true });
  open();
} catch {
  fd = null; // console-only if the log dir is unwritable
}

function write(level, msg) {
  const line = `${new Date().toISOString()} ${level} ${msg}`;
  (level === 'ERROR' || level === 'WARN' ? console.error : console.log)(line);
  if (fd === null) return;
  try {
    if (size >= MAX_BYTES) {
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(file, `${file}.1`);
      open();
    }
    size += fs.writeSync(fd, `${line}\n`);
  } catch {
    fd = null; // stop file logging on I/O failure; console still works
  }
}

// Callers must never pass SQL, tokens, payloads or third-party response bodies.
export const log = {
  info: (m) => write('INFO', m),
  warn: (m) => write('WARN', m),
  error: (m) => write('ERROR', m),
};
