import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Optional while developing, mandatory in production — the app must refuse to
 * boot half-configured on a public host instead of failing at request time.
 */
function requireInProduction(name: string): string | undefined {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`Missing environment variable required in production: ${name}`);
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

const jwtSecret = requireEnv('JWT_SECRET');
if (isProduction && jwtSecret === 'change-me') {
  throw new Error(
    'JWT_SECRET is still the placeholder "change-me" — refusing to boot in production. ' +
    'Generate one with: openssl rand -hex 32'
  );
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 3000),

  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: redisUrlFromEnv,

  jwt: {
    secret: jwtSecret,
    expiry: process.env.JWT_EXPIRY ?? '7d',
  },

  // WhatsApp Cloud API — fallback credentials for the single-tenant pilot;
  // per-tenant values live on the Tenant record (see Phase 0.3)
  whatsapp: {
    verifyToken: requireInProduction('WHATSAPP_VERIFY_TOKEN'),
    webhookSecret: requireInProduction('WHATSAPP_WEBHOOK_SECRET'),
    accessToken: requireInProduction('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: requireInProduction('WHATSAPP_PHONE_NUMBER_ID'),
    apiUrl: process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0',
  },

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
    // Timeout for AI calls — 2 min is generous for CPU inference; bump if needed
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000),
    // How long to keep the model loaded in memory after a request (Ollama-specific)
    // '24h' avoids the slow cold-start on every request; '5m' is the Ollama default
    keepAlive: process.env.OLLAMA_KEEP_ALIVE ?? '5m',
  },
};
