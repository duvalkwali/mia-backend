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
  redisUrl: requireEnv('REDIS_URL'),

  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4.1-mini',
    strongModel: process.env.OPENAI_STRONG_MODEL ?? 'gpt-4.1',
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 300),
    temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),
  },
};
