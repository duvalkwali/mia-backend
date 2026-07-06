import { env } from '@/config/env';

export type ReplyComplexity =
  | 'simple'        // pricing, availability
  | 'standard'      // normal questions
  | 'high-stakes';  // objections, negotiation

export function selectModel(complexity: ReplyComplexity): string {
  switch (complexity) {
    case 'simple':
      return env.ollama.defaultModel;

    case 'standard':
      return env.ollama.defaultModel;

    case 'high-stakes':
      return env.ollama.strongModel;

    default:
      return env.ollama.defaultModel;
  }
}
