import { openai } from './openai.client';
import { selectModel, ReplyComplexity } from './model-selector';
import { env } from '@/config/env';

interface GenerateReplyInput {
  prompt: string;
  complexity: ReplyComplexity;
}

export async function generateReply({
  prompt,
  complexity,
}: GenerateReplyInput): Promise<string> {
  const model = selectModel(complexity);

  const response = await openai.responses.create({
    model,
    input: prompt,
    max_output_tokens: env.openai.maxTokens,
    temperature: env.openai.temperature,
  });

  const output = response.output_text;

  if (!output || output.length === 0) {
    throw new Error('OpenAI returned empty response');
  }

  return output.trim();
}
