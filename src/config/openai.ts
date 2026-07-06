/**
 * Ollama AI client (OpenAI-compatible API).
 *
 * Ollama exposes an OpenAI-compatible endpoint at http://localhost:11434/v1,
 * so we reuse the `openai` npm package — no extra dependency needed.
 *
 * To pull models:
 *   ollama pull llama3.2          # chat / generation / extraction
 *   ollama pull nomic-embed-text  # embeddings
 */
import OpenAI from 'openai';
import { env } from '@/config/env';

const ollamaClient = new OpenAI({
  baseURL: env.ollama.baseUrl,
  // Ollama doesn't require an API key; the SDK requires a non-empty string.
  apiKey: 'ollama',
  // Without a timeout, a cold-start model load can hang for 10+ minutes.
  // Set OLLAMA_TIMEOUT_MS in .env to override (e.g. 180000 for 3 min on slow hardware).
  timeout: env.ollama.timeoutMs,
});

/**
 * Model aliases used throughout the codebase.
 */
export const AI_MODELS = {
  EXTRACTION: env.ollama.extractionModel,
  GENERATION: env.ollama.strongModel,
  EMBEDDING: env.ollama.embeddingModel,
} as const;

/**
 * Local models have no per-token cost.
 * We keep cost tracking at $0 so the rest of the pipeline still records usage.
 */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {};

export function calculateCost(
  _model: string,
  _inputTokens: number,
  _outputTokens: number = 0
): number {
  return 0; // Local Ollama — free
}

export default ollamaClient;
