import OpenAI from 'openai';
import { env } from '@/config/env';

export const openai = new OpenAI({
  baseURL: env.ollama.baseUrl,
  apiKey: 'ollama',
});
