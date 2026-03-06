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

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    // Chat models — swap for any model you have pulled locally (e.g. mistral, qwen2.5)
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
    strongModel: process.env.OLLAMA_STRONG_MODEL ?? 'llama3.2',
    extractionModel: process.env.OLLAMA_EXTRACTION_MODEL ?? 'llama3.2',
    // Embedding model — run: ollama pull nomic-embed-text
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    maxTokens: Number(process.env.OLLAMA_MAX_TOKENS ?? 300),
    temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.4),
  },
};
