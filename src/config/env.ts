import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),

  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

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
