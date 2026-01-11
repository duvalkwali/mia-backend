export type ModelTier = "fast" | "reasoning";

export function selectModel(tier: ModelTier): string {
  return tier === "fast"
    ? process.env.OPENAI_FAST_MODEL!
    : process.env.OPENAI_REASONING_MODEL!;
}
