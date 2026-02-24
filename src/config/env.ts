import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function buildRedisUrlFromParts(): string | undefined {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ?? '6379';
  const password = process.env.REDIS_PASSWORD;
  const username = process.env.REDIS_USERNAME; // some providers use 'default' username
  const tls = process.env.REDIS_TLS === 'true';

  if (!host) return undefined;

  const scheme = tls ? 'rediss' : 'redis';

  if (password && username) {
    return `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
  }

  if (password) {
    return `${scheme}://:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return `${scheme}://${host}:${port}`;
}

const redisUrlFromEnv = process.env.REDIS_URL ?? buildRedisUrlFromParts();
if (!redisUrlFromEnv) {
  throw new Error('Missing Redis configuration: set REDIS_URL or REDIS_HOST');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),

  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: redisUrlFromEnv,

  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4.1-mini',
    strongModel: process.env.OPENAI_STRONG_MODEL ?? 'gpt-4.1',
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 300),
    temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),
  },
};
