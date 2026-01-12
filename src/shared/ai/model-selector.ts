import { env } from '@/config/env';

export type ReplyComplexity =
  | 'simple'        // pricing, availability
  | 'standard'      // normal questions
  | 'high-stakes';  // objections, negotiation

export function selectModel(complexity: ReplyComplexity): string {
  switch (complexity) {
    case 'simple':
      return env.openai.defaultModel;

    case 'standard':
      return env.openai.defaultModel;

    case 'high-stakes':
      return env.openai.strongModel;

    default:
      return env.openai.defaultModel;
  }
}
