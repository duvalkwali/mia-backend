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

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: env.ollama.maxTokens,
    temperature: env.ollama.temperature,
  });

  const output = response.choices[0].message.content;

  if (!output || output.length === 0) {
    throw new Error('Ollama returned empty response');
  }

  return output.trim();
}
