import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * COST OPTIMIZATION: Model selection based on task
 */
export const AI_MODELS = {
  EXTRACTION: process.env.OPENAI_MODEL_EXTRACTION || 'gpt-4o-mini',  // Cheap
  GENERATION: process.env.OPENAI_MODEL_GENERATION || 'gpt-4o',        // Quality
  EMBEDDING: process.env.FAQ_EMBEDDING_MODEL || 'text-embedding-3-small',  // Cheap embeddings
} as const;

/**
 * COST TRACKING: Approximate costs per 1K tokens (as of 2024)
 */
export const MODEL_COSTS = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },     // $0.15/$0.60 per 1M
  'gpt-4o': { input: 0.0025, output: 0.01 },             // $2.50/$10.00 per 1M
  'text-embedding-3-small': { input: 0.00002, output: 0 }, // $0.02 per 1M
} as const;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
  if (!costs) return 0;

  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

export default openai;
