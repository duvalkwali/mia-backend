import winston from 'winston';

// ─── Terminal colours ──────────────────────────────────────────────────────
const R   = '\x1b[0m';   // reset
const DIM = '\x1b[2m';   // dim  (used for metadata keys)
const C: Record<string, string> = {
  error: '\x1b[31m', // red
  warn:  '\x1b[33m', // yellow
  info:  '\x1b[36m', // cyan
  debug: '\x1b[90m', // grey
};
const LVL: Record<string, string> = {
  error: 'ERROR', warn: 'WARN ', info: 'INFO ', debug: 'DEBUG',
};

// Keys owned by Winston internals — skip in the key=value section
const SKIP = new Set(['level', 'message', 'service', 'timestamp', 'stack', 'splat']);

/**
 * Pretty console format:  HH:mm:ss LEVEL  message   key=val  key=val
 *
 * Wrapped entirely in try/catch so a format bug can NEVER silently kill
 * all output — it falls back to plain "level: message".
 */
const prettyConsole = winston.format.printf((raw: any) => {
  try {
    const t   = new Date(raw.timestamp || Date.now()).toTimeString().slice(0, 8);
    const lvl = LVL[raw.level] ?? raw.level.toUpperCase().padEnd(5);
    const col = C[raw.level] ?? '';

    const kv = Object.keys(raw)
      .filter(k => !SKIP.has(k) && raw[k] != null)
      .map(k => {
        const v = typeof raw[k] === 'object'
          ? JSON.stringify(raw[k]).slice(0, 200)
          : String(raw[k]).slice(0, 200);
        return `${DIM}${k}${R}=${v}`;
      })
      .join('  ');

    const stack = raw.stack
      ? '\n' + String(raw.stack).split('\n').map((l: string) => `  ${l}`).join('\n')
      : '';

    return `${t} ${col}${lvl}${R}  ${raw.message}${kv ? '  ' + kv : ''}${stack}`;
  } catch {
    // Safety net — never drop a log because of a format crash
    return `${raw.level ?? 'info'}: ${raw.message ?? JSON.stringify(raw)}`;
  }
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  // Logger-level format: stamp every record with a timestamp and unpack Errors.
  // The Console transport's own format (prettyConsole) then renders for the terminal.
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ),
  defaultMeta: { service: 'mia-api' },
  transports: [
    new winston.transports.Console({ format: prettyConsole }),
  ],
});

// File transports only in production
if (process.env.NODE_ENV === 'production') {
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  );
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: fileFormat }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log', format: fileFormat }));
}

export default logger;
